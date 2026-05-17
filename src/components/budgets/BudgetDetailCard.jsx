import { FiMoreHorizontal } from 'react-icons/fi';
import './BudgetDetailCard.css';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BudgetOptionsMenu from './BudgetOptionsMenu.jsx';

const BudgetDetailCard = ({ budget, onEditRequest, onDeleteRequest, isMenuOpen, onOptionsToggle }) => {
  const { t } = useTranslation();
  const spent = Number(budget.spent || 0);
  const limitNum = Number(budget.limit || budget.maxSpend || 0);
  const remaining = limitNum - spent;

  const latestTransactions = budget.latestSpending || [];

  const spentPercentage = limitNum > 0 ? (spent / limitNum) * 100 : 0;
  // Bar artık "kalan bütçe"yi gösterir: dolu başlar, harcandıkça boşalır.
  const remainingPercentage = Math.max(0, 100 - spentPercentage);

  const theme = themeOptions.find((opt) => opt.value === budget.theme) || themeOptions[0];

  return (
    <div className="budget-detail-card" style={{ position: 'relative' }}>
      <div className="card-header">
        <div className="card-header-main">
          <h3 className="card-title">
            {t(`categories.${budget.category}`, { defaultValue: budget.category })}
          </h3>
          <p className="budget-limit-text">
            {t('budgetDetailCard.maxSpend', { limit: limitNum.toFixed(2) })}
          </p>
        </div>

        <div className="card-header-actions">
          <span
            className={`budget-percent-badge ${
              spentPercentage >= 90
                ? 'is-danger'
                : spentPercentage >= 50
                  ? 'is-warn'
                  : 'is-ok'
            }`}
          >
            {spentPercentage.toFixed(0)}%
          </span>
          <button className="pot-options-btn" onClick={onOptionsToggle}>
            <FiMoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <BudgetOptionsMenu
          onEdit={onEditRequest}
          onDelete={onDeleteRequest}
        />
      )}

      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{
            width: `${remainingPercentage}%`,
            backgroundColor: theme.color,
          }}
        />
      </div>

      <div className="budget-spend-summary">
        <div className="summary-item">
          <span className="summary-label">{t('budgetDetailCard.spent')}</span>
          <span className="summary-value">₺{spent.toFixed(2)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">{t('budgetDetailCard.remaining')}</span>
          <span className={`summary-value ${remaining < 0 ? 'negative' : ''}`}>
            ₺{remaining.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="latest-spending">
        <div className="latest-spending-header">
          <h4>{t('budgetDetailCard.latestSpending')}</h4>
          <Link
            to={`/transactions?category=${encodeURIComponent(budget.category)}&since=${budget.createdAt || 0}`}
            className="see-all-link"
          >
            {t('common.seeAll')}
          </Link>
        </div>

        <div className="latest-spending-list">
          {latestTransactions.length === 0 ? (
            <div className="latest-empty" style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#94a3b8' }}>
              {t('budgetDetailCard.noSpending')}
            </div>
          ) : (
            latestTransactions.map((tx) => (
              <div className="latest-row" key={tx.id}>
                <div className="latest-left">
                  <span className="latest-name">{tx.title || tx.name}</span>
                  <span className="latest-date">{tx.date}</span>
                </div>
                <span className="latest-amount">-₺{Math.abs(Number(tx.amount)).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const themeOptions = [
  { value: 'blue',   label: 'Blue',   color: '#3b82f6' },
  { value: 'cyan',   label: 'Cyan',   color: '#06b6d4' },
  { value: 'green',  label: 'Green',  color: '#22c55e' },
  { value: 'orange', label: 'Orange', color: '#f97316' },
  { value: 'indigo', label: 'Indigo', color: '#6366f1' },
  { value: 'red',    label: 'Red',    color: '#ef4444' },
  { value: 'purple', label: 'Purple', color: '#8b5cf6' },
];

export default BudgetDetailCard;