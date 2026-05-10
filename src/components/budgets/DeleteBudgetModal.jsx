import { useTranslation } from 'react-i18next';
import './DeleteBudgetModal.css';

const DeleteBudgetModal = ({ budget, onConfirm, onClose }) => {
  const { t } = useTranslation();
  const categoryLabel = budget?.category ? t(`categories.${budget.category}`, { defaultValue: budget.category }) : '';
  return (
    <div className="delete-modal-container">
      <h2>{t('deleteBudget.title', { category: categoryLabel })}</h2>
      <p>{t('deleteBudget.message')}</p>
      <div className="delete-modal-actions">
        <button className="btn-delete-confirm" onClick={onConfirm}>
          {t('common.yesConfirm')}
        </button>
        <button className="btn-delete-cancel" onClick={onClose}>
          {t('common.noGoBack')}
        </button>
      </div>
    </div>
  );
};

export default DeleteBudgetModal;
