import { Router } from 'express';
import { SearchController } from '../controllers/searchController.js';
import { verificarToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', verificarToken, SearchController.buscar);

export default router;
