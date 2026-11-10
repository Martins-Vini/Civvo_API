import { pool } from '../config/conexao.js';
import bcrypt from 'bcrypt';

class AdminModel {
    static async cadastrar(dados) {
        const { email, password, nome_completo, cargo, role_level } = dados;
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const password_hash = await bcrypt.hash(password, 10);

            const [userResult] = await connection.query(
                `INSERT INTO USERS (email, password_hash, user_type) VALUES (?, ?, 'ADMIN')`,
                [email, password_hash]
            );

            const userId = userResult.insertId;

            await connection.query(
                `INSERT INTO ADMIN_PROFILES (user_id, nome_completo, cargo, role_level) VALUES (?, ?, ?, ?)`,
                [userId, nome_completo, cargo, role_level || 'MODERADOR']
            );

            await connection.commit();
            return { id: userId, email, nome_completo };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async buscarPorEmail(email) {
        const [users] = await pool.query(
            `SELECT u.id, u.email, u.password_hash, u.user_type, a.nome_completo, a.role_level 
             FROM USERS u 
             JOIN ADMIN_PROFILES a ON u.id = a.user_id 
             WHERE u.email = ? AND u.user_type = 'ADMIN'`,
            [email]
        );
        return users[0] || null;
    }

    static async listarDenuncias() {
        const [rows] = await pool.query(`
            SELECT r.id, r.post_id, r.user_id, r.reason, r.status, r.created_at, 
                   u.email as autor_denuncia_email, p.ong_id 
            FROM POST_REPORTS r
            JOIN USERS u ON r.user_id = u.id
            JOIN POSTS p ON r.post_id = p.id
            ORDER BY r.created_at DESC
        `);
        return rows;
    }

    static async atualizarStatusDenuncia(reportId, novoStatus) {
        const [result] = await pool.query(
            `UPDATE POST_REPORTS SET status = ? WHERE id = ?`,
            [novoStatus, reportId]
        );
        return result.affectedRows > 0;
    }
}

export default AdminModel;