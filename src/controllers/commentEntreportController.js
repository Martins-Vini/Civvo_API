import { CommentReportModel } from '../models/commentReportModel.js';
import { idDoUsuario } from './followerController.js';

export const CommentReportController = {
    /* POST /comentarios/:commentId/denunciar  { reason } */
    async denunciar(req, res) {
        try {
            const uid = idDoUsuario(req);
            if (!uid) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });

            const commentId = Number(req.params.commentId);
            const reason = String(req.body?.reason ?? '').trim();

            if (!Number.isInteger(commentId) || commentId <= 0) {
                return res.status(400).json({ error: 'Comentário inválido.' });
            }
            if (reason.length < 3 || reason.length > 225) {
                return res.status(400).json({ error: 'Informe o motivo (entre 3 e 225 caracteres).' });
            }

            const r = await CommentReportModel.criar(commentId, uid, reason);
            if (r.notFound) return res.status(404).json({ error: 'Comentário não encontrado.' });
            if (r.proprio) return res.status(400).json({ error: 'Você não pode denunciar o seu próprio comentário.' });
            if (r.duplicada) return res.status(409).json({ error: 'Você já denunciou este comentário.' });

            return res.status(201).json({ message: 'Denúncia enviada.', id: r.id });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
};