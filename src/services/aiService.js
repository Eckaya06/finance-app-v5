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
    });
    return data.text;
  } catch (error) {
    console.error('AI service error:', error);
    return `${userName}, şu an API kapısında bir sorun var gibi görünüyor. Lütfen daha sonra tekrar dene.`;
  }
};
