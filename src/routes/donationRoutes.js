import express from 'express';
import DonationController from '../controllers/donationController.js';
import { verificarToken } from '../middlewares/authMiddleware.js'

const router = express.Router();

router.post('/', verificarToken, DonationController.doarParaCampanha);

export default router;