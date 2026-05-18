import Pot from '../models/Pot.js';
import { checkPotMilestone } from '../services/notificationService.js';

// Fire-and-forget: the HTTP response should not wait for email delivery.
const fireAndForget = (promise) => {
  Promise.resolve(promise).catch((err) => console.error('[pot notify]', err));
};

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

  fireAndForget(checkPotMilestone(pot));

  res.status(201).json({ ...pot.toObject(), id: pot._id.toString() });
};

export const deletePot = async (req, res) => {
  // Silmeden önce potu çek — içinde para varsa veya hedef tamamlanmışsa
  // silinmesini engelle (kazara veri kaybını önler; AI agent için de
  // savunma katmanı). Frontend de aynı kontrolü yapar ama backend hâlâ
  // tek otorite olmalı (defense in depth).
  const pot = await Pot.findOne({ _id: req.params.id, userId: req.user.uid });
  if (!pot) {
    return res.status(404).json({ message: 'Pot not found.' });
  }

  const saved = Number(pot.saved || 0);
  const target = Number(pot.target || 0);

  if (target > 0 && saved >= target) {
    return res.status(400).json({
      // 'code' alanı frontend'in dile özel mesaj seçmesi için.
      code: 'POT_COMPLETED',
      message: `Cannot delete "${pot.name}": this pot has been completed. Withdraw the funds first.`,
    });
  }
  if (saved > 0) {
    return res.status(400).json({
      code: 'POT_HAS_FUNDS',
      message: `Cannot delete "${pot.name}": it still holds ${saved} TL. Withdraw the funds first.`,
    });
  }

  await Pot.deleteOne({ _id: pot._id });
  res.json({ message: 'Pot deleted' });
};

export const updatePot = async (req, res) => {
  const update = { ...req.body };
  if (update.target !== undefined) update.target = Number(update.target);
  if (update.saved !== undefined) update.saved = Number(update.saved);

  // WITHDRAW guard: tamamlanmış (saved >= target) bir pottan para çekmeye
  // (yani saved'i azaltmaya) izin verme. Hedefe ulaşmış bir potu bozmamalı.
  // Bu kontrol DELETE guard'ı ile birlikte savunma katmanını tamamlar.
  // Frontend (PotsPage withdraw modal + AI agent) de aynı kontrolü yapar
  // ama burası tek otorite olarak son sözü söyler (curl/Postman dâhil).
  if (update.saved !== undefined) {
    const existing = await Pot.findOne({ _id: req.params.id, userId: req.user.uid });
    if (existing) {
      const oldSaved = Number(existing.saved || 0);
      const oldTarget = Number(existing.target || 0);
      const isWithdraw = Number(update.saved) < oldSaved;
      const wasCompleted = oldTarget > 0 && oldSaved >= oldTarget;
      if (isWithdraw && wasCompleted) {
        return res.status(400).json({
          code: 'POT_WITHDRAW_BLOCKED_COMPLETED',
          message: `Cannot withdraw from "${existing.name}": this pot is already completed. ` +
                   `Edit the target or delete the pot if you really want the funds out.`,
        });
      }
    }
  }

  const pot = await Pot.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.uid },
    update,
    { new: true }
  );

  if (!pot) {
    return res.status(404).json({ message: 'Pot not found.' });
  }

  fireAndForget(checkPotMilestone(pot));

  const obj = pot.toObject();
  res.json({ ...obj, id: pot._id.toString() });
};
