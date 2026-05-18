/**
 * Market Controller
 * Provides live exchange rates and gold prices.
 * Source: finans.truncgil.com/v3 — free, no rate limit, ships Update_Date.
 *
 * Why v3 and not v4/genelpara: v4 quotes JPY as 0.00287 (broken) and ONS as 0
 * (broken). genelpara has no upstream timestamp and a 1000 req/day cap. v3
 * gives us correct JPY/gold AND an honest "upstream last updated" signal we
 * can surface to the UI.
 */

const TRUNCGIL_URL = 'https://finans.truncgil.com/v3/today.json';

// ─── Cache ───
let cachedRates = null;
let cacheTimestamp = 0;
const CACHE_DURATION_WEEKDAY = 30_000;   // 30s — upstream refreshes every ~10 min anyway, so 30s on our side keeps the UI snappy without wasting calls
const CACHE_DURATION_WEEKEND = 300_000;  // 5 min on weekends (markets closed)

// Truncgil Update_Date format: "2026-05-18 22:00:03" (TR local time, no TZ).
// We treat it as UTC-naive and emit ISO so the frontend can compute "Xs ago"
// against its own clock. Slight TZ drift doesn't matter for relative age.
const parseUpstreamDate = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const iso = raw.replace(' ', 'T');
  const t = new Date(iso);
  return Number.isFinite(t.getTime()) ? t.toISOString() : null;
};

const isForexMarketOpen = () => {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  return day !== 0 && day !== 6;
};

// Locale-agnostic number parser. Truncgil v3 currently quotes Turkish locale
// ("45,5824", "6.655,52", "$4.541,93", "%0,13") but the API has shifted format
// in the past. Picking the decimal separator from the value itself protects
// us from a silent upstream change turning 45,58 into 455800.
const parseNum = (str) => {
  if (str === null || str === undefined || str === '') return 0;
  const cleaned = String(str).replace(/[$%₺\s]/g, '');
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  let normalized;
  if (lastDot === -1 && lastComma === -1) {
    normalized = cleaned;
  } else if (lastComma > lastDot) {
    // Comma is decimal → strip dots (thousand sep), replace comma with dot.
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Dot is decimal → strip commas (thousand sep).
    normalized = cleaned.replace(/,/g, '');
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

export const getLiveRates = async (req, res) => {
  try {
    const now = Date.now();
    const marketOpen = isForexMarketOpen();
    const cacheDuration = marketOpen ? CACHE_DURATION_WEEKDAY : CACHE_DURATION_WEEKEND;

    // Cache hit: hand back the cached payload but recompute marketOpen live.
    // Keep the original upstream timestamp so the UI shows real age, not "now".
    if (cachedRates && (now - cacheTimestamp) < cacheDuration) {
      return res.json({ ...cachedRates, marketOpen });
    }

    const response = await fetch(TRUNCGIL_URL);
    if (!response.ok) throw new Error(`truncgil HTTP ${response.status}`);
    const data = await response.json();

    const buildCurrency = (code, name, key) => {
      const item = data[key];
      if (!item) {
        return { code, name, buying: 0, selling: 0, rate: 0, change: 0, changePercent: 0, spread: 0 };
      }
      const buying = parseNum(item.Buying);
      const selling = parseNum(item.Selling);
      const rate = selling;
      const changePercent = parseNum(item.Change);
      const change = rate * (changePercent / 100);
      const spread = selling > 0
        ? +(((selling - buying) / selling) * 100).toFixed(3)
        : 0;
      return { code, name, buying, selling, rate, change, changePercent, spread };
    };

    // Ons (troy ounce) gold: truncgil quotes it in USD, convert to TRY with
    // the live USD rate. Frontend renders it through the same gold path.
    const usdRate = parseNum(data['USD']?.Selling) || 45.00;
    const onsBuyingUsd = parseNum(data['ons']?.Buying);
    const onsSellingUsd = parseNum(data['ons']?.Selling);
    const onsChangePct = parseNum(data['ons']?.Change);

    const buildGold = (name, item, isOunce = false) => {
      let buying = 0;
      let selling = 0;
      let changePercent = 0;

      if (isOunce) {
        buying = onsBuyingUsd * usdRate;
        selling = onsSellingUsd * usdRate;
        changePercent = onsChangePct;
      } else if (item) {
        buying = parseNum(item.Buying);
        selling = parseNum(item.Selling);
        changePercent = parseNum(item.Change);
      }

      const rate = selling;
      const change = rate * (changePercent / 100);
      return { name, buying, selling, rate, change, changePercent };
    };

    // Upstream Update_Date is the truth about freshness. UI uses it to render
    // "Xs ago" honestly — refreshing the page when upstream is stale will not
    // make the value change; the badge reveals the real cause.
    const upstreamTs = parseUpstreamDate(data['Update_Date']) || new Date().toISOString();

    const rates = {
      timestamp: upstreamTs,
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
      // Hand back the last good payload so the UI doesn't blank out.
      return res.json({ ...cachedRates, stale: true });
    }
    res.status(500).json({ message: 'Failed to fetch market rates' });
  }
};
