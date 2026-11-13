import PostModel from '../models/postModel.js';
import { pool } from '../config/conexao.js';
import { uploadToCloudinary } from '../middlewares/uploadMiddleware.js';

class PostController {
    // Listar Feed (Traz postagens, mídias na nuvem, curtidas e comentários salvos)
    static async listarFeed(req, res) {
        try {
            const posts = await PostModel.listarFeed();
            return res.status(200).json(posts);
        } catch (error) {
            console.error("Erro ao listar feed:", error);
            return res.status(500).json({ error: "Erro ao carregar o feed." });
        }
    }

    // Curtir ou Descurtir Post (Salva de forma definitiva na tabela POST_LIKE)
    static async curtirPost(req, res) {
        try {
            const { postId } = req.params;
            const userId = req.user?.userId || req.user?.id || req.userId;

            if (!userId) {
                return res.status(401).json({ error: "Usuário não autenticado." });
            }

            const resultado = await PostModel.toggleLike(postId, userId);
            return res.status(200).json(resultado);
        } catch (error) {
            console.error("Erro ao curtir post:", error);
            return res.status(500).json({ error: "Erro ao processar curtida." });
        }
    }

    // Listar Comentários de um Post (Para qualquer visitante ver o que foi comentado)
    static async listarComentariosPost(req, res) {
        try {
            const { postId } = req.params;

            const [comentarios] = await pool.query(
                `SELECT 
                    c.id, 
                    c.post_id, 
                    c.user_id, 
                    c.parent_comment_id, 
                    c.content, 
                    c.created_at,
                    COALESCE(d.nome, o.nome_fantasia, 'Usuário Civvo') AS autor_nome,
                    COALESCE(d.avatar_url, o.logo_url) AS autor_avatar
                 FROM POST_COMMENT c
                 JOIN USERS u ON c.user_id = u.id
                 LEFT JOIN DOADORES_PROFILES d ON u.id = d.user_id
                 LEFT JOIN ONGS_PROFILES o ON u.id = o.user_id
                 WHERE c.post_id = ? AND c.is_active = TRUE
                 ORDER BY c.created_at ASC`,
                [postId]
            );

            return res.status(200).json(comentarios);
        } catch (error) {
            console.error("Erro ao listar comentários:", error);
            return res.status(500).json({ error: "Erro ao carregar comentários." });
        }
    }

    // Comentar em um Post (Salva definitivamente na tabela POST_COMMENT)
    static async comentarPost(req, res) {
        try {
            const { postId } = req.params;
            const userId = req.user?.userId || req.user?.id || req.userId;
            const content = req.body.content || req.body.texto || req.body.comentario;
            const { parentCommentId } = req.body;

            if (!userId) {
                return res.status(401).json({ error: "Usuário não autenticado." });
            }

            if (!content || content.trim() === '') {
                return res.status(400).json({ error: "O comentário não pode estar vazio." });
            }

            const commentId = await PostModel.addComment(postId, userId, content.trim(), parentCommentId || null);
            return res.status(201).json({ 
                message: "Comentário adicionado com sucesso!", 
                commentId 
            });
        } catch (error) {
            console.error("Erro ao comentar:", error);
            return res.status(500).json({ error: "Erro ao adicionar comentário." });
        }
    }

    static async compartilharPost(req, res) {
        try {
            const { postId } = req.params;
            const userId = req.user?.userId || req.user?.id || req.userId;

            const shareId = await PostModel.sharePost(postId, userId);
            return res.status(201).json({ message: "Publicação compartilhada com sucesso!", shareId });
        } catch (error) {
            console.error("Erro ao compartilhar post:", error);
            return res.status(500).json({ error: "Erro ao compartilhar publicação." });
        }
    }

    static async denuciarPost(req, res) {
        try {
            const { postId } = req.params;
            const userId = req.user?.userId || req.user?.id || req.userId;
            const { reason } = req.body;

            const reportId = await PostModel.reportPost(postId, userId, reason);
            return res.status(201).json({ message: "Denúncia registrada com sucesso.", reportId });
        } catch (error) {
            console.error("Erro ao denunciar post:", error);
            return res.status(400).json({ error: error.message || "Erro ao registrar denúncia." });
        }
    }

    // Criar Postagem (Envia a imagem direto para o Cloudinary e salva a URL permanente no MySQL)
    static async criarPostagem(req, res) {
        try {
            const ongId = req.ongId || req.user?.ongId || req.user?.ongProfileId || req.user?.id || req.userId || 1;
            const { type, caption, is_boosted, boosted_until, campaignData, volunteerData } = req.body;
            
            let mediaList = req.body.mediaList || [];

            // Se o front-end enviou um arquivo de imagem, sobe para o Cloudinary gerando link público definitivo
            if (req.file) {
                const cloudUrl = await uploadToCloudinary(req.file.buffer);
                mediaList = [{ file_url: cloudUrl, media_type: 'IMAGE' }];
            }

            const postId = await PostModel.createPost(
                ongId, 
                { type: type || 'POST', caption, is_boosted, boosted_until }, 
                mediaList, 
                campaignData, 
                volunteerData
            );

            return res.status(201).json({ message: "Publicação criada com sucesso!", postId, mediaList });
        } catch (error) {
            console.error("Erro ao criar publicação:", error);
            return res.status(500).json({ error: error.message || "Erro ao criar publicação." });
        }
    }

    // Editar Postagem (Atualiza legenda e imagem na nuvem de forma permanente)
    static async editarPostagem(req, res) {
        try {
            const { postId } = req.params;
            const { caption } = req.body;
            const ongId = req.ongId || req.user?.ongId || req.user?.ongProfileId || req.user?.id || req.userId || 1;
            const userType = req.user?.user_type || req.user?.userType || 'ONG';

            await PostModel.updatePost(postId, ongId, userType, caption);

            if (req.file) {
                const cloudUrl = await uploadToCloudinary(req.file.buffer);
                await pool.query(
                    'UPDATE POST_MEDIA SET file_url = ? WHERE post_id = ?',
                    [cloudUrl, postId]
                );
            }

            return res.status(200).json({ message: "Publicação atualizada com sucesso!" });
        } catch (error) {
            console.error("Erro ao editar publicação:", error);
            return res.status(400).json({ error: error.message || "Erro ao editar publicação." });
        }
    }

    static async deletarPostagem(req, res) {
        try {
            const { postId } = req.params;
            const ongId = req.ongId || req.user?.ongId || req.user?.ongProfileId || req.user?.id || req.userId || 1;
            const userType = req.user?.user_type || req.user?.userType || 'ONG';

            await PostModel.deletePost(postId, ongId, userType);
            return res.status(200).json({ message: "Publicação excluída com sucesso!" });
        } catch (error) {
            console.error("Erro ao excluir publicação:", error);
            return res.status(400).json({ error: error.message || "Erro ao excluir publicação." });
        }
    }

    static async candidatarVoluntariado(req, res) {
        try {
            const { postId } = req.params;
            const userId = req.user?.userId || req.user?.id || req.userId;

            const applicationId = await PostModel.applyVolunteer(postId, userId);
            return res.status(201).json({ message: "Candidatura realizada com sucesso!", applicationId });
        } catch (error) {
            console.error("Erro ao candidatar:", error);
            return res.status(400).json({ error: error.message || "Erro ao realizar candidatura." });
        }
    }

    static async listarHistoricoCurtidas(req, res) {
        try {
            const userId = req.user?.userId || req.user?.id || req.userId;
            const posts = await PostModel.getLikedPostsByUser(userId);
            return res.status(200).json(posts);
        } catch (error) {
            console.error("Erro ao listar histórico de curtidas:", error);
            return res.status(500).json({ error: "Erro ao carregar histórico." });
        }
    }

    static async listarHistoricoComentarios(req, res) {
        try {
            const userId = req.user?.userId || req.user?.id || req.userId;
            const comments = await PostModel.getCommentHistoryByUser(userId);
            return res.status(200).json(comments);
        } catch (error) {
            console.error("Erro ao listar histórico de comentários:", error);
            return res.status(500).json({ error: "Erro ao carregar histórico." });
        }
    }

    static async listarHistoricoVoluntariado(req, res) {
        try {
            const userId = req.user?.userId || req.user?.id || req.userId;
            const targetUserId = req.params.userId || userId;

            const posts = await PostModel.getVolunteerHistoryByUser(targetUserId, userId);
            return res.status(200).json(posts);
        } catch (error) {
            console.error("Erro ao listar histórico de voluntariado:", error);
            return res.status(500).json({ error: "Erro ao carregar histórico." });
        }
    }
}

export default PostController;