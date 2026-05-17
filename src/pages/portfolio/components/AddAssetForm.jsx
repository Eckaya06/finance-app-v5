import { useState } from 'react';
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

const AddAssetForm = ({ onAddAsset, onClose, getCurrentRate }) => {
  const { t } = useTranslation();
  const [asset, setAsset] = useState(null);
  const [amount, setAmount] = useState('');
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!asset) {
      setError(t('addAssetForm.errors.chooseAsset'));
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError(t('addAssetForm.errors.validAmount'));
      return;
    }

    const price = getCurrentRate(asset);
    
    onAddAsset({ 
      assetType: asset, 
      amount: parseFloat(amount), 
      pricePerUnit: price 
    });
    
    onClose();
  };

  const handleAssetSelect = (selectedAsset) => {
    setAsset(selectedAsset);
    setIsAssetOpen(false);
    setError('');
  };

  const selectedAssetMeta = asset ? ASSET_META[asset] : null;

  return (
    <form onSubmit={handleSubmit} className="add-pot-form">
      <h2>{t('addAssetForm.title')}</h2>
      <p>{t('addAssetForm.subtitle')}</p>
      
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {error}
        </div>
      )}
      
      {/* 1. Asset Dropdown */}
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

      {/* 3. Live Price Preview (Read-Only) */}
      <div className="form-group">
        <label>{t('addAssetForm.currentPrice')}</label>
        <div className="input-with-prefix">
          <span>₺</span>
          <input
            type="text"
            value={asset && getCurrentRate(asset)
              ? getCurrentRate(asset)?.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) || '0'
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
