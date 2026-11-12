import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../config/conexao.js';
import DoadorModel from '../models/donorModel.js';
import { CodeModel } from '../models/codeModel.js';
import { enviarCodigoEmail } from '../services/emailService.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthController {
    
    // ETAPA 1 DO CADASTRO: Valida se o email existe e envia o código de 6 dígitos
    static async solicitarCadastroDoador(req, res) {
        try {
            const { email } = req.body;
            
            const existingUser = await DoadorModel.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({ error: "Este email já está em uso." });
            }

            const codigo = Math.floor(100000 + Math.random() * 900000).toString();
            
            await CodeModel.salvar(email, codigo, 'REGISTRO');
            await enviarCodigoEmail(email, codigo);

            return res.status(200).json({ message: "Código de verificação enviado para o e-mail!" });
        } catch (error) {
            console.error("Erro ao solicitar cadastro:", error);
            return res.status(500).json({ error: "Erro ao solicitar cadastro." });
        }
    }

    // ETAPA 2 DO CADASTRO: Valida o código, cria o usuário na tabela USERS e o perfil em DOADORES_PROFILES
    static async confirmarCadastroDoador(req, res) {
        const connection = await pool.getConnection();
        try {
            const { email, codigo, password, nome, sobrenome, apelido_unico, cpf, avatar_url, bio, cadunico_file } = req.body;

            if (!email || !codigo) {
                return res.status(400).json({ error: "E-mail e código são obrigatórios." });
            }

            const codigoFormatado = String(codigo).trim();
            const codigoValido = await CodeModel.validar(email, codigoFormatado, 'REGISTRO');
            if (!codigoValido) {
                return res.status(400).json({ error: "Código de verificação inválido ou expirado." });
            }

            await connection.beginTransaction();

            const password_hash = await bcrypt.hash(password, 10);
            
            // 1. Cria o usuário principal
            const [userResult] = await connection.query(
                'INSERT INTO USERS (email, password_hash, user_type, is_active) VALUES (?, ?, "DOADOR", TRUE)',
                [email, password_hash]
            );
            const userId = userResult.insertId;

            // 2. Cria o perfil do doador
            await connection.query(
                `INSERT INTO DOADORES_PROFILES (user_id, nome, sobrenome, apelido_unico, cpf, avatar_url, bio, cadunico_file) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, nome, sobrenome, apelido_unico, cpf || null, avatar_url || null, bio || null, cadunico_file || null]
            );

            await connection.commit();
            await CodeModel.deletar(email, 'REGISTRO');

            return res.status(201).json({ message: "Doador cadastrado com sucesso!", userId });
            
        } catch (error) {
            await connection.rollback();
            console.error("Erro ao confirmar cadastro:", error);
            return res.status(500).json({ error: "Erro ao confirmar cadastro: " + error.message });
        } finally {
            connection.release();
        }
    }

    // ETAPA 1 DO LOGIN (2FA): Valida a senha e envia o código de 6 dígitos para o e-mail
    static async iniciarLogin(req, res) {
        try {
            const { email, password } = req.body;

            const user = await DoadorModel.findByEmail(email);
            if (!user) {
                return res.status(401).json({ error: "Credenciais inválidas." });
            }

            if (!user.password_hash) {
                return res.status(400).json({ error: "Esta conta foi criada com o Google. Utilize o botão de login com o Google." });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                return res.status(401).json({ error: "Credenciais inválidas." });
            }

            const codigo = Math.floor(100000 + Math.random() * 900000).toString();
            await CodeModel.salvar(email, codigo, 'LOGIN');
            await enviarCodigoEmail(email, codigo);

            return res.status(200).json({ 
                requiresTwoFactor: true, 
                message: "Código de autenticação de dois fatores enviado para o e-mail." 
            });

        } catch (error) {
            console.error("Erro ao iniciar login:", error);
            return res.status(500).json({ error: "Erro ao realizar login." });
        }
    }

    // ETAPA 2 DO LOGIN (2FA): Valida o código digitado e gera o token JWT final
    static async verificarLogin(req, res) {
        try {
            const { email, codigo } = req.body;
            const codigoFormatado = String(codigo).trim();

            const codigoValido = await CodeModel.validar(email, codigoFormatado, 'LOGIN');
            if (!codigoValido) {
                return res.status(400).json({ error: "Código inválido ou expirado." });
            }

            const user = await DoadorModel.findByEmail(email);
            if (!user) {
                return res.status(404).json({ error: "Usuário não encontrado." });
            }

            await CodeModel.deletar(email, 'LOGIN');

            const secret = process.env.JWT_SECRET || 'chave_secreta_temporaria';
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    userType: user.user_type,
                    nome: user.nome 
                }, 
                secret, 
                { expiresIn: '7d' }
            );

            return res.status(200).json({
                message: "Login realizado com sucesso!",
                token,
                user: {
                    id: user.id,
                    nome: user.nome,
                    apelido: user.apelido_unico,
                    avatar: user.avatar_url
                }
            });

        } catch (error) {
            console.error("Erro ao verificar login:", error);
            return res.status(500).json({ error: "Erro ao verificar login." });
        }
    }

    // LOGIN/CADASTRO COM GOOGLE PARA DOADOR
    static async loginGoogle(req, res) {
        const connection = await pool.getConnection();
        try {
            const { token } = req.body;

            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            
            const payload = ticket.getPayload();
            const { email, given_name, family_name, picture } = payload;

            let user = await DoadorModel.findByEmail(email);

            if (!user) {
                const apelido_unico = email.split('@')[0] + Math.floor(Math.random() * 1000);
                
                await connection.beginTransaction();
                const [userResult] = await connection.query(
                    'INSERT INTO USERS (email, user_type, is_active) VALUES (?, "DOADOR", TRUE)',
                    [email]
                );
                const userId = userResult.insertId;

                await connection.query(
                    `INSERT INTO DOADORES_PROFILES (user_id, nome, sobrenome, apelido_unico, avatar_url) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [userId, given_name || 'Doador', family_name || 'Civvo', apelido_unico, picture || null]
                );
                await connection.commit();
                
                user = await DoadorModel.findByEmail(email);
            }

            const secret = process.env.JWT_SECRET || 'chave_secreta_temporaria';
            const jwtToken = jwt.sign(
                { 
                    userId: user.id, 
                    userType: user.user_type,
                    nome: user.nome 
                }, 
                secret, 
                { expiresIn: '7d' }
            );

            return res.status(200).json({
                message: "Login com Google realizado com sucesso!",
                token: jwtToken,
                user: {
                    id: user.id,
                    nome: user.nome,
                    apelido: user.apelido_unico,
                    avatar: user.avatar_url
                }
            });

        } catch (error) {
            await connection.rollback();
            console.error("Erro no login com Google:", error);
            return res.status(401).json({ error: "Token do Google inválido ou expirado." });
        } finally {
            connection.release();
        }
    }
}

export default AuthController;