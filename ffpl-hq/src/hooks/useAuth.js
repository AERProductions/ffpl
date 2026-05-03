import { useState, useEffect } from 'react';
import { pb } from '../lib/pb.js';
import { IsCommissioner } from '../wailsjs/go/main/App.js';

// useAuth — reactive PocketBase auth state with FFPL role awareness.
//
// Commissioner status is resolved from TWO sources (either is sufficient):
//   1. PocketBase `role` field = "commissioner"  (set via PB admin collections UI)
//   2. commissioners.json (workspace root) — add your email there as a fallback
//      when the PB admin UI doesn't expose role editing for the admin account.
//
// Usage:
//   const { user, isCommissioner, login, logout } = useAuth();
export function useAuth() {
  const [user, setUser] = useState(pb.authStore.isValid ? pb.authStore.model : null);
  const [isCommissioner, setIsCommissioner] = useState(false);

  // Re-check commissioner status whenever the logged-in user changes.
  useEffect(() => {
    if (!user?.email) {
      setIsCommissioner(false);
      return;
    }

    // Owner bypass: commissioners.json entries skip all license checks.
    // IsCommissioner is Wails-only; guard with try/catch for browser context.
    IsCommissioner(user.email)
      .then(isOwner => {
        if (isOwner) { setIsCommissioner(true); return; }
        return checkLicensedCommissioner(user);
      })
      .catch(() => checkLicensedCommissioner(user));
  }, [user]);

  // Verify role === "commissioner" AND an active non-suspended license exists.
  async function checkLicensedCommissioner(u) {
    if ((u?.role ?? 'architect') !== 'commissioner') {
      setIsCommissioner(false);
      return;
    }
    try {
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const licenses = await pb.collection('commissioner_licenses').getFullList({
        filter: `user_id = '${u.id}' && is_suspended = false && valid_until >= '${now}'`,
        requestKey: null,
      });
      setIsCommissioner(licenses.length > 0);
    } catch {
      setIsCommissioner(false);
    }
  }

  useEffect(() => {
    // PocketBase fires the onChange callback on every auth state change.
    const unsub = pb.authStore.onChange((token, model) => {
      setUser(model ?? null);
    });
    return () => unsub();
  }, []);

  const login = async (email, password) => {
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData.record;
  };

  const logout = () => {
    pb.authStore.clear();
  };

  const role = user?.role ?? 'architect';

  return { user, role, isCommissioner, login, logout };
}
