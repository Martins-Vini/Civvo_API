import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import DoadorModel from '../models/donorModel.js';
import { CodeModel } from '../models/codeModel.js';
import { enviarCodigoEmail } from '../services/emailService.js';

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
        try {
            const { email, codigo, password, nome, sobrenome, apelido_unico, cpf, avatar_url, bio, cadunico_file } = req.body;

            const codigoValido = await CodeModel.validar(email, codigo, 'REGISTRO');
            if (!codigoValido) {
                return res.status(400).json({ error: "Código de verificação inválido ou expirado." });
            }

            const password_hash = await bcrypt.hash(password, 10);
            
            const userId = await DoadorModel.create(
                { email, password_hash },
                { nome, sobrenome, apelido_unico, cpf, avatar_url, bio, cadunico_file }
            );

            await CodeModel.deletar(email, 'REGISTRO');

            return res.status(201).json({ message: "Doador cadastrado com sucesso!", userId });
            
        } catch (error) {
            console.error("Erro ao confirmar cadastro:", error);
            return res.status(500).json({ error: "Erro ao confirmar cadastro." });
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

            const codigoValido = await CodeModel.validar(email, codigo, 'LOGIN');
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
}

export default AuthController;