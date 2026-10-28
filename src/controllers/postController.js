import PostModel from '../models/postModel.js';

class PostController {
    static async criarPostagem(req, res) {
        try {
            const ongId = req.ongId; // Injetado pelo middleware somenteOngs
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
            return res.status(500).json({ error: "Erro ao criar publicação." });
        }
    }

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
}

export default PostController;