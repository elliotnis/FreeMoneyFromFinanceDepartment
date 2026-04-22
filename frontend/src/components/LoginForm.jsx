import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authcontext';
import '../styles/auth.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState('password'); // 'password' | 'email-link'

  return (
    <div className="container">
      <div className="login-form">
        <div className="logo-container">
          <div className="logo-text">
            <h1>HKUST</h1>
            <span>Finance Department Portal</span>
          </div>
        </div>

        <h2>FINA/QFIN Student Portal</h2>

        <div className="login-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'password'}
            className={`login-mode-tab ${mode === 'password' ? 'active' : ''}`}
            onClick={() => setMode('password')}
          >
            Password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'email-link'}
            className={`login-mode-tab ${mode === 'email-link' ? 'active' : ''}`}
            onClick={() => setMode('email-link')}
          >
            HKUST Email Link
          </button>
        </div>

        {mode === 'password' ? (
          <PasswordLogin navigate={navigate} login={login} />
        ) : (
          <EmailLinkLogin />
        )}

        <div className="divider"><span>Quick Links</span></div>

        <div className="department-links">
          <a href="https://fina.hkust.edu.hk/" target="_blank" rel="noopener noreferrer">FINA Department</a>
          <a href="https://fina.hkust.edu.hk/programs/bsc-in-quantitative-finance/bsc-qf-overview" target="_blank" rel="noopener noreferrer">QFIN Program</a>
          <a href="https://docs.google.com/forms/d/e/1FAIpQLSc0PmJBitZsdmmuyMy1GSvH9S779_aeE5mT249ll-_s7hImHw/viewform?usp=dialog" target="_blank" rel="noopener noreferrer">
            Report bugs / contact us!
          </a>
        </div>

        <div className="signup-link">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </div>
      </div>
    </div>
  );
}

function PasswordLogin({ navigate, login }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.detail || data.message || data.error || 'Login failed';
        throw new Error(errorMessage);
      }

      let preferredName = null;
      let targetPath = '/dashboard';

      try {
        const profileResponse = await fetch(`${API_URL}/profile/${email}`);

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          preferredName = profileData.preferred_name;

          if (preferredName) {
            localStorage.setItem('preferred_name', preferredName);
          }
        } else if (profileResponse.status === 404) {
          targetPath = '/complete-profile';
        }
      } catch (profileErr) {
        console.error('Error fetching profile:', profileErr);
      }

      const userData = {
        user_id: data.user_id,
        username: preferredName || data.email,
        email,
      };

      login(userData, rememberMe);

      if (rememberMe) {
        localStorage.setItem('user_email', email);
      } else {
        sessionStorage.setItem('user_email', email);
      }

      if (targetPath === '/complete-profile') {
        navigate('/complete-profile', {
          state: { email, userId: data.user_id },
        });
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="error-message" style={{
          background: '#ffebee', color: '#c62828', padding: '12px',
          borderRadius: '4px', marginBottom: '16px',
          border: '1px solid #ffcdd2', fontSize: '14px',
        }}>
          <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
          {error}
        </div>
      )}

      <div className="input-group">
        <label htmlFor="email">HKUST ITSC Email</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. jsmith@connect.ust.hk"
          required
          disabled={loading}
        />
        <i className="fas fa-envelope input-icon"></i>
      </div>

      <div className="input-group">
        <label htmlFor="password">Password</label>
        <input
          type={showPassword ? 'text' : 'password'}
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          disabled={loading}
        />
        <i className="fas fa-lock input-icon"></i>
        <i
          className={`fas ${showPassword ? 'fa-eye' : 'fa-eye-slash'} toggle-password`}
          onClick={() => setShowPassword((s) => !s)}
        ></i>
      </div>

      <div className="options-group">
        <label className="remember-me">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading}
          />
          <span className="checkmark"></span>
          Remember my login
        </label>
        <Link to="/forgot-password" className="forgot-password">Forgot Password?</Link>
      </div>

      <button type="submit" className="login-btn" disabled={loading}>
        {loading ? 'Signing In...' : 'Sign In'}
      </button>
    </form>
  );
}

function EmailLinkLogin() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleaned = username.trim().toLowerCase();
    if (!cleaned) {
      setError('Please enter your HKUST username.');
      return;
    }
    if (cleaned.includes('@')) {
      setError("Just the part before '@connect.ust.hk' — no '@' needed.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/email-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleaned }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Could not send email.');
      }
      setSentTo(data.email);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div className="email-link-sent">
        <div className="email-link-sent-icon">
          <i className="fas fa-paper-plane"></i>
        </div>
        <h3>Check your inbox</h3>
        <p>
          We sent a sign-in link to <strong>{sentTo}</strong>.<br />
          Click the link on this device within 15 minutes.
        </p>
        <button
          type="button"
          className="login-btn login-btn-secondary"
          onClick={() => { setSentTo(''); setUsername(''); }}
        >
          Use a different username
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="error-message" style={{
          background: '#ffebee', color: '#c62828', padding: '12px',
          borderRadius: '4px', marginBottom: '16px',
          border: '1px solid #ffcdd2', fontSize: '14px',
        }}>
          <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
          {error}
        </div>
      )}

      <div className="input-group">
        <label htmlFor="hkust-username">HKUST ITSC Username</label>
        <div className="email-suffix-input">
          <input
            type="text"
            id="hkust-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. jsmith"
            autoComplete="username"
            required
            disabled={loading}
          />
          <span className="email-suffix">@connect.ust.hk</span>
        </div>
        <p className="input-hint">
          Enter only the part before <code>@connect.ust.hk</code>. We'll email you a one-time sign-in link.
        </p>
      </div>

      <button type="submit" className="login-btn" disabled={loading}>
        {loading ? 'Sending link...' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}

export default LoginForm;
