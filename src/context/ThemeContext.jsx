import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'financeapp_ui_prefs';

const readInitial = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const ThemeProvider = ({ children }) => {
  const initial = readInitial();

  const [theme, setTheme] = useState(initial?.theme === 'dark' ? 'dark' : 'light');
  const [sidebarSide, setSidebarSide] = useState(initial?.sidebarSide === 'right' ? 'right' : 'left');

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
  }, [theme]);

  useEffect(() => {
    document.body.setAttribute('data-sidebar-side', sidebarSide);
  }, [sidebarSide]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, sidebarSide }));
  }, [theme, sidebarSide]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const toggleSidebarSide = () => setSidebarSide((s) => (s === 'right' ? 'left' : 'right'));

  const value = { theme, setTheme, toggleTheme, sidebarSide, setSidebarSide, toggleSidebarSide };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
