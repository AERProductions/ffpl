import { useAuth } from './hooks/useAuth.js';
import { useAppMode } from './hooks/useAppMode.js';
import { LoginModal } from './components/LoginModal.jsx';
import { Ping, ProcessSaveData } from './wailsjs/go/main/App.js';
import { decryptPspSave } from './lib/psp/decryptSave.js';
import * as base64js from 'base64-js';
import { Quit, WindowMinimise, WindowToggleMaximise, WindowSetAlwaysOnTop } from './wailsjs/runtime/runtime.js';
import { Outlet, NavLink } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { pb } from './lib/pb.js';
import arenaBg from './assets/graphics/arena_main_bg.png';
import bannerBg from './assets/graphics/telemetry_banner.png';
import './index.css';

function App() {
  const { user, isCommissioner, login, logout } = useAuth();
  const { mode, hasAdminKey } = useAppMode(isCommissioner);
  const [showLogin, setShowLogin] = useState(false);

  const [goStatus, setGoStatus] = useState("Checking backend...");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { count, loadouts } or null
  const [syncError, setSyncError] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const fileInputRef = useRef(null);



  // Pilot profile state (populated after a successful garage sync)
  const [pilotProfile, setPilotProfile]       = useState(null);
  const [profileAcName, setProfileAcName]     = useState('');
  const [profileLoadoutId, setProfileLoadoutId] = useState(''); // stable PB record ID for pilot_profiles FK
  const [profileMode, setProfileMode]         = useState('open');
  const [profileReplay, setProfileReplay]     = useState('public');
  const [profileSaving, setProfileSaving]     = useState(false);
  const [profileMsg, setProfileMsg]           = useState('');

  useEffect(() => {
    Ping().then(res => setGoStatus("SYNCHRONIZED")).catch(err => setGoStatus("OFFLINE"));
  }, []);

  const handleTogglePin = () => {
    WindowSetAlwaysOnTop(!isPinned);
    setIsPinned(!isPinned);
  };

  const handleSyncGarage = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const loadProfile = async (acName, loadoutId = '') => {
    if (!acName) return;
    setProfileAcName(acName);
    setProfileLoadoutId(loadoutId);
    try {
      let rec = null;
      // Prefer FK lookup so renames don't break the link.
      if (loadoutId) {
        rec = await pb.collection('pilot_profiles')
          .getFirstListItem(`loadout_id="${loadoutId}"`)
          .catch(() => null);
        // Backfill loadout_id on legacy records that were saved without it.
        if (rec && !rec.loadout_id) {
          pb.collection('pilot_profiles').update(rec.id, { loadout_id: loadoutId }).catch(() => {});
        }
      }
      // Fallback: match by ac_name for records created before FK migration.
      if (!rec) {
        rec = await pb.collection('pilot_profiles')
          .getFirstListItem(`ac_name="${acName}"`)
          .catch(() => null);
      }
      setPilotProfile(rec || null);
      setProfileMode(rec?.challenge_mode || 'open');
      setProfileReplay(rec?.replay_visibility || 'public');
    } catch { /* ignore */ }
  };

  const saveProfile = async () => {
    if (!profileAcName) return;
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const now   = new Date();
      const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const vacUsed = pilotProfile?.vacation_used_this_year ?? 0;
      const payload = {
        ac_name:           profileAcName,
        loadout_id:        profileLoadoutId,
        challenge_mode:    profileMode,
        replay_visibility: profileReplay,
      };
      if (profileMode === 'vacation' && pilotProfile?.challenge_mode !== 'vacation') {
        if (vacUsed >= 3) {
          setProfileMsg('✗ Vacation limit reached (3×/year)');
          setProfileSaving(false);
          return;
        }
        payload.vacation_starts         = now.toISOString();
        payload.vacation_until          = until.toISOString();
        payload.vacation_used_this_year = vacUsed + 1;
      }
      if (pilotProfile?.id) {
        await pb.collection('pilot_profiles').update(pilotProfile.id, payload);
      } else {
        if (profileMode !== 'vacation') payload.vacation_used_this_year = 0;
        await pb.collection('pilot_profiles').create(payload);
      }
      setProfileMsg('✓ Saved');
      const rec = await pb.collection('pilot_profiles')
        .getFirstListItem(profileLoadoutId
          ? `loadout_id="${profileLoadoutId}"`
          : `ac_name="${profileAcName}"`)
        .catch(() => null);
      if (rec) setPilotProfile(rec);
    } catch (err) {
      setProfileMsg(`✗ ${err.message}`);
    } finally {
      setProfileSaving(false);
    }
  };

  const onFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsSyncing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      let finalBytes;
      if (file.name.toLowerCase().endsWith('.ppst')) {
          finalBytes = new Uint8Array(arrayBuffer);
      } else {
          finalBytes = await decryptPspSave(arrayBuffer);
      }

      // Convert to Base64 to send safely across Wails IPC boundary
      // Using base64-js to handle large Uint8Arrays without max stack call errors
      const base64Data = base64js.fromByteArray(finalBytes);
      let res;
      try {
        res = await ProcessSaveData(base64Data, user?.id ?? '');
      } catch (err) {
        if (err?.message === 'DESKTOP_ONLY') {
          throw new Error('Save-file sync requires the FFPL desktop app. Download it from the league site.');
        }
        throw err;
      }
      setSyncResult({ count: res.length, loadouts: res });
      setSyncError('');
      if (res.length > 0) {
        const acName = res[0].profile || res[0].Profile || '';
        // Resolve the stable PocketBase record ID so the pilot profile FK is
        // accurate even if the player renames their AC later.
        const lRec = await pb.collection('ac_loadouts')
          .getFirstListItem(`ac_name="${acName}"`)
          .catch(() => null);
        loadProfile(acName, lRec?.id || '');
      }
    } catch(err) {
      console.error('[FFPL] Garage sync failed:', err);
      setSyncError(err.message || 'Upload failed');
      setSyncResult(null);
    } finally {
      setIsSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  return (
    <>
      {showLogin && (
        <LoginModal
          onLogin={async (email, password) => { await login(email, password); setShowLogin(false); }}
          onClose={() => setShowLogin(false)}
        />
      )}
      <div className="titlebar">
        FFPL // THE ARCH-NEXUS
        {mode === 'host' && (
          <span style={{ fontSize: '0.45rem', letterSpacing: '3px', color: 'var(--c-cherry-red)', marginLeft: '0.75rem', border: '1px solid var(--c-cherry-red)', padding: '0.1rem 0.4rem', opacity: 0.9 }}>HOST</span>
        )}

        {/* Auth pill in titlebar */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', marginRight: '0.5rem' }}>
            <span style={{ fontSize: '0.5rem', letterSpacing: '2px', color: mode === 'host' ? 'var(--c-cherry-red)' : isCommissioner ? 'var(--c-battery-blue)' : 'var(--c-dark-silver)' }}>
              {mode === 'host' ? '⬡ HOST' : isCommissioner ? '◈ COMMISSIONER' : '◇ ARCHITECT'} · {user.email}
            </span>
            <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--c-slate-black)', cursor: 'pointer', fontSize: '0.5rem', letterSpacing: '1px', padding: '0 0.3rem' }} title="Sign out">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            style={{ marginLeft: 'auto', marginRight: '0.5rem', background: 'none', border: '1px solid var(--c-slate-black)', color: 'var(--c-dark-silver)', fontSize: '0.5rem', letterSpacing: '2px', padding: '0.15rem 0.5rem', cursor: 'pointer' }}
          >
            SIGN IN
          </button>
        )}

        <div className="window-controls">
          <button className={`win-btn ${isPinned ? 'active' : ''}`} onClick={handleTogglePin} title={isPinned ? "Unpin Window" : "Pin Viewer"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.74V7A3 3 0 0 1 15 7v3.74L17 14H7z"/></svg>
          </button>
          <button className="win-btn" onClick={WindowMinimise} title="Minimize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button className="win-btn" onClick={WindowToggleMaximise} title="Expand / Shrink">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
          </button>
          <button className="win-btn win-btn-close" onClick={Quit} title="Terminate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
      
      <div className="app-layout">
        
        {/* LEFT COLUMN: COMMAND & NAVIGATION */}
        <section className="glass-panel">
          <h2 className="title-header" style={{ color: 'var(--c-battery-blue)' }}>ARCHITECT NEXUS</h2>
          
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', border: '1px solid var(--c-slate-black)' }}>
            <div className={`pulse-dot ${goStatus === "OFFLINE" ? "offline" : ""}`} style={{ backgroundColor: goStatus === "OFFLINE" ? 'var(--c-cherry-red)' : undefined }} />
            <span style={{ fontSize: '0.85rem', letterSpacing: '1px', color: goStatus === "SYNCHRONIZED" ? "var(--c-ice-blue)" : "var(--c-cherry-red)" }}>
              IPC: {goStatus}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".ppst,.bin,.BIN" 
              onChange={onFileUpload} 
            />
            <button className="btn-quantum" onClick={handleSyncGarage} style={{ borderColor: isSyncing ? 'var(--c-battery-blue)' : 'var(--c-ice-blue)'}}>
              {isSyncing ? "SYNCING GARAGE..." : "GARAGE SYNC (UPLOAD DATA.BIN)"}
            </button>
            <NavLink to="/" end style={({ isActive }) => ({ display: 'block', textDecoration: 'none', ...(isActive ? { borderColor: 'var(--c-ice-blue)', color: 'var(--c-ice-blue)' } : {}) })} className="btn-quantum">LEADERBOARD</NavLink>
            <NavLink to="/hangar" style={({ isActive }) => ({ display: 'block', textDecoration: 'none', ...(isActive ? { borderColor: 'var(--c-ice-blue)', color: 'var(--c-ice-blue)' } : {}) })} className="btn-quantum">HANGAR / ROSTER</NavLink>
            <NavLink to="/calendar" style={({ isActive }) => ({ display: 'block', textDecoration: 'none', ...(isActive ? { borderColor: 'var(--c-ice-blue)', color: 'var(--c-ice-blue)' } : {}) })} className="btn-quantum">CALENDAR</NavLink>
            <NavLink to="/profile" style={({ isActive }) => ({ display: 'block', textDecoration: 'none', ...(isActive ? { borderColor: 'var(--c-ice-blue)', color: 'var(--c-ice-blue)' } : {}) })} className="btn-quantum">MY PROFILE</NavLink>
            {(isCommissioner || mode === 'host') && (
              <NavLink to="/commissioner" style={({ isActive }) => ({ display: 'block', textDecoration: 'none', ...(isActive ? { borderColor: 'var(--c-ice-blue)', color: 'var(--c-ice-blue)' } : {}) })} className="btn-quantum">COMM. HQ</NavLink>
            )}
            {mode === 'host' && (
              <NavLink to="/admin" style={({ isActive }) => ({ display: 'block', textDecoration: 'none', ...(isActive ? { borderColor: 'var(--c-cherry-red)', color: 'var(--c-cherry-red)' } : { color: 'var(--c-cherry-red)', borderColor: 'rgba(220,38,38,0.4)' }) })} className="btn-quantum">HOST HQ</NavLink>
            )}
          </div>
          
          <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: 'var(--c-dark-silver)', letterSpacing: '1px' }}>
            SYS.VER // 2.0.26<br/>
            LEGAL // VOLUNTARY SUPPORT DB
          </div>
        </section>

        {/* CENTER COLUMN: routed page content */}
        <Outlet context={{ user, isCommissioner, mode }} />

                {/* RIGHT COLUMN: TELEMETRY & BANNERS */}
        <section className="glass-panel panel-red" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--c-slate-black)' }}>
            <h2 className="title-header" style={{ color: 'var(--c-cherry-red)', margin: 0, border: 'none', padding: 0 }}>TELEMETRY</h2>
          </div>

          <div style={{ flex: 1, background: 'var(--c-black)', padding: '1.5rem', fontFamily: '"Consolas", monospace', fontSize: '0.8rem', overflowY: 'auto', color: 'var(--c-dark-silver)' }}>
            <p style={{ color: 'var(--c-battery-blue)' }}>[✓] Secure connection established.</p>
            <p style={{ color: 'var(--c-battery-blue)' }}>[✓] Live match telemetry waiting...</p>
            
            {!isSyncing && !syncResult && !syncError ? (
               <p>[i] Awaiting Architect commands.</p>
            ) : null}
            {isSyncing && (
              <>
                <p style={{ color: 'var(--c-ice-blue)' }}>[!] LOCATING DATA.BIN...</p>
                <p style={{ color: 'var(--c-ice-blue)' }}>[!] PARSING VIRTUAL DATA STREAMS...</p>
              </>
            )}
            {syncError && (
              <p style={{ color: 'var(--c-cherry-red)' }}>[✗] SYNC FAILED: {syncError}</p>
            )}
            {syncResult && (
              <>
                <p style={{ color: '#22c55e' }}>[✓] GARAGE SYNC COMPLETE — {syncResult.count} UNITS REGISTERED</p>
                {syncResult.loadouts?.map((l, i) => (
                  <p key={i} style={{ color: 'var(--c-dark-silver)', marginLeft: '1rem' }}>
                    [{i+1}] {(l.profile || l.Profile || '?').toUpperCase()} &nbsp;·&nbsp;
                    <span style={{color:'var(--c-battery-blue)'}}>{l.region || l.Region || 'US'}</span> &nbsp;·&nbsp;
                    <span style={{color:'var(--c-ice-blue)'}}>TEAM: {(l.team || l.profile || 'FFPLTEAM').toUpperCase()}</span>
                  </p>
                ))}
              </>
            )}
          </div>

          {/* Pilot Profile Panel — appears after a successful garage sync */}
          {profileAcName && (
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--c-slate-black)' }}>
              <div style={{ fontSize: '0.6rem', letterSpacing: '3px', color: 'var(--c-battery-blue)', marginBottom: '0.5rem' }}>
                PILOT // {profileAcName.toUpperCase()}
              </div>

              <div style={{ marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.55rem', letterSpacing: '2px', color: 'var(--c-dark-silver)', marginBottom: '0.3rem' }}>CHALLENGE MODE</div>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {[
                    { val: 'open',       label: 'OPEN' },
                    { val: 'ascending',  label: '▲ ASC' },
                    { val: 'descending', label: '▼ DESC' },
                    { val: 'vacation',   label: '✈ VAC' },
                  ].map(({ val, label }) => (
                    <button
                      key={val}
                      onClick={() => setProfileMode(val)}
                      style={{
                        padding: '0.2rem 0.45rem', fontSize: '0.6rem', letterSpacing: '1px', cursor: 'pointer',
                        border: `1px solid ${profileMode === val ? 'var(--c-ice-blue)' : 'var(--c-slate-black)'}`,
                        background: profileMode === val ? 'rgba(72,195,232,0.1)' : 'transparent',
                        color: profileMode === val ? 'var(--c-ice-blue)' : 'var(--c-dark-silver)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {profileMode === 'vacation' && (
                  <div style={{ fontSize: '0.55rem', color: 'var(--c-cherry-red)', marginTop: '0.2rem', letterSpacing: '1px' }}>
                    {pilotProfile?.vacation_used_this_year ?? 0}/3 used · 14-day freeze
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.55rem', letterSpacing: '2px', color: 'var(--c-dark-silver)', marginBottom: '0.3rem' }}>REPLAY VIS</div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {['public', 'link', 'private'].map(v => (
                    <button
                      key={v}
                      onClick={() => setProfileReplay(v)}
                      style={{
                        padding: '0.2rem 0.45rem', fontSize: '0.6rem', letterSpacing: '1px', cursor: 'pointer',
                        border: `1px solid ${profileReplay === v ? 'var(--c-battery-blue)' : 'var(--c-slate-black)'}`,
                        background: profileReplay === v ? 'rgba(72,141,232,0.1)' : 'transparent',
                        color: profileReplay === v ? 'var(--c-battery-blue)' : 'var(--c-dark-silver)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  className="btn-quantum"
                  onClick={saveProfile}
                  disabled={profileSaving}
                  style={{ fontSize: '0.6rem', padding: '0.25rem 0.6rem', letterSpacing: '1px' }}
                >
                  {profileSaving ? 'SAVING…' : 'SAVE PROFILE'}
                </button>
                {profileMsg && (
                  <span style={{ fontSize: '0.6rem', letterSpacing: '1px', color: profileMsg.startsWith('✓') ? '#22c55e' : 'var(--c-cherry-red)' }}>
                    {profileMsg}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ComfyUI Generatd Telemetry Banner */}
          <div style={{ height: '180px', borderTop: '1px solid var(--c-slate-black)', background: '#0a0a0a', backgroundImage: `url(${bannerBg})`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem', position: 'relative' }}>
             <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)' }} />
             <span style={{ color: 'var(--c-white)', fontSize: '1rem', letterSpacing: '2px', zIndex: 1, textShadow: '0 0 5px var(--c-battery-blue)' }}>
              THE ARCH-NEXUS
            </span>
          </div>

        </section>

      </div>
    </>
  );
}

export default App;
