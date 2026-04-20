import Transaction from '../models/Transaction.js';

const formatTransaction = (tx) => {
  const date = tx.date ? new Date(tx.date) : new Date();
  const formattedDate = date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return {
    ...tx,
    id: tx._id.toString(),
    date: formattedDate,
  };
};

export const getTransactions = async (req, res) => {
  const transactions = await Transaction.find({ userId: req.user.uid }).sort({ date: -1 }).lean();
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

  res.status(201).json(formatTransaction(transaction.toObject()));
};

export const deleteTransaction = async (req, res) => {
  await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
  res.json({ message: 'Transaction deleted' });
};

export const updateTransaction = async (req, res) => {
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

  res.json(formatTransaction(transaction));
};
