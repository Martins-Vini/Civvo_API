import { pool } from '../config/conexao.js';

class MomentModel {
    static async create(ongId, mediaUrl, caption, duracaoHoras = 24) {
        // Calcula a expiração baseada no tempo escolhido (24, 36 ou 48 horas)
        const [result] = await pool.query(
            `INSERT INTO MOMENTS (ong_id, media_url, caption, expires_at) 
             VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
            [ongId, mediaUrl, caption || null, duracaoHoras]
        );
        return result.insertId;
    }

    static async listarAtivos() {
        // Retorna apenas momentos que ainda não expiraram
        const [rows] = await pool.query(`
            SELECT m.*, o.nome_fantasia AS ong_nome, o.logo_url AS ong_logo
            FROM MOMENTS m
            JOIN ONGS_PROFILES o ON m.ong_id = o.id
            WHERE m.is_active = TRUE AND m.expires_at > NOW()
            ORDER BY m.created_at DESC
        `);
        return rows;
    }
}

export default MomentModel;