import { useState } from 'react';
import { pb } from '../lib/pb.js';

// LoginModal — authentication overlay with LOGIN / SIGN UP tabs.
// `onLogin(email, password)` — called after successful login OR post-registration auth.
// `onClose` — called when the user dismisses without authenticating.
export function LoginModal({ onLogin, onClose }) {
  const [tab,             setTab]             = useState('login'); // 'login' | 'register'
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [name,            setName]            = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error,           setError]           = useState('');
  const [busy,            setBusy]            = useState(false);

  const switchTab = (t) => {
    setTab(t);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
    setPasswordConfirm('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err?.message ?? 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await pb.collection('users').create({
        email,
        name,
        password,
        passwordConfirm,
      });
      // Immediately authenticate so authStore.onChange fires and parent updates.
      await onLogin(email, password);
    } catch (err) {
      setError(err?.message ?? 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const overlay = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  };
  const panel = {
    background: 'var(--c-black, #0d0d0d)',
    border: '1px solid var(--c-slate-black, #2a2a2a)',
    padding: '2rem',
    minWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  };
  const inputStyle = {
    background: '#0a0a0a',
    border: '1px solid var(--c-slate-black, #2a2a2a)',
    color: 'var(--c-dark-silver, #aaa)',
    padding: '0.4rem 0.6rem',
    fontSize: '0.75rem',
    letterSpacing: '1px',
    width: '100%',
    boxSizing: 'border-box',
  };
  const tabLink = (t) => ({
    fontSize: '0.55rem',
    letterSpacing: '2px',
    cursor: 'pointer',
    color: tab === t
      ? 'var(--c-battery-blue, #48c3e8)'
      : 'var(--c-dark-silver, #aaa)',
    borderBottom: tab === t ? '1px solid var(--c-battery-blue, #48c3e8)' : '1px solid transparent',
    paddingBottom: '1px',
    userSelect: 'none',
  });

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={panel}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '4px', color: 'var(--c-battery-blue, #48c3e8)' }}>
          FFPL // AUTHENTICATION
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span style={tabLink('login')}  onClick={() => switchTab('login')}>LOGIN</span>
          <span style={tabLink('register')} onClick={() => switchTab('register')}>SIGN UP</span>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <input
              style={inputStyle}
              type="email"
              placeholder="EMAIL"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              style={inputStyle}
              type="password"
              placeholder="PASSWORD"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {error && (
              <div style={{ fontSize: '0.6rem', color: 'var(--c-cherry-red, #e84848)', letterSpacing: '1px' }}>
                {error}
              </div>
            )}
            <button
              className="btn-quantum"
              type="submit"
              disabled={busy}
              style={{ letterSpacing: '2px', fontSize: '0.7rem', padding: '0.4rem' }}
            >
              {busy ? 'AUTHENTICATING…' : 'ACCESS NEXUS'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <input
              style={inputStyle}
              type="text"
              placeholder="PILOT HANDLE"
              autoComplete="nickname"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
            <input
              style={inputStyle}
              type="email"
              placeholder="EMAIL"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              style={inputStyle}
              type="password"
              placeholder="PASSWORD"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <input
              style={inputStyle}
              type="password"
              placeholder="CONFIRM PASSWORD"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              required
            />
            {error && (
              <div style={{ fontSize: '0.6rem', color: 'var(--c-cherry-red, #e84848)', letterSpacing: '1px' }}>
                {error}
              </div>
            )}
            <button
              className="btn-quantum"
              type="submit"
              disabled={busy}
              style={{ letterSpacing: '2px', fontSize: '0.7rem', padding: '0.4rem' }}
            >
              {busy ? 'CREATING ACCOUNT…' : 'ENLIST'}
            </button>
          </form>
        )}

        <div style={{ fontSize: '0.45rem', color: 'var(--c-slate-black, #2a2a2a)', letterSpacing: '1px', textAlign: 'center' }}>
          {tab === 'login' ? 'Architect or Commissioner credentials required' : 'New pilots receive Architect rank by default'}
        </div>
      </div>
    </div>
  );
}
