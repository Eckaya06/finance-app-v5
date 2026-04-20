import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true },
  limit: { type: Number, required: true },
  theme: { type: String, default: '' },
  createdAt: { type: Number, default: () => Date.now() },
});

export default mongoose.model('Budget', budgetSchema);
