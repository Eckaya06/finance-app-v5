import { useState } from 'react';
import './ChangeEmailModal.css';
import { useAuth } from '../../context/AuthContext';
import api from '../../api.js';

const ChangeEmailModal = ({ onClose }) => {
  const { user } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [mode, setMode] = useState('verify');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');

    if (!user || !user.email) {
      setErr('You must be logged in to change your email.');
      return;
    }
    if (!newEmail.includes('@')) {
      setErr('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      await api.put('/auth/change-email', { currentPassword: currentPw, newEmail });
      onClose();
      window.alert('Email updated successfully.');
    } catch (error) {
      setErr(error.response?.data?.message || 'Failed to update email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ce-modal">
      <div className="ce-header">
        <h2>Change email</h2>
        <button className="ce-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <p className="ce-desc">
        For security, we’ll ask for your current password. Choose a method below.
      </p>

      {err ? <div className="ce-error">{err}</div> : null}

      <form className="ce-form" onSubmit={handleSubmit}>
        <div className="ce-field">
          <label>Current password</label>
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="ce-field">
          <label>New email</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />
        </div>

        <div className="ce-radio">
          <label className="ce-radio-row">
            <input
              type="radio"
              name="emailMode"
              checked={mode === 'verify'}
              onChange={() => setMode('verify')}
            />
            <span>
              Send verification to new email (recommended)
            </span>
          </label>

          <label className="ce-radio-row">
            <input
              type="radio"
              name="emailMode"
              checked={mode === 'direct'}
              onChange={() => setMode('direct')}
            />
            <span>
              Update immediately (direct)
            </span>
          </label>
        </div>

        <button className="ce-primary" type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update email'}
        </button>

        <button className="ce-link" type="button" onClick={onClose} disabled={loading}>
          Cancel
        </button>
      </form>
    </div>
  );
};

export default ChangeEmailModal;
