import { pool } from '../config/conexao.js';
import { encryptText, decryptText } from '../utils/cryptoUtils.js';

const paraMensagem = (m) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    content: decryptText(m.content_encrypted) ?? '',
    media_url: m.media_url,
    media_type: m.media_type,
    media_name: m.media_name,
    media_size: m.media_size,
    audio_duration_seconds: m.audio_duration_seconds,
    is_read: !!m.is_read,
    created_at: m.created_at,
});

export const ChatModel = {
    async getOrCreateConversation(a, b) {
        const [u1, u2] = Number(a) < Number(b) ? [Number(a), Number(b)] : [Number(b), Number(a)];
        const [existing] = await pool.query(
            'SELECT id FROM CHAT_CONVERSATIONS WHERE user_one_id = ? AND user_two_id = ?', [u1, u2]);
        if (existing.length) return existing[0].id;
        const [r] = await pool.query(
            'INSERT INTO CHAT_CONVERSATIONS (user_one_id, user_two_id) VALUES (?, ?)', [u1, u2]);
        return r.insertId;
    },

    /* devolve a conversa se o usuário participa dela, senão null */
    async participa(conversationId, userId) {
        const [r] = await pool.query(
            `SELECT id, user_one_id, user_two_id FROM CHAT_CONVERSATIONS
             WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)`,
            [Number(conversationId), Number(userId), Number(userId)]);
        return r[0] || null;
    },

    async saveMessage({ conversationId, senderId, content, mediaUrl, mediaType, mediaName, mediaSize, audioSeconds }) {
        const [r] = await pool.query(
            `INSERT INTO CHAT_MESSAGES
               (conversation_id, sender_id, content_encrypted, media_url, media_type, media_name, media_size, audio_duration_seconds)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [conversationId, senderId, encryptText(content), mediaUrl || null, mediaType || 'text',
             mediaName || null, mediaSize || null, audioSeconds || null]);
        await pool.query('UPDATE CHAT_CONVERSATIONS SET updated_at = NOW() WHERE id = ?', [conversationId]);
        const [m] = await pool.query('SELECT * FROM CHAT_MESSAGES WHERE id = ?', [r.insertId]);
        return paraMensagem(m[0]);
    },

    async getMessages(conversationId) {
        const [rows] = await pool.query(
            'SELECT * FROM CHAT_MESSAGES WHERE conversation_id = ? ORDER BY created_at ASC, id ASC', [conversationId]);
        return rows.map(paraMensagem);
    },

    async marcarLidas(conversationId, userId) {
        const [r] = await pool.query(
            `UPDATE CHAT_MESSAGES SET is_read = TRUE
             WHERE conversation_id = ? AND sender_id <> ? AND is_read = FALSE`,
            [conversationId, userId]);
        return r.affectedRows;
    },

    async listarConversas(userId) {
        const [rows] = await pool.query(
            `SELECT c.id AS conversation_id,
                    u.id AS peer_id, u.user_type AS peer_tipo,
                    COALESCE(op.nome_fantasia, CONCAT(dp.nome, ' ', dp.sobrenome), 'Usuário Civvo') AS peer_nome,
                    COALESCE(op.logo_url, dp.avatar_url) AS peer_avatar,
                    (SELECT COUNT(*) FROM CHAT_MESSAGES m
                      WHERE m.conversation_id = c.id AND m.sender_id <> ? AND m.is_read = FALSE) AS unread,
                    (SELECT m.id FROM CHAT_MESSAGES m
                      WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_id
             FROM CHAT_CONVERSATIONS c
             JOIN USERS u ON u.id = IF(c.user_one_id = ?, c.user_two_id, c.user_one_id)
             LEFT JOIN ONGS_PROFILES op ON op.user_id = u.id
             LEFT JOIN DOADORES_PROFILES dp ON dp.user_id = u.id
             WHERE c.user_one_id = ? OR c.user_two_id = ?
             ORDER BY c.updated_at DESC`,
            [userId, userId, userId, userId]);

        const lista = [];
        for (const r of rows) {
            let ultima = null;
            if (r.last_id) {
                const [m] = await pool.query('SELECT * FROM CHAT_MESSAGES WHERE id = ?', [r.last_id]);
                ultima = m[0] ? paraMensagem(m[0]) : null;
            }
            lista.push({
                conversationId: r.conversation_id,
                peer: { id: r.peer_id, nome: r.peer_nome, tipo: r.peer_tipo, avatar: r.peer_avatar },
                ultima,
                unread: Number(r.unread),
            });
        }
        return lista;
    },
};
