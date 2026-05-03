import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { pb } from '../lib/pb.js';

const CHALLENGE_MODES = ['open', 'vacation', 'closed', 'ascending', 'descending'];

const MODE_LABEL = {
  open:       'OPEN — accept all challenges',
  vacation:   'VACATION — visible, not challengeable',
  closed:     'CLOSED — hidden from standings',
  ascending:  'ASCENDING — challenger only (rising)',
  descending: 'DESCENDING — defender only (defending)',
};

export function ProfilePage() {
  const { user } = useOutletContext();
  const [profile, setProfile]       = useState(null);
  const [loadout, setLoadout]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving,  setSaving]        = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');

  // Editable fields
  const [handle,        setHandle]        = useState('');
  const [bio,           setBio]           = useState('');
  const [mode,          setMode]          = useState('open');
  const [vacationUntil, setVacationUntil] = useState('');
  const [replayPublic,  setReplayPublic]  = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    async function load() {
      try {
        // Find the loadout owned by this user.
        const loadouts = await pb.collection('ac_loadouts').getFullList({
          filter: `user_id = '${user.id}'`,
          requestKey: null,
        });
        const l = loadouts[0] ?? null;
        setLoadout(l);

        if (l) {
          // Find the pilot_profile linked to this loadout.
          const profiles = await pb.collection('pilot_profiles').getFullList({
            filter: `loadout_id = '${l.id}'`,
            requestKey: null,
          });
          const p = profiles[0] ?? null;
          setProfile(p);
          if (p) {
            setHandle(p.handle || '');
            setBio(p.bio || '');
            setMode(p.challenge_mode || 'open');
            setVacationUntil(p.vacation_until ? p.vacation_until.slice(0, 10) : '');
            setReplayPublic(p.replay_visibility !== 'private');
          }
        }
      } catch (err) {
        console.error('[ProfilePage] load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    if (!loadout) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const data = {
        handle:         handle.trim(),
        bio:            bio.trim(),
        challenge_mode: mode,
        vacation_until: mode === 'vacation' && vacationUntil ? vacationUntil : null,
        replay_visibility: replayPublic ? 'public' : 'private',
        loadout_id:     loadout.id,
      };

      if (profile) {
        await pb.collection('pilot_profiles').update(profile.id, data);
      } else {
        await pb.collection('pilot_profiles').create(data);
      }
      setSaveMsg('PROFILE SAVED.');
    } catch (err) {
      setSaveMsg('ERROR: ' + (err.message || 'save failed'));
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <section className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--c-dark-silver)', fontSize: '0.7rem', letterSpacing: '2px' }}>
          [ LOGIN REQUIRED ]
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--c-dark-silver)', fontSize: '0.7rem', letterSpacing: '2px' }}>LOADING PROFILE...</p>
      </section>
    );
  }

  if (!loadout) {
    return (
      <section className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
        <p style={{ color: 'var(--c-dark-silver)', fontSize: '0.7rem', letterSpacing: '2px' }}>NO LOADOUT LINKED TO THIS ACCOUNT.</p>
        <p style={{ color: 'var(--c-slate-black)', fontSize: '0.55rem', letterSpacing: '1px' }}>Upload a DATA.BIN via GARAGE SYNC to register your AC.</p>
      </section>
    );
  }

  const rating   = Math.round(loadout.rating ?? 1500);
  const rd       = Math.round(loadout.rating_deviation ?? 350);
  const score    = loadout.score ?? 0;
  const wins     = loadout.wins ?? 0;
  const losses   = loadout.losses ?? 0;
  const draws    = loadout.draws ?? 0;

  return (
    <section className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <h2 className="title-header" style={{ color: 'var(--c-white)', border: 'none', marginBottom: '1.25rem' }}>
        PILOT PROFILE
      </h2>

      {/* Stats strip */}
      <div style={{
        display: 'flex', gap: '1rem', marginBottom: '1.25rem',
        padding: '0.5rem 0.75rem',
        background: 'rgba(255,255,255,0.03)', borderRadius: '3px',
        fontSize: '0.6rem', letterSpacing: '2px',
      }}>
        <StatChip label="AC" value={loadout.ac_name || '—'} color="var(--c-white)" />
        <StatChip label="TEAM" value={(loadout.team || '—').toUpperCase()} color="var(--c-battery-blue)" />
        <StatChip label="RATING" value={`${rating} ±${rd}`} color="var(--c-ice-blue)" />
        <StatChip label="W/L/D" value={`${wins}/${losses}/${draws}`} color="#4caf50" />
        <StatChip label="PTS" value={score} color="var(--c-ice-blue)" />
        <StatChip label="REGION" value={loadout.region || '—'} color="var(--c-dark-silver)" />
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

        <Field label="PILOT HANDLE">
          <input
            type="text"
            maxLength={32}
            value={handle}
            onChange={e => setHandle(e.target.value)}
            placeholder="Your callsign..."
            style={inputStyle}
          />
        </Field>

        <Field label="BIO">
          <textarea
            maxLength={200}
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Short bio visible on roster cards..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        <Field label="CHALLENGE MODE">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {CHALLENGE_MODES.map(m => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.6rem', letterSpacing: '1px', color: mode === m ? 'var(--c-white)' : 'var(--c-dark-silver)' }}>
                <input
                  type="radio"
                  name="challenge_mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  style={{ accentColor: 'var(--c-ice-blue)' }}
                />
                <span style={{ color: 'var(--c-ice-blue)', minWidth: '6rem' }}>{m.toUpperCase()}</span>
                <span style={{ color: 'var(--c-dark-silver)', fontSize: '0.5rem' }}>{MODE_LABEL[m]}</span>
              </label>
            ))}
          </div>
        </Field>

        {mode === 'vacation' && (
          <Field label="VACATION UNTIL">
            <input
              type="date"
              value={vacationUntil}
              onChange={e => setVacationUntil(e.target.value)}
              style={inputStyle}
            />
            <span style={{ fontSize: '0.5rem', color: 'var(--c-dark-silver)', letterSpacing: '1px' }}>
              After this date, mode auto-reverts to OPEN.
            </span>
          </Field>
        )}

        <Field label="REPLAY VISIBILITY">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.6rem', letterSpacing: '1px', color: 'var(--c-dark-silver)' }}>
            <input
              type="checkbox"
              checked={replayPublic}
              onChange={e => setReplayPublic(e.target.checked)}
              style={{ accentColor: 'var(--c-ice-blue)' }}
            />
            Public replays — allow league spectators to view your match recordings
          </label>
        </Field>

        {saveMsg && (
          <div style={{
            padding: '0.3rem 0.6rem', borderRadius: '3px', fontSize: '0.55rem', letterSpacing: '1px',
            color: saveMsg.startsWith('ERROR') ? 'var(--c-cherry-red)' : '#4caf50',
            background: saveMsg.startsWith('ERROR') ? 'rgba(220,50,50,0.1)' : 'rgba(76,175,80,0.1)',
            border: `1px solid ${saveMsg.startsWith('ERROR') ? 'var(--c-cherry-red)' : '#4caf50'}`,
          }}>
            {saveMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-quantum"
          style={{ alignSelf: 'flex-start', opacity: saving ? 0.5 : 1, cursor: saving ? 'wait' : 'pointer' }}
        >
          {saving ? 'SAVING...' : 'SAVE PROFILE'}
        </button>
      </form>
    </section>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <span style={{ fontSize: '0.4rem', color: 'var(--c-slate-black)', letterSpacing: '2px' }}>{label}</span>
      <span style={{ color, fontSize: '0.65rem' }}>{value}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <label style={{ fontSize: '0.45rem', letterSpacing: '2px', color: 'var(--c-dark-silver)' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--c-slate-black)',
  borderRadius: '3px',
  color: 'var(--c-white)',
  fontSize: '0.65rem',
  letterSpacing: '1px',
  padding: '0.35rem 0.5rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};
