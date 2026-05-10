import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

const AddTransactionForm = ({ onAdd, onClose }) => {
  const { t } = useTranslation();
  const [type, setType] = useState('expense');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [error, setError] = useState('');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const expenseCategories = [
    'Entertainment',
    'Bills',
    'Groceries',
    'Dining Out',
    'Transportation',
    'Personal Care',
    'Education',
    'Lifestyle',
    'Shopping',
    'General'
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategorySelect = (category) => {
    if (category === '__reset__') {
      setFormData({ ...formData, category: '' });
    } else {
      setFormData({ ...formData, category });
    }
    setIsDropdownOpen(false);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.category && type === 'expense') {
      setError(t('addTxForm.errorCategory'));
      return;
    }

    onAdd({
      ...formData,
      category: type === 'income' ? 'Income' : formData.category,
      type,
      id: Date.now(),
    });
    onClose();
  };

  const translateCategory = (cat) => t(`categories.${cat}`, { defaultValue: cat });

  return (
    <div className="add-transaction-form">
      <h2>{t('addTxForm.title')}</h2>
      <p>{type === 'expense' ? t('addTxForm.subtitleExpense') : t('addTxForm.subtitleIncome')}</p>

      <div className="ie-type-selector">
        <button
          className={type === 'expense' ? 'active expense' : ''}
          type="button"
          onClick={() => { setType('expense'); setFormData({ ...formData, category: '' }); }}
        >{t('addTxForm.expense')}</button>
        <button
          className={type === 'income' ? 'active income' : ''}
          type="button"
          onClick={() => { setType('income'); setFormData({ ...formData, category: 'Income' }); setError(''); }}
        >{t('addTxForm.income')}</button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>{t('addTxForm.category')}</label>

          {type === 'income' ? (
            <div className="read-only-input">{t('addTxForm.salaryIncome')}</div>
          ) : (
            <div className="custom-dropdown-container" ref={dropdownRef}>
              <button
                type="button"
                className={`dropdown-trigger ${isDropdownOpen ? 'open' : ''} ${!formData.category ? 'placeholder-mode' : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span>{formData.category ? translateCategory(formData.category) : t('addTxForm.selectCategory')}</span>
                <FiChevronDown className="dropdown-arrow" />
              </button>

              {isDropdownOpen && (
                <ul className="dropdown-menu">
                  <li
                    className={`dropdown-item ${formData.category === '' ? 'selected' : ''}`}
                    onClick={() => handleCategorySelect('__reset__')}
                  >
                    {t('addTxForm.selectCategory')}
                  </li>

                  {expenseCategories.map((cat) => (
                    <li
                      key={cat}
                      className={`dropdown-item ${formData.category === cat ? 'selected' : ''}`}
                      onClick={() => handleCategorySelect(cat)}
                    >
                      {translateCategory(cat)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>{type === 'expense' ? t('addTxForm.paidTo') : t('addTxForm.receivedFrom')}</label>
          <input
            type="text"
            placeholder={type === 'expense' ? t('addTxForm.paidToPh') : t('addTxForm.receivedFromPh')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>{t('addTxForm.amount')}</label>
          <input
            type="number"
            step="0.01"
            placeholder="₺ 0.00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>{t('addTxForm.date')}</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>

        <button type="submit" className={`btn-primary full-width ${type}`}>
          {type === 'expense' ? t('addTxForm.addExpense') : t('addTxForm.addIncome')}
        </button>
      </form>
    </div>
  );
};

export default AddTransactionForm;
