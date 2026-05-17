import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './IncomeExpensePage.css';
import Modal from '../../components/modal/Modal.jsx';
import AddTransactionForm from '../../components/income-expense/AddTransactionForm.jsx';
import EmptyState from '../../components/emptystate/EmptyState.jsx';
import { FiPlus, FiArrowUpRight, FiArrowDownLeft, FiActivity, FiTrash2 } from 'react-icons/fi';
import { useTransactions } from '../../context/TransactionContext.jsx';
import { CategoryIcon } from '../../utils/categoryIcons.jsx';

const IncomeExpensePage = () => {
  const { t, i18n } = useTranslation();
  const { transactions, addTransaction, deleteTransaction } = useTransactions();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

  const openDeleteModal = (id) => {
    setTransactionToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (transactionToDelete) {
      await deleteTransaction(transactionToDelete);
      setIsDeleteModalOpen(false);
      setTransactionToDelete(null);
    }
  };

  const handleAddTransaction = (newEntry) => {
    addTransaction(newEntry);
    setIsModalOpen(false);
  };

  const numberLocale = i18n.resolvedLanguage?.toLowerCase().startsWith('tr') ? 'tr-TR' : 'en-GB';
  const today = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const dailyIncome = transactions
    .filter(tr => tr.type === 'income' && tr.date === today)
    .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

  const dailyExpense = transactions
    .filter(tr => tr.type === 'expense' && tr.date === today)
    .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

  const itemToBeDeleted = transactions.find(tr => tr.id === transactionToDelete);

  const translateCategory = (cat) => t(`categories.${cat}`, { defaultValue: cat });

  return (
    <div className="page-container">
      <div className="page-card ie-page-card">
      <div className="page-header">
        <h1 className="page-title">{t('incomeExpense.title')}</h1>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <FiPlus /> {t('incomeExpense.addTransaction')}
        </button>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          variant="blue"
          showRingIcon={false}
          icon={<FiActivity />}
          title={t('incomeExpense.emptyTitle')}
          message={t('incomeExpense.emptyMessage')}
          buttonText={t('incomeExpense.addFirst')}
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <>
          <div className="ie-summary-grid">
            <div className="ie-summary-card income">
              <div className="ie-card-icon"><FiArrowDownLeft /></div>
              <div className="ie-card-info">
                <span>{t('incomeExpense.dailyIncome')}</span>
                <h3>{dailyIncome.toLocaleString(numberLocale, { minimumFractionDigits: 2 })} ₺</h3>
              </div>
            </div>
            <div className="ie-summary-card expense">
              <div className="ie-card-icon"><FiArrowUpRight /></div>
              <div className="ie-card-info">
                <span>{t('incomeExpense.dailyExpense')}</span>
                <h3>{dailyExpense.toLocaleString(numberLocale, { minimumFractionDigits: 2 })} ₺</h3>
              </div>
            </div>
          </div>

          <div className="ie-transactions-container">
            <div className="ie-list-header">
              <h2>{t('incomeExpense.recentTransactions')}</h2>
            </div>

            <div className="ie-list">
              {transactions.map((item) => (
                  <div key={item.id} className="ie-list-item">
                    <div className="ie-item-left">
                      <CategoryIcon category={item.category} type={item.type} />

                      <div className="ie-item-meta">
                        <span className="ie-item-name">{item.name}</span>
                        <span className="ie-item-sub">{item.date} • {translateCategory(item.category)}</span>
                      </div>
                    </div>

                    <div className="ie-item-right">
                      <div className={`ie-item-amount ${item.type}`}>
                        {item.type === 'income' ? '+' : '-'}
                        {parseFloat(item.amount).toLocaleString(numberLocale, { minimumFractionDigits: 2 })} ₺
                      </div>

                      <button
                        className="btn-delete-transaction"
                        onClick={() => openDeleteModal(item.id)}
                        title={t('incomeExpense.deleteTooltip')}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </>
      )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <AddTransactionForm
          onAdd={handleAddTransaction}
          onClose={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
        <div className="delete-modal-content">
          <div className="delete-header">
            <h2>{t('incomeExpense.deleteTitle', { name: itemToBeDeleted?.name || '' })}</h2>
          </div>
          <p className="delete-message">
            {t('incomeExpense.deleteMessage')}
          </p>
          <div className="delete-actions">
            <button className="btn-delete-confirm" onClick={confirmDelete}>
              {t('common.yesConfirm')}
            </button>
            <button className="btn-delete-cancel" onClick={() => setIsDeleteModalOpen(false)}>
              {t('common.noGoBack')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default IncomeExpensePage;
