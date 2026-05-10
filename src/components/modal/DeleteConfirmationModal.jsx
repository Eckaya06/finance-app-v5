import { useTranslation } from 'react-i18next';
import './Modal.css';

const DeleteConfirmationModal = ({ potName, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  return (
    <div className="delete-confirmation">
      <h2>{t('deletePot.title', { name: potName })}</h2>
      <p>{t('deletePot.message')}</p>
      <div className="confirmation-buttons">
        <button className="btn-danger" onClick={onConfirm}>
          {t('common.yesConfirm')}
        </button>
        <button className="btn-secondary-outline" onClick={onCancel}>
          {t('common.noGoBack')}
        </button>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
