import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pb.js';

export function useACLoadouts() {
  const [loadouts, setLoadouts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const fetchLoadouts = useCallback(async () => {
    try {
      const [records, profiles] = await Promise.all([
        pb.collection('ac_loadouts').getFullList({ sort: '-created', requestKey: null }),
        pb.collection('pilot_profiles').getFullList({ requestKey: null }).catch(() => []),
      ]);

      // Build loadout_id → profile map. PB Relation field returns the referenced
      // record's ID as a plain string, so we key on that directly.
      const profileMap = {};
      for (const p of profiles) {
        if (p.loadout_id) profileMap[p.loadout_id] = p;
      }

      setLoadouts(records.map(r => ({ ...r, pilot: profileMap[r.id] || null })));
      setError(null);
    } catch (err) {
      if (!err.isAbort) {
        console.error('Data fetch error:', err);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoadouts();

    // Re-fetch on any change to either collection so challenge-mode badges stay live.
    pb.collection('ac_loadouts').subscribe('*', () => fetchLoadouts());
    pb.collection('pilot_profiles').subscribe('*', () => fetchLoadouts());

    return () => {
      pb.collection('ac_loadouts').unsubscribe('*');
      pb.collection('pilot_profiles').unsubscribe('*');
    };
  }, [fetchLoadouts]);

  return { loadouts, loading, error, reload: fetchLoadouts };
}
