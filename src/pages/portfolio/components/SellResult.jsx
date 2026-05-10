import ASSET_META from './assetMeta.js';

const SellResult = ({ result, onClose }) => {
  if (!result) return null;

  const { assetType, amount, sellPrice, avgBuyPrice, pnl } = result;
  const meta = ASSET_META[assetType] || {};
  const isProfit = pnl >= 0;
  const totalRevenue = amount * sellPrice;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sell-result-modal" onClick={(e) => e.stopPropagation()}>
        {/* Success Header */}
        <div className={`sell-result-header ${isProfit ? 'profit' : 'loss'}`}>
          <span className="sell-result-icon">{isProfit ? '🎉' : '📉'}</span>
          <h3>Transaction Complete!</h3>
          <p className="sell-result-sub">
            Successfully sold {amount} {meta.icon} {assetType}
          </p>
        </div>

        {/* Transaction Details */}
        <div className="sell-result-details">
          <div className="sell-result-row">
            <span className="sell-result-label">Sell Amount</span>
            <span className="sell-result-value">{amount.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}</span>
          </div>
          <div className="sell-result-row">
            <span className="sell-result-label">Sell Price</span>
            <span className="sell-result-value">₺{sellPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="sell-result-row">
            <span className="sell-result-label">Avg. Buy Price</span>
            <span className="sell-result-value">₺{avgBuyPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="sell-result-row">
            <span className="sell-result-label">Total Revenue</span>
            <span className="sell-result-value highlight">₺{totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* PnL Result */}
        <div className={`sell-result-pnl ${isProfit ? 'profit' : 'loss'}`}>
          <span className="sell-result-pnl-label">{isProfit ? '🎯 Profit Earned' : '📊 Loss Realized'}</span>
          <span className="sell-result-pnl-amount">
            {isProfit ? '+' : ''}₺{pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Close */}
        <button className="sell-result-close-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
};

export default SellResult;
