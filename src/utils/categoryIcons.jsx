import {
  FiBook,
  FiCoffee,
  FiCreditCard,
  FiHeart,
  FiMusic,
  FiShoppingBag,
  FiShoppingCart,
  FiSun,
  FiTrendingUp,
  FiTruck,
  FiGrid,
} from 'react-icons/fi';
import '../styles/categoryIcon.css';

const CATEGORY_THEMES = {
  entertainment: { Icon: FiMusic, bg: '#ede9fe', color: '#7c3aed' },
  bills: { Icon: FiCreditCard, bg: '#fee2e2', color: '#dc2626' },
  groceries: { Icon: FiShoppingCart, bg: '#d1fae5', color: '#16a34a' },
  'dining out': { Icon: FiCoffee, bg: '#fef3c7', color: '#d97706' },
  food: { Icon: FiCoffee, bg: '#fef3c7', color: '#d97706' },
  transportation: { Icon: FiTruck, bg: '#cffafe', color: '#0891b2' },
  'personal care': { Icon: FiHeart, bg: '#fce7f3', color: '#db2777' },
  education: { Icon: FiBook, bg: '#e0e7ff', color: '#4f46e5' },
  lifestyle: { Icon: FiSun, bg: '#f3e8ff', color: '#9333ea' },
  shopping: { Icon: FiShoppingBag, bg: '#ffedd5', color: '#ea580c' },
  income: { Icon: FiTrendingUp, bg: '#dcfce7', color: '#16a34a' },
  general: { Icon: FiGrid, bg: '#f1f5f9', color: '#64748b' },
};

const normalizeCategory = (category) => {
  if (!category) return 'general';
  return String(category).trim().toLowerCase();
};

/** @returns {{ Icon: import('react').ComponentType, bg: string, color: string }} */
export const getCategoryTheme = (category, type) => {
  if (type === 'income') return CATEGORY_THEMES.income;
  const key = normalizeCategory(category);
  return CATEGORY_THEMES[key] || CATEGORY_THEMES.general;
};

export const CategoryIcon = ({ category, type, size = 18, className = '' }) => {
  const { Icon, bg, color } = getCategoryTheme(category, type);
  return (
    <span
      className={`category-icon-badge ${className}`.trim()}
      style={{ backgroundColor: bg, color }}
      aria-hidden
    >
      <Icon size={size} strokeWidth={2.25} />
    </span>
  );
};
