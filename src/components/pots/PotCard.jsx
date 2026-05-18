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
      {/* Tamamlanmış pot için "Completed" ribbon kaldırıldı — kart altındaki
          locked banner zaten net bir tamamlanma göstergesi ve ribbon sağ
          üstteki ⋯ menü butonunu görsel olarak kapatıyordu. Yeşil çerçeve
          ve banner birlikte tamamlanma sinyalini veriyor. */}
      <div className="pot-card-header">
        <div className="pot-icon"></div>
        <h3>{pot.name}</h3>
        {isCompleted && (
          <span className="pot-completed-pill" title={t('potCard.lockedTooltip')}>
            <FiCheck aria-hidden="true" />
            {t('potCard.completedBadge')}
          </span>
        )}

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
      {isCompleted ? (
        /* Pot tamamlanmış → butonlar yerine kilitli mesajı göster.
           Düzenle butonu hâlâ ⋯ menüsünden erişilebilir. */
        <div className="pot-locked-banner" role="status">
          <div className="pot-locked-title">{t('potCard.lockedMessage')}</div>
          <div className="pot-locked-hint">{t('potCard.lockedHint')}</div>
        </div>
      ) : (
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
      )}

      {showError && (
        <p className="pot-action-error">{potActionError.message}</p>
      )}
    </div>
  );
};

export default PotCard;
