import Transaction from '../models/Transaction.js';
import { checkBudgetForCategory } from '../services/notificationService.js';

const formatTransaction = (tx) => {
  const date = tx.date ? new Date(tx.date) : new Date();
  return {
    ...tx,
    id: tx._id.toString(),
    date: date.toISOString(),
  };
};

// Recompute notifications for a category off the response path.
const fireBudgetCheck = (userId, ...categories) => {
  const unique = [...new Set(categories.filter(Boolean))];
  for (const cat of unique) {
    checkBudgetForCategory(userId, cat).catch((err) =>
      console.error('[budget notify]', err)
    );
  }
};

export const getTransactions = async (req, res) => {
  const transactions = await Transaction.find({ userId: req.user.uid }).sort({ createdAt: -1 }).lean();
  res.json(transactions.map(formatTransaction));
};

export const createTransaction = async (req, res) => {
  const { name, category, type, amount, date } = req.body;
  if (!type || typeof amount === 'undefined') {
    return res.status(400).json({ message: 'Transaction type and amount are required.' });
  }

  const transaction = await Transaction.create({
    userId: req.user.uid,
    name: name || '',
    category: category || '',
    type,
    amount: Number(amount),
    date: date ? new Date(date) : new Date(),
    createdAt: Date.now(),
  });

  if (type === 'expense' && category) {
    fireBudgetCheck(req.user.uid, category);
  }

  res.status(201).json(formatTransaction(transaction.toObject()));
};

export const deleteTransaction = async (req, res) => {
  const deleted = await Transaction.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.uid,
  }).lean();

  // Recompute the budget tier so it can drop back down (and re-fire on a future climb).
  if (deleted?.type === 'expense' && deleted.category) {
    fireBudgetCheck(req.user.uid, deleted.category);
  }

  res.json({ message: 'Transaction deleted' });
};

export const updateTransaction = async (req, res) => {
  // Read the previous category before updating so we can recompute both buckets
  // when a transaction's category changes (e.g., Dining Out → Groceries).
  const previous = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user.uid,
  })
    .select('category type')
    .lean();

  const update = { ...req.body };
  if (update.amount !== undefined) update.amount = Number(update.amount);
  if (update.date) update.date = new Date(update.date);

  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.uid },
    update,
    { new: true }
  ).lean();

  if (!transaction) {
    return res.status(404).json({ message: 'Transaction not found.' });
  }

  if (transaction.type === 'expense' || previous?.type === 'expense') {
    fireBudgetCheck(req.user.uid, previous?.category, transaction.category);
  }

  res.json(formatTransaction(transaction));
};
