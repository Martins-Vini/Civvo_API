import jwt from 'jsonwebtoken';
import { pool } from '../config/conexao.js';

export async function verificarAutenticacaoOng(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Token de autenticação não fornecido." });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
        return res.status(401).json({ error: "Erro no formato do token." });
    }

    const [scheme, token] = parts;
    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ error: "Token mal formatado." });
    }

    const secret = process.env.JWT_SECRET;

    jwt.verify(token, secret, async (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Token inválido ou expirado." });
        }

        if (decoded.userType !== 'ONG') {
            return res.status(403).json({ error: "Acesso negado. Apenas perfis de ONG podem acessar este recurso." });
        }

        try {
            const userId = decoded.userId || decoded.id;
            const [rows] = await pool.query('SELECT id, is_active FROM USERS WHERE id = ?', [userId]);

            if (rows.length === 0 || !rows[0].is_active) {
                return res.status(401).json({ error: "Esta conta de ONG foi desativada." });
            }

            req.userId = userId;
            req.ongProfileId = decoded.ongProfileId;
            req.userType = decoded.userType;
            return next();
        } catch (dbError) {
            console.error("Erro ao validar status da ONG:", dbError);
            return res.status(500).json({ error: "Erro interno na autenticação." });
        }
    });
}