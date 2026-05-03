import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { pb } from '../lib/pb.js';

const TYPE_COLOR = {
  tournament:  'var(--c-ice-blue)',
  challenge:   '#4caf50',
  maintenance: 'var(--c-dark-silver)',
  announcement:'#ff9800',
};

const TYPE_GLYPH = {
  tournament:  '◈',
  challenge:   '⚔',
  maintenance: '⚙',
  announcement:'◆',
};

export function CalendarPage() {
  const { user, isCommissioner } = useOutletContext();
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Create-event form state (commissioner only)
  const [showForm,    setShowForm]    = useState(false);
  const [evTitle,     setEvTitle]     = useState('');
  const [evDesc,      setEvDesc]      = useState('');
  const [evType,      setEvType]      = useState('tournament');
  const [evStartsAt,  setEvStartsAt]  = useState('');
  const [evEndsAt,    setEvEndsAt]    = useState('');
  const [evMaxSlots,  setEvMaxSlots]  = useState('');
  const [formError,   setFormError]   = useState('');
  const [formSaving,  setFormSaving]  = useState(false);

  async function fetchEvents() {
    try {
      const records = await pb.collection('events').getFullList({
        sort: 'starts_at',
        requestKey: null,
      });
      setEvents(records);
    } catch (err) {
      if (!err.isAbort) console.error('[CalendarPage]', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    pb.collection('events').subscribe('*', fetchEvents);
    return () => pb.collection('events').unsubscribe('*');
  }, []);

  async function handleCreateEvent(e) {
    e.preventDefault();
    setFormError('');
    setFormSaving(true);
    try {
      await pb.collection('events').create({
        title:      evTitle.trim(),
        description:evDesc.trim(),
        type:       evType,
        starts_at:  evStartsAt || null,
        ends_at:    evEndsAt   || null,
        max_slots:      evMaxSlots ? parseInt(evMaxSlots, 10) : null,
        commissioner_id: user?.id ?? '',
      });
      setEvTitle(''); setEvDesc(''); setEvStartsAt(''); setEvEndsAt(''); setEvMaxSlots('');
      setShowForm(false);
    } catch (err) {
      setFormError(err.message || 'Failed to create event.');
    } finally {
      setFormSaving(false);
    }
  }

  const now = new Date();
  const upcoming = events.filter(e => !e.ends_at || new Date(e.ends_at) >= now);
  const past     = events.filter(e => e.ends_at  && new Date(e.ends_at)  <  now);

  return (
    <section className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="title-header" style={{ color: 'var(--c-white)', border: 'none', margin: 0 }}>CALENDAR</h2>
        {isCommissioner && (
          <button
            className="btn-quantum"
            style={{ fontSize: '0.5rem', padding: '0.2rem 0.5rem', borderColor: '#ff9800', color: '#ff9800' }}
            onClick={() => setShowForm(s => !s)}
          >
            {showForm ? '— CANCEL' : '+ NEW EVENT'}
          </button>
        )}
      </div>

      {/* Commissioner create-event form */}
      {showForm && isCommissioner && (
        <form onSubmit={handleCreateEvent} style={{
          marginBottom: '1rem', padding: '0.75rem',
          background: 'rgba(255,152,0,0.06)', border: '1px solid rgba(255,152,0,0.3)',
          borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}>
          <div style={{ fontSize: '0.45rem', letterSpacing: '2px', color: '#ff9800', marginBottom: '0.25rem' }}>
            CREATE EVENT
          </div>
          <CalFormRow label="TITLE">
            <input required value={evTitle} onChange={e => setEvTitle(e.target.value)} maxLength={80} style={calInputStyle} placeholder="Event name..." />
          </CalFormRow>
          <CalFormRow label="TYPE">
            <select value={evType} onChange={e => setEvType(e.target.value)} style={calInputStyle}>
              <option value="tournament">TOURNAMENT</option>
              <option value="challenge">CHALLENGE WINDOW</option>
              <option value="maintenance">MAINTENANCE</option>
              <option value="announcement">ANNOUNCEMENT</option>
            </select>
          </CalFormRow>
          <CalFormRow label="STARTS">
            <input type="datetime-local" value={evStartsAt} onChange={e => setEvStartsAt(e.target.value)} style={calInputStyle} />
          </CalFormRow>
          <CalFormRow label="ENDS">
            <input type="datetime-local" value={evEndsAt} onChange={e => setEvEndsAt(e.target.value)} style={calInputStyle} />
          </CalFormRow>
          <CalFormRow label="MAX SLOTS">
            <input type="number" min="2" max="256" value={evMaxSlots} onChange={e => setEvMaxSlots(e.target.value)} style={{ ...calInputStyle, width: '6rem' }} placeholder="—" />
          </CalFormRow>
          <CalFormRow label="DESCRIPTION">
            <textarea value={evDesc} onChange={e => setEvDesc(e.target.value)} maxLength={500} rows={2} style={{ ...calInputStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Optional details..." />
          </CalFormRow>
          {formError && (
            <div style={{ fontSize: '0.5rem', color: 'var(--c-cherry-red)', letterSpacing: '1px' }}>{formError}</div>
          )}
          <button type="submit" disabled={formSaving} className="btn-quantum"
            style={{ alignSelf: 'flex-start', borderColor: '#4caf50', color: '#4caf50', opacity: formSaving ? 0.5 : 1 }}>
            {formSaving ? 'POSTING...' : 'POST EVENT'}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: 'var(--c-dark-silver)', fontSize: '0.8rem' }}>Loading events...</p>
      ) : events.length === 0 ? (
        <p style={{ color: 'var(--c-dark-silver)', fontSize: '0.7rem', letterSpacing: '1px' }}>[i] No events scheduled.</p>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
          {upcoming.length > 0 && (
            <>
              <div style={sectionLabel}>UPCOMING</div>
              {upcoming.map(ev => <EventRow key={ev.id} ev={ev} />)}
            </>
          )}
          {past.length > 0 && (
            <>
              <div style={{ ...sectionLabel, marginTop: '1rem', color: 'var(--c-slate-black)' }}>PAST</div>
              {past.map(ev => <EventRow key={ev.id} ev={ev} dimmed />)}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function EventRow({ ev, dimmed = false }) {
  const color  = TYPE_COLOR[ev.type] || 'var(--c-dark-silver)';
  const glyph  = TYPE_GLYPH[ev.type] || '◇';
  const starts = ev.starts_at ? fmtDate(ev.starts_at) : null;
  const ends   = ev.ends_at   ? fmtDate(ev.ends_at)   : null;
  const isLive = ev.starts_at && ev.ends_at
    && new Date() >= new Date(ev.starts_at) && new Date() < new Date(ev.ends_at);

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      padding: '0.5rem 0.5rem',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      opacity: dimmed ? 0.45 : 1,
    }}>
      {/* Date column */}
      <div style={{ minWidth: '4.5rem', fontSize: '0.5rem', letterSpacing: '1px', color: 'var(--c-dark-silver)', paddingTop: '0.1rem', textAlign: 'right' }}>
        {starts && <div>{starts}</div>}
        {ends   && <div style={{ color: 'var(--c-slate-black)' }}>→ {ends}</div>}
      </div>

      {/* Type glyph */}
      <div style={{ color, fontSize: '0.75rem', lineHeight: 1.2, paddingTop: '0.05rem' }}>{glyph}</div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--c-white)', fontSize: '0.65rem', letterSpacing: '1px' }}>{ev.title}</span>
          {isLive && (
            <span style={{ fontSize: '0.4rem', letterSpacing: '2px', color: '#4caf50', border: '1px solid #4caf50', borderRadius: '2px', padding: '0.05rem 0.2rem' }}>LIVE</span>
          )}
          {ev.max_slots && (
            <span style={{ fontSize: '0.4rem', letterSpacing: '1px', color: 'var(--c-dark-silver)' }}>{ev.max_slots} SLOTS</span>
          )}
        </div>
        {ev.description && (
          <div style={{ fontSize: '0.5rem', color: 'var(--c-dark-silver)', letterSpacing: '0.5px', marginTop: '0.15rem', whiteSpace: 'pre-wrap' }}>
            {ev.description}
          </div>
        )}
      </div>

      {/* Type badge */}
      <div style={{ fontSize: '0.4rem', letterSpacing: '1px', color, minWidth: '4rem', textAlign: 'right', paddingTop: '0.1rem' }}>
        {(ev.type || '').toUpperCase()}
      </div>
    </div>
  );
}

function CalFormRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
      <label style={{ fontSize: '0.4rem', letterSpacing: '2px', color: 'var(--c-dark-silver)', minWidth: '5rem', paddingTop: '0.4rem' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const sectionLabel = {
  fontSize: '0.4rem', letterSpacing: '3px', color: 'var(--c-battery-blue)',
  padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--c-slate-black)',
  marginBottom: '0.1rem',
};

const calInputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--c-slate-black)',
  borderRadius: '3px',
  color: 'var(--c-white)',
  fontSize: '0.6rem',
  letterSpacing: '1px',
  padding: '0.3rem 0.45rem',
  outline: 'none',
  flex: 1,
  boxSizing: 'border-box',
  colorScheme: 'dark',
};

