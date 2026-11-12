import { pool } from '../config/conexao.js';
import { encryptText, decryptText } from '../utils/cryptoUtils.js';

export const ChatModel = {
    async getOrCreateConversation(userOneId, userTwoId) {
        const [u1, u2] = userOneId < userTwoId ? [userOneId, userTwoId] : [userTwoId, userOneId];
        
        const [existing] = await pool.query(
            'SELECT * FROM CHAT_CONVERSATIONS WHERE user_one_id = ? AND user_two_id = ?',
            [u1, u2]
        );
        if (existing.length > 0) return existing[0].id;

        const [result] = await pool.query(
            'INSERT INTO CHAT_CONVERSATIONS (user_one_id, user_two_id) VALUES (?, ?)',
            [u1, u2]
        );
        return result.insertId;
    },

    async saveMessage(conversationId, senderId, content, mediaUrl, mediaType) {
        const contentEncrypted = encryptText(content);
        const [result] = await pool.query(
            `INSERT INTO CHAT_MESSAGES (conversation_id, sender_id, content_encrypted, media_url, media_type)
             VALUES (?, ?, ?, ?, ?)`,
            [conversationId, senderId, contentEncrypted, mediaUrl || null, mediaType || 'text']
        );
        return result.insertId;
    },

    async getMessages(conversationId) {
        const [rows] = await pool.query(
            `SELECT * FROM CHAT_MESSAGES WHERE conversation_id = ? ORDER BY created_at ASC`,
            [conversationId]
        );
        return rows.map(msg => ({
            ...msg,
            content: decryptText(msg.content_encrypted),
            content_encrypted: undefined
        }));
    }
};