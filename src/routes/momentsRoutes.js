import express from 'express';
import MomentController from '../controllers/momentController.js';
import { verificarToken, somenteOngs } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Rotas de Momentos / Stories (24h a 48h)
router.get('/', verificarToken, MomentController.listarMomentos);
router.post('/', verificarToken, somenteOngs, MomentController.criarMomento);

export default router;