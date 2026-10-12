import express from 'express';
import { OngAuthController } from '../controllers/ongController.js';
import { verificarAutenticacaoOng } from '../middlewares/authOngMiddleware.js';

const router = express.Router();

router.post('/register/ong', OngAuthController.cadastrarOng);
router.post('/login/ong', OngAuthController.entrarOng);

// Exemplo de rota protegida que requer a sessão JWT da ONG ativa
router.get('/perfil', verificarAutenticacaoOng, (req, res) => {
    return res.status(200).json({ 
        message: "Acesso autorizado à área restrita da ONG!", 
        userId: req.userId, 
        ongProfileId: req.ongProfileId 
    });
});

export default router;