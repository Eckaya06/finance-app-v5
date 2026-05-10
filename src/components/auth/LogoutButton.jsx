import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import Modal from '../modal/Modal.jsx';
import './LogoutButton.css';

// Sağ üst köşede sabit duran çıkış butonu. LanguageSwitcher'ın hemen
// solunda konumlanır. Sadece authenticated kullanıcılarda render edilir.
// Tıklanınca direkt logout etmek yerine bir onay modalı açar — kullanıcı
// yanlışlıkla oturumunu kapatmasın.
const LogoutButton = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const openConfirm = () => setShowConfirm(true);
  const closeConfirm = () => {
    if (busy) return;
    setShowConfirm(false);
  };

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setBusy(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="logout-fab"
        onClick={openConfirm}
        title={t('logout.tooltip')}
        aria-label={t('logout.button')}
      >
        <FiLogOut size={16} />
        <span className="logout-fab-label">{t('logout.button')}</span>
      </button>

      <Modal isOpen={showConfirm} onClose={closeConfirm}>
        <div className="logout-confirm">
          <h2 className="logout-confirm-title">{t('logout.confirmTitle')}</h2>
          <p className="logout-confirm-message">{t('logout.confirmMessage')}</p>
          <div className="logout-confirm-actions">
            <button
              type="button"
              className="logout-confirm-btn logout-confirm-btn-danger"
              onClick={handleConfirm}
              disabled={busy}
            >
              {busy ? t('logout.loggingOut') : t('logout.confirmYes')}
            </button>
            <button
              type="button"
              className="logout-confirm-btn logout-confirm-btn-cancel"
              onClick={closeConfirm}
              disabled={busy}
            >
              {t('logout.confirmNo')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default LogoutButton;
