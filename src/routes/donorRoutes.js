import { Router } from 'express';
import DonorController from '../controllers/donorController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.put('/profile', verificarToken, DonorController.atualizarPerfil);

export default router;