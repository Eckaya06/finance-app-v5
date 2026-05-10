import { useState } from 'react';
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
  const [assetType, setAssetType] = useState('USD');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentPrice = getCurrentRate(assetType);
  const total = amount && currentPrice ? (parseFloat(amount) * currentPrice) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0 || !currentPrice) return;

    setSubmitting(true);
    await onBuy({
      assetType,
      amount: parseFloat(amount),
      pricePerUnit: currentPrice,
    });
    setSubmitting(false);
    setAmount('');
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
            onChange={(e) => setAssetType(e.target.value)}
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

        {/* Price */}
        <div className="form-field">
          <label>Current Price (₺)</label>
          <input
            type="text"
            value={currentPrice ? `₺${currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '—'}
            readOnly
          />
        </div>

        {/* Total Cost */}
        <div className="form-total">
          <span className="form-total-label">Total Cost</span>
          <span className="form-total-value">
            ₺{total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="buy-submit-btn"
          disabled={!amount || parseFloat(amount) <= 0 || submitting}
          id="buy-submit-btn"
        >
          {submitting ? '⏳ Processing...' : '📈 Buy Now'}
        </button>
      </form>
    </div>
  );
};

export default BuyForm;
