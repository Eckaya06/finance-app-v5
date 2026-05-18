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

const AddPotForm = ({ onAddPot, onClose }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [theme, setTheme] = useState(null);
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
    onAddPot({ name, target: parseFloat(target), theme });
    onClose();
  };

  const handleThemeSelect = (selectedTheme) => {
    setTheme(selectedTheme);
    setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="add-pot-form">
      <h2>{t('addPotForm.title')}</h2>
      <p>{t('addPotForm.subtitle')}</p>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="pot-name">{t('addPotForm.name')}</label>
        <input
          id="pot-name" type="text" value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder={t('addPotForm.namePlaceholder')}
        />
      </div>

      <div className="form-group">
        <label htmlFor="pot-target">{t('addPotForm.target')}</label>
        <input
          id="pot-target" type="number" value={target}
          onChange={(e) => { setTarget(e.target.value); setError(''); }}
          placeholder={t('addPotForm.targetPlaceholder')}
        />
      </div>

      <div className="form-group">
        <label>{t('addPotForm.theme')}</label>
        <div className="theme-picker-row" role="radiogroup" aria-label={t('addPotForm.theme')}>
          {themeOptionsMeta.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className={`theme-picker-dot ${theme === option.value ? 'active' : ''}`}
              style={{ backgroundColor: option.color }}
              title={t(option.tKey)}
              onClick={() => handleThemeSelect(option.value)}
            />
          ))}
        </div>
      </div>

      <button type="submit" className="btn-primary form-submit-btn">{t('addPotForm.submit')}</button>
    </form>
  );
};

export default AddPotForm;
