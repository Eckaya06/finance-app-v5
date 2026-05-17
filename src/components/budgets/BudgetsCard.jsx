import './BudgetsCard.css';
import { useTransactions } from '../../context/TransactionContext';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell } from 'recharts';
import ResponsiveChart from '../charts/ResponsiveChart.jsx';
import { getCategoryColor } from '../../utils/categoryColors';
import { FiPieChart } from 'react-icons/fi';
import EmptyState from '../emptystate/EmptyState.jsx';
import DonutCenterLabel from '../charts/DonutCenterLabel.jsx';

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
        <EmptyState
          compact
          variant="purple"
          icon={<FiPieChart />}
          message={t('budgetsCard.empty')}
        />
      ) : (
        <div className="budget-content">
          <div className="chart-container budget-donut-chart">
            <DonutCenterLabel
              variant="budget"
              value={`₺${totalSpent.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
              caption={t('budgetsCard.ofLimit', { limit: totalLimit.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) })}
              holeRatio={0.48}
              valueClassName="spent-amount"
              captionClassName="limit-text"
            />
            <ResponsiveChart fill>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="52%"
                  outerRadius="76%"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveChart>
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
