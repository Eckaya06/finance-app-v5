import { useState } from 'react';
import ASSET_META from './assetMeta.js';

const SellModal = ({ holding, onConfirm, onCancel }) => {
  const [amount, setAmount] = useState(holding.currentHolding);
  const [submitting, setSubmitting] = useState(false);

  const meta = ASSET_META[holding.assetType] || {};
  const sellPrice = holding.liveRate;
  const pnl = (sellPrice - holding.avgBuyPrice) * amount;
  const isProfit = pnl >= 0;
  const totalRevenue = amount * sellPrice;

  const handleConfirm = async () => {
    if (!amount || amount <= 0 || amount > holding.currentHolding) return;
    setSubmitting(true);
    await onConfirm(holding.assetType, parseFloat(amount));
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="sell-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Sell {meta.icon} {holding.assetType}</h3>
        <p className="sell-modal-sub">
          {meta.label} — Current market price: ₺{sellPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </p>

        {/* Info Grid */}
        <div className="sell-modal-info">
          <div className="sell-modal-info-item">
            <span>Your Holdings</span>
            <span>{holding.currentHolding.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}</span>
          </div>
          <div className="sell-modal-info-item">
            <span>Avg. Buy Price</span>
            <span>₺{holding.avgBuyPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="sell-modal-info-item">
            <span>Live Rate</span>
            <span>₺{sellPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="sell-modal-info-item">
            <span>Total Revenue</span>
            <span>₺{totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Sell Amount */}
        <div className="form-field">
          <label htmlFor="sell-amount">Sell Amount</label>
          <input
            id="sell-amount"
            type="number"
            step="any"
            min="0.000001"
            max={holding.currentHolding}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* PnL Preview */}
        <div className={`sell-modal-pnl ${isProfit ? 'profit' : 'loss'}`}>
          <span className="pnl-label">Estimated {isProfit ? 'Profit' : 'Loss'}</span>
          <span className="pnl-amount">
            {isProfit ? '+' : ''}₺{pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Actions */}
        <div className="sell-modal-actions">
          <button className="modal-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="modal-confirm-sell-btn"
            onClick={handleConfirm}
            disabled={!amount || amount <= 0 || amount > holding.currentHolding || submitting}
            id="confirm-sell-btn"
          >
            {submitting ? 'Selling...' : `Sell ${holding.assetType}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SellModal;
