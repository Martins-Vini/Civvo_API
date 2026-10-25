import { pool } from '../config/conexao.js';

export class CodeModel {
    static async salvar(email, code, type) {
        // Remove códigos anteriores pendentes para o mesmo e-mail e tipo
        await pool.query(`DELETE FROM email_verification_codes WHERE email = ? AND type = ?`, [email, type]);
        
        // Deixa o MySQL calcular a expiração usando o relógio próprio do servidor (evita conflito de timezone)
        await pool.query(
            `INSERT INTO email_verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
            [email, code, type]
        );
    }

    static async validar(email, code, type) {
        const [rows] = await pool.query(
            `SELECT * FROM email_verification_codes 
             WHERE email = ? AND code = ? AND type = ? AND expires_at > NOW()`,
            [email, code, type]
        );
        return rows.length > 0;
    }

    static async deletar(email, type) {
        await pool.query(`DELETE FROM email_verification_codes WHERE email = ? AND type = ?`, [email, type]);
    }
}