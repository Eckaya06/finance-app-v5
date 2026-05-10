import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransactions } from '../../context/TransactionContext.jsx';
import Modal from '../../components/modal/Modal.jsx';
import AddBudgetForm from '../../components/budgets/AddBudgetForm.jsx';
import EditBudgetForm from '../../components/budgets/EditBudgetForm.jsx'; 
import EmptyState from '../../components/emptystate/EmptyState.jsx';
import { FiPieChart } from 'react-icons/fi';
import './BudgetsPage.css';
import BudgetDetailCard from '../../components/budgets/BudgetDetailCard.jsx';
import DeleteBudgetModal from '../../components/budgets/DeleteBudgetModal.jsx';
import emptyBudgetImg from '../../assets/empty-budget.webp';

const BudgetsPage = () => {
  const { t } = useTranslation();
  const { budgets, addBudget, deleteBudget, updateBudget } = useTransactions();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openOptionsMenuId, setOpenOptionsMenuId] = useState(null);
  
  const [budgetToDelete, setBudgetToDelete] = useState(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [budgetToEdit, setBudgetToEdit] = useState(null);

  // ✅ GÜNCELLENDİ: Yeni bütçe oluştururken "Kategori Zaten Var Mı?" kontrolü
  const handleCreateBudget = async (newBudgetData) => {
    // budgets dizisinde bu kategoriden var mı diye bakıyoruz
    const categoryExists = budgets.some(
      (b) => b.category.toLowerCase() === newBudgetData.category.toLowerCase()
    );

    if (categoryExists) {
      alert(t('budgetsPage.duplicateAlert', { category: newBudgetData.category }));
      return;
    }

    const now = Date.now(); 
    const newBudget = {
      ...newBudgetData,
      createdAt: now, 
      spent: 0,
    };
    await addBudget(newBudget); 
    setIsAddModalOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!budgetToDelete) return;
    await deleteBudget(budgetToDelete.id); 
    setBudgetToDelete(null);
  };

  // ✅ GÜNCELLENDİ: Bütçe düzenlerken "Kategori Zaten Var Mı?" kontrolü
  const handleUpdateBudget = async (budgetId, updatedData) => {
    // Seçilen kategori başka bir bütçede kullanılıyor mu? (Kendi ID'si hariç)
    const categoryExists = budgets.some(
      (b) => b.category.toLowerCase() === updatedData.category.toLowerCase() && b.id !== budgetId
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
    setOpenOptionsMenuId(prevId => (prevId === budgetId ? null : budgetId));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openOptionsMenuId !== null && 
          !event.target.closest('.pot-options-btn') && 
          !event.target.closest('.budget-options-menu')) 
      {
        setOpenOptionsMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openOptionsMenuId]);


  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('budgetsPage.title')}</h1>
        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
          {t('budgetsPage.addNew')}
        </button>
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          icon={<FiPieChart />}
          title={t('budgetsPage.emptyTitle')}
          message={t('budgetsPage.emptyMessage')}
          buttonText={t('budgetsPage.createFirst')}
          onAction={() => setIsAddModalOpen(true)}
          backgroundImage={emptyBudgetImg}
        />
      ) : (
        <div className="budget-cards-grid">
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
      )}

      {/* ADD MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
        <AddBudgetForm
          onAddBudget={handleCreateBudget}
          onClose={() => setIsAddModalOpen(false)}
        />
      </Modal>

      {/* EDIT MODAL */}
      {budgetToEdit && isEditModalOpen && (
        <Modal isOpen={isEditModalOpen} onClose={() => {
          setIsEditModalOpen(false);
          setBudgetToEdit(null);
        }}>
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

      {/* DELETE MODAL */}
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