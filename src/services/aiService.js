import api from '../api.js';

export const getAiResponse = async (userPrompt, transactions) => {
  try {
    const { data } = await api.post('/ai', {
      prompt: userPrompt,
      transactions,
    });
    return data.text;
  } catch (error) {
    console.error('AI service error:', error);
    return 'Muhammed Enes, þu an API kapýsýnda bir sorun var gibi görünüyor. Lütfen daha sonra tekrar dene.';
  }
};
