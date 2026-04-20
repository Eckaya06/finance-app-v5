import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api.js';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';

const TransactionContext = createContext();

// ✅ GÜNCELLEME 1: Tarih okuma işlemi güvenli hale getirildi
const formatTransaction = (transaction) => {
  const rawDate = transaction.date || transaction.createdAt || new Date();
  let dateObj = new Date(rawDate);

  // Eğer JavaScript bu tarihi okuyamazsa (Invalid Date) güvenlik kalkanı devreye girsin:
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date(); 
  }

  return {
    ...transaction,
    id: transaction.id || transaction._id,
    date: dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  };
};

export const TransactionProvider = ({ children }) => {
  const authContext = useAuth();
  const { addMessage } = useChat();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [pots, setPots] = useState([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [transactionsRes, budgetsRes, potsRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/budgets'),
        api.get('/pots'),
      ]);

      setTransactions(transactionsRes.data.map(formatTransaction));
      setBudgets(normalizeRecords(budgetsRes.data));
      setPots(normalizeRecords(potsRes.data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
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
    try {
      await api.put(`/pots/${potId}`, { saved: Number(newBalance) });
      setPots((prev) => prev.map((pot) => (String(pot.id) === String(potId) ? { ...pot, saved: Number(newBalance) } : pot)));
    } catch (err) {
      console.error('Pot Bakiye Güncelleme Hatası:', err);
    }
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

  const checkBudgetAlert = (category, amount) => {
    const budgetCategory = String(category || '').trim().toLowerCase();
    const budget = computedBudgets.find((b) => String(b.category || '').trim().toLowerCase() === budgetCategory);
    if (budget) {
      const limitNum = Number(budget.limit ?? budget.maxSpend ?? 0);
      const relevantTotal = budget.spent + amount;
      if (limitNum > 0 && relevantTotal / limitNum >= 0.75) {
        addMessage('bot', `⚠️ Budget Alert: You've used %${((relevantTotal / limitNum) * 100).toFixed(0)} of your ${category} budget!`);
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
        loading,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => useContext(TransactionContext);