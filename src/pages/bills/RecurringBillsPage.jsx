import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './RecurringBillsPage.css';
import Modal from '../../components/modal/Modal.jsx';
import CustomDropdown from '../../components/dropdown/CustomDropdown.jsx';
import { useTransactions } from '../../context/TransactionContext';
import { useToast } from '../../context/ToastContext.jsx';
import {
  FiFileText, FiSearch, FiMoreVertical, FiCheck,
  FiEdit2, FiTrash2, FiPlus, FiRotateCcw
} from 'react-icons/fi';

const THEME_COLORS = [
  '#636ae8', '#277c78', '#f2cdac', '#82c9d7',
  '#e88c63', '#e86399', '#826cb0', '#c9b458',
  '#597c7a', '#93674f', '#3f82b2', '#97a0ac',
];

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const getDaysUntilDue = (dueDay) => {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const lastDayThisMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const effectiveDueDay = Math.min(dueDay, lastDayThisMonth);

  if (currentDay <= effectiveDueDay) {
    return effectiveDueDay - currentDay;
  } else {
    const lastDayNextMonth = new Date(currentYear, currentMonth + 2, 0).getDate();
    const nextEffectiveDueDay = Math.min(dueDay, lastDayNextMonth);
    const remainingThisMonth = lastDayThisMonth - currentDay;
    return remainingThisMonth + nextEffectiveDueDay;
  }
};

const getDueStatus = (bill) => {
  if (bill.isPaid) return 'paid';
  const daysLeft = getDaysUntilDue(bill.dueDay);
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 3) return 'due-soon';
  if (daysLeft <= 7) return 'upcoming';
  return 'upcoming';
};

const RecurringBillsPage = () => {
  const { t } = useTranslation();
  const { bills, addBill, updateBill, deleteBill, markBillPaid, markBillUnpaid, loading } = useTransactions();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openOptionsId, setOpenOptionsId] = useState(null);
  const [editingBill, setEditingBill] = useState(null);

  const optionsRef = useRef(null);

  const sortOptions = [
    { value: 'latest', label: t('bills.sortOptions.latest') },
    { value: 'oldest', label: t('bills.sortOptions.oldest') },
    { value: 'az', label: t('bills.sortOptions.az') },
    { value: 'za', label: t('bills.sortOptions.za') },
    { value: 'highest', label: t('bills.sortOptions.highest') },
    { value: 'lowest', label: t('bills.sortOptions.lowest') },
    { value: 'due', label: t('bills.sortOptions.due') },
  ];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openOptionsId && !e.target.closest('.bill-actions-wrapper')) {
        setOpenOptionsId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openOptionsId]);

  const handleAddBill = async (formData) => {
    try {
      await addBill(formData);
      setIsAddModalOpen(false);
      showToast(t('bills.addedSuccess'));
    } catch (err) {
      showToast(t('bills.addFail'), 'error');
    }
  };

  const handleUpdateBill = async (billId, formData) => {
    try {
      await updateBill(billId, formData);
      setEditingBill(null);
      showToast(t('bills.updateSuccess'));
    } catch (err) {
      showToast(t('bills.updateFail'), 'error');
    }
  };

  const handleMarkPaid = async (billId) => {
    try {
      await markBillPaid(billId);
      showToast(t('bills.markedPaid'));
    } catch (err) {
      showToast(t('bills.markPaidFail'), 'error');
    }
  };

  const handleMarkUnpaid = async (billId) => {
    try {
      await markBillUnpaid(billId);
      showToast(t('bills.markedUnpaid'));
    } catch (err) {
      showToast(t('bills.updateGenericFail'), 'error');
    }
  };

  const handleDeleteBill = async (billId) => {
    try {
      await deleteBill(billId);
      setOpenOptionsId(null);
      showToast(t('bills.deleted'));
    } catch (err) {
      showToast(t('bills.deleteFail'), 'error');
    }
  };

  const filteredBills = bills
    .filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'latest': return (b.createdAt || 0) - (a.createdAt || 0);
        case 'oldest': return (a.createdAt || 0) - (b.createdAt || 0);
        case 'az': return a.name.localeCompare(b.name);
        case 'za': return b.name.localeCompare(a.name);
        case 'highest': return b.amount - a.amount;
        case 'lowest': return a.amount - b.amount;
        case 'due': return a.dueDay - b.dueDay;
        default: return 0;
      }
    });

  const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  const paidBills = bills.filter(b => b.isPaid);
  const unpaidBills = bills.filter(b => !b.isPaid);
  const paidTotal = paidBills.reduce((sum, b) => sum + b.amount, 0);
  const unpaidTotal = unpaidBills.reduce((sum, b) => sum + b.amount, 0);
  const dueSoonBills = unpaidBills.filter(b => getDaysUntilDue(b.dueDay) <= 3);
  const dueSoonTotal = dueSoonBills.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="page-container bills-page">
      <div className="page-header">
        <h1 className="page-title">{t('bills.title')}</h1>
      </div>

      <div className="bills-layout">
        <div className="bills-sidebar">
          <div className="bills-total-card">
            <div className="bills-total-icon">
              <FiFileText />
            </div>
            <div className="bills-total-info">
              <span className="bills-total-label">{t('bills.totalBills')}</span>
              <span className="bills-total-amount">
                ₺{totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="bills-summary-card">
            <h3 className="bills-summary-title">{t('bills.summary')}</h3>
            <div className="bills-summary-list">
              <div className="bills-summary-row">
                <span className="summary-label">{t('bills.paidBills')}</span>
                <span className="summary-value paid">
                  {paidBills.length} (₺{paidTotal.toFixed(2)})
                </span>
              </div>
              <div className="bills-summary-row">
                <span className="summary-label">{t('bills.totalUpcoming')}</span>
                <span className="summary-value upcoming">
                  {unpaidBills.length} (₺{unpaidTotal.toFixed(2)})
                </span>
              </div>
              <div className="bills-summary-row">
                <span className="summary-label">{t('bills.dueSoon')}</span>
                <span className="summary-value overdue">
                  {dueSoonBills.length} (₺{dueSoonTotal.toFixed(2)})
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bills-list-section">
          <div className="bills-toolbar">
            <div className="bills-search">
              <FiSearch className="bills-search-icon" size={16} />
              <input
                type="text"
                placeholder={t('bills.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="bills-toolbar-right">
              <CustomDropdown
                options={sortOptions.map((opt) => opt.value)}
                selectedValue={sortBy}
                onChange={setSortBy}
                labelPrefix={t('bills.sortBy').replace(/:$/, '')}
                displayTransformer={(v) => sortOptions.find((opt) => opt.value === v)?.label || v}
                isOpen={isSortDropdownOpen}
                onToggle={() => setIsSortDropdownOpen((prev) => !prev)}
              />
              <button className="btn-add-bill" onClick={() => setIsAddModalOpen(true)}>
                <FiPlus style={{ marginRight: 6, verticalAlign: 'middle' }} />
                {t('bills.addNew')}
              </button>
            </div>
          </div>

          <div className="bills-table-header">
            <span>{t('bills.headers.billTitle')}</span>
            <span>{t('bills.headers.dueDate')}</span>
            <span>{t('bills.headers.amount')}</span>
            <span>{t('bills.headers.actions')}</span>
          </div>

          {loading && (
            <div className="bills-skeleton">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          )}

          {!loading && filteredBills.length === 0 && (
            <div className="bills-empty">
              <div className="bills-empty-icon">
                <FiFileText />
              </div>
              <h3>{searchTerm ? t('bills.noBillsFound') : t('bills.noBillsTitle')}</h3>
              <p>
                {searchTerm
                  ? t('bills.tryAdjust')
                  : t('bills.noBillsMsg')}
              </p>
              {!searchTerm && (
                <button className="btn-empty-add" onClick={() => setIsAddModalOpen(true)}>
                  {t('bills.addFirst')}
                </button>
              )}
            </div>
          )}

          {!loading && filteredBills.map((bill) => {
            const billId = bill.id || bill._id;
            const daysLeft = getDaysUntilDue(bill.dueDay);
            const status = getDueStatus(bill);
            const daysColor = bill.isPaid ? 'green' : daysLeft <= 3 ? 'red' : daysLeft <= 7 ? 'orange' : 'green';

            return (
              <div key={billId} className={`bill-row ${bill.isPaid ? 'is-paid' : ''}`}>
                <div className="bill-info">
                  <div className="bill-avatar" style={{ background: bill.theme || '#636ae8' }}>
                    {getInitials(bill.name)}
                  </div>
                  <span className="bill-name">{bill.name}</span>
                </div>

                <div className="bill-due">
                  <span>{t('bills.monthly')} - {bill.dueDay}{getOrdinal(bill.dueDay)}</span>
                  {bill.isPaid ? (
                    <span className="bill-due-badge paid">
                      <FiCheck size={12} /> {t('bills.paid')}
                    </span>
                  ) : (
                    <span className={`days-left ${daysColor}`}>
                      {daysLeft === 0 ? t('bills.today') : `${daysLeft}d`}
                    </span>
                  )}
                </div>

                <span className={`bill-amount ${status === 'overdue' ? 'overdue' : ''}`}>
                  ₺{bill.amount.toFixed(2)}
                </span>

                <div className="bill-actions bill-actions-wrapper">
                  {bill.isPaid ? (
                    <>
                      <span className="btn-pay paid">
                        <FiCheck size={14} style={{ marginRight: 4 }} /> {t('bills.paid')}
                      </span>
                      <button className="btn-pay undo" onClick={() => handleMarkUnpaid(billId)} title={t('bills.undo')}>
                        <FiRotateCcw size={12} />
                      </button>
                    </>
                  ) : (
                    <button className="btn-pay pay" onClick={() => handleMarkPaid(billId)}>
                      {t('bills.pay')}
                    </button>
                  )}

                  <button
                    className="bill-options-btn"
                    onClick={() => setOpenOptionsId(openOptionsId === billId ? null : billId)}
                  >
                    <FiMoreVertical size={16} />
                  </button>

                  {openOptionsId === billId && (
                    <div className="bill-options-dropdown" ref={optionsRef}>
                      <button onClick={() => {
                        setEditingBill(bill);
                        setOpenOptionsId(null);
                      }}>
                        <FiEdit2 size={14} /> {t('common.edit')}
                      </button>
                      <button className="delete-btn" onClick={() => handleDeleteBill(billId)}>
                        <FiTrash2 size={14} /> {t('common.delete')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
        <BillForm
          onSubmit={handleAddBill}
          onClose={() => setIsAddModalOpen(false)}
          title={t('bills.addBill')}
        />
      </Modal>

      {editingBill && (
        <Modal isOpen={!!editingBill} onClose={() => setEditingBill(null)}>
          <BillForm
            bill={editingBill}
            onSubmit={(data) => handleUpdateBill(editingBill.id || editingBill._id, data)}
            onClose={() => setEditingBill(null)}
            title={t('bills.editBill')}
          />
        </Modal>
      )}

    </div>
  );
};

const getOrdinal = (day) => {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

const BILL_CATEGORY_OPTIONS = [
  'General', 'Utilities', 'Internet', 'Phone', 'Insurance', 'Rent',
  'Subscription', 'Education', 'Entertainment', 'Transportation', 'Other'
];

const BillForm = ({ bill, onSubmit, title }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(bill?.name || '');
  const [amount, setAmount] = useState(bill?.amount || '');
  const [dueDay, setDueDay] = useState(bill?.dueDay || 1);
  const [category, setCategory] = useState(bill?.category || 'General');
  const [theme, setTheme] = useState(bill?.theme || THEME_COLORS[0]);
  const [openDropdown, setOpenDropdown] = useState(null); // 'dueDay' | 'category' | null

  const dueDayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  const toggleDropdown = (name) =>
    setOpenDropdown((prev) => (prev === name ? null : name));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    onSubmit({
      name: name.trim(),
      amount: Number(amount),
      dueDay: Number(dueDay),
      category,
      theme,
    });
  };

  return (
    <form className="add-bill-form" onSubmit={handleSubmit}>
      <h2>{title}</h2>
      <p className="form-subtitle">
        {bill ? t('billForm.editSubtitle') : t('billForm.addSubtitle')}
      </p>

      <div className="form-group">
        <label>{t('billForm.billName')}</label>
        <input
          type="text"
          placeholder={t('billForm.billPlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t('billForm.amount')}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>{t('billForm.dueDay')}</label>
          <CustomDropdown
            options={dueDayOptions}
            selectedValue={Number(dueDay)}
            onChange={(v) => setDueDay(Number(v))}
            displayTransformer={(d) => `${d}${getOrdinal(d)}`}
            isOpen={openDropdown === 'dueDay'}
            onToggle={() => toggleDropdown('dueDay')}
          />
        </div>
      </div>

      <div className="form-group">
        <label>{t('billForm.category')}</label>
        <CustomDropdown
          options={BILL_CATEGORY_OPTIONS}
          selectedValue={category}
          onChange={setCategory}
          displayTransformer={(opt) => t(`categories.${opt}`, { defaultValue: opt })}
          isOpen={openDropdown === 'category'}
          onToggle={() => toggleDropdown('category')}
        />
      </div>

      <div className="form-group">
        <label>{t('billForm.themeColor')}</label>
        <div className="color-picker-row">
          {THEME_COLORS.map(c => (
            <div
              key={c}
              className={`color-dot ${theme === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => setTheme(c)}
            />
          ))}
        </div>
      </div>

      <button type="submit" className="btn-submit">
        {bill ? t('billForm.updateBtn') : t('billForm.addBtn')}
      </button>
    </form>
  );
};

export default RecurringBillsPage;
