import { pool } from '../config/conexao.js';

export const CommentReportModel = {
    async criar(commentId, userId, reason) {
        const [c] = await pool.query(
            'SELECT id, user_id FROM POST_COMMENT WHERE id = ? AND is_active = TRUE',
            [commentId]
        );
        if (!c.length) return { notFound: true };
        if (Number(c[0].user_id) === Number(userId)) return { proprio: true };

        try {
            const [r] = await pool.query(
                'INSERT INTO COMMENT_REPORTS (comment_id, user_id, reason) VALUES (?, ?, ?)',
                [commentId, userId, reason]
            );
            return { id: r.insertId };
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') return { duplicada: true };
            throw e;
        }
    }
};