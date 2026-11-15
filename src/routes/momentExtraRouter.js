import express from 'express';
import multer from 'multer';
import { MomentExtraController } from '../controllers/momentExtraController.js';
import { verificarToken, somenteOngs } from '../middlewares/authMiddleware.js';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB (o app já manda a imagem recortada e comprimida)
    fileFilter: (req, file, cb) =>
        file.mimetype?.startsWith('image/') ? cb(null, true) : cb(new Error('Envie um arquivo de imagem.')),
});

/* devolve erro de upload em JSON (em vez da página de erro padrão do Express) */
const receberImagem = (req, res, next) =>
    upload.single('image')(req, res, (erro) => (erro ? res.status(400).json({ error: erro.message }) : next()));

// Estas rotas são montadas ANTES do momentsRoutes no index.js; o que não casar aqui segue para ele.
router.post('/upload', verificarToken, somenteOngs, receberImagem, MomentExtraController.criar);
router.get('/vistos', verificarToken, MomentExtraController.vistos);
router.post('/:id/visto', verificarToken, MomentExtraController.visto);
router.delete('/:id', verificarToken, somenteOngs, MomentExtraController.excluir);

export default router;