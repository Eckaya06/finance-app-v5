import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell } from 'recharts';
import ResponsiveChart from '../../components/charts/ResponsiveChart.jsx';
import { FiPieChart, FiTarget, FiArrowDownCircle, FiCheckCircle } from 'react-icons/fi';
import { useTransactions } from '../../context/TransactionContext.jsx';
import Modal from '../../components/modal/Modal.jsx';
import AddBudgetForm from '../../components/budgets/AddBudgetForm.jsx';
import EditBudgetForm from '../../components/budgets/EditBudgetForm.jsx';
import EmptyState from '../../components/emptystate/EmptyState.jsx';
import BudgetDetailCard from '../../components/budgets/BudgetDetailCard.jsx';
import DeleteBudgetModal from '../../components/budgets/DeleteBudgetModal.jsx';
import './BudgetsPage.css';

// BudgetDetailCard ile aynı tema paleti — donut ve legend renkleri tutarlı olsun.
const THEME_PALETTE = {
  blue: '#3b82f6',
  cyan: '#06b6d4',
  green: '#22c55e',
  orange: '#f97316',
  indigo: '#6366f1',
  red: '#ef4444',
  purple: '#8b5cf6',
};
const resolveColor = (budget) => THEME_PALETTE[budget?.theme] || THEME_PALETTE.blue;

const fmt = (n) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);

const BudgetsPage = () => {
  const { t } = useTranslation();
  const { budgets, addBudget, deleteBudget, updateBudget } = useTransactions();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openOptionsMenuId, setOpenOptionsMenuId] = useState(null);
  const [budgetToDelete, setBudgetToDelete] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [budgetToEdit, setBudgetToEdit] = useState(null);

  // ─── Türetilmiş metrikler ────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalLimit = budgets.reduce(
      (s, b) => s + Number(b.limit ?? b.maxSpend ?? 0),
      0,
    );
    const totalSpent = budgets.reduce((s, b) => s + Number(b.spent || 0), 0);
    const remaining = totalLimit - totalSpent;
    const usedPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
    const healthy = budgets.filter((b) => {
      const lim = Number(b.limit ?? b.maxSpend ?? 0);
      const spent = Number(b.spent || 0);
      return lim > 0 ? spent / lim < 0.9 : true;
    }).length;
    return { totalLimit, totalSpent, remaining, usedPercent, healthy };
  }, [budgets]);

  const allocationData = useMemo(
    () =>
      budgets
        .filter((b) => Number(b.limit ?? b.maxSpend ?? 0) > 0)
        .map((b) => ({
          name: b.category,
          value: Number(b.limit ?? b.maxSpend ?? 0),
          color: resolveColor(b),
          id: b.id,
        })),
    [budgets],
  );

  // ─── Modal handler'ları ──────────────────────────────────────────────
  const handleCreateBudget = async (newBudgetData) => {
    const categoryExists = budgets.some(
      (b) => b.category.toLowerCase() === newBudgetData.category.toLowerCase(),
    );
    if (categoryExists) {
      alert(t('budgetsPage.duplicateAlert', { category: newBudgetData.category }));
      return;
    }
    await addBudget({ ...newBudgetData, createdAt: Date.now(), spent: 0 });
    setIsAddModalOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!budgetToDelete) return;
    await deleteBudget(budgetToDelete.id);
    setBudgetToDelete(null);
  };

  const handleUpdateBudget = async (budgetId, updatedData) => {
    const categoryExists = budgets.some(
      (b) => b.category.toLowerCase() === updatedData.category.toLowerCase() && b.id !== budgetId,
    );
    if (categoryExists) {
      alert(t('budgetsPage.duplicateAlertEdit', { category: updatedData.category }));
      return;
    }
    await updateBudget(budgetId, updatedData);
    setIsEditModalOpen(false);
    setBudgetToEdit(null);
  };

  const handleOptionsToggle = (budgetId) => {
    setOpenOptionsMenuId((prev) => (prev === budgetId ? null : budgetId));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        openOptionsMenuId !== null &&
        !event.target.closest('.pot-options-btn') &&
        !event.target.closest('.budget-options-menu')
      ) {
        setOpenOptionsMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openOptionsMenuId]);

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="page-container budgets-page-v2">
      <div className="bp-page-card">
      <div className="bp-header">
        <div className="bp-header-text">
          <h1 className="bp-title">{t('budgetsPage.title')}</h1>
        </div>
        <button className="bp-add-btn" onClick={() => setIsAddModalOpen(true)}>
          {t('budgetsPage.addNew')}
        </button>
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          variant="purple"
          showRingIcon={false}
          icon={<FiPieChart />}
          title={t('budgetsPage.emptyTitle')}
          message={t('budgetsPage.emptyMessage')}
          buttonText={t('budgetsPage.createFirst')}
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : (
        <>
          {/* === Top stats row === */}
          <div className="bp-stats-grid">
            <div className="bp-stat-tile">
              <div className="bp-stat-label">
                <FiTarget size={14} /> {t('budgetsPage.statTotalLimit')}
              </div>
              <div className="bp-stat-amount">{fmt(stats.totalLimit)}</div>
              <div className="bp-stat-hint">
                {t('budgetsPage.statCategories', { count: budgets.length })}
              </div>
            </div>

            <div className="bp-stat-tile">
              <div className="bp-stat-label">
                <FiArrowDownCircle size={14} /> {t('budgetsPage.statTotalSpent')}
              </div>
              <div className="bp-stat-amount">{fmt(stats.totalSpent)}</div>
              <div
                className={`bp-stat-hint ${stats.usedPercent >= 90 ? 'danger' : stats.usedPercent >= 50 ? 'warn' : 'ok'}`}
              >
                {t('budgetsPage.statUsedPercent', {
                  percent: stats.usedPercent.toFixed(1),
                })}
              </div>
            </div>

            <div className="bp-stat-tile">
              <div className="bp-stat-label">
                <FiCheckCircle size={14} /> {t('budgetsPage.statRemaining')}
              </div>
              <div className={`bp-stat-amount ${stats.remaining < 0 ? 'negative' : ''}`}>
                {fmt(stats.remaining)}
              </div>
              <div
                className={`bp-stat-hint ${stats.healthy === budgets.length ? 'ok' : 'warn'}`}
              >
                {t('budgetsPage.statHealthy', {
                  healthy: stats.healthy,
                  total: budgets.length,
                })}
              </div>
            </div>
          </div>

          {/* === Two-column body === */}
          <div className="bp-body">
            <aside className="bp-side">
              <div className="bp-side-card">
                <div className="bp-side-head">
                  <h2>{t('budgetsPage.allocationTitle')}</h2>
                  <p>{t('budgetsPage.allocationDesc')}</p>
                </div>

                <div className="bp-donut-wrap">
                  <ResponsiveChart fill>
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {allocationData.map((d) => (
                          <Cell key={d.id} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveChart>
                  <div className="bp-donut-center">
                    <span className="bp-donut-label">{t('budgetsPage.totalLimit')}</span>
                    <span className="bp-donut-value">{fmt(stats.totalLimit)}</span>
                  </div>
                </div>

                <ul className="bp-legend">
                  {allocationData.map((d) => (
                    <li key={d.id}>
                      <span className="bp-legend-dot" style={{ background: d.color }} />
                      <span className="bp-legend-name">
                        {t(`categories.${d.name}`, { defaultValue: d.name })}
                      </span>
                      <span className="bp-legend-val">{fmt(d.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bp-side-card">
                <div className="bp-side-head">
                  <h2>{t('budgetsPage.usageTitle')}</h2>
                  <p>{t('budgetsPage.usageDesc')}</p>
                </div>

                <div className="bp-usage-bar">
                  <div
                    className="bp-usage-fill"
                    style={{
                      width: `${Math.min(100, stats.usedPercent).toFixed(2)}%`,
                      background:
                        stats.usedPercent >= 90
                          ? '#ef4444'
                          : stats.usedPercent >= 50
                            ? '#f59e0b'
                            : '#22c55e',
                    }}
                  />
                </div>

                <div className="bp-usage-foot">
                  <span className="bp-usage-used">
                    {t('budgetsPage.usedPercentShort', {
                      percent: stats.usedPercent.toFixed(1),
                    })}
                  </span>
                  <span className="bp-usage-left">
                    {t('budgetsPage.leftPercentShort', {
                      percent: Math.max(0, 100 - stats.usedPercent).toFixed(1),
                    })}
                  </span>
                </div>

                {budgets.length > 0 && (
                  <ul className="bp-usage-list">
                    {budgets.map((b) => {
                      const lim = Number(b.limit ?? b.maxSpend ?? 0);
                      const sp = Number(b.spent || 0);
                      const pct = lim > 0 ? (sp / lim) * 100 : 0;
                      const color = resolveColor(b);
                      return (
                        <li key={b.id} className="bp-usage-row">
                          <div className="bp-usage-row-head">
                            <span className="bp-usage-row-label">
                              <span
                                className="bp-usage-row-dot"
                                style={{ background: color }}
                              />
                              {t(`categories.${b.category}`, {
                                defaultValue: b.category,
                              })}
                            </span>
                            <span className="bp-usage-row-pct">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="bp-usage-row-bar">
                            <div
                              className="bp-usage-row-fill"
                              style={{
                                width: `${Math.min(100, pct).toFixed(2)}%`,
                                background: color,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            <div className="bp-list">
              {budgets.map((budget, index) => (
                <BudgetDetailCard
                  key={budget.id || `fallback-key-${index}`}
                  budget={budget}
                  isMenuOpen={openOptionsMenuId === budget.id}
                  onOptionsToggle={() => handleOptionsToggle(budget.id)}
                  onDeleteRequest={() => {
                    setBudgetToDelete(budget);
                    setOpenOptionsMenuId(null);
                  }}
                  onEditRequest={() => {
                    setBudgetToEdit(budget);
                    setIsEditModalOpen(true);
                    setOpenOptionsMenuId(null);
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}
      </div>

      {/* MODALS */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
        <AddBudgetForm
          onAddBudget={handleCreateBudget}
          onClose={() => setIsAddModalOpen(false)}
        />
      </Modal>

      {budgetToEdit && isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setBudgetToEdit(null);
          }}
        >
          <EditBudgetForm
            budget={budgetToEdit}
            onUpdateBudget={handleUpdateBudget}
            onClose={() => {
              setIsEditModalOpen(false);
              setBudgetToEdit(null);
            }}
          />
        </Modal>
      )}

      <Modal isOpen={!!budgetToDelete} onClose={() => setBudgetToDelete(null)}>
        <DeleteBudgetModal
          budget={budgetToDelete}
          onConfirm={handleDeleteConfirm}
          onClose={() => setBudgetToDelete(null)}
        />
      </Modal>
    </div>
  );
};

export default BudgetsPage;
