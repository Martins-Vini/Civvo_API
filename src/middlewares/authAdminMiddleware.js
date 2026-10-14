import jwt from 'jsonwebtoken';

export function verificarAdmin(rolesPermitidas = []) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: "Token de acesso administrativo não fornecido." });
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2) {
            return res.status(401).json({ error: "Erro no formato do token." });
        }

        const [scheme, token] = parts;
        if (!/^Bearer$/i.test(scheme)) {
            return res.status(401).json({ error: "Token mal formatado." });
        }

        const secret = process.env.JWT_SECRET || 'chave_secreta_temporaria';

        jwt.verify(token, secret, (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: "Token administrativo inválido ou expirado." });
            }

            if (decoded.userType !== 'ADMIN') {
                return res.status(403).json({ error: "Acesso negado. Recurso exclusivo para administradores." });
            }

            // Valida se o cargo do admin possui a permissão exigida (RBAC)
            if (rolesPermitidas.length > 0 && !rolesPermitidas.includes(decoded.roleLevel)) {
                return res.status(403).json({ 
                    error: `Acesso negado. Seu nível (${decoded.roleLevel}) não tem permissão para esta operação.` 
                });
            }

            req.userId = decoded.userId;
            req.adminProfileId = decoded.adminProfileId;
            req.roleLevel = decoded.roleLevel;
            
            return next();
        });
    };
}