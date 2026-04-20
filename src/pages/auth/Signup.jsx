import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/Logo.webp';

const validateEmail = (email) => {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return 'Please enter your email address.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address.';
  }

  return '';
};

const getPasswordChecks = (password) => {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
};

const getPasswordError = (password) => {
  if (!password) {
    return 'Please enter your password.';
  }

  if (password.length < 8) {
    return 'Your password must contain at least 8 characters.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Your password must contain at least one uppercase letter.';
  }

  if (!/[a-z]/.test(password)) {
    return 'Your password must contain at least one lowercase letter.';
  }

  if (!/\d/.test(password)) {
    return 'Your password must contain at least one number.';
  }

  return '';
};

const Signup = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
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

  const validateForm = () => {
    const emailError = validateEmail(formData.email);
    if (emailError) return emailError;

    const passwordError = getPasswordError(formData.password);
    if (passwordError) return passwordError;

    if (!formData.confirmPassword) {
      return 'Please confirm your password.';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match.';
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
      await signup(normalizedEmail, formData.password);

      setSuccess(
        `We have sent a verification email to ${normalizedEmail}. Please check your inbox and verify your account before logging in.`
      );

      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Signup error:', error);

      const status = error.response?.status;
      const serverMessage = error.response?.data?.message;

      if (status === 409) {
        setError('This email address is already in use.');
      } else if (status === 400) {
        setError(serverMessage || 'Please check your input and try again.');
      } else if (status === 500) {
        setError(
          serverMessage ||
            'We could not complete your registration at the moment. Please try again.'
        );
      } else {
        setError(serverMessage || 'An unexpected error occurred during registration.');
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
            <h1>Manage your money smarter</h1>
            <p>Create an account to start tracking income, expenses, and budgets.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-card" noValidate>
          <h2>Sign up</h2>

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
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              autoComplete="email"
              placeholder="Enter your email address"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              autoComplete="new-password"
              placeholder="Create a strong password"
            />

            {formData.password && (
              <div style={{ marginTop: '10px', fontSize: '13px', lineHeight: '1.7' }}>
                <div style={{ color: passwordChecks.minLength ? '#27ae60' : '#666' }}>
                  {passwordChecks.minLength ? '✓' : '•'} At least 8 characters
                </div>
                <div style={{ color: passwordChecks.hasUppercase ? '#27ae60' : '#666' }}>
                  {passwordChecks.hasUppercase ? '✓' : '•'} At least one uppercase letter
                </div>
                <div style={{ color: passwordChecks.hasLowercase ? '#27ae60' : '#666' }}>
                  {passwordChecks.hasLowercase ? '✓' : '•'} At least one lowercase letter
                </div>
                <div style={{ color: passwordChecks.hasNumber ? '#27ae60' : '#666' }}>
                  {passwordChecks.hasNumber ? '✓' : '•'} At least one number
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
              autoComplete="new-password"
              placeholder="Re-enter your password"
            />
          </div>

          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign up'}
          </button>

          <p className="small">
            Do you already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;