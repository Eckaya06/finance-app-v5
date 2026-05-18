import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api.js';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';

const TransactionContext = createContext();

// Backend ISO string yollar; ama eski/restart edilmemiş backend tr-TR string ("DD.MM.YYYY")
// yollarsa onu da güvenle parse edebiliyoruz. Sort için rawDate (timestamp) tutuyoruz.
const parseDate = (rawDate) => {
  if (rawDate instanceof Date) return rawDate;

  if (typeof rawDate === 'string') {
    const trMatch = rawDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (trMatch) {
      const [, day, month, year] = trMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(rawDate);
  }

  if (typeof rawDate === 'number') return new Date(rawDate);
  return new Date();
};

const formatTransaction = (transaction) => {
  const rawDate = transaction.date || transaction.createdAt;
  let dateObj = rawDate ? parseDate(rawDate) : new Date();

  if (isNaN(dateObj.getTime())) {
    dateObj = transaction.createdAt ? new Date(transaction.createdAt) : new Date();
  }

  return {
    ...transaction,
    id: transaction.id || transaction._id,
    date: dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    rawDate: dateObj.getTime(),
  };
};

export const TransactionProvider = ({ children }) => {
  const authContext = useAuth();
  const { addMessage, registerAgentHandlers } = useChat();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [pots, setPots] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  // Portfolio state PortfolioPage'in lokalinde tutuluyor; AI agent ile
  // varlık eklendiğinde sayfanın haberi olsun diye versiyon sayacı.
  // PortfolioPage bu sayacı izleyip refetch yapar.
  const [portfolioVersion, setPortfolioVersion] = useState(0);

  const user = authContext ? authContext.user : null;

  const normalizeRecords = (records) => records.map((record) => ({
    ...record,
    id: record.id || record._id,
  }));

  const loadData = async () => {
    if (!user) {
      setTransactions([]);
      setBudgets([]);
      setPots([]);
      setBills([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [transactionsRes, budgetsRes, potsRes, billsRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/budgets'),
        api.get('/pots'),
        api.get('/bills'),
      ]);

      setTransactions(transactionsRes.data.map(formatTransaction));
      setBudgets(normalizeRecords(budgetsRes.data));
      setPots(normalizeRecords(potsRes.data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setBills(normalizeRecords(billsRes.data));
    } catch (err) {
      console.error('API yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const computedBudgets = budgets.map((budget) => {
    const budgetCategory = String(budget.category || '').trim().toLowerCase();
    const relevantTransactions = transactions.filter((t) => {
      const tCategory = String(t.category || '').trim().toLowerCase();
      const tType = String(t.type || '').trim().toLowerCase();
      return tCategory === budgetCategory && tType === 'expense' && (t.createdAt || 0) >= (budget.createdAt || 0);
    });
    const spentAmount = relevantTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return {
      ...budget,
      spent: spentAmount,
      latestSpending: relevantTransactions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3),
    };
  });

  // ✅ GÜNCELLEME 2: Veritabanına giderken boş tarih gitmesi engellendi
  const addTransaction = async (transactionData) => {
    if (!user) return;
    try {
      const payload = {
        ...transactionData,
        amount: Number(transactionData.amount),
        date: transactionData.date || new Date().toISOString(), 
      };
      // 1. Veritabanına kaydet
      const response = await api.post('/transactions', payload);
      
      // 2. loadData() yerine state'i anında güncelle
      const newTransaction = formatTransaction(response.data);
      setTransactions((prev) => [newTransaction, ...prev]);

      if (transactionData.type === 'expense') checkBudgetAlert(transactionData.category, Number(transactionData.amount));
    } catch (err) {
      console.error('Ekleme Hatası:', err);
    }
  };

  const deleteTransaction = async (transactionId) => {
    if (!user || !transactionId) return;
    try {
      await api.delete(`/transactions/${transactionId}`);
      setTransactions((prev) => prev.filter((tx) => String(tx.id) !== String(transactionId)));
    } catch (err) {
      console.error('Silme Hatası:', err);
    }
  };

  const addBudget = async (budgetData) => {
    if (!user) return;
    try {
      // 1. Veritabanına kaydet
      const response = await api.post('/budgets', budgetData);
      
      // 2. loadData() yerine state'i anında güncelle
      const newBudget = { ...response.data, id: response.data._id || response.data.id };
      setBudgets((prev) => [...prev, newBudget]);
    } catch (err) {
      console.error('Bütçe Ekleme Hatası:', err);
    }
  };

  const deleteBudget = async (budgetId) => {
    if (!user || !budgetId) return;
    try {
      await api.delete(`/budgets/${budgetId}`);
      setBudgets((prev) => prev.filter((budget) => String(budget.id) !== String(budgetId)));
    } catch (err) {
      console.error('Bütçe Silme Hatası:', err);
    }
  };

  const updateBudget = async (budgetId, updatedData) => {
    if (!user || !budgetId) return;
    try {
      await api.put(`/budgets/${budgetId}`, updatedData);
      setBudgets((prev) => prev.map((budget) => (String(budget.id) === String(budgetId) ? { ...budget, ...updatedData } : budget)));
    } catch (err) {
      console.error('Bütçe Güncelleme Hatası:', err);
    }
  };

  const addPot = async (potData) => {
    if (!user) return;
    try {
      // 1. Veritabanına kaydet
      const response = await api.post('/pots', { ...potData, saved: 0 });
      
      // 2. loadData() yerine state'i anında güncelle
      const newPot = { ...response.data, id: response.data._id || response.data.id };
      setPots((prev) => [newPot, ...prev]);
    } catch (err) {
      console.error('Pot Ekleme Hatası:', err);
    }
  };

  const deletePot = async (potId) => {
    if (!user || !potId) return;
    try {
      await api.delete(`/pots/${potId}`);
      setPots((prev) => prev.filter((pot) => String(pot.id) !== String(potId)));
    } catch (err) {
      console.error('Pot Silme Hatası:', err);
    }
  };

  const updatePotBalance = async (potId, newBalance) => {
    if (!user || !potId) return;

    // Pot bakiyesi değişimi artık Transactions / Income-Expense sayfalarına
    // yansıtılmıyor — pot hareketleri yalnızca pot kartında görünür.
    // (Eskiden delta'ya göre gelir/gider transaction'ı yazılırdı; o bağ
    // bilinçli olarak koparıldı, ana cüzdandan ayrı bir bakiye olarak kalıyor.)
    //
    // ÖNEMLİ: Backend reddederse (400 / network hatası) hata throw ediliyor;
    // çağıran (AI dispatcher / Pot UI) kendi try/catch'inde gerçek durumu öğrenir.
    const next = Number(newBalance);
    await api.put(`/pots/${potId}`, { saved: next });
    setPots((prev) => prev.map((pot) => (String(pot.id) === String(potId) ? { ...pot, saved: next } : pot)));
  };

  const updatePot = async (potId, updatedData) => {
    if (!user || !potId) return;
    try {
      await api.put(`/pots/${potId}`, updatedData);
      setPots((prev) => prev.map((pot) => (String(pot.id) === String(potId) ? { ...pot, ...updatedData } : pot)));
    } catch (err) {
      console.error('Pot Güncelleme Hatası:', err);
    }
  };

  const addBill = async (billData) => {
    if (!user) return null;
    try {
      const response = await api.post('/bills', billData);
      const newBill = { ...response.data, id: response.data._id || response.data.id };
      setBills((prev) => [newBill, ...prev]);
      return newBill;
    } catch (err) {
      console.error('Fatura Ekleme Hatası:', err);
      throw err;
    }
  };

  const updateBill = async (billId, updatedData) => {
    if (!user || !billId) return null;
    try {
      const response = await api.put(`/bills/${billId}`, updatedData);
      const updated = { ...response.data, id: response.data._id || response.data.id };
      setBills((prev) => prev.map((bill) => (String(bill.id) === String(billId) ? updated : bill)));
      return updated;
    } catch (err) {
      console.error('Fatura Güncelleme Hatası:', err);
      throw err;
    }
  };

  const deleteBill = async (billId) => {
    if (!user || !billId) return;
    try {
      await api.delete(`/bills/${billId}`);
      setBills((prev) => prev.filter((bill) => String(bill.id) !== String(billId)));
    } catch (err) {
      console.error('Fatura Silme Hatası:', err);
      throw err;
    }
  };

  const markBillPaid = async (billId) => {
    if (!user || !billId) return null;
    try {
      const response = await api.patch(`/bills/${billId}/pay`);
      const updated = { ...response.data, id: response.data._id || response.data.id };
      setBills((prev) => prev.map((bill) => (String(bill.id) === String(billId) ? updated : bill)));
      return updated;
    } catch (err) {
      console.error('Fatura Ödendi İşaretleme Hatası:', err);
      throw err;
    }
  };

  const markBillUnpaid = async (billId) => {
    if (!user || !billId) return null;
    try {
      const response = await api.patch(`/bills/${billId}/unpay`);
      const updated = { ...response.data, id: response.data._id || response.data.id };
      setBills((prev) => prev.map((bill) => (String(bill.id) === String(billId) ? updated : bill)));
      return updated;
    } catch (err) {
      console.error('Fatura Ödenmedi İşaretleme Hatası:', err);
      throw err;
    }
  };

  // ─── AGENTIC: Bütçe Yeniden Dağıtım ────────────────────────────────────
  // AI'ın "X kategorisinden Y kategorisine N TL aktar" komutunu çalıştırır.
  // Hedef kategori bütçesi yoksa otomatik oluşturur.
  const reallocateBudget = async ({ from, to, amount }) => {
    if (!user) return;
    const moveAmount = Math.abs(Number(amount) || 0);
    if (moveAmount <= 0) throw new Error('Aktarılacak tutar geçersiz.');

    const norm = (s) => String(s || '').trim().toLowerCase();
    // computedBudgets'ten oku — spent alanı dahil; available hesaplayabilelim.
    const fromBudget = computedBudgets.find((b) => norm(b.category) === norm(from));
    if (!fromBudget) throw new Error(`"${from}" kategorisinde bütçe bulunamadı.`);

    const fromCurrentLimit = Number(fromBudget.limit ?? fromBudget.maxSpend ?? 0);
    const fromSpent = Number(fromBudget.spent ?? 0);
    const available = fromCurrentLimit - fromSpent;

    // Defense in depth: dispatcher pre-check'i geçtikten sonra bile (örn. ileride
    // başka bir code path direkt reallocateBudget çağırırsa) negatif limit'e
    // düşmeyi engelle. Hata mesajı dispatcher'ın lokalize ettiğinden farklı
    // olabilir; o yüzden teknik metin.
    if (available <= 0) {
      throw new Error(
        `"${from}" budget is already over its limit (limit ${fromCurrentLimit} TL, spent ${fromSpent} TL).`
      );
    }
    if (moveAmount > available) {
      throw new Error(
        `Not enough transferable amount in "${from}": requested ${moveAmount} TL but only ${available} TL available.`
      );
    }

    const fromNewLimit = fromCurrentLimit - moveAmount;

    await updateBudget(fromBudget.id, { limit: fromNewLimit });

    const toBudget = budgets.find((b) => norm(b.category) === norm(to));
    if (toBudget) {
      const toCurrentLimit = Number(toBudget.limit ?? toBudget.maxSpend ?? 0);
      await updateBudget(toBudget.id, { limit: toCurrentLimit + moveAmount });
    } else {
      await addBudget({ category: to, limit: moveAmount, theme: fromBudget.theme || 'blue' });
    }
  };

  // ─── AGENTIC: Portföy varlığı ekle (BUY/SELL) ──────────────────────────
  const addPortfolio = async ({ assetType, transactionType, amount, pricePerUnit }) => {
    if (!user) return;
    const endpoint = String(transactionType).toUpperCase() === 'SELL'
      ? '/portfolio/sell'
      : '/portfolio/buy';
    const payload = {
      assetType,
      amount: Number(amount),
    };
    if (Number(pricePerUnit) > 0) payload.pricePerUnit = Number(pricePerUnit);

    const response = await api.post(endpoint, payload);
    setPortfolioVersion((v) => v + 1);
    return response.data;
  };

  // ─── AGENTIC: Aksiyon handler'larını ChatContext'e kayıt et ────────────
  // ChatProvider TransactionProvider'ın üstünde olduğundan ChatContext
  // doğrudan useTransactions çağıramaz; bu kayıt deseniyle handler'ları
  // ChatContext.executeAgentCommand'a aktarıyoruz.
  useEffect(() => {
    if (!registerAgentHandlers) return;
    registerAgentHandlers({
      addTransaction,
      addBudget,
      addPot,
      reallocateBudget,
      addPortfolio,
      markBillPaid,
      markBillUnpaid,
      // Pot edit operasyonları (AI agent için tam pot kontrolü)
      updatePotBalance,
      updatePot,
      deletePot,
      // Budget edit operasyonları (AI agent için tam bütçe kontrolü)
      updateBudget,
      deleteBudget,
      // ChatContext.executeAgentCommand fatura adından eşleştirme yaparken
      // güncel listeye ihtiyaç duyar — closure üzerinden hep tazesi okunur.
      getBills: () => bills,
      // Pot/Budget tema seçimi için mevcut temaları ChatContext'ten
      // okuyabilelim diye getter'lar.
      getPots: () => pots,
      getBudgets: () => computedBudgets,
    });
  }); // bağımlılıksız: her render'da en güncel closure'ı yeniden kayıt eder

  const checkBudgetAlert = (category, amount) => {
    const budgetCategory = String(category || '').trim().toLowerCase();
    const budget = computedBudgets.find((b) => String(b.category || '').trim().toLowerCase() === budgetCategory);
    if (budget) {
      const limitNum = Number(budget.limit ?? budget.maxSpend ?? 0);
      const relevantTotal = budget.spent + amount;
      if (limitNum > 0 && relevantTotal / limitNum >= 0.75) {
        addMessage('bot', `⚠️ Budget Alert: You've used %${((relevantTotal / limitNum) * 100).toFixed(0)} of your ${category} budget!`, 'insight');
      }
    }
  };

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        addTransaction,
        deleteTransaction,
        budgets: computedBudgets,
        addBudget,
        deleteBudget,
        updateBudget,
        pots,
        addPot,
        deletePot,
        updatePotBalance,
        updatePot,
        bills,
        setBills,
        addBill,
        updateBill,
        deleteBill,
        markBillPaid,
        markBillUnpaid,
        portfolioVersion,
        bumpPortfolioVersion: () => setPortfolioVersion((v) => v + 1),
        loading,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => useContext(TransactionContext);