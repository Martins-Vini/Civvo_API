import AdminModel from '../models/adminModel.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

class AdminController {
    static async cadastrar(req, res) {
        try {
            const novoAdmin = await AdminModel.cadastrar(req.body);
            return res.status(201).json({ message: "Administrador cadastrado com sucesso!", admin: novoAdmin });
        } catch (error) {
            console.error("Erro ao cadastrar admin:", error);
            return res.status(500).json({ error: error.message || "Erro ao cadastrar administrador." });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body || {};

            if (!email || !password) {
                return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
            }

            const admin = await AdminModel.buscarPorEmail(email);

            if (!admin) {
                return res.status(401).json({ error: "Credenciais inválidas." });
            }

            const senhaValida = await bcrypt.compare(password, admin.password_hash);

            if (!senhaValida) {
                return res.status(401).json({ error: "Credenciais inválidas." });
            }

            const secret = process.env.JWT_SECRET || 'chave_secreta_temporaria';
            const token = jwt.sign(
                { id: admin.id, userId: admin.id, userType: admin.user_type, role_level: admin.role_level },
                secret,
                { expiresIn: '24h' }
            );

            return res.status(200).json({
                message: "Login realizado com sucesso!",
                token,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    nome_completo: admin.nome_completo,
                    role_level: admin.role_level
                }
            });
        } catch (error) {
            console.error("Erro no login do admin:", error);
            return res.status(500).json({ error: "Erro ao realizar login." });
        }
    }

    static async listarDenuncias(req, res) {
        try {
            const denuncias = await AdminModel.listarDenuncias();
            return res.status(200).json(denuncias);
        } catch (error) {
            console.error("Erro ao listar denúncias:", error);
            return res.status(500).json({ error: "Erro ao listar denúncias." });
        }
    }

    static async atualizarDenuncia(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const atualizado = await AdminModel.atualizarStatusDenuncia(id, status);

            if (!atualizado) {
                return res.status(404).json({ error: "Denúncia não encontrada." });
            }

            return res.status(200).json({ message: "Status da denúncia atualizado com sucesso!" });
        } catch (error) {
            console.error("Erro ao atualizar denúncia:", error);
            return res.status(500).json({ error: "Erro ao atualizar denúncia." });
        }
    }
}

export default AdminController;