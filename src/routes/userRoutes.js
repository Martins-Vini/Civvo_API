import express from 'express';
import UserController from '../controllers/userController.js';
import { upload } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// A rota usa 'upload.single('image')' para capturar o arquivo enviado do front-end
router.put('/perfil/editar', upload.single('image'), UserController.atualizarPerfil);

export default router;