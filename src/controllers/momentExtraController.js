import { v2 as cloudinary } from 'cloudinary';
import MomentModel from '../models/momentModel.js';
import { MomentExtraModel } from '../models/momentExtraModel.js';
import { idDoUsuario } from './followerController.js';

const DURACOES = [24, 36, 48];

/* Envia o buffer da imagem ao Cloudinary (usa a mesma configuração que já existe para as publicações). */
function enviarParaCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'civvo/momentos', resource_type: 'image' },
            (erro, resultado) => (erro ? reject(erro) : resolve(resultado.secure_url))
        );
        stream.end(buffer);
    });
}

export const MomentExtraController = {
    /* POST /moments/upload  (multipart: image, caption, duracao_horas) */
    async criar(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });

            const ongId = await MomentExtraModel.ongIdDoUsuario(uid);
            if (!ongId) return res.status(403).json({ error: 'Apenas ONGs podem publicar momentos.' });

            if (!req.file) return res.status(400).json({ error: 'Envie a imagem do momento.' });

            if (!cloudinary.config().cloud_name) {
                return res.status(500).json({ error: 'O envio de imagens não está configurado no servidor (Cloudinary).' });
            }

            const horas = DURACOES.includes(Number(req.body?.duracao_horas)) ? Number(req.body.duracao_horas) : 24;
            const caption = String(req.body?.caption ?? '').trim().slice(0, 500);

            const url = await enviarParaCloudinary(req.file.buffer);
            const id = await MomentModel.create(ongId, url, caption, horas);

            return res.status(201).json({ id, media_url: url });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    /* GET /moments/vistos → [momentId, ...] */
    async vistos(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
            return res.json(await MomentExtraModel.listarVistos(uid));
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    /* POST /moments/:id/visto */
    async visto(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });

            const r = await MomentExtraModel.marcarVisto(Number(req.params.id), uid);
            if (r.notFound) return res.status(404).json({ error: 'Momento não encontrado ou expirado.' });
            return res.json({ message: 'Visto.' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    /* DELETE /moments/:id  (só a ONG dona) */
    async excluir(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });

            const ongId = await MomentExtraModel.ongIdDoUsuario(uid);
            if (!ongId) return res.status(403).json({ error: 'Apenas ONGs podem excluir momentos.' });

            const ok = await MomentExtraModel.excluir(Number(req.params.id), ongId);
            if (!ok) return res.status(404).json({ error: 'Momento não encontrado ou sem permissão para excluir.' });
            return res.json({ message: 'Momento excluído.' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
};