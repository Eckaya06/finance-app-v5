import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';

  const setLang = (lng) => {
    if (lng !== current) i18n.changeLanguage(lng);
  };

  return (
    <div className="lang-switcher" role="group" aria-label="Language switcher">
      <button
        type="button"
        className={`lang-pill ${current === 'tr' ? 'active' : ''}`}
        onClick={() => setLang('tr')}
        aria-pressed={current === 'tr'}
      >
        TR
      </button>
      <span className="lang-divider" aria-hidden="true">|</span>
      <button
        type="button"
        className={`lang-pill ${current === 'en' ? 'active' : ''}`}
        onClick={() => setLang('en')}
        aria-pressed={current === 'en'}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSwitcher;
