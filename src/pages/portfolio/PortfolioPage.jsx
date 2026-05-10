import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api.js';
import LiveRatesBanner from './components/LiveRatesBanner.jsx';
import MyHoldings from './components/MyHoldings.jsx';
import RecentTransactions from './components/RecentTransactions.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import './Portfolio.css';

const PortfolioPage = () => {
  const { t } = useTranslation();
  const [rates, setRates] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { showToast } = useToast();

  // ─── Fetch Market Rates ───
  const fetchRates = useCallback(async () => {
    try {
      const { data } = await api.get('/market/rates');
      setRates(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch rates:', err);
    }
  }, []);

  // ─── Fetch Portfolio Summary ───
  const fetchPortfolio = useCallback(async () => {
    try {
      const { data } = await api.get('/portfolio/summary');
      setPortfolio(data);
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
    }
  }, []);

  // ─── Initial Load ───
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchRates(), fetchPortfolio()]);
      setLoading(false);
    };
    init();
  }, [fetchRates, fetchPortfolio]);

  // ─── Auto-refresh rates every 10 seconds ───
  useEffect(() => {
    const interval = setInterval(fetchRates, 10000);
    return () => clearInterval(interval);
  }, [fetchRates]);

  // ─── Handlers ───
  const handleAdd = async (formData) => {
    try {
      const { data } = await api.post('/portfolio/buy', formData);
      showToast(data.message, 'success');
      await fetchPortfolio();
    } catch (err) {
      const msg = err.response?.data?.message || t('portfolio.addFail');
      showToast(msg, 'error');
    }
  };

  const handleWithdraw = async (assetType, amount) => {
    try {
      const liveRate = getCurrentRate(assetType);
      await api.post('/portfolio/sell', {
        assetType,
        amount,
        pricePerUnit: liveRate,
      });
      showToast(t('portfolio.withdrew', { amount, asset: assetType }), 'success');
      await fetchPortfolio();
    } catch (err) {
      const msg = err.response?.data?.message || t('portfolio.withdrawFail');
      showToast(msg, 'error');
    }
  };

  const handleDeleteAsset = async (assetType) => {
    try {
      const { data } = await api.delete(`/portfolio/asset/${assetType}`);
      showToast(data.message, 'success');
      await fetchPortfolio();
    } catch (err) {
      const msg = err.response?.data?.message || t('portfolio.deleteFail');
      showToast(msg, 'error');
    }
  };

  const handleUpdateAsset = async (assetType, newAmount) => {
    try {
      const liveRate = getCurrentRate(assetType);
      const { data } = await api.put(`/portfolio/asset/${assetType}`, {
        amount: newAmount,
        pricePerUnit: liveRate,
      });
      showToast(data.message, 'success');
      await fetchPortfolio();
    } catch (err) {
      const msg = err.response?.data?.message || t('portfolio.updateFail');
      showToast(msg, 'error');
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchRates(), fetchPortfolio()]);
    showToast(t('portfolio.dataRefreshed'), 'info');
  };

  // ─── Utility: get current rate for an asset ───
  const getCurrentRate = (assetType) => {
    if (!rates) return 0;
    if (rates.currencies[assetType]) return rates.currencies[assetType].rate;
    if (rates.gold[assetType]) return rates.gold[assetType].rate;
    return 0;
  };

  // ─── Render ───
  return (
    <div className="portfolio-container">
      {/* Page Header */}
      <div className="portfolio-header">
        <h1 className="page-title">{t('portfolio.title')}</h1>
        <div className="portfolio-header-actions">
          {lastUpdated && (
            <span className="portfolio-last-updated">
              <span className="pulse-dot"></span>
              {t('portfolio.live')} · {lastUpdated.toLocaleTimeString('tr-TR')}
            </span>
          )}
          <button className="refresh-btn" onClick={handleRefresh} id="refresh-btn">
            {t('portfolio.refresh')}
          </button>
        </div>
      </div>

      {/* Live Rates */}
      {loading ? (
        <div className="skeleton-row">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-block" />
          ))}
        </div>
      ) : (
        <LiveRatesBanner rates={rates} />
      )}

      {/* My Holdings Section */}
      <MyHoldings
        holdings={portfolio?.holdings || []}
        loading={loading}
        onAdd={handleAdd}
        onWithdraw={handleWithdraw}
        onDelete={handleDeleteAsset}
        onUpdate={handleUpdateAsset}
        getCurrentRate={getCurrentRate}
        rates={rates}
      />

      {/* Recent Transactions */}
      {portfolio?.recentTransactions?.length > 0 && (
        <RecentTransactions
          transactions={portfolio.recentTransactions}
        />
      )}
    </div>
  );
};

export default PortfolioPage;
