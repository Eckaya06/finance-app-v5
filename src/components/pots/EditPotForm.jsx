import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './EditPotForm.css';

const themeOptionsMeta = [
  { value: 'blue',   tKey: 'themes.blue',   color: '#3b82f6' },
  { value: 'cyan',   tKey: 'themes.cyan',   color: '#06b6d4' },
  { value: 'green',  tKey: 'themes.green',  color: '#22c55e' },
  { value: 'orange', tKey: 'themes.orange', color: '#f97316' },
  { value: 'indigo', tKey: 'themes.indigo', color: '#6366f1' },
  { value: 'red',    tKey: 'themes.red',    color: '#ef4444' },
  { value: 'purple', tKey: 'themes.purple', color: '#8b5cf6' },
];

const EditPotForm = ({ pot, onUpdatePot }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(pot?.name || '');
  const [target, setTarget] = useState(pot?.target || '');
  const [theme, setTheme] = useState(pot?.theme || null);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!name) {
      setError(t('addPotForm.errors.enterName'));
      return;
    }
    if (!target || parseFloat(target) <= 0) {
      setError(t('addPotForm.errors.validTarget'));
      return;
    }
    if (!theme) {
      setError(t('addPotForm.errors.chooseTheme'));
      return;
    }

    onUpdatePot(pot.id, {
      name,
      target: parseFloat(target),
      theme
    });
  };

  const selectedThemeObject = themeOptionsMeta.find(opt => opt.value === theme);

  return (
    <form onSubmit={handleSubmit} className="edit-pot-form">
      <h2>{t('editPotForm.title')}</h2>
      <p>{t('editPotForm.subtitle')}</p>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="pot-name">{t('addPotForm.name')}</label>
        <input
          id="pot-name"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder={t('addPotForm.namePlaceholder')}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="pot-target">{t('addPotForm.target')}</label>
        <input
          id="pot-target"
          type="number"
          value={target}
          onChange={(e) => { setTarget(e.target.value); setError(''); }}
          placeholder={t('addPotForm.targetPlaceholder')}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label>{t('addPotForm.theme')}</label>
        <div className="custom-select-container">
          <button
            type="button"
            className="select-selected-value"
            onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
          >
            {selectedThemeObject ? (
              <div className="theme-option-display">
                <span
                  className="theme-color-swatch"
                  style={{ backgroundColor: selectedThemeObject.color }}
                ></span>
                <span className="selected-label-text">{t(selectedThemeObject.tKey)}</span>
              </div>
            ) : (
              <span className="select-placeholder">{t('addPotForm.chooseTheme')}</span>
            )}
            <span className={`select-arrow ${isThemeDropdownOpen ? 'open' : ''}`}>▼</span>
          </button>

          {isThemeDropdownOpen && (
            <ul className="select-options">
              {themeOptionsMeta.map(option => (
                <li
                  key={option.value}
                  className="select-option"
                  onClick={() => {
                    setTheme(option.value);
                    setIsThemeDropdownOpen(false);
                    setError('');
                  }}
                >
                  <div className="theme-option-display">
                    <span
                      className="theme-color-swatch"
                      style={{ backgroundColor: option.color }}
                    ></span>
                    {t(option.tKey)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button type="submit" className="form-submit-btn">
        {t('editPotForm.submit')}
      </button>
    </form>
  );
};

export default EditPotForm;
