// src/components/chatbot/ChatWidget.jsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../context/ChatContext';
import { useTransactions } from '../../context/TransactionContext';
import { useAuth } from '../../context/AuthContext';
import { getAiResponse } from '../../services/aiService';
import api from '../../api.js';
import './ChatWidget.css';

// ✅ AGENTIC UI: Yapay zekanın frontend'e gömdüğü grafik komutu (geriye uyumlu)
const CHART_COMMAND_REGEX = /###CHART_COMMAND:\s*(\{[\s\S]*?\})\s*###/;

// ✅ AGENTIC UI: 5 finansal aksiyon komutu için regex.
// Format: ###AGENT_COMMAND: {...JSON (iç içe nesneler dahil)...}###
// JSON iç içe `{}` içerebileceğinden marker tabanlı (lazy any-char) kullanıyoruz.
const AGENT_COMMAND_REGEX = /###AGENT_COMMAND:\s*([\s\S]+?)\s*###/;

const parseChartCommand = (rawText) => {
  if (typeof rawText !== 'string') return { cleanText: rawText, command: null };
  const match = rawText.match(CHART_COMMAND_REGEX);
  if (!match) return { cleanText: rawText, command: null };

  let command = null;
  try {
    command = JSON.parse(match[1]);
  } catch (err) {
    console.warn('CHART_COMMAND parse failed:', err);
  }
  const cleanText = rawText.replace(CHART_COMMAND_REGEX, '').trim();
  return { cleanText, command };
};

const parseAgentCommand = (rawText) => {
  if (typeof rawText !== 'string') return { cleanText: rawText, command: null };
  const match = rawText.match(AGENT_COMMAND_REGEX);
  if (!match) return { cleanText: rawText, command: null };

  let command = null;
  try {
    command = JSON.parse(match[1].trim());
  } catch (err) {
    console.warn('AGENT_COMMAND parse failed:', err, '\nRaw:', match[1]);
  }
  const cleanText = rawText.replace(AGENT_COMMAND_REGEX, '').trim();
  return { cleanText, command };
};

const ChatWidget = () => {
  const { t } = useTranslation();
  const { toggleChat, messages, addMessage, openChartModal, executeAgentCommand } = useChat();
  const { transactions, budgets, pots, bills } = useTransactions();
  const { user } = useAuth();
  const userName = user?.displayName?.trim() || 'dostum';
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef(null);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();

    // 1. Kullanıcı mesajını ekrana bas
    addMessage('user', userMsg);
    setInput('');
    setIsLoading(true);

    try {
      // 2. AI'a tam finansal bağlam ver (transactions + budgets + pots + portfolio)
      let portfolio = null;
      try {
        const { data } = await api.get('/portfolio/summary');
        portfolio = data;
      } catch (portErr) {
        console.warn('Portfolio context fetch failed, AI yanıtı portföysüz gidecek:', portErr?.message);
      }

      // ✅ Çoklu-tur bağlam: o ana kadarki konuşmayı Gemini formatına çevir.
      // setState async olduğu için addMessage('user', userMsg) öncesi okunan
      // `messages` state'ini kullanıyoruz; yeni mesajı `prompt` olarak ayrıca
      // yolluyoruz. Böylece "2000" gibi tek başına anlamsız cevaplar bağlam
      // içinde değerlendirilir.
      const history = messages
        .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text,
        }));

      const aiResponse = await getAiResponse(userMsg, {
        transactions,
        budgets,
        pots,
        portfolio,
        bills,
        history,
        userName,
      });

      // 3. ✅ Önce AGENT_COMMAND'ı yakala ve metinden temizle
      let { cleanText, command: agentCommand } = parseAgentCommand(aiResponse);

      // 4. Sonra geriye kalan metinde CHART_COMMAND'ı yakala ve temizle
      const chartParsed = parseChartCommand(cleanText);
      cleanText = chartParsed.cleanText;
      const chartCommand = chartParsed.command;

      // 5. Bot yanıtını (sadece sohbet metni) ekrana bas
      addMessage('bot', cleanText || t('chat.ok', { name: userName }));

      // 6. Aksiyon komutlarını arka planda çalıştır
      if (agentCommand && typeof agentCommand === 'object') {
        executeAgentCommand(agentCommand);
      }
      if (chartCommand && typeof chartCommand === 'object') {
        openChartModal(chartCommand);
      }
    } catch (err) {
      addMessage('bot', t('chat.errorMsg', { name: userName }));
    } finally {
      setIsLoading(false);
    }
  };

  // Dışarı tıklayınca kapatma mantığı
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chatRef.current && !chatRef.current.contains(event.target)) {
        toggleChat();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [toggleChat]);

  return (
    <div className="chat-widget-container">
      <div className="chat-window" ref={chatRef}>
        <div className="chat-header">
          <h4>{t('chat.header')}</h4>
          <button type="button" onClick={toggleChat} className="close-btn">✖</button>
        </div>

        <div className="chat-body">
          {messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.sender}`}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
            </div>
          ))}
          {isLoading && (
            <div className="chat-message bot">
              <span className="loading-text">{t('chat.thinking', { name: userName })}</span>
            </div>
          )}
        </div>

        <form className="chat-footer" onSubmit={handleSend}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isLoading ? t('chat.placeholderLoading') : t('chat.placeholderInput')}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "..." : t('chat.send')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWidget;
