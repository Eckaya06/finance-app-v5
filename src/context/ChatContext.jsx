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

// Pot ve budget için aynı strateji: önce id, sonra isim/kategori. Bill resolver
// ile aynı esnekliği kullanıyoruz — kullanıcı "araba" dese de "Araba Hedefi"
// ile eşleşebilsin.
const resolvePot = (pots, data = {}) => {
  if (!Array.isArray(pots) || pots.length === 0) return null;
  const idTarget = String(data.potId || '').trim();
  if (idTarget) {
    const byId = pots.find((p) => String(p.id) === idTarget || String(p._id) === idTarget);
    if (byId) return byId;
  }
  const nameTarget = normalizeBillKey(data.potName);
  if (!nameTarget) return null;
  const exact = pots.find((p) => normalizeBillKey(p.name) === nameTarget);
  if (exact) return exact;
  const partial = pots.filter((p) => {
    const n = normalizeBillKey(p.name);
    return n.includes(nameTarget) || nameTarget.includes(n);
  });
  return partial.length === 1 ? partial[0] : null;
};

const resolveBudget = (budgets, data = {}) => {
  if (!Array.isArray(budgets) || budgets.length === 0) return null;
  const idTarget = String(data.budgetId || '').trim();
  if (idTarget) {
    const byId = budgets.find((b) => String(b.id) === idTarget || String(b._id) === idTarget);
    if (byId) return byId;
  }
  const catTarget = normalizeBillKey(data.category);
  if (!catTarget) return null;
  const exact = budgets.find((b) => normalizeBillKey(b.category) === catTarget);
  if (exact) return exact;
  const partial = budgets.filter((b) => {
    const c = normalizeBillKey(b.category);
    return c.includes(catTarget) || catTarget.includes(c);
  });
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
        // Karşılama mesajı her açılışta görünsün. Açılış sırasında insight
        // birikmiş olabilir (FAB kapalıyken push edilen botlar), onları
        // koruyup greeting'i listenin başına ekliyoruz.
        const userName = user?.displayName?.trim() || 'dostum';
        const greeting = t('chat.greeting', { name: userName });
        setMessages((prevMsgs) => {
          const hasGreeting = prevMsgs.some(
            (m) => m.sender === 'bot' && m.text === greeting
          );
          if (hasGreeting) return prevMsgs;
          return [{ sender: 'bot', text: greeting, kind: 'normal' }, ...prevMsgs];
        });
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
          if (!handlers.addTransaction) throw new Error(t('chat.agent.err', { reason: 'addTransaction' }));
          const type = data.type === 'income' ? 'income' : 'expense';
          await handlers.addTransaction({
            type,
            amount: Number(data.amount) || 0,
            category: data.category || 'General',
            name: data.title || data.name || data.category || 'AI',
            date: new Date().toISOString(),
          });
          showAgentToast(t('chat.agent.txAdded', {
            title: data.title || data.category,
            amount: data.amount,
          }));
          break;
        }

        // ─── B) POT OLUŞTUR ─────────────────────────────────────────────
        case 'create_pot': {
          if (!handlers.addPot) throw new Error(t('chat.agent.err', { reason: 'addPot' }));
          const targetAmount = Number(data.targetAmount ?? data.target ?? 0);
          if (targetAmount <= 0) throw new Error(t('chat.agent.errAmountInvalid'));
          // Renk seçimi: AI/kullanıcı renk verdiyse normalize et; vermediyse
          // mevcut potlarda boşta olan bir renk rastgele seç.
          const requestedTheme = normalizeTheme(data.theme || data.color);
          const potTheme = requestedTheme || pickUnusedTheme(
            (handlers.getPots?.() || []).map((p) => p.theme)
          );
          await handlers.addPot({
            name: data.title || data.name || 'New Goal',
            target: targetAmount,
            theme: potTheme,
          });
          showAgentToast(t('chat.agent.potCreated', {
            name: data.title || data.name,
            amount: targetAmount,
          }));
          break;
        }

        // ─── C) BÜTÇE OLUŞTUR ───────────────────────────────────────────
        case 'create_budget': {
          if (!handlers.addBudget) throw new Error(t('chat.agent.err', { reason: 'addBudget' }));
          const limit = Number(data.limit ?? data.maxSpend ?? 0);
          if (limit <= 0) throw new Error(t('chat.agent.errAmountInvalid'));
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
          showAgentToast(t('chat.agent.budgetCreated', {
            category: data.category,
            amount: limit,
          }));
          break;
        }

        // ─── D) BÜTÇE YENİDEN DAĞIT ─────────────────────────────────────
        case 'update_budget': {
          if (!handlers.reallocateBudget) throw new Error(t('chat.agent.err', { reason: 'reallocateBudget' }));
          const moveAmount = Number(data.amount) || 0;
          if (moveAmount <= 0) throw new Error(t('chat.agent.errAmountInvalid'));
          if (!data.from || !data.to) throw new Error(t('chat.agent.err', { reason: 'from/to missing' }));

          // Kaynak bütçenin kalan miktar kontrolü — limit'ten harcananı çıkarınca
          // aktarılabilir tutar elde edilir. Limit aşılmışsa hiç aktarım yapılamaz;
          // moveAmount > available ise eksik miktarla mesaj göster.
          const allBudgets = handlers.getBudgets?.() || [];
          const sourceBudget = resolveBudget(allBudgets, { category: data.from });
          if (sourceBudget) {
            const limit = Number(sourceBudget.limit ?? sourceBudget.maxSpend ?? 0);
            const spent = Number(sourceBudget.spent ?? 0);
            const available = limit - spent;
            if (available <= 0) {
              throw new Error(t('chat.agent.errBudgetOverspent', {
                from: sourceBudget.category, limit, spent,
              }));
            }
            if (moveAmount > available) {
              throw new Error(t('chat.agent.errBudgetInsufficient', {
                from: sourceBudget.category,
                requested: moveAmount,
                available,
                limit,
                spent,
              }));
            }
          }

          await handlers.reallocateBudget({
            from: data.from,
            to: data.to,
            amount: moveAmount,
          });
          showAgentToast(t('chat.agent.budgetMoved', {
            amount: moveAmount, from: data.from, to: data.to,
          }));
          break;
        }

        // ─── D2) POTA PARA EKLE ─────────────────────────────────────────
        case 'add_to_pot': {
          if (!handlers.updatePotBalance) throw new Error(t('chat.agent.err', { reason: 'updatePotBalance' }));
          const amount = Number(data.amount) || 0;
          if (amount <= 0) throw new Error(t('chat.agent.errAmountInvalid'));
          const pot = resolvePot(handlers.getPots?.(), data);
          if (!pot) throw new Error(t('chat.agent.errPotMissing', { name: data.potName || data.potId || '?' }));
          const newBalance = Number(pot.saved || 0) + amount;
          await handlers.updatePotBalance(pot.id, newBalance);
          showAgentToast(t('chat.agent.potDeposit', {
            name: pot.name, amount, balance: newBalance,
          }));
          break;
        }

        // ─── D3) POTTAN PARA ÇEK ────────────────────────────────────────
        case 'withdraw_from_pot': {
          if (!handlers.updatePotBalance) throw new Error(t('chat.agent.err', { reason: 'updatePotBalance' }));
          const amount = Number(data.amount) || 0;
          if (amount <= 0) throw new Error(t('chat.agent.errAmountInvalid'));
          const pot = resolvePot(handlers.getPots?.(), data);
          if (!pot) throw new Error(t('chat.agent.errPotMissing', { name: data.potName || data.potId || '?' }));
          const current = Number(pot.saved || 0);
          const target = Number(pot.target || 0);

          // Frontend ön kontrolleri — backend de aynısını yapar (defense in depth)
          // ama burada erken throw → kullanıcı backend latency'sini beklemez ve
          // mesaj kullanıcının diliyle gelir (backend hep İngilizce dönüyor).
          if (target > 0 && current >= target) {
            throw new Error(t('potsPage.withdrawBlockedCompleted', { name: pot.name }));
          }
          if (current <= 0) {
            // 0 TL'lik pot — çekecek bir şey yok.
            throw new Error(t('chat.agent.errInsufficientPot', { name: pot.name, balance: 0 }));
          }
          if (amount > current) {
            throw new Error(t('chat.agent.errInsufficientPot', { name: pot.name, balance: current }));
          }

          const newBalance = current - amount;
          try {
            await handlers.updatePotBalance(pot.id, newBalance);
          } catch (apiErr) {
            // Backend reddederse code/message'a göre lokalize mesaj at.
            const code = apiErr?.response?.data?.code;
            if (code === 'POT_WITHDRAW_BLOCKED_COMPLETED') {
              throw new Error(t('potsPage.withdrawBlockedCompleted', { name: pot.name }));
            }
            throw new Error(
              apiErr?.response?.data?.message || apiErr?.message || 'updatePotBalance'
            );
          }
          showAgentToast(t('chat.agent.potWithdraw', {
            name: pot.name, amount, balance: newBalance,
          }));
          break;
        }

        // ─── D4) POTU DÜZENLE (isim/hedef/renk) ─────────────────────────
        case 'edit_pot': {
          if (!handlers.updatePot) throw new Error(t('chat.agent.err', { reason: 'updatePot' }));
          const pot = resolvePot(handlers.getPots?.(), data);
          if (!pot) throw new Error(t('chat.agent.errPotMissing', { name: data.potName || data.potId || '?' }));
          // Sadece sağlanan alanları güncelle — diğerlerini koru.
          const updates = {};
          if (data.newName && String(data.newName).trim()) updates.name = String(data.newName).trim();
          if (data.newTarget != null) {
            const tg = Number(data.newTarget);
            if (!Number.isFinite(tg) || tg <= 0) throw new Error(t('chat.agent.errAmountInvalid'));
            updates.target = tg;
          }
          const themeNorm = normalizeTheme(data.theme || data.color);
          if (themeNorm) updates.theme = themeNorm;
          if (Object.keys(updates).length === 0) {
            throw new Error(t('chat.agent.errNothingToEdit'));
          }
          await handlers.updatePot(pot.id, updates);
          const parts = [];
          if (updates.name) parts.push(t('chat.agent.fieldName', { value: updates.name }));
          if (updates.target) parts.push(t('chat.agent.fieldTarget', { value: updates.target }));
          if (updates.theme) parts.push(t('chat.agent.fieldTheme', { value: updates.theme }));
          showAgentToast(t('chat.agent.potUpdated', { name: pot.name, changes: parts.join(' · ') }));
          break;
        }

        // ─── D5) POTU SİL ───────────────────────────────────────────────
        case 'delete_pot': {
          if (!handlers.deletePot) throw new Error(t('chat.agent.err', { reason: 'deletePot' }));
          const pot = resolvePot(handlers.getPots?.(), data);
          if (!pot) throw new Error(t('chat.agent.errPotMissing', { name: data.potName || data.potId || '?' }));
          const saved = Number(pot.saved || 0);
          const target = Number(pot.target || 0);
          if (target > 0 && saved >= target) {
            throw new Error(t('potsPage.deleteBlockedCompleted', { name: pot.name }));
          }
          if (saved > 0) {
            throw new Error(t('potsPage.deleteBlockedHasFunds', { name: pot.name, amount: saved }));
          }
          try {
            await handlers.deletePot(pot.id);
          } catch (apiErr) {
            const code = apiErr?.response?.data?.code;
            if (code === 'POT_COMPLETED') {
              throw new Error(t('potsPage.deleteBlockedCompleted', { name: pot.name }));
            }
            if (code === 'POT_HAS_FUNDS') {
              throw new Error(t('potsPage.deleteBlockedHasFunds', { name: pot.name, amount: saved }));
            }
            throw new Error(apiErr?.response?.data?.message || apiErr?.message || 'deletePot');
          }
          showAgentToast(t('chat.agent.potDeleted', { name: pot.name }));
          break;
        }

        // ─── D6) BÜTÇE LİMİT/RENK DÜZENLE ───────────────────────────────
        case 'edit_budget_limit': {
          if (!handlers.updateBudget) throw new Error(t('chat.agent.err', { reason: 'updateBudget' }));
          const budget = resolveBudget(handlers.getBudgets?.(), data);
          if (!budget) throw new Error(t('chat.agent.errBudgetMissing', { name: data.category || data.budgetId || '?' }));
          const updates = {};
          if (data.limit != null) {
            const l = Number(data.limit);
            if (!Number.isFinite(l) || l <= 0) throw new Error(t('chat.agent.errAmountInvalid'));
            updates.limit = l;
          }
          const themeNorm = normalizeTheme(data.theme || data.color);
          if (themeNorm) updates.theme = themeNorm;
          if (Object.keys(updates).length === 0) {
            throw new Error(t('chat.agent.errNothingToEdit'));
          }
          await handlers.updateBudget(budget.id, updates);
          const parts = [];
          if (updates.limit != null) parts.push(t('chat.agent.fieldLimit', { value: updates.limit }));
          if (updates.theme) parts.push(t('chat.agent.fieldTheme', { value: updates.theme }));
          showAgentToast(t('chat.agent.budgetUpdated', {
            category: budget.category, changes: parts.join(' · '),
          }));
          break;
        }

        // ─── D7) BÜTÇEYİ SİL ────────────────────────────────────────────
        case 'delete_budget': {
          if (!handlers.deleteBudget) throw new Error(t('chat.agent.err', { reason: 'deleteBudget' }));
          const budget = resolveBudget(handlers.getBudgets?.(), data);
          if (!budget) throw new Error(t('chat.agent.errBudgetMissing', { name: data.category || data.budgetId || '?' }));
          await handlers.deleteBudget(budget.id);
          showAgentToast(t('chat.agent.budgetDeleted', { category: budget.category }));
          break;
        }

        // ─── E) PORTFÖY VARLIĞI EKLE ────────────────────────────────────
        case 'add_portfolio': {
          if (!handlers.addPortfolio) throw new Error(t('chat.agent.err', { reason: 'addPortfolio' }));
          const assetType = normalizeAsset(data.asset || data.assetType);
          const amount = Number(data.amount) || 0;
          if (!assetType || amount <= 0) throw new Error(t('chat.agent.errAmountInvalid'));
          const transactionType = String(data.type || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
          await handlers.addPortfolio({
            assetType,
            transactionType,
            amount,
            pricePerUnit: Number(data.pricePerUnit) || 0,
          });
          const hasPrice = Number(data.pricePerUnit) > 0;
          showAgentToast(t(hasPrice ? 'chat.agent.portfolioWithPrice' : 'chat.agent.portfolio', {
            type: transactionType, amount, asset: assetType,
            price: data.pricePerUnit,
          }));
          break;
        }

        // ─── F) FATURAYI ÖDENDİ İŞARETLE ────────────────────────────────
        case 'mark_bill_paid': {
          if (!handlers.markBillPaid) throw new Error(t('chat.agent.err', { reason: 'markBillPaid' }));
          const resolved = resolveBill(handlers.getBills?.(), data);
          if (!resolved) throw new Error(t('chat.agent.errBillMissing', { name: data.billName || data.billId || '?' }));
          if (resolved.isPaid) {
            showAgentToast(t('chat.agent.billAlreadyPaid', { name: resolved.name }), 'info');
            break;
          }
          await handlers.markBillPaid(resolved.id);
          showAgentToast(t('chat.agent.billPaid', { name: resolved.name }));
          break;
        }

        // ─── G) FATURAYI ÖDENMEDİ'YE GERİ AL ────────────────────────────
        case 'mark_bill_unpaid': {
          if (!handlers.markBillUnpaid) throw new Error(t('chat.agent.err', { reason: 'markBillUnpaid' }));
          const resolved = resolveBill(handlers.getBills?.(), data);
          if (!resolved) throw new Error(t('chat.agent.errBillMissing', { name: data.billName || data.billId || '?' }));
          if (!resolved.isPaid) {
            showAgentToast(t('chat.agent.billAlreadyUnpaid', { name: resolved.name }), 'info');
            break;
          }
          await handlers.markBillUnpaid(resolved.id);
          showAgentToast(t('chat.agent.billUnpaid', { name: resolved.name }));
          break;
        }

        default:
          console.warn('[AGENT_COMMAND] Unknown action:', action);
          return;
      }

      console.log('[AGENT_COMMAND] OK', action, data);
    } catch (err) {
      console.error('[AGENT_COMMAND] Error:', action, err);
      showAgentToast(t('chat.agent.err', { reason: err?.message || action }), 'error');
    }
  }, [showAgentToast, t]);

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
