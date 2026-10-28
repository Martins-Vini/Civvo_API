import jwt from 'jsonwebtoken';
import { pool } from '../config/conexao.js';

// Verifica se o usuário possui um token JWT válido
export async function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Token de autenticação não fornecido." });
    }

    const token = authHeader.split(' ')[1];

    try {
        const secret = process.env.JWT_SECRET || 'chave_secreta_temporaria';
        const decoded = jwt.verify(token, secret);
        req.user = decoded; // { userId, userType, nome }
        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }
}

// Restringe a rota apenas para perfis do tipo 'ONG' e injeta o ong_id correto
export async function somenteOngs(req, res, next) {
    if (req.user.userType !== 'ONG') {
        return res.status(403).json({ error: "Acesso negado. Apenas ONGs podem realizar esta ação." });
    }

    try {
        const [rows] = await pool.query(
            `SELECT id FROM ONGS_PROFILES WHERE user_id = ?`, 
            [req.user.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Perfil de ONG não encontrado para este usuário." });
        }

        req.ongId = rows[0].id; // ID da tabela ONGS_PROFILES
        next();
    } catch (error) {
        console.error("Erro ao validar ONG:", error);
        return res.status(500).json({ error: "Erro interno ao validar perfil da ONG." });
    }
}