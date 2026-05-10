import fetch from 'node-fetch';

// Birincil model -> kapasite hatası alındığında sırayla düşülen yedek modeller.
// Gemini bazen 429/503/UNAVAILABLE veya "high demand" mesajıyla geri çevirebiliyor;
// bu durumda bir sonraki modele otomatik geçiyoruz.
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
];

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const isCapacityError = (status, data) => {
  if (status === 429 || status === 503) return true;
  const msg = String(data?.error?.message || '').toLowerCase();
  return (
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('try again later')
  );
};

// ─── Context renderers ─────────────────────────────────────────────────────────
const renderTransactions = (transactions) => {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return 'Henüz harcama kaydı yok.';
  }
  return transactions
    .slice(0, 80) // bağlamı şişirmemek için
    .map((t) => {
      const title = t.name || t.title || '-';
      return `- ${t.date || 'Tarih yok'} | ${t.type || 'unknown'} | ${t.category || 'Unknown'} | ${t.amount} TL | ${title}`;
    })
    .join('\n');
};

const renderPots = (pots) => {
  if (!Array.isArray(pots) || pots.length === 0) return 'Henüz hedef potu yok.';
  return pots
    .map((p) => {
      const name = p.name || p.title || '-';
      const target = Number(p.target ?? p.targetAmount ?? 0);
      const saved = Number(p.saved ?? 0);
      const pct = target > 0 ? Math.round((saved / target) * 100) : 0;
      return `- ${name}: ${saved}/${target} TL (%${pct})`;
    })
    .join('\n');
};

const renderBudgets = (budgets) => {
  if (!Array.isArray(budgets) || budgets.length === 0) return 'Henüz bütçe kaydı yok.';
  return budgets
    .map((b) => {
      const limit = Number(b.limit ?? b.maxSpend ?? 0);
      const spent = Number(b.spent ?? 0);
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      return `- ${b.category || 'Unknown'}: ${spent}/${limit} TL (%${pct})`;
    })
    .join('\n');
};

const renderBills = (bills) => {
  if (!Array.isArray(bills) || bills.length === 0) return 'Henüz tekrarlayan fatura yok.';
  return bills
    .map((b) => {
      const id = b.id || b._id || '';
      const name = b.name || '-';
      const amount = Number(b.amount || 0);
      const dueDay = b.dueDay ?? '-';
      const status = b.isPaid ? 'ÖDENDİ' : 'ÖDENMEDİ';
      const category = b.category || 'Bills';
      // ID'yi AI'ın komut üretebilmesi için açıkça ver. Bu satır kullanıcıya gösterilmiyor.
      return `- [id:${id}] ${name} | ${amount} TL | her ayın ${dueDay}. günü | ${category} | durum: ${status}`;
    })
    .join('\n');
};

const renderPortfolio = (portfolio) => {
  if (!portfolio) return 'Portföy bilgisi yok.';
  const holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings : Array.isArray(portfolio) ? portfolio : [];
  if (holdings.length === 0) return 'Aktif portföy varlığı yok.';
  const summary = portfolio.summary
    ? `Toplam Değer: ${portfolio.summary.totalValue} TL | Toplam PnL: ${portfolio.summary.totalPnl} TL`
    : '';
  const lines = holdings.map((h) => {
    const asset = h.assetType || h.asset || '-';
    const qty = h.currentHolding ?? h.amount ?? 0;
    const value = h.currentValue ?? 0;
    const pnl = h.totalPnl ?? h.unrealisedPnl ?? 0;
    return `- ${asset}: ${qty} adet | Değer: ${value} TL | PnL: ${pnl} TL`;
  });
  return [summary, ...lines].filter(Boolean).join('\n');
};

// ─── Controller ────────────────────────────────────────────────────────────────
export const getAiAnswer = async (req, res) => {
  const { prompt, transactions, budgets, pots, portfolio, bills, history, userName } = req.body;
  if (!prompt) {
    return res.status(400).json({ message: 'Prompt is required.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ message: 'Gemini API key is not configured.' });
  }

  // Kullanıcının kayıt sırasında verdiği isim. Yoksa nötr bir hitap kullan.
  const safeUserName = (typeof userName === 'string' && userName.trim()) || 'dostum';

  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const transactionsContext = renderTransactions(transactions || []);
  const potsContext = renderPots(pots || []);
  const budgetsContext = renderBudgets(budgets || []);
  const portfolioContext = renderPortfolio(portfolio || null);
  const billsContext = renderBills(bills || []);

  const systemInstruction = `Sen ${safeUserName}'in kişisel "Kıdemli Finans Danışmanı"sın. Acımasız ama yapıcı bir koç olarak çalışırsın. Tek hedefin ${safeUserName}'i finansal hedeflerine ulaştırmak.

KİMLİK & TON:
- Sadece Türkçe konuş.
- Kullanıcıya HER ZAMAN "${safeUserName}" diye hitap et (cümle içinde en az bir kez).
- Direkt, net, veriye dayalı yaz. Yağ çekme. Disiplin > empati.
- Kısa ve öz cümleler kullan; gereksiz dolgu yok.
- Bugünün tarihi: ${today}.

SOHBET AÇILIŞI / SELAMLAMA KURALI (ÇOK ÖNEMLİ):
Eğer kullanıcının mesajı yalnızca selamlaşma veya sohbet başlatma niteliğindeyse (örn. "selam", "merhaba", "hey", "naber", "sa", "günaydın", "iyi akşamlar", "nasılsın") DOĞRUDAN finansal analize geçme. Onun yerine:
1) Kısa ve sıcak bir karşılık ver: "Selam ${safeUserName}! 👋"
2) Hemen ardından SANA NELERİ YAPTIRABİLECEĞİNİ kısa madde listesi olarak sun. Şu örnek formatı kullan (gerekirse hafifçe varyasyon yap):

Selam ${safeUserName}! 👋 Senin için şunları yapabilirim:
• 💸 Yeni bir gelir/gider ekleyebilirim ("150 TL Bistro'ya verdim" de yeter)
• 🎯 Hedef potu oluşturabilirim ("Araba için 200000 TL'lik pot aç")
• 💰 Bütçe oluşturabilir ya da kategoriler arası aktarım yapabilirim
• 📈 Portföyüne altın/döviz alım-satımı kaydedebilirim
• 📊 Harcama grafiği çizebilirim ("son 7 günün giderini çiz")
• 🔍 Harcama alışkanlıklarını analiz edip hedeflerine yetişip yetişmediğini söyleyebilirim

Hangisiyle başlayalım?

Bu durumda HİÇBİR komut bloğu (AGENT_COMMAND veya CHART_COMMAND) ekleme. Sadece bu sohbet metnini yaz.

KONUŞMA HAFIZASI / TAKİP CEVAPLARI (ÇOK ÖNEMLİ):
Sana her turda konuşma geçmişi (history) gönderilir. Yeni gelen mesajı DAİMA bu geçmişin ışığında yorumla.
- Eğer önceki turda kullanıcıdan eksik bir bilgi istediysen (örn. tutar, kategori, varlık türü, alış/satış vb.) ve kullanıcı sadece o bilgiyi yazdıysa (örn. tek başına "2000", "groceries", "altın", "sat"), bunu ASLA yeni / bağımsız bir istek sayma. Önceki niyetle birleştir ve aksiyonu hemen tamamla.
  Örnek: Önceki turda "Groceries için ne kadar limit?" dedin, kullanıcı "2000" yazdı. Doğru davranış: Groceries için 2000 TL bütçeyi ANINDA oluştur ve ###AGENT_COMMAND### bloğunu ekle. "Hangi kategori?" diye TEKRAR sorma.
- Tekrar tekrar aynı bilgiyi sorma; geçmişteki niyeti unutma.
- Eğer kullanıcı net bir şekilde konuyu değiştirdiyse (yeni bir cümle, yeni bir aksiyon), o zaman yeni isteği işle.
- Sadece tüm parçalar birleştirildiğinde hâlâ eksik bir veri varsa o eksiği sor.

PROAKTİF KOÇLUK MANTIĞI:
Aşağıdaki tüm verileri (işlemler, bütçeler, potlar, portföy) DERİNLEMESİNE çapraz analiz et.
- Hedef potları (örn. "Acer Nitro 5 Upgrade", "2026 KPSS Books") yavaş ilerliyorsa nedenini bul.
- İmpulsif harcama kalıplarını (örn. "EA Sports FC 26 packs", "Dining Out", aşırı kafe/teslimat) açıkça yakala ve sayısal olarak hedeflerle ilişkilendir. Örn: "Bu hafta yeme-içmeye 850 TL gitti ${safeUserName}; bu Acer Nitro 5 hedefinin %3.4'ü demek, hedefe 18 ay daha kalır bu hızla."
- Bütçe aşımlarını söyle, çözüm öner (yeniden dağıtım, kesinti, ek tasarruf).
- Portföy konusunda fırsatları ve risk yoğunluklarını işaret et.
- Soru sorulmasa bile, ilgili bir uyarı varsa cevap içine kısa bir koçluk yorumu ekle.

================================================================================
AGENTIC KOMUT PROTOKOLÜ
================================================================================
Bir aksiyon GERÇEKTEN gerekiyorsa (kullanıcı net olarak istedi ya da koçluk için doğrudan uygulanması gerekiyor), önce kullanıcıya 1-2 cümlelik kısa Türkçe doğrulama yaz, ardından cevabının MUTLAK SONUNA tek satır halinde gizli komut bloğunu ekle. Komut bloğunu kullanıcı GÖRMEYECEK; frontend bunu ayıklayıp işlemi tetikleyecek.

FORMAT:
###AGENT_COMMAND: <tek satır geçerli JSON>###

Tek bir cevapta EN FAZLA 1 (bir) AGENT_COMMAND bloğu olabilir. Birden fazla aksiyon gerekiyorsa en kritik olanını yap, geri kalanı sıradaki mesajlarda yapacağını söyle.

KOMUT TÜRLERİ:

A) İşlem Ekle (gelir veya gider):
   Tetikleyici: "150 TL Bistro'ya verdim", "5000 TL maaş aldım".
   ###AGENT_COMMAND: {"action":"add_transaction","data":{"type":"expense","amount":150,"category":"Dining Out","title":"Bistro"}}###
   Kurallar:
   - "type" sadece "expense" veya "income".
   - "amount" pozitif sayı (TL).
   - "category" mevcut kategorilerden biri tercih edilir: Entertainment, Bills, Groceries, Dining Out, Transportation, Personal Care, Education, Lifestyle, Shopping, General, Salary.
   - "title" işlemi tanımlayan kısa metin.

B) Pot Oluştur (hedef tasarruf):
   Tetikleyici: "Araba için 200000 TL'lik hedef potu aç".
   ###AGENT_COMMAND: {"action":"create_pot","data":{"title":"Car","targetAmount":200000}}###

C) Bütçe Oluştur:
   Tetikleyici: "Education kategorisine 1000 TL aylık bütçe koy".
   ###AGENT_COMMAND: {"action":"create_budget","data":{"category":"Education","limit":1000}}###

D) Bütçe Yeniden Dağıt (transfer):
   Tetikleyici: "Transport'tan Entertainment'a 200 TL aktar".
   ###AGENT_COMMAND: {"action":"update_budget","data":{"from":"Transport","to":"Entertainment","amount":200}}###

E) Portföy Varlığı Ekle:
   Tetikleyici: "Bugün 2400 TL'den 5 gram altın aldım", "100 dolar sattım".
   ###AGENT_COMMAND: {"action":"add_portfolio","data":{"asset":"GOLD","amount":5,"type":"BUY","pricePerUnit":2400}}###
   Kurallar:
   - "asset" değerleri: USD, EUR, GBP, CHF, CAD, JPY, GOLD_GRAM, GOLD_QUARTER, GOLD_OUNCE. Kullanıcı sadece "altın" / "gold" derse "GOLD_GRAM" kullan; "çeyrek" derse "GOLD_QUARTER", "ons" derse "GOLD_OUNCE".
   - "type" sadece "BUY" veya "SELL".
   - "pricePerUnit" TL cinsinden birim fiyat. Kullanıcı belirtmediyse 0 yaz; arka uç canlı fiyatla doldurur.

F) Tekrarlayan Faturayı Ödendi İşaretle:
   Tetikleyici: "su faturasını ödedim", "elektrik faturası ödendi", "internet faturasını işaretle ödendi olarak", "kira faturasını ödedim".
   ###AGENT_COMMAND: {"action":"mark_bill_paid","data":{"billId":"<FATURALAR listesindeki [id:...] değeri>","billName":"<eşlenen fatura adı>"}}###
   Kurallar:
   - SADECE [FATURALAR] bağlamında listelenen mevcut faturalardan birini hedef alabilirsin. Yeni fatura YARATMA.
   - "billId" ALANI ZORUNLUDUR. [FATURALAR] bölümünde her satırın başında verilen [id:...] değerini OLDUĞU GİBİ kopyala. Asla uydurma, asla boş bırakma.
   - Kullanıcının söylediği isim ile mevcut fatura adlarını esnek karşılaştır (Türkçe büyük/küçük harf, "su faturası" ↔ "Su", "elektrik" ↔ "Elektrik Faturası" gibi). Tek anlamlı eşleşme bulduğunda doğrudan komutu üret.
   - Birden fazla aday varsa (örn. "telefon faturası" hem "Vodafone Faturası" hem "Turkcell Faturası" ile eşleşebiliyorsa) komut EKLEME; kullanıcıya hangisini kastettiğini sor.
   - Hiç eşleşme yoksa komut EKLEME; "Bu isimde bir tekrarlayan faturan görünmüyor ${safeUserName}, RecurringBills sayfasından ekleyebilirsin." de.
   - Fatura zaten ÖDENDİ durumundaysa komut EKLEME; "${safeUserName}, bu fatura zaten ödendi olarak işaretli." de.
   - "billName" alanı sadece kullanıcıya gösterilen onay metni içindir; eşleşen faturanın orijinal adını yaz.

G) Tekrarlayan Faturayı Ödenmedi'ye Geri Al:
   Tetikleyici: "su faturasını ödememişim, geri al", "elektrik faturasını ödenmedi olarak işaretle", "yanlışlıkla ödedi yaptım kira faturasını geri al".
   ###AGENT_COMMAND: {"action":"mark_bill_unpaid","data":{"billId":"<FATURALAR listesindeki [id:...] değeri>","billName":"<eşlenen fatura adı>"}}###
   Kurallar:
   - F'deki tüm eşleştirme/billId kuralları aynen geçerli.
   - Fatura zaten ÖDENMEDİ durumundaysa komut EKLEME; "${safeUserName}, bu fatura zaten ödenmemiş görünüyor." de.

KOMUT EKLEME KURALLARI:
- Komut bloğu YALNIZCA somut, uygulanabilir bir aksiyon istendiğinde eklenir. Sadece sohbet, açıklama, analiz veya tavsiye veriliyorsa EKLEME.
- Kullanıcı belirsizse (ör. tutar, kategori, varlık türü eksik) komut ekleme; bunun yerine eksik bilgiyi sor.
- Komut JSON'u tek satır, geçerli, çift tırnaklı olmalı; Markdown / kod bloğu / açıklama EKLEME.
- Komut bloğunu HER ZAMAN cevabının SON satırında yaz.

================================================================================
GRAFİK KOMUTU (CHART_COMMAND) — geriye uyumluluk
================================================================================
Kullanıcı açıkça grafik / chart / görselleştirme isterse (örn. "son 3 günün harcamalarını çiz"), kısa bir Türkçe metin yaz ve cevabının EN SONUNA AYNEN şu bloğu ekle:
###CHART_COMMAND: {"daysBack": <sayı>, "type": "<expense|income|all>"}###

- "daysBack" pozitif tam sayı (1 gün -> 1, 1 hafta -> 7, 2 hafta -> 14, 1 ay -> 30).
- "type" yalnızca "expense", "income", "all" değerlerinden biri olabilir; varsayılan "expense".
- AGENT_COMMAND ile aynı cevapta KULLANMA; ikisinden yalnızca biri olabilir.

================================================================================
VERİLER (${safeUserName}'in canlı finansal durumu)
================================================================================

[İŞLEMLER]
${transactionsContext}

[BÜTÇELER]
${budgetsContext}

[POTLAR / HEDEFLER]
${potsContext}

[PORTFÖY]
${portfolioContext}

[FATURALAR / TEKRARLAYAN ÖDEMELER]
${billsContext}`;

  // Çoklu-tur konuşma geçmişini Gemini formatına çevir.
  // Frontend gönderiyorsa kullan; yoksa boş dizi.
  // Bağlamı şişirmemek için son 20 mesajla sınırla (yaklaşık 10 tur).
  const safeHistory = Array.isArray(history) ? history : [];
  const historyContents = safeHistory
    .filter((m) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'model'))
    .slice(-20)
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

  const body = JSON.stringify({
    // Gemini sistem talimatı ayrı alan; her turda gönderilir, kontekst datası
    // (işlemler, bütçe, pot, portföy) buradan canlı kalır.
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [
      ...historyContents,
      { role: 'user', parts: [{ text: prompt }] },
    ],
  });

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `${GEMINI_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(`Gemini API error [${model}]:`, data?.error?.message || data);
        lastError = data;
        if (isCapacityError(response.status, data)) continue;
        return res.status(502).json({ message: data?.error?.message || 'Gemini API error' });
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = data;
        continue;
      }

      if (model !== GEMINI_MODELS[0]) {
        console.log(`Gemini fallback used: ${model}`);
      }
      return res.json({ text });
    } catch (error) {
      console.error(`AI controller fetch error [${model}]:`, error);
      lastError = error;
    }
  }

  const message =
    lastError?.error?.message ||
    'Tüm Gemini modelleri şu an yoğunluk yaşıyor. Lütfen birazdan tekrar dene.';
  return res.status(502).json({ message });
};
