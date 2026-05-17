import { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTransactions } from '../../context/TransactionContext.jsx';
import api from '../../api.js';
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
  BarChart,
} from 'recharts';
import ResponsiveChart from '../../components/charts/ResponsiveChart.jsx';
import { FiTrendingUp, FiTrendingDown, FiPieChart, FiBarChart2, FiActivity } from 'react-icons/fi';
import { CATEGORY_COLORS, getCategoryColor } from '../../utils/categoryColors.js';
import ASSET_META from '../portfolio/components/assetMeta.js';
import PortfolioPerformanceChart from './PortfolioPerformanceChart.jsx';
import DonutCenterLabel from '../../components/charts/DonutCenterLabel.jsx';
import './AnalyticsPage.css';

const TIME_FILTERS = [
  { value: '1D', tKey: 'analytics.timeframes.1D', days: 1 },
  { value: '1W', tKey: 'analytics.timeframes.1W', days: 7 },
  { value: '1M', tKey: 'analytics.timeframes.1M', days: 30 },
  { value: '1Y', tKey: 'analytics.timeframes.1Y', days: 365 }
];

// ResponsiveContainer'ın resize debounce'u. Sidebar collapse/expand
// transition'ı (Sidebar.css içinde 0.3s) süresince container ölçüsü
// kademeli değiştiği için bu süre transition'dan kasten daha uzun
// tutulur — chart yalnızca transition bittikten sonra TEK seferde
// yeniden çizilir, ortada "morph" / "sıçrama" görüntüsü yaşanmaz.
const CHART_RESIZE_DEBOUNCE = 350;

// ─── Stable style/config objects (created once, never re-allocated) ───
const CHART_MARGINS = { top: 10, right: 10, left: 0, bottom: 10 };

const truncateLabel = (text, maxLen) => {
  if (!text) return '';
  const s = String(text);
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
};

const getCategoryChartLayout = (count) => {
  if (count >= 6) return { angle: -50, xHeight: 90, bottom: 32, maxLabel: 7, chartH: 320, barSize: 14 };
  if (count >= 4) return { angle: -42, xHeight: 78, bottom: 28, maxLabel: 9, chartH: 300, barSize: 18 };
  if (count >= 3) return { angle: -28, xHeight: 62, bottom: 22, maxLabel: 11, chartH: 288, barSize: 22 };
  return { angle: 0, xHeight: 36, bottom: 14, maxLabel: 14, chartH: 280, barSize: 26 };
};
const CASHFLOW_MARGINS = { top: 8, right: 12, left: 4, bottom: 4 };
const CASHFLOW_AXIS_TICK = { fill: '#9ca3af', fontSize: 11 };
const PORTFOLIO_MARGINS = { top: 10, right: 30, left: 40, bottom: 0 };
const TOOLTIP_STYLE = { borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' };
const TOOLTIP_ITEM_STYLE = { fontWeight: 600 };
const AXIS_TICK_STYLE = { fill: 'var(--muted)', fontSize: 12 };
const Y_AXIS_BOLD_TICK = { fill: 'var(--text)', fontWeight: 600 };
const TRANSPARENT_CURSOR = { fill: 'transparent' };

const formatCurrency = (val) => `₺${val}`;
const formatTooltipCurrency = (value) => `₺${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
const formatLocale = (val) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2 });

// Holding miktarını birimiyle birlikte formatla — gereksiz ondalıkları kırpar.
// USD/EUR vb. para birimleri için kod sona eklenir ("359 USD"); altın çeşitleri
// için i18n'den çevrilmiş birim ("4 gram", "2 çeyrek", "1 ons").
const formatHoldingWithUnit = (assetType, holding, t) => {
  if (holding == null || !Number.isFinite(holding)) return '—';
  const num = holding.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
  if (assetType === 'GOLD_GRAM')    return `${num} ${t('analytics.pfUnitGram')}`;
  if (assetType === 'GOLD_QUARTER') return `${num} ${t('analytics.pfUnitQuarter')}`;
  if (assetType === 'GOLD_OUNCE')   return `${num} ${t('analytics.pfUnitOunce')}`;
  return `${num} ${assetType}`;
};
const formatLocaleCompact = (val) =>
  Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const INCOME_LINE_COLOR = '#6366f1';
const EXPENSE_LINE_COLOR = '#ef4444';

const formatYAxisCompact = (val) => {
  const n = Number(val);
  if (!Number.isFinite(n) || n === 0) return '₺0';
  if (n >= 1000) {
    const k = n / 1000;
    return Number.isInteger(k) ? `₺${k}k` : `₺${k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `₺${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
};

const formatCashflowTooltipValue = (value) =>
  `₺${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

const CashflowTooltip = memo(({ active, payload, label }) => {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === 'Income')?.value ?? 0;
  const expenses = payload.find((p) => p.dataKey === 'Expenses')?.value ?? 0;
  return (
    <div className="ap-cashflow-tooltip">
      <p className="ap-cashflow-tooltip-date">{label}</p>
      <div className="ap-cashflow-tooltip-row">
        <span className="ap-cashflow-tooltip-left">
          <span className="ap-legend-dot" style={{ background: INCOME_LINE_COLOR }} />
          {t('analytics.cashflowIncome')}
        </span>
        <span className="ap-cashflow-tooltip-val">{formatCashflowTooltipValue(income)}</span>
      </div>
      <div className="ap-cashflow-tooltip-row">
        <span className="ap-cashflow-tooltip-left">
          <span className="ap-legend-dot ap-legend-dot--expense" />
          {t('analytics.cashflowExpenses')}
        </span>
        <span className="ap-cashflow-tooltip-val">{formatCashflowTooltipValue(expenses)}</span>
      </div>
    </div>
  );
});
CashflowTooltip.displayName = 'CashflowTooltip';

// Helper to reliably parse dates from MongoDB or Turkish formatted dates
const getValidDate = (t) => {
  const dateStr = t.date;

  // Prioritize the user-selected date formatted as DD.MM.YYYY
  if (typeof dateStr === 'string' && dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      // Parse as local time noon to ensure it matches the current day perfectly without UTC offset issues
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
    }
  }

  // Fallback to insertion time or timestamp
  if (t.createdAt) {
    const parsed = new Date(t.createdAt);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  const parsed = new Date(dateStr || t.timestamp);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

// ─── Global Cache to prevent re-fetching on page navigation ───
let cachedPortfolioHistory = null;
let cachedMarketRates = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Timeframe Tabs (memoized — never re-renders unless activeValue changes) ───
const TimeframeTabs = memo(({ chartKey, activeValue, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="chart-timeframe-tabs">
      {TIME_FILTERS.map(tf => (
        <button
          key={tf.value}
          className={`chart-timeframe-tab ${activeValue === tf.value ? 'active' : ''}`}
          onClick={() => onChange(chartKey, tf.value)}
        >
          {t(tf.tKey)}
        </button>
      ))}
    </div>
  );
});
TimeframeTabs.displayName = 'TimeframeTabs';

// ─── Chart 1: Category Spending Bar Chart ───
const CategorySpendingChart = memo(({ data }) => {
  const count = data?.length ?? 0;
  const layout = getCategoryChartLayout(count);
  const categoryMargins = { top: 12, right: 12, left: 8, bottom: layout.bottom };
  const xTickStyle = { fill: '#9ca3af', fontSize: 10 };
  const xAnchor = layout.angle === 0 ? 'middle' : 'end';

  return (
    <div className="chart-container ap-category-chart" style={{ height: layout.chartH }}>
      <ResponsiveChart fill debounce={CHART_RESIZE_DEBOUNCE}>
        <BarChart data={data} margin={categoryMargins}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="name"
            type="category"
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={layout.angle}
            textAnchor={xAnchor}
            height={layout.xHeight}
            tick={xTickStyle}
            tickFormatter={(v) => truncateLabel(v, layout.maxLabel)}
          />
          <YAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            width={44}
            dx={-4}
            tickFormatter={formatYAxisCompact}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={formatTooltipCurrency}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={layout.barSize} maxBarSize={32}>
            {data.map((entry, index) => (
              <Cell key={`cat-cell-${index}`} fill={getCategoryColor(entry.name)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveChart>
    </div>
  );
});
CategorySpendingChart.displayName = 'CategorySpendingChart';

// ─── Chart 2: Cashflow — Income area + Expenses line ───
const CashflowChart = memo(({ data }) => (
  <div className="chart-container ap-cashflow-chart" style={{ height: '340px' }}>
    <ResponsiveChart fill debounce={CHART_RESIZE_DEBOUNCE}>
      <ComposedChart data={data} margin={CASHFLOW_MARGINS}>
        <defs>
          <linearGradient id="apIncomeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={INCOME_LINE_COLOR} stopOpacity={0.22} />
            <stop offset="100%" stopColor={INCOME_LINE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CASHFLOW_AXIS_TICK} dy={8} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={CASHFLOW_AXIS_TICK}
          dx={-4}
          width={48}
          tickFormatter={formatYAxisCompact}
        />
        <Tooltip content={<CashflowTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="Income"
          stroke={INCOME_LINE_COLOR}
          strokeWidth={2.5}
          fill="url(#apIncomeGradient)"
          dot={{ r: 3, strokeWidth: 2, fill: '#fff', stroke: INCOME_LINE_COLOR }}
          activeDot={{ r: 5, strokeWidth: 2, fill: INCOME_LINE_COLOR }}
        />
        <Line
          type="monotone"
          dataKey="Expenses"
          stroke={EXPENSE_LINE_COLOR}
          strokeWidth={2.5}
          dot={{ r: 3, strokeWidth: 2, fill: '#fff', stroke: EXPENSE_LINE_COLOR }}
          activeDot={{ r: 5, strokeWidth: 2, fill: EXPENSE_LINE_COLOR }}
        />
      </ComposedChart>
    </ResponsiveChart>
  </div>
));
CashflowChart.displayName = 'CashflowChart';

// ─── Chart 3: Expense Distribution Pie Chart ───
const ExpenseDistributionChart = memo(({ data, total }) => (
  <div className="chart-container ap-donut-chart-wrap">
    <DonutCenterLabel
      variant="budget"
      value={`₺${total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
      caption="TOTAL"
      holeRatio={0.48}
    />
    <ResponsiveChart fill debounce={CHART_RESIZE_DEBOUNCE}>
      <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <Tooltip formatter={formatTooltipCurrency} contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="52%"
          outerRadius="76%"
          paddingAngle={4}
          stroke="none"
        >
          {data.map((entry, i) => (
              <Cell
                key={`pie-${i}`}
                fill={getCategoryColor(entry.name)}
                stroke="var(--card)"
                strokeWidth={3}
                style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.05))' }}
              />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveChart>
  </div>
));
ExpenseDistributionChart.displayName = 'ExpenseDistributionChart';

// ─── Budget status bars (category spending as progress rows) ───
const BudgetStatusBars = memo(({ data, total }) => {
  if (!data?.length) return null;
  const top = data.slice(0, 6);
  const maxVal = top[0]?.value || 1;
  return (
    <div className="ap-budget-list">
      {top.map((item) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        const barW = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
        return (
          <div key={item.name} className="ap-budget-row">
            <div className="ap-budget-row-top">
              <span className="ap-budget-name">{item.name}</span>
              <span className="ap-budget-pct">{pct}%</span>
            </div>
            <div className="ap-budget-track">
              <div
                className="ap-budget-fill"
                style={{ width: `${barW}%`, background: getCategoryColor(item.name) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});
BudgetStatusBars.displayName = 'BudgetStatusBars';

// ─── Chart 4: Portfolio Performance — Rich Card Layout ───
const PortfolioChart = memo(({ data }) => {
  const { t } = useTranslation();
  // Find the max value for bar scaling
  const maxVal = Math.max(...data.map(d => Math.max(d.cost || 0, d.currentValue || 0)), 1);

  return (
    <div className="portfolio-perf-list">
      {data.map((asset, idx) => {
        const meta = ASSET_META[asset.name] || {};
        const isProfit = asset.Profit >= 0;
        const pnlPct = asset.pnlPercent || 0;
        const costWidth = maxVal > 0 ? Math.max((asset.cost / maxVal) * 100, 2) : 0;
        const valueWidth = maxVal > 0 ? Math.max((asset.currentValue / maxVal) * 100, 2) : 0;
        const displayName = meta.label || asset.name;

        return (
          <div key={asset.name} className="pf-perf-card" style={{ '--pf-accent': meta.color || '#6366f1', animationDelay: `${idx * 60}ms` }}>
            {/* Header Row */}
            <div className="pf-perf-header">
              <div className="pf-perf-asset-info">
                <span className="pf-perf-icon" style={{ background: meta.isGold ? 'rgba(245,158,11,0.1)' : `${meta.color || '#6366f1'}15` }}>
                  {meta.icon || '💱'}
                </span>
                <div className="pf-perf-name-group">
                  <span className="pf-perf-name">{displayName}</span>
                  <span className="pf-perf-pair">{meta.pair || asset.name}</span>
                </div>
              </div>
              <div className={`pf-perf-pnl-badge ${isProfit ? 'profit' : 'loss'}`}>
                <span className="pf-perf-pnl-arrow">{isProfit ? '▲' : '▼'}</span>
                <span>{isProfit ? '+' : ''}{pnlPct.toFixed(2)}%</span>
              </div>
            </div>

            {/* Value Bars */}
            <div className="pf-perf-bars">
              <div className="pf-perf-bar-row">
                <span className="pf-perf-bar-label">{t('analytics.pfCost', 'Maliyet')}</span>
                <div className="pf-perf-bar-track">
                  <div className="pf-perf-bar cost-bar" style={{ width: `${costWidth}%` }} />
                </div>
                <span className="pf-perf-bar-value">₺{formatLocale(asset.cost || 0)}</span>
              </div>
              <div className="pf-perf-bar-row">
                <span className="pf-perf-bar-label">{t('analytics.pfValue', 'Değer')}</span>
                <div className="pf-perf-bar-track">
                  <div className={`pf-perf-bar value-bar ${isProfit ? 'bar-green' : 'bar-red'}`} style={{ width: `${valueWidth}%` }} />
                </div>
                <span className="pf-perf-bar-value">₺{formatLocale(asset.currentValue || 0)}</span>
              </div>
            </div>

            {/* Footer Stats */}
            <div className="pf-perf-footer">
              <div className="pf-perf-stat">
                <span className="pf-perf-stat-label">{t('analytics.pfHolding', 'Miktar')}</span>
                <span className="pf-perf-stat-value">{formatHoldingWithUnit(asset.name, asset.holding, t)}</span>
              </div>
              <div className="pf-perf-stat">
                <span className="pf-perf-stat-label">{t('analytics.pfRate', 'Kur')}</span>
                <span className="pf-perf-stat-value">₺{formatLocale(asset.rate || 0)}</span>
              </div>
              <div className="pf-perf-stat pf-perf-stat-pnl">
                <span className="pf-perf-stat-label">{t('analytics.pfPnl', 'K/Z')}</span>
                <span className={`pf-perf-stat-value ${isProfit ? 'text-green' : 'text-red'}`}>
                  {isProfit ? '+' : ''}₺{formatLocale(asset.Profit)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
PortfolioChart.displayName = 'PortfolioChart';

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════
const AnalyticsPage = () => {
  const { t } = useTranslation();
  const { transactions, portfolioVersion } = useTransactions();
  const navigate = useNavigate();
  const [portfolioTx, setPortfolioTx] = useState([]);
  const [marketRates, setMarketRates] = useState(null);
  const [loading, setLoading] = useState(true);

  // Global timeframe for all charts and KPIs
  const [globalTimeframe, setGlobalTimeframe] = useState('1M');

  // Stable callback for TimeframeTabs — never causes child re-render
  const handleTimeframeChange = useCallback((_, value) => {
    setGlobalTimeframe(value);
  }, []);

  useEffect(() => {
    const fetchAnalyticsData = async ({ skipCache = false } = {}) => {
      try {
        const now = Date.now();
        if (
          !skipCache &&
          cachedPortfolioHistory &&
          cachedMarketRates &&
          now - lastFetchTime < CACHE_TTL
        ) {
          setPortfolioTx(cachedPortfolioHistory);
          setMarketRates(cachedMarketRates);
          setLoading(false);
          return;
        }

        setLoading(true);
        const [portRes, ratesRes] = await Promise.all([
          api.get('/portfolio/history?limit=5000'),
          api.get('/market/rates')
        ]);

        cachedPortfolioHistory = portRes.data;
        cachedMarketRates = ratesRes.data;
        lastFetchTime = Date.now();

        setPortfolioTx(cachedPortfolioHistory);
        setMarketRates(cachedMarketRates);
      } catch (err) {
        console.error("Failed to load analytics data", err);
      } finally {
        setLoading(false);
      }
    };
    // portfolioVersion değişirse cache'i atlayıp gerçek refetch yap.
    // İlk mount'ta (version=0) cache hâlâ devrede.
    fetchAnalyticsData({ skipCache: portfolioVersion > 0 });
  }, [portfolioVersion]);

  // ─── Pre-parse dates once (O(n) runs only when raw data changes) ───
  const parsedTransactions = useMemo(() => {
    return transactions.map(t => {
      const d = getValidDate(t);
      return { ...t, _parsedTime: d.getTime(), _isoDate: d.toISOString().split('T')[0] };
    });
  }, [transactions]);

  const parsedPortfolioTx = useMemo(() => {
    return portfolioTx.map(t => ({ ...t, _parsedTime: getValidDate(t).getTime() }));
  }, [portfolioTx]);

  // ─── All heavy computation in a single useMemo ───
  const computed = useMemo(() => {
    if (loading || !marketRates) return null;
    const nowTime = Date.now();

    const getCutoffTime = (tfValue) => {
      const filterDays = TIME_FILTERS.find(f => f.value === tfValue)?.days || 365;
      const d = new Date();
      if (tfValue === '1D') {
        d.setHours(0, 0, 0, 0); // Start of today
      } else {
        d.setDate(d.getDate() - filterDays);
      }
      return { cutoffTime: d.getTime(), filterDays };
    };

    const filterByTime = (data, tfValue) => {
      const { cutoffTime } = getCutoffTime(tfValue);
      // Removed strict upper bound to prevent clock skew or hardcoded 12:00:00Z times from hiding today's transactions
      return data.filter(t => t._parsedTime >= cutoffTime);
    };

    // --- KPIs ---
    const allValidTx = filterByTime(parsedTransactions, globalTimeframe);
    const totalIncome = allValidTx.reduce((sum, t) => t.type === 'income' ? sum + Math.abs(Number(t.amount || 0)) : sum, 0);
    const totalExpenses = allValidTx.reduce((sum, t) => t.type === 'expense' ? sum + Math.abs(Number(t.amount || 0)) : sum, 0);
    const netCashflow = totalIncome - totalExpenses;

    const allPortTx = filterByTime(parsedPortfolioTx, globalTimeframe);
    const getRate = (assetType) => {
      if (marketRates?.currencies?.[assetType]) return marketRates.currencies[assetType].rate;
      if (marketRates?.gold?.[assetType]) return marketRates.gold[assetType].rate;
      return 0;
    };

    const calcPnl = (txList) => {
      const assetMap = {};
      let totalUnrealizedPnl = 0;
      let totalRealizedPnl = 0;
      const portfolioAssetsPnl = [];

      for (const tx of txList) {
        if (!assetMap[tx.assetType]) assetMap[tx.assetType] = { totalBought: 0, totalBuyCost: 0, totalSold: 0, totalSellRevenue: 0 };
        if (tx.transactionType === 'BUY') {
          assetMap[tx.assetType].totalBought += tx.amount;
          assetMap[tx.assetType].totalBuyCost += tx.totalCost;
        } else {
          assetMap[tx.assetType].totalSold += tx.amount;
          assetMap[tx.assetType].totalSellRevenue += tx.totalCost;
        }
      }
      for (const [assetType, entry] of Object.entries(assetMap)) {
        const avgBuyPrice = entry.totalBought > 0 ? entry.totalBuyCost / entry.totalBought : 0;
        const currentHolding = entry.totalBought - entry.totalSold;
        const rate = getRate(assetType);
        const unrealized = currentHolding > 0 ? (rate - avgBuyPrice) * currentHolding : 0;
        const realized = entry.totalSellRevenue - (avgBuyPrice * entry.totalSold);

        totalUnrealizedPnl += unrealized;
        totalRealizedPnl += realized;
        if (unrealized !== 0 || realized !== 0 || currentHolding > 0) {
          const cost = avgBuyPrice * currentHolding;
          const currentValue = rate * currentHolding;
          const pnlPercent = cost > 0 ? ((currentValue - cost) / cost) * 100 : 0;
          portfolioAssetsPnl.push({ name: assetType, Profit: unrealized + realized, holding: currentHolding, rate, cost, currentValue, pnlPercent });
        }
      }
      portfolioAssetsPnl.sort((a, b) => b.Profit - a.Profit);
      return { totalPnl: totalUnrealizedPnl + totalRealizedPnl, assetsPnl: portfolioAssetsPnl };
    };

    const { totalPnl: totalPortfolioPnl } = calcPnl(allPortTx);

    // --- Chart 1: Category Trends (Bar) ---
    const categoryTrendsTx = filterByTime(parsedTransactions, globalTimeframe).filter(t => t.type === 'expense');
    const catMap1 = new Map();
    for (const t of categoryTrendsTx) {
      const cat = t.category || 'Uncategorized';
      catMap1.set(cat, (catMap1.get(cat) || 0) + Math.abs(Number(t.amount || 0)));
    }
    const categoryTrendsData = Array.from(catMap1.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // --- Chart 2: Cashflow Trend (Line/Composed) ---
    const cashflowTx = filterByTime(parsedTransactions, globalTimeframe);
    const { filterDays: cfFilterDays } = getCutoffTime(globalTimeframe);
    const mapByDate = new Map();
    if (cfFilterDays <= 31) {
      for (let i = cfFilterDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        mapByDate.set(dateKey, { date: dateKey, Income: 0, Expenses: 0 });
      }
    }
    for (const t of cashflowTx) {
      const key = t._isoDate;
      if (!mapByDate.has(key)) {
        mapByDate.set(key, { date: key, Income: 0, Expenses: 0 });
      }
      const row = mapByDate.get(key);
      const amt = Math.abs(Number(t.amount || 0));
      if (t.type === 'income') row.Income += amt;
      else row.Expenses += amt;
    }
    const cashflowSeries = Array.from(mapByDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => {
        const [, m, d] = r.date.split('-');
        return { ...r, label: `${d}/${m}` };
      });

    // --- Chart 3: Category Pie ---
    const pieTx = filterByTime(parsedTransactions, globalTimeframe).filter(t => t.type === 'expense');
    const catMap3 = new Map();
    for (const t of pieTx) {
      const cat = t.category || 'Uncategorized';
      catMap3.set(cat, (catMap3.get(cat) || 0) + Math.abs(Number(t.amount || 0)));
    }
    const spendingByCategory = Array.from(catMap3.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // --- Chart 4: Portfolio ---
    const portChartTx = filterByTime(parsedPortfolioTx, globalTimeframe);
    const { assetsPnl: portfolioAssetsPnl } = calcPnl(portChartTx);

    return {
      totalIncome,
      totalExpenses,
      netCashflow,
      totalPortfolioPnl,
      cashflowSeries,
      cashflowTxCount: cashflowTx.length,
      categoryTrendsData,
      spendingByCategory,
      portfolioAssetsPnl
    };

  }, [parsedTransactions, parsedPortfolioTx, marketRates, globalTimeframe, loading]);

  const hasNoData = transactions.length === 0 && portfolioTx.length === 0;

  // ─── Loading skeleton ───
  if (loading || !computed) {
    return (
      <div className="analytics-page skeleton-loading">
        <div className="skeleton-block" style={{ height: '40px', width: '200px', marginBottom: '30px' }} />
        <div className="kpi-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-block" style={{ height: '100px' }} />)}
        </div>
      </div>
    );
  }

  const expenseSharePct =
    computed.totalIncome > 0
      ? Math.round((computed.totalExpenses / computed.totalIncome) * 100)
      : 0;

  return (
    <div className="analytics-page">
      <div className="page-card ap-page-card">
      <header className="ap-header analytics-header">
        <div>
          <h1 className="ap-title page-title">{t('analytics.title')}</h1>
        </div>
        <TimeframeTabs chartKey="global" activeValue={globalTimeframe} onChange={handleTimeframeChange} />
      </header>

      {hasNoData && (
        <div className="analytics-welcome-banner">
          <div className="welcome-banner-header">
            <div className="welcome-banner-icon"><FiActivity /></div>
            <div className="welcome-banner-text">
              <h2>{t('analytics.welcomeTitle')}</h2>
              <p>{t('analytics.welcomeMessage')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="ap-kpi-grid kpi-grid">
        <div className="kpi-card glass-card ap-kpi-card">
          <span className="ap-kpi-pill">{t('analytics.kpiBadgeIncome')}</span>
          <p className="ap-kpi-label">{t('analytics.kpiLabelIncome')}</p>
          <p className="ap-kpi-value">+₺{formatLocale(computed.totalIncome)}</p>
          <p className="ap-kpi-foot">{t(`analytics.timeframes.${globalTimeframe}`)}</p>
        </div>
        <div className="kpi-card glass-card ap-kpi-card">
          <span className="ap-kpi-pill">{t('analytics.kpiBadgeExpense')}</span>
          <p className="ap-kpi-label">{t('analytics.kpiLabelExpense')}</p>
          <p className="ap-kpi-value">-₺{formatLocale(computed.totalExpenses)}</p>
          <p className="ap-kpi-foot">
            {computed.totalIncome > 0
              ? t('analytics.kpiExpenseShare', { pct: expenseSharePct })
              : '—'}
          </p>
        </div>
        <div className="kpi-card glass-card ap-kpi-card">
          <span className="ap-kpi-pill">{t('analytics.kpiBadgeNet')}</span>
          <p className="ap-kpi-label">{t('analytics.kpiLabelNet')}</p>
          <p className="ap-kpi-value">
            {computed.netCashflow >= 0 ? '+' : ''}₺{formatLocale(computed.netCashflow)}
          </p>
          <p className="ap-kpi-foot">
            <span>↑ ₺{formatLocaleCompact(computed.totalIncome)} {t('analytics.kpiIn')}</span>
            <span className="ap-kpi-foot-sep"> · </span>
            <span>↓ ₺{formatLocaleCompact(computed.totalExpenses)} {t('analytics.kpiOut')}</span>
          </p>
        </div>
        <div className="kpi-card glass-card ap-kpi-card">
          <span className="ap-kpi-pill">{t('analytics.kpiBadgePortfolio')}</span>
          <p className="ap-kpi-label">{t('analytics.kpiLabelPortfolio')}</p>
          <p className="ap-kpi-value">
            {computed.totalPortfolioPnl >= 0 ? '+' : ''}₺{formatLocale(computed.totalPortfolioPnl)}
          </p>
          <p className="ap-kpi-foot">
            {computed.portfolioAssetsPnl.length > 0
              ? t('analytics.kpiPortfolioFoot', { count: computed.portfolioAssetsPnl.length })
              : t('analytics.noPortfolioData')}
          </p>
        </div>
      </div>

      <div className="analytics-grid ap-analytics-grid">
        <div className="ap-hero-column ap-hero-column--left">
          <div className="analytics-panel glass-panel ap-panel ap-panel--category">
            <div className="panel-header">
                <div className="panel-title-group">
                  <h3>{t('analytics.categorySpending')}</h3>
                  <span className="panel-subtitle">{t('analytics.categorySpendingSub')}</span>
                </div>
              </div>
              {transactions.length === 0 ? (
            <div className="modern-empty-state">
              <div className="modern-empty-banner banner-blue">
                <FiBarChart2 className="modern-empty-banner-icon icon-blue" />
              </div>
              <div className="modern-empty-icon-wrapper circle-blue">
                <FiBarChart2 />
              </div>
              <h4 className="modern-empty-title">{t('analytics.categorySpending')}</h4>
              <p className="modern-empty-desc">{t('analytics.noExpenseData')}</p>
              <button className="modern-empty-btn" onClick={() => navigate('/income-expense')}>{t('analytics.addTransaction')}</button>
            </div>
          ) : computed.categoryTrendsData.length === 0 ? (
            <div className="empty-state">{t('analytics.noPeriodData')}</div>
          ) : (
            <CategorySpendingChart data={computed.categoryTrendsData} />
          )}
          </div>

          <div className="analytics-panel glass-panel ap-panel ap-panel--cashflow">
            <div className="panel-header">
              <div className="panel-title-group">
                <h3>{t('analytics.cashflowTrend')}</h3>
                <span className="panel-subtitle">{t('analytics.cashflowTrendSub')}</span>
              </div>
            </div>
            {transactions.length === 0 ? (
                <div className="modern-empty-state">
                  <div className="modern-empty-banner banner-orange">
                <FiTrendingUp className="modern-empty-banner-icon icon-orange" />
              </div>
              <div className="modern-empty-icon-wrapper circle-orange">
                <FiTrendingUp />
              </div>
              <h4 className="modern-empty-title">{t('analytics.cashflowTrend')}</h4>
              <p className="modern-empty-desc">{t('analytics.noCashflowData')}</p>
              <button className="modern-empty-btn" onClick={() => navigate('/income-expense')}>{t('analytics.addTransaction')}</button>
            </div>
          ) : computed.cashflowSeries.length === 0 ? (
            <div className="empty-state">{t('analytics.noPeriodCashflow')}</div>
          ) : (
            <>
              <CashflowChart data={computed.cashflowSeries} />
              <div className="ap-chart-footer ap-cashflow-footer">
                <div className="ap-legend">
                  <span className="ap-legend-item">
                    <span className="ap-legend-dot" style={{ background: INCOME_LINE_COLOR }} />
                    {t('analytics.cashflowIncome')}
                  </span>
                  <span className="ap-legend-item">
                    <span className="ap-legend-dot ap-legend-dot--expense" />
                    {t('analytics.cashflowExpenses')}
                  </span>
                </div>
                <span className="ap-chart-meta">
                  {t('analytics.cashflowTxCount', { count: computed.cashflowTxCount })}
                </span>
              </div>
            </>
          )}
          </div>
        </div>

        <div className="ap-hero-column ap-hero-column--right">
        <div className="analytics-panel glass-panel ap-panel ap-panel--distribution">
          <div className="panel-header">
            <div className="panel-title-group">
              <h3>{t('analytics.expenseDistribution')}</h3>
              <span className="panel-subtitle">{t('analytics.expenseDistributionSub')}</span>
            </div>
          </div>
          {transactions.length === 0 ? (
            <div className="modern-empty-state">
              <div className="modern-empty-banner banner-purple">
                <FiPieChart className="modern-empty-banner-icon icon-purple" />
              </div>
              <div className="modern-empty-icon-wrapper circle-purple">
                <FiPieChart />
              </div>
              <h4 className="modern-empty-title">{t('analytics.expenseDistribution')}</h4>
              <p className="modern-empty-desc">{t('analytics.noDistData')}</p>
              <button className="modern-empty-btn" onClick={() => navigate('/income-expense')}>{t('analytics.addTransaction')}</button>
            </div>
          ) : computed.spendingByCategory.length === 0 ? (
            <div className="empty-state">{t('analytics.noPeriodData')}</div>
          ) : (
            <div className="ap-distribution-body">
              <ExpenseDistributionChart data={computed.spendingByCategory} total={computed.totalExpenses} />
              <div className="ap-donut-legend">
                {computed.spendingByCategory.slice(0, 5).map((item) => {
                  const pct =
                    computed.totalExpenses > 0
                      ? Math.round((item.value / computed.totalExpenses) * 100)
                      : 0;
                  return (
                    <div key={item.name} className="ap-donut-legend-row">
                      <span className="ap-donut-legend-left">
                        <span className="ap-legend-dot" style={{ background: getCategoryColor(item.name) }} />
                        <span className="ap-donut-legend-name" title={item.name}>
                          {item.name}
                        </span>
                      </span>
                      <span className="ap-donut-legend-right">
                        <span className="ap-donut-pct">{pct}%</span>
                        <span className="ap-donut-amt">₺{formatLocaleCompact(item.value)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="analytics-panel glass-panel ap-panel ap-panel--budget">
          <div className="panel-header">
            <div className="panel-title-group">
              <h3>{t('analytics.categoryBreakdown', 'Kategori Özeti')}</h3>
              <span className="panel-subtitle">{t('analytics.categoryBreakdownSub', 'Dönem içi harcama payları')}</span>
            </div>
          </div>
          {transactions.length === 0 || computed.categoryTrendsData.length === 0 ? (
            <div className="empty-state ap-empty-compact">{t('analytics.noPeriodData')}</div>
          ) : (
            <BudgetStatusBars data={computed.categoryTrendsData} total={computed.totalExpenses} />
          )}
        </div>
        </div>

        {/* Chart 4: Portfolio performance */}
        <div className="analytics-panel glass-panel ap-panel ap-panel--portfolio">
          <div className="panel-header">
            <div className="panel-title-group">
              <h3>{t('analytics.portfolioPerformance')}</h3>
              <span className="panel-subtitle">{t('analytics.portfolioPerformanceSub')}</span>
            </div>
          </div>
          {portfolioTx.length === 0 ? (
            <div className="modern-empty-state">
              <div className="modern-empty-banner banner-green">
                <FiActivity className="modern-empty-banner-icon icon-green" />
              </div>
              <div className="modern-empty-icon-wrapper circle-green">
                <FiActivity />
              </div>
              <h4 className="modern-empty-title">{t('analytics.portfolioPerformance')}</h4>
              <p className="modern-empty-desc">{t('analytics.noPortfolioData')}</p>
              <button className="modern-empty-btn" onClick={() => navigate('/portfolio')}>{t('analytics.goToPortfolio')}</button>
            </div>
          ) : computed.portfolioAssetsPnl.length === 0 ? (
            <div className="empty-state">{t('analytics.noPeriodPortfolio')}</div>
          ) : (
            <PortfolioChart data={computed.portfolioAssetsPnl} />
          )}
        </div>

        {/* Chart 5: Portfolio PnL Timeline (full-width, bottom) */}
        <div className="analytics-panel glass-panel ap-panel ap-panel--ppc">
          <div className="panel-header">
            <div className="panel-title-group">
              <h3>{t('analytics.ppcTitle', 'Portföy K/Z Zaman Çizelgesi')}</h3>
              <span className="panel-subtitle">{t('analytics.ppcSub', 'Kümülatif kâr/zararınızın zaman içindeki seyri')}</span>
            </div>
          </div>
          <PortfolioPerformanceChart portfolioTransactions={portfolioTx} marketRates={marketRates} />
        </div>
      </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
