import './BudgetsCard.css';
import { useTransactions } from '../../context/TransactionContext';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getCategoryColor } from '../../utils/categoryColors';
import emptyBudgetImage from '../../assets/empty-budget.webp';

const BudgetsCard = () => {
  const { t } = useTranslation();
  const { budgets } = useTransactions();

  const chartData = budgets.map(b => ({
    name: b.category,
    value: Number(b.spent || 0),
    color: b.theme || getCategoryColor(b.category),
  }));

  const totalSpent = chartData.reduce((sum, item) => sum + item.value, 0);
  const totalLimit = budgets.reduce((sum, b) => sum + Number(b.limit || b.maxSpend || 0), 0);

  return (
    <div className="card-container">
      <div className="card-header">
        <h2>{t('budgetsCard.title')}</h2>
        <Link to="/budgets" className="see-details-link">{t('common.seeDetails')}</Link>
      </div>

      {budgets.length === 0 ? (
        <div className="budgets-empty-state">
          <img src={emptyBudgetImage} alt="" className="budgets-empty-state-img" />
          <p>{t('budgetsCard.empty')}</p>
        </div>
      ) : (
        <div className="budget-content">
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-center-text">
              <p className="spent-amount">₺{totalSpent.toFixed(0)}</p>
              <p className="limit-text">{t('budgetsCard.ofLimit', { limit: totalLimit.toFixed(0) })}</p>
            </div>
          </div>
          <div className="budget-legend">
            {budgets.map((item) => (
              <div key={item.id} className="legend-item">
                <div className="legend-info">
                  <span
                    className="legend-color-box"
                    style={{ backgroundColor: item.theme || getCategoryColor(item.category) }}
                  />
                  <p className="legend-name">{item.category}</p>
                </div>
                <p className="legend-value">₺{Number(item.spent || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetsCard;
