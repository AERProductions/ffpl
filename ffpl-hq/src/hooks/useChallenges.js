import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pb.js';

/**
 * useChallenges — fetches and manages challenge records for the current pilot.
 *
 * @param {string[]} myLoadoutIds  All ac_loadouts IDs owned by the logged-in user.
 */
export function useChallenges(myLoadoutIds = []) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(false);
  const idsKey = myLoadoutIds.join(',');

  const fetchChallenges = useCallback(async () => {
    if (!myLoadoutIds.length) { setChallenges([]); return; }
    setLoading(true);
    try {
      // Build OR filter: find any challenge where I'm challenger OR defender.
      // PocketBase Relation fields accept plain ID string equality.
      const parts = myLoadoutIds.flatMap(id => [
        `challenger_id = '${id}'`,
        `defender_id = '${id}'`,
      ]);
      const records = await pb.collection('challenges').getFullList({
        filter: parts.join(' || '),
        sort: '-created',
        requestKey: null,
      });
      setChallenges(records);
    } catch (err) {
      if (!err.isAbort) console.error('[useChallenges] fetch error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    fetchChallenges();
    pb.collection('challenges').subscribe('*', () => fetchChallenges());
    return () => pb.collection('challenges').unsubscribe('*');
  }, [fetchChallenges]);

  /**
   * sendChallenge — validates anti-padding rules then POSTs a new challenges record.
   *
   * Rules enforced client-side (PB Rules handle server enforcement):
   *   1. Challenger must be lower-ranked (higher rank index) than defender.
   *   2. No more than 1 active (pending) outgoing challenge at a time.
   *   3. Max 3 outgoing challenges per 24 hours.
   *   4. 7-day cooldown per ordered pair (either direction).
   *
   * @param {string} challengerLoadoutId  ac_loadouts ID of the challenger (must be one of myLoadoutIds)
   * @param {string} defenderLoadoutId    ac_loadouts ID of the target
   * @param {number} challengerRankIdx    0-based rank index of challenger (higher = lower ranked)
   * @param {number} defenderRankIdx      0-based rank index of defender
   * @param {string} [matchFormat]        "1v1" or "5v5" (defaults to "5v5")
   */
  async function sendChallenge(challengerLoadoutId, defenderLoadoutId, challengerRankIdx, defenderRankIdx, matchFormat = '5v5') {
    if (challengerRankIdx <= defenderRankIdx) {
      throw new Error('Your AC must be ranked BELOW the target to issue a challenge.');
    }

    // Rule 2: One active outgoing challenge at a time.
    const activeOutgoing = challenges.filter(c =>
      c.challenger_id === challengerLoadoutId && c.status === 'pending',
    );
    if (activeOutgoing.length >= 1) {
      throw new Error('You already have a pending challenge. Wait for it to resolve or expire (24h).');
    }

    // Rule 3: Daily limit — max 3 per 24h.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const todayOutgoing = challenges.filter(c =>
      c.challenger_id === challengerLoadoutId && c.created > dayAgo,
    );
    if (todayOutgoing.length >= 3) {
      throw new Error('Daily challenge limit reached (3 per 24 hours).');
    }

    // Rule 4: 7-day cooldown per pair (either direction).
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const onCooldown = challenges.find(c => {
      const isPair =
        (c.challenger_id === challengerLoadoutId && c.defender_id === defenderLoadoutId) ||
        (c.challenger_id === defenderLoadoutId   && c.defender_id === challengerLoadoutId);
      return isPair && c.created > sevenDaysAgo;
    });
    if (onCooldown) {
      throw new Error('7-day cooldown active for this matchup.');
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await pb.collection('challenges').create({
      challenger_id: challengerLoadoutId,
      defender_id:   defenderLoadoutId,
      status:        'pending',
      expires_at:    expiresAt,
      match_format:  matchFormat === '1v1' ? '1v1' : '5v5',
    });
  }

  /**
   * respondToChallenge — defender accepts, declines, or abstains.
   * 'abstained' frees the challenger's outgoing slot for a second attempt.
   * On 'accepted', fires /queue-match so the automation server picks it up.
   */
  async function respondToChallenge(challengeId, response) {
    // response: 'accepted' | 'declined' | 'abstained'
    await pb.collection('challenges').update(challengeId, { status: response });

    if (response === 'accepted') {
      const challenge = challenges.find(c => c.id === challengeId);
      if (challenge) {
        const queueUrl = import.meta.env.VITE_QUEUE_URL || 'http://localhost:8091/queue-match';
        const apiKey   = import.meta.env.VITE_API_KEY   || '';
        const queueResp = await fetch(queueUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'X-FFPL-Key': apiKey } : {}),
          },
          body: JSON.stringify({
            challenger_id: challenge.challenger_id,
            defender_id:   challenge.defender_id,
            challenge_id:  challengeId,
            match_format:  challenge.match_format || '5v5',
          }),
        });
        if (!queueResp.ok) {
          const j = await queueResp.json().catch(() => ({}));
          // Roll back the PB status so the challenge stays pending and can be retried.
          await pb.collection('challenges').update(challengeId, { status: 'pending' }).catch(() => {});
          throw new Error(j.error || `Queue server returned ${queueResp.status}`);
        }
      }
    }
  }

  const outgoing = challenges.filter(c => myLoadoutIds.includes(c.challenger_id));
  const incoming = challenges.filter(c => myLoadoutIds.includes(c.defender_id));

  return {
    challenges,
    outgoing,
    incoming,
    loading,
    sendChallenge,
    respondToChallenge,
    reload: fetchChallenges,
  };
}
