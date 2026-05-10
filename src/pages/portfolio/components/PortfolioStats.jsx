const PortfolioStats = ({ summary }) => {
  if (!summary) return null;

  const stats = [
    {
      label: 'Total Portfolio Value',
      value: `₺${summary.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
      pnlClass: '',
      sub: `${summary.assetCount} active asset${summary.assetCount !== 1 ? 's' : ''}`,
    },
    {
      label: 'Unrealised P&L',
      value: `${summary.totalUnrealisedPnl >= 0 ? '+' : ''}₺${summary.totalUnrealisedPnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
      pnlClass: summary.totalUnrealisedPnl >= 0 ? 'pnl-positive' : 'pnl-negative',
      sub: 'Open positions',
    },
    {
      label: 'Realised P&L',
      value: `${summary.totalRealisedPnl >= 0 ? '+' : ''}₺${summary.totalRealisedPnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
      pnlClass: summary.totalRealisedPnl >= 0 ? 'pnl-positive' : 'pnl-negative',
      sub: 'Closed positions',
    },
    {
      label: 'Total P&L',
      value: `${summary.totalPnl >= 0 ? '+' : ''}₺${summary.totalPnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
      pnlClass: summary.totalPnl >= 0 ? 'pnl-positive' : 'pnl-negative',
      sub: 'Combined result',
    },
  ];

  return (
    <div className="portfolio-stats">
      {stats.map((stat, idx) => (
        <div key={idx} className="stat-card" id={`stat-${idx}`}>
          <span className="stat-card-label">{stat.label}</span>
          <span className={`stat-card-value ${stat.pnlClass}`}>{stat.value}</span>
          <span className="stat-card-sub">{stat.sub}</span>
        </div>
      ))}
    </div>
  );
};

export default PortfolioStats;
