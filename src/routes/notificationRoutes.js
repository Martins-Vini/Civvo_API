import express from 'express';
import { NotificationController } from '../controllers/notificationController.js';
// ATENÇÃO: mesmo import do followerRoutes / postRoutes
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', verificarToken, NotificationController.listar);
router.put('/lidas', verificarToken, NotificationController.marcarLidas);

export default router;