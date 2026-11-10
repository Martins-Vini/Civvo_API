import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { pool } from '../config/conexao.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default class GoogleAuthController {
    static async loginGoogle(req, res) {
        try {
            const { idToken, userType } = req.body; // userType: 'DOADOR' ou 'ONG'

            const ticket = await client.verifyIdToken({
                idToken: idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            const email = payload.email;
            const nomeCompleto = payload.name;

            // Verifica se o usuário já existe
            const [users] = await pool.query(`SELECT * FROM USERS WHERE email = ?`, [email]);

            let userId;
            let tipoUsuarioFinal = userType || 'DOADOR';

            if (users.length > 0) {
                userId = users[0].id;
                tipoUsuarioFinal = users[0].user_type;
            } else {
                // Cria usuário base (já ativo/verificado pois veio do Google)
                const [userResult] = await pool.query(
                    `INSERT INTO USERS (email, password_hash, user_type, is_active) VALUES (?, NULL, ?, TRUE)`,
                    [email, tipoUsuarioFinal]
                );
                userId = userResult.insertId;

                // Se for doador, cria o perfil básico em DOADORES_PROFILES
                if (tipoUsuarioFinal === 'DOADOR') {
                    await pool.query(
                        `INSERT INTO DOADORES_PROFILES (user_id, nome, sobrenome, apelido_unico) VALUES (?, ?, 'Google', ?)`,
                        [userId, nomeCompleto, `user_${userId}`]
                    );
                }
            }

            // Gera o token JWT do seu sistema
            const secret = process.env.JWT_SECRET || 'chave_secreta_temporaria';
            const token = jwt.sign(
                { userId: userId, userType: tipoUsuarioFinal },
                secret,
                { expiresIn: '24h' }
            );

            return res.status(200).json({
                message: "Login com Google realizado com sucesso!",
                token
            });

        } catch (error) {
            console.error("Erro no login com Google:", error);
            return res.status(401).json({ error: "Token do Google inválido." });
        }
    }
}