import jwt from 'jsonwebtoken';
import { pool } from '../config/conexao.js';
import { ChatModel } from '../models/chatModel.js';

const TIPOS = ['text', 'image', 'audio', 'video', 'file', 'post_share', 'profile_share', 'moment_reply', 'moment_share'];
const TIPOS_MOMENTO = ['moment_reply', 'moment_share'];

export default function setupChatSocket(io) {
    // Autenticação: só entra quem tem JWT válido. O id do usuário vem SEMPRE do token.
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error('Token não fornecido.'));
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chave_secreta_temporaria');
            const userId = Number(decoded.userId || decoded.id);
            const [rows] = await pool.query('SELECT id, user_type, is_active FROM USERS WHERE id = ?', [userId]);
            if (!rows.length || !rows[0].is_active) return next(new Error('Conta desativada ou inexistente.'));
            socket.data.userId = userId;
            socket.data.userType = rows[0].user_type;
            next();
        } catch {
            next(new Error('Token inválido ou expirado.'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.data.userId;
        socket.join(`user_${userId}`); // sempre o id do token, nunca o que o cliente manda

        socket.on('register_user', () => {}); // compatibilidade: o front ainda emite

        socket.on('join_room', async ({ conversationId } = {}) => {
            if (await ChatModel.participa(conversationId, userId)) socket.join(`room_${conversationId}`);
        });

        socket.on('send_message', async (data = {}, ack) => {
            const responder = typeof ack === 'function' ? ack : () => {};
            const falhar = (message) => {
                responder({ error: message });
                socket.emit('chat_error', { message });
            };

            try {
                // momento (só ativo e não expirado)
                let momento = null;
                if (TIPOS_MOMENTO.includes(data.mediaType)) {
                    const [mo] = await pool.query(
                        `SELECT mo.id, mo.media_url, op.user_id AS owner_user_id
                           FROM MOMENTS mo JOIN ONGS_PROFILES op ON op.id = mo.ong_id
                          WHERE mo.id = ? AND mo.is_active = TRUE AND mo.expires_at > NOW()`,
                        [Number(data.momentId)]);
                    if (!mo.length) return falhar('Momento não encontrado ou expirado.');
                    momento = mo[0];
                }

                let conv;
                if (momento && data.mediaType === 'moment_reply' && !data.conversationId) {
                    // responder sem conversa aberta: cria o pedido de conversa com quem publicou
                    if (momento.owner_user_id === userId) return falhar('Você não pode responder ao seu próprio momento.');
                    const c = await ChatModel.getOrCreateConversation(userId, momento.owner_user_id);
                    conv = await ChatModel.participa(c.id, userId);
                } else {
                    conv = await ChatModel.participa(data.conversationId, userId);
                }
                if (!conv) return falhar('Você não participa desta conversa.');

                const receiverId = conv.user_one_id === userId ? conv.user_two_id : conv.user_one_id;

                // resposta a momento só vale para quem publicou o momento
                if (data.mediaType === 'moment_reply' && momento.owner_user_id !== receiverId) {
                    return falhar('A resposta precisa ir para quem publicou o momento.');
                }

                const [r] = await pool.query('SELECT user_type FROM USERS WHERE id = ? AND is_active = TRUE', [receiverId]);
                if (!r.length) return falhar('Destinatário indisponível.');
                if (socket.data.userType === 'DOADOR' && r[0].user_type === 'DOADOR') {
                    return falhar('Doadores não podem trocar mensagens diretamente entre si.');
                }

                const content = String(data.content || '').trim();
                const mediaType = TIPOS.includes(data.mediaType) ? data.mediaType : 'text';
                let mediaUrl = data.mediaUrl && /^https:\/\//i.test(data.mediaUrl) ? data.mediaUrl : null;

                let sharedPostId = null, sharedProfileType = null, sharedProfileId = null, momentId = null;

                if (mediaType === 'post_share') {
                    const [p] = await pool.query('SELECT id FROM POSTS WHERE id = ?', [Number(data.sharedPostId)]);
                    if (!p.length) return falhar('Publicação não encontrada.');
                    sharedPostId = p[0].id;
                } else if (mediaType === 'profile_share') {
                    const tipo = data.sharedProfileType === 'DOADOR' ? 'DOADOR' : 'ONG';
                    if (tipo === 'ONG') {
                        const [o] = await pool.query('SELECT id FROM ONGS_PROFILES WHERE id = ?', [Number(data.sharedProfileId)]);
                        if (!o.length) return falhar('Perfil não encontrado.');
                        sharedProfileId = o[0].id;
                    } else {
                        const [d] = await pool.query('SELECT user_id FROM DOADORES_PROFILES WHERE user_id = ?', [Number(data.sharedProfileId)]);
                        if (!d.length) return falhar('Perfil não encontrado.');
                        sharedProfileId = d[0].user_id;
                    }
                    sharedProfileType = tipo;
                } else if (TIPOS_MOMENTO.includes(mediaType)) {
                    momentId = momento.id;
                    mediaUrl = momento.media_url; // vem do servidor, nunca do cliente
                    if (mediaType === 'moment_reply' && !content) return falhar('Escreva uma resposta.');
                }

                if (content.length > 2000) return falhar('A mensagem excede o limite de 2000 caracteres.');
                if (!content && !mediaUrl && !sharedPostId && !sharedProfileId && !momentId) return falhar('Mensagem vazia.');
                if (['image', 'audio', 'video', 'file'].includes(mediaType) && !mediaUrl) return falhar('Arquivo não encontrado.');

                const m = await ChatModel.saveMessage({
                    conversationId: conv.id,
                    senderId: userId,
                    content,
                    mediaUrl,
                    mediaType,
                    mediaName: data.mediaName ? String(data.mediaName).slice(0, 255) : null,
                    mediaSize: Number(data.mediaSize) || null,
                    audioSeconds: mediaType === 'audio' ? Math.min(60, Number(data.audioSeconds) || 1) : null,
                    sharedPostId,
                    sharedProfileType,
                    sharedProfileId,
                    momentId,
                });

                const payload = {
                    id: m.id,
                    clientId: data.clientId,
                    conversationId: conv.id,
                    senderId: userId,
                    receiverId,
                    content: m.content,
                    mediaUrl: m.media_url,
                    mediaType: m.media_type,
                    audioSeconds: m.audio_duration_seconds,
                    mediaName: m.media_name,
                    mediaSize: m.media_size,
                    sharedPostId: m.shared_post_id,
                    sharedProfileType: m.shared_profile_type,
                    sharedProfileId: m.shared_profile_id,
                    momentId: m.moment_id,
                    moment: m.moment,
                    isRead: false,
                    createdAt: m.created_at,
                };

                // um único emit para a união das salas: cada socket recebe uma vez só
                io.to(`room_${conv.id}`).to(`user_${userId}`).to(`user_${receiverId}`).emit('receive_message', payload);
                responder({ message: payload });
            } catch (e) {
                console.error('Erro no socket de chat:', e);
                falhar('Erro ao processar mensagem.');
            }
        });

        // Sinalização WebRTC (voz/vídeo): o "from" agora vem do token
        socket.on('call_user', (d) => {
            socket.to(`user_${d.toUserId}`).emit('incoming_call', { signal: d.offer, from: userId, callerName: d.callerName });
        });
        socket.on('answer_call', (d) => socket.to(`user_${d.toUserId}`).emit('call_accepted', d.answer));
        socket.on('ice_candidate', (d) => socket.to(`user_${d.toUserId}`).emit('ice_candidate', d.candidate));
    });
}