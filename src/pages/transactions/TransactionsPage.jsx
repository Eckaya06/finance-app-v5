import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTransactions } from '../../context/TransactionContext.jsx';
import CustomDropdown from '../../components/dropdown/CustomDropdown.jsx';
import SearchInput from '../../components/search/SearchInput.jsx';
import Pagination from '../../components/pagination/Pagination.jsx';
import { getCategoryTheme } from '../../utils/categoryIcons.jsx';
import { getCategoryColor } from '../../utils/categoryColors.js';
import './TransactionsPage.css';

const categoryOptions = [
  "All", "Entertainment", "Bills", "Groceries", "Dining Out", "Transportation",
  "Personal Care", "Education", "Lifestyle", "Shopping", "General", "Income"
];

const TransactionsPage = () => {
  const { t } = useTranslation();
  const { transactions, budgets } = useTransactions();
  const [searchParams] = useSearchParams();
  const urlCategory = searchParams.get('category');
  const urlSince = searchParams.get('since');

  const [sortType, setSortType] = useState('latest');
  const [filterCategory, setFilterCategory] = useState(urlCategory || 'All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);

  const sortOptions = [
    { value: 'latest', label: t('transactions.sortOptions.latest') },
    { value: 'oldest', label: t('transactions.sortOptions.oldest') },
    { value: 'highest', label: t('transactions.sortOptions.highest') },
    { value: 'lowest', label: t('transactions.sortOptions.lowest') },
    { value: 'a-z', label: t('transactions.sortOptions.az') },
    { value: 'z-a', label: t('transactions.sortOptions.za') },
  ];

  useEffect(() => {
    if (urlCategory && categoryOptions.includes(urlCategory)) {
      setFilterCategory(urlCategory);
    }
  }, [urlCategory]);

  const handleDropdownToggle = (dropdownName) => {
    setOpenDropdown(prev => (prev === dropdownName ? null : dropdownName));
  };

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...transactions];

    if (searchTerm) {
      result = result.filter(tx => tx.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (filterCategory !== 'All') {
      result = result.filter(tx => {
        const isCategoryMatch = tx.category === filterCategory;

        let isAfterBudgetCreation = true;

        if (urlSince) {
          isAfterBudgetCreation = (tx.createdAt || 0) >= Number(urlSince);
        } else {
          const activeBudget = budgets.find(b => b.category === filterCategory);
          if (activeBudget) {
            isAfterBudgetCreation = (tx.createdAt || 0) >= (activeBudget.createdAt || 0);
          }
        }

        return isCategoryMatch && isAfterBudgetCreation;
      });
    }

    switch (sortType) {
      case 'latest':
        result.sort((a, b) => ((b.rawDate || 0) - (a.rawDate || 0)) || ((b.createdAt || 0) - (a.createdAt || 0)));
        break;
      case 'oldest':
        result.sort((a, b) => ((a.rawDate || 0) - (b.rawDate || 0)) || ((a.createdAt || 0) - (b.createdAt || 0)));
        break;
      case 'highest':
        result.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
        break;
      case 'lowest':
        result.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
        break;
      case 'a-z':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'z-a':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default: break;
    }
    return result;
  }, [transactions, budgets, sortType, filterCategory, searchTerm, urlSince]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, sortType, searchTerm]);

  const totalPages = Math.ceil(filteredAndSortedTransactions.length / itemsPerPage);
  const handlePageChange = (p) => p > 0 && p <= totalPages && setCurrentPage(p);
  const currentItems = filteredAndSortedTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const translateCategory = (cat) => t(`categories.${cat}`, { defaultValue: cat });

  return (
    <div className="page-container">
      <h1 className="page-title">{t('transactions.title')}</h1>
      <div className="filters-bar">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('transactions.searchPlaceholder')} />
        <div className="dropdowns">
          <CustomDropdown
            options={sortOptions.map(opt => opt.value)} selectedValue={sortType} onChange={setSortType}
            labelPrefix={t('transactions.sortBy')} displayTransformer={(v) => sortOptions.find(opt => opt.value === v)?.label || v}
            isOpen={openDropdown === 'sort'} onToggle={() => handleDropdownToggle('sort')}
          />
          <CustomDropdown
            options={categoryOptions} selectedValue={filterCategory} onChange={setFilterCategory}
            labelPrefix={t('transactions.category')}
            displayTransformer={translateCategory}
            isOpen={openDropdown === 'category'} onToggle={() => handleDropdownToggle('category')}
          />
        </div>
      </div>
      <div className="transaction-table">
        <div className="table-header">
          <p>{t('transactions.headers.recipient')}</p>
          <p>{t('transactions.headers.category')}</p>
          <p>{t('transactions.headers.date')}</p>
          <p>{t('transactions.headers.amount')}</p>
        </div>
        <div className="table-body">
          {currentItems.length === 0 ? (<div className="no-data-message">{t('transactions.noResults')}</div>) : (
            currentItems.map((tx) => {
              const theme = getCategoryTheme(tx.category);
              const catColor = getCategoryColor(tx.category);
              return (
                <div key={tx.id} className="table-row">
                  <div className="recipient-cell">
                    <div className="tx-avatar" style={{ backgroundColor: theme.bg }}>
                      <img src={theme.image} alt={tx.category} className="category-img-icon" />
                    </div>
                    <span className="tx-name">{tx.name}</span>
                  </div>
                  <p className="category-cell">
                    <span className="category-pill">
                      <span className="category-dot" style={{ backgroundColor: catColor }} />
                      <span className="category-text">{translateCategory(tx.category)}</span>
                    </span>
                  </p>
                  <p className="date-cell">{tx.date}</p>
                  <p className={`transaction-amount ${tx.type}`}>
                    {tx.type === 'income' ? '+' : '-'}₺{parseFloat(tx.amount).toFixed(2)}
                  </p>
                </div>
              );
            })
          )}
        </div>
        {currentItems.length > 0 && (<Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />)}
      </div>
    </div>
  );
};

export default TransactionsPage;
