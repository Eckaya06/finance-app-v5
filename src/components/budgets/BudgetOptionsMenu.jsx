import { useTranslation } from 'react-i18next';
import './BudgetOptionsMenu.css';

const BudgetOptionsMenu = ({ onEdit, onDelete }) => {
  const { t } = useTranslation();
  return (
    <div className="budget-options-menu">
      <button onClick={onEdit} className="options-menu-item">
        {t('budgetOptions.edit')}
      </button>
      <div className="options-menu-divider" />
      <button onClick={onDelete} className="options-menu-item delete">
        {t('budgetOptions.delete')}
      </button>
    </div>
  );
};

export default BudgetOptionsMenu;
