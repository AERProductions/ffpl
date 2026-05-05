import { useState, useEffect } from 'react';
import { GetAppMode } from '../wailsjs/go/main/App.js';

// useAppMode — resolves the current runtime mode for UI gating.
//
// Modes (resolved in priority order):
//   "host"        — isDesktop && hasAdminKey (league operator running the matchmaker)
//   "commissioner"— isDesktop && isCommissioner (licensed operator, no admin key)
//   "architect"   — isDesktop, regular logged-in player
//   "web"         — browser / shim context (isDesktop = false)
//
// Usage:
//   const { mode, isDesktop, hasAdminKey, version } = useAppMode(isCommissioner);
//
// `isCommissioner` comes from useAuth() — pass it in so this hook doesn't
// duplicate the auth logic.
export function useAppMode(isCommissioner = false) {
  const [modeInfo, setModeInfo] = useState({
    mode: 'web',
    isDesktop: false,
    hasAdminKey: false,
    version: '2.0.26',
  });

  useEffect(() => {
    GetAppMode()
      .then(info => {
        setModeInfo(prev => ({ ...prev, ...info, mode: resolveMode(info, isCommissioner) }));
      })
      .catch(() => {
        // GetAppMode failed — running in pure browser context
        setModeInfo(prev => ({ ...prev, mode: 'web' }));
      });
  }, []);

  // Re-resolve mode whenever commissioner status changes (async login)
  useEffect(() => {
    setModeInfo(prev => ({ ...prev, mode: resolveMode(prev, isCommissioner) }));
  }, [isCommissioner]);

  return modeInfo;
}

function resolveMode(info, isCommissioner) {
  if (!info.isDesktop) return 'web';
  if (info.hasAdminKey) return 'host';
  if (isCommissioner)   return 'commissioner';
  return 'architect';
}
