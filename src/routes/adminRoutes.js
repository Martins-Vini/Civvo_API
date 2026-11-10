import { Router } from 'express';
import AdminController from '../controllers/adminController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/cadastro', AdminController.cadastrar);
router.post('/login', AdminController.login);
router.get('/denuncias', verificarToken, AdminController.listarDenuncias);
router.put('/denuncias/:id', verificarToken, AdminController.atualizarDenuncia);

export default router;