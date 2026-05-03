import { useState } from 'react';

// LoginModal — email/password authentication overlay.
// Calls the `login` function from useAuth and closes on success.
// `onClose` is called (with no args) when the user dismisses without logging in.
export function LoginModal({ onLogin, onClose }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onLogin(email, password);
      // useAuth listener will update user state; parent can react to that.
    } catch (err) {
      setError(err?.message ?? 'Authentication failed.');
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

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={panel}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '4px', color: 'var(--c-battery-blue, #48c3e8)' }}>
          FFPL // AUTHENTICATION
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
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
        <div style={{ fontSize: '0.45rem', color: 'var(--c-slate-black, #2a2a2a)', letterSpacing: '1px', textAlign: 'center' }}>
          Architect or Commissioner credentials required
        </div>
      </div>
    </div>
  );
}
