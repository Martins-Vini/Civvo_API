import PostModel from '../models/postModel.js';

class PostController {
    static async listarFeed(req, res) {
        try {
            const posts = await PostModel.listarFeed();
            return res.status(200).json(posts);
        } catch (error) {
            console.error("Erro ao listar feed:", error);
            return res.status(500).json({ error: "Erro ao carregar o feed." });
        }
    }

    static async curtirPost(req, res) {
        try {
            const { postId } = req.params;
            const userId = req.user.userId;

            const resultado = await PostModel.toggleLike(postId, userId);
            return res.status(200).json(resultado);
        } catch (error) {
            console.error("Erro ao curtir post:", error);
            return res.status(500).json({ error: "Erro ao processar curtida." });
        }
    }

    static async comentarPost(req, res) {
        try {
            const { postId } = req.params;
            const userId = req.user.userId;
            const { content, parentCommentId } = req.body;

            const commentId = await PostModel.addComment(postId, userId, content, parentCommentId);
            return res.status(201).json({ message: "Comentário adicionado com sucesso!", commentId });
        } catch (error) {
            console.error("Erro ao comentar:", error);
            return res.status(500).json({ error: "Erro ao adicionar comentário." });
        }
    }

    static async compartilharPost(req, res) {
        try {
            const { postId } = req.params;
            const userId = req.user.userId;

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
            const userId = req.user.userId;
            const { reason } = req.body;

            const reportId = await PostModel.reportPost(postId, userId, reason);
            return res.status(201).json({ message: "Denúncia registrada com sucesso.", reportId });
        } catch (error) {
            console.error("Erro ao denunciar post:", error);
            return res.status(400).json({ error: error.message || "Erro ao registrar denúncia." });
        }
    }
static async criarPostagem(req, res) {
        try {
            const ongId = req.ongId || req.user?.ongId || req.user?.ongProfileId || req.user?.id || req.userId || 1;

            const { type, caption, is_boosted, boosted_until, mediaList, campaignData, volunteerData } = req.body;

            const postId = await PostModel.createPost(
                ongId, 
                { type, caption, is_boosted, boosted_until }, 
                mediaList, 
                campaignData, 
                volunteerData
            );

            return res.status(201).json({ message: "Publicação criada com sucesso!", postId });
        } catch (error) {
            console.error("Erro ao criar publicação:", error);
            return res.status(500).json({ error: error.message || "Erro ao criar publicação." });
        }
    }

   static async editarPostagem(req, res) {
        try {
            const { postId } = req.params;
            const { caption } = req.body;
            const ongId = req.ongId || req.user?.ongId || req.user?.ongProfileId || req.user?.id || req.userId || 1;
            const userType = req.user?.user_type || 'ONG';

            await PostModel.updatePost(postId, ongId, userType, caption);
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
            const userType = req.user?.user_type || 'ONG';

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
            const userId = req.user.userId;

            const applicationId = await PostModel.applyVolunteer(postId, userId);
            return res.status(201).json({ message: "Candidatura realizada com sucesso!", applicationId });
        } catch (error) {
            console.error("Erro ao candidatar:", error);
            return res.status(400).json({ error: error.message || "Erro ao realizar candidatura." });
        }
    }

    static async listarHistoricoCurtidas(req, res) {
        try {
            const userId = req.user.userId;
            const posts = await PostModel.getLikedPostsByUser(userId);
            return res.status(200).json(posts);
        } catch (error) {
            console.error("Erro ao listar histórico de curtidas:", error);
            return res.status(500).json({ error: "Erro ao carregar histórico." });
        }
    }

    static async listarHistoricoComentarios(req, res) {
        try {
            const userId = req.user.userId;
            const comments = await PostModel.getCommentHistoryByUser(userId);
            return res.status(200).json(comments);
        } catch (error) {
            console.error("Erro ao listar histórico de comentários:", error);
            return res.status(500).json({ error: "Erro ao carregar histórico." });
        }
    }

    static async listarHistoricoVoluntariado(req, res) {
        try {
            const targetUserId = req.params.userId || req.user.userId;
            const requestingUserId = req.user.userId;

            const posts = await PostModel.getVolunteerHistoryByUser(targetUserId, requestingUserId);
            return res.status(200).json(posts);
        } catch (error) {
            console.error("Erro ao listar histórico de voluntariado:", error);
            return res.status(500).json({ error: "Erro ao carregar histórico." });
        }
    }
}

export default PostController;