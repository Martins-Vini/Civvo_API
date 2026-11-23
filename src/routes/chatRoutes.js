import express from 'express';
import { pool } from '../config/conexao.js';
import { verificarToken } from '../middlewares/authMiddleware.js';
import { uploadChat, uploadToCloudinary } from '../middlewares/uploadMiddleware.js';
import { ChatModel } from '../models/chatModel.js';
import { NotificationModel } from '../models/notificationModel.js';

const router = express.Router();
const meuId = (req) => Number(req.user.userId ?? req.user.id);

const MIMES = /^(image|video|audio)\/|^application\/(pdf|msword|vnd\.|octet-stream)|^text\/plain/;

router.post('/conversation', verificarToken, async (req, res) => {
    try {
        const senderId = meuId(req);
        const receiverId = Number(req.body.receiverId);
        if (!receiverId || receiverId === senderId) return res.status(400).json({ error: 'Destinatário inválido.' });

        const [users] = await pool.query(
            'SELECT id, user_type FROM USERS WHERE id IN (?, ?) AND is_active = TRUE', [senderId, receiverId]);
        const u1 = users.find((u) => u.id === senderId);
        const u2 = users.find((u) => u.id === receiverId);
        if (!u1 || !u2) return res.status(404).json({ error: 'Usuário não encontrado.' });
        if (u1.user_type === 'ADMIN' || u2.user_type === 'ADMIN') return res.status(403).json({ error: 'Conversa não permitida.' });
        if (u1.user_type === 'DOADOR' && u2.user_type === 'DOADOR') {
            return res.status(403).json({ error: 'Doadores não podem iniciar chat diretamente com outros doadores.' });
        }

        const conv = await ChatModel.getOrCreateConversation(senderId, receiverId);

        if (conv.isNew && conv.status === 'PENDENTE') {
            // avisa quem recebeu o pedido de conversa (vai pras notificações dela)
            const ongDoReceptor = u2.user_type === 'ONG'
                ? (await pool.query('SELECT id FROM ONGS_PROFILES WHERE user_id = ?', [receiverId]))[0][0]?.id
                : null;
            const ongDoRemetente = u1.user_type === 'ONG'
                ? (await pool.query('SELECT id FROM ONGS_PROFILES WHERE user_id = ?', [senderId]))[0][0]?.id
                : null;
            await NotificationModel.criar({
                userId: receiverId,
                type: 'CHAT_REQUEST',
                ongId: ongDoReceptor || ongDoRemetente || null, // precisa de uma ONG por causa do schema antigo; prioriza a do destinatário
                actorUserId: senderId,
                conversationId: conv.id,
            });
            req.app.get('io')?.to(`user_${receiverId}`).emit('chat_request', { conversationId: conv.id, fromUserId: senderId });
        }

        return res.json({ conversationId: conv.id, status: conv.status, requestedByMe: conv.requestedBy === senderId });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.put('/conversations/:id/aceitar', verificarToken, async (req, res) => {
    try {
        const eu = meuId(req);
        const conv = await ChatModel.aceitarConversa(req.params.id, eu);
        const outro = conv.user_one_id === eu ? conv.user_two_id : conv.user_one_id;
        req.app.get('io')?.to(`user_${outro}`).emit('chat_request_aceita', { conversationId: conv.id });
        return res.json({ ok: true, status: 'ACEITA' });
    } catch (e) {
        return res.status(400).json({ error: e.message });
    }
});

router.get('/conversations', verificarToken, async (req, res) => {
    try {
        return res.json(await ChatModel.listarConversas(meuId(req)));
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.get('/conversations/:id/messages', verificarToken, async (req, res) => {
    try {
        if (!(await ChatModel.participa(req.params.id, meuId(req)))) {
            return res.status(403).json({ error: 'Você não participa desta conversa.' });
        }
        return res.json(await ChatModel.getMessages(Number(req.params.id)));
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.put('/conversations/:id/read', verificarToken, async (req, res) => {
    try {
        const eu = meuId(req);
        const conv = await ChatModel.participa(req.params.id, eu);
        if (!conv) return res.status(403).json({ error: 'Você não participa desta conversa.' });

        const n = await ChatModel.marcarLidas(conv.id, eu);
        if (n > 0) {
            const outro = conv.user_one_id === eu ? conv.user_two_id : conv.user_one_id;
            req.app.get('io')?.to(`user_${outro}`).emit('messages_read', { conversationId: conv.id });
        }
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.post('/upload', verificarToken, uploadChat.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        if (!MIMES.test(req.file.mimetype)) return res.status(400).json({ error: 'Tipo de arquivo não permitido.' });

        const url = await uploadToCloudinary(req.file.buffer, 'auto');
        return res.json({ url, name: req.file.originalname, size: req.file.size });
    } catch (e) {
        return res.status(500).json({ error: 'Não foi possível enviar o arquivo.' });
    }
});

export default router;
