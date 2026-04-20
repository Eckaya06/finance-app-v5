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
        localStorage.removeItem('financeapp_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  const signup = async (email, password) => {
    const { data } = await api.post('/auth/signup', { email, password });
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

  // Dışarı aktarılan değerler
  const value = { user, login, signup, logout, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);