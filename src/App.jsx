import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';
import VerifyEmail from './pages/auth/VerifyEmail.jsx';
import Home from './pages/home/Home.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx'; 
import DashboardLayout from './layouts/DashboardLayout.jsx';
import TransactionsPage from './pages/transactions/TransactionsPage.jsx';
import PotsPage from './pages/pots/PotsPage.jsx';
import IncomeExpensePage from './pages/income-expense/IncomeExpensePage.jsx';
import BudgetsPage from './pages/budgets/BudgetsPage.jsx';
import SettingsPage from './pages/settings/SettingsPage.jsx';
import AnalyticsPage from './pages/analytics/AnalyticsPage.jsx';

// UI Bileşenleri
import AiChatSystem from './components/chatbot/AiChatSystem.jsx';

// Context Yapıları
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext.jsx';
import { TransactionProvider } from './context/TransactionContext.jsx';

const AssistantWrapper = () => {
  const location = useLocation();
  const authPaths = ['/login', '/signup', '/']; 
  if (authPaths.includes(location.pathname)) return null;
  return <AiChatSystem />;
};

const App = () => {
  return (
    <AuthProvider>
      <ChatProvider>
        <TransactionProvider>
          <div>
            <Routes>
              {/* Açık Rotalar */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify/:token" element={<VerifyEmail />} />
              <Route path="/" element={<Navigate to="/login" />} />

              {/* Korumalı Rotalar */}
              <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route path="/home" element={<Home />} />
                <Route path="/income-expense" element={<IncomeExpensePage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/budgets" element={<BudgetsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/pots" element={<PotsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
            <AssistantWrapper />
          </div>
        </TransactionProvider>
      </ChatProvider>
    </AuthProvider>
  );
};

export default App;