// VOD archive grid. Returns null when no matches have vod_url or replay_url.
export function VodSection({ matches, roster }) {
  const withVods = matches.filter(m => m.vod_url || m.replay_url);

  if (withVods.length === 0) return null;

  const nameOf = (id) => {
    if (!id) return 'TBD';
    return (roster.find(r => r.id === id)?.ac_name || id).toUpperCase();
  };

  return (
    <div style={{ marginTop: '1.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--c-slate-black)' }}>
      <div style={{ fontSize: '0.45rem', letterSpacing: '3px', color: 'var(--c-battery-blue)', marginBottom: '1rem' }}>
        VOD ARCHIVE — {withVods.length} VIDEO{withVods.length !== 1 ? 'S' : ''}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {withVods.map((m, i) => {
          const url   = m.vod_url || m.replay_url;
          const label = m.replay_url && !m.vod_url ? '▶ WATCH REPLAY' : '▶ WATCH VOD';
          const chall = nameOf(m.challenger_loadout || m.p1);
          const def   = nameOf(m.defender_loadout   || m.p2);
          return (
            <a
              key={m.id || i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-panel"
              style={{ display: 'block', textDecoration: 'none', transition: 'border-color 0.2s' }}
            >
              <div style={{ fontSize: '0.65rem', color: 'var(--c-dark-silver)', letterSpacing: '2px', marginBottom: '0.5rem' }}>
                {m.date || m.created ? new Date(m.date || m.created).toLocaleDateString() : '—'}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--c-white)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {chall} vs {def}
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--c-cherry-red)', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 700 }}>
                {label}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
