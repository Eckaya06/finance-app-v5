import Pot from '../models/Pot.js';

export const getPots = async (req, res) => {
  const pots = await Pot.find({ userId: req.user.uid }).sort({ createdAt: -1 }).lean();
  res.json(pots.map((pot) => ({ ...pot, id: pot._id.toString() })));
};

export const createPot = async (req, res) => {
  const { name, target, theme, saved } = req.body;
  const targetAmount = Number(target ?? 0);
  if (!name || targetAmount <= 0) {
    return res.status(400).json({ message: 'Name and target are required.' });
  }

  const pot = await Pot.create({
    userId: req.user.uid,
    name,
    target: targetAmount,
    saved: Number(saved ?? 0),
    theme: theme || '',
    createdAt: Date.now(),
  });

  res.status(201).json({ ...pot.toObject(), id: pot._id.toString() });
};

export const deletePot = async (req, res) => {
  await Pot.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
  res.json({ message: 'Pot deleted' });
};

export const updatePot = async (req, res) => {
  const update = { ...req.body };
  if (update.target !== undefined) update.target = Number(update.target);
  if (update.saved !== undefined) update.saved = Number(update.saved);

  const pot = await Pot.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.uid },
    update,
    { new: true }
  ).lean();

  if (!pot) {
    return res.status(404).json({ message: 'Pot not found.' });
  }

  res.json({ ...pot, id: pot._id.toString() });
};
