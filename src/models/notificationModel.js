import { pool } from '../config/conexao.js';

export const NotificationModel = {
    async listar(userId, limite = 50) {
        const [rows] = await pool.query(
            `SELECT n.id, n.type, n.ong_id, n.post_id, n.is_read, n.created_at,
                    o.nome_fantasia AS ong_nome, o.logo_url AS ong_logo,
                    p.type AS post_type
             FROM NOTIFICATIONS n
             JOIN ONGS_PROFILES o ON o.id = n.ong_id
             LEFT JOIN POSTS p ON p.id = n.post_id
             WHERE n.user_id = ?
             ORDER BY n.created_at DESC, n.id DESC
             LIMIT ?`,
            [userId, limite]
        );
        return rows;
    },

    async marcarTodasLidas(userId) {
        const [r] = await pool.query(
            'UPDATE NOTIFICATIONS SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        return r.affectedRows;
    }
};