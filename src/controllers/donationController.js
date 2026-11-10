import DonationModel from '../models/donationModel.js';

export default class DonationController {
    static async realizarDoacao(req, res) {
        try {
            const donorId = req.user?.userId || req.user?.id;
            const dadosDoacao = req.body || {};

            const comprovante = await DonationModel.doarParaCampanha(donorId, dadosDoacao);

            return res.status(201).json({
                message: "Doação realizada com sucesso!",
                comprovante
            });
        } catch (error) {
            console.error("Erro na doação:", error);
            return res.status(500).json({ error: error.message || "Erro ao realizar doação." });
        }
    }
}