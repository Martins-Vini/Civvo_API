import { Router } from 'express';
import DonorController from '../controllers/donorController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';
import { pool } from '../config/conexao.js'; // 1. Importação correta do pool

const router = Router();

router.put('/profile', verificarToken, DonorController.atualizarPerfil);

router.delete('/account', verificarToken, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id; // 2. Correção para pegar o ID correto do token
        if (!userId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        await pool.query('UPDATE USERS SET is_active = FALSE WHERE id = ?', [userId]);
        return res.status(200).json({ message: 'Conta de doador desativada com sucesso.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;