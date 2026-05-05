import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AddCommissioner, RemoveCommissioner, TileSpectatorWindows } from '../wailsjs/go/main/App.js';
import { pb } from '../lib/pb.js';

export function AdminPage() {
  const { mode } = useOutletContext();

  if (mode !== 'host') {
    return (
      <section className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--c-cherry-red)', fontSize: '0.7rem', letterSpacing: '2px' }}>
          [ HOST ACCESS ONLY — SET FFPL_ADMIN_KEY ]
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: '1.5rem' }}>
      <h2 className="title-header" style={{ color: 'var(--c-cherry-red)', border: 'none', margin: 0 }}>
        HOST HQ
      </h2>

      <CommissionerManagerPanel />
      <SpectatorPanel />
      <DatabasePanel />
    </section>
  );
}

// ─── Commissioner Manager ─────────────────────────────────────────────────────

function CommissionerManagerPanel() {
  const [email,  setEmail]  = useState('');
  const [msg,    setMsg]    = useState('');
  const [busy,   setBusy]   = useState(false);

  async function handle(action) {
    const e = email.trim().toLowerCase();
    if (!e) { setMsg('Enter an email address.'); return; }
    setBusy(true);
    setMsg('');
    try {
      if (action === 'add') {
        await AddCommissioner(e);
        setMsg(`✓ ${e} added to commissioners.json`);
      } else {
        await RemoveCommissioner(e);
        setMsg(`✓ ${e} removed from commissioners.json`);
      }
      setEmail('');
    } catch (err) {
      setMsg(`✗ ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--c-slate-black)', borderRadius: '4px' }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '3px', color: 'var(--c-cherry-red)', marginBottom: '0.75rem' }}>
        COMMISSIONER BYPASS (COMMISSIONERS.JSON)
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="email@domain.com"
          style={{ flex: 1, minWidth: '200px', padding: '0.35rem 0.6rem', fontSize: '0.75rem', background: 'var(--c-black)', color: 'var(--c-dark-silver)', border: '1px solid var(--c-slate-black)', letterSpacing: '1px' }}
        />
        <button className="btn-quantum" disabled={busy} onClick={() => handle('add')}
          style={{ fontSize: '0.65rem', padding: '0.35rem 0.8rem', borderColor: 'var(--c-battery-blue)', color: 'var(--c-battery-blue)' }}>
          + ADD
        </button>
        <button className="btn-quantum" disabled={busy} onClick={() => handle('remove')}
          style={{ fontSize: '0.65rem', padding: '0.35rem 0.8rem', borderColor: 'var(--c-cherry-red)', color: 'var(--c-cherry-red)' }}>
          − REMOVE
        </button>
      </div>
      {msg && (
        <p style={{ fontSize: '0.65rem', letterSpacing: '1px', color: msg.startsWith('✓') ? '#22c55e' : 'var(--c-cherry-red)', margin: 0 }}>
          {msg}
        </p>
      )}
    </div>
  );
}

// ─── Spectator Window Tiler ───────────────────────────────────────────────────

function SpectatorPanel() {
  const [msg,  setMsg]  = useState('');
  const [busy, setBusy] = useState(false);

  async function tile() {
    setBusy(true);
    setMsg('');
    try {
      const result = await TileSpectatorWindows();
      setMsg(`✓ ${result}`);
    } catch (err) {
      setMsg(`✗ ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--c-slate-black)', borderRadius: '4px' }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '3px', color: 'var(--c-cherry-red)', marginBottom: '0.75rem' }}>
        PPSSPP SPECTATOR GRID
      </div>
      <button className="btn-quantum" disabled={busy} onClick={tile}
        style={{ fontSize: '0.65rem', borderColor: 'var(--c-cherry-red)', color: 'var(--c-cherry-red)' }}>
        {busy ? 'TILING...' : 'TILE ALL PPSSPP WINDOWS'}
      </button>
      {msg && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.65rem', letterSpacing: '1px', color: msg.startsWith('✓') ? '#22c55e' : 'var(--c-cherry-red)', margin: '0.5rem 0 0' }}>
          {msg}
        </p>
      )}
    </div>
  );
}

// ─── Database Stats ───────────────────────────────────────────────────────────

function DatabasePanel() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      pb.collection('ac_loadouts').getList(1, 1, { requestKey: null }).catch(() => ({ totalItems: 0 })),
      pb.collection('commissioner_licenses').getList(1, 1, { requestKey: null }).catch(() => ({ totalItems: 0 })),
      pb.collection('pilot_profiles').getList(1, 1, { requestKey: null }).catch(() => ({ totalItems: 0 })),
    ]).then(([ldr, lic, prf]) => {
      setStats({
        loadouts:   ldr.totalItems,
        licenses:   lic.totalItems,
        profiles:   prf.totalItems,
      });
    });
  }, []);

  const row = (label, val) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--c-dark-silver)', letterSpacing: '1px' }}>{label}</span>
      <span style={{ fontSize: '0.65rem', color: 'var(--c-battery-blue)', letterSpacing: '1px' }}>{val ?? '—'}</span>
    </div>
  );

  return (
    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--c-slate-black)', borderRadius: '4px' }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '3px', color: 'var(--c-cherry-red)', marginBottom: '0.75rem' }}>
        DATABASE STATS
      </div>
      {stats ? (
        <div>
          {row('AC LOADOUTS',          stats.loadouts)}
          {row('PILOT PROFILES',       stats.profiles)}
          {row('COMMISSIONER LICENSES',stats.licenses)}
        </div>
      ) : (
        <p style={{ fontSize: '0.65rem', color: 'var(--c-dark-silver)', letterSpacing: '1px', margin: 0 }}>QUERYING...</p>
      )}
    </div>
  );
}
