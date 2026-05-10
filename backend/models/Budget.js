import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true },
  limit: { type: Number, required: true },
  theme: { type: String, default: '' },
  // Highest threshold bucket currently owned for the active month (0/50/90/100).
  // Drops back to 0 when the calendar month rolls over (re-fires next time spending crosses 50%).
  monthlyMilestoneTier: { type: Number, default: 0, enum: [0, 50, 90, 100] },
  monthlyMilestonePeriod: { type: String, default: '' }, // 'YYYY-MM' the tier was set in
  // Last calendar date a "you spent >=20% of your monthly budget in a single day" alert was sent.
  // ISO yyyy-mm-dd string; prevents repeat spam within the same day.
  dailyAlertDate: { type: String, default: '' },
  createdAt: { type: Number, default: () => Date.now() },
});

export default mongoose.model('Budget', budgetSchema);
