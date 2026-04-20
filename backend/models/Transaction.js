import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: '' },
  category: { type: String, default: '' },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  createdAt: { type: Number, default: () => Date.now() },
});

export default mongoose.model('Transaction', transactionSchema);
