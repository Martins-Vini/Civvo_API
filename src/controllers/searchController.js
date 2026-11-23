import { SearchModel } from '../models/searchModel.js';

export const SearchController = {
    /* GET /buscar?q=texto&tipo=ONG|DOADOR */
    async buscar(req, res) {
        try {
            const q = String(req.query.q || '');
            const tipoRaw = String(req.query.tipo || '').toUpperCase();
            const tipo = tipoRaw === 'ONG' || tipoRaw === 'DOADOR' ? tipoRaw : null;
            const resultados = await SearchModel.buscar(q, tipo);
            return res.json(resultados);
        } catch (error) {
            console.error('[buscar]', error);
            return res.status(500).json({ error: 'Erro ao buscar.' });
        }
    },
};
