import './PotCard.css';
import { FiMoreHorizontal, FiCheck } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

const PotCard = ({ pot, onAddMoneyClick, onWithdrawClick, potActionError, onOptionsToggle, isOptionsMenuOpen, onDeleteClick, onEditClick }) => {
  const { t } = useTranslation();

  if (!pot) { return null; }

  const progressPercentage = pot.target > 0 ? (pot.saved / pot.target) * 100 : 0;
  const isCompleted = pot.target > 0 && pot.saved >= pot.target;

  const handleEdit = () => {
    onEditClick(pot.id);
  };

  const showError = potActionError && potActionError.potId === pot.id;

  return (
    <div className={`pot-card theme-${pot.theme} ${isCompleted ? 'is-completed' : ''}`} data-pot-id={pot.id}>
      {isCompleted && (
        /* Sağ üst köşede 45° diyagonal "TAMAMLANDI" ribbon'u. Kartın geri
           kalanı tamamen okunabilir kalır; ribbon kalıcı görsel işaret. */
        <div className="pot-completed-ribbon" aria-label={t('potCard.completedOverlayTitle')}>
          <span>
            <FiCheck aria-hidden="true" />
            {t('potCard.completedBadge')}
          </span>
        </div>
      )}
      <div className="pot-card-header">
        <div className="pot-icon"></div>
        <h3>{pot.name}</h3>

        <button
          className="pot-options-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOptionsToggle(pot.id);
          }}
        >
          <FiMoreHorizontal />
        </button>

        {isOptionsMenuOpen && (
          <div className="pot-options-menu" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleEdit}>{t('potCard.editPot')}</button>
            <button
              onClick={() => onDeleteClick(pot.id)}
              className="delete"
            >
              {t('potCard.deletePot')}
            </button>
          </div>
        )}
      </div>

      <div className="pot-amounts">
        <p className="amount-label">{t('potCard.totalSaved')}</p>
        <p className="amount-saved">₺{pot.saved.toFixed(2)}</p>
      </div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }}></div>
      </div>
      <div className="pot-target">
        <span>{progressPercentage.toFixed(0)}%</span>
        <span>{t('potCard.target', { target: pot.target.toFixed(0) })}</span>
      </div>
      <div className="pot-actions">
        <button
          className="btn-secondary"
          onClick={() => onAddMoneyClick(pot.id)}
        >
          {t('potCard.addMoney')}
        </button>
        <button
          className="btn-secondary"
          onClick={() => onWithdrawClick(pot.id)}
        >
          {t('potCard.withdraw')}
        </button>
      </div>

      {showError && (
        <p className="pot-action-error">{potActionError.message}</p>
      )}
    </div>
  );
};

export default PotCard;
