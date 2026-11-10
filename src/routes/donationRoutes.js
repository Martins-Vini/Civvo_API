import { Router } from 'express';
import DonationController from '../controllers/donationController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/', verificarToken, DonationController.realizarDoacao);

export default router;