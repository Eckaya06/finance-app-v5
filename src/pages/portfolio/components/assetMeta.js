/**
 * Shared asset metadata — icons, labels, and category flags
 */
const ASSET_META = {
  USD: { icon: '🇺🇸', label: 'US Dollar', pair: 'USD/TRY', isGold: false, color: '#10b981' },
  EUR: { icon: '🇪🇺', label: 'Euro', pair: 'EUR/TRY', isGold: false, color: '#3b82f6' },
  GBP: { icon: '🇬🇧', label: 'British Pound', pair: 'GBP/TRY', isGold: false, color: '#8b5cf6' },
  JPY: { icon: '🇯🇵', label: 'Japanese Yen', pair: 'JPY/TRY', isGold: false, color: '#ec4899' },
  CHF: { icon: '🇨🇭', label: 'Swiss Franc', pair: 'CHF/TRY', isGold: false, color: '#ef4444' },
  CAD: { icon: '🇨🇦', label: 'Canadian Dollar', pair: 'CAD/TRY', isGold: false, color: '#f43f5e' },
  GOLD_GRAM: { icon: '⚱️', label: 'Gram Gold', pair: 'XAU/G', isGold: true, color: '#f59e0b' },
  GOLD_QUARTER: { icon: '🪙', label: 'Quarter Gold', pair: 'XAU/Q', isGold: true, color: '#f59e0b' },
  GOLD_OUNCE: { icon: '💰', label: 'Ounce Gold', pair: 'XAU/OZ', isGold: true, color: '#f59e0b' },
};

export default ASSET_META;
