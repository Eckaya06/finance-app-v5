import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './EditBudgetForm.css';

const themeOptionsMeta = [
  { value: 'blue',   tKey: 'themes.blue',   color: '#3b82f6' },
  { value: 'cyan',   tKey: 'themes.cyan',   color: '#06b6d4' },
  { value: 'green',  tKey: 'themes.green',  color: '#22c55e' },
  { value: 'orange', tKey: 'themes.orange', color: '#f97316' },
  { value: 'indigo', tKey: 'themes.indigo', color: '#6366f1' },
  { value: 'red',    tKey: 'themes.red',    color: '#ef4444' },
  { value: 'purple', tKey: 'themes.purple', color: '#8b5cf6' },
];

const categoryOptions = [
  "Entertainment", "Bills", "Groceries", "Dining Out", "Transportation",
  "Personal Care", "Education", "Lifestyle", "Shopping", "General"
];

const EditBudgetForm = ({ budget, onUpdateBudget }) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState(budget?.category || '');
  const [limit, setLimit] = useState(budget?.limit || budget?.maxSpend || '');
  const [theme, setTheme] = useState(budget?.theme || null);
  const [error, setError] = useState('');

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!category) {
      setError(t('addBudgetForm.errors.chooseCategory'));
      return;
    }
    if (!limit || parseFloat(limit) <= 0) {
      setError(t('addBudgetForm.errors.validAmount'));
      return;
    }
    if (!theme) {
      setError(t('addBudgetForm.errors.chooseTheme'));
      return;
    }

    onUpdateBudget(budget.id, {
      category,
      limit: parseFloat(limit),
      theme
    });
  };

  return (
    <form onSubmit={handleSubmit} className="edit-budget-form">
      <h2>{t('editBudgetForm.title')}</h2>
      <p>{t('editBudgetForm.subtitle')}</p>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="form-group">
        <label>{t('addBudgetForm.category')}</label>
        <div className="custom-select-container">
          <button
            type="button"
            className="select-selected-value"
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
          >
            {category ? (
              <span className="selected-label-text">{t(`categories.${category}`, { defaultValue: category })}</span>
            ) : (
              <span className="select-placeholder">{t('addBudgetForm.chooseCategory')}</span>
            )}
            <span className={`select-arrow ${isCategoryDropdownOpen ? 'open' : ''}`}>▼</span>
          </button>

          {isCategoryDropdownOpen && (
            <ul className="select-options">
              {categoryOptions.map(option => (
                <li
                  key={option}
                  className="select-option"
                  onClick={() => {
                    setCategory(option);
                    setIsCategoryDropdownOpen(false);
                    setError('');
                  }}
                >
                  {t(`categories.${option}`, { defaultValue: option })}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="form-group">
        <label>{t('addBudgetForm.maxSpend')}</label>
        <input
          type="number"
          value={limit}
          onChange={(e) => { setLimit(e.target.value); setError(''); }}
          placeholder="e.g., 2000"
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label>{t('addBudgetForm.theme')}</label>
        <div className="theme-picker-row" role="radiogroup" aria-label={t('addBudgetForm.theme')}>
          {themeOptionsMeta.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className={`theme-picker-dot ${theme === option.value ? 'active' : ''}`}
              style={{ backgroundColor: option.color }}
              title={t(option.tKey)}
              onClick={() => { setTheme(option.value); setError(''); }}
            />
          ))}
        </div>
      </div>

      <button type="submit" className="form-submit-btn">
        {t('editBudgetForm.submit')}
      </button>
    </form>
  );
};

export default EditBudgetForm;
