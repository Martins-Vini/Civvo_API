import express from 'express';
import { OngAuthController } from '../controllers/ongController.js';
import { verificarAutenticacaoOng } from '../middlewares/authOngMiddleware.js';
import { verificarToken } from '../middlewares/authMiddleware.js';
import { pool } from '../config/conexao.js'; // 1. Importação correta do pool

const router = express.Router();

router.post('/register/ong', OngAuthController.cadastrarOng);
router.post('/login/ong', OngAuthController.entrarOng);

router.get('/perfil', verificarAutenticacaoOng, (req, res) => {
    return res.status(200).json({ 
        message: "Acesso autorizado à área restrita da ONG!", 
        userId: req.userId, 
        ongProfileId: req.ongProfileId 
    });
});

router.delete('/account', verificarToken, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id; // 2. Correção para pegar o ID correto do token
        if (!userId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        await pool.query('UPDATE USERS SET is_active = FALSE WHERE id = ?', [userId]);
        return res.status(200).json({ message: 'Conta da ONG desativada com sucesso.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;