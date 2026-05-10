import ASSET_META from './assetMeta.js';

const HoldingsTable = ({ holdings, loading, onSell, getCurrentRate }) => {
  if (loading) {
    return (
      <div className="holdings-section">
        <div className="holdings-header">
          <h2>My Holdings</h2>
        </div>
        <div style={{ padding: '24px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-block" style={{ height: '52px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!holdings || holdings.length === 0) {
    return (
      <div className="holdings-section">
        <div className="holdings-header">
          <h2>My Holdings</h2>
        </div>
        <div className="portfolio-empty">
          <div className="empty-icon">📊</div>
          <h3>No Holdings Yet</h3>
          <p>Start building your portfolio by buying your first asset using the form on the right.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="holdings-section">
      <div className="holdings-header">
        <h2>My Holdings</h2>
        <span className="holdings-count">{holdings.length} asset{holdings.length !== 1 ? 's' : ''}</span>
      </div>
      <table className="holdings-table" id="holdings-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Amount</th>
            <th>Avg. Price</th>
            <th>Live Rate</th>
            <th>Value</th>
            <th>P&L</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const meta = ASSET_META[h.assetType] || {};
            const isGold = meta.isGold;
            const pnl = h.unrealisedPnl;
            const pnlPercent = h.avgBuyPrice > 0
              ? ((h.liveRate - h.avgBuyPrice) / h.avgBuyPrice * 100)
              : 0;

            return (
              <tr key={h.assetType}>
                <td>
                  <div className="asset-name-cell">
                    <span className={`asset-badge ${isGold ? 'gold' : ''}`}>
                      {meta.icon || h.assetType.substring(0, 2)}
                    </span>
                    <div className="asset-info-text">
                      <span>{h.assetType}</span>
                      <span>{meta.label || ''}</span>
                    </div>
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>
                  {h.currentHolding.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}
                </td>
                <td>₺{h.avgBuyPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                <td>₺{h.liveRate.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                <td style={{ fontWeight: 600 }}>
                  ₺{h.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </td>
                <td>
                  <div className={`pnl-cell ${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                    <span>
                      {pnl >= 0 ? '+' : ''}₺{pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                    <span>{pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%</span>
                  </div>
                </td>
                <td>
                  <button
                    className="sell-btn"
                    onClick={() => onSell(h)}
                    id={`sell-${h.assetType}`}
                  >
                    Sell
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default HoldingsTable;
