import express from 'express';
import { CommentReportController } from '../controllers/commentReportController.js';
// ATENÇÃO: mesmo import do followerRoutes
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/:commentId/denunciar', verificarToken, CommentReportController.denunciar);

export default router;