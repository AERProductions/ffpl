import PocketBase from 'pocketbase';

// VITE_PB_URL — set in .env for local dev, .env.production.local for web build.
// Production: https://ffplhq.com/pb  (PHP reverse proxy on Hostinger)
const PB_URL = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);

export const isAuthenticated = () => pb.authStore.isValid;
export const logout = () => pb.authStore.clear();
