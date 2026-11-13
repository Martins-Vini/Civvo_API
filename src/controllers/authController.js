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
            
            // 1. Cria o usuário principal (Passando 'DOADOR' por parâmetro para evitar erro de coluna)
            const [userResult] = await connection.query(
                'INSERT INTO USERS (email, password_hash, user_type, is_active) VALUES (?, ?, ?, TRUE)',
                [email, password_hash, 'DOADOR']
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

    static async loginGoogle(req, res) {
        const connection = await pool.getConnection();
        try {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({ error: "Token do Google não fornecido." });
            }

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
                    'INSERT INTO USERS (email, user_type, is_active) VALUES (?, ?, TRUE)',
                    [email, 'DOADOR']
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
            // EXIBE O ERRO REAL NO CONSOLE E NA RESPOSTA PARA DIAGNÓSTICO
            console.error("Erro detalhado no login com Google:", error);
            return res.status(401).json({ error: "Erro Google Auth: " + error.message });
        } finally {
            connection.release();
        }
    }
    // ETAPA 1 DA RECUPERAÇÃO DE SENHA: Envia o código para o e-mail
    static async solicitarRecuperacaoSenha(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ error: "Informe o e-mail cadastrado." });
            }

            const user = await DoadorModel.findByEmail(email);
            securityCheck: {
                // Por segurança, mesmo se o e-mail não existir, podemos retornar sucesso 
                // para evitar enumeração de contas, mas aqui retornamos 404 para facilitar seu teste local:
                if (!user) {
                    return res.status(404).json({ error: "E-mail não encontrado na plataforma." });
                }
            }

            // Gera código de 6 dígitos e define validade de 15 minutos
            const codigo = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

            // Salva diretamente nos campos 2FA/Recuperação da tabela USERS
            await pool.query(
                'UPDATE USERS SET two_factor_code = ?, two_factor_expires_at = ? WHERE email = ?',
                [codigo, expiresAt, email]
            );

            // Envia o e-mail utilizando o serviço que você já tem configurado
            await enviarCodigoEmail(email, codigo);

            return res.status(200).json({ message: "Código de recuperação enviado para o seu e-mail!" });
        } catch (error) {
            console.error("Erro ao solicitar recuperação de senha:", error);
            return res.status(500).json({ error: "Erro ao processar solicitação de recuperação." });
        }
    }

    // ETAPA 2 DA RECUPERAÇÃO DE SENHA: Valida o código e altera a senha
    static async confirmarRecuperacaoSenha(req, res) {
        try {
            const { email, codigo, novaSenha } = req.body;

            if (!email || !codigo || !novaSenha) {
                return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
            }

            const codigoFormatado = String(codigo).trim();

            // Busca o usuário e valida o código e a expiração
            const [rows] = await pool.query(
                'SELECT id, two_factor_code, two_factor_expires_at FROM USERS WHERE email = ?',
                [email]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: "Usuário não encontrado." });
            }

            const user = rows[0];

            if (!user.two_factor_code || user.two_factor_code !== codigoFormatado) {
                return res.status(400).json({ error: "Código de verificação incorreto." });
            }

            if (new Date() > new Date(user.two_factor_expires_at)) {
                return res.status(400).json({ error: "Este código expirou. Solicite um novo." });
            }

            // Criptografa a nova senha
            const password_hash = await bcrypt.hash(novaSenha, 10);

            // Atualiza a senha e limpa o código usado
            await pool.query(
                'UPDATE USERS SET password_hash = ?, two_factor_code = NULL, two_factor_expires_at = NULL WHERE id = ?',
                [password_hash, user.id]
            );

            return res.status(200).json({ message: "Senha redefinida com sucesso! Faça login com sua nova senha." });
        } catch (error) {
            console.error("Erro ao confirmar recuperação de senha:", error);
            return res.status(500).json({ error: "Erro ao redefinir a senha: " + error.message });
        }
    }
}

export default AuthController;