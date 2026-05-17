import express from 'express';
import {
  buyAsset,
  sellAsset,
  getPortfolioSummary,
  getTransactionHistory,
  deleteAsset,
  updateAsset,
  deletePortfolioTransaction
} from '../controllers/portfolioController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All portfolio routes require authentication
router.use(protect);

router.post('/buy', buyAsset);
router.post('/sell', sellAsset);
router.get('/summary', getPortfolioSummary);
router.get('/history', getTransactionHistory);

router.delete('/asset/:assetType', deleteAsset);
router.put('/asset/:assetType', updateAsset);
router.delete('/transaction/:txId', deletePortfolioTransaction);

export default router;
