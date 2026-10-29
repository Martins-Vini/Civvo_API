import express from 'express';
import PostController from '../controllers/postController.js';
import { verificarToken, somenteOngs } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Rotas públicas / autenticadas de leitura e interação
router.get('/feed', verificarToken, PostController.listarFeed);
router.post('/:postId/like', verificarToken, PostController.curtirPost);
router.post('/:postId/comentario', verificarToken, PostController.comentarPost);

// Rotas exclusivas de ONGs (Criar posts orgânicos, campanhas ou vagas de voluntariado)
router.post('/', verificarToken, somenteOngs, PostController.criarPostagem);

export default router;