import { pool } from '../config/conexao.js';
import { ChatModel } from '../models/chatModel.js';

export default function setupChatSocket(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Conectado ao Chat Socket: ${socket.id}`);

        socket.on('join_room', ({ conversationId }) => {
            socket.join(`room_${conversationId}`);
        });

        socket.on('register_user', (userId) => {
            socket.join(`user_${userId}`);
        });

        // Envio de mensagem com sincronização em tempo real
        socket.on('send_message', async (data) => {
            try {
                const { conversationId, senderId, receiverId, content, mediaUrl, mediaType } = data;

                // 1. Regra de ouro: Doador x Doador é bloqueado
                const [users] = await pool.query(
                    'SELECT id, user_type FROM USERS WHERE id IN (?, ?)',
                    [senderId, receiverId]
                );

                if (users.length === 2) {
                    const sender = users.find(u => u.id === Number(senderId));
                    const receiver = users.find(u => u.id === Number(receiverId));

                    if (sender && receiver && sender.user_type === 'DOADOR' && receiver.user_type === 'DOADOR') {
                        return socket.emit('chat_error', { message: 'Doadores não podem trocar mensagens diretamente entre si.' });
                    }
                }

                // 2. Limite máximo de 2000 caracteres
                if (content && content.length > 2000) {
                    return socket.emit('chat_error', { message: 'A mensagem excede o limite de 2000 caracteres.' });
                }

                // 3. Salvar criptografado no banco
                const messageId = await ChatModel.saveMessage(conversationId, senderId, content, mediaUrl, mediaType);

                const payload = {
                    id: messageId,
                    conversationId,
                    senderId,
                    content: content || '',
                    mediaUrl: mediaUrl || null,
                    mediaType: mediaType || 'text',
                    createdAt: new Date()
                };

                // 4. Dispara simultaneamente para ambos na sala
                io.to(`room_${conversationId}`).emit('receive_message', payload);

            } catch (error) {
                console.error('Erro no socket de chat:', error);
                socket.emit('chat_error', { message: 'Erro ao processar mensagem.' });
            }
        });

        // Sinalização WebRTC para Chamadas de Voz e Vídeo
        socket.on('call_user', (data) => {
            socket.to(`user_${data.toUserId}`).emit('incoming_call', {
                signal: data.offer,
                from: data.fromUserId,
                callerName: data.callerName
            });
        });

        socket.on('answer_call', (data) => {
            socket.to(`user_${data.toUserId}`).emit('call_accepted', data.answer);
        });

        socket.on('ice_candidate', (data) => {
            socket.to(`user_${data.toUserId}`).emit('ice_candidate', data.candidate);
        });

        socket.on('disconnect', () => {
            console.log(`❌ Desconectado do chat: ${socket.id}`);
        });
    });
}