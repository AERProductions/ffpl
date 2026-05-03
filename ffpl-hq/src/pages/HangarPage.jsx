import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import partsDb from '../data/parts_db.json';
import jpPartsDb from '../data/jp_parts_db.json';
import { TestMatchmaker, ExportColorSave, TileSpectatorWindows, CaptureACPreview } from '../wailsjs/go/main/App.js';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime.js';
import { useACLoadouts } from '../hooks/useLoadouts.js';
import { pb } from '../lib/pb.js';

const WEAPON_COLORS = ['BLACK', 'RED', 'YELLOW', 'GREEN', 'BLUE', 'WHITE'];
const FRAME_COLORS  = ['RED', 'YELLOW', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

export function HangarPage() {
  const { user, isCommissioner } = useOutletContext();
  const { loadouts, loading, reload: reloadLoadouts } = useACLoadouts();

  const canEditLoadout = (l) => isCommissioner || (user && user.id === l.user_id);

  const [selectedP1, setSelectedP1]   = useState('');
  const [selectedP2, setSelectedP2]   = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [matchResult, setMatchResult]  = useState(null);
  const [colorEdits, setColorEdits]    = useState({});
  const [csMsg, setCsMsg]              = useState({});
  const [acPreviews, setAcPreviews]    = useState({});
  const [previewBusy, setPreviewBusy]  = useState({});
  const [isTiling, setIsTiling]        = useState(false);
  const [tileMsg, setTileMsg]          = useState('');
  const [exportRegion, setExportRegion] = useState('JP');
  const [exportSlot, setExportSlot]    = useState(4);
  const [isExporting, setIsExporting]  = useState(false);
  const [exportMsg, setExportMsg]      = useState('');

  useEffect(() => {
    const handler = (raw) => {
      try {
        const res = JSON.parse(raw);
        setMatchResult(res);
        setIsSimulating(false);
        reloadLoadouts();
      } catch {}
    };
    EventsOn('ffpl:match_result', handler);
    return () => EventsOff('ffpl:match_result');
  }, [reloadLoadouts]);

  const getPart = (val, hashes, key, region) => {
    let id = null;
    if (val) {
      id = String(val).split(' - ')[0].trim();
    } else if (hashes && hashes[key] !== undefined) {
      id = String(hashes[key]);
    }
    if (!id || id === '0xFFFF' || id === '65535') return '---';
    const optionalSlots = ['Arm_R', 'Arm_L', 'Back_R', 'Back_L', 'Inside', 'Extension', 'Arm_R_Hangar', 'Arm_L_Hangar'];
    if (optionalSlots.includes(key) && id === '0') return '---';
    const db = region === 'JP' ? jpPartsDb : partsDb;
    return db[id]?.name || (val ? String(val).split(' - ')[1] : 'Unknown');
  };

  const hexToBGRA = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return ((0xFF * 0x1000000) + (r << 16) + (g << 8) + b) >>> 0;
  };

  const bgraToHex = (bgra) => {
    const b = (bgra) & 0xFF;
    const g = (bgra >> 8) & 0xFF;
    const r = (bgra >> 16) & 0xFF;
    return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
  };

  const getScheme = (l) =>
    colorEdits[l.id] ?? l.color_scheme ?? { weapon_main: 0, weapon_sec: 0, frame_main: 0, frame_sec: 0 };

  const onSchemeChange = (l, field, val) => {
    setColorEdits(prev => ({ ...prev, [l.id]: { ...getScheme(l), [field]: Number(val) } }));
    setCsMsg(prev => ({ ...prev, [l.id]: '' }));
  };

  const onCustomBGRAChange = (l, field, hex) => {
    const bgraVal = hex ? hexToBGRA(hex) : undefined;
    setColorEdits(prev => {
      const cur = { ...getScheme(l) };
      if (bgraVal !== undefined) cur[field] = bgraVal;
      else delete cur[field];
      return { ...prev, [l.id]: cur };
    });
    setCsMsg(prev => ({ ...prev, [l.id]: '' }));
  };

  const buildPPSTColorScheme = (colorScheme) => {
    const wc = colorScheme?.weapon_main ?? -1;
    return {
      WeaponColors: [wc, wc, wc, wc, wc],
      RGBBlocks:    [null, null, null, null, null],
    };
  };

  const saveColorScheme = async (l) => {
    const scheme = colorEdits[l.id];
    if (!scheme) return;
    try {
      await pb.collection('ac_loadouts').update(l.id, { color_scheme: scheme });
      setCsMsg(prev => ({ ...prev, [l.id]: '✓' }));
      reloadLoadouts();
    } catch {
      setCsMsg(prev => ({ ...prev, [l.id]: '✗' }));
    }
  };

  const capturePreview = async (l) => {
    setPreviewBusy(prev => ({ ...prev, [l.id]: true }));
    try {
      const b64 = await CaptureACPreview();
      setAcPreviews(prev => ({ ...prev, [l.id]: b64 }));
      if (user && canEditLoadout(l)) {
        const blob = await fetch(`data:image/png;base64,${b64}`).then(r => r.blob());
        const fd = new FormData();
        fd.append('preview', blob, 'ac_preview.png');
        await pb.collection('ac_loadouts').update(l.id, fd);
        reloadLoadouts();
      }
    } catch (err) {
      console.error('CaptureACPreview failed:', err);
    } finally {
      setPreviewBusy(prev => ({ ...prev, [l.id]: false }));
    }
  };

  const handleTestMatch = async () => {
    if (!selectedP1 || !selectedP2) return;
    setIsSimulating(true);
    try {
      const p1Obj = loadouts.find(l => l.id === selectedP1);
      const p2Obj = loadouts.find(l => l.id === selectedP2);
      await TestMatchmaker(p1Obj, p2Obj);
    } catch (e) {
      console.error(e);
      setIsSimulating(false);
    }
  };

  const handleTileSpectator = async () => {
    setIsTiling(true);
    setTileMsg('');
    try {
      const msg = await TileSpectatorWindows();
      setTileMsg(msg);
    } catch (e) {
      setTileMsg('✗ ' + (e?.message || String(e)));
    } finally {
      setIsTiling(false);
    }
  };

  const handleExportColorSave = async () => {
    if (!selectedP1 || !selectedP2) return;
    setIsExporting(true);
    setExportMsg('');
    try {
      const t1 = loadouts.find(l => l.id === selectedP1);
      const t2 = loadouts.find(l => l.id === selectedP2);
      await ExportColorSave(exportRegion, buildPPSTColorScheme(t1?.color_scheme), buildPPSTColorScheme(t2?.color_scheme), exportSlot);
      setExportMsg('✓ slot ' + exportSlot);
    } catch (e) {
      setExportMsg('✗ ' + (e?.message || String(e)));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="glass-panel" style={{ flex: 1 }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="title-header" style={{ color: 'var(--c-white)', border: 'none', margin: 0 }}>ACTIVE ROSTER</h2>
        <div style={{ color: 'var(--c-ice-blue)', fontSize: '0.9rem', letterSpacing: '1px' }}>TEAM CAPTAIN PRIVILEGES</div>
      </div>

      <div style={{ marginTop: '0.5rem', minHeight: '300px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', overflowY: 'auto' }}>
           {loading ? <p>Loading PocketBase...</p> : loadouts.map((l, i) => (
              <div key={i} className="list-item" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--c-slate-black)', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--c-slate-black)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--c-white)' }}>{l.ac_name || l.profile}</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {(() => {
                      const mode = l.pilot?.challenge_mode;
                      if (!mode) return null;
                      const expired = mode === 'vacation' && l.pilot?.vacation_until && new Date(l.pilot.vacation_until) < new Date();
                      const effective = expired ? 'open' : mode;
                      const color = effective === 'open' ? '#4caf50' : effective === 'vacation' ? '#ff9800' : 'var(--c-cherry-red)';
                      return (
                        <span style={{ fontSize: '0.5rem', letterSpacing: '1.5px', color, border: `1px solid ${color}`, borderRadius: '2px', padding: '0 0.25rem', lineHeight: '1.4' }}>
                          {effective.toUpperCase()}
                        </span>
                      );
                    })()}
                    <span style={{ fontSize: '0.65rem', color: 'var(--c-battery-blue)', letterSpacing: '1px' }}>{(l.team || 'UNALIGNED').toUpperCase()}</span>
                  </div>
                </div>

                {/* AC preview — session capture or PB-stored file */}
                {(() => {
                  const sessionB64 = acPreviews[l.id];
                  const pbPreviewURL = l.preview
                    ? `${pb.baseUrl}/api/files/ac_loadouts/${l.id}/${l.preview}?thumb=320x180`
                    : null;
                  const src = sessionB64 ? `data:image/png;base64,${sessionB64}` : pbPreviewURL;
                  return src
                    ? <img src={src} alt="AC preview" style={{ width: '100%', borderRadius: '3px', marginBottom: '0.4rem', border: '1px solid var(--c-slate-black)', objectFit: 'cover', maxHeight: '80px' }} />
                    : null;
                })()}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--c-dark-silver)' }}>
                  <div className="truncate"><span style={{color: 'var(--c-ice-blue)'}}>HD:</span> {getPart(l.parts_equipped?.Head, l.part_hashes, 'Head', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-ice-blue)'}}>CR:</span> {getPart(l.parts_equipped?.Core, l.part_hashes, 'Core', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-ice-blue)'}}>AR:</span> {getPart(l.parts_equipped?.Arms, l.part_hashes, 'Arms', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-ice-blue)'}}>LG:</span> {getPart(l.parts_equipped?.Legs, l.part_hashes, 'Legs', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-ice-blue)'}}>BS:</span> {getPart(l.parts_equipped?.Booster, l.part_hashes, 'Booster', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-ice-blue)'}}>FCS:</span> {getPart(l.parts_equipped?.FCS, l.part_hashes, 'FCS', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-ice-blue)'}}>GN:</span> {getPart(l.parts_equipped?.Generator, l.part_hashes, 'Generator', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-ice-blue)'}}>RD:</span> {getPart(l.parts_equipped?.Radiator, l.part_hashes, 'Radiator', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-cherry-red)'}}>RW:</span> {getPart(l.parts_equipped?.Arm_R, l.part_hashes, 'Arm_R', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-cherry-red)'}}>LW:</span> {getPart(l.parts_equipped?.Arm_L, l.part_hashes, 'Arm_L', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-cherry-red)'}}>BR:</span> {getPart(l.parts_equipped?.Back_R, l.part_hashes, 'Back_R', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-cherry-red)'}}>BL:</span> {getPart(l.parts_equipped?.Back_L, l.part_hashes, 'Back_L', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-cherry-red)'}}>IN:</span> {getPart(l.parts_equipped?.Inside, l.part_hashes, 'Inside', l.region)}</div>
                  <div className="truncate"><span style={{color: 'var(--c-cherry-red)'}}>EX:</span> {getPart(l.parts_equipped?.Extension, l.part_hashes, 'Extension', l.region)}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--c-dark-silver)', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--c-slate-black)' }}>
                   <span><span style={{color: 'var(--c-battery-blue)'}}>AI Base:</span> {l.base_traits?.Enemy_Base ?? l.ai_performance?.Enemy_Base ?? '---'}</span>
                   <span><span style={{color: 'var(--c-battery-blue)'}}>Ops:</span> {Array.isArray(l.ops_chips) ? l.ops_chips.length : (l.operations_grid ? l.operations_grid.length : 0)} Layers</span>
                   <span><span style={{color: 'var(--c-battery-blue)'}}>Hash:</span> {l.tamper_hash ? l.tamper_hash.slice(0, 12) + '…' : (l.tamperHash ? l.tamperHash.slice(0, 12) + '…' : '---')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--c-dark-silver)', marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px dashed var(--c-slate-black)' }}>
                   <span><span style={{color: '#22c55e'}}>W:</span> {l.wins ?? 0}</span>
                   <span><span style={{color: 'var(--c-cherry-red)'}}>L:</span> {l.losses ?? 0}</span>
                   <span><span style={{color: 'var(--c-dark-silver)'}}>D:</span> {l.draws ?? 0}</span>
                   <span><span style={{color: 'var(--c-ice-blue)'}}>Score:</span> {l.score ?? 0}</span>
                </div>

                {/* AC COLOR SCHEME + CAPTURE — only shown to the loadout owner or a Commissioner */}
                {canEditLoadout(l) && (() => {
                  const cs = getScheme(l);
                  const sel = { padding: '0.1rem', fontSize: '0.55rem', background: '#0a0a0a', color: 'var(--c-dark-silver)', border: '1px solid var(--c-slate-black)', borderRadius: '2px', flex: 1 };
                  const cpick = { width: '18px', height: '18px', padding: '0', border: 'none', cursor: 'pointer', background: 'none', flexShrink: 0 };
                  const colorRows = [
                    ['WM', 'weapon_main', 'custom_wm_bgra', false, WEAPON_COLORS],
                    ['WS', 'weapon_sec',  'custom_ws_bgra', false, WEAPON_COLORS],
                    ['FM', 'frame_main',  'custom_fm_bgra', true,  FRAME_COLORS],
                    ['FS', 'frame_sec',   'custom_fs_bgra', true,  FRAME_COLORS],
                  ];
                  return (
                    <div style={{ marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px dashed var(--c-slate-black)' }}>
                      {/* CAPTURE button — sends F12 to local PPSSPP, uploads PNG to PB */}
                      <button
                        onClick={() => capturePreview(l)}
                        disabled={previewBusy[l.id]}
                        title="Send F12 to your local PPSSPP and capture a screenshot as AC preview"
                        style={{ padding: '0.1rem 0.3rem', fontSize: '0.55rem', cursor: 'pointer', background: 'transparent', border: '1px solid var(--c-battery-blue)', color: 'var(--c-battery-blue)', borderRadius: '2px', letterSpacing: '1px', marginBottom: '0.3rem', opacity: previewBusy[l.id] ? 0.5 : 1 }}>
                        {previewBusy[l.id] ? 'CAPTURING…' : (acPreviews[l.id] || l.preview) ? '↺ RECAPTURE' : '📷 CAPTURE FROM PPSSPP'}
                      </button>
                      <div style={{ fontSize: '0.5rem', letterSpacing: '2px', color: 'var(--c-battery-blue)', marginBottom: '0.2rem', marginTop: '0.2rem' }}>AC COLOR</div>
                      {colorRows.map(([label, selField, bgraField, , opts]) => (
                        <div key={selField} style={{ display: 'grid', gridTemplateColumns: '1.2rem 1fr 18px', gap: '0.2rem', alignItems: 'center', marginBottom: '0.15rem' }}>
                          <span style={{ fontSize: '0.45rem', color: 'var(--c-dark-silver)', letterSpacing: '1px' }}>{label}</span>
                          <select style={sel} value={cs[selField] ?? 0} onChange={e => onSchemeChange(l, selField, e.target.value)} title={selField}>
                            {opts.map((n, idx) => <option key={idx} value={idx}>{n}</option>)}
                          </select>
                          <input
                            type="color"
                            style={cpick}
                            title={`Custom ${label} BGRA override (leave default to use game palette)`}
                            value={cs[bgraField] != null ? bgraToHex(cs[bgraField]) : '#000000'}
                            onChange={e => onCustomBGRAChange(l, bgraField, e.target.value)}
                          />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginTop: '0.2rem' }}>
                        <button onClick={() => saveColorScheme(l)} title="Save color scheme"
                          style={{ padding: '0.1rem 0.3rem', fontSize: '0.55rem', cursor: 'pointer', background: 'transparent', border: '1px solid var(--c-ice-blue)', color: 'var(--c-ice-blue)', borderRadius: '2px', letterSpacing: '1px' }}>
                          SET
                        </button>
                        {csMsg[l.id] && (
                          <span style={{ fontSize: '0.55rem', color: csMsg[l.id] === '✓' ? '#22c55e' : 'var(--c-cherry-red)' }}>{csMsg[l.id]}</span>
                        )}
                        <span style={{ fontSize: '0.4rem', color: 'var(--c-slate-black)', marginLeft: 'auto' }}>colour picker = custom BGRA override</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
           ))}
        </div>
      </div>

      {isCommissioner && (
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--c-slate-black)' }}>
        <h3 style={{ color: 'var(--c-battery-blue)', fontSize: '0.9rem', marginBottom: '1rem' }}>[ COMMISSIONER ] MATCH OPERATIONS</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <select className="btn-quantum" style={{ flex: 1, backgroundColor: '#0a0a0a', color: 'var(--c-dark-silver)', textAlign: 'left' }} value={selectedP1} onChange={(e) => setSelectedP1(e.target.value)}>
            <option value="">SELECT PLAYER 1...</option>
            {loadouts.map(l => <option key={l.id} value={l.id}>{l.ac_name || l.profile} [{(l.team || 'UNALIGNED').toUpperCase()}]</option>)}
          </select>
          <select className="btn-quantum" style={{ flex: 1, backgroundColor: '#0a0a0a', color: 'var(--c-dark-silver)', textAlign: 'left' }} value={selectedP2} onChange={(e) => setSelectedP2(e.target.value)}>
            <option value="">SELECT PLAYER 2...</option>
            {loadouts.map(l => <option key={l.id} value={l.id}>{l.ac_name || l.profile} [{(l.team || 'UNALIGNED').toUpperCase()}]</option>)}
          </select>
        </div>
        <button className="btn-quantum" style={{ width: '100%', borderColor: isSimulating ? 'var(--c-cherry-red)' : 'var(--c-ice-blue)' }} onClick={handleTestMatch} disabled={!selectedP1 || !selectedP2 || isSimulating}>
          {isSimulating ? "SIMULATION INSTANCE ACTIVE..." : "DISPATCH MATCH EXECUTOR"}
        </button>
        {matchResult && (
          <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', border: `1px solid ${matchResult.error ? 'var(--c-cherry-red)' : '#22c55e'}`, fontSize: '0.6rem', letterSpacing: '1px', color: matchResult.error ? 'var(--c-cherry-red)' : '#22c55e' }}>
            {matchResult.error
              ? `✗ MATCH ERROR: ${matchResult.error}`
              : matchResult.winnerID
                ? `◈ RESULT: ${matchResult.challengerName} vs ${matchResult.defenderName} — WINNER: ${matchResult.winnerID === matchResult.challengerID ? matchResult.challengerName : matchResult.defenderName}`
                : `= RESULT: ${matchResult.challengerName} vs ${matchResult.defenderName} — DRAW`
            }
          </div>
        )}
        <button
          className="btn-quantum"
          onClick={handleTileSpectator}
          disabled={isTiling}
          style={{ width: '100%', marginTop: '0.4rem', borderColor: 'var(--c-battery-blue)', fontSize: '0.75rem', letterSpacing: '2px' }}
        >
          {isTiling ? 'TILING…' : '⊞ TILE SPECTATOR VIEW'}
        </button>
        {tileMsg && (
          <div style={{ fontSize: '0.55rem', letterSpacing: '1px', marginTop: '0.2rem', color: tileMsg.startsWith('✗') ? 'var(--c-cherry-red)' : '#22c55e' }}>
            {tileMsg}
          </div>
        )}

        {/* EXPORT COLOR SAVE */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--c-slate-black)' }}>
          <div style={{ fontSize: '0.55rem', letterSpacing: '3px', color: 'var(--c-battery-blue)', marginBottom: '0.5rem' }}>[ EXPORT COLOR SAVE ]</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={exportRegion}
              onChange={e => setExportRegion(e.target.value)}
              style={{ padding: '0.2rem 0.4rem', fontSize: '0.6rem', background: '#0a0a0a', color: 'var(--c-dark-silver)', border: '1px solid var(--c-slate-black)', borderRadius: '2px' }}
            >
              <option value="JP">JP ROM</option>
              <option value="US">US ROM</option>
            </select>
            <span style={{ fontSize: '0.55rem', color: 'var(--c-dark-silver)', letterSpacing: '1px' }}>SLOT</span>
            <input
              type="number" min={1} max={5}
              value={exportSlot}
              onChange={e => setExportSlot(Number(e.target.value))}
              style={{ width: '2.5rem', padding: '0.2rem', fontSize: '0.6rem', background: '#0a0a0a', color: 'var(--c-dark-silver)', border: '1px solid var(--c-slate-black)', borderRadius: '2px', textAlign: 'center' }}
            />
            <button
              className="btn-quantum"
              onClick={handleExportColorSave}
              disabled={!selectedP1 || !selectedP2 || isExporting}
              style={{ flex: 1, fontSize: '0.6rem', padding: '0.2rem 0.5rem', letterSpacing: '1px', borderColor: 'var(--c-battery-blue)' }}
            >
              {isExporting ? 'WRITING…' : 'EXPORT TO SAVE'}
            </button>
            {exportMsg && (
              <span style={{ fontSize: '0.55rem', letterSpacing: '1px', color: exportMsg.startsWith('✓') ? '#22c55e' : 'var(--c-cherry-red)' }}>
                {exportMsg}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.4rem', color: 'var(--c-slate-black)', letterSpacing: '1px', marginTop: '0.3rem' }}>
            bakes T1/T2 colour schemes from P1/P2 selection into .ppst — no emulator required
          </div>
        </div>
      </div>
      )}
    </section>
  );
}
