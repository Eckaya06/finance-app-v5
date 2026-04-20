import express from 'express';
import { getPots, createPot, deletePot, updatePot } from '../controllers/potController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/', getPots);
router.post('/', createPot);
router.delete('/:id', deletePot);
router.put('/:id', updatePot);

export default router;
