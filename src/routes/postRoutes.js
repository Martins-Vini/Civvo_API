import { Router } from 'express';
import PostController from '../controllers/postController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/feed', PostController.listarFeed);

router.post('/', verificarToken, PostController.criarPostagem);
router.put('/:postId', verificarToken, PostController.editarPostagem);
router.delete('/:postId', verificarToken, PostController.deletarPostagem);

router.post('/:postId/curtir', verificarToken, PostController.curtirPost);
router.post('/:postId/comentar', verificarToken, PostController.comentarPost);
router.post('/:postId/compartilhar', verificarToken, PostController.compartilharPost);
router.post('/:postId/denunciar', verificarToken, PostController.denuciarPost);
router.post('/:postId/candidatar', verificarToken, PostController.candidatarVoluntariado);

router.get('/historico/curtidas', verificarToken, PostController.listarHistoricoCurtidas);
router.get('/historico/comentarios', verificarToken, PostController.listarHistoricoComentarios);
router.get('/historico/voluntariado', verificarToken, PostController.listarHistoricoVoluntariado);
router.get('/historico/voluntariado/:userId', verificarToken, PostController.listarHistoricoVoluntariado);

export default router;