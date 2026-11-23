import { PartnershipModel } from '../models/partnershipModel.js';

const meuId = (req) => req.user?.userId || req.user?.id;

export const PartnershipController = {
    /* POST /parcerias  { toOngId, postId?, message? } */
    async criar(req, res) {
        try {
            if (req.user?.userType !== 'ONG' && req.user?.user_type !== 'ONG') {
                return res.status(403).json({ error: 'Apenas ONGs podem solicitar parceria.' });
            }
            const fromOngId = await PartnershipModel.minhaOngId(meuId(req));
            if (!fromOngId) return res.status(404).json({ error: 'Perfil de ONG não encontrado.' });

            const { toOngId, postId, message } = req.body || {};
            if (!toOngId) return res.status(400).json({ error: 'Informe a ONG de destino.' });

            const r = await PartnershipModel.criarSolicitacao({
                fromOngId,
                toOngId: Number(toOngId),
                postId: postId ? Number(postId) : null,
                message,
            });
            return res.status(201).json(r);
        } catch (e) {
            return res.status(400).json({ error: e.message });
        }
    },

    /* GET /parcerias/recebidas */
    async recebidas(req, res) {
        try {
            const ongId = await PartnershipModel.minhaOngId(meuId(req));
            if (!ongId) return res.status(404).json({ error: 'Perfil de ONG não encontrado.' });
            return res.json(await PartnershipModel.listarRecebidas(ongId));
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    },

    /* GET /parcerias/enviadas */
    async enviadas(req, res) {
        try {
            const ongId = await PartnershipModel.minhaOngId(meuId(req));
            if (!ongId) return res.status(404).json({ error: 'Perfil de ONG não encontrado.' });
            return res.json(await PartnershipModel.listarEnviadas(ongId));
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    },

    /* PUT /parcerias/:id/responder  { aceitar: boolean } */
    async responder(req, res) {
        try {
            const ongId = await PartnershipModel.minhaOngId(meuId(req));
            if (!ongId) return res.status(404).json({ error: 'Perfil de ONG não encontrado.' });
            const r = await PartnershipModel.responder(Number(req.params.id), ongId, !!req.body?.aceitar);
            return res.json(r);
        } catch (e) {
            return res.status(400).json({ error: e.message });
        }
    },
};
