import { pool } from '../config/conexao.js';
import { encryptText, decryptText } from '../utils/cryptoUtils.js';

/* consulta base das mensagens: já traz os dados do momento (miniatura, ONG e se expirou) */
const SELECT_MSG = `
    SELECT m.*,
           mo.caption AS moment_caption,
           (mo.id IS NULL OR mo.is_active = FALSE OR mo.expires_at <= NOW()) AS moment_expired,
           op.nome_fantasia AS moment_ong_nome,
           op.logo_url AS moment_ong_logo
    FROM CHAT_MESSAGES m
    LEFT JOIN MOMENTS mo ON mo.id = m.moment_id
    LEFT JOIN ONGS_PROFILES op ON op.id = mo.ong_id`;

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
    shared_post_id: m.shared_post_id ?? null,
    shared_profile_type: m.shared_profile_type ?? null,
    shared_profile_id: m.shared_profile_id ?? null,
    moment_id: m.moment_id ?? null,
    moment: (m.media_type === 'moment_reply' || m.media_type === 'moment_share') ? {
        id: m.moment_id ?? null,
        mediaUrl: m.media_url,          // cópia gravada na mensagem: continua existindo se o momento sumir
        caption: m.moment_caption ?? null,
        ongNome: m.moment_ong_nome ?? null,
        ongLogo: m.moment_ong_logo ?? null,
        expired: !!Number(m.moment_expired ?? 1),
    } : null,
    is_read: !!m.is_read,
    created_at: m.created_at,
});

export const ChatModel = {
    /* cria a conversa (status PENDENTE, até o outro lado aceitar) ou devolve a que já existe.
       retorna { id, status, requestedBy, isNew } */
    async getOrCreateConversation(a, b) {
        const [u1, u2] = Number(a) < Number(b) ? [Number(a), Number(b)] : [Number(b), Number(a)];
        const [existing] = await pool.query(
            'SELECT id, status, requested_by FROM CHAT_CONVERSATIONS WHERE user_one_id = ? AND user_two_id = ?', [u1, u2]);
        if (existing.length) {
            return { id: existing[0].id, status: existing[0].status, requestedBy: existing[0].requested_by, isNew: false };
        }
        const [r] = await pool.query(
            'INSERT INTO CHAT_CONVERSATIONS (user_one_id, user_two_id, status, requested_by) VALUES (?, ?, ?, ?)',
            [u1, u2, 'PENDENTE', Number(a)]);
        return { id: r.insertId, status: 'PENDENTE', requestedBy: Number(a), isNew: true };
    },

    /* aceita o pedido de conversa: só quem RECEBEU o pedido (não é o requested_by) pode aceitar */
    async aceitarConversa(conversationId, userId) {
        const [r] = await pool.query(
            `SELECT id, user_one_id, user_two_id, status, requested_by FROM CHAT_CONVERSATIONS WHERE id = ?`,
            [Number(conversationId)]);
        const conv = r[0];
        if (!conv) throw new Error('Conversa não encontrada.');
        const souParticipante = conv.user_one_id === Number(userId) || conv.user_two_id === Number(userId);
        if (!souParticipante) throw new Error('Você não participa desta conversa.');
        if (conv.status === 'ACEITA') return conv;
        if (conv.requested_by === Number(userId)) throw new Error('Aguarde a outra pessoa aceitar a conversa.');
        await pool.query(`UPDATE CHAT_CONVERSATIONS SET status = 'ACEITA' WHERE id = ?`, [conv.id]);
        return { ...conv, status: 'ACEITA' };
    },

    /* devolve a conversa se o usuário participa dela, senão null */
    async participa(conversationId, userId) {
        const [r] = await pool.query(
            `SELECT id, user_one_id, user_two_id FROM CHAT_CONVERSATIONS
             WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)`,
            [Number(conversationId), Number(userId), Number(userId)]);
        return r[0] || null;
    },

    async saveMessage({
        conversationId, senderId, content, mediaUrl, mediaType, mediaName, mediaSize, audioSeconds,
        sharedPostId, sharedProfileType, sharedProfileId, momentId,
    }) {
        const [r] = await pool.query(
            `INSERT INTO CHAT_MESSAGES
               (conversation_id, sender_id, content_encrypted, media_url, media_type, media_name, media_size,
                audio_duration_seconds, shared_post_id, shared_profile_type, shared_profile_id, moment_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [conversationId, senderId, encryptText(content), mediaUrl || null, mediaType || 'text',
             mediaName || null, mediaSize || null, audioSeconds || null,
             sharedPostId || null, sharedProfileType || null, sharedProfileId || null, momentId || null]);
        await pool.query('UPDATE CHAT_CONVERSATIONS SET updated_at = NOW() WHERE id = ?', [conversationId]);
        const [m] = await pool.query(`${SELECT_MSG} WHERE m.id = ?`, [r.insertId]);
        return paraMensagem(m[0]);
    },

    async getMessages(conversationId) {
        const [rows] = await pool.query(
            `${SELECT_MSG} WHERE m.conversation_id = ? ORDER BY m.created_at ASC, m.id ASC`, [conversationId]);
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
            `SELECT c.id AS conversation_id, c.status, c.requested_by,
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
                const [m] = await pool.query(`${SELECT_MSG} WHERE m.id = ?`, [r.last_id]);
                ultima = m[0] ? paraMensagem(m[0]) : null;
            }
            lista.push({
                conversationId: r.conversation_id,
                peer: { id: r.peer_id, nome: r.peer_nome, tipo: r.peer_tipo, avatar: r.peer_avatar },
                ultima,
                unread: Number(r.unread),
                status: r.status, // 'PENDENTE' | 'ACEITA'
                requestedByMe: Number(r.requested_by) === Number(userId),
            });
        }
        return lista;
    },
};