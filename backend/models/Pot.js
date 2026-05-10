import mongoose from 'mongoose';

const potSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  target: { type: Number, required: true },
  saved: { type: Number, default: 0 },
  theme: { type: String, default: '' },
  // Tracks the highest milestone bucket currently "owned" by the pot (0/50/90/100).
  // When ratio drops below this tier, we decrement so it can re-fire on the next climb.
  milestoneTier: { type: Number, default: 0, enum: [0, 50, 90, 100] },
  createdAt: { type: Number, default: () => Date.now() },
});

export default mongoose.model('Pot', potSchema);
