import { useState, useEffect } from 'react';
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

const BuyForm = ({ rates, onBuy, getCurrentRate }) => {
  const { t } = useTranslation();
  const [assetType, setAssetType] = useState('USD');
  const [amount, setAmount] = useState('');
  // User-entered purchase price (TRY per unit). Tracks `priceTouched` so live
  // rate ticks don't overwrite what the user typed; switching asset resets
  // both so the new asset's live rate prefills cleanly.
  const [price, setPrice] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const liveRate = getCurrentRate(assetType);
  const priceNum = parseFloat(price);
  const amountNum = parseFloat(amount);
  const total = Number.isFinite(amountNum) && Number.isFinite(priceNum)
    ? amountNum * priceNum
    : 0;

  // Prefill price with live rate whenever the user hasn't manually edited it.
  // Covers both "rates loaded after mount" and "asset changed → reset to live".
  useEffect(() => {
    if (!priceTouched && liveRate > 0) {
      setPrice(String(liveRate));
    }
  }, [liveRate, priceTouched]);

  const handleAssetChange = (nextType) => {
    setAssetType(nextType);
    setPriceTouched(false);
    const rate = getCurrentRate(nextType);
    setPrice(rate ? String(rate) : '');
  };

  const applyLiveRate = () => {
    if (liveRate > 0) {
      setPrice(String(liveRate));
      setPriceTouched(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amountNum <= 0) return;
    if (!price || priceNum <= 0) return;

    setSubmitting(true);
    await onBuy({
      assetType,
      amount: amountNum,
      pricePerUnit: priceNum,
    });
    setSubmitting(false);
    setAmount('');
    setPriceTouched(false);
    const rate = getCurrentRate(assetType);
    setPrice(rate ? String(rate) : '');
  };

  return (
    <div className="buy-form-card" id="buy-form">
      <h3>
        <span className="form-icon">+</span>
        Buy Asset
      </h3>
      <form onSubmit={handleSubmit}>
        {/* Asset Selection */}
        <div className="form-field">
          <label htmlFor="asset-select">Asset Type</label>
          <select
            id="asset-select"
            value={assetType}
            onChange={(e) => handleAssetChange(e.target.value)}
          >
            <optgroup label="Currencies">
              {ASSET_OPTIONS.filter((a) => a.group === 'Currencies').map((a) => (
                <option key={a.value} value={a.value}>
                  {ASSET_META[a.value]?.icon} {ASSET_META[a.value]?.label} ({a.value})
                </option>
              ))}
            </optgroup>
            <optgroup label="Gold">
              {ASSET_OPTIONS.filter((a) => a.group === 'Gold').map((a) => (
                <option key={a.value} value={a.value}>
                  {ASSET_META[a.value]?.icon} {ASSET_META[a.value]?.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Amount */}
        <div className="form-field">
          <label htmlFor="buy-amount">Amount</label>
          <input
            id="buy-amount"
            type="number"
            step="any"
            min="0.000001"
            placeholder="Enter amount..."
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* Purchase Price (editable — what the user actually paid) */}
        <div className="form-field">
          <label htmlFor="buy-price" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('addAssetForm.purchasePrice')}</span>
            {liveRate > 0 && priceTouched && (
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
          <input
            id="buy-price"
            type="number"
            step="any"
            min="0.000001"
            value={price}
            onChange={(e) => { setPrice(e.target.value); setPriceTouched(true); }}
            placeholder="0.00"
          />
        </div>

        {/* Total Cost — computed from amount × purchase price */}
        <div className="form-total">
          <span className="form-total-label">{t('addAssetForm.totalCost')}</span>
          <span className="form-total-value">
            ₺{total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="buy-submit-btn"
          disabled={!amount || amountNum <= 0 || !price || priceNum <= 0 || submitting}
          id="buy-submit-btn"
        >
          {submitting ? '⏳ Processing...' : '📈 Buy Now'}
        </button>
      </form>
    </div>
  );
};

export default BuyForm;
