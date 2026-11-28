import express from 'express';
import multer from 'multer';
import { PerfilController } from '../controllers/perfilController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';
/* ATENÇÃO: ajuste este caminho se o arquivo do model de perfil tiver outro nome/local no seu projeto */
import { PerfilModel } from '../models/perfilModel.js';

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

/* usado pelo chat: a conversa guarda o USERS.id da ONG, e o link do perfil precisa do ONGS_PROFILES.id */
router.get('/ong-por-usuario/:userId', verificarToken, async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Usuário inválido.' });
        const ongId = await PerfilModel.obterOngIdPorUsuario(userId);
        if (!ongId) return res.status(404).json({ error: 'ONG não encontrada.' });
        return res.status(200).json({ ong_id: ongId });
    } catch (error) {
        console.error('Erro ao resolver ONG por usuário:', error);
        return res.status(500).json({ error: 'Erro ao buscar a ONG.' });
    }
});

export default router;