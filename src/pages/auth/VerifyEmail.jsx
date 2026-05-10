import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api.js';

const VerifyEmail = () => {
  const { t } = useTranslation();
  const { token } = useParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  const hasFetched = useRef(false);

  useEffect(() => {
    setMessage(t('auth.verify.verifying'));
    const verifyUserEmail = async () => {
      try {
        const response = await api.get(`/auth/verify/${token}`);
        setStatus('success');
        setMessage(response.data.message || t('auth.verify.successMessage'));
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.message || t('auth.verify.errorMessage'));
      }
    };

    if (!hasFetched.current) {
      verifyUserEmail();
      hasFetched.current = true;
    }
  }, [token, t]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center' }}>
      {status === 'loading' && <h2>⏳ {message}</h2>}

      {status === 'success' && (
        <>
          <h2 style={{ color: 'green' }}>✅ {t('auth.verify.successTitle')}</h2>
          <p>{message}</p>
          <Link to="/login" style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', textDecoration: 'none', borderRadius: '5px' }}>
            {t('auth.verify.loginButton')}
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <h2 style={{ color: 'red' }}>❌ {t('auth.verify.errorTitle')}</h2>
          <p>{message}</p>
          <Link to="/signup" style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#f44336', color: 'white', textDecoration: 'none', borderRadius: '5px' }}>
            {t('auth.verify.signupAgain')}
          </Link>
        </>
      )}
    </div>
  );
};

export default VerifyEmail;
