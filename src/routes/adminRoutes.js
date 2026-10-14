import express from 'express';
import { AdminController } from '../controllers/adminController.js';
import { verificarAdmin } from '../middlewares/authAdminMiddleware.js';

const router = express.Router();

// Rota pública de login administrativo
router.post('/login', AdminController.entrarAdmin);

// Rota protegida: Apenas SUPER_ADMIN pode criar novos admins na plataforma
router.post('/register', verificarAdmin(['SUPER ADMIN']), AdminController.cadastrarNovoAdmin);

// Exemplo de rota restrita para análise de Compliance e Super Admin
router.get('/dashboard-privado', verificarAdmin(['SUPER ADMIN', 'COMPLIANCE']), (req, res) => {
    return res.status(200).json({
        message: "Bem-vindo ao painel restrito de conformidade e auditoria da Civvo!",
        adminId: req.userId,
        nivel: req.roleLevel
    });
});

export default router;