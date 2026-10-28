import MomentModel from '../models/momentModel.js';

class MomentController {
    static async criarMomento(req, res) {
        try {
            const ongId = req.ongId;
            const { media_url, caption, duracao_horas } = req.body;

            // Padrão de 24 horas, aceitando até 48h conforme regra do TCC
            const horas = duracao_horas && [24, 36, 48].includes(Number(duracao_horas)) ? Number(duracao_horas) : 24;

            const momentId = await MomentModel.create(ongId, media_url, caption, horas);
            return res.status(201).json({ message: "Momento publicado com sucesso!", momentId });
        } catch (error) {
            console.error("Erro ao criar momento:", error);
            return res.status(500).json({ error: "Erro ao publicar momento." });
        }
    }

    static async listarMomentos(req, res) {
        try {
            const moments = await MomentModel.listarAtivos();
            return res.status(200).json(moments);
        } catch (error) {
            console.error("Erro ao listar momentos:", error);
            return res.status(500).json({ error: "Erro ao carregar momentos." });
        }
    }
}

export default MomentController;