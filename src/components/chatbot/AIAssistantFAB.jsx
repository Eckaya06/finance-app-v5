import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../context/ChatContext';
import './AIAssistantFAB.css';

export const AIAssistantFAB = () => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const { toggleChat, unreadCount, unreadInsightCount, isOpen } = useChat();

  // Çift dikiş güvenlik: Açıksa asla render etme!
  if (isOpen) return null;

  // Tooltip metni: bütçe/fatura uyarısı varsa "AI Bütçe Uyarısı", yoksa generic
  // "X mesajınız var". Insight sayısı > 0 ise insight tooltip'i öne çıkar.
  const hasInsight = unreadInsightCount > 0;
  const tooltipLabel = hasInsight ? t('chat.newInsight') : t('chat.newMessage');
  const tooltipCount = hasInsight
    ? t('chat.newInsightCount', { count: unreadInsightCount })
    : t('chat.newMessageCount', { count: unreadCount });

  return (
    <div className="fab-container">
      <AnimatePresence>
        {isHovered && unreadCount > 0 && (
          <Motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fab-tooltip"
          >
            <div className="fab-tooltip-content">
              <div className="fab-tooltip-dot" />
              <p className="fab-tooltip-text">
                {tooltipLabel} <span>{tooltipCount}</span>
              </p>
            </div>
            <div className="fab-tooltip-arrow" />
          </Motion.div>
        )}
      </AnimatePresence>

      <Motion.button
        onClick={toggleChat}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fab-button"
        aria-label="AI Assistant"
      >
        <MessageCircle strokeWidth={2} size={28} />

        <AnimatePresence>
          {unreadCount > 0 && (
            <div className="fab-badge-wrapper">
              <Motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="fab-badge"
              >
                <span className="fab-badge-text">{unreadCount}</span>
                <span className="fab-badge-ping" />
              </Motion.div>
            </div>
          )}
        </AnimatePresence>
      </Motion.button>
    </div>
  );
};