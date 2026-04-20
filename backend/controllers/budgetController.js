import Budget from '../models/Budget.js';

export const getBudgets = async (req, res) => {
  const budgets = await Budget.find({ userId: req.user.uid }).sort({ createdAt: -1 }).lean();
  res.json(budgets.map((budget) => ({
    ...budget,
    id: budget._id.toString(),
  })));
};

export const createBudget = async (req, res) => {
  const { category, limit, maxSpend, theme } = req.body;
  const budgetLimit = Number(limit ?? maxSpend ?? 0);
  if (!category || budgetLimit <= 0) {
    return res.status(400).json({ message: 'Category and limit are required.' });
  }

  const budget = await Budget.create({
    userId: req.user.uid,
    category,
    limit: budgetLimit,
    theme: theme || '',
    createdAt: Date.now(),
  });

  res.status(201).json({ ...budget.toObject(), id: budget._id.toString() });
};

export const deleteBudget = async (req, res) => {
  await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
  res.json({ message: 'Budget deleted' });
};

export const updateBudget = async (req, res) => {
  const update = { ...req.body };
  if (update.limit !== undefined) update.limit = Number(update.limit);
  if (update.maxSpend !== undefined) update.limit = Number(update.maxSpend);

  const budget = await Budget.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.uid },
    update,
    { new: true }
  ).lean();

  if (!budget) {
    return res.status(404).json({ message: 'Budget not found.' });
  }

  res.json({ ...budget, id: budget._id.toString() });
};
