import express from 'express';
import { pool } from '../config/conexao.js';
import {  verificarToken} from '../middlewares/authMiddleware.js'; // ajuste conforme seu middleware

const router = express.Router();

router.post('/conversation', verificarToken, async (req, res) => {
    try {
        const senderId = req.user.id;
        const { receiverId } = req.body;

        // 1. Validar a regra de negócio no backend: Doador x Doador proibido
        const [users] = await pool.query('SELECT id, user_type FROM USERS WHERE id IN (?, ?)', [senderId, receiverId]);
        if (users.length === 2) {
            const u1 = users.find(u => u.id === Number(senderId));
            const u2 = users.find(u => u.id === Number(receiverId));
            if (u1.user_type === 'DOADOR' && u2.user_type === 'DOADOR') {
                return res.status(403).json({ error: 'Doadores não podem iniciar chat diretamente com outros doadores.' });
            }
        }

        // 2. Buscar ou criar a conversa na tabela CHAT_CONVERSATIONS
        const [one, two] = senderId < receiverId ? [senderId, receiverId] : [receiverId, senderId];
        
        let [existing] = await pool.query(
            'SELECT id FROM CHAT_CONVERSATIONS WHERE user_one_id = ? AND user_two_id = ?',
            [one, two]
        );

        let conversationId;
        if (existing.length > 0) {
            conversationId = existing[0].id;
        } else {
            const [result] = await pool.query(
                'INSERT INTO CHAT_CONVERSATIONS (user_one_id, user_two_id) VALUES (?, ?)',
                [one, two]
            );
            conversationId = result.insertId;
        }

        return res.status(200).json({ conversationId });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;