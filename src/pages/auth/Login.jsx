import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/Logo.webp';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('auth.login.errors.fillBlanks'));
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      navigate('/home');
    } catch (error) {
      console.error("Login error:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError(t('auth.login.errors.invalidCredentials'));
      } else {
        setError(t('auth.login.errors.failedLogin'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="auth-page">
        <div className="auth-hero">
          <img src={logoImg} alt="logo resmi" />
          <div className='background-hero'></div>
          <div className='text-content'>
            <h1>
              <span>{t('auth.login.heroTitle1')}</span>
              <span>{t('auth.login.heroTitle2')}</span>
            </h1>
            <p>{t('auth.login.heroDescription')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-card">
          <h2>{t('auth.login.title')}</h2>

          {error && <div style={{ color: '#e74c3c', marginBottom: '15px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

          <div className="form-group">
            <label htmlFor="email">{t('auth.login.email')}</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.login.password')}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="primary" disabled={loading}>
            {loading ? t('auth.login.loggingIn') : t('auth.login.title')}
          </button>

          <p className="small">{t('auth.login.noAccount')} <Link to="/signup">{t('auth.login.signupLink')}</Link></p>
        </form>
      </div>
    </div>
  );
};

export default Login;




































































/*import React, { useState } from 'react';
import { findUser, setLoggedInUser } from '../../utils/auth';

const Login = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();

    const user = findUser(email, password);

    if (user) {
      setLoggedInUser(user); // Kullanıcıyı "giriş yapmış" olarak işaretle.
      setMessage('Giriş başarılı!');
      onAuthSuccess(user); // Üst bileşene girişin başarılı olduğunu bildir.
    } else {
      setMessage('E-posta veya şifre yanlış.');
    }
  };

  return (
    <form className="auth-form" onSubmit={handleLogin}>
      <h2>Giriş Yap</h2>
      {message && <p>{message}</p>}
      <input
        type="email"
        placeholder="E-posta"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Şifre"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Giriş Yap</button>
    </form>
  );
};

export default Login;*/