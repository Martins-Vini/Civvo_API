import { pool } from '../config/conexao.js';

class DonorModel {
    static async updateProfile(userId, profileData) {
        const { bio, banner_url, avatar_url, voluntariados_publicos, redes_sociais } = profileData;
        
        const [result] = await pool.query(
            `UPDATE DOADORES_PROFILES 
             SET bio = COALESCE(?, bio),
                 banner_url = COALESCE(?, banner_url),
                 avatar_url = COALESCE(?, avatar_url),
                 voluntariados_publicos = COALESCE(?, voluntariados_publicos),
                 redes_sociais = COALESCE(?, redes_sociais)
             WHERE user_id = ?`,
            [
                bio !== undefined ? bio : null,
                banner_url !== undefined ? banner_url : null,
                avatar_url !== undefined ? avatar_url : null,
                voluntariados_publicos !== undefined ? voluntariados_publicos : null,
                redes_sociais !== undefined ? JSON.stringify(redes_sociais) : null,
                userId
            ]
        );

        if (result.affectedRows === 0) {
            throw new Error("Perfil de doador não encontrado para este usuário.");
        }
        return true;
    }

   static async findByEmail(email) {
        const [rows] = await pool.query(
            `SELECT u.*, d.id as donor_profile_id, d.nome, d.sobrenome, d.apelido_unico 
             FROM USERS u 
             LEFT JOIN DOADORES_PROFILES d ON u.id = d.user_id 
             WHERE u.email = ?`, 
            [email]
        );
        return rows[0];
    }
}

export default DonorModel;