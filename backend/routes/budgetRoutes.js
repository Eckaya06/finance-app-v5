import express from 'express';
import { getBudgets, createBudget, deleteBudget, updateBudget } from '../controllers/budgetController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/', getBudgets);
router.post('/', createBudget);
router.delete('/:id', deleteBudget);
router.put('/:id', updateBudget);

export default router;
