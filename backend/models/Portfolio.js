import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  assetType: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'JPY', 'GOLD_GRAM', 'GOLD_QUARTER', 'GOLD_OUNCE'],
  },
  transactionType: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL'],
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  pricePerUnit: {
    type: Number,
    required: true,
    min: 0,
  },
  totalCost: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: () => new Date(),
    required: true,
  },
}, {
  timestamps: true, // adds createdAt & updatedAt
});

// Compound index for faster user+asset queries
portfolioSchema.index({ userId: 1, assetType: 1 });

// Virtual for formatted date
portfolioSchema.virtual('formattedDate').get(function () {
  return this.timestamp.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});

export default mongoose.model('Portfolio', portfolioSchema);
