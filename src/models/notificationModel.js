import { pool } from '../config/conexao.js';

export const NotificationModel = {
    async listar(userId, limite = 50) {
        const [rows] = await pool.query(
            `SELECT n.id, n.type, n.ong_id, n.post_id, n.actor_user_id, n.conversation_id, n.is_read, n.created_at,
                    o.nome_fantasia AS ong_nome, o.logo_url AS ong_logo,
                    p.type AS post_type,
                    ao.nome_fantasia AS actor_ong_nome, ao.logo_url AS actor_ong_avatar,
                    ad.nome AS actor_doador_nome, ad.sobrenome AS actor_doador_sobrenome, ad.avatar_url AS actor_doador_avatar
             FROM NOTIFICATIONS n
             LEFT JOIN ONGS_PROFILES o ON o.id = n.ong_id
             LEFT JOIN POSTS p ON p.id = n.post_id
             LEFT JOIN ONGS_PROFILES ao ON ao.user_id = n.actor_user_id
             LEFT JOIN DOADORES_PROFILES ad ON ad.user_id = n.actor_user_id
             WHERE n.user_id = ?
             ORDER BY n.created_at DESC, n.id DESC
             LIMIT ?`,
            [userId, limite]
        );
        return rows.map((r) => ({
            ...r,
            actor_nome: r.actor_ong_nome || (r.actor_doador_nome ? `${r.actor_doador_nome} ${r.actor_doador_sobrenome || ''}`.trim() : null) || r.ong_nome,
            actor_avatar: r.actor_ong_avatar || r.actor_doador_avatar || r.ong_logo,
        }));
    },

    async criar({ userId, type, ongId = null, postId = null, actorUserId = null, conversationId = null }) {
        const [r] = await pool.query(
            `INSERT INTO NOTIFICATIONS (user_id, type, ong_id, post_id, actor_user_id, conversation_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, type, ongId, postId, actorUserId, conversationId]
        );
        return r.insertId;
    },

    async marcarTodasLidas(userId) {
        const [r] = await pool.query(
            'UPDATE NOTIFICATIONS SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        return r.affectedRows;
    }
};