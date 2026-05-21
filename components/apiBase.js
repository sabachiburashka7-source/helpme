// Resolves API URLs by prepending the Vercel backend URL configured in
// app.json -> extra.apiBaseUrl. The native app has no "origin", so every
// /api/... path must be absolute.

import Constants from 'expo-constants';

function readBase() {
  const extra =
    (Constants.expoConfig && Constants.expoConfig.extra) ||
    (Constants.manifest && Constants.manifest.extra) ||
    {};
  return extra.apiBaseUrl || '';
}

export function apiUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = readBase();
  if (!base) return path;
  return base.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
}
