import './Transactions.css';
import { CategoryIcon } from '../../utils/categoryIcons.jsx';

const TransactionItem = ({ transaction }) => {
  const { name, date, amount, type, category } = transaction;

  const formattedAmount = type === 'income'
    ? `+₺${Number(amount).toFixed(2)}`
    : `-₺${Math.abs(Number(amount)).toFixed(2)}`;

  return (
    <li className="transaction-item">
      <div className="transaction-details">
        <CategoryIcon category={category} type={type} />
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
