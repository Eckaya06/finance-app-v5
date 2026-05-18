import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ASSET_META from './assetMeta.js';

const ASSET_OPTIONS = [
  { value: 'USD', group: 'Currencies' },
  { value: 'EUR', group: 'Currencies' },
  { value: 'GBP', group: 'Currencies' },
  { value: 'JPY', group: 'Currencies' },
  { value: 'CHF', group: 'Currencies' },
  { value: 'CAD', group: 'Currencies' },
  { value: 'GOLD_GRAM', group: 'Gold' },
  { value: 'GOLD_QUARTER', group: 'Gold' },
  { value: 'GOLD_OUNCE', group: 'Gold' },
];

// `lockedAsset` — when provided, the form is reused for "add more to an
// existing holding": asset is pre-selected and not pickable. The user only
// enters amount + price (with live-rate prefill), same as the regular flow.
const AddAssetForm = ({ onAddAsset, onClose, getCurrentRate, lockedAsset = null }) => {
  const { t } = useTranslation();
  const [asset, setAsset] = useState(lockedAsset || null);
  const [amount, setAmount] = useState('');
  // User-entered purchase price (TRY per unit). Prefilled with the live rate
  // when an asset is picked, but the user can override it to reflect what they
  // actually paid (e.g. "I bought 1g gold at 6800 TL last week"). avgBuyPrice
  // and PnL on the holdings table are then computed from this real cost basis.
  const [price, setPrice] = useState(() => {
    if (!lockedAsset) return '';
    const rate = getCurrentRate(lockedAsset);
    return rate ? String(rate) : '';
  });
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [error, setError] = useState('');

  const liveRate = asset ? getCurrentRate(asset) : 0;
  const priceNum = parseFloat(price);
  const amountNum = parseFloat(amount);
  const totalCost = useMemo(() => {
    if (!Number.isFinite(priceNum) || !Number.isFinite(amountNum)) return 0;
    return priceNum * amountNum;
  }, [priceNum, amountNum]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!asset) {
      setError(t('addAssetForm.errors.chooseAsset'));
      return;
    }
    if (!amount || amountNum <= 0) {
      setError(t('addAssetForm.errors.validAmount'));
      return;
    }
    if (!price || priceNum <= 0) {
      setError(t('addAssetForm.errors.validPrice'));
      return;
    }

    onAddAsset({
      assetType: asset,
      amount: amountNum,
      pricePerUnit: priceNum,
    });

    onClose();
  };

  const handleAssetSelect = (selectedAsset) => {
    setAsset(selectedAsset);
    setIsAssetOpen(false);
    setError('');
    // Prefill the price with the live rate so a user who doesn't care about
    // a historical cost basis can just submit. Empty string when deselected.
    if (selectedAsset) {
      const rate = getCurrentRate(selectedAsset);
      setPrice(rate ? String(rate) : '');
    } else {
      setPrice('');
    }
  };

  const applyLiveRate = () => {
    if (!asset) return;
    const rate = getCurrentRate(asset);
    if (rate) setPrice(String(rate));
  };

  const selectedAssetMeta = asset ? ASSET_META[asset] : null;

  return (
    <form onSubmit={handleSubmit} className="add-pot-form">
      <h2>
        {lockedAsset && selectedAssetMeta
          ? t('addAssetForm.titleLocked', { asset: selectedAssetMeta.label || lockedAsset })
          : t('addAssetForm.title')}
      </h2>
      <p>
        {lockedAsset
          ? t('addAssetForm.subtitleLocked')
          : t('addAssetForm.subtitle')}
      </p>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* 1. Asset Dropdown — hidden when asset is locked (adding to an
          existing holding); we already know which asset we're adding to. */}
      {!lockedAsset && (
      <div className="form-group">
        <label>{t('addAssetForm.asset')}</label>
        <div className="custom-select-container">
          <button
            type="button"
            className="select-selected-value"
            onClick={() => setIsAssetOpen(!isAssetOpen)}
          >
            <span className={!asset ? 'select-placeholder' : ''}>
              {selectedAssetMeta ? (
                <>
                  <span style={{ marginRight: '8px' }}>{selectedAssetMeta.icon}</span>
                  {selectedAssetMeta.label} ({asset})
                </>
              ) : t('addAssetForm.chooseAsset')}
            </span>
            <span className={`select-arrow ${isAssetOpen ? 'open' : ''}`}>▼</span>
          </button>
          {isAssetOpen && (
            <ul className="select-options" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <li className="select-option" onClick={() => handleAssetSelect(null)}>
                {t('addAssetForm.chooseAsset')}
              </li>
              <li disabled className="select-option" style={{ fontWeight: 'bold', backgroundColor: 'var(--bg)', cursor: 'default' }}>
                {t('portfolio.currencies')}
              </li>
              {ASSET_OPTIONS.filter((a) => a.group === 'Currencies').map(option => (
                <li key={option.value} className="select-option" onClick={() => handleAssetSelect(option.value)} style={{ paddingLeft: '24px' }}>
                  {ASSET_META[option.value]?.icon} {ASSET_META[option.value]?.label}
                </li>
              ))}
              <li disabled className="select-option" style={{ fontWeight: 'bold', backgroundColor: 'var(--bg)', cursor: 'default' }}>
                {t('portfolio.gold')}
              </li>
              {ASSET_OPTIONS.filter((a) => a.group === 'Gold').map(option => (
                <li key={option.value} className="select-option" onClick={() => handleAssetSelect(option.value)} style={{ paddingLeft: '24px' }}>
                  {ASSET_META[option.value]?.icon} {ASSET_META[option.value]?.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      )}

      {/* 2. Amount Input */}
      <div className="form-group">
        <label htmlFor="asset-amount">{t('addAssetForm.amount')}</label>
        <div className="input-with-prefix">
          <span>{selectedAssetMeta ? selectedAssetMeta.icon : '✦'}</span>
          <input 
            id="asset-amount"
            type="number"
            step="any"
            min="0.000001"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(''); }}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* 3. Purchase Price (editable — user enters what they actually paid) */}
      <div className="form-group">
        <label htmlFor="asset-price" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('addAssetForm.purchasePrice')}</span>
          {asset && liveRate > 0 && (
            <button
              type="button"
              onClick={applyLiveRate}
              style={{
                background: 'none', border: 'none', color: 'var(--accent, #6366f1)',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: 0,
              }}
            >
              {t('addAssetForm.useLiveRate', { rate: liveRate.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) })}
            </button>
          )}
        </label>
        <div className="input-with-prefix">
          <span>₺</span>
          <input
            id="asset-price"
            type="number"
            step="any"
            min="0.000001"
            value={price}
            onChange={(e) => { setPrice(e.target.value); setError(''); }}
            placeholder="0.00"
            disabled={!asset}
          />
        </div>
      </div>

      {/* 4. Total Cost Preview (computed from amount × purchase price) */}
      <div className="form-group">
        <label>{t('addAssetForm.totalCost')}</label>
        <div className="input-with-prefix">
          <span>₺</span>
          <input
            type="text"
            value={totalCost > 0
              ? totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '0.00'}
            readOnly
            className="add-asset-price-readonly"
          />
        </div>
      </div>

      <button type="submit" className="btn-primary form-submit-btn">{t('addAssetForm.submit')}</button>
    </form>
  );
};

export default AddAssetForm;
