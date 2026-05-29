import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { signIn, signUp, getUserRole, createUserRole } from '../supabase/auth';
import { Eye, EyeOff, LogIn, BarChart3, UserPlus } from 'lucide-react';
import { getBaseRole } from '../utils/helpers';
import './Login.css';

const roleRoutes = {
  admin: '/clients',
  pm_editor: '/clients',
  hr_editor: '/expenses',
};

export default function Login() {
  const { fetchRole } = useContext(AuthContext);
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setFieldErrors({});
  };

  const switchMode = (newMode) => {
    resetForm();
    setMode(newMode);
  };

  const validate = () => {
    const errors = {};
    if (!email.trim()) errors.email = 'Email is required';
    if (!password) errors.password = 'Password is required';
    if (mode === 'register') {
      if (password.length < 6) errors.password = 'Password must be at least 6 characters';
      if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);

    const result = await signIn(email, password);

    if (result.error) {
      setError('Invalid email or password');
      setLoading(false);
      return;
    }

    const userId = result.data.user.id;

    let role = await getUserRole(userId);

    // Fallback: assign role for users created before the trigger existed
    if (!role) {
      const assignResult = await createUserRole(userId, email, 'pm_editor');
      if (!assignResult.error) {
        role = await getUserRole(userId);
      }
    }

    if (!role) {
      setError('Your account has no assigned role. Contact an admin.');
      setLoading(false);
      return;
    }

    localStorage.setItem('crm_user_role', role);
    await fetchRole(userId);

    const target = roleRoutes[getBaseRole(role)] || '/clients';
    navigate(target, { replace: true });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validate()) return;

    setLoading(true);

    const result = await signUp(email, password);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    const userId = result.data.user.id;

    // Wait for the database trigger to create the user_roles entry
    let assignedRole = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      assignedRole = await getUserRole(userId);
      if (assignedRole) break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (assignedRole) {
      setSuccess('Account created! An admin will assign your role. You can now sign in.');
    } else {
      setError('Account created but role could not be assigned. Please try signing in, then contact an admin.');
      setLoading(false);
      return;
    }

    setLoading(false);
    setMode('login');
    setPassword('');
  };

  const handleSubmit = (e) => {
    if (mode === 'login') {
      handleLogin(e);
    } else {
      handleRegister(e);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <BarChart3 size={22} />
          </div>
          <span className="login-brand-text">ProfitPilot</span>
        </div>

        {mode === 'login' ? (
          <>
            <h1 className="login-title">Sign in to your account</h1>
            <p className="login-subtitle">Enter your credentials to access the CRM</p>
          </>
        ) : (
          <>
            <h1 className="login-title">Create an account</h1>
            <p className="login-subtitle">Register to access the CRM</p>
          </>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <label className="input-label" htmlFor="email">Email</label>
            <input
              id="email"
              className={`input-field ${fieldErrors.email ? 'input-field--error' : ''}`}
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: '' })); }}
              autoFocus
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password"
                className={`input-field ${fieldErrors.password ? 'input-field--error' : ''}`}
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })); }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(prev => !prev)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </div>

          {mode === 'register' && (
            <div className="input-group">
              <label className="input-label" htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                className={`input-field ${fieldErrors.confirmPassword ? 'input-field--error' : ''}`}
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(prev => ({ ...prev, confirmPassword: '' })); }}
              />
              {fieldErrors.confirmPassword && <span className="field-error">{fieldErrors.confirmPassword}</span>}
            </div>
          )}

          {error && (
            <div className="login-error">
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="login-success">
              <span>{success}</span>
            </div>
          )}

          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              <span className="btn-content">
                {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </span>
            )}
          </button>
        </form>

        <div className="login-footer">
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button className="link-btn" onClick={() => switchMode('register')}>Create one</button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button className="link-btn" onClick={() => switchMode('login')}>Sign in</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
