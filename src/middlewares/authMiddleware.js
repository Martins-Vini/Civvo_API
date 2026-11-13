import jwt from 'jsonwebtoken';
import { pool } from '../config/conexao.js';

export async function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Token de autenticação não fornecido." });
    }

    const token = authHeader.split(' ')[1];

    try {
        const secret = process.env.JWT_SECRET || 'chave_secreta_temporaria';
        const decoded = jwt.verify(token, secret);

        const userId = decoded.userId || decoded.id;
        const [rows] = await pool.query('SELECT id, is_active FROM USERS WHERE id = ?', [userId]);

        if (rows.length === 0 || !rows[0].is_active) {
            return res.status(401).json({ error: "Conta desativada ou inexistente." });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }
}

export async function somenteOngs(req, res, next) {
    if (req.user.userType !== 'ONG') {
        return res.status(403).json({ error: "Acesso negado. Apenas ONGs podem realizar esta ação." });
    }

    try {
        const [rows] = await pool.query(`SELECT id FROM ONGS_PROFILES WHERE user_id = ?`, [req.user.userId || req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Perfil de ONG não encontrado." });
        }
        req.ongId = rows[0].id;
        next();
    } catch (error) {
        console.error("Erro ao validar ONG:", error);
        return res.status(500).json({ error: "Erro interno ao validar perfil da ONG." });
    }
}