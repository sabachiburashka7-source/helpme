// Resolves API URLs across web and native.
//
// On web: relative paths work because the page is served from the same origin
//         as the /api routes — so we leave them as-is.
// On native (Android/iOS): there is no "origin", so we must prepend the
//         absolute Vercel URL configured in app.json -> extra.apiBaseUrl.

import { Platform } from 'react-native';
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
  if (Platform.OS === 'web') return path;
  // Native: prepend the base. Guard against double slashes.
  const base = readBase();
  if (!base) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return base.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
}
