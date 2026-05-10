import RecurringBill from '../models/RecurringBill.js';
import { autoResetExpiredBills } from '../services/billCycleService.js';
import { processBillReminder } from '../services/notificationService.js';

// Fire-and-forget — bill mutations should never block on email I/O.
const fireAndForget = (promise) =>
  Promise.resolve(promise).catch((err) => console.error('[bill notify]', err));

// Tüm tekrar eden faturaları getir
export const getBills = async (req, res) => {
  try {
    // Lazy auto-reset: any bill whose paid cycle has rolled over flips back to
    // unpaid before we serve the list, so the UI sees the correct state.
    await autoResetExpiredBills({ userId: req.user.uid });

    const bills = await RecurringBill.find({ userId: req.user.uid }).sort({ dueDay: 1 }).lean();
    res.json(bills.map((bill) => ({ ...bill, id: bill._id.toString() })));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bills', error: err.message });
  }
};

// Yeni fatura oluştur
export const createBill = async (req, res) => {
  try {
    const { name, category, amount, dueDay, frequency, theme } = req.body;

    if (!name || !amount || !dueDay) {
      return res.status(400).json({ message: 'Name, amount and due day are required.' });
    }

    const bill = await RecurringBill.create({
      userId: req.user.uid,
      name,
      category: category || 'General',
      amount: Number(amount),
      dueDay: Number(dueDay),
      frequency: frequency || 'monthly',
      theme: theme || '#636ae8',
      isPaid: false,
      paidAt: null,
      createdAt: Date.now(),
    });

    // If the just-added bill already falls in the 0-1 day window, send the
    // reminder immediately instead of waiting for tomorrow's 09:00 cron.
    fireAndForget(processBillReminder(bill));

    res.status(201).json({ ...bill.toObject(), id: bill._id.toString() });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create bill', error: err.message });
  }
};

// Faturayı güncelle
export const updateBill = async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.amount !== undefined) update.amount = Number(update.amount);
    if (update.dueDay !== undefined) update.dueDay = Number(update.dueDay);

    const bill = await RecurringBill.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      update,
      { new: true }
    ).lean();

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    // dueDay or frequency changes can pull the bill into the 0-1 day window;
    // dedup via lastRemindedFor prevents repeat mails for the same due date.
    fireAndForget(processBillReminder(bill));

    res.json({ ...bill, id: bill._id.toString() });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update bill', error: err.message });
  }
};

// Faturayı ödendi olarak işaretle
export const markBillPaid = async (req, res) => {
  try {
    const bill = await RecurringBill.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { isPaid: true, paidAt: new Date() },
      { new: true }
    ).lean();

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    res.json({ ...bill, id: bill._id.toString() });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark bill as paid', error: err.message });
  }
};

// Faturayı ödenmemiş olarak işaretle
export const markBillUnpaid = async (req, res) => {
  try {
    const bill = await RecurringBill.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { isPaid: false, paidAt: null },
      { new: true }
    ).lean();

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    res.json({ ...bill, id: bill._id.toString() });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark bill as unpaid', error: err.message });
  }
};

// Faturayı sil
export const deleteBill = async (req, res) => {
  try {
    await RecurringBill.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
    res.json({ message: 'Bill deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete bill', error: err.message });
  }
};

// Tüm faturaları aylık sıfırla (her ay başında çalıştırılabilir)
export const resetMonthlyBills = async (req, res) => {
  try {
    await RecurringBill.updateMany(
      { userId: req.user.uid, frequency: 'monthly' },
      { isPaid: false, paidAt: null }
    );
    res.json({ message: 'Monthly bills reset' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset bills', error: err.message });
  }
};
