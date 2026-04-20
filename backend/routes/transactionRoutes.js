import express from 'express';
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from '../controllers/transactionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/', getTransactions);
router.post('/', createTransaction);
router.delete('/:id', deleteTransaction);
router.put('/:id', updateTransaction);

export default router;
