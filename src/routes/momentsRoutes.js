import express from 'express';
import MomentController from '../controllers/momentController.js';
import { verificarToken, somenteOngs } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', verificarToken, MomentController.listarMomentos);
router.post('/', verificarToken, somenteOngs, MomentController.criarMomento);

export default router;