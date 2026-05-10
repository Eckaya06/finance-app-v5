import { useChat } from "../../context/ChatContext";
import { AIAssistantFAB } from "./AIAssistantFAB";
import ChatWidget from "./ChatWidget";
import AIChartModal from "./AIChartModal";

const AiChatSystem = () => {
  const chatContext = useChat();

  // Context yüklenmediyse hiçbir şey gösterme
  if (!chatContext) return null;

  const { isOpen } = chatContext;

  return (
    <>
      {/* Eğer isOpen FALSE ise (kapalıysa) SADECE FAB butonunu göster */}
      {!isOpen && <AIAssistantFAB />}

      {/* Eğer isOpen TRUE ise (açıksa) SADECE Chat penceresini göster */}
      {isOpen && <ChatWidget />}

      {/* ✅ AGENTIC UI: AI tarafından tetiklenen dinamik grafik modalı.
          Kendi içinde isChartModalOpen kontrolüyle render edilir. */}
      <AIChartModal />

      {/* Agent action feedback artık global ToastHost üzerinden render ediliyor. */}
    </>
  );
};

export default AiChatSystem;
