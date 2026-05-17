import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ASSET_META from './assetMeta.js';

const CURRENCY_ORDER = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD'];

const COUNTRY_BADGES = {
  USD: { code: 'US', bg: '#1e3a8a' },
  EUR: { code: 'EU', bg: '#1d4ed8' },
  GBP: { code: 'GB', bg: '#1e40af' },
  JPY: { code: 'JP', bg: '#b91c1c' },
  CHF: { code: 'CH', bg: '#b91c1c' },
  CAD: { code: 'CA', bg: '#dc2626' },
  GOLD_GRAM: { code: 'Au', bg: '#f59e0b' },
  GOLD_QUARTER: { code: 'Au', bg: '#d97706' },
  GOLD_OUNCE: { code: 'Au', bg: '#b45309' },
};

const METAL_INFO = {
  GOLD_GRAM:    { short: 'GOLD',    unit: 'Gold · per gram · XAU' },
  GOLD_QUARTER: { short: 'QUARTER', unit: 'Gold · 0.25 ounce · XAU/Q' },
  GOLD_OUNCE:   { short: 'OUNCE',   unit: 'Gold · 1 troy ounce · XAU/OZ' },
};

const FAV_STORAGE_KEY = 'portfolio-favs-v1';

const formatPrice = (num) =>
  num?.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const formatMetalPrice = (num) =>
  num?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const buildSparkPath = (seed, isPositive) => {
  const w = 88;
  const h = 30;
  const points = 14;
  const arr = [];
  for (let i = 0; i < points; i++) {
    const noise = Math.sin(i * 1.4 + seed) * 5 + Math.cos(i * 0.7 + seed * 1.3) * 3;
    const trend = isPositive ? -i * 0.6 : i * 0.6;
    arr.push(15 + noise + trend);
  }
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const range = max - min || 1;
  return arr
    .map((p, i) => {
      const x = (i / (points - 1)) * w;
      const y = ((p - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
};

const useTimeAgo = (lastUpdated) => {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((v) => v + 1), 30000);
    return () => clearInterval(id);
  }, []);
  if (!lastUpdated) return null;
  const diffSec = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000);
  if (diffSec < 60) return { value: `${diffSec}s` };
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return { value: `${mins}m` };
  const hrs = Math.floor(mins / 60);
  return { value: `${hrs}h` };
};

const RateCard = ({
  code,
  data,
  isGold = false,
  isFav,
  onToggleFav,
  lastUpdated,
}) => {
  const { t } = useTranslation();
  const badge = COUNTRY_BADGES[code] || { code: code.substring(0, 2), bg: '#6366f1' };
  const metalInfo = isGold ? METAL_INFO[code] : null;
  const displayCode = isGold ? metalInfo?.short || code : code;
  const fullName = t(`portfolio.assetNames.${code}`, {
    defaultValue: isGold
      ? data.name || ASSET_META[code]?.label || code
      : ASSET_META[code]?.label || code,
  });
  const isPositive = (data.change ?? 0) >= 0;
  const ago = useTimeAgo(lastUpdated);
  const sparkPath = useMemo(() => buildSparkPath(code.charCodeAt(0), isPositive), [code, isPositive]);

  const unitLabel = isGold ? metalInfo?.unit || 'Gold · XAU' : `1 ${code}`;
  const metalAccentClass = isGold ? 'metal' : '';

  return (
    <div className="rate-card-new" id={`rate-${code}`}>
      <div className="rate-card-new-top">
        <div
          className={`rate-card-new-badge ${metalAccentClass}`}
          style={{ background: badge.bg }}
        >
          {badge.code}
        </div>
        <div className="rate-card-new-info">
          <div className={`rate-card-new-code ${metalAccentClass}`}>
            {displayCode}
          </div>
          <div className="rate-card-new-name">{fullName}</div>
        </div>
        <button
          type="button"
          className={`rate-card-fav ${isFav ? 'is-fav' : ''}`}
          onClick={() => onToggleFav(code)}
          aria-label="favorite"
        >
          {isFav ? '★' : '☆'}
        </button>
      </div>

      <div className="rate-card-new-body">
        <div className="rate-card-new-price-row">
          <div className="rate-card-new-price-wrap">
            <span className={`rate-card-new-price ${metalAccentClass}`}>
              {isGold ? formatMetalPrice(data.rate) : formatPrice(data.rate)}
            </span>
            <span className="rate-card-new-currency">TRY</span>
          </div>
          <div className="rate-card-new-spark">
            <svg viewBox="0 0 88 30" preserveAspectRatio="none">
              <path
                d={sparkPath}
                fill="none"
                stroke={isPositive ? '#16a34a' : '#dc2626'}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
              />
            </svg>
          </div>
        </div>
        <div className="rate-card-new-updated">
          {ago ? t('portfolio.updatedAgo', { time: ago.value }) : t('portfolio.updatedJustNow')}
        </div>
      </div>

      <div className="rate-card-new-footer">
        <span className="rate-card-new-unit">{unitLabel}</span>
        <span className="rate-card-new-live">
          <span className="rate-live-dot"></span>
          {t('portfolio.live')}
        </span>
      </div>
    </div>
  );
};

const LiveRatesBanner = ({ rates, lastUpdated }) => {
  const { t } = useTranslation();
  const [favs, setFavs] = useState(() => {
    try {
      const raw = localStorage.getItem(FAV_STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  if (!rates) return null;

  const { currencies, gold, marketOpen } = rates;

  const toggleFav = (code) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const currencyEntries = [
    ...CURRENCY_ORDER.filter((c) => currencies[c]).map((c) => [c, currencies[c]]),
    ...Object.entries(currencies).filter(([code]) => !CURRENCY_ORDER.includes(code)),
  ];

  const goldEntries = Object.entries(gold || {});

  return (
    <div className="rates-banner">
      {marketOpen === false && (
        <div className="market-closed-banner" id="market-closed-banner">
          <span className="market-closed-icon">🔒</span>
          <div className="market-closed-text">
            <strong>{t('portfolio.marketClosed', 'Piyasalar Kapalı')}</strong>
            <span>
              {t(
                'portfolio.marketClosedMsg',
                'Hafta sonu olduğu için döviz piyasaları kapalıdır. Gösterilen veriler son işlem gününe aittir.'
              )}
            </span>
          </div>
        </div>
      )}

      {currencyEntries.length > 0 && (
        <section className="rates-section-new">
          <h4 className="rates-eyebrow">{t('portfolio.majorCurrencies')}</h4>
          <div className="rates-grid-new rates-grid-3">
            {currencyEntries.map(([code, data]) => (
              <RateCard
                key={code}
                code={code}
                data={data}
                isFav={favs.has(code)}
                onToggleFav={toggleFav}
                lastUpdated={lastUpdated}
              />
            ))}
          </div>
        </section>
      )}

      {goldEntries.length > 0 && (
        <section className="rates-section-new">
          <h4 className="rates-eyebrow">{t('portfolio.preciousMetals')}</h4>
          <div className={`rates-grid-new ${goldEntries.length >= 3 ? 'rates-grid-3' : 'rates-grid-2'}`}>
            {goldEntries.map(([code, data]) => (
              <RateCard
                key={code}
                code={code}
                data={data}
                isGold
                isFav={favs.has(code)}
                onToggleFav={toggleFav}
                lastUpdated={lastUpdated}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default LiveRatesBanner;
