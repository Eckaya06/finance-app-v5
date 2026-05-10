/**
 * Market Controller
 * Provides live exchange rates and gold prices.
 * Uses finans.truncgil.com/v3/today.json for real Turkish market data.
 */

// ─── Cache to avoid hitting rate limits ───
let cachedRates = null;
let cacheTimestamp = 0;
const CACHE_DURATION_WEEKDAY = 60_000;   // 1 minute on weekdays
const CACHE_DURATION_WEEKEND = 300_000;  // 5 minutes on weekends (markets closed)

/**
 * Check if forex markets are currently open.
 * Forex: Mon 00:00 - Fri 22:00 UTC (approx).
 * Turkish local time: markets are effectively closed Sat & Sun.
 */
const isForexMarketOpen = () => {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  return day !== 0 && day !== 6;
};

export const getLiveRates = async (req, res) => {
  try {
    const now = Date.now();
    const marketOpen = isForexMarketOpen();
    const cacheDuration = marketOpen ? CACHE_DURATION_WEEKDAY : CACHE_DURATION_WEEKEND;

    // Return cached if fresh
    if (cachedRates && (now - cacheTimestamp) < cacheDuration) {
      return res.json({ ...cachedRates, timestamp: new Date().toISOString(), marketOpen });
    }

    const response = await fetch('https://finans.truncgil.com/v3/today.json');
    if (!response.ok) throw new Error('API failed');
    const data = await response.json();

    const parseNum = (str) => {
      if (!str) return 0;
      return parseFloat(String(str).replace('$', '').replace('%', '').replace(/\./g, '').replace(',', '.'));
    };

    const buildCurrency = (code, name, key) => {
      const item = data[key];
      if (!item) return { code, name, buying: 0, selling: 0, rate: 0, change: 0, changePercent: 0, spread: 0 };
      
      const selling = parseNum(item.Selling);
      const buying = parseNum(item.Buying);
      const rate = selling;
      const changePercent = parseNum(item.Change);
      const change = rate * (changePercent / 100);
      const spread = +((selling - buying) / selling * 100).toFixed(3);

      return { code, name, buying, selling, rate, change, changePercent, spread };
    };

    const usdRate = parseNum(data['USD']?.Selling) || 45.00;
    const onsUsd = parseNum(data['ons']?.Selling) || 3300;
    const onsTry = onsUsd * usdRate;

    const buildGold = (name, item, isOunce = false) => {
      let selling = 0;
      let buying = 0;
      let changePercent = 0;

      if (isOunce) {
        selling = onsTry;
        buying = parseNum(data['ons']?.Buying) * usdRate;
        changePercent = parseNum(data['ons']?.Change);
      } else if (item) {
        selling = parseNum(item.Selling);
        buying = parseNum(item.Buying);
        changePercent = parseNum(item.Change);
      }
      
      const rate = selling;
      const change = rate * (changePercent / 100);

      return { name, buying, selling, rate, change, changePercent };
    };

    const rates = {
      timestamp: new Date().toISOString(),
      base: 'TRY',
      marketOpen,
      currencies: {
        USD: buildCurrency('USD', 'US Dollar', 'USD'),
        EUR: buildCurrency('EUR', 'Euro', 'EUR'),
        GBP: buildCurrency('GBP', 'British Pound', 'GBP'),
        JPY: buildCurrency('JPY', 'Japanese Yen', 'JPY'),
        CHF: buildCurrency('CHF', 'Swiss Franc', 'CHF'),
        CAD: buildCurrency('CAD', 'Canadian Dollar', 'CAD'),
      },
      gold: {
        GOLD_GRAM: buildGold('Gram Gold', data['gram-altin']),
        GOLD_QUARTER: buildGold('Quarter Gold', data['ceyrek-altin']),
        GOLD_OUNCE: buildGold('Ounce Gold', null, true),
      },
    };

    cachedRates = rates;
    cacheTimestamp = now;

    res.json(rates);
  } catch (error) {
    console.error('Market rates error:', error);
    if (cachedRates) {
      return res.json({ ...cachedRates, timestamp: new Date().toISOString(), stale: true });
    }
    res.status(500).json({ message: 'Failed to fetch market rates' });
  }
};
