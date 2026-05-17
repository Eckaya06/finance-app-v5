// src/components/chatbot/AIChartModal.jsx
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import ResponsiveChart from '../charts/ResponsiveChart.jsx';
import { useChat } from '../../context/ChatContext';
import { useTransactions } from '../../context/TransactionContext';
import { useAuth } from '../../context/AuthContext';
import './AIChartModal.css';

// Renk paleti — sade & minimalist
const COLORS = ['#277C78', '#82C9D7', '#F2CDAC', '#626070', '#C94736', '#7F9CF5', '#A78BFA'];

// "DD.MM.YYYY" -> Date
const parseTrDate = (str) => {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) {
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, dd, mm, yyyy] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const AIChartModal = () => {
  const { t } = useTranslation();
  const { isChartModalOpen, chartModalConfig, closeChartModal } = useChat();
  const { transactions } = useTransactions();
  const { user } = useAuth();
  const userName = user?.displayName?.trim() || 'dostum';

  // ESC ile kapat
  useEffect(() => {
    if (!isChartModalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeChartModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isChartModalOpen, closeChartModal]);

  // Body scroll kilitle
  useEffect(() => {
    if (!isChartModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isChartModalOpen]);

  const { chartData, totalAmount, daysBack, type } = useMemo(() => {
    const cfg = chartModalConfig || { daysBack: 7, type: 'expense' };
    const days = Math.max(1, Number(cfg.daysBack) || 7);
    const txType = ['expense', 'income', 'all'].includes(cfg.type) ? cfg.type : 'expense';

    const today = startOfDay(new Date());
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - (days - 1));

    const filtered = (transactions || []).filter((tx) => {
      const txDate = parseTrDate(tx.date) || (tx.rawDate ? new Date(tx.rawDate) : null);
      if (!txDate) return false;
      const day = startOfDay(txDate);
      if (day < cutoff || day > today) return false;
      if (txType === 'all') return true;
      return String(tx.type || '').toLowerCase() === txType;
    });

    const byCategory = filtered.reduce((acc, tx) => {
      const cat = tx.category || 'Other';
      acc[cat] = (acc[cat] || 0) + Number(tx.amount || 0);
      return acc;
    }, {});

    const data = Object.entries(byCategory)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    const total = data.reduce((sum, d) => sum + d.value, 0);

    return { chartData: data, totalAmount: total, daysBack: days, type: txType };
  }, [transactions, chartModalConfig]);

  if (!isChartModalOpen) return null;

  const titleKey = type === 'income' ? 'chartModal.titleIncome' : type === 'all' ? 'chartModal.titleAll' : 'chartModal.titleExpense';
  const translateCategory = (cat) => t(`categories.${cat}`, { defaultValue: cat });

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) closeChartModal();
  };

  return (
    <div className="ai-chart-modal-overlay" onMouseDown={handleOverlayClick}>
      <div
        className="ai-chart-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-chart-modal-title"
      >
        <header className="ai-chart-modal-header">
          <div>
            <h2 id="ai-chart-modal-title" className="ai-chart-modal-title">
              📊 {t(titleKey, { days: daysBack })}
            </h2>
            <p className="ai-chart-modal-subtitle">
              {t('chartModal.subtitle', { name: userName })}
            </p>
          </div>
          <button
            type="button"
            className="ai-chart-modal-close"
            onClick={closeChartModal}
            aria-label={t('chartModal.close')}
          >
            ✖
          </button>
        </header>

        <div className="ai-chart-modal-body">
          {chartData.length === 0 ? (
            <div className="ai-chart-modal-empty">
              <span className="ai-chart-modal-empty-icon">🪹</span>
              <p>{t('chartModal.emptyTitle')}</p>
              <span className="ai-chart-modal-empty-hint">
                {t('chartModal.emptyHint')}
              </span>
            </div>
          ) : (
            <>
              <div className="ai-chart-modal-summary">
                <span className="ai-chart-modal-summary-label">{t('chartModal.total')}</span>
                <span className="ai-chart-modal-summary-value">
                  {totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                </span>
              </div>

              <div className="ai-chart-modal-chart chart-container">
                <ResponsiveChart fill>
                  <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#626070', fontSize: 12 }}
                      axisLine={{ stroke: '#e2e5ea' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#626070', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v} TL`}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(32,31,36,0.04)' }}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #e2e5ea',
                        fontSize: 13,
                      }}
                      formatter={(value) => [`${Number(value).toLocaleString('tr-TR')} TL`, t('chartModal.amount')]}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {chartData.map((_, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveChart>
              </div>

              <ul className="ai-chart-modal-legend">
                {chartData.map((item, idx) => (
                  <li key={item.name} className="ai-chart-modal-legend-item">
                    <span
                      className="ai-chart-modal-legend-dot"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="ai-chart-modal-legend-name">{translateCategory(item.name)}</span>
                    <span className="ai-chart-modal-legend-value">
                      {item.value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <footer className="ai-chart-modal-footer">
          <button type="button" className="ai-chart-modal-action" onClick={closeChartModal}>
            {t('chartModal.close')}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AIChartModal;
