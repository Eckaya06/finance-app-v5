import { useTranslation } from 'react-i18next';
import ASSET_META from './assetMeta.js';

const LiveRatesBanner = ({ rates }) => {
  const { t } = useTranslation();
  if (!rates) return null;

  const { currencies, gold, marketOpen } = rates;

  const formatNum = (num, decimals = 4) =>
    num?.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const goldColors = ['#16a34a', '#7c3aed', '#f59e0b'];

  return (
    <div className="rates-banner">
      {/* ── Market Closed Warning ── */}
      {marketOpen === false && (
        <div className="market-closed-banner" id="market-closed-banner">
          <span className="market-closed-icon">🔒</span>
          <div className="market-closed-text">
            <strong>{t('portfolio.marketClosed', 'Piyasalar Kapalı')}</strong>
            <span>{t('portfolio.marketClosedMsg', 'Hafta sonu olduğu için döviz piyasaları kapalıdır. Gösterilen veriler son işlem gününe aittir.')}</span>
          </div>
        </div>
      )}

      {/* ── Exchange Rates ── */}
      <div className="rates-section">
        <div className="rates-section-header">
          <h3 className="rates-section-title">{t('portfolio.exchangeRates')}</h3>
        </div>
        <div className="rates-grid-2col">
          {Object.entries(currencies).map(([code, data]) => {
            const meta = ASSET_META[code] || {};
            const isPositive = data.change >= 0;

            return (
              <div key={code} className="rate-card-v2" id={`rate-${code}`} style={{ '--accent': meta.color || '#6366f1' }}>
                <div className="rate-card-v2-top">
                  <div className="rate-card-v2-label">
                    <span className="rate-dot" style={{ background: meta.color || '#6366f1' }}></span>
                    <span className="rate-pair-code">{code}</span>
                    <span className="rate-pair-slash"> / TRY</span>
                  </div>
                  <span className={`rate-badge ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{data.changePercent?.toFixed(2)}%
                  </span>
                </div>

                <div className="rate-card-v2-price">
                  ₺{formatNum(data.rate)}
                </div>
                <div className={`rate-card-v2-change ${isPositive ? 'positive' : 'negative'}`}>
                  {isPositive ? '+' : ''}₺{data.change?.toFixed(4)}
                </div>

                <div className="rate-card-v2-stats">
                  <div className="rate-stat">
                    <span className="rate-stat-label">{t('portfolio.buying', 'Alış')}</span>
                    <span className="rate-stat-value">₺{formatNum(data.buying)}</span>
                  </div>
                  <div className="rate-stat">
                    <span className="rate-stat-label">{t('portfolio.selling', 'Satış')}</span>
                    <span className="rate-stat-value">₺{formatNum(data.selling)}</span>
                  </div>
                  <div className="rate-stat">
                    <span className="rate-stat-label">{t('portfolio.spread', 'Spread')}</span>
                    <span className="rate-stat-value">%{data.spread?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Gold Prices ── */}
      <div className="rates-section">
        <div className="rates-section-header">
          <h3 className="rates-section-title gold-title">{t('portfolio.goldPrices')}</h3>
        </div>
        <div className="rates-grid-gold">
          {Object.entries(gold).map(([code, data], idx) => {
            const meta = ASSET_META[code] || {};
            const isPositive = data.change >= 0;
            const accentColor = goldColors[idx % goldColors.length];
            const dailyChange = data.change || 0;

            return (
              <div
                key={code}
                className="gold-card-v2"
                id={`rate-${code}`}
                style={{ '--accent': accentColor }}
              >
                <div className="gold-card-v2-top">
                  <div className="gold-card-v2-name">
                    <span className="gold-dot" style={{ background: accentColor }}></span>
                    <span className="gold-label">{data.name || meta.label}</span>
                  </div>
                  <span className={`rate-badge ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? '+' : ''}{data.changePercent?.toFixed(2)}%
                  </span>
                </div>
                <div className="gold-card-v2-sub">
                  {meta.pair === 'XAU/G' ? '1 Gram' : meta.pair === 'XAU/Q' ? '0.25 Ounce' : '1 Troy Ounce'}
                </div>
                <div className="gold-card-v2-price">
                  ₺{data.rate.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`gold-card-v2-daily ${isPositive ? 'positive' : 'negative'}`}>
                  {isPositive ? '+' : ''}₺{dailyChange.toFixed(2)} {t('portfolio.today')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LiveRatesBanner;
