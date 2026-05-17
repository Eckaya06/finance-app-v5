/**
 * PortfolioPerformanceChart.jsx
 * ─────────────────────────────
 * Cumulative PnL timeline chart for the Analytics dashboard.
 * Calculates both realised (sell) and unrealised (mark-to-market) P&L
 * at each transaction date plus the current date, producing an AreaChart.
 *
 * Performance:
 *  • Data transformation is wrapped in useMemo (recalculates only when
 *    portfolioTransactions or marketRates change).
 *  • The entire component is exported via React.memo to prevent stale
 *    re-renders caused by sidebar toggles and other layout state changes.
 */
import { useMemo } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import ResponsiveChart from '../../components/charts/ResponsiveChart.jsx';
import { FiActivity } from 'react-icons/fi';
import './PortfolioPerformanceChart.css';

// ─── Stable config objects (allocated once) ───
const CHART_MARGINS = { top: 10, right: 20, left: 10, bottom: 10 };
const AXIS_TICK = { fill: 'var(--muted)', fontSize: 11 };
const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
  background: 'var(--card)',
};
const TOOLTIP_LABEL_STYLE = { fontWeight: 700, color: 'var(--text)', marginBottom: 4 };
const TOOLTIP_ITEM_STYLE = { fontWeight: 600 };
const RESIZE_DEBOUNCE = 350;

// ─── Formatters ───
const fmtCurrency = (v) =>
  `₺${Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtAxis = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `₺${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₺${(v / 1_000).toFixed(1)}K`;
  return `₺${v.toFixed(0)}`;
};

/**
 * Core data transformation:
 * Walk through transactions chronologically, track per-asset holdings
 * and compute a running total (realised + unrealised) PnL at each date.
 * The final data point is always "today" with current market rates.
 */
const buildPnlTimeline = (transactions, marketRates) => {
  if (!transactions.length || !marketRates) return [];

  // Helper to get the current live rate for an asset
  const getRate = (assetType) => {
    if (marketRates?.currencies?.[assetType]) return marketRates.currencies[assetType].rate;
    if (marketRates?.gold?.[assetType]) return marketRates.gold[assetType].rate;
    return 0;
  };

  // 1) Sort by timestamp
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime()
  );

  // Per-asset state: { totalBought, totalBuyCost, totalSold, totalSellRevenue }
  const state = {};
  let cumulativeRealised = 0;
  const dataPoints = [];

  // 2) Walk through each transaction
  for (const tx of sorted) {
    const at = tx.assetType;
    if (!state[at]) state[at] = { totalBought: 0, totalBuyCost: 0, totalSold: 0, totalSellRevenue: 0 };

    if (tx.transactionType === 'BUY') {
      state[at].totalBought += tx.amount;
      state[at].totalBuyCost += tx.totalCost;
    } else {
      // SELL — compute realised PnL for this sale
      const avgBuy = state[at].totalBought > 0 ? state[at].totalBuyCost / state[at].totalBought : 0;
      cumulativeRealised += (tx.pricePerUnit - avgBuy) * tx.amount;
      state[at].totalSold += tx.amount;
      state[at].totalSellRevenue += tx.totalCost;
    }

    // At this point in time, compute unrealised PnL across ALL held assets
    let unrealised = 0;
    for (const [asset, s] of Object.entries(state)) {
      const holding = s.totalBought - s.totalSold;
      if (holding > 0) {
        const avgBuy = s.totalBuyCost / s.totalBought;
        const rate = getRate(asset);
        unrealised += (rate - avgBuy) * holding;
      }
    }

    const txDate = new Date(tx.timestamp || tx.createdAt);
    const dateLabel = txDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    const isoDate = txDate.toISOString().split('T')[0];

    dataPoints.push({
      date: isoDate,
      label: dateLabel,
      pnl: Math.round((cumulativeRealised + unrealised) * 100) / 100,
      realised: Math.round(cumulativeRealised * 100) / 100,
      unrealised: Math.round(unrealised * 100) / 100,
    });
  }

  // 3) Add "today" data point (or update last if today already exists)
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const todayLabel = today.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });

  let unrealisedNow = 0;
  for (const [asset, s] of Object.entries(state)) {
    const holding = s.totalBought - s.totalSold;
    if (holding > 0) {
      const avgBuy = s.totalBuyCost / s.totalBought;
      unrealisedNow += (getRate(asset) - avgBuy) * holding;
    }
  }
  const todayPnl = Math.round((cumulativeRealised + unrealisedNow) * 100) / 100;

  // Avoid duplicate if the last tx was today
  if (dataPoints.length && dataPoints[dataPoints.length - 1].date === todayISO) {
    dataPoints[dataPoints.length - 1].pnl = todayPnl;
    dataPoints[dataPoints.length - 1].unrealised = Math.round(unrealisedNow * 100) / 100;
  } else {
    dataPoints.push({
      date: todayISO,
      label: todayLabel,
      pnl: todayPnl,
      realised: Math.round(cumulativeRealised * 100) / 100,
      unrealised: Math.round(unrealisedNow * 100) / 100,
    });
  }

  // Deduplicate: if multiple tx on same date, keep only the last (cumulative)
  const dateMap = new Map();
  for (const dp of dataPoints) {
    dateMap.set(dp.date, dp);
  }
  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

// ─── Custom Tooltip ───
const PnlTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="pnl-tooltip">
      <p className="pnl-tooltip-date">{d.label}</p>
      <div className="pnl-tooltip-row">
        <span className="pnl-tooltip-dot" style={{ background: d.pnl >= 0 ? '#10b981' : '#ef4444' }} />
        <span className="pnl-tooltip-label">Toplam K/Z</span>
        <span className={`pnl-tooltip-value ${d.pnl >= 0 ? 'pos' : 'neg'}`}>{fmtCurrency(d.pnl)}</span>
      </div>
      <div className="pnl-tooltip-row sub">
        <span className="pnl-tooltip-label">Gerçekleşen</span>
        <span className="pnl-tooltip-value">{fmtCurrency(d.realised)}</span>
      </div>
      <div className="pnl-tooltip-row sub">
        <span className="pnl-tooltip-label">Gerçekleşmemiş</span>
        <span className="pnl-tooltip-value">{fmtCurrency(d.unrealised)}</span>
      </div>
    </div>
  );
};

// ─── Custom Active Dot ───
const ActiveDot = (props) => {
  const { cx, cy, payload } = props;
  const color = payload.pnl >= 0 ? '#10b981' : '#ef4444';
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.15} />
      <circle cx={cx} cy={cy} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />
    </g>
  );
};

// ═════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════
const PortfolioPerformanceChart = memo(({ portfolioTransactions, marketRates }) => {
  const { t } = useTranslation();

  // ─── Heavy computation memoized ───
  const timelineData = useMemo(
    () => buildPnlTimeline(portfolioTransactions, marketRates),
    [portfolioTransactions, marketRates]
  );

  // Determine overall PnL colour
  const lastPnl = timelineData.length ? timelineData[timelineData.length - 1].pnl : 0;
  const isNeutral = Math.abs(lastPnl) < 0.01;
  const isPositive = isNeutral ? true : lastPnl >= 0;
  const lineColor = isNeutral ? '#64748b' : isPositive ? '#10b981' : '#ef4444';
  const gradientId = 'pnlGradient';

  // ─── Empty state ───
  if (!timelineData.length) {
    return (
      <div className="ppc-empty">
        <div className="ppc-empty-icon-ring">
          <FiActivity />
        </div>
        <h4>{t('analytics.ppcEmptyTitle', 'Henüz portföy verisi yok')}</h4>
        <p>{t('analytics.ppcEmptyMsg', 'Performans grafiğinizi görmek için yatırım yapmaya başlayın.')}</p>
      </div>
    );
  }

  return (
    <div className="portfolio-performance-container">
      {/* Summary badges */}
      <div className="ppc-summary">
        <div className={`ppc-badge ${isNeutral ? 'neutral' : isPositive ? 'pos' : 'neg'}`}>
          {!isNeutral && <span className="ppc-badge-arrow">{isPositive ? '▲' : '▼'}</span>}
          <span>{isNeutral ? '₺0,00' : `${isPositive ? '+' : ''}${fmtCurrency(lastPnl)}`}</span>
        </div>
        <span className="ppc-label">{t('analytics.ppcCumPnl', 'Kümülatif K/Z')}</span>
      </div>

      {/* Chart */}
      <div className="ppc-chart-wrap" style={{ height: 280 }}>
        <ResponsiveChart fill debounce={RESIZE_DEBOUNCE}>
          <AreaChart data={timelineData} margin={CHART_MARGINS}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              tickFormatter={fmtAxis}
              dx={-5}
            />
            <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" strokeOpacity={0.5} />
            <Tooltip content={<PnlTooltip />} />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={lineColor}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={<ActiveDot />}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveChart>
      </div>
    </div>
  );
});
PortfolioPerformanceChart.displayName = 'PortfolioPerformanceChart';

export default PortfolioPerformanceChart;
