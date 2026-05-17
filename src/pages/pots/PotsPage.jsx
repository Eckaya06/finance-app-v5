import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FiTarget, FiTrendingUp, FiAward, FiDollarSign, FiCheck } from 'react-icons/fi';
import './PotsPage.css';
import PotCard from '../../components/pots/PotCard.jsx';
import Modal from '../../components/modal/Modal.jsx';
import AddPotForm from '../../components/pots/AddPotForm.jsx';
import EditPotForm from '../../components/pots/EditPotForm.jsx';
import AddMoneyForm from '../../components/pots/AddMoneyForm.jsx';
import WithdrawMoneyForm from '../../components/pots/WithdrawMoneyForm.jsx';
import EmptyState from '../../components/emptystate/EmptyState.jsx';
import DeleteConfirmationModal from '../../components/modal/DeleteConfirmationModal.jsx'
import { useTransactions } from '../../context/TransactionContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const PotsPage = () => {
  const { t } = useTranslation();
  const { pots, addPot, deletePot, updatePotBalance, updatePot } = useTransactions();
  const { showToast } = useToast();
  
  const [potActionError, setPotActionError] = useState({ potId: null, message: '' });
  const [openOptionsMenuId, setOpenOptionsMenuId] = useState(null);
  
  const [isAddPotModalOpen, setIsAddPotModalOpen] = useState(false);
  const [isAddMoneyModalOpen, setIsAddMoneyModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [isEditPotModalOpen, setIsEditPotModalOpen] = useState(false);
  const [selectedPot, setSelectedPot] = useState(null);

  // Hedefe ulaşıldığında ekranda gösterilen kutlama modali. Auto-close
  // sürelidir; "showPwSuccess" akışındaki gibi belirli bir süre kalır.
  const [celebrate, setCelebrate] = useState(null); // { name: string } | null

  const handleCreatePot = async (newPotData) => {
    const newPot = { name: newPotData.name, saved: 0, target: newPotData.target, theme: newPotData.theme };
    try {
      await addPot(newPot);
      setIsAddPotModalOpen(false);
      showToast(t('potsPage.potCreated', { name: newPot.name }), 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || t('potsPage.potCreateFail'), 'error');
    }
  };

  const handleOptionsToggle = (potId) => {
    setOpenOptionsMenuId(prevId => (prevId === potId ? null : potId));
  };

  const openAddMoneyModal = (potId) => {
    if (potActionError.potId === potId) setPotActionError({ potId: null, message: '' });
    const potToEdit = pots.find(p => p.id === potId);
    if (potToEdit) {
      setSelectedPot(potToEdit);
      setIsAddMoneyModalOpen(true);
    }
  };

  const handleConfirmAddition = async (potId, amountToAdd) => {
    const potToUpdate = pots.find(p => p.id === potId);
    if (!potToUpdate) {
      closeAddMoneyModal();
      return;
    }
    try {
      const newBalance = potToUpdate.saved + amountToAdd;
      await updatePotBalance(potId, newBalance);
      showToast(t('potsPage.addedAmount', { amount: amountToAdd, name: potToUpdate.name }), 'success');

      // Hedef tam olarak şu eklemeyle ilk kez yakalandı/aşıldı mı? Eski bakiye
      // hedefin altındayken yeni bakiye eşit veya üzerine çıkıyorsa kutla.
      // (Zaten dolu olan kumbaraya daha fazla eklenirse tekrar tetiklenmez.)
      const target = Number(potToUpdate.target || 0);
      if (target > 0 && potToUpdate.saved < target && newBalance >= target) {
        setCelebrate({ name: potToUpdate.name });
      }
    } catch (err) {
      showToast(err?.response?.data?.message || t('potsPage.addFail'), 'error');
    } finally {
      closeAddMoneyModal();
    }
  };

  // Kutlama modalı auto-close: 3.2 sn sonra kapanır.
  useEffect(() => {
    if (!celebrate) return;
    const id = setTimeout(() => setCelebrate(null), 3200);
    return () => clearTimeout(id);
  }, [celebrate]);

  const closeAddMoneyModal = () => {
    setIsAddMoneyModalOpen(false);
    setSelectedPot(null);
  };

  const openWithdrawModal = (potId) => {
    const potToEdit = pots.find(p => p.id === potId);
    if (potToEdit) {
      if (potToEdit.saved <= 0) {
        setPotActionError({ potId: potId, message: t('potsPage.addMoneyFirst') });
        setTimeout(() => setPotActionError({ potId: null, message: '' }), 2000);
      } else {
        setSelectedPot(potToEdit);
        setIsWithdrawModalOpen(true);
      }
    }
  };

  const handleConfirmWithdrawal = async (potId, amountToWithdraw) => {
    const potToUpdate = pots.find(p => p.id === potId);
    if (!potToUpdate) {
      closeWithdrawModal();
      return;
    }
    try {
      const newBalance = Math.max(0, potToUpdate.saved - amountToWithdraw);
      await updatePotBalance(potId, newBalance);
      showToast(t('potsPage.withdrew', { amount: amountToWithdraw, name: potToUpdate.name }), 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || t('potsPage.withdrawFail'), 'error');
    } finally {
      closeWithdrawModal();
    }
  };

  const closeWithdrawModal = () => {
    setIsWithdrawModalOpen(false);
    setSelectedPot(null);
  };

  const handleUpdatePot = async (potId, updatedData) => {
    try {
      await updatePot(potId, updatedData);
      setIsEditPotModalOpen(false);
      setSelectedPot(null);
      showToast(t('potsPage.potUpdated', { name: updatedData.name }), 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || t('potsPage.updateFail'), 'error');
    }
  };

  const openEditModal = (potId) => {
    const potToEdit = pots.find(p => p.id === potId);
    if (potToEdit) {
      setSelectedPot(potToEdit);
      setIsEditPotModalOpen(true);
      setOpenOptionsMenuId(null); 
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openOptionsMenuId !== null && 
          !event.target.closest('.pot-options-btn') && 
          !event.target.closest('.pot-options-menu')) 
      {
        setOpenOptionsMenuId(null);
      }
      if (potActionError.potId !== null && 
          !event.target.closest(`.pot-card[data-pot-id="${potActionError.potId}"]`)) 
      {
         setPotActionError({ potId: null, message: '' });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openOptionsMenuId, potActionError]);

  const openDeleteModal = (potId) => {
    const potToDelete = pots.find(p => p.id === potId);
    if (potToDelete) {
      setSelectedPot(potToDelete);
      setIsDeleteModalOpen(true);
      setOpenOptionsMenuId(null);
    }
  };

  const handleDeletePot = async (potId) => {
    const potToDelete = pots.find(p => p.id === potId);
    try {
      await deletePot(potId);
      closeDeleteModal();
      showToast(t('potsPage.potDeleted', { name: potToDelete?.name || '' }), 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || t('potsPage.deleteFail'), 'error');
    }
  };
  
  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedPot(null);
  };

  // ─── Türetilmiş metrikler ───────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSaved = pots.reduce((s, p) => s + Number(p.saved || 0), 0);
    const totalTarget = pots.reduce((s, p) => s + Number(p.target || 0), 0);
    const overallPercent = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
    const reached = pots.filter(
      (p) => Number(p.target || 0) > 0 && Number(p.saved || 0) >= Number(p.target),
    ).length;
    return { totalSaved, totalTarget, overallPercent, reached };
  }, [pots]);

  const fmt = (n) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);

  return (
    <div className="page-container pots-page-v2">
      <div className="pp-page-card">
        <div className="pp-header">
          <div className="pp-header-text">
            <h1 className="pp-title">{t('potsPage.title')}</h1>
          </div>
          <button className="pp-add-btn" onClick={() => setIsAddPotModalOpen(true)}>
            {t('potsPage.addNew')}
          </button>
        </div>

        {pots.length === 0 ? (
          <EmptyState
            variant="teal"
            showRingIcon={false}
            icon={<FiDollarSign />}
            title={t('potsPage.emptyTitle')}
            message={t('potsPage.emptyMessage')}
            buttonText={t('potsPage.createFirst')}
            onAction={() => setIsAddPotModalOpen(true)}
          />
        ) : (
          <>
            {/* === Top stats === */}
            <div className="pp-stats-grid">
              <div className="pp-stat-tile">
                <div className="pp-stat-label">
                  <FiTarget size={14} /> {t('potsPage.statTotalSaved')}
                </div>
                <div className="pp-stat-amount">{fmt(stats.totalSaved)}</div>
                <div className="pp-stat-hint">
                  {t('potsPage.statActive', { count: pots.length })}
                </div>
              </div>

              <div className="pp-stat-tile">
                <div className="pp-stat-label">
                  <FiAward size={14} /> {t('potsPage.statTotalTarget')}
                </div>
                <div className="pp-stat-amount">{fmt(stats.totalTarget)}</div>
                <div className="pp-stat-hint">{t('potsPage.statAcrossAll')}</div>
              </div>

              <div className="pp-stat-tile">
                <div className="pp-stat-label">
                  <FiTrendingUp size={14} /> {t('potsPage.statOverall')}
                </div>
                <div className="pp-stat-amount">
                  {stats.overallPercent.toFixed(1)}%
                </div>
                <div className="pp-stat-hint">
                  {t('potsPage.statReached', {
                    reached: stats.reached,
                    total: pots.length,
                  })}
                </div>
              </div>
            </div>

            {/* === Overall progress bar === */}
            <div className="pp-overall-bar-card">
              <div className="pp-overall-bar">
                <div
                  className="pp-overall-fill"
                  style={{
                    width: `${Math.min(100, stats.overallPercent).toFixed(2)}%`,
                  }}
                />
              </div>
              <div className="pp-overall-foot">
                <span className="pp-overall-saved">
                  {t('potsPage.savedPercent', {
                    percent: stats.overallPercent.toFixed(1),
                  })}
                </span>
                <span className="pp-overall-left">
                  {t('potsPage.remainingPercent', {
                    percent: Math.max(0, 100 - stats.overallPercent).toFixed(1),
                  })}
                </span>
              </div>
            </div>

            {/* === Pot cards === */}
            <div className="pots-grid">
              {pots.map((pot) => (
                <PotCard
                  key={pot.id}
                  pot={pot}
                  onAddMoneyClick={openAddMoneyModal}
                  onWithdrawClick={openWithdrawModal}
                  potActionError={potActionError}
                  onOptionsToggle={handleOptionsToggle}
                  isOptionsMenuOpen={openOptionsMenuId === pot.id}
                  onDeleteClick={openDeleteModal}
                  onEditClick={openEditModal}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Kutlama modali — hedefe ulaşıldığında, kısa süre ekranda kalır */}
      {celebrate && createPortal(
        <div className="pot-celebrate-overlay" aria-modal="true" role="dialog">
          <div className="pot-celebrate-modal">
            <div className="pot-celebrate-icon" aria-hidden="true">
              <FiCheck />
            </div>
            <h3 className="pot-celebrate-title">{t('potCard.goalReachedModalTitle')}</h3>
            <p className="pot-celebrate-desc">
              {t('potCard.goalReachedModalMsg', { name: celebrate.name })}
            </p>
            <div className="pot-celebrate-bar"><span /></div>
          </div>
        </div>,
        document.body
      )}

      {/* MODALS */}
      <Modal isOpen={isAddPotModalOpen} onClose={() => setIsAddPotModalOpen(false)}>
        <AddPotForm onAddPot={handleCreatePot} onClose={() => setIsAddPotModalOpen(false)} />
      </Modal>

      {selectedPot && isEditPotModalOpen && (
        <Modal isOpen={isEditPotModalOpen} onClose={() => { setIsEditPotModalOpen(false); setSelectedPot(null); }}>
          <EditPotForm pot={selectedPot} onUpdatePot={handleUpdatePot} onClose={() => { setIsEditPotModalOpen(false); setSelectedPot(null); }} />
        </Modal>
      )}

      {selectedPot && isAddMoneyModalOpen && (
          <Modal isOpen={isAddMoneyModalOpen} onClose={closeAddMoneyModal}>
            <AddMoneyForm pot={selectedPot} onConfirm={handleConfirmAddition} onClose={closeAddMoneyModal} />
          </Modal>
      )}

      {selectedPot && isWithdrawModalOpen && (
          <Modal isOpen={isWithdrawModalOpen} onClose={closeWithdrawModal}>
            <WithdrawMoneyForm pot={selectedPot} onConfirm={handleConfirmWithdrawal} onClose={closeWithdrawModal} />
          </Modal>
      )}

      {selectedPot && isDeleteModalOpen && (
        <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal}>
          <DeleteConfirmationModal potName={selectedPot.name} onConfirm={() => handleDeletePot(selectedPot.id)} onCancel={closeDeleteModal} />
        </Modal>
      )}
    </div>
  );
};

export default PotsPage;


