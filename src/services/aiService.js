import api from '../api.js';

/**
 * Yapay zekaya tam finansal bağlamı + konuşma geçmişini gönderir.
 * @param {string} userPrompt - Kullanıcının doğal dildeki yeni mesajı.
 * @param {Object} context
 *   - transactions: kullanıcının işlem listesi
 *   - budgets:      kullanıcının bütçeleri (computed: spent dahil)
 *   - pots:         hedef potları
 *   - portfolio:    /portfolio/summary cevabı (holdings + summary)
 *   - history:      [{ role: 'user'|'model', text }]  -> çoklu-tur bağlam
 */
export const getAiResponse = async (userPrompt, context = {}) => {
  const {
    transactions = [],
    budgets = [],
    pots = [],
    portfolio = null,
    bills = [],
    history = [],
    userName = 'dostum',
    lang = 'tr',
  } = context;

  try {
    const { data } = await api.post('/ai', {
      prompt: userPrompt,
      transactions,
      budgets,
      pots,
      portfolio,
      bills,
      history,
      userName,
      lang,
    });
    return data.text;
  } catch (error) {
    console.error('AI service error:', error);
    const isEn = String(lang).toLowerCase().startsWith('en');
    const backendMsg = String(error?.response?.data?.message || '');

    // Gemini quota / rate limit özel mesajı — kullanıcı için sadeleştir.
    // Gerçek hata metni teknik link'ler ve uzun açıklama içeriyor; biz
    // kısaca "kota doldu, ~Xs sonra dene" diyoruz.
    const isQuota =
      /quota/i.test(backendMsg) ||
      /rate.?limit/i.test(backendMsg) ||
      /exceeded/i.test(backendMsg);
    if (isQuota) {
      // "Please retry in 45.28s." kısmındaki süreyi yakala
      const m = backendMsg.match(/retry in ([\d.]+)\s*s/i);
      const seconds = m ? Math.ceil(parseFloat(m[1])) : null;
      if (isEn) {
        return seconds
          ? `${userName}, the AI is rate-limited right now. Try again in about ${seconds} seconds.`
          : `${userName}, the AI is rate-limited right now. Please wait a minute and try again.`;
      }
      return seconds
        ? `${userName}, yapay zeka şu an istek limitine takıldı. Yaklaşık ${seconds} saniye sonra tekrar dene.`
        : `${userName}, yapay zeka şu an istek limitine takıldı. Bir dakika bekleyip tekrar dene.`;
    }

    // Diğer backend hataları — orijinal mesajı göster (debug için faydalı).
    if (backendMsg) {
      return isEn
        ? `${userName}, the AI service returned an error: ${backendMsg}`
        : `${userName}, yapay zeka servisi şu hatayı döndü: ${backendMsg}`;
    }

    // Network hatası — backend muhtemelen kapalı veya cevap vermiyor.
    return isEn
      ? `${userName}, looks like there's a hiccup at the API gateway. Please try again later.`
      : `${userName}, şu an API kapısında bir sorun var gibi görünüyor. Lütfen daha sonra tekrar dene.`;
  }
};
