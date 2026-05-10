import { FiMoreHorizontal } from 'react-icons/fi';
import './BudgetDetailCard.css';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BudgetOptionsMenu from './BudgetOptionsMenu.jsx';

const BudgetDetailCard = ({ budget, onEditRequest, onDeleteRequest, isMenuOpen, onOptionsToggle }) => {
  const { t, i18n } = useTranslation();
  const spent = Number(budget.spent || 0);
  const limitNum = Number(budget.limit || budget.maxSpend || 0);
  const remaining = limitNum - spent;

  const latestTransactions = budget.latestSpending || [];

  const spentPercentage = limitNum > 0 ? (spent / limitNum) * 100 : 0;
  const remainingPercentage = limitNum > 0 ? Math.max(0, (remaining / limitNum) * 100) : 0;

  const theme = themeOptions.find(t => t.value === budget.theme) || themeOptions[0];

  const dateLocale = i18n.resolvedLanguage?.toLowerCase().startsWith('tr') ? 'tr-TR' : 'en-GB';
  const creationDate = budget.createdAt
    ? new Date(budget.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
    : t('common.unknown');

  return (
    <div className="budget-detail-card" style={{ position: 'relative' }}>
      <div className="card-header">
        <div className="theme-option-display" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="theme-color-swatch" style={{ backgroundColor: theme.color, width: '12px', height: '12px', borderRadius: '50%' }}></span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{t(`categories.${budget.category}`, { defaultValue: budget.category })}</h3>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{t('common.createdAt')}: {creationDate}</span>
          </div>
        </div>
        
        {/* ✅ YENİ: Tıklandığında kendi iç state'ini değil, ana sayfadaki fonksiyonu tetikler */}
        <button className="pot-options-btn" onClick={onOptionsToggle}>
          <FiMoreHorizontal size={18} />
        </button>
      </div>

      {isMenuOpen && (
        <BudgetOptionsMenu 
          onEdit={onEditRequest}
          onDelete={onDeleteRequest}
        />
      )}

      <p className="budget-limit-text">{t('budgetDetailCard.maxSpend', { limit: limitNum.toFixed(2) })}</p>
      
      <div className="progress-bar-container" style={{ background: '#f8fafc', padding: '3px', height: '12px', marginTop: '5px' }}>
        <div 
          className="progress-bar-fill" 
          style={{ 
            width: `${remainingPercentage}%`, 
            backgroundColor: theme.color,
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' 
          }}
        ></div>
      </div>
      
      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', textAlign: 'right', fontWeight: '700' }}>
        {t('budgetDetailCard.spentPercent', { percent: spentPercentage.toFixed(1) })}
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