import express from 'express';
import { getLiveRates } from '../controllers/marketController.js';

const router = express.Router();

// Public route — no auth needed for market data
router.get('/rates', getLiveRates);

export default router;
