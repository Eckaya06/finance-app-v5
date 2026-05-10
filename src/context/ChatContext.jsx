import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useToast } from './ToastContext.jsx';

const ChatContext = createContext();

// Kullanıcının "GOLD" gibi serbest yazımını backend enum'una çevir.
const ASSET_ALIASES = {
  GOLD: 'GOLD_GRAM',
  ALTIN: 'GOLD_GRAM',
  GRAM: 'GOLD_GRAM',
  CEYREK: 'GOLD_QUARTER',
  QUARTER: 'GOLD_QUARTER',
  ONS: 'GOLD_OUNCE',
  OUNCE: 'GOLD_OUNCE',
};

const normalizeAsset = (raw) => {
  const key = String(raw || '').trim().toUpperCase();
  return ASSET_ALIASES[key] || key;
};

// Türkçe karakterleri sadeleştir + lowercase + boşluk normalize et.
// AI'ın gönderdiği billId yanlışsa veya yoksa, billName ile fatura listesinde
// esnek (case-insensitive, aksansız, partial) eşleşme yapmak için kullanılır.
const normalizeBillKey = (raw) =>
  String(raw || '')
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/\s+/g, ' ')
    .trim();

const resolveBill = (bills, data = {}) => {
  if (!Array.isArray(bills) || bills.length === 0) return null;
  const idTarget = String(data.billId || '').trim();
  if (idTarget) {
    const byId = bills.find((b) => String(b.id) === idTarget || String(b._id) === idTarget);
    if (byId) return byId;
  }
  const nameTarget = normalizeBillKey(data.billName);
  if (!nameTarget) return null;
  const exact = bills.find((b) => normalizeBillKey(b.name) === nameTarget);
  if (exact) return exact;
  const partial = bills.filter((b) => {
    const n = normalizeBillKey(b.name);
    return n.includes(nameTarget) || nameTarget.includes(n);
  });
  // Belirsizliği üst katmana kapat: yalnızca tek aday varsa eşle.
  return partial.length === 1 ? partial[0] : null;
};

export const ChatProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ✅ AGENTIC UI: Dinamik grafik modal state'i
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [chartModalConfig, setChartModalConfig] = useState(null);

  // Agent action feedback now flows through the app-wide top-center toast
  // instead of a chat-local notification. Keep showAgentToast as a thin wrapper
  // so existing call sites in executeAgentCommand keep working unchanged.
  const { showToast } = useToast();

  // ✅ AGENTIC UI: TransactionContext'in kayıt ettiği aksiyon handler'ları
  // Provider sırası nedeniyle ChatProvider TransactionProvider'ın üstünde olduğundan
  // doğrudan useTransactions çağıramıyoruz; bu yüzden kayıt deseni kullanıyoruz.
  const handlersRef = useRef({});

  const registerAgentHandlers = useCallback((handlers) => {
    handlersRef.current = { ...handlersRef.current, ...handlers };
  }, []);

  const showAgentToast = useCallback(
    (text, tone = 'success') => showToast(text, tone),
    [showToast]
  );

  const toggleChat = () => {
    setIsOpen((prev) => {
      const isClosing = prev === true;

      if (isClosing) {
        // Pencere kapandığında hafızayı temizle (boş başlasın)
        setMessages([]);
      } else {
        setUnreadCount(0);
      }

      return !prev;
    });
  };

  const addMessage = (sender, text) => {
    setMessages((prev) => [...prev, { sender, text }]);

    if (sender === 'bot' && !isOpen) {
      setUnreadCount((prev) => prev + 1);
    }
  };

  // ✅ AGENTIC UI: AI'ın grafik modalını açması için
  const openChartModal = (config) => {
    const safeConfig = {
      daysBack: Math.max(1, Number(config?.daysBack) || 7),
      type: ['expense', 'income', 'all'].includes(config?.type) ? config.type : 'expense',
    };
    setChartModalConfig(safeConfig);
    setIsChartModalOpen(true);
  };

  const closeChartModal = () => {
    setIsChartModalOpen(false);
    setChartModalConfig(null);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // ✅ AGENT_COMMAND DISPATCHER
  // ──────────────────────────────────────────────────────────────────────────
  const executeAgentCommand = useCallback(async (command) => {
    if (!command || typeof command !== 'object' || !command.action) return;

    const { action, data = {} } = command;
    const handlers = handlersRef.current;

    try {
      switch (action) {
        // ─── A) İŞLEM EKLE ──────────────────────────────────────────────
        case 'add_transaction': {
          if (!handlers.addTransaction) throw new Error('Transaction handler hazır değil.');
          const type = data.type === 'income' ? 'income' : 'expense';
          await handlers.addTransaction({
            type,
            amount: Number(data.amount) || 0,
            category: data.category || 'General',
            name: data.title || data.name || data.category || 'AI işlemi',
            date: new Date().toISOString(),
          });
          showAgentToast(`İşlem eklendi: ${data.title || data.category} • ${data.amount} TL`);
          break;
        }

        // ─── B) POT OLUŞTUR ─────────────────────────────────────────────
        case 'create_pot': {
          if (!handlers.addPot) throw new Error('Pot handler hazır değil.');
          const targetAmount = Number(data.targetAmount ?? data.target ?? 0);
          if (targetAmount <= 0) throw new Error('Pot hedef tutarı geçersiz.');
          await handlers.addPot({
            name: data.title || data.name || 'Yeni Hedef',
            target: targetAmount,
            theme: data.theme || 'green',
          });
          showAgentToast(`Hedef potu oluşturuldu: ${data.title || data.name} • ${targetAmount} TL`);
          break;
        }

        // ─── C) BÜTÇE OLUŞTUR ───────────────────────────────────────────
        case 'create_budget': {
          if (!handlers.addBudget) throw new Error('Budget handler hazır değil.');
          const limit = Number(data.limit ?? data.maxSpend ?? 0);
          if (limit <= 0) throw new Error('Bütçe limiti geçersiz.');
          await handlers.addBudget({
            category: data.category || 'General',
            limit,
            maxSpend: limit, // backend her ikisini de kabul ediyor
            theme: data.theme || 'blue',
          });
          showAgentToast(`Bütçe oluşturuldu: ${data.category} • ${limit} TL`);
          break;
        }

        // ─── D) BÜTÇE YENİDEN DAĞIT ─────────────────────────────────────
        case 'update_budget': {
          if (!handlers.reallocateBudget) throw new Error('Reallocate handler hazır değil.');
          const moveAmount = Number(data.amount) || 0;
          if (moveAmount <= 0) throw new Error('Aktarılacak tutar geçersiz.');
          if (!data.from || !data.to) throw new Error('Kaynak/hedef kategori eksik.');
          await handlers.reallocateBudget({
            from: data.from,
            to: data.to,
            amount: moveAmount,
          });
          showAgentToast(`${moveAmount} TL aktarıldı: ${data.from} → ${data.to}`);
          break;
        }

        // ─── E) PORTFÖY VARLIĞI EKLE ────────────────────────────────────
        case 'add_portfolio': {
          if (!handlers.addPortfolio) throw new Error('Portfolio handler hazır değil.');
          const assetType = normalizeAsset(data.asset || data.assetType);
          const amount = Number(data.amount) || 0;
          if (!assetType || amount <= 0) throw new Error('Varlık veya miktar geçersiz.');
          const transactionType = String(data.type || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
          await handlers.addPortfolio({
            assetType,
            transactionType,
            amount,
            pricePerUnit: Number(data.pricePerUnit) || 0,
          });
          showAgentToast(
            `Portföy: ${transactionType} ${amount} ${assetType}` +
              (Number(data.pricePerUnit) > 0 ? ` @ ${data.pricePerUnit} TL` : '')
          );
          break;
        }

        // ─── F) FATURAYI ÖDENDİ İŞARETLE ────────────────────────────────
        case 'mark_bill_paid': {
          if (!handlers.markBillPaid) throw new Error('Bill handler hazır değil.');
          const resolved = resolveBill(handlers.getBills?.(), data);
          if (!resolved) throw new Error(`Fatura bulunamadı: ${data.billName || data.billId || 'bilinmiyor'}`);
          if (resolved.isPaid) {
            showAgentToast(`"${resolved.name}" zaten ödendi olarak işaretli.`, 'info');
            break;
          }
          await handlers.markBillPaid(resolved.id);
          showAgentToast(`Fatura ödendi olarak işaretlendi: ${resolved.name}`);
          break;
        }

        // ─── G) FATURAYI ÖDENMEDİ'YE GERİ AL ────────────────────────────
        case 'mark_bill_unpaid': {
          if (!handlers.markBillUnpaid) throw new Error('Bill handler hazır değil.');
          const resolved = resolveBill(handlers.getBills?.(), data);
          if (!resolved) throw new Error(`Fatura bulunamadı: ${data.billName || data.billId || 'bilinmiyor'}`);
          if (!resolved.isPaid) {
            showAgentToast(`"${resolved.name}" zaten ödenmemiş görünüyor.`, 'info');
            break;
          }
          await handlers.markBillUnpaid(resolved.id);
          showAgentToast(`Fatura ödenmedi olarak güncellendi: ${resolved.name}`);
          break;
        }

        default:
          console.warn('[AGENT_COMMAND] Bilinmeyen action:', action);
          return;
      }

      console.log('[AGENT_COMMAND] OK', action, data);
    } catch (err) {
      console.error('[AGENT_COMMAND] Hata:', action, err);
      showAgentToast(`İşlem yapılamadı: ${err?.message || action}`, 'error');
    }
  }, [showAgentToast]);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        toggleChat,
        messages,
        addMessage,
        unreadCount,
        // Chart modal API
        isChartModalOpen,
        chartModalConfig,
        openChartModal,
        closeChartModal,
        // Agent API
        registerAgentHandlers,
        executeAgentCommand,
        // Toast API — forwards to global ToastHost
        showAgentToast,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within a ChatProvider");
  return context;
};
