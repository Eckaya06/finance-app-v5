import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext.jsx';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

// ─── Tema (renk) yardımcıları — AI pot/budget oluştururken kullanır ─────
// Pot ve Budget formlarındaki ortak 7 tema. AI bunlardan biriyle gelmezse
// kullanıcının söylediği rengi normalize ediyoruz; renk hiç söylenmemişse
// mevcut pot/budget temalarına bakıp boşta olan birini rastgele veriyoruz.
const ALL_THEMES = ['blue', 'cyan', 'green', 'orange', 'indigo', 'red', 'purple'];

const COLOR_TO_THEME = {
  // İngilizce / tema kodları
  blue: 'blue', cyan: 'cyan', green: 'green', orange: 'orange',
  indigo: 'indigo', red: 'red', purple: 'purple',
  // Türkçe karşılıklar
  mavi: 'blue',
  'cam göbeği': 'cyan', camgobegi: 'cyan', 'cam gobegi': 'cyan', turkuaz: 'cyan',
  yeşil: 'green', yesil: 'green',
  turuncu: 'orange', portakal: 'orange',
  çivit: 'indigo', civit: 'indigo', lacivert: 'indigo',
  kırmızı: 'red', kirmizi: 'red', kızıl: 'red', kizil: 'red',
  mor: 'purple', erguvani: 'purple', menekşe: 'purple', menekse: 'purple',
};

const normalizeTheme = (raw) => {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  if (COLOR_TO_THEME[key]) return COLOR_TO_THEME[key];
  return ALL_THEMES.includes(key) ? key : null;
};

const pickUnusedTheme = (usedThemes = []) => {
  const usedSet = new Set(
    usedThemes.filter(Boolean).map((t) => String(t).toLowerCase())
  );
  const available = ALL_THEMES.filter((t) => !usedSet.has(t));
  const pool = available.length > 0 ? available : ALL_THEMES;
  return pool[Math.floor(Math.random() * pool.length)];
};

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // ✅ Insight (bütçe/fatura uyarısı) okunmamış sayısı — generic unreadCount'tan
  // ayrı; FAB tooltip metnini "AI Bütçe Uyarısı" vs "X yeni mesaj" arasında
  // ayırt etmek için kullanılır.
  const [unreadInsightCount, setUnreadInsightCount] = useState(0);

  // ✅ Oturum karşılaması: kullanıcı siteye her girdiğinde (login veya sayfa
  // yenileme sonrası /auth/me ile user set olduğunda) bir kez bot mesajı
  // oluştur ve okunmamış bildirim olarak işaretle. Kullanıcı widget'ı
  // açtığında bu mesajı görür. Aynı user.uid için tekrar tetiklenmez;
  // logout olunca sıfırlanır.
  const lastGreetedUserRef = useRef(null);
  useEffect(() => {
    if (!user?.uid) {
      // Logout: state ve flag sıfırla
      lastGreetedUserRef.current = null;
      setMessages([]);
      setUnreadCount(0);
      setUnreadInsightCount(0);
      return;
    }
    if (lastGreetedUserRef.current === user.uid) return;
    lastGreetedUserRef.current = user.uid;
    const userName = user.displayName?.trim() || 'dostum';
    const greeting = t('chat.greeting', { name: userName });
    setMessages([{ sender: 'bot', text: greeting, kind: 'normal' }]);
    // Idempotent set: StrictMode'da effect iki kez çalışsa bile count 1 kalır.
    if (!isOpen) setUnreadCount(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, t]);

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
        setUnreadInsightCount(0);
      }

      return !prev;
    });
  };

  // kind: 'normal' (varsayılan — karşılama, AI yanıtı) veya 'insight'
  // (bütçe/fatura uyarısı). Insight olduğunda hem genel hem insight sayacı artar.
  const addMessage = (sender, text, kind = 'normal') => {
    setMessages((prev) => [...prev, { sender, text, kind }]);

    if (sender === 'bot' && !isOpen) {
      setUnreadCount((prev) => prev + 1);
      if (kind === 'insight') {
        setUnreadInsightCount((prev) => prev + 1);
      }
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
          // Renk seçimi: AI/kullanıcı renk verdiyse normalize et; vermediyse
          // mevcut potlarda boşta olan bir renk rastgele seç.
          const requestedTheme = normalizeTheme(data.theme || data.color);
          const potTheme = requestedTheme || pickUnusedTheme(
            (handlers.getPots?.() || []).map((p) => p.theme)
          );
          await handlers.addPot({
            name: data.title || data.name || 'Yeni Hedef',
            target: targetAmount,
            theme: potTheme,
          });
          showAgentToast(`Hedef potu oluşturuldu: ${data.title || data.name} • ${targetAmount} TL`);
          break;
        }

        // ─── C) BÜTÇE OLUŞTUR ───────────────────────────────────────────
        case 'create_budget': {
          if (!handlers.addBudget) throw new Error('Budget handler hazır değil.');
          const limit = Number(data.limit ?? data.maxSpend ?? 0);
          if (limit <= 0) throw new Error('Bütçe limiti geçersiz.');
          const requestedTheme = normalizeTheme(data.theme || data.color);
          const budgetTheme = requestedTheme || pickUnusedTheme(
            (handlers.getBudgets?.() || []).map((b) => b.theme)
          );
          await handlers.addBudget({
            category: data.category || 'General',
            limit,
            maxSpend: limit, // backend her ikisini de kabul ediyor
            theme: budgetTheme,
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
        unreadInsightCount,
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
