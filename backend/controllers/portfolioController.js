import mongoose from 'mongoose';
import Portfolio from '../models/Portfolio.js';

// ─── Helper: get current live rate for an asset ───
let _rateCache = null;
let _rateCacheTime = 0;

const getLiveRate = async (assetType) => {
  const now = Date.now();
  if (!_rateCache || (now - _rateCacheTime) > 60_000) {
    try {
      const resp = await fetch('https://finans.truncgil.com/v3/today.json');
      if (resp.ok) {
        const data = await resp.json();
        
        const parseNum = (str) => {
          if (!str) return 0;
          return parseFloat(String(str).replace('$', '').replace('%', '').replace(/\./g, '').replace(',', '.'));
        };

        const tryPerUsd = parseNum(data['USD']?.Selling) || 45.00;
        const onsUsd = parseNum(data['ons']?.Selling) || 3300;

        _rateCache = {
          USD: parseNum(data['USD']?.Selling) || tryPerUsd,
          EUR: parseNum(data['EUR']?.Selling),
          GBP: parseNum(data['GBP']?.Selling),
          JPY: parseNum(data['JPY']?.Selling),
          CHF: parseNum(data['CHF']?.Selling),
          CAD: parseNum(data['CAD']?.Selling),
          GOLD_GRAM: parseNum(data['gram-altin']?.Selling),
          GOLD_QUARTER: parseNum(data['ceyrek-altin']?.Selling),
          GOLD_OUNCE: onsUsd * tryPerUsd,
        };
        _rateCacheTime = now;
      }
    } catch (err) {
      console.error('Failed to fetch live rates for portfolio:', err);
    }
  }
  return _rateCache?.[assetType] || 0;
};

// ─── POST /api/portfolio/buy ───
export const buyAsset = async (req, res) => {
  try {
    const { assetType, amount, pricePerUnit } = req.body;

    if (!assetType || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Asset type and a positive amount are required.' });
    }

    const price = pricePerUnit || await getLiveRate(assetType);
    const totalCost = +(amount * price).toFixed(4);

    const transaction = await Portfolio.create({
      userId: req.user.uid,
      assetType,
      transactionType: 'BUY',
      amount: Number(amount),
      pricePerUnit: price,
      totalCost,
      timestamp: new Date(),
    });

    res.status(201).json({
      message: `Successfully bought ${amount} ${assetType}`,
      transaction: transaction.toObject(),
    });
  } catch (error) {
    console.error('Buy error:', error);
    res.status(500).json({ message: 'Failed to process buy transaction' });
  }
};

// ─── POST /api/portfolio/sell ───
export const sellAsset = async (req, res) => {
  try {
    const { assetType, amount, pricePerUnit } = req.body;

    if (!assetType || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Asset type and a positive amount are required.' });
    }

    // Calculate current holdings to prevent overselling
    const holdings = await Portfolio.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.uid), assetType } },
      {
        $group: {
          _id: null,
          totalBought: {
            $sum: {
              $cond: [{ $eq: ['$transactionType', 'BUY'] }, '$amount', 0],
            },
          },
          totalSold: {
            $sum: {
              $cond: [{ $eq: ['$transactionType', 'SELL'] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    const currentHolding = holdings.length > 0
      ? holdings[0].totalBought - holdings[0].totalSold
      : 0;

    if (amount > currentHolding) {
      return res.status(400).json({
        message: `Insufficient holdings. You have ${currentHolding} ${assetType}.`,
      });
    }

    const price = pricePerUnit || await getLiveRate(assetType);
    const totalCost = +(amount * price).toFixed(4);

    // Calculate average buy price for PnL
    const buyTransactions = await Portfolio.find({
      userId: req.user.uid,
      assetType,
      transactionType: 'BUY',
    }).lean();

    const totalBuyAmount = buyTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalBuyCost = buyTransactions.reduce((sum, tx) => sum + tx.totalCost, 0);
    const avgBuyPrice = totalBuyAmount > 0 ? totalBuyCost / totalBuyAmount : 0;
    const pnl = +((price - avgBuyPrice) * amount).toFixed(4);

    const transaction = await Portfolio.create({
      userId: req.user.uid,
      assetType,
      transactionType: 'SELL',
      amount: Number(amount),
      pricePerUnit: price,
      totalCost,
      timestamp: new Date(),
    });

    res.status(201).json({
      message: `Successfully sold ${amount} ${assetType}`,
      transaction: transaction.toObject(),
      pnl,
      avgBuyPrice: +avgBuyPrice.toFixed(4),
      sellPrice: price,
    });
  } catch (error) {
    console.error('Sell error:', error);
    res.status(500).json({ message: 'Failed to process sell transaction' });
  }
};

// ─── GET /api/portfolio/summary ───
export const getPortfolioSummary = async (req, res) => {
  try {
    const transactions = await Portfolio.find({ userId: req.user.uid })
      .sort({ timestamp: -1 })
      .lean();

    // Group by asset type
    const assetMap = {};

    for (const tx of transactions) {
      if (!assetMap[tx.assetType]) {
        assetMap[tx.assetType] = {
          assetType: tx.assetType,
          totalBought: 0,
          totalSold: 0,
          totalBuyCost: 0,
          totalSellRevenue: 0,
          transactions: [],
        };
      }

      const entry = assetMap[tx.assetType];
      entry.transactions.push(tx);

      if (tx.transactionType === 'BUY') {
        entry.totalBought += tx.amount;
        entry.totalBuyCost += tx.totalCost;
      } else {
        entry.totalSold += tx.amount;
        entry.totalSellRevenue += tx.totalCost;
      }
    }

    // Build summary with PnL
    const holdings = (await Promise.all(Object.values(assetMap).map(async (entry) => {
      const currentHolding = entry.totalBought - entry.totalSold;
      const avgBuyPrice = entry.totalBought > 0
        ? entry.totalBuyCost / entry.totalBought
        : 0;
      const liveRate = await getLiveRate(entry.assetType);

      // Unrealised PnL: (current_price - avg_buy_price) * current_holding
      const unrealisedPnl = (liveRate - avgBuyPrice) * currentHolding;
      // Realised PnL: total sell revenue - (avg_buy_price * total_sold)
      const realisedPnl = entry.totalSellRevenue - (avgBuyPrice * entry.totalSold);
      // Current market value
      const currentValue = currentHolding * liveRate;

      return {
        assetType: entry.assetType,
        currentHolding: +currentHolding.toFixed(6),
        avgBuyPrice: +avgBuyPrice.toFixed(4),
        liveRate,
        currentValue: +currentValue.toFixed(2),
        unrealisedPnl: +unrealisedPnl.toFixed(2),
        realisedPnl: +realisedPnl.toFixed(2),
        totalPnl: +(unrealisedPnl + realisedPnl).toFixed(2),
        transactionCount: entry.transactions.length,
      };
    }))).filter((h) => h.currentHolding > 0); // Only show assets with active holdings

    // Overall portfolio stats
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalUnrealisedPnl = holdings.reduce((sum, h) => sum + h.unrealisedPnl, 0);
    const totalRealisedPnl = holdings.reduce((sum, h) => sum + h.realisedPnl, 0);

    res.json({
      holdings,
      summary: {
        totalValue: +totalValue.toFixed(2),
        totalUnrealisedPnl: +totalUnrealisedPnl.toFixed(2),
        totalRealisedPnl: +totalRealisedPnl.toFixed(2),
        totalPnl: +(totalUnrealisedPnl + totalRealisedPnl).toFixed(2),
        assetCount: holdings.length,
      },
      recentTransactions: transactions.slice(0, 10),
    });
  } catch (error) {
    console.error('Portfolio summary error:', error);
    res.status(500).json({ message: 'Failed to fetch portfolio summary' });
  }
};

// ─── GET /api/portfolio/history ───
export const getTransactionHistory = async (req, res) => {
  try {
    const { assetType, limit = 50 } = req.query;
    const filter = { userId: req.user.uid };
    if (assetType) filter.assetType = assetType;

    const transactions = await Portfolio.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .lean();

    res.json(transactions);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ message: 'Failed to fetch transaction history' });
  }
};

// ─── DELETE /api/portfolio/asset/:assetType ───
export const deleteAsset = async (req, res) => {
  try {
    const { assetType } = req.params;
    if (!assetType) {
      return res.status(400).json({ message: 'Asset type is required' });
    }

    await Portfolio.deleteMany({ userId: req.user.uid, assetType });

    res.json({ message: `Successfully deleted all holdings for ${assetType}` });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ message: 'Failed to delete asset' });
  }
};

// ─── PUT /api/portfolio/asset/:assetType ───
export const updateAsset = async (req, res) => {
  try {
    const { assetType } = req.params;
    const { amount, pricePerUnit } = req.body;

    if (!assetType || amount === undefined || amount < 0) {
      return res.status(400).json({ message: 'Asset type and a valid amount are required.' });
    }

    // Determine price
    const price = pricePerUnit || await getLiveRate(assetType);
    
    // Remove all old transactions for this asset to "reset" it
    await Portfolio.deleteMany({ userId: req.user.uid, assetType });

    // If new amount is > 0, create a new BUY transaction to set the balance
    if (amount > 0) {
      const totalCost = +(amount * price).toFixed(4);
      await Portfolio.create({
        userId: req.user.uid,
        assetType,
        transactionType: 'BUY',
        amount: Number(amount),
        pricePerUnit: price,
        totalCost,
        timestamp: new Date(),
      });
    }

    res.json({ message: `Successfully updated ${assetType} holding to ${amount}` });
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({ message: 'Failed to update asset' });
  }
};
