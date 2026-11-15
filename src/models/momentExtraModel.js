import { pool } from '../config/conexao.js';

export const MomentExtraModel = {
    /* perfil de ONG (ONGS_PROFILES.id) do usuário logado */
    async ongIdDoUsuario(userId) {
        const [rows] = await pool.query('SELECT id FROM ONGS_PROFILES WHERE user_id = ?', [userId]);
        return rows.length ? rows[0].id : null;
    },

    /* ids dos momentos ativos que este usuário já viu */
    async listarVistos(userId) {
        const [rows] = await pool.query(
            `SELECT v.moment_id
             FROM MOMENT_VIEWS v
             JOIN MOMENTS m ON m.id = v.moment_id
             WHERE v.user_id = ? AND m.is_active = TRUE AND m.expires_at > NOW()`,
            [userId]
        );
        return rows.map((r) => r.moment_id);
    },

    async marcarVisto(momentId, userId) {
        const [m] = await pool.query(
            'SELECT id FROM MOMENTS WHERE id = ? AND is_active = TRUE AND expires_at > NOW()',
            [momentId]
        );
        if (!m.length) return { notFound: true };

        await pool.query(
            `INSERT INTO MOMENT_VIEWS (moment_id, user_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE viewed_at = viewed_at`,
            [momentId, userId]
        );
        return { ok: true };
    },

    /* exclusão (soft delete) só pela ONG dona do momento */
    async excluir(momentId, ongId) {
        const [r] = await pool.query(
            'UPDATE MOMENTS SET is_active = FALSE WHERE id = ? AND ong_id = ? AND is_active = TRUE',
            [momentId, ongId]
        );
        return r.affectedRows > 0;
    }
};