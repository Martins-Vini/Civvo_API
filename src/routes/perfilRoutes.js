import express from 'express';
import multer from 'multer';
import { PerfilController } from '../controllers/perfilController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
        file.mimetype?.startsWith('image/') ? cb(null, true) : cb(new Error('Envie um arquivo de imagem.')),
});

const receberImagem = (req, res, next) =>
    upload.single('image')(req, res, (erro) => (erro ? res.status(400).json({ error: erro.message }) : next()));

router.get('/me', verificarToken, PerfilController.meu);
router.put('/me', verificarToken, PerfilController.atualizar);
router.post('/imagem', verificarToken, receberImagem, PerfilController.imagem);
router.get('/ong/:ongId', verificarToken, PerfilController.ongPublico);
router.get('/doador/:userId', verificarToken, PerfilController.doadorPublico);

export default router;