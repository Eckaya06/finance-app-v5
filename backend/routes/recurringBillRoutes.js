import express from 'express';
import {
  getBills,
  createBill,
  updateBill,
  deleteBill,
  markBillPaid,
  markBillUnpaid,
  resetMonthlyBills,
} from '../controllers/recurringBillController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.get('/', getBills);
router.post('/', createBill);
router.put('/:id', updateBill);
router.delete('/:id', deleteBill);
router.patch('/:id/pay', markBillPaid);
router.patch('/:id/unpay', markBillUnpaid);
router.post('/reset', resetMonthlyBills);

export default router;
