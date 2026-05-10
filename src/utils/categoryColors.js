export const CATEGORY_COLORS = {
  Income: '#10b981',
  Entertainment: '#3b82f6',
  Bills: '#ef4444',
  Groceries: '#f59e0b',
  'Dining Out': '#8b5cf6',
  Transportation: '#14b8a6',
  'Personal Care': '#ec4899',
  Education: '#6366f1',
  Lifestyle: '#f97316',
  Shopping: '#84cc16',
  General: '#64748b',
  Uncategorized: '#94a3b8',
};

export function getCategoryColor(category) {
  if (!category) return CATEGORY_COLORS.Uncategorized;
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.General;
}

