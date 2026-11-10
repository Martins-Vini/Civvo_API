import { pool } from '../config/conexao.js';

class PostModel {
    static async createPost(ongId, postData, mediaList = [], campaignData = null, volunteerData = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const { type, caption, is_boosted, boosted_until } = postData;

            const [postResult] = await connection.query(
                `INSERT INTO POSTS (ong_id, type, caption, is_boosted, boosted_until) VALUES (?, ?, ?, ?, ?)`,
                [ongId, type, caption || null, is_boosted || false, boosted_until || null]
            );
            const postId = postResult.insertId;

            if (mediaList && mediaList.length > 0) {
                for (const media of mediaList) {
                    await connection.query(
                        `INSERT INTO POST_MEDIA (post_id, file_url, media_type) VALUES (?, ?, ?)`,
                        [postId, media.file_url, media.media_type]
                    );
                }
            }

            if (type === 'CAMPANHA' && campaignData) {
                await connection.query(
                    `INSERT INTO CAMPAIGN_DETAILS (post_id, meta_valor, data_limite) VALUES (?, ?, ?)`,
                    [postId, campaignData.meta_valor, campaignData.data_limite]
                );
            }

            if (type === 'VOLUNTARIADO' && volunteerData) {
                await connection.query(
                    `INSERT INTO VOLUNTARIADO_DETAILS (post_id, google_forms_url, vagas_disponiveis, data_limite_inscricao) VALUES (?, ?, ?, ?)`,
                    [postId, volunteerData.google_forms_url || null, volunteerData.vagas_disponiveis || null, volunteerData.data_limite_inscricao]
                );
            }

            await connection.commit();
            return postId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async listarFeed() {
        const [posts] = await pool.query(`
            SELECT 
                p.*, 
                o.nome_fantasia AS ong_nome, 
                o.logo_url AS ong_logo,
                o.cnpj AS ong_cnpj,
                c.meta_valor, c.valor_atual, c.data_limite, c.status AS campanha_status,
                v.vagas_disponiveis, v.data_limite_inscricao
            FROM POSTS p
            JOIN ONGS_PROFILES o ON p.ong_id = o.id
            LEFT JOIN CAMPAIGN_DETAILS c ON p.id = c.post_id
            LEFT JOIN VOLUNTARIADO_DETAILS v ON p.id = v.post_id
            WHERE p.is_active = TRUE
            ORDER BY p.created_at DESC
        `);

        for (let post of posts) {
            const [media] = await pool.query(`SELECT file_url, media_type FROM POST_MEDIA WHERE post_id = ?`, [post.id]);
            post.media = media;
        }

        return posts;
    }

    static async addComment(postId, userId, content, parentCommentId = null) {
        const [result] = await pool.query(
            `INSERT INTO POST_COMMENT (post_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?)`,
            [postId, userId, content, parentCommentId || null]
        );
        return result.insertId;
    }

    static async toggleLike(postId, userId) {
        const [existing] = await pool.query(
            `SELECT * FROM POST_LIKE WHERE post_id = ? AND user_id = ?`,
            [postId, userId]
        );

        if (existing.length > 0) {
            await pool.query(`DELETE FROM POST_LIKE WHERE post_id = ? AND user_id = ?`, [postId, userId]);
            return { liked: false };
        } else {
            await pool.query(`INSERT INTO POST_LIKE (post_id, user_id) VALUES (?, ?)`, [postId, userId]);
            return { liked: true };
        }
    }

    static async sharePost(postId, userId) {
        const [result] = await pool.query(
            `INSERT INTO POST_SHARES (post_id, user_id) VALUES (?, ?)`,
            [postId, userId]
        );
        return result.insertId;
    }

    static async reportPost(postId, userId, reason) {
        if (!reason || reason.length > 225) {
            throw new Error("O motivo da denúncia deve ter no máximo 225 caracteres.");
        }
        const [result] = await pool.query(
            `INSERT INTO POST_REPORTS (post_id, user_id, reason) VALUES (?, ?, ?)`,
            [postId, userId, reason]
        );
        return result.insertId;
    }

    static async updatePost(postId, ongId, userType, caption) {
        let query = `UPDATE POSTS SET caption = ? WHERE id = ?`;
        let params = [caption, postId];

        if (userType !== 'ADMIN') {
            query += ` AND ong_id = ?`;
            params.push(ongId);
        }

        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) {
            throw new Error("Publicação não encontrada ou sem permissão para editar.");
        }
        return true;
    }

    static async deletePost(postId, user) {
    const connection = await pool.getConnection();
    try {
        // Se for ADMIN, pode apagar qualquer post diretamente
        if (user.userType === 'ADMIN' || user.role_level) {
            const [result] = await connection.query(`DELETE FROM POSTS WHERE id = ?`, [postId]);
            return result.affectedRows > 0;
        }

        // Se for ONG, valida se o post pertence à ONG dela
        const [posts] = await connection.query(
            `SELECT p.id FROM POSTS p 
             JOIN ONGS_PROFILES o ON p.ong_id = o.id 
             WHERE p.id = ? AND o.user_id = ?`,
            [postId, user.userId]
        );

        if (posts.length === 0) {
            return false; // Não encontrado ou sem permissão
        }

        const [result] = await connection.query(`DELETE FROM POSTS WHERE id = ?`, [postId]);
        return result.affectedRows > 0;
    } finally {
        connection.release();
    }
}

    static async applyVolunteer(postId, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [volunteer] = await connection.query(
                `SELECT vagas_disponiveis FROM VOLUNTARIADO_DETAILS WHERE post_id = ?`,
                [postId]
            );

            if (volunteer.length === 0) {
                throw new Error("Vaga de voluntariado não encontrada.");
            }

            const vagasTotais = volunteer[0].vagas_disponiveis;

            if (vagasTotais !== null) {
                const [applications] = await connection.query(
                    `SELECT COUNT(*) AS total FROM VOLUNTEER_APPLICATIONS WHERE post_id = ?`,
                    [postId]
                );

                if (applications[0].total >= vagasTotais) {
                    throw new Error("Esta vaga de voluntariado está cheia.");
                }
            }

            const [existing] = await connection.query(
                `SELECT id FROM VOLUNTEER_APPLICATIONS WHERE post_id = ? AND user_id = ?`,
                [postId, userId]
            );

            if (existing.length > 0) {
                throw new Error("Você já se candidatou a esta vaga.");
            }

            const [result] = await connection.query(
                `INSERT INTO VOLUNTEER_APPLICATIONS (post_id, user_id) VALUES (?, ?)`,
                [postId, userId]
            );

            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getLikedPostsByUser(userId) {
        const [posts] = await pool.query(`
            SELECT p.*, o.nome_fantasia AS ong_nome, o.logo_url AS ong_logo
            FROM POST_LIKE pl
            JOIN POSTS p ON pl.post_id = p.id
            JOIN ONGS_PROFILES o ON p.ong_id = o.id
            WHERE pl.user_id = ? AND p.is_active = TRUE
            ORDER BY pl.created_at DESC
        `, [userId]);

        for (let post of posts) {
            const [media] = await pool.query(`SELECT file_url, media_type FROM POST_MEDIA WHERE post_id = ?`, [post.id]);
            post.media = media;
        }

        return posts;
    }

    static async getCommentHistoryByUser(userId) {
        const [comments] = await pool.query(`
            SELECT c.*, p.caption AS post_caption
            FROM POST_COMMENT c
            JOIN POSTS p ON c.post_id = p.id
            WHERE c.user_id = ? AND c.is_active = TRUE
            ORDER BY c.created_at DESC
        `, [userId]);
        return comments;
    }

    static async getVolunteerHistoryByUser(targetUserId, requestingUserId = null) {
        if (requestingUserId && requestingUserId !== targetUserId) {
            const [privacy] = await pool.query(
                `SELECT voluntariados_publicos FROM DOADORES_PROFILES WHERE user_id = ?`,
                [targetUserId]
            );
            if (privacy.length > 0 && !privacy[0].voluntariados_publicos) {
                return [];
            }
        }

        const [posts] = await pool.query(`
            SELECT p.*, o.nome_fantasia AS ong_nome, o.logo_url AS ong_logo, v.data_limite_inscricao, v.vagas_disponiveis
            FROM VOLUNTEER_APPLICATIONS va
            JOIN POSTS p ON va.post_id = p.id
            JOIN ONGS_PROFILES o ON p.ong_id = o.id
            JOIN VOLUNTARIADO_DETAILS v ON p.id = v.post_id
            WHERE va.user_id = ? AND p.is_active = TRUE
            ORDER BY va.created_at DESC
        `, [targetUserId]);

        for (let post of posts) {
            const [media] = await pool.query(`SELECT file_url, media_type FROM POST_MEDIA WHERE post_id = ?`, [post.id]);
            post.media = media;
        }

        return posts;
    }
}

export default PostModel;