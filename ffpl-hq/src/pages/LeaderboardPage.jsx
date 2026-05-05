import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useACLoadouts } from '../hooks/useLoadouts.js';
import { useChallenges } from '../hooks/useChallenges.js';
import { pb } from '../lib/pb.js';
import { AnnouncementsSection } from '../components/AnnouncementsSection.jsx';
import { ProfileModal } from '../components/ProfileModal.jsx';

const MODE_COLOR = {
  open:      '#4caf50',
  vacation:  '#ff9800',
  closed:    'var(--c-cherry-red)',
  ascending: 'var(--c-ice-blue)',
  descending:'var(--c-battery-blue)',
};

export function LeaderboardPage() {
  const { user } = useOutletContext();
  const { loadouts, loading } = useACLoadouts();
  const [challengeError, setChallengeError] = useState('');
  const [sendingTo, setSendingTo] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [profileModal, setProfileModal] = useState(null); // { acName, existingProfile }

  // Build ranked rows: exclude banned ACs and those in closed mode.
  // Sort primary: score desc, secondary: rating desc, tertiary: wins desc.
  const rows = [...loadouts]
    .filter(l => {
      if (l.banned) return false;
      const mode = effectiveMode(l);
      return mode !== 'closed';
    })
    .sort((a, b) => {
      const sd = (b.score ?? 0) - (a.score ?? 0);
      if (sd !== 0) return sd;
      const rd = (b.rating ?? 1500) - (a.rating ?? 1500);
      if (rd !== 0) return rd;
      return (b.wins ?? 0) - (a.wins ?? 0);
    });

  // My loadouts — all ac_loadouts owned by the logged-in user.
  const myLoadouts    = user ? rows.filter(l => l.user_id === user.id) : [];
  const myLoadoutIds  = myLoadouts.map(l => l.id);

  const { outgoing, incoming, sendChallenge, respondToChallenge } = useChallenges(myLoadoutIds);

  useEffect(() => {
    const fetch = () =>
      pb.collection('announcements').getFullList({ sort: '-created', requestKey: null })
        .then(setAnnouncements).catch(() => {});
    fetch();
    pb.collection('announcements').subscribe('*', fetch);
    return () => pb.collection('announcements').unsubscribe('*');
  }, []);

  // Find my best eligible challenger for a given defender rank index.
  // "eligible" = lower-ranked (higher idx) than the defender.
  function myChallenger(defenderIdx) {
    const candidates = myLoadouts
      .map(l => ({ l, idx: rows.indexOf(l) }))
      .filter(({ idx }) => idx > defenderIdx);
    if (!candidates.length) return null;
    // Pick the one closest to the defender (minimise rank gap — fair challenge).
    candidates.sort((a, b) => a.idx - b.idx);
    return candidates[0];
  }

  async function handleChallenge(defenderLoadout, defenderIdx) {
    const cand = myChallenger(defenderIdx);
    if (!cand) return;
    setChallengeError('');
    setSendingTo(defenderLoadout.id);
    try {
      await sendChallenge(cand.l.id, defenderLoadout.id, cand.idx, defenderIdx);
    } catch (err) {
      setChallengeError(err.message);
    } finally {
      setSendingTo(null);
    }
  }

  return (
    <section className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="title-header" style={{ color: 'var(--c-white)', border: 'none', margin: 0 }}>LEADERBOARD</h2>
        <span style={{ fontSize: '0.6rem', letterSpacing: '2px', color: 'var(--c-dark-silver)' }}>
          {rows.length} ACTIVE PILOTS
        </span>
      </div>

      {loading ? (
        <p style={{ color: 'var(--c-dark-silver)', fontSize: '0.8rem' }}>Loading standings...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--c-dark-silver)', fontSize: '0.8rem', letterSpacing: '1px' }}>[i] No ranked pilots yet.</p>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Header */}
          <div style={headerRowStyle}>
            <span style={cellStyle(2, 'var(--c-dark-silver)')}>#</span>
            <span style={cellStyle(6, 'var(--c-dark-silver)')}>PILOT</span>
            <span style={cellStyle(5, 'var(--c-dark-silver)')}>AC</span>
            <span style={cellStyle(3, 'var(--c-dark-silver)')}>TEAM</span>
            <span style={cellStyle(2, 'var(--c-dark-silver)', 'center')}>W</span>
            <span style={cellStyle(2, 'var(--c-dark-silver)', 'center')}>L</span>
            <span style={cellStyle(2, 'var(--c-dark-silver)', 'center')}>D</span>
            <span style={cellStyle(3, 'var(--c-dark-silver)', 'center')}>PTS</span>
            <span style={cellStyle(4, 'var(--c-dark-silver)', 'center')}>RATING</span>
            <span style={cellStyle(3, 'var(--c-dark-silver)', 'center')}>MODE</span>
            <span style={cellStyle(4, 'var(--c-dark-silver)', 'center')}></span>
          </div>

          {rows.map((l, idx) => {
            const mode = effectiveMode(l);
            const handle = l.pilot?.handle || l.ac_name || '—';
            const rating  = Math.round(l.rating ?? 1500);
            const rd      = Math.round(l.rating_deviation ?? 350);
            const isOwnEntry = user && l.user_id === user.id;

            // Challenge button state for this row.
            const hasEligibleChallenger = !isOwnEntry && !!myChallenger(idx);
            const canShowChallenge = user && mode === 'open' && hasEligibleChallenger;
            const isPending = canShowChallenge && outgoing.some(
              c => c.defender_id === l.id && c.status === 'pending',
            );
            const isSending = sendingTo === l.id;

            return (
              <div key={l.id} style={{
                ...rowStyle,
                background: idx === 0
                  ? 'rgba(255,215,0,0.04)'
                  : idx === 1
                  ? 'rgba(192,192,192,0.03)'
                  : idx === 2
                  ? 'rgba(205,127,50,0.03)'
                  : 'transparent',
                borderLeft: isOwnEntry ? '2px solid var(--c-ice-blue)' : '2px solid transparent',
              }}>
                <span style={cellStyle(2, rankColor(idx))}>
                  {idx === 0 ? '◈' : idx === 1 ? '◇' : idx === 2 ? '△' : `${idx + 1}`}
                </span>
                <span style={cellStyle(6, 'var(--c-white)')} title={handle}>
                  <button
                    onClick={() => setProfileModal({ acName: l.ac_name, existingProfile: l.pilot || null })}
                    style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, letterSpacing: 'inherit', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}
                    title="View pilot profile"
                  >
                    {truncate(handle, 14)}
                  </button>
                </span>
                <span style={cellStyle(5, 'var(--c-dark-silver)')} title={l.ac_name}>{truncate(l.ac_name || l.profile || '—', 12)}</span>
                <span style={cellStyle(3, 'var(--c-battery-blue)')}>{truncate((l.team || 'ULGND').toUpperCase(), 8)}</span>
                <span style={cellStyle(2, '#4caf50', 'center')}>{l.wins ?? 0}</span>
                <span style={cellStyle(2, 'var(--c-cherry-red)', 'center')}>{l.losses ?? 0}</span>
                <span style={cellStyle(2, 'var(--c-dark-silver)', 'center')}>{l.draws ?? 0}</span>
                <span style={cellStyle(3, 'var(--c-ice-blue)', 'center')}>{l.score ?? 0}</span>
                <span style={cellStyle(4, 'var(--c-dark-silver)', 'center')}>
                  <span style={{ color: 'var(--c-white)' }}>{rating}</span>
                  <span style={{ fontSize: '0.45rem', color: 'var(--c-slate-black)', marginLeft: '2px' }}>±{rd}</span>
                </span>
                <span style={cellStyle(3, MODE_COLOR[mode] || 'var(--c-dark-silver)', 'center')}>
                  {mode.toUpperCase().slice(0, 4)}
                </span>
                <span style={cellStyle(4, 'var(--c-dark-silver)', 'center')}>
                  {isOwnEntry && (
                    <span style={{ fontSize: '0.45rem', letterSpacing: '1px', color: 'var(--c-battery-blue)' }}>YOU</span>
                  )}
                  {canShowChallenge && isPending && (
                    <span style={{ fontSize: '0.45rem', letterSpacing: '1px', color: '#ff9800' }}>PENDING↗</span>
                  )}
                  {canShowChallenge && !isPending && (
                    <button
                      disabled={isSending}
                      onClick={() => handleChallenge(l, idx)}
                      style={{
                        padding: '0.1rem 0.35rem', fontSize: '0.5rem', letterSpacing: '1px',
                        cursor: isSending ? 'wait' : 'pointer',
                        background: 'transparent',
                        border: '1px solid #4caf50',
                        color: isSending ? 'var(--c-dark-silver)' : '#4caf50',
                        borderRadius: '2px',
                        opacity: isSending ? 0.5 : 1,
                      }}
                    >
                      {isSending ? '…' : 'CHALLENGE'}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Challenge error banner */}
      {challengeError && (
        <div style={{
          margin: '0.5rem 0', padding: '0.35rem 0.6rem',
          background: 'rgba(220,50,50,0.12)', border: '1px solid var(--c-cherry-red)',
          borderRadius: '3px', fontSize: '0.55rem', letterSpacing: '1px', color: 'var(--c-cherry-red)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{challengeError}</span>
          <button
            onClick={() => setChallengeError('')}
            style={{ background: 'none', border: 'none', color: 'var(--c-cherry-red)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 0.2rem' }}
          >✕</button>
        </div>
      )}

      {/* Incoming challenges panel — only shown when there are pending ones */}
      {incoming.filter(c => c.status === 'pending').length > 0 && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--c-slate-black)' }}>
          <div style={{ fontSize: '0.5rem', letterSpacing: '2px', color: '#ff9800', marginBottom: '0.4rem' }}>
            INCOMING CHALLENGES
          </div>
          {incoming.filter(c => c.status === 'pending').map(c => {
            const challenger = loadouts.find(l => l.id === c.challenger_id);
            const cHandle = challenger?.pilot?.handle || challenger?.ac_name || c.challenger_id.slice(0, 8);
            const expires = c.expires_at ? new Date(c.expires_at) : null;
            const hoursLeft = expires ? Math.max(0, Math.round((expires - Date.now()) / 3_600_000)) : null;
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.3rem 0.5rem', marginBottom: '0.2rem',
                background: 'rgba(255,152,0,0.06)', borderRadius: '3px',
                fontSize: '0.55rem', letterSpacing: '1px',
              }}>
                <span style={{ flex: 1, color: 'var(--c-white)' }}>{cHandle}</span>
                {hoursLeft !== null && (
                  <span style={{ color: 'var(--c-dark-silver)', fontSize: '0.45rem' }}>
                    {hoursLeft}h left
                  </span>
                )}
                <button onClick={() => respondToChallenge(c.id, 'accepted')}
                  style={respondBtnStyle('#4caf50')}>ACCEPT</button>
                <button onClick={() => respondToChallenge(c.id, 'declined')}
                  style={respondBtnStyle('var(--c-cherry-red)')}>DECLINE</button>
                <button onClick={() => respondToChallenge(c.id, 'abstained')}
                  style={respondBtnStyle('var(--c-dark-silver)')}>ABSTAIN</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--c-slate-black)', fontSize: '0.45rem', color: 'var(--c-slate-black)', letterSpacing: '1px' }}>
        CLOSED pilots hidden · VACATION pilots visible but not challengeable · Rating = Glicko-2 (±RD)
      </div>

      <AnnouncementsSection announcements={announcements} />

      {profileModal && (
        <ProfileModal
          acName={profileModal.acName}
          mode={profileModal.existingProfile ? 'view' : 'create'}
          existingProfile={profileModal.existingProfile}
          onClose={() => setProfileModal(null)}
          onSave={() => setProfileModal(null)}
        />
      )}
    </section>
  );
}

function effectiveMode(l) {
  const mode = l.pilot?.challenge_mode;
  if (!mode) return 'open';
  if (mode === 'vacation' && l.pilot?.vacation_until && new Date(l.pilot.vacation_until) < new Date()) return 'open';
  return mode;
}

function rankColor(idx) {
  if (idx === 0) return '#ffd700';
  if (idx === 1) return '#c0c0c0';
  if (idx === 2) return '#cd7f32';
  return 'var(--c-dark-silver)';
}

function truncate(str, max) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

const headerRowStyle = {
  display: 'flex', alignItems: 'center',
  padding: '0.2rem 0.5rem',
  borderBottom: '1px solid var(--c-slate-black)',
  marginBottom: '0.25rem',
  fontSize: '0.45rem', letterSpacing: '2px',
};

const rowStyle = {
  display: 'flex', alignItems: 'center',
  padding: '0.3rem 0.5rem',
  borderBottom: '1px solid rgba(255,255,255,0.03)',
  fontSize: '0.65rem',
  transition: 'background 0.1s',
};

function cellStyle(flex, color, textAlign = 'left') {
  return { flex, color, textAlign, overflow: 'hidden', whiteSpace: 'nowrap', letterSpacing: '1px', minWidth: 0 };
}

function respondBtnStyle(color) {
  return {
    padding: '0.1rem 0.3rem', fontSize: '0.45rem', letterSpacing: '1px',
    cursor: 'pointer', background: 'transparent',
    border: `1px solid ${color}`, color, borderRadius: '2px',
  };
}

