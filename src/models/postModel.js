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

            // Notifica quem segue a ONG (doadores e outras ONGs): uma linha por seguidor.
            await connection.query(
                `INSERT INTO NOTIFICATIONS (user_id, type, ong_id, post_id)
                 SELECT f.follower_id, 'NOVO_POST', o.id, ?
                 FROM ONGS_PROFILES o
                 JOIN USER_FOLLOWERS f ON f.following_id = o.user_id
                 WHERE o.id = ?`,
                [postId, ongId]
            );

            await connection.commit();
            return postId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async listarFeed(userIdAtual = null) {
        const [posts] = await pool.query(`
            SELECT 
                p.id,
                p.id AS post_id,
                p.ong_id,
                p.type,
                p.caption,
                p.is_edited,
                p.created_at,
                o.nome_fantasia AS ong_nome,
                o.logo_url AS ong_avatar,
                (SELECT COUNT(*) FROM USER_FOLLOWERS uf WHERE uf.following_id = o.user_id) AS ong_seguidores,
                (SELECT COUNT(*) FROM POST_LIKE pl WHERE pl.post_id = p.id) AS total_likes,
                (SELECT COUNT(*) FROM POST_COMMENT pc WHERE pc.post_id = p.id AND pc.is_active = TRUE) AS total_comments
            FROM POSTS p
            JOIN ONGS_PROFILES o ON p.ong_id = o.id
            WHERE p.is_active = TRUE
            ORDER BY p.created_at DESC
        `);

        for (let post of posts) {
            const [media] = await pool.query(`
                SELECT file_url, media_type 
                FROM POST_MEDIA 
                WHERE post_id = ? AND is_active = TRUE
            `, [post.id]);
            
            post.media = media;
            post.media_url = media.length > 0 ? media[0].file_url : null;
            post.media_type = media.length > 0 ? media[0].media_type : null;

            let likedByMe = false;
            if (userIdAtual) {
                const [likeCheck] = await pool.query(`
                    SELECT 1 FROM POST_LIKE WHERE post_id = ? AND user_id = ?
                `, [post.id, userIdAtual]);
                likedByMe = likeCheck.length > 0;
            }
            post.liked = likedByMe;

            const [comments] = await pool.query(`
                SELECT 
                    c.id,
                    c.post_id,
                    c.user_id,
                    c.parent_comment_id,
                    c.content,
                    c.is_edited,
                    c.created_at,
                    COALESCE(d.nome, o.nome_fantasia, 'Usuário Civvo') AS autor_nome,
                    COALESCE(d.avatar_url, o.logo_url) AS autor_avatar
                FROM POST_COMMENT c
                JOIN USERS u ON c.user_id = u.id
                LEFT JOIN DOADORES_PROFILES d ON u.id = d.user_id
                LEFT JOIN ONGS_PROFILES o ON u.id = o.user_id
                WHERE c.post_id = ? AND c.is_active = TRUE
                ORDER BY c.created_at ASC
            `, [post.id]);
            
            post.comentarios = comments;
            post.comments = comments.length;
            post.total_comments = comments.length;
        }

        return posts;
    }

    static async addComment(postId, userId, content, parentCommentId = null) {
        const [result] = await pool.query(
            `INSERT INTO POST_COMMENT (post_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?)`,
            [postId, userId, content, parentCommentId || null]
        );
        
        const [newComment] = await pool.query(`
            SELECT 
                c.id,
                c.post_id,
                c.user_id,
                c.parent_comment_id,
                c.content,
                c.is_edited,
                c.created_at,
                COALESCE(d.nome, o.nome_fantasia, 'Usuário Civvo') AS autor_nome,
                COALESCE(d.avatar_url, o.logo_url) AS autor_avatar
            FROM POST_COMMENT c
            JOIN USERS u ON c.user_id = u.id
            LEFT JOIN DOADORES_PROFILES d ON u.id = d.user_id
            LEFT JOIN ONGS_PROFILES o ON u.id = o.user_id
            WHERE c.id = ?
        `, [result.insertId]);

        return newComment[0];
    }

    // Editar comentário: só quem escreveu pode editar o próprio comentário.
    static async editComment(postId, commentId, userId, content) {
        const [result] = await pool.query(
            `UPDATE POST_COMMENT 
             SET content = ?, is_edited = TRUE, updated_at = NOW() 
             WHERE id = ? AND post_id = ? AND user_id = ? AND is_active = TRUE`,
            [content, commentId, postId, userId]
        );

        if (result.affectedRows === 0) {
            throw new Error("Comentário não encontrado ou sem permissão para editar.");
        }
        return true;
    }

    // Excluir comentário (soft delete, mesmo padrão de is_active usado no resto do app):
    // - quem escreveu o comentário pode excluir o próprio, OU
    // - a ONG dona da publicação pode excluir qualquer comentário nela (moderação), mas não editar.
    static async deleteComment(postId, commentId, userId, ongId, userType) {
        if (userType === 'ADMIN') {
            const [result] = await pool.query(
                `UPDATE POST_COMMENT SET is_active = FALSE WHERE id = ? AND post_id = ?`,
                [commentId, postId]
            );
            if (result.affectedRows === 0) throw new Error("Comentário não encontrado.");
            return true;
        }

        const [dono] = await pool.query(
            `UPDATE POST_COMMENT SET is_active = FALSE WHERE id = ? AND post_id = ? AND user_id = ?`,
            [commentId, postId, userId]
        );
        if (dono.affectedRows > 0) return true;

        const [moderacao] = await pool.query(
            `UPDATE POST_COMMENT c
             JOIN POSTS p ON c.post_id = p.id
             SET c.is_active = FALSE
             WHERE c.id = ? AND c.post_id = ? AND p.ong_id = ?`,
            [commentId, postId, ongId]
        );

        if (moderacao.affectedRows === 0) {
            throw new Error("Comentário não encontrado ou sem permissão para excluir.");
        }
        return true;
    }

    static async toggleLike(postId, userId) {
        const [existing] = await pool.query(
            `SELECT * FROM POST_LIKE WHERE post_id = ? AND user_id = ?`,
            [postId, userId]
        );

        if (existing.length > 0) {
            await pool.query(`DELETE FROM POST_LIKE WHERE post_id = ? AND user_id = ?`, [postId, userId]);
        } else {
            await pool.query(`INSERT INTO POST_LIKE (post_id, user_id) VALUES (?, ?)`, [postId, userId]);
        }

        const [countResult] = await pool.query(
            `SELECT COUNT(*) AS total FROM POST_LIKE WHERE post_id = ?`,
            [postId]
        );

        return { 
            liked: existing.length === 0, 
            total_likes: countResult[0].total 
        };
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
        let query = `UPDATE POSTS SET caption = ?, is_edited = TRUE WHERE id = ?`;
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

    static async deletePost(postId, ongId, userType) {
        // ADMIN pode excluir qualquer publicação.
        if (userType === 'ADMIN') {
            const [result] = await pool.query(`DELETE FROM POSTS WHERE id = ?`, [postId]);
            return result.affectedRows > 0;
        }

        // ONG só pode excluir a própria publicação (mesma convenção usada em updatePost).
        const [result] = await pool.query(
            `DELETE FROM POSTS WHERE id = ? AND ong_id = ?`,
            [postId, ongId]
        );

        if (result.affectedRows === 0) {
            throw new Error("Publicação não encontrada ou sem permissão para excluir.");
        }

        return true;
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