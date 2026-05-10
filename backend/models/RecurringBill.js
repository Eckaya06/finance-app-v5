import mongoose from 'mongoose';

const recurringBillSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  category: { type: String, default: 'General' },
  amount: { type: Number, required: true },
  dueDay: { type: Number, required: true, min: 1, max: 31 },
  frequency: { type: String, enum: ['monthly', 'weekly', 'yearly'], default: 'monthly' },
  isPaid: { type: Boolean, default: false },
  paidAt: { type: Date, default: null },
  theme: { type: String, default: '#636ae8' },
  // ISO yyyy-mm-dd of the due date the last reminder was sent for.
  // Lets the cron run safely multiple times per day without duplicate emails.
  lastRemindedFor: { type: String, default: '' },
  createdAt: { type: Number, default: () => Date.now() },
});

export default mongoose.model('RecurringBill', recurringBillSchema);
