import DonorModel from '../models/donorModel.js';

class DonorController {
    static async atualizarPerfil(req, res) {
        try {
            const userId = req.user?.userId || req.user?.id;
            const { bio, banner_url, avatar_url, voluntariados_publicos, redes_sociais } = req.body;

            await DonorModel.updateProfile(userId, {
                bio,
                banner_url,
                avatar_url,
                voluntariados_publicos,
                redes_sociais
            });

            return res.status(200).json({ message: "Perfil do doador atualizado com sucesso!" });
        } catch (error) {
            console.error("Erro ao atualizar perfil do doador:", error);
            return res.status(500).json({ error: "Erro ao atualizar perfil." });
        }
    }
}

export default DonorController;