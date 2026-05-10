import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const WithdrawMoneyForm = ({ pot, onConfirm, onClose }) => {
  const { t } = useTranslation();
  const [amountToWithdraw, setAmountToWithdraw] = useState('');
  const [remainingAmount, setRemainingAmount] = useState(pot.saved);
  const [newProgress, setNewProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const withdrawnValue = parseFloat(amountToWithdraw) || 0;

    if (withdrawnValue > pot.saved) {
      setError(t('withdrawForm.errorExceeds'));
    } else {
      setError('');
    }

    const potentialRemainingAmount = Math.max(0, pot.saved - withdrawnValue);
    setRemainingAmount(potentialRemainingAmount);
    setNewProgress(pot.target > 0 ? (potentialRemainingAmount / pot.target) * 100 : 0);
  }, [amountToWithdraw, pot.saved, pot.target, t]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const withdrawnValue = parseFloat(amountToWithdraw);

    if (error) return;

    if (isNaN(withdrawnValue) || withdrawnValue <= 0) {
      setError(t('withdrawForm.errorInvalid'));
      return;
    }

    if (withdrawnValue > pot.saved) {
      setError(t('withdrawForm.errorExceeds'));
      return;
    }

    onConfirm(pot.id, withdrawnValue);
    onClose();
  };

  const isInvalid = error || isNaN(parseFloat(amountToWithdraw)) || parseFloat(amountToWithdraw) <= 0;

  return (
    <form onSubmit={handleSubmit} className="withdraw-money-form">
      <h2>{t('withdrawForm.title', { name: pot.name })}</h2>
      <p>{t('withdrawForm.subtitle')}</p>

      <div className="preview-section">
        <p className="preview-label">{t('withdrawForm.remaining')}</p>
        <p className="preview-amount">₺{remainingAmount.toFixed(2)}</p>
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
        <label htmlFor="amount-to-withdraw">{t('withdrawForm.amountToWithdraw')}</label>
        <input
          id="amount-to-withdraw"
          type="number"
          value={amountToWithdraw}
          onChange={(e) => setAmountToWithdraw(e.target.value)}
          placeholder="₺ 20"
          step="0.01"
          className={error ? 'input-error' : ''}
        />
        {error && <p className="form-error">{error}</p>}
      </div>

      <button
        type="submit"
        className="btn-primary form-submit-btn"
        disabled={isInvalid}
      >
        {t('withdrawForm.submit')}
      </button>
    </form>
  );
};

export default WithdrawMoneyForm;
