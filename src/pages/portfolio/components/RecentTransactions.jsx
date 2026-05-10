import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import ASSET_META from './assetMeta.js';

const RecentTransactions = ({ transactions }) => {
  const { t } = useTranslation();
  const [showAllModal, setShowAllModal] = useState(false);
  
  // Modal Filters
  const [filterAsset, setFilterAsset] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [sortBy, setSortBy] = useState('Newest');
  const [openDropdown, setOpenDropdown] = useState(null);

  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!transactions || transactions.length === 0) {
    return (
      <div className="recent-tx-card">
        <h3>{t('portfolio.recentTitle')}</h3>
        <div className="portfolio-empty" style={{ padding: '20px 0' }}>
          <p style={{ fontSize: '13px' }}>{t('portfolio.noTransactions')}</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    }) + ' ' + d.toLocaleTimeString('tr-TR', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const displayedTx = transactions.slice(0, 3);
  const hasMore = transactions.length > 3;

  const renderTransactionItem = (tx, idx) => {
    const isBuy = tx.transactionType === 'BUY';

    return (
      <div key={tx._id || idx} className="recent-tx-item">
        <div className="recent-tx-left">
          <span className={`recent-tx-type ${isBuy ? 'buy' : 'sell'}`}>
            {isBuy ? 'B' : 'S'}
          </span>
          <div className="recent-tx-info">
            <span>{isBuy ? t('portfolio.bought') : t('portfolio.sold')} {tx.assetType}</span>
            <span>{formatDate(tx.timestamp || tx.createdAt)}</span>
          </div>
        </div>
        <span className="recent-tx-amount">
          {tx.amount} × ₺{tx.pricePerUnit?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    );
  };

  // Filter and Sort Logic for Modal
  const availableAssets = ['All', ...new Set(transactions.map(t => t.assetType))];
  
  let processedTx = [...transactions];
  
  if (filterAsset !== 'All') {
    processedTx = processedTx.filter(t => t.assetType === filterAsset);
  }
  if (filterType !== 'All') {
    processedTx = processedTx.filter(t => t.transactionType === (filterType === 'Buy' ? 'BUY' : 'SELL'));
  }
  
  processedTx.sort((a, b) => {
    const dateA = new Date(a.timestamp || a.createdAt).getTime();
    const dateB = new Date(b.timestamp || b.createdAt).getTime();
    return sortBy === 'Newest' ? dateB - dateA : dateA - dateB;
  });

  return (
    <>
      <div className="recent-tx-card" id="recent-transactions">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>{t('portfolio.recentTitle')}</h3>
          {hasMore && (
            <button
              onClick={() => setShowAllModal(true)}
              style={{
                background: '#1f2937',
                border: 'none',
                color: '#f9fafb',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '6px 14px',
                borderRadius: '20px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#111827'}
              onMouseLeave={e => e.currentTarget.style.background = '#1f2937'}
            >
              {t('portfolio.seeAll')}
            </button>
          )}
        </div>
        <div className="recent-tx-list">
          {displayedTx.map(renderTransactionItem)}
        </div>
      </div>

      {showAllModal && createPortal(
        <div 
          className="portfolio-tx-modal-overlay" 
          onClick={() => setShowAllModal(false)} 
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(2px)' }}
        >
          <div 
            className="portfolio-tx-modal-content" 
            onClick={e => e.stopPropagation()} 
            style={{ background: 'var(--card)', border: '1px solid var(--border)', width: '90%', maxWidth: '550px', maxHeight: '85vh', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'visible', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text)' }}>{t('portfolio.allTransactions')}</h3>
              <button 
                onClick={() => setShowAllModal(false)} 
                style={{ background: 'none', border: 'none', fontSize: '24px', lineHeight: '1', color: 'var(--muted)', cursor: 'pointer', padding: '0 4px' }}
              >
                ×
              </button>
            </div>
            
            {/* Filters Area */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }} ref={dropdownRef}>
              
              {/* Asset Dropdown */}
              <div className="custom-select-container" style={{ flex: 1, minWidth: '120px' }}>
                <button type="button" className="select-selected-value" style={{ padding: '8px 12px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--border)' }} onClick={() => setOpenDropdown(openDropdown === 'asset' ? null : 'asset')}>
                  <span>{filterAsset === 'All' ? t('portfolio.allAssets') : filterAsset}</span>
                  <span className={`select-arrow ${openDropdown === 'asset' ? 'open' : ''}`}>▼</span>
                </button>
                {openDropdown === 'asset' && (
                  <ul className="select-options" style={{ zIndex: 10 }}>
                    {availableAssets.map(a => (
                      <li key={a} className="select-option" onClick={() => { setFilterAsset(a); setOpenDropdown(null); }}>
                        {a === 'All' ? t('portfolio.allAssets') : a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Type Dropdown */}
              <div className="custom-select-container" style={{ flex: 1, minWidth: '120px' }}>
                <button type="button" className="select-selected-value" style={{ padding: '8px 12px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--border)' }} onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}>
                  <span>{filterType === 'All' ? t('portfolio.allTypes') : (filterType === 'Buy' ? t('portfolio.buy') : t('portfolio.sell'))}</span>
                  <span className={`select-arrow ${openDropdown === 'type' ? 'open' : ''}`}>▼</span>
                </button>
                {openDropdown === 'type' && (
                  <ul className="select-options" style={{ zIndex: 10 }}>
                    <li className="select-option" onClick={() => { setFilterType('All'); setOpenDropdown(null); }}>{t('portfolio.allTypes')}</li>
                    <li className="select-option" onClick={() => { setFilterType('Buy'); setOpenDropdown(null); }}>{t('portfolio.buy')}</li>
                    <li className="select-option" onClick={() => { setFilterType('Sell'); setOpenDropdown(null); }}>{t('portfolio.sell')}</li>
                  </ul>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="custom-select-container" style={{ flex: 1, minWidth: '130px' }}>
                <button type="button" className="select-selected-value" style={{ padding: '8px 12px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--border)' }} onClick={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')}>
                  <span>{sortBy === 'Newest' ? t('portfolio.newest') : t('portfolio.oldest')}</span>
                  <span className={`select-arrow ${openDropdown === 'sort' ? 'open' : ''}`}>▼</span>
                </button>
                {openDropdown === 'sort' && (
                  <ul className="select-options" style={{ zIndex: 10 }}>
                    <li className="select-option" onClick={() => { setSortBy('Newest'); setOpenDropdown(null); }}>{t('portfolio.newest')}</li>
                    <li className="select-option" onClick={() => { setSortBy('Oldest'); setOpenDropdown(null); }}>{t('portfolio.oldest')}</li>
                  </ul>
                )}
              </div>

            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }} className="recent-tx-list">
              {processedTx.length > 0 ? (
                processedTx.map(renderTransactionItem)
              ) : (
                <div className="portfolio-empty" style={{ padding: '40px 0' }}>
                  <p>{t('portfolio.noFilterMatch')}</p>
                </div>
              )}
            </div>
          </div>
        </div>,
      document.body)}
    </>
  );
};

export default RecentTransactions;
