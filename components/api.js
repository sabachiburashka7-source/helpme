// Every call to the Kheli server goes through apiFetch, so the session token
// from sign-in and this build's number ride along on each request without
// any screen having to think about them.
//
// The server works out who is asking from the token alone - a phone number
// in the body is ignored - so there is nothing else for callers to send.

import Constants from 'expo-constants';
import { apiUrl } from './apiBase';

const BUILD = String(Constants.expoConfig?.android?.versionCode || '');

let sessionToken = null;
let handlers = { onSessionEnded: null, onUpdateRequired: null };

export function setSessionToken(token) {
  sessionToken = token || null;
}

export function hasSession() {
  return Boolean(sessionToken);
}

// onSessionEnded: the server no longer accepts this sign-in (signed out
// elsewhere, account deleted, idle too long). onUpdateRequired: this build
// is too old for the server.
export function setApiHandlers(next) {
  handlers = { ...handlers, ...next };
}

// Resolves to { ok, status, data } and only rejects on a network failure.
// `auth: false` is for the sign-in calls, which have no session yet - and
// whose 401 means "wrong code", not "signed out".
export async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (BUILD) headers['X-Kheli-Build'] = BUILD;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const sentToken = auth ? sessionToken : null;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

  const r = await fetch(apiUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));

  if (r.status === 401 && data?.code === 'session_invalid' && sentToken && sentToken === sessionToken) {
    handlers.onSessionEnded?.();
  } else if (r.status === 426 && data?.code === 'update_required') {
    handlers.onUpdateRequired?.();
  }
  return { ok: r.ok, status: r.status, data };
}
