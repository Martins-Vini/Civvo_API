import DonationModel from '../models/donationModel.js';

class DonationController {
    static async doarParaCampanha(req, res) {
        try {
            const userId = req.user.userId;
            const { campaignId, amount } = req.body;

            const donationId = await DonationModel.doarParaCampanha(userId, campaignId, amount);
            return res.status(201).json({ message: "Doação realizada com sucesso! Obrigado por apoiar a causa.", donationId });
        } catch (error) {
            console.error("Erro na doação:", error);
            return res.status(400).json({ error: error.message || "Erro ao processar doação." });
        }
    }
}

export default DonationController;