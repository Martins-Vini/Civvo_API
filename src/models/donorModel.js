import { pool } from '../config/conexao.js';

class DoadorModel {
    static async create(userData, profileData) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            const [userResult] = await connection.query(
                `INSERT INTO USERS (email, password_hash, user_type) VALUES (?, ?, 'DOADOR')`,
                [userData.email, userData.password_hash]
            );
            
            const userId = userResult.insertId;

            await connection.query(
                `INSERT INTO DOADORES_PROFILES 
                (user_id, nome, sobrenome, apelido_unico, cpf, avatar_url, bio, cadunico_file) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, profileData.nome, profileData.sobrenome, 
                    profileData.apelido_unico, profileData.cpf, 
                    profileData.avatar_url || null, profileData.bio || null, 
                    profileData.cadunico_file || null
                ]
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

    static async createFromGoogle(userData, profileData) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // password_hash fica como NULL para contas Google
            const [userResult] = await connection.query(
                `INSERT INTO USERS (email, password_hash, user_type) VALUES (?, NULL, 'DOADOR')`,
                [userData.email]
            );
            
            const userId = userResult.insertId;

            await connection.query(
                `INSERT INTO DOADORES_PROFILES 
                (user_id, nome, sobrenome, apelido_unico, avatar_url) 
                VALUES (?, ?, ?, ?, ?)`,
                [
                    userId, profileData.nome, profileData.sobrenome, 
                    profileData.apelido_unico, profileData.avatar_url || null
                ]
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

    static async findByEmail(email) {
        const [rows] = await pool.query(
            `SELECT u.*, d.nome, d.apelido_unico, d.avatar_url 
             FROM USERS u 
             LEFT JOIN DOADORES_PROFILES d ON u.id = d.user_id 
             WHERE u.email = ? AND u.user_type = 'DOADOR'`, 
            [email]
        );
        return rows[0];
    }
}

export default DoadorModel;