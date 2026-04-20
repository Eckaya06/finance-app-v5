import mongoose from 'mongoose';

const potSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  target: { type: Number, required: true },
  saved: { type: Number, default: 0 },
  theme: { type: String, default: '' },
  createdAt: { type: Number, default: () => Date.now() },
});

export default mongoose.model('Pot', potSchema);
