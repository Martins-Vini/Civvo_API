import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AdminModel } from '../models/adminModel.js';

export class AdminController {
    static async entrarAdmin(req, res) {
        try {
            const { email, password } = req.body;

            const admin = await AdminModel.buscarPorEmail(email);
            if (!admin) {
                return res.status(401).json({ error: "Credenciais administrativas inválidas." });
            }

            const senhaValida = await bcrypt.compare(password, admin.password_hash);
            if (!senhaValida) {
                return res.status(401).json({ error: "Credenciais administrativas inválidas." });
            }

            const secret = process.env.JWT_SECRET || 'chave_secreta_temporaria';
            const token = jwt.sign(
                { 
                    userId: admin.id, 
                    adminProfileId: admin.admin_profile_id,
                    userType: admin.user_type,
                    roleLevel: admin.role_level,
                    cargo: admin.cargo
                }, 
                secret, 
                { expiresIn: '8h' } // Sessão administrativa expira mais rápido por segurança
            );

            return res.status(200).json({
                message: "Login administrativo realizado com sucesso!",
                token,
                admin: {
                    id: admin.id,
                    nomeCompleto: admin.nome_completo,
                    cargo: admin.cargo,
                    roleLevel: admin.role_level
                }
            });

        } catch (error) {
            console.error("Erro no login admin:", error);
            return res.status(500).json({ error: "Erro interno no servidor." });
        }
    }

    static async cadastrarNovoAdmin(req, res) {
        try {
            // Apenas SUPER_ADMIN pode executar esta função (garantido pelo middleware)
            const { email, password, nome_completo, cargo, role_level } = req.body;

            const adminExistente = await AdminModel.buscarPorEmail(email);
            if (adminExistente) {
                return res.status(400).json({ error: "Já existe um administrador cadastrado com este e-mail." });
            }

            const password_hash = await bcrypt.hash(password, 10);

            const userId = await AdminModel.criarNovoAdmin(
                { email, password_hash },
                { nome_completo, cargo, role_level }
            );

            return res.status(201).json({
                message: "Novo administrador cadastrado com sucesso pelo Super Admin!",
                userId,
                roleLevel: role_level
            });

        } catch (error) {
            console.error("Erro ao cadastrar novo admin:", error);
            return res.status(500).json({ error: "Erro ao registrar novo administrador." });
        }
    }
}