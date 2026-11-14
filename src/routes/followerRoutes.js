import express from 'express';
import { FollowerController } from '../controllers/followerController.js';
// ATENÇÃO: copie este import EXATAMENTE como está na primeira linhas do seu postRoutes.js
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// As rotas fixas vêm antes das que têm parâmetro.
router.post('/toggle', verificarToken, FollowerController.toggleOng);
router.get('/me/ongs', verificarToken, FollowerController.minhasOngs);
router.get('/me/seguindo', verificarToken, FollowerController.minhaListaSeguindo);
router.get('/ong/:ongId/contagens', verificarToken, FollowerController.contagensOng);
router.get('/ong/:ongId/:tipo', verificarToken, FollowerController.listaOng);

router.post('/', verificarToken, FollowerController.followUser);
router.delete('/:followingId', verificarToken, FollowerController.unfollowUser);
router.get('/:userId/followers', FollowerController.listFollowers);
router.get('/:userId/following', FollowerController.listFollowing);

export default router;