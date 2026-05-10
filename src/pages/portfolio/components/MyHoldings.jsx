import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ASSET_META from './assetMeta.js';
import Modal from '../../../components/modal/Modal.jsx';
import AddAssetForm from './AddAssetForm.jsx';

const ASSET_OPTIONS = [
  { value: 'USD', group: 'Currencies' },
  { value: 'EUR', group: 'Currencies' },
  { value: 'GBP', group: 'Currencies' },
  { value: 'JPY', group: 'Currencies' },
  { value: 'CHF', group: 'Currencies' },
  { value: 'CAD', group: 'Currencies' },
  { value: 'GOLD_GRAM', group: 'Gold' },
  { value: 'GOLD_QUARTER', group: 'Gold' },
  { value: 'GOLD_OUNCE', group: 'Gold' },
];

const MyHoldings = ({ holdings, loading, onAdd, onWithdraw, onDelete, onUpdate, getCurrentRate, rates }) => {
  const { t } = useTranslation();
  const [editTarget, setEditTarget] = useState(null); // { assetType, mode: 'add'|'withdraw'|'edit_balance' }
  const [deleteTargetModal, setDeleteTargetModal] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleEdit = async () => {
    if (!editAmount || parseFloat(editAmount) <= 0) return;
    setSubmitting(true);

    if (editTarget.mode === 'add') {
      const price = getCurrentRate(editTarget.assetType);
      await onAdd({
        assetType: editTarget.assetType,
        amount: parseFloat(editAmount),
        pricePerUnit: price,
      });
    } else if (editTarget.mode === 'withdraw') {
      await onWithdraw(editTarget.assetType, parseFloat(editAmount));
    } else if (editTarget.mode === 'edit_balance') {
      await onUpdate(editTarget.assetType, parseFloat(editAmount));
    }

    setSubmitting(false);
    setEditTarget(null);
    setEditAmount('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetModal) return;
    setSubmitting(true);
    await onDelete(deleteTargetModal);
    setSubmitting(false);
    setDeleteTargetModal(null);
  };

  const handleAddNew = async (assetData) => {
    setSubmitting(true);
    await onAdd(assetData);
    setSubmitting(false);
    setIsAddModalOpen(false);
  };

  if (loading) {
    return (
      <div className="my-holdings-section">
        <div className="my-holdings-header">
          <h2>{t('portfolio.myHoldings')}</h2>
        </div>
        <div className="holdings-cards-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="holding-card-skeleton">
              <div className="skeleton-block" style={{ height: '120px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="my-holdings-section">
      <div className="my-holdings-header">
        <h2>{t('portfolio.myHoldings')}</h2>
        <div className="my-holdings-actions">
          {holdings.length > 0 && (
            <span className="holdings-count">
              {holdings.length} {holdings.length !== 1 ? t('portfolio.assets') : t('portfolio.asset')}
            </span>
          )}
          <button
            className="btn-primary"
            onClick={() => setIsAddModalOpen(true)}
            id="add-new-asset-btn"
          >
            {t('portfolio.addAsset')}
          </button>
        </div>
      </div>

      {/* Add New Asset Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
        <AddAssetForm 
          onAddAsset={handleAddNew} 
          onClose={() => setIsAddModalOpen(false)} 
          getCurrentRate={getCurrentRate}
        />
      </Modal>

      {/* Empty State */}
      {(!holdings || holdings.length === 0) && (
        <div className="portfolio-empty">
          <div className="empty-icon">📊</div>
          <h3>{t('portfolio.noHoldingsTitle')}</h3>
          <p>{t('portfolio.noHoldingsMsg')}</p>
        </div>
      )}

      {/* Holdings Cards */}
      {holdings.length > 0 && (
        <div className="holdings-cards-grid">
          {holdings.map((h) => {
            const meta = ASSET_META[h.assetType] || {};
            const isGold = meta.isGold;
            const pnl = h.unrealisedPnl;
            const pnlPercent = h.avgBuyPrice > 0
              ? ((h.liveRate - h.avgBuyPrice) / h.avgBuyPrice * 100)
              : 0;
            const isProfit = pnl >= 0;
            const isEditing = editTarget?.assetType === h.assetType;

            return (
              <div
                key={h.assetType}
                className="holding-card"
                id={`holding-${h.assetType}`}
                style={{ borderLeft: `4px solid ${meta.color || '#6366f1'}` }}
              >
                {/* Top: Asset Info */}
                <div className="holding-card-top">
                  <div className="holding-card-asset">
                    <span className={`holding-badge ${isGold ? 'gold' : ''}`}>
                      {meta.icon || h.assetType.substring(0, 2)}
                    </span>
                    <div className="holding-card-name">
                      <span className="holding-asset-code">{h.assetType}</span>
                      <span className="holding-asset-label">{meta.label || ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`holding-pnl-badge ${isProfit ? 'positive' : 'negative'}`}>
                      {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                    </span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button 
                        onClick={() => { setEditTarget({ assetType: h.assetType, mode: 'edit_balance' }); setEditAmount(h.currentHolding); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.6, padding: '4px', transition: 'opacity 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                        title={t('portfolio.editBalance')}
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => setDeleteTargetModal(h.assetType)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.6, padding: '4px', transition: 'opacity 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                        title={t('portfolio.deleteAsset')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>

                {/* Middle: Holdings Info */}
                <div className="holding-card-body">
                  <div className="holding-stat">
                    <span className="holding-stat-label">{t('portfolio.amount')}</span>
                    <span className="holding-stat-value">
                      {(h.currentHolding || 0).toLocaleString('tr-TR', { maximumFractionDigits: 6 })}
                    </span>
                  </div>
                  <div className="holding-stat">
                    <span className="holding-stat-label">{t('portfolio.value')}</span>
                    <span className="holding-stat-value">
                      ₺{(h.currentValue || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="holding-stat">
                    <span className="holding-stat-label">{t('portfolio.avgBuy')}</span>
                    <span className="holding-stat-value">
                      ₺{(h.avgBuyPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="holding-stat">
                    <span className="holding-stat-label">{t('portfolio.liveRate')}</span>
                    <span className="holding-stat-value">
                      ₺{(h.liveRate || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Bottom: PnL */}
                <div className={`holding-card-pnl ${isProfit ? 'profit' : 'loss'}`}>
                  <span className="holding-pnl-label">{t('portfolio.unrealisedPnl')}</span>
                  <span className="holding-pnl-value">
                    {isProfit ? '+' : ''}₺{(pnl || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Action Buttons: Add / Withdraw */}
                {!isEditing ? (
                  <div className="holding-card-actions">
                    <button
                      className="holding-action-btn add"
                      onClick={() => { setEditTarget({ assetType: h.assetType, mode: 'add' }); setEditAmount(''); }}
                      id={`add-${h.assetType}`}
                    >
                      {t('portfolio.addBtn')}
                    </button>
                    <button
                      className="holding-action-btn withdraw"
                      onClick={() => { setEditTarget({ assetType: h.assetType, mode: 'withdraw' }); setEditAmount(''); }}
                      id={`withdraw-${h.assetType}`}
                    >
                      {t('portfolio.withdrawBtn')}
                    </button>
                  </div>
                ) : (
                  <div className="holding-edit-row">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={editTarget.mode === 'withdraw' ? h.currentHolding : undefined}
                      placeholder={editTarget.mode === 'add' ? t('portfolio.addPlaceholder') : editTarget.mode === 'withdraw' ? t('portfolio.withdrawPlaceholder') : t('portfolio.balancePlaceholder')}
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      autoFocus
                      className="holding-edit-input"
                    />
                    <button
                      className={`holding-edit-confirm ${editTarget.mode === 'withdraw' ? 'withdraw' : 'add'}`}
                      onClick={handleEdit}
                      disabled={!editAmount || parseFloat(editAmount) < 0 || (editTarget.mode === 'withdraw' && parseFloat(editAmount) > h.currentHolding) || submitting}
                    >
                      {submitting ? '⏳' : editTarget.mode === 'add' ? t('portfolio.addAction') : editTarget.mode === 'withdraw' ? t('portfolio.withdrawAction') : t('portfolio.saveAction')}
                    </button>
                    <button
                      className="holding-edit-cancel"
                      onClick={() => { setEditTarget(null); setEditAmount(''); }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTargetModal} onClose={() => setDeleteTargetModal(null)}>
        <div className="delete-modal-content" style={{ textAlign: 'left', padding: '10px 0' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 16px 0', color: 'var(--text)' }}>
            {t('portfolio.deleteTitle', { asset: deleteTargetModal })}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '32px', lineHeight: '1.6' }}>
            {t('portfolio.deleteMsg')}
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
            <button
              onClick={handleConfirmDelete}
              disabled={submitting}
              style={{ flex: 1, padding: '14px', borderRadius: '8px', background: '#c95e5b', color: '#fff', fontSize: '15px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'background 0.2s', opacity: submitting ? 0.7 : 1 }}
              onMouseEnter={e => { if(!submitting) e.currentTarget.style.background = '#b8514e' }}
              onMouseLeave={e => { if(!submitting) e.currentTarget.style.background = '#c95e5b' }}
            >
              {submitting ? t('portfolio.deleting') : t('common.yesConfirm')}
            </button>
            <button
              onClick={() => setDeleteTargetModal(null)}
              disabled={submitting}
              style={{ flex: 1, padding: '14px', borderRadius: '8px', background: 'var(--card)', color: '#4b5563', fontSize: '15px', fontWeight: '700', border: '1px solid #d1d5db', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#374151' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = '#4b5563' }}
            >
              {t('common.noGoBack')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyHoldings;
