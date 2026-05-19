import express from 'express';
import { adminProtect } from '../middleware/adminMiddleware.js';
import {
  probeDb,
  probeAuth,
  probeMailVerify,
  probeMailSend,
  probeAi,
  probeMarket,
  probeMarketV3Deep,
  probeMarketApi,
  probeCrudTransactions,
  probeCrudBudgets,
  probeBudgetDelete,
  probeCrudPots,
  probePotDeleteGuards,
  probePotWithdrawGuards,
  probeCrudBills,
  probeBillMarkPaid,
  probeCrudPortfolio,
  probeCrudPortfolioTxDelete,
  probeNotifyPot,
  probeNotifyBudget,
  probeNotifyBill,
  probeCleanup,
  probeEnv,
} from '../controllers/diagnosticsController.js';

const router = express.Router();

// Admin-only — same protection as /api/admin/*
router.use(adminProtect);

router.get('/env', probeEnv);

router.get('/db', probeDb);
router.get('/auth', probeAuth);

router.get('/mail/verify', probeMailVerify);
router.post('/mail/send', probeMailSend);

router.get('/ai', probeAi);
router.get('/market', probeMarket);
router.get('/market/v3-deep', probeMarketV3Deep);
router.get('/market/api', probeMarketApi);

router.get('/crud/transactions', probeCrudTransactions);
router.get('/crud/budgets', probeCrudBudgets);
router.get('/crud/budget-delete', probeBudgetDelete);
router.get('/crud/pots', probeCrudPots);
router.get('/crud/pot-delete-guards', probePotDeleteGuards);
router.get('/crud/pot-withdraw-guards', probePotWithdrawGuards);
router.get('/crud/bills', probeCrudBills);
router.get('/crud/bill-mark-paid', probeBillMarkPaid);
router.get('/crud/portfolio', probeCrudPortfolio);
router.get('/crud/portfolio-tx-delete', probeCrudPortfolioTxDelete);

router.get('/notify/pot', probeNotifyPot);
router.get('/notify/budget', probeNotifyBudget);
router.get('/notify/bill', probeNotifyBill);

router.post('/cleanup', probeCleanup);

export default router;
