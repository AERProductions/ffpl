import { useState } from 'react';
import { pb } from '../lib/pb.js';

// Pilot profile overlay — create, edit, or view a pilot's profile.
// Includes handle, bio, challenge mode (with vacation counter), and replay visibility.
// Props:
//   acName          — AC name (string), pre-seeded from the loadout
//   mode            — 'create' | 'edit' | 'view'
//   existingProfile — PB pilot_profiles record or null
//   onClose         — called when the modal is dismissed
//   onSave          — called after a successful save
export function ProfileModal({ acName, mode, existingProfile, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(mode !== 'view');
  const isView = !isEditing;

  const [handle,        setHandle]        = useState(existingProfile?.handle || '');
  const [bio,           setBio]           = useState(existingProfile?.bio    || '');
  const [challengeMode, setChallengeMode] = useState(existingProfile?.challenge_mode    || 'open');
  const [replayVis,     setReplayVis]     = useState(existingProfile?.replay_visibility || 'public');
  const [saving,        setSaving]        = useState(false);
  const [saveMsg,       setSaveMsg]       = useState('');

  const vacationUsed = existingProfile?.vacation_used_this_year ?? 0;
  const onVacation   = challengeMode === 'vacation';
  const vacUntil     = existingProfile?.vacation_until ? new Date(existingProfile.vacation_until) : null;
  const vacActive    = onVacation && vacUntil && vacUntil > new Date();

  const toggleVacation = () => {
    if (isView) return;
    if (onVacation) {
      setChallengeMode('open');
    } else {
      if (vacationUsed >= 3) { setSaveMsg('✗ Vacation limit reached (3×/year)'); return; }
      setChallengeMode('vacation');
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const now   = new Date();
      const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const payload = {
        ac_name:           acName,
        handle:            handle.trim(),
        bio:               bio.trim(),
        challenge_mode:    challengeMode,
        replay_visibility: replayVis,
      };
      if (challengeMode === 'vacation' && !vacActive) {
        payload.vacation_starts         = now.toISOString();
        payload.vacation_until          = until.toISOString();
        payload.vacation_used_this_year = vacationUsed + 1;
      }
      if (existingProfile?.id) {
        await pb.collection('pilot_profiles').update(existingProfile.id, payload);
      } else {
        payload.vacation_used_this_year = challengeMode === 'vacation' ? 1 : 0;
        if (challengeMode === 'vacation') {
          payload.vacation_starts = now.toISOString();
          payload.vacation_until  = until.toISOString();
        }
        await pb.collection('pilot_profiles').create(payload);
      }
      setSaveMsg('✓ Profile saved');
      if (onSave) onSave();
    } catch (err) {
      setSaveMsg(`✗ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const modeLabels = {
    open:       { label: 'OPEN',       desc: 'Anyone can challenge you' },
    ascending:  { label: 'ASCENDING',  desc: 'Accept only from pilots ranked above you' },
    descending: { label: 'DESCENDING', desc: 'Accept only from pilots ranked below you' },
    vacation:   { label: 'VACATION',   desc: 'No challenges — standing frozen' },
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.6rem', letterSpacing: '3px', color: 'var(--c-battery-blue)', marginBottom: '0.25rem' }}>
              {isView ? 'PILOT PROFILE' : mode === 'create' ? 'NEW PROFILE' : 'EDIT PROFILE'}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--c-white)', letterSpacing: '2px' }}>
              {acName.toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--c-dark-silver)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1, padding: '0.1rem 0.3rem' }}
          >✕</button>
        </div>

        {/* Handle */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.5rem', letterSpacing: '2px', color: 'var(--c-dark-silver)', marginBottom: '0.3rem' }}>DISPLAY HANDLE</label>
          {isView
            ? <div style={{ color: 'var(--c-light-silver)', fontSize: '0.85rem', letterSpacing: '1px' }}>{handle || '—'}</div>
            : <input className="hq-input" value={handle} onChange={e => setHandle(e.target.value)} placeholder="e.g. Starfall" maxLength={40} />
          }
        </div>

        {/* Bio */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.5rem', letterSpacing: '2px', color: 'var(--c-dark-silver)', marginBottom: '0.3rem' }}>
            BIO <span style={{ color: 'var(--c-slate-black)' }}>({bio.length}/280)</span>
          </label>
          {isView
            ? <div style={{ color: 'var(--c-light-silver)', fontSize: '0.75rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{bio || '—'}</div>
            : <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={280}
                placeholder="Tell the league about your AC and combat style…"
                style={{
                  width: '100%', minHeight: '5rem', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--c-slate-black)',
                  borderRadius: '3px', color: 'var(--c-white)', fontSize: '0.75rem',
                  letterSpacing: '0.5px', padding: '0.4rem 0.5rem', resize: 'vertical',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
          }
        </div>

        {/* Challenge Mode */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.5rem', letterSpacing: '2px', color: 'var(--c-dark-silver)', marginBottom: '0.5rem' }}>CHALLENGE MODE</label>
          {isView ? (
            <div>
              <span style={{ color: 'var(--c-ice-blue)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '1px' }}>
                {modeLabels[challengeMode]?.label || challengeMode.toUpperCase()}
              </span>
              <span style={{ color: 'var(--c-dark-silver)', fontSize: '0.65rem', marginLeft: '0.5rem' }}>
                {modeLabels[challengeMode]?.desc}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.entries(modeLabels).map(([key, { label, desc }]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: key === 'vacation' ? undefined : 'pointer' }}>
                  {key === 'vacation' ? (
                    <button
                      type="button"
                      onClick={toggleVacation}
                      style={{
                        marginTop: '2px', width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                        border: `1px solid ${challengeMode === 'vacation' ? 'var(--c-cherry-red)' : 'var(--c-dark-silver)'}`,
                        background: challengeMode === 'vacation' ? 'var(--c-cherry-red)' : 'transparent',
                        cursor: vacationUsed >= 3 && !onVacation ? 'not-allowed' : 'pointer', padding: 0,
                      }}
                    />
                  ) : (
                    <input
                      type="radio" name="challenge_mode" value={key}
                      checked={challengeMode === key} onChange={() => setChallengeMode(key)}
                      style={{ marginTop: '2px', flexShrink: 0 }}
                    />
                  )}
                  <span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--c-white)', fontWeight: 600, letterSpacing: '1px' }}>{label}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--c-dark-silver)', marginLeft: '0.4rem' }}>{desc}</span>
                    {key === 'vacation' && (
                      <span style={{ fontSize: '0.6rem', color: 'var(--c-cherry-red)', marginLeft: '0.4rem' }}>
                        {vacationUsed}/3 used this year
                        {vacActive && vacUntil && ` · returns ${vacUntil.toLocaleDateString()}`}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Replay visibility */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.5rem', letterSpacing: '2px', color: 'var(--c-dark-silver)', marginBottom: '0.5rem' }}>REPLAY VISIBILITY</label>
          {isView ? (
            <span style={{ color: 'var(--c-ice-blue)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '1px' }}>
              {replayVis.toUpperCase()}
            </span>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {[
                { val: 'public',  label: 'PUBLIC',    desc: 'Anyone can view' },
                { val: 'link',    label: 'LINK ONLY', desc: 'Direct link required' },
                { val: 'private', label: 'PRIVATE',   desc: 'Hidden from public' },
              ].map(({ val, label, desc }) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input type="radio" name="replay_vis" value={val} checked={replayVis === val} onChange={() => setReplayVis(val)} />
                  <span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--c-white)', fontWeight: 600, letterSpacing: '1px' }}>{label}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--c-dark-silver)', marginLeft: '0.3rem' }}>{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isView && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn-quantum" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : mode === 'create' ? 'Create Profile' : 'Save Changes'}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: '1px solid var(--c-slate-black)', color: 'var(--c-dark-silver)', padding: '0.4rem 1rem', fontSize: '0.65rem', letterSpacing: '2px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            {saveMsg && (
              <span style={{ fontSize: '0.7rem', letterSpacing: '1px', color: saveMsg.startsWith('✓') ? '#22c55e' : 'var(--c-cherry-red)' }}>
                {saveMsg}
              </span>
            )}
          </div>
        )}
        {isView && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {existingProfile?.id && (
              <button className="btn-quantum" onClick={() => setIsEditing(true)}>✎ Edit Profile</button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: '1px solid var(--c-slate-black)', color: 'var(--c-dark-silver)', padding: '0.4rem 1rem', fontSize: '0.65rem', letterSpacing: '2px', cursor: 'pointer', marginLeft: 'auto' }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
