import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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

const AddBudgetForm = ({ onAddBudget, onClose }) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState(null);
  const [maxSpend, setMaxSpend] = useState('');
  const [theme, setTheme] = useState(null);
  const [error, setError] = useState('');

  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!category) {
      setError(t('addBudgetForm.errors.chooseCategory'));
      return;
    }
    if (!maxSpend || parseFloat(maxSpend) <= 0) {
      setError(t('addBudgetForm.errors.validAmount'));
      return;
    }
    if (!theme) {
      setError(t('addBudgetForm.errors.chooseTheme'));
      return;
    }

    onAddBudget({
      category,
      maxSpend: parseFloat(maxSpend),
      theme
    });

    onClose();
  };

  const handleThemeSelect = (selectedTheme) => {
    setTheme(selectedTheme);
    setIsThemeOpen(false);
    setError('');
  };
  const selectedThemeObject = themeOptionsMeta.find(opt => opt.value === theme);

  const handleCategorySelect = (selectedCategory) => {
    setCategory(selectedCategory);
    setIsCategoryOpen(false);
    setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="add-pot-form">
      <h2>{t('addBudgetForm.title')}</h2>
      <p>{t('addBudgetForm.subtitle')}</p>

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
            onClick={() => setIsCategoryOpen(!isCategoryOpen)}
          >
            <span className={!category ? 'select-placeholder' : ''}>
              {category ? t(`categories.${category}`, { defaultValue: category }) : t('addBudgetForm.chooseCategory')}
            </span>
            <span className={`select-arrow ${isCategoryOpen ? 'open' : ''}`}>▼</span>
          </button>
          {isCategoryOpen && (
            <ul className="select-options">
              <li className="select-option" onClick={() => handleCategorySelect(null)}>
                {t('addBudgetForm.chooseCategory')}
              </li>
              {categoryOptions.map(option => (
                <li key={option} className="select-option" onClick={() => handleCategorySelect(option)}>
                  {t(`categories.${option}`, { defaultValue: option })}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="max-spend">{t('addBudgetForm.maxSpend')}</label>
        <div className="input-with-prefix">
          <span>₺</span>
          <input
            id="max-spend"
            type="number"
            value={maxSpend}
            onChange={(e) => { setMaxSpend(e.target.value); setError(''); }}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="form-group">
        <label>{t('addBudgetForm.theme')}</label>
        <div className="custom-select-container">
          <button
            type="button"
            className="select-selected-value"
            onClick={() => setIsThemeOpen(!isThemeOpen)}
          >
            {selectedThemeObject ? (
              <div className="theme-option-display">
                <span className="theme-color-swatch" style={{ backgroundColor: selectedThemeObject.color }}></span>
                <span className="selected-label-text">{t(selectedThemeObject.tKey)}</span>
              </div>
            ) : (
              <span className="select-placeholder">{t('addBudgetForm.chooseTheme')}</span>
            )}
            <span className={`select-arrow ${isThemeOpen ? 'open' : ''}`}>▼</span>
          </button>
          {isThemeOpen && (
            <ul className="select-options">
              <li className="select-option" onClick={() => handleThemeSelect(null)}>
                {t('addBudgetForm.chooseTheme')}
              </li>
              {themeOptionsMeta.map(option => (
                <li key={option.value} className="select-option" onClick={() => handleThemeSelect(option.value)}>
                  <div className="theme-option-display">
                    <span className="theme-color-swatch" style={{ backgroundColor: option.color }}></span>
                    {t(option.tKey)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button type="submit" className="btn-primary form-submit-btn">{t('addBudgetForm.submit')}</button>
    </form>
  );
};

export default AddBudgetForm;
