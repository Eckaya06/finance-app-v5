import { cloneElement, isValidElement } from 'react';
import './EmptyState.css';

const VARIANTS = new Set(['blue', 'green', 'orange', 'purple', 'teal', 'neutral']);

const EmptyState = ({
  title,
  message,
  buttonText,
  onAction,
  icon,
  variant = 'neutral',
  compact = false,
  showRingIcon = true,
  className = '',
}) => {
  const variantKey = VARIANTS.has(variant) ? variant : 'neutral';
  const ringVisible = compact ? Boolean(icon) : showRingIcon && Boolean(icon);
  const rootClass = [
    'es-panel',
    `es-panel--${variantKey}`,
    compact ? 'es-panel--compact' : '',
    !compact && icon && !showRingIcon ? 'es-panel--banner-only' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const renderIcon = (iconClassName, size) => {
    if (!icon || !isValidElement(icon)) return icon ?? null;
    return cloneElement(icon, { className: iconClassName, size });
  };

  return (
    <div className={rootClass} role="status">
      {!compact && icon && (
        <div className="es-panel-banner" aria-hidden="true">
          <span className="es-panel-banner-icon">{renderIcon('es-panel-banner-svg', 44)}</span>
        </div>
      )}

      <div className="es-panel-body">
        {ringVisible && (
          <div className="es-panel-icon-ring" aria-hidden="true">
            {renderIcon('es-panel-ring-svg', compact ? 18 : 20)}
          </div>
        )}

        {title && <h2 className="es-panel-title">{title}</h2>}
        {message && <p className="es-panel-message">{message}</p>}

        {buttonText && onAction && (
          <button type="button" className="es-panel-btn" onClick={onAction}>
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
