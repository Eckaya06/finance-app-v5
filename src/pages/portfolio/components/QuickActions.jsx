const QuickActions = ({ onRefresh, onExport }) => {
  const actions = [
    {
      icon: '🔄',
      label: 'Refresh',
      sub: 'Update data',
      onClick: onRefresh,
    },
    {
      icon: '📥',
      label: 'Export',
      sub: 'Download CSV',
      onClick: onExport || (() => {}),
    },
    {
      icon: '🔔',
      label: 'Alerts',
      sub: 'Set price alert',
      onClick: () => {},
    },
    {
      icon: '⚙️',
      label: 'Settings',
      sub: 'Preferences',
      onClick: () => {},
    },
  ];

  return (
    <div className="quick-actions-card" id="quick-actions">
      <h3 className="quick-actions-title">Quick Actions</h3>
      <div className="quick-actions-grid">
        {actions.map((action, idx) => (
          <button
            key={idx}
            className="quick-action-btn"
            onClick={action.onClick}
            id={`quick-action-${idx}`}
          >
            <span className="quick-action-icon">{action.icon}</span>
            <div className="quick-action-text">
              <span className="quick-action-label">{action.label}</span>
              <span className="quick-action-sub">{action.sub}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
