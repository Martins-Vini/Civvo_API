import { Router } from 'express';
import PostController from '../controllers/postController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/uploadMiddleware.js'; // Importante para enviar a imagem ao Cloudinary

const router = Router();

// Feed público (qualquer pessoa visualiza as postagens e imagens da nuvem)
router.get('/feed', PostController.listarFeed);

// CRUD de Postagens (Com suporte a upload de imagem para o Cloudinary)
router.post('/', verificarToken, upload.single('image'), PostController.criarPostagem);
router.put('/:postId', verificarToken, upload.single('image'), PostController.editarPostagem);
router.delete('/:postId', verificarToken, PostController.deletarPostagem);

// Curtidas (Salva/Remove permanentemente no banco)
router.post('/:postId/curtir', verificarToken, PostController.curtirPost);

// Comentários (Buscar e Salvar permanentemente)
router.get('/:postId/comentarios', PostController.listarComentariosPost);
router.post('/:postId/comentar', verificarToken, PostController.comentarPost);
router.post('/:postId/comentarios', verificarToken, PostController.comentarPost); // Alias de segurança caso o front use /comentarios

// Interações extras e Voluntariado
router.post('/:postId/compartilhar', verificarToken, PostController.compartilharPost);
router.post('/:postId/denunciar', verificarToken, PostController.denuciarPost);
router.post('/:postId/candidatar', verificarToken, PostController.candidatarVoluntariado);

// Históricos do Usuário
router.get('/historico/curtidas', verificarToken, PostController.listarHistoricoCurtidas);
router.get('/historico/comentarios', verificarToken, PostController.listarHistoricoComentarios);
router.get('/historico/voluntariado', verificarToken, PostController.listarHistoricoVoluntariado);
router.get('/historico/voluntariado/:userId', verificarToken, PostController.listarHistoricoVoluntariado);

export default router;