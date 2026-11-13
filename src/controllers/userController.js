import { pool } from '../config/conexao.js';
import { uploadToCloudinary } from '../middlewares/uploadMiddleware.js';

class UserController {
    // Exemplo no backend (userController.js ou profileController.js)
static async obterPerfilPublico(req, res) {
    try {
        const { id } = req.params; // ID do usuário ou do perfil
        // Busca perfil do doador ou da ONG unindo com a tabela USERS
        const [perfil] = await pool.query(
            `SELECT u.id, u.email, u.user_type, d.nome, d.sobrenome, d.apelido_unico, d.avatar_url, d.banner_url, d.bio 
             FROM USERS u 
             LEFT JOIN DOADORES_PROFILES d ON u.id = d.user_id 
             WHERE u.id = ? AND u.is_active = TRUE`, 
            [id]
        );

        if (perfil.length === 0) {
            return res.status(404).json({ error: "Perfil não encontrado." });
        }
        return res.status(200).json(perfil[0]);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar perfil." });
    }
}
    static async atualizarPerfil(req, res) {
        try {
            const userId = req.user.userId; // Obtido do Token JWT
            const { nome, bio } = req.body;
            let avatarUrl = null;

            // Se o usuário enviou uma nova imagem de perfil
            if (req.file) {
                // Envia a imagem para o Cloudinary e obtém a URL pública definitiva
                avatarUrl = await uploadToCloudinary(req.file.buffer);
            }

            // Atualiza no banco de dados (tabela DOADORES_PROFILES)
            if (avatarUrl) {
                await pool.query(
                    `UPDATE DOADORES_PROFILES SET nome = ?, bio = ?, avatar_url = ? WHERE user_id = ?`,
                    [nome, bio, avatarUrl, userId]
                );
            } else {
                await pool.query(
                    `UPDATE DOADORES_PROFILES SET nome = ?, bio = ? WHERE user_id = ?`,
                    [nome, bio, userId]
                );
            }

            return res.status(200).json({ 
                message: "Perfil atualizado com sucesso!", 
                avatar_url: avatarUrl 
            });

        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            return res.status(500).json({ error: "Erro interno ao atualizar perfil." });
        }
    }
}

export default UserController;