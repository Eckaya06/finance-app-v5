import { useTranslation } from 'react-i18next';
import { useTransactions } from '../../context/TransactionContext';
import StatCard from '../../components/statcard/StatCard.jsx';
import TransactionsList from '../../components/transactions/TransactionsList.jsx';
import PotsCard from '../../components/pots/PotsCard.jsx';
import BudgetsCard from '../../components/budgets/BudgetsCard.jsx';
import RecurringBillsCard from '../../components/bills/RecurringBillsCard.jsx';
import './Home.css';

const Home = () => {
  const { t } = useTranslation();
  const { transactions, loading } = useTransactions();

  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const balance = income - expenses;

  const fmt = (amount) => `₺${amount.toFixed(2)}`;

  return (
    <div>
      <h1 className="page-title">{t('home.title')}</h1>
      <div className="stat-cards-grid">
        <StatCard title={t('home.currentBalance')} amount={loading ? '—' : fmt(balance)} variant="primary" />
        <StatCard title={t('home.income')} amount={loading ? '—' : fmt(income)} />
        <StatCard title={t('home.expenses')} amount={loading ? '—' : fmt(expenses)} />
      </div>

      <div className="dashboard-main-grid">
        <PotsCard />
        <BudgetsCard />
        <TransactionsList limit={3} showViewAll={true} />
        <RecurringBillsCard />
      </div>
    </div>
  );
};

export default Home;
