import { pool } from '../config/conexao.js';

class PostModel {
    // Criar publicação (Orgânica, Campanha ou Voluntariado)
    static async createPost(ongId, postData, mediaList = [], campaignData = null, volunteerData = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const { type, caption, is_boosted, boosted_until } = postData;

            // 1. Inserir na tabela POSTS
            const [postResult] = await connection.query(
                `INSERT INTO POSTS (ong_id, type, caption, is_boosted, boosted_until) VALUES (?, ?, ?, ?, ?)`,
                [ongId, type, caption || null, is_boosted || false, boosted_until || null]
            );
            const postId = postResult.insertId;

            // 2. Inserir mídias se houver (até 10 fotos/vídeos)
            if (mediaList && mediaList.length > 0) {
                for (const media of mediaList) {
                    await connection.query(
                        `INSERT INTO POST_MEDIA (post_id, file_url, media_type) VALUES (?, ?, ?)`,
                        [postId, media.file_url, media.media_type] // media_type: 'IMAGE' ou 'VIDEO'
                    );
                }
            }

            // 3. Se for Campanha, inserir em CAMPAIGN_DETAILS
            if (type === 'CAMPANHA' && campaignData) {
                await connection.query(
                    `INSERT INTO CAMPAIGN_DETAILS (post_id, meta_valor, data_limite) VALUES (?, ?, ?)`,
                    [postId, campaignData.meta_valor, campaignData.data_limite]
                );
            }

            // 4. Se for Voluntariado com vaga própria, inserir em VOLUNTEER_DETAILS
            if (type === 'VOLUNTARIADO' && volunteerData) {
                await connection.query(
                    `INSERT INTO VOLUNTEER_DETAILS (post_id, google_forms_url, vagas_disponiveis, data_limite_inscricao) VALUES (?, ?, ?, ?)`,
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

    // Listar feed geral de postagens
    static async listarFeed() {
        const [posts] = await pool.query(`
            SELECT 
                p.*, 
                o.nome_fantasia AS ong_nome, 
                o.logo_url AS ong_logo,
                o.cnpj AS ong_cnpj,
                c.meta_valor, c.valor_atual, c.data_limite, c.status AS campanha_status
            FROM POSTS p
            JOIN ONGS_PROFILES o ON p.ong_id = o.id
            LEFT JOIN CAMPAIGN_DETAILS c ON p.id = c.post_id
            WHERE p.is_active = TRUE
            ORDER BY p.created_at DESC
        `);

        // Buscar mídias e detalhes para cada post
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
}

export default PostModel;