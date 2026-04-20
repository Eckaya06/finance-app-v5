import { useState } from 'react';
import './IncomeExpensePage.css';
import Modal from '../../components/modal/Modal.jsx';
import AddTransactionForm from '../../components/income-expense/AddTransactionForm.jsx';
import EmptyState from '../../components/emptystate/EmptyState.jsx';
import { FiPlus, FiArrowUpRight, FiArrowDownLeft, FiActivity, FiTrash2 } from 'react-icons/fi';
import emptyTransactionsImage from '../../assets/empty-transactions.webp'; 
import { useTransactions } from '../../context/TransactionContext.jsx';
import { getCategoryTheme } from '../../utils/categoryIcons.jsx';

const IncomeExpensePage = () => {
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

  const today = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const dailyIncome = transactions
    .filter(t => t.type === 'income' && t.date === today)
    .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

  const dailyExpense = transactions
    .filter(t => t.type === 'expense' && t.date === today)
    .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

  const itemToBeDeleted = transactions.find(t => t.id === transactionToDelete);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Income & Expense</h1>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <FiPlus /> Add Transaction
        </button>
      </div>

      {transactions.length === 0 ? (
        <EmptyState 
          icon={<FiActivity />}
          title="Track Your Income & Expenses"
          message="Keep track of your financial activities. Add your income sources and daily expenses to see a clear summary of your budget."
          buttonText="+ Add First Transaction"
          onAction={() => setIsModalOpen(true)}
          backgroundImage={emptyTransactionsImage}
        />
      ) : (
        <>
          <div className="ie-summary-grid">
            <div className="ie-summary-card income">
              <div className="ie-card-icon"><FiArrowDownLeft /></div>
              <div className="ie-card-info">
                <span>Daily Income</span>
                <h3>{dailyIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })} $</h3>
              </div>
            </div>
            <div className="ie-summary-card expense">
              <div className="ie-card-icon"><FiArrowUpRight /></div>
              <div className="ie-card-info">
                <span>Daily Expense</span>
                <h3>{dailyExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })} $</h3>
              </div>
            </div>
          </div>

          <div className="ie-transactions-container">
            <div className="ie-list-header">
              <h2>Recent Transactions</h2>
            </div>
            
            <div className="ie-list">
              {transactions.map((item) => {
                const theme = getCategoryTheme(item.category);
                return (
                  <div key={item.id} className="ie-list-item">
                    <div className="ie-item-left">
                      <div 
                        className="ie-item-avatar" 
                        style={{ backgroundColor: theme.bg }}
                      >
                        <img 
                          src={theme.image} 
                          alt={item.category} 
                          className="category-img-icon" 
                        />
                      </div>
                      
                      <div className="ie-item-meta">
                        <span className="ie-item-name">{item.name}</span>
                        <span className="ie-item-sub">{item.date} • {item.category}</span>
                      </div>
                    </div>
                    
                    <div className="ie-item-right">
                      <div className={`ie-item-amount ${item.type}`}>
                        {item.type === 'income' ? '+' : '-'}
                        {parseFloat(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} $
                      </div>
                      
                      <button 
                        className="btn-delete-transaction"
                        onClick={() => openDeleteModal(item.id)}
                        title="Delete Transaction"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <AddTransactionForm 
          onAdd={handleAddTransaction} 
          onClose={() => setIsModalOpen(false)} 
        />
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
        <div className="delete-modal-content">
          <div className="delete-header">
            <h2>Delete '{itemToBeDeleted?.name}'?</h2>
          </div>
          <p className="delete-message">
            Are you sure you want to delete this transaction? This action cannot be reversed.
          </p>
          <div className="delete-actions">
            <button className="btn-delete-confirm" onClick={confirmDelete}>
              Yes, Confirm Deletion
            </button>
            <button className="btn-delete-cancel" onClick={() => setIsDeleteModalOpen(false)}>
              No, Go Back
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default IncomeExpensePage;