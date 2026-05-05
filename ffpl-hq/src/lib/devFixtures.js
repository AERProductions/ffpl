// Dev-mode offline fixtures — used by useACLoadouts() when PocketBase is
// unreachable (e.g. running wails dev without a local PB instance).
// Shape matches the ac_loadouts + pilot_profiles join that useACLoadouts builds.

export const DEV_LOADOUTS = [
  {
    id:         'dev-001',
    ac_name:    'IRON REGENT',
    team:       'FFPLTEAM',
    region:     'US',
    created:    '2026-01-10 09:00:00',
    updated:    '2026-01-10 09:00:00',
    parts:      {},
    pilot: {
      id:                     'dp-001',
      ac_name:                'IRON REGENT',
      loadout_id:             'dev-001',
      challenge_mode:         'open',
      replay_visibility:      'public',
      vacation_used_this_year: 0,
    },
  },
  {
    id:         'dev-002',
    ac_name:    'VELVET WRAITH',
    team:       'GHOST FRAME',
    region:     'JP',
    created:    '2026-01-12 11:30:00',
    updated:    '2026-01-12 11:30:00',
    parts:      {},
    pilot: {
      id:                     'dp-002',
      ac_name:                'VELVET WRAITH',
      loadout_id:             'dev-002',
      challenge_mode:         'ascending',
      replay_visibility:      'link',
      vacation_used_this_year: 1,
    },
  },
  {
    id:         'dev-003',
    ac_name:    'CINDER MARCH',
    team:       'FORGE BLOC',
    region:     'US',
    created:    '2026-01-15 14:00:00',
    updated:    '2026-01-15 14:00:00',
    parts:      {},
    pilot: null,
  },
  {
    id:         'dev-004',
    ac_name:    'NULL VECTOR',
    team:       'AXIOM CORE',
    region:     'JP',
    created:    '2026-01-18 08:45:00',
    updated:    '2026-01-18 08:45:00',
    parts:      {},
    pilot: {
      id:                     'dp-004',
      ac_name:                'NULL VECTOR',
      loadout_id:             'dev-004',
      challenge_mode:         'vacation',
      replay_visibility:      'private',
      vacation_used_this_year: 2,
    },
  },
];
