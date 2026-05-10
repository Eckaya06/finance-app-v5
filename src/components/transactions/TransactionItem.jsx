import './Transactions.css';
import { getCategoryTheme } from '../../utils/categoryIcons.jsx';

const TransactionItem = ({ transaction }) => {
  const { name, date, amount, type, category } = transaction;

  const theme = getCategoryTheme(category || (type === 'income' ? 'income' : 'general'));

  const formattedAmount = type === 'income'
    ? `+₺${Number(amount).toFixed(2)}`
    : `-₺${Math.abs(Number(amount)).toFixed(2)}`;

  return (
    <li className="transaction-item">
      <div className="transaction-details">
        <div className="transaction-avatar-wrap" style={{ backgroundColor: theme.bg }}>
          <img src={theme.image} alt={category} className="transaction-avatar-icon" />
        </div>
        <div>
          <p className="transaction-name">{name}</p>
          <p className="transaction-date">{date}</p>
        </div>
      </div>
      <p className={`transaction-amount ${type}`}>{formattedAmount}</p>
    </li>
  );
};

export default TransactionItem;
