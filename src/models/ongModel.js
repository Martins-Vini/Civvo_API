import { pool } from '../config/conexao.js';

export class OngModel {
    static async criar(userData, ongData, enderecoData, telefoneData) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [userResult] = await connection.query(
                `INSERT INTO USERS (email, password_hash, user_type) VALUES (?, ?, 'ONG')`,
                [userData.email, userData.password_hash]
            );
            const userId = userResult.insertId;

            await connection.query(
                `INSERT INTO ONGS_PROFILES 
                (user_id, cnpj, razao_social, nome_fantasia, cnae, logo_url, banner_url, historia, causas_atendidas, chave_pix, nivel_transparencia) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, ongData.cnpj, ongData.razao_social, ongData.nome_fantasia,
                    ongData.cnae, ongData.logo_url || null, ongData.banner_url || null,
                    ongData.historia || null, ongData.causas_atendidas || null,
                    ongData.chave_pix || null, ongData.nivel_transparencia || null
                ]
            );

            await connection.query(
                `INSERT INTO USER_ENDERECOS (user_id, rua, bairro, cidade, estado, cep) VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, enderecoData.rua, enderecoData.bairro, enderecoData.cidade, enderecoData.estado, enderecoData.cep]
            );

            await connection.query(
                `INSERT INTO USER_TELEFONES (user_id, ddd, numero, is_whatsapp) VALUES (?, ?, ?, ?)`,
                [userId, telefoneData.ddd, telefoneData.numero, telefoneData.is_whatsapp || false]
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

    static async buscarPorEmail(email) {
        const [rows] = await pool.query(
            `SELECT u.*, o.id as ong_profile_id, o.razao_social, o.nome_fantasia, o.cnpj 
             FROM USERS u 
             JOIN ONGS_PROFILES o ON u.id = o.user_id 
             WHERE u.email = ? AND u.user_type = 'ONG'`, 
            [email]
        );
        return rows[0];
    }

    static async buscarPorCnpj(cnpj) {
        const [rows] = await pool.query(
            `SELECT * FROM ONGS_PROFILES WHERE cnpj = ?`, 
            [cnpj]
        );
        return rows[0];
    }
}