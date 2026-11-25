import { Router } from 'express';
import DonationController from '../controllers/donationController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';
import { limitarRequisicoes } from '../middlewares/rateLimitMiddleware.js';

const router = Router();

/* públicas (quem chama é o gateway / o redirecionamento do cartão) */
router.post('/webhook', DonationController.webhook);
router.get('/retorno/:id', DonationController.retorno);

/* do doador logado. ATENÇÃO À ORDEM: "/minhas" tem que vir antes de "/:id" */
router.post('/', verificarToken, limitarRequisicoes({ janelaMs: 60_000, max: 10 }), DonationController.realizarDoacao);
router.get('/minhas', verificarToken, DonationController.minhasDoacoes);
router.post('/:id/simular-pagamento', verificarToken, DonationController.simularPagamento);
router.get('/:id', verificarToken, DonationController.buscarDoacao);

export default router;
