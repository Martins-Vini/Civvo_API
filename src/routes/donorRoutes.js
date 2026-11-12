import { Router } from 'express';
import DonorController from '../controllers/donorController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.put('/profile', verificarToken, DonorController.atualizarPerfil);
router.delete('/account', verificarToken, async (req, res) => {
    try {
        const userId = req.user.id; // ID extraído do token JWT
        await pool.query('UPDATE USERS SET is_active = FALSE WHERE id = ?', [userId]);
        return res.status(200).json({ message: 'Conta de doador desativada com sucesso.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;