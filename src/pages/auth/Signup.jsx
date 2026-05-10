import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/Logo.webp';

const getPasswordChecks = (password) => {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
};

const Signup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordChecks = useMemo(
    () => getPasswordChecks(formData.password),
    [formData.password]
  );

  useEffect(() => {
    let timer;

    if (success) {
      timer = setTimeout(() => {
        navigate('/login');
      }, 5000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [success, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) setError('');
    if (success) setSuccess('');
  };

  const validateEmail = (email) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return t('auth.signup.errors.enterEmail');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return t('auth.signup.errors.validEmail');
    return '';
  };

  const getPasswordError = (password) => {
    if (!password) return t('auth.signup.errors.enterPassword');
    if (password.length < 8) return t('auth.signup.errors.passwordMin');
    if (!/[A-Z]/.test(password)) return t('auth.signup.errors.passwordUpper');
    if (!/[a-z]/.test(password)) return t('auth.signup.errors.passwordLower');
    if (!/\d/.test(password)) return t('auth.signup.errors.passwordNumber');
    return '';
  };

  const validateForm = () => {
    const trimmedDisplayName = formData.displayName.trim();
    if (!trimmedDisplayName) return t('auth.signup.errors.enterName');
    if (trimmedDisplayName.length < 2) return t('auth.signup.errors.nameMin');

    const emailError = validateEmail(formData.email);
    if (emailError) return emailError;

    const passwordError = getPasswordError(formData.password);
    if (passwordError) return passwordError;

    if (!formData.confirmPassword) return t('auth.signup.errors.confirmPwd');

    if (formData.password !== formData.confirmPassword) {
      return t('auth.signup.errors.passwordsMatch');
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);

      const normalizedEmail = formData.email.trim().toLowerCase();
      const trimmedDisplayName = formData.displayName.trim();
      await signup(normalizedEmail, formData.password, trimmedDisplayName);

      setSuccess(t('auth.signup.successMessage', { email: normalizedEmail }));

      setFormData({
        displayName: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Signup error:', error);

      const status = error.response?.status;
      const serverMessage = error.response?.data?.message;

      if (status === 409) {
        setError(t('auth.signup.errors.emailInUse'));
      } else if (status === 400) {
        setError(serverMessage || t('auth.signup.errors.checkInput'));
      } else if (status === 500) {
        setError(serverMessage || t('auth.signup.errors.registrationFail'));
      } else {
        setError(serverMessage || t('auth.signup.errors.unexpected'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="auth-page">
        <div className="auth-hero">
          <img src={logoImg} className="auth-hero-logo" alt="FinanceApp logo" />
          <div className="background-hero"></div>
          <div className="text-content">
            <h1>{t('auth.signup.heroTitle')}</h1>
            <p>{t('auth.signup.heroDescription')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-card" noValidate>
          <h2>{t('auth.signup.title')}</h2>

          {error && (
            <div
              style={{
                color: '#e74c3c',
                marginBottom: '15px',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                color: '#27ae60',
                marginBottom: '15px',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              {success}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="displayName">{t('auth.signup.name')}</label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              disabled={loading}
              autoComplete="name"
              placeholder={t('auth.signup.namePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">{t('auth.signup.email')}</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              autoComplete="email"
              placeholder={t('auth.signup.emailPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.signup.password')}</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              autoComplete="new-password"
              placeholder={t('auth.signup.passwordPlaceholder')}
            />

            {formData.password && (
              <div style={{ marginTop: '10px', fontSize: '13px', lineHeight: '1.7' }}>
                <div style={{ color: passwordChecks.minLength ? '#27ae60' : '#666' }}>
                  {passwordChecks.minLength ? '✓' : '•'} {t('auth.signup.passwordChecks.minLength')}
                </div>
                <div style={{ color: passwordChecks.hasUppercase ? '#27ae60' : '#666' }}>
                  {passwordChecks.hasUppercase ? '✓' : '•'} {t('auth.signup.passwordChecks.hasUppercase')}
                </div>
                <div style={{ color: passwordChecks.hasLowercase ? '#27ae60' : '#666' }}>
                  {passwordChecks.hasLowercase ? '✓' : '•'} {t('auth.signup.passwordChecks.hasLowercase')}
                </div>
                <div style={{ color: passwordChecks.hasNumber ? '#27ae60' : '#666' }}>
                  {passwordChecks.hasNumber ? '✓' : '•'} {t('auth.signup.passwordChecks.hasNumber')}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('auth.signup.confirmPassword')}</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
              autoComplete="new-password"
              placeholder={t('auth.signup.confirmPasswordPlaceholder')}
            />
          </div>

          <button type="submit" className="primary" disabled={loading}>
            {loading ? t('auth.signup.creatingAccount') : t('auth.signup.title')}
          </button>

          <p className="small">
            {t('auth.signup.haveAccount')} <Link to="/login">{t('auth.signup.loginLink')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;
