// Public read-only commissioner announcement feed.
// Returns null when there are no posts — CalendarPage renders it conditionally.
export function AnnouncementsSection({ announcements }) {
  if (!announcements || announcements.length === 0) return null;

  const fmt = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  return (
    <div style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--c-slate-black)' }}>
      <div style={{ fontSize: '0.45rem', letterSpacing: '3px', color: '#ff9800', marginBottom: '0.6rem' }}>
        LEAGUE ANNOUNCEMENTS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {announcements.map((a, i) => (
          <div key={a.id || i} style={{
            background: 'rgba(255,152,0,0.05)',
            border: '1px solid rgba(255,152,0,0.15)',
            borderRadius: '3px',
            padding: '0.75rem 1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.5rem', letterSpacing: '2px', color: '#ff9800', fontWeight: 700 }}>
                FFPL COMMISSIONER
              </span>
              <span style={{ fontSize: '0.5rem', color: 'var(--c-dark-silver)', letterSpacing: '1px' }}>
                {fmt(a.created)}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--c-light-silver)', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
              {a.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
