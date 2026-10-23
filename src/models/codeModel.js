import { pool } from '../config/conexao.js';

export class CodeModel {
    static async salvar(email, code, type) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Validade de 10 minutos
        // Remove códigos anteriores pendentes para o mesmo e-mail e tipo
        await pool.query(`DELETE FROM email_verification_codes WHERE email = ? AND type = ?`, [email, type]);
        
        await pool.query(
            `INSERT INTO email_verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)`,
            [email, code, type, expiresAt]
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