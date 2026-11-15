import { PerfilModel, ErroPerfil } from '../models/perfilModel.js';
import { cloudinaryConfigurado, enviarImagem } from '../utils/enviarImagem.js';
import { idDoUsuario } from './followerController.js';

const responderErro = (res, error) => {
    if (error instanceof ErroPerfil) return res.status(error.status).json({ error: error.message });
    console.error('[perfil]', error);
    return res.status(500).json({ error: error.message });
};

export const PerfilController = {
    /* GET /perfil/me */
    async meu(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
            const p = await PerfilModel.obterMeu(uid);
            if (!p) return res.status(404).json({ error: 'Perfil não encontrado.' });
            return res.json(p);
        } catch (error) {
            return responderErro(res, error);
        }
    },

    /* PUT /perfil/me */
    async atualizar(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
            const perfil = await PerfilModel.atualizar(uid, req.body || {});
            return res.json({ message: 'Perfil atualizado.', perfil });
        } catch (error) {
            return responderErro(res, error);
        }
    },

    /* GET /perfil/ong/:ongId  (perfil público) */
    async ongPublico(req, res) {
        try {
            const id = Number(req.params.ongId);
            if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ONG inválida.' });
            const p = await PerfilModel.obterOngPublico(id);
            if (!p) return res.status(404).json({ error: 'ONG não encontrada.' });
            return res.json(p);
        } catch (error) {
            return responderErro(res, error);
        }
    },

    /* POST /perfil/imagem  (multipart: image, tipo = avatar | banner) */
    async imagem(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });

            const alvo = String(req.body?.tipo || '');
            if (alvo !== 'avatar' && alvo !== 'banner') return res.status(400).json({ error: 'Tipo de imagem inválido.' });
            if (!req.file) return res.status(400).json({ error: 'Envie a imagem.' });
            if (!cloudinaryConfigurado()) {
                return res.status(500).json({ error: 'O envio de imagens não está configurado no servidor (Cloudinary).' });
            }

            const url = await enviarImagem(req.file.buffer, 'civvo/perfis');
            await PerfilModel.salvarImagem(uid, alvo, url);
            return res.json({ url });
        } catch (error) {
            return responderErro(res, error);
        }
    },
};