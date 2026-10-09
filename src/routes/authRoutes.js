import express from 'express';
import AuthController from '../controllers/authController.js';

const router = express.Router();

router.post('/register/doador', AuthController.registerDoador);
router.post('/login', AuthController.login);

export default router;
