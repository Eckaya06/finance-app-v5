import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      const token = localStorage.getItem('financeapp_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
      } catch (err) {
        // 401 (invalid token) veya 403 (e-posta doğrulanmamış) durumunda oturumu temizle
        localStorage.removeItem('financeapp_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  const signup = async (email, password, displayName) => {
    const { data } = await api.post('/auth/signup', { email, password, displayName });
    // Token döndürülmüyorsa (email doğrulaması gerekli), token kaydedme
    if (data.token) {
      localStorage.setItem('financeapp_token', data.token);
      setUser(data.user);
    }
    return data;
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('financeapp_token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore backend logout failure
    }
    localStorage.removeItem('financeapp_token');
    setUser(null);
  };

  // Mevcut user objesi üzerine kısmi bir güncelleme uygular. SettingsPage
  // displayName değişiminden sonra çağırır — AI chatbot'un `user.displayName`'i
  // anında yeni isimle okuyabilmesi için. user null ise no-op.
  const updateUser = (partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  // Dışarı aktarılan değerler
  const value = { user, login, signup, logout, updateUser, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);