import express from 'express';
import AuthController from '../controllers/authController.js';
import GoogleAuthController from '../controllers/googleAuthController.js';

const router = express.Router();

// Rotas de Cadastro de Doador com verificação por e-mail
router.post('/register/solicitar', AuthController.solicitarCadastroDoador);
router.post('/register/confirmar', AuthController.confirmarCadastroDoador);

// Rotas de Login de Doador com 2FA por e-mail
router.post('/login/iniciar', AuthController.iniciarLogin);
router.post('/login/verificar', AuthController.verificarLogin);

// Rota de Autenticação com Google para Doador
router.post('/google', GoogleAuthController.loginGoogle);

export default router;