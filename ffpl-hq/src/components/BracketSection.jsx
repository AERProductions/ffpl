// Playoff bracket grouped by round (Quarterfinal → Semifinal → Final).
// Returns null when no matches have a bracket_round field set.
export function BracketSection({ matches, roster }) {
  const bracketMatches = matches.filter(m => m.bracket_round && m.bracket_round.trim() !== '');
  if (bracketMatches.length === 0) return null;

  const nameOf = (id) => {
    if (!id) return 'TBD';
    return (roster.find(r => r.id === id)?.ac_name || id).toUpperCase();
  };

  const rounds = {};
  for (const m of bracketMatches) {
    const r = m.bracket_round;
    if (!rounds[r]) rounds[r] = [];
    rounds[r].push(m);
  }

  const ROUND_ORDER = ['Quarterfinal', 'Semifinal', 'Final'];
  const sortedRounds = Object.keys(rounds).sort((a, b) => {
    const ia = ROUND_ORDER.findIndex(r => a.startsWith(r));
    const ib = ROUND_ORDER.findIndex(r => b.startsWith(r));
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return 0;
  });

  return (
    <div style={{ marginTop: '1.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--c-slate-black)' }}>
      <div style={{ fontSize: '0.45rem', letterSpacing: '3px', color: 'var(--c-battery-blue)', marginBottom: '1rem' }}>
        PLAYOFF BRACKET — {sortedRounds.length} ROUND{sortedRounds.length !== 1 ? 'S' : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {sortedRounds.map(round => (
          <div key={round}>
            <h3 style={{ fontSize: '0.7rem', letterSpacing: '3px', color: 'var(--c-battery-blue)', textTransform: 'uppercase', marginBottom: '0.6rem', borderBottom: '1px solid var(--c-slate-black)', paddingBottom: '0.3rem' }}>
              {round}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {rounds[round].map((m, i) => {
                const challName = nameOf(m.challenger_loadout);
                const defName   = nameOf(m.defender_loadout);
                const challWon  = m.winner && m.winner === m.challenger_loadout;
                const defWon    = m.winner && m.winner === m.defender_loadout;
                const pending   = m.status === 'queued' || m.status === 'running' || !m.winner;
                const mediaURL  = m.replay_url;
                return (
                  <div key={m.id || i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-slate-black)', borderRadius: 4, padding: '0.6rem 0.9rem', minWidth: '200px', flex: '0 0 auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{
                        fontSize: '0.75rem', letterSpacing: '1px', fontWeight: challWon ? 700 : 400,
                        color: challWon ? '#ffd700' : pending ? 'var(--c-light-silver)' : 'var(--c-dark-silver)',
                        textDecoration: defWon ? 'line-through' : 'none',
                      }}>
                        {challWon && <span style={{ color: '#ffd700', marginRight: '0.4rem' }}>▶</span>}
                        {challName}
                      </div>
                      <div style={{ fontSize: '0.55rem', color: 'var(--c-dark-silver)', letterSpacing: '2px', textAlign: 'center' }}>VS</div>
                      <div style={{
                        fontSize: '0.75rem', letterSpacing: '1px', fontWeight: defWon ? 700 : 400,
                        color: defWon ? '#ffd700' : pending ? 'var(--c-light-silver)' : 'var(--c-dark-silver)',
                        textDecoration: challWon ? 'line-through' : 'none',
                      }}>
                        {defWon && <span style={{ color: '#ffd700', marginRight: '0.4rem' }}>▶</span>}
                        {defName}
                      </div>
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: '0.55rem', letterSpacing: '1px', fontWeight: 700,
                        color: m.status === 'running' ? '#00ff80' : m.status === 'completed' ? 'var(--c-dark-silver)' : 'var(--c-battery-blue)',
                        textTransform: 'uppercase',
                      }}>
                        {m.status === 'running' ? '● LIVE' : m.status === 'completed' ? 'DONE' : m.status === 'invalidated' ? 'VOID' : 'UPCOMING'}
                      </span>
                      {mediaURL && (
                        <a href={mediaURL} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.6rem', color: 'var(--c-battery-blue)', letterSpacing: '1px', textDecoration: 'none' }}>▶ REPLAY</a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
