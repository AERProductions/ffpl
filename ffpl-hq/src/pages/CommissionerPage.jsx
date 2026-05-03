import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { pb } from '../lib/pb.js';

const TIERS = ['standard', 'premium', 'elite'];

const TIER_COLOR = {
  standard: 'var(--c-dark-silver)',
  premium:  'var(--c-battery-blue)',
  elite:    '#ffd700',
};

const TIER_CAPS = {
  standard: 32,
  premium:  64,
  elite:    256,
};

export function CommissionerPage() {
  const { user, isCommissioner } = useOutletContext();

  if (!isCommissioner) {
    return (
      <section className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--c-cherry-red)', fontSize: '0.7rem', letterSpacing: '2px' }}>
          [ COMMISSIONER ACCESS ONLY ]
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: '1.5rem' }}>
      <h2 className="title-header" style={{ color: 'var(--c-white)', border: 'none', margin: 0 }}>
        COMMISSIONER HQ
      </h2>

      <LicensesPanel user={user} />
      <DisputesPanel />
      <AnnouncementsPanel user={user} />
    </section>
  );
}

// ─── Licenses ─────────────────────────────────────────────────────────────────

function LicensesPanel({ user }) {
  const [licenses, setLicenses] = useState([]);
  const [loading,  setLoading]  = useState(true);

  // Issue-license form
  const [showForm,  setShowForm]  = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formTier,  setFormTier]  = useState('standard');
  const [formUntil, setFormUntil] = useState('');
  const [formError, setFormError] = useState('');
  const [formBusy,  setFormBusy]  = useState(false);

  async function fetchLicenses() {
    try {
      const records = await pb.collection('commissioner_licenses').getFullList({
        expand: 'user_id',
        sort: '-created',
        requestKey: null,
      });
      setLicenses(records);
    } catch (err) {
      if (!err.isAbort) console.error('[LicensesPanel]', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLicenses();
    pb.collection('commissioner_licenses').subscribe('*', fetchLicenses);
    return () => pb.collection('commissioner_licenses').unsubscribe('*');
  }, []);

  async function issueLicense(e) {
    e.preventDefault();
    setFormError('');
    setFormBusy(true);
    try {
      // Look up user by email.
      const users = await pb.collection('users').getFullList({
        filter: `email = '${formEmail.trim()}'`,
        requestKey: null,
      });
      if (!users.length) throw new Error(`No account found for ${formEmail.trim()}`);
      const target = users[0];

      const key = generateLicenseKey(formTier);
      await pb.collection('commissioner_licenses').create({
        user_id:          target.id,
        license_key:      key,
        tier:             formTier,
        valid_from:       new Date().toISOString(),
        valid_until:      formUntil || null,
        max_participants: TIER_CAPS[formTier],
        events_run:       0,
        is_suspended:     false,
      });
      setFormEmail(''); setFormTier('standard'); setFormUntil('');
      setShowForm(false);
    } catch (err) {
      setFormError(err.message || 'Failed to issue license.');
    } finally {
      setFormBusy(false);
    }
  }

  async function toggleSuspend(lic) {
    await pb.collection('commissioner_licenses').update(lic.id, {
      is_suspended: !lic.is_suspended,
    });
  }

  async function revoke(lic) {
    if (!confirm(`Revoke license ${lic.license_key}?`)) return;
    await pb.collection('commissioner_licenses').delete(lic.id);
  }

  return (
    <div>
      <SectionHeader label="LICENSES" count={licenses.length}>
        <button
          className="btn-quantum"
          style={{ fontSize: '0.45rem', padding: '0.15rem 0.4rem', borderColor: '#ffd700', color: '#ffd700' }}
          onClick={() => setShowForm(s => !s)}
        >
          {showForm ? '— CANCEL' : '+ ISSUE LICENSE'}
        </button>
      </SectionHeader>

      {showForm && (
        <form onSubmit={issueLicense} style={formContainerStyle}>
          <div style={{ fontSize: '0.4rem', letterSpacing: '2px', color: '#ffd700', marginBottom: '0.35rem' }}>
            NEW COMMISSIONER LICENSE
          </div>
          <InlineRow label="EMAIL">
            <input required type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
              placeholder="architect@email.com" style={inpStyle} />
          </InlineRow>
          <InlineRow label="TIER">
            <select value={formTier} onChange={e => setFormTier(e.target.value)} style={inpStyle}>
              {TIERS.map(t => <option key={t} value={t}>{t.toUpperCase()} ({TIER_CAPS[t]} max)</option>)}
            </select>
          </InlineRow>
          <InlineRow label="VALID UNTIL">
            <input type="date" value={formUntil} onChange={e => setFormUntil(e.target.value)} style={inpStyle} />
            <span style={{ fontSize: '0.4rem', color: 'var(--c-dark-silver)', marginLeft: '0.4rem' }}>leave blank = permanent</span>
          </InlineRow>
          {formError && <div style={{ fontSize: '0.5rem', color: 'var(--c-cherry-red)' }}>{formError}</div>}
          <button type="submit" disabled={formBusy} className="btn-quantum"
            style={{ alignSelf: 'flex-start', borderColor: '#4caf50', color: '#4caf50', opacity: formBusy ? 0.5 : 1 }}>
            {formBusy ? 'ISSUING...' : 'ISSUE'}
          </button>
        </form>
      )}

      {loading ? (
        <LoadingText />
      ) : licenses.length === 0 ? (
        <EmptyText text="No licenses issued." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {licenses.map(lic => {
            const email    = lic.expand?.user_id?.email || lic.user_id;
            const expired  = lic.valid_until && new Date(lic.valid_until) < new Date();
            const tierColor = TIER_COLOR[lic.tier] || 'var(--c-dark-silver)';
            return (
              <div key={lic.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.35rem 0.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                opacity: lic.is_suspended || expired ? 0.5 : 1,
                fontSize: '0.55rem', letterSpacing: '1px',
              }}>
                <span style={{ color: tierColor, minWidth: '4.5rem' }}>{(lic.tier || '—').toUpperCase()}</span>
                <span style={{ flex: 1, color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={email}>{email}</span>
                <span style={{ color: 'var(--c-dark-silver)', fontSize: '0.45rem', fontFamily: 'monospace' }}>{lic.license_key}</span>
                <span style={{ color: 'var(--c-dark-silver)', fontSize: '0.45rem', minWidth: '5rem' }}>
                  {lic.valid_until ? `exp ${lic.valid_until.slice(0,10)}` : 'permanent'}
                  {expired && <span style={{ color: 'var(--c-cherry-red)', marginLeft: '0.3rem' }}>EXPIRED</span>}
                </span>
                <span style={{ color: 'var(--c-dark-silver)', fontSize: '0.45rem', minWidth: '2rem', textAlign: 'right' }}>
                  {lic.events_run ?? 0} ev
                </span>
                {lic.is_suspended
                  ? <span style={{ fontSize: '0.4rem', color: 'var(--c-cherry-red)', border: '1px solid var(--c-cherry-red)', borderRadius: '2px', padding: '0 0.2rem' }}>SUSPENDED</span>
                  : null
                }
                <button onClick={() => toggleSuspend(lic)} style={iconBtnStyle(lic.is_suspended ? '#4caf50' : '#ff9800')}>
                  {lic.is_suspended ? 'REINSTATE' : 'SUSPEND'}
                </button>
                <button onClick={() => revoke(lic)} style={iconBtnStyle('var(--c-cherry-red)')}>REVOKE</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Disputes ─────────────────────────────────────────────────────────────────

function DisputesPanel() {
  const [disputes, setDisputes] = useState([]);
  const [loading,  setLoading]  = useState(true);

  async function fetchDisputes() {
    try {
      const records = await pb.collection('disputes').getFullList({
        filter: `status != 'resolved'`,
        sort: '-created',
        requestKey: null,
      });
      setDisputes(records);
    } catch (err) {
      if (!err.isAbort) console.error('[DisputesPanel]', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDisputes();
    pb.collection('disputes').subscribe('*', fetchDisputes);
    return () => pb.collection('disputes').unsubscribe('*');
  }, []);

  async function resolve(dispute, override) {
    // override: 'challenger_wins' | 'defender_wins' | 'no_contest'
    await pb.collection('disputes').update(dispute.id, {
      status: 'resolved',
      resolution: override,
    });
    // Patch the match status too if match_id is set.
    if (dispute.match_id) {
      const pbMatchesBase = (window.__FFPL_PB_HOST__ || 'http://127.0.0.1:8090') + '/api/collections/matches/records';
      await pb.collection('matches').update(dispute.match_id, { status: 'resolved', override_result: override }).catch(() => {});
    }
  }

  const STATUS_COLOR = { open: '#ff9800', under_review: 'var(--c-battery-blue)', resolved: 'var(--c-dark-silver)' };

  return (
    <div>
      <SectionHeader label="OPEN DISPUTES" count={disputes.length} />

      {loading ? <LoadingText /> : disputes.length === 0 ? (
        <EmptyText text="No open disputes." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {disputes.map(d => (
            <div key={d.id} style={{
              padding: '0.45rem 0.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              fontSize: '0.55rem', letterSpacing: '1px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ color: STATUS_COLOR[d.status] || 'var(--c-dark-silver)', fontSize: '0.45rem', border: `1px solid ${STATUS_COLOR[d.status] || 'var(--c-dark-silver)'}`, borderRadius: '2px', padding: '0 0.2rem' }}>
                  {(d.status || 'open').toUpperCase()}
                </span>
                <span style={{ color: 'var(--c-dark-silver)', fontSize: '0.45rem' }}>MATCH: {d.match_id || '—'}</span>
                <span style={{ color: 'var(--c-dark-silver)', fontSize: '0.45rem' }}>by {d.reporter || '—'}</span>
              </div>
              <div style={{ color: 'var(--c-white)', marginBottom: '0.3rem' }}>{d.reason || '—'}</div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button onClick={() => resolve(d, 'challenger_wins')} style={iconBtnStyle('#4caf50')}>CHALLENGER WINS</button>
                <button onClick={() => resolve(d, 'defender_wins')}   style={iconBtnStyle('var(--c-battery-blue)')}>DEFENDER WINS</button>
                <button onClick={() => resolve(d, 'no_contest')}      style={iconBtnStyle('var(--c-dark-silver)')}>NO CONTEST</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Announcements ────────────────────────────────────────────────────────────

function AnnouncementsPanel({ user }) {
  const [announcements, setAnnouncements] = useState([]);
  const [body,    setBody]    = useState('');
  const [pinned,  setPinned]  = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');

  async function fetchAnn() {
    try {
      const records = await pb.collection('announcements').getFullList({
        sort: '-pinned,-created',
        requestKey: null,
      });
      setAnnouncements(records);
    } catch (err) {
      if (!err.isAbort) console.error('[AnnouncementsPanel]', err);
    }
  }

  useEffect(() => {
    fetchAnn();
    pb.collection('announcements').subscribe('*', fetchAnn);
    return () => pb.collection('announcements').unsubscribe('*');
  }, []);

  async function post(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await pb.collection('announcements').create({ body: body.trim(), pinned });
      setBody(''); setPinned(false);
    } catch (err) {
      setError(err.message || 'Failed to post.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnn(id) {
    if (!confirm('Delete this announcement?')) return;
    await pb.collection('announcements').delete(id);
  }

  return (
    <div>
      <SectionHeader label="ANNOUNCEMENTS" count={announcements.length} />

      <form onSubmit={post} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
        <textarea
          required
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Broadcast a message to all pilots..."
          style={{ ...inpStyle, resize: 'vertical', fontFamily: 'inherit', flex: 'unset' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.5rem', letterSpacing: '1px', color: 'var(--c-dark-silver)', cursor: 'pointer' }}>
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} style={{ accentColor: 'var(--c-ice-blue)' }} />
            PIN to top
          </label>
          {error && <span style={{ fontSize: '0.5rem', color: 'var(--c-cherry-red)' }}>{error}</span>}
          <button type="submit" disabled={busy} className="btn-quantum"
            style={{ borderColor: '#4caf50', color: '#4caf50', opacity: busy ? 0.5 : 1 }}>
            {busy ? 'POSTING...' : 'BROADCAST'}
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {announcements.map(a => (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
            padding: '0.35rem 0.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            fontSize: '0.55rem', letterSpacing: '1px',
          }}>
            {a.pinned && <span style={{ color: '#ffd700', fontSize: '0.6rem', marginTop: '0.05rem' }}>◆</span>}
            <span style={{ flex: 1, color: 'var(--c-white)', whiteSpace: 'pre-wrap' }}>{a.body}</span>
            <span style={{ color: 'var(--c-slate-black)', fontSize: '0.45rem', whiteSpace: 'nowrap' }}>
              {a.created ? new Date(a.created).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}
            </span>
            <button onClick={() => deleteAnn(a.id)} style={iconBtnStyle('var(--c-cherry-red)')}>✕</button>
          </div>
        ))}
        {announcements.length === 0 && <EmptyText text="No announcements." />}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateLicenseKey(tier) {
  const prefix = { standard: 'STD', premium: 'PRM', elite: 'ELT' }[tier] || 'LIC';
  const rand = () => Math.random().toString(36).slice(2, 7).toUpperCase();
  return `FFPL-${prefix}-${rand()}-${rand()}`;
}

function SectionHeader({ label, count, children }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: '0.3rem', marginBottom: '0.4rem',
      borderBottom: '1px solid var(--c-slate-black)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.45rem', letterSpacing: '3px', color: 'var(--c-battery-blue)' }}>{label}</span>
        {count !== undefined && (
          <span style={{ fontSize: '0.4rem', color: 'var(--c-slate-black)' }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function LoadingText() {
  return <p style={{ color: 'var(--c-dark-silver)', fontSize: '0.6rem', letterSpacing: '1px' }}>Loading...</p>;
}

function EmptyText({ text }) {
  return <p style={{ color: 'var(--c-slate-black)', fontSize: '0.55rem', letterSpacing: '1px' }}>{text}</p>;
}

function InlineRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.4rem', letterSpacing: '2px', color: 'var(--c-dark-silver)', minWidth: '5rem' }}>{label}</span>
      {children}
    </div>
  );
}

const formContainerStyle = {
  marginBottom: '0.75rem',
  padding: '0.6rem',
  background: 'rgba(255,215,0,0.04)',
  border: '1px solid rgba(255,215,0,0.2)',
  borderRadius: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const inpStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--c-slate-black)',
  borderRadius: '3px',
  color: 'var(--c-white)',
  fontSize: '0.6rem',
  letterSpacing: '1px',
  padding: '0.28rem 0.45rem',
  outline: 'none',
  flex: 1,
  boxSizing: 'border-box',
  colorScheme: 'dark',
};

function iconBtnStyle(color) {
  return {
    padding: '0.1rem 0.3rem',
    fontSize: '0.4rem',
    letterSpacing: '1px',
    cursor: 'pointer',
    background: 'transparent',
    border: `1px solid ${color}`,
    color,
    borderRadius: '2px',
    whiteSpace: 'nowrap',
  };
}
