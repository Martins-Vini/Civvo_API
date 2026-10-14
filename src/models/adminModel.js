import { pool } from '../config/conexao.js';

export class AdminModel {
    static async buscarPorEmail(email) {
        const [rows] = await pool.query(
            `SELECT u.*, a.id as admin_profile_id, a.nome_completo, a.cargo, a.role_level 
             FROM USERS u 
             JOIN ADMIN_PROFILES a ON u.id = a.user_id 
             WHERE u.email = ? AND u.user_type = 'ADMIN' AND u.is_active = TRUE`, 
            [email]
        );
        return rows[0];
    }

    static async criarNovoAdmin(userData, adminData) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [userResult] = await connection.query(
                `INSERT INTO USERS (email, password_hash, user_type, is_active) VALUES (?, ?, 'ADMIN', TRUE)`,
                [userData.email, userData.password_hash]
            );
            const userId = userResult.insertId;

            await connection.query(
                `INSERT INTO ADMIN_PROFILES (user_id, nome_completo, cargo, role_level, is_active) VALUES (?, ?, ?, ?, TRUE)`,
                [userId, adminData.nome_completo, adminData.cargo, adminData.role_level]
            );

            await connection.commit();
            return userId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}