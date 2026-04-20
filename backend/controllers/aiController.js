import fetch from 'node-fetch';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const renderTransactions = (transactions) => {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return 'Henüz harcama kaydı yok.';
  }

  return transactions
    .map((t) => `- ${t.date || 'Tarih yok'}: ${t.category || 'Unknown'}, ${t.amount} TL, ${t.type || 'unknown'}`)
    .join('\n');
};

export const getAiAnswer = async (req, res) => {
  const { prompt, transactions } = req.body;
  if (!prompt) {
    return res.status(400).json({ message: 'Prompt is required.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ message: 'Gemini API key is not configured.' });
  }

  const financeContext = renderTransactions(transactions || []);
  const systemInstruction = `Sen Muhammed Enes'in finans asistanısın. İsmim Gemini 3 Flash altyapısına dayanıyor. Lütfen sadece Türkçe cevap ver ve Muhammed Enes'e ismiyle hitap et. Veriler:\n${financeContext}`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemInstruction + '\n\nSoru: ' + prompt }] }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(502).json({ message: data.error?.message || 'Gemini API error' });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ message: 'Unexpected Gemini response.' });
    }

    res.json({ text });
  } catch (error) {
    console.error('AI controller error:', error);
    res.status(500).json({ message: 'AI service error.' });
  }
};
