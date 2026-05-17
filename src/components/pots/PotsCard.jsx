import './PotsCard.css';
import { useTransactions } from '../../context/TransactionContext';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiDollarSign } from 'react-icons/fi';
import EmptyState from '../emptystate/EmptyState.jsx';

const JarIcon = () => (
  <svg
    className="total-saved-jar-icon"
    width="44"
    height="44"
    viewBox="0 0 44 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M13 11h18v3a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2v-3Z"
      stroke="#2c8c8c"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M14 16h16l-1.2 17a2 2 0 0 1-2 1.8H17.2a2 2 0 0 1-2-1.8L14 16Z"
      stroke="#2c8c8c"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <text
      x="22"
      y="29"
      textAnchor="middle"
      fontFamily="'Public Sans', Arial, sans-serif"
      fontSize="13"
      fontWeight="700"
      fill="#2c8c8c"
    >
      $
    </text>
  </svg>
);

const PotsCard = () => {
  const { t } = useTranslation();
  const { pots } = useTransactions();
  const totalSaved = pots.reduce((sum, pot) => sum + Number(pot.saved || 0), 0);

  return (
    <div className="card-container pots-card">
      <div className="card-header">
        <h2>{t('potsCard.title')}</h2>
        <Link to="/pots" className="see-details-link">{t('common.seeDetails')}</Link>
      </div>

      {pots.length === 0 ? (
        <EmptyState
          compact
          variant="teal"
          icon={<FiDollarSign />}
          message={t('potsCard.empty')}
        />
      ) : (
        <div className="pots-content">
          <div className="total-saved-section">
            <JarIcon />
            <div className="total-saved-text">
              <p className="total-saved-label">{t('potsCard.totalSaved')}</p>
              <p className="total-saved-amount">₺{totalSaved.toFixed(2)}</p>
            </div>
          </div>

          <div className="pots-list">
            {pots.slice(0, 4).map((pot) => (
              <div key={pot.id} className="pot-item">
                <div
                  className="pot-indicator"
                  style={{ backgroundColor: pot.theme || '#10b981' }}
                />
                <div className="pot-details">
                  <p className="pot-name">{pot.name}</p>
                  <p className="pot-amount">₺{Number(pot.saved || 0).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PotsCard;


