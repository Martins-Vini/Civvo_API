import jwt from 'jsonwebtoken';

export function verificarAutenticacaoOng(req, res, next) {
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

    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Token inválido ou expirado." });
        }

        if (decoded.userType !== 'ONG') {
            return res.status(403).json({ error: "Acesso negado. Apenas perfis de ONG podem acessar este recurso." });
        }

        req.userId = decoded.userId;
        req.ongProfileId = decoded.ongProfileId;
        req.userType = decoded.userType;
        return next();
    });
}