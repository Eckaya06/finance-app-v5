import { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTransactions } from '../../context/TransactionContext.jsx';
import api from '../../api.js';
import {
  ResponsiveContainer,
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
  BarChart
} from 'recharts';
import { FiTrendingUp, FiTrendingDown, FiPieChart, FiBarChart2, FiActivity } from 'react-icons/fi';
import { CATEGORY_COLORS, getCategoryColor } from '../../utils/categoryColors.js';
import ASSET_META from '../portfolio/components/assetMeta.js';
import PortfolioPerformanceChart from './PortfolioPerformanceChart.jsx';
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
const CASHFLOW_MARGINS = { top: 10, right: 10, left: 0, bottom: 0 };
const PORTFOLIO_MARGINS = { top: 10, right: 30, left: 40, bottom: 0 };
const TOOLTIP_STYLE = { borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' };
const TOOLTIP_ITEM_STYLE = { fontWeight: 600 };
const LEGEND_STYLE = { paddingTop: '20px' };
const AXIS_TICK_STYLE = { fill: 'var(--muted)', fontSize: 12 };
const Y_AXIS_BOLD_TICK = { fill: 'var(--text)', fontWeight: 600 };
const TRANSPARENT_CURSOR = { fill: 'transparent' };

const formatCurrency = (val) => `₺${val}`;
const formatTooltipCurrency = (value) => `₺${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
const formatLocale = (val) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2 });

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
const CategorySpendingChart = memo(({ data }) => (
  <div className="chart-container" style={{ height: '320px' }}>
    <ResponsiveContainer width="100%" height="100%" debounce={CHART_RESIZE_DEBOUNCE}>
      <BarChart data={data} margin={CHART_MARGINS}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" type="category" axisLine={false} tickLine={false}
          tick={AXIS_TICK_STYLE} interval={0} angle={-10} textAnchor="end" height={50} />
        <YAxis type="number" axisLine={false} tickLine={false}
          tick={AXIS_TICK_STYLE} dx={-10} tickFormatter={formatCurrency} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE}
          formatter={formatTooltipCurrency} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
          {data.map((entry, index) => (
            <Cell key={`cat-cell-${index}`} fill={getCategoryColor(entry.name)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
));
CategorySpendingChart.displayName = 'CategorySpendingChart';

// ─── Chart 2: Cashflow Composed Chart ───
const CashflowChart = memo(({ data, expenseCategories }) => (
  <div className="chart-container" style={{ height: '320px' }}>
    <ResponsiveContainer width="100%" height="100%" debounce={CHART_RESIZE_DEBOUNCE}>
      <ComposedChart data={data} margin={CASHFLOW_MARGINS}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK_STYLE} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK_STYLE} dx={-10} tickFormatter={formatCurrency} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
        <Legend iconType="circle" wrapperStyle={LEGEND_STYLE} />
        {expenseCategories.map((cat, index) => (
          <Bar key={cat} dataKey={cat} stackId="expenses" fill={getCategoryColor(cat)} barSize={12}
            radius={index === expenseCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
        ))}
        <Line type="monotone" dataKey="Income" stroke={CATEGORY_COLORS.Income}
          strokeWidth={3} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 6 }} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
));
CashflowChart.displayName = 'CashflowChart';

// ─── Chart 3: Expense Distribution Pie Chart ───
const ExpenseDistributionChart = memo(({ data, total }) => {
  const { t } = useTranslation();
  return (
    <div className="chart-container" style={{ height: '300px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', top: '38%' }}>
        <span style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.5px' }}>
          ₺{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '600', marginTop: '2px' }}>{t('analytics.totalExpensesLabel')}</span>
      </div>
      <ResponsiveContainer width="100%" height="100%" debounce={CHART_RESIZE_DEBOUNCE}>
        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
          <Tooltip formatter={formatTooltipCurrency} contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={85}
            outerRadius={115}
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
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ paddingTop: '10px', fontSize: '13px', color: 'var(--text)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});
ExpenseDistributionChart.displayName = 'ExpenseDistributionChart';

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
                <span className="pf-perf-stat-value">{asset.holding?.toFixed(asset.holding < 10 ? 4 : 2)}</span>
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
  const { transactions } = useTransactions();
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
    const fetchAnalyticsData = async () => {
      try {
        const now = Date.now();
        if (cachedPortfolioHistory && cachedMarketRates && (now - lastFetchTime < CACHE_TTL)) {
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
    fetchAnalyticsData();
  }, []);

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
    const activeExpenseCategories = new Set();
    for (const t of cashflowTx) {
      if (t.type !== 'income') activeExpenseCategories.add(t.category || 'Uncategorized');
    }
    const mapByDate = new Map();
    if (cfFilterDays <= 31) {
      for (let i = cfFilterDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        const defaultRow = { date: dateKey, Income: 0 };
        activeExpenseCategories.forEach(cat => { defaultRow[cat] = 0; });
        mapByDate.set(dateKey, defaultRow);
      }
    }
    for (const t of cashflowTx) {
      const key = t._isoDate;
      if (!mapByDate.has(key)) {
        const defaultRow = { date: key, Income: 0 };
        activeExpenseCategories.forEach(cat => { defaultRow[cat] = 0; });
        mapByDate.set(key, defaultRow);
      }
      const row = mapByDate.get(key);
      const amt = Math.abs(Number(t.amount || 0));
      if (t.type === 'income') row.Income += amt;
      else row[t.category || 'Uncategorized'] += amt;
    }
    const cashflowSeries = Array.from(mapByDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ ...r, label: r.date.substring(5).replace('-', '/') }));

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
      categoryTrendsData,
      spendingByCategory,
      portfolioAssetsPnl,
      activeExpenseCategories: Array.from(activeExpenseCategories)
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

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h1 className="page-title">{t('analytics.title')}</h1>
        <TimeframeTabs chartKey="global" activeValue={globalTimeframe} onChange={handleTimeframeChange} />
      </div>

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

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card glass-card">
          <div className="kpi-icon income-icon"><FiTrendingUp /></div>
          <div className="kpi-content">
            <p className="kpi-label">{t('analytics.totalIncome')}</p>
            <p className="kpi-value text-green">+₺{formatLocale(computed.totalIncome)}</p>
          </div>
        </div>
        <div className="kpi-card glass-card">
          <div className="kpi-icon expense-icon"><FiTrendingDown /></div>
          <div className="kpi-content">
            <p className="kpi-label">{t('analytics.totalExpenses')}</p>
            <p className="kpi-value text-red">-₺{formatLocale(computed.totalExpenses)}</p>
          </div>
        </div>
        <div className="kpi-card glass-card">
          <div className="kpi-icon net-icon"><FiActivity /></div>
          <div className="kpi-content">
            <p className="kpi-label">{t('analytics.netCashflow')}</p>
            <p className={`kpi-value ${computed.netCashflow >= 0 ? 'text-green' : 'text-red'}`}>
              {computed.netCashflow >= 0 ? '+' : ''}₺{formatLocale(computed.netCashflow)}
            </p>
          </div>
        </div>
        <div className="kpi-card glass-card">
          <div className="kpi-icon portfolio-icon"><FiPieChart /></div>
          <div className="kpi-content">
            <p className="kpi-label">{t('analytics.portfolioProfit')}</p>
            <p className={`kpi-value ${computed.totalPortfolioPnl >= 0 ? 'text-green' : 'text-red'}`}>
              {computed.totalPortfolioPnl >= 0 ? '+' : ''}₺{formatLocale(computed.totalPortfolioPnl)}
            </p>
          </div>
        </div>
      </div>

      <div className="analytics-grid">
        {/* Chart 1: Category Spending Trends */}
        <div className="analytics-panel glass-panel panel-wide">
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

        {/* Chart 2: Cashflow Trend */}
        <div className="analytics-panel glass-panel panel-wide">
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
            <CashflowChart data={computed.cashflowSeries} expenseCategories={computed.activeExpenseCategories} />
          )}
        </div>

        {/* Chart 3: Expense Distribution */}
        <div className="analytics-panel glass-panel">
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
            <ExpenseDistributionChart data={computed.spendingByCategory} total={computed.totalExpenses} />
          )}
        </div>

        {/* Chart 4: Portfolio Asset Cards (half-width, beside Expense Distribution) */}
        <div className="analytics-panel glass-panel">
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
        <div className="analytics-panel glass-panel panel-wide">
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
  );
};

export default AnalyticsPage;