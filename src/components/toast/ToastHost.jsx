import { useToast } from '../../context/ToastContext';
import './ToastHost.css';

const iconFor = (type) => {
  if (type === 'success') return '✅';
  if (type === 'error') return '❌';
  return 'ℹ️';
};

const ToastHost = () => {
  const { toast, dismissToast } = useToast();
  if (!toast) return null;

  return (
    <div
      className={`app-toast app-toast--${toast.type}`}
      role="status"
      aria-live="polite"
    >
      <span className="app-toast__icon">{iconFor(toast.type)}</span>
      <span className="app-toast__text">{toast.message}</span>
      <button
        type="button"
        className="app-toast__close"
        onClick={dismissToast}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
};

export default ToastHost;
