import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import DoadorModel from '../models/donorModel.js';

class AuthController {
    static async registerDoador(req, res) {
        try {
            const { email, password, nome, sobrenome, apelido_unico, cpf, avatar_url, bio, cadunico_file } = req.body;

            // Verifica se o email já existe
            const existingUser = await DoadorModel.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({ error: "Este email já está em uso." });
            }

            // Criptografa a senha com 10 "saltos"
            const password_hash = await bcrypt.hash(password, 10);

            // Chama o Model para salvar
            const userId = await DoadorModel.create(
                { email, password_hash },
                { nome, sobrenome, apelido_unico, cpf, avatar_url, bio, cadunico_file }
            );

            return res.status(201).json({ message: "Doador cadastrado com sucesso!", userId });
            
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao cadastrar doador." });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;

            // Busca usuário
            const user = await DoadorModel.findByEmail(email);
            if (!user) {
                return res.status(401).json({ error: "Credenciais inválidas." });
            }

            // Compara a senha digitada com o hash do banco
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                return res.status(401).json({ error: "Credenciais inválidas." });
            }

            const secret = process.env.JWT_SECRET;
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    userType: user.user_type,
                    nome: user.nome 
                }, 
                secret, 
                { expiresIn: '7d' } // A sessão dura 7 dias sem precisar logar de novo
            );

            // Retorna o token para o frontend guardar
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
            console.error(error);
            return res.status(500).json({ error: "Erro ao realizar login." });
        }
    }
}

export default AuthController;