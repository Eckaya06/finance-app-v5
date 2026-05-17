import './Transactions.css';
import { useTransactions } from '../../context/TransactionContext';
import TransactionItem from './TransactionItem.jsx';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiActivity } from 'react-icons/fi';
import EmptyState from '../emptystate/EmptyState.jsx';

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
        <EmptyState
          compact
          variant="blue"
          icon={<FiActivity />}
          message={t('transactionsCard.empty')}
        />
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
