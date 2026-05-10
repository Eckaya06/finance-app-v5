/**
 * Market Controller
 * Provides live exchange rates and gold prices.
 * Uses finans.truncgil.com/v3/today.json for real Turkish market data.
 */

// ─── Cache to avoid hitting rate limits ───
let cachedRates = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60_000; // 1 minute cache

export const getLiveRates = async (req, res) => {
  try {
    const now = Date.now();

    // Return cached if fresh
    if (cachedRates && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json({ ...cachedRates, timestamp: new Date().toISOString() });
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
      if (!item) return { code, name, buying: 0, selling: 0, rate: 0, change: 0, changePercent: 0 };
      
      const selling = parseNum(item.Selling);
      const buying = parseNum(item.Buying);
      const rate = selling;
      const changePercent = parseNum(item.Change);
      const change = rate * (changePercent / 100);

      return { code, name, buying, selling, rate, change, changePercent };
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
