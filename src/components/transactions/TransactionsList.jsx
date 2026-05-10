import './Transactions.css';
import { useTransactions } from '../../context/TransactionContext';
import TransactionItem from './TransactionItem.jsx';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import emptyTransactionsImage from '../../assets/empty-transactions.webp';

const TransactionsList = ({ limit, showViewAll = false }) => {
  const { t } = useTranslation();
  const { transactions } = useTransactions();
  const transactionsToDisplay = limit ? transactions.slice(0, limit) : transactions;

  return (
    <div className="transactions-container">
      <div className="transactions-header">
        <h2>{t('transactionsCard.title')}</h2>
        {showViewAll && (
          <Link to="/transactions" className="view-all-link">{t('common.viewAll')}</Link>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="transactions-empty-state">
          <img src={emptyTransactionsImage} alt="" className="transactions-empty-state-img" />
          <p>{t('transactionsCard.empty')}</p>
        </div>
      ) : (
        <ul className="transactions-list">
          {transactionsToDisplay.map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default TransactionsList;
