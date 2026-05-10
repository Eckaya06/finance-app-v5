import './RecurringBillsCard.css';
import { useTransactions } from '../../context/TransactionContext';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import emptyBillsImage from '../../assets/recurring_bills.webp';

const getDaysUntilDue = (dueDay) => {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const lastDayThisMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const effectiveDueDay = Math.min(dueDay, lastDayThisMonth);

  if (currentDay <= effectiveDueDay) {
    return effectiveDueDay - currentDay;
  }
  const lastDayNextMonth = new Date(currentYear, currentMonth + 2, 0).getDate();
  const nextEffectiveDueDay = Math.min(dueDay, lastDayNextMonth);
  return (lastDayThisMonth - currentDay) + nextEffectiveDueDay;
};

const RecurringBillsCard = () => {
  const { t } = useTranslation();
  const { bills } = useTransactions();

  const paidBills = bills.filter(b => b.isPaid);
  const unpaidBills = bills.filter(b => !b.isPaid);

  const paidTotal = paidBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const upcomingTotal = unpaidBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const dueSoonTotal = unpaidBills
    .filter(b => getDaysUntilDue(b.dueDay) <= 3)
    .reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const summaryItems = [
    { id: 'paid', name: t('billsCard.paid'), amount: paidTotal, status: 'paid' },
    { id: 'upcoming', name: t('billsCard.upcoming'), amount: upcomingTotal, status: 'upcoming' },
    { id: 'due', name: t('billsCard.dueSoon'), amount: dueSoonTotal, status: 'due' },
  ];

  return (
    <div className="card-container">
      <div className="card-header">
        <h2>{t('billsCard.title')}</h2>
        <Link to="/bills" className="see-details-link">{t('common.seeDetails')}</Link>
      </div>

      {bills.length === 0 ? (
        <div className="bills-empty-state">
          <img src={emptyBillsImage} alt="" className="bills-empty-state-img" />
          <p>{t('billsCard.empty')}</p>
        </div>
      ) : (
        <div className="bills-list">
          {summaryItems.map(bill => (
            <div key={bill.id} className={`bill-item bill-item--${bill.status}`}>
              <p className="bill-name">{bill.name}</p>
              <p className="bill-amount">₺{bill.amount.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringBillsCard;
