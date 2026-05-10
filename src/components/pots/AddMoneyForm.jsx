import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const AddMoneyForm = ({ pot, onConfirm, onClose }) => {
  const { t } = useTranslation();
  const [amountToAdd, setAmountToAdd] = useState('');
  const [newAmount, setNewAmount] = useState(pot.saved);
  const [newProgress, setNewProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const addedValue = parseFloat(amountToAdd) || 0;
    const potentialNewAmount = pot.saved + addedValue;
    setNewAmount(potentialNewAmount);
    setNewProgress(pot.target > 0 ? (potentialNewAmount / pot.target) * 100 : 0);
  }, [amountToAdd, pot.saved, pot.target]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const addedValue = parseFloat(amountToAdd);
    if (isNaN(addedValue) || addedValue <= 0) {
      setError(t('addMoneyForm.errorInvalid'));
      return;
    }
    onConfirm(pot.id, addedValue);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="add-money-form">
      <h2>{t('addMoneyForm.title', { name: pot.name })}</h2>
      <p>{t('addMoneyForm.subtitle')}</p>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="preview-section">
        <p className="preview-label">{t('addMoneyForm.newAmount')}</p>
        <p className="preview-amount">₺{newAmount.toFixed(2)}</p>
        <div className="progress-bar preview-progress">
          <div
            className={`progress-bar-fill theme-${pot.theme}`}
            style={{ width: `${Math.min(newProgress, 100)}%` }}
          ></div>
        </div>
        <div className="preview-target">
          <span>{Math.min(newProgress, 100).toFixed(0)}%</span>
          <span>{t('potCard.target', { target: pot.target.toFixed(0) })}</span>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="amount-to-add">{t('addMoneyForm.amountToAdd')}</label>
        <input
          id="amount-to-add"
          type="number"
          value={amountToAdd}
          onChange={(e) => { setAmountToAdd(e.target.value); setError(''); }}
          placeholder="₺ 400"
          step="0.01"
        />
      </div>
      <button type="submit" className="btn-primary form-submit-btn">{t('addMoneyForm.submit')}</button>
    </form>
  );
};

export default AddMoneyForm;
