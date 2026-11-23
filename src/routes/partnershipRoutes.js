import { Router } from 'express';
import { PartnershipController } from '../controllers/partnershipController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/', verificarToken, PartnershipController.criar);
router.get('/recebidas', verificarToken, PartnershipController.recebidas);
router.get('/enviadas', verificarToken, PartnershipController.enviadas);
router.put('/:id/responder', verificarToken, PartnershipController.responder);

export default router;
