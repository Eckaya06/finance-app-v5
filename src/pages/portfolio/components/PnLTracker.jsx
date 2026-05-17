import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CustomDropdown from '../../../components/dropdown/CustomDropdown.jsx';

const TRACKABLE_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD'];

const PnLTracker = ({ rates }) => {
  const { t } = useTranslation();

  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const availableCurrencies = useMemo(() => {
    if (!rates?.currencies) return TRACKABLE_CURRENCIES;
    return TRACKABLE_CURRENCIES.filter((c) => rates.currencies[c]);
  }, [rates]);

  const liveRate = rates?.currencies?.[currency]?.rate ?? null;
  const parsedAmount = parseFloat(amount);
  const hasAmount = !!parsedAmount && parsedAmount > 0;
  const tryValue = hasAmount && liveRate ? parsedAmount * liveRate : 0;

  const formatTRY = (val) =>
    val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatRate = (val) =>
    val.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const handleClear = () => setAmount('');

  const sparkPath = useMemo(() => {
    const w = 110;
    const h = 44;
    const points = [];
    const base = 22;
    for (let i = 0; i < 14; i++) {
      const noise = Math.sin(i * 1.3) * 5 + Math.cos(i * 0.6) * 3;
      points.push(base + noise);
    }
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = ((p - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, []);

  return (
    <div className="pnl-tracker-card" id="currency-converter">
      <div className="pnl-tracker-left">
        <div className="pnl-tracker-eyebrow">{t('portfolio.convTitle')}</div>
        <div className="pnl-tracker-sub">{t('portfolio.convSubtitle')}</div>

        <div className="pnl-tracker-form">
          <div className="pnl-form-field">
            <label className="pnl-form-label">{t('portfolio.pnlCurrencyLabel')}</label>
            <CustomDropdown
              options={availableCurrencies}
              selectedValue={currency}
              onChange={setCurrency}
              isOpen={currencyOpen}
              onToggle={() => setCurrencyOpen((v) => !v)}
            />
          </div>
          <div className="pnl-form-field">
            <label className="pnl-form-label">{t('portfolio.pnlAmountLabel')}</label>
            <input
              type="number"
              step="any"
              min="0"
              className="pnl-form-input"
              placeholder={t('portfolio.pnlAmountPlaceholder')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              id="conv-amount-input"
            />
          </div>
        </div>

        <div className="pnl-tracker-actions">
          <button
            type="button"
            className="pnl-btn-secondary"
            onClick={handleClear}
            disabled={!amount}
            id="conv-clear-btn"
          >
            {t('portfolio.pnlClear')}
          </button>
        </div>
      </div>

      <div className="pnl-tracker-divider" />

      <div className="pnl-tracker-right">
        <div className="pnl-tracker-stats">
          <div className="pnl-tracker-stat">
            <div className="pnl-stat-label">{t('portfolio.convTryEquivalent')}</div>
            <div className="pnl-stat-amount">₺{formatTRY(tryValue)}</div>
            <div className="pnl-stat-sub">
              {hasAmount && liveRate
                ? `1 ${currency} = ₺${formatRate(liveRate)}`
                : t('portfolio.convHint')}
            </div>
          </div>
        </div>

        <div className="pnl-tracker-spark" aria-hidden="true">
          <svg viewBox="0 0 110 44" preserveAspectRatio="none">
            <defs>
              <linearGradient id="convSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`${sparkPath} L 110 44 L 0 44 Z`}
              fill="url(#convSparkFill)"
              stroke="none"
            />
            <path
              d={sparkPath}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default PnLTracker;
