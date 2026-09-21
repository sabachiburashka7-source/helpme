// Kheli backend on Cloudflare Workers.
//
// Replaces the previous Vercel functions (api/auth.js, api/offers.js,
// api/generate-image.js, api/privacy.js, api/delete-account.js,
// api/update-offer.js) and swaps Supabase Postgres for D1.
//
// Routes are kept byte-identical to the Vercel ones so the app needs no
// change beyond its base URL:
//   POST   /api/auth
//   GET    /api/offers            POST /api/offers
//   DELETE /api/offers            PATCH /api/offers
//   PATCH  /api/update-offer
//   POST   /api/generate-image
// Plus the moderation pair required by Google Play's UGC policy:
//   POST   /api/report
//   GET    /api/blocks            POST /api/blocks       DELETE /api/blocks
//   GET    /privacy   /api/privacy
//   GET    /delete-account  /api/delete-account
// Plus one new route that replaces Supabase Storage:
//   GET    /api/image/<id>.png    generated illustrations, served from KV
//
// Who is calling: verify_code returns a session `token`, and every other
// request sends it as `Authorization: Bearer <token>`. The caller's phone is
// read from the session, never from the body, and offers can only be changed
// by their owner. See "Who is asking" below, including the short legacy
// window for builds 11/12, which predate tokens.

// These are plain .html files, pulled in as strings by the "Text" rule in
// wrangler.jsonc. Edit them as normal HTML - no escaping needed.
import PRIVACY_HTML from './privacy.html';
import DELETE_ACCOUNT_HTML from './delete-account.html';

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

const POST_QUOTA = { free: 3, pro: 15 };

// How many *distinct* people must report one offer before it drops out of
// everyone else's Browse feed. The unique index on
// reports (offer_id, reporter_phone) is what makes "distinct" true, so a
// plain COUNT(*) is safe here. Three is low enough to pull something
// genuinely bad quickly, high enough that one person with a grudge cannot
// take a listing down on their own.
const REPORT_HIDE_THRESHOLD = 3;

// Free-text reasons would arrive unbounded and unsortable. The app sends one
// of these keys and localises the label itself; anything else is rejected.
const REPORT_REASONS = new Set([
  'spam',
  'scam',
  'offensive',
  'sexual',
  'violence',
  'illegal',
  'other',
]);

// Photos attached to a request, as the app's picker allows.
const MAX_OFFER_IMAGES = 6;

/* ------------------------------------------------------------------ *
 * Who is asking
 *
 * Signing in (send_code + verify_code) proves someone owns a phone number.
 * verify_code then hands the app a random session token, and every request
 * that reads private data or changes anything must send it back as
 * `Authorization: Bearer <token>`. The caller's phone number comes from that
 * session - never from the request body, which anyone can fill in.
 * ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;

// A session nobody has used for this long is dropped, and the app asks the
// person to sign in again.
const SESSION_IDLE_DAYS = 180;

// Builds 11 and 12 were released before session tokens and never send one.
// Until this moment they may still load the feed, and post, illustrate and
// delete their own requests the old way - but only for accounts that have
// never used a token (see acceptsLegacy). After it, a request without a
// token is refused and those builds have to update. A LEGACY_WRITES_UNTIL
// variable (ISO date) on the Worker overrides this, e.g. to end it sooner.
const LEGACY_WRITES_UNTIL = '2026-10-01T00:00:00Z';

// Oldest build allowed to use the API. The app sends its build number in
// X-Kheli-Build; anything older gets 426 and an "update Kheli" prompt.
// Raise this to force everyone onto a newer build.
const MIN_BUILD = 13;

// The TEST_PHONE code is checked here rather than by Twilio, so nothing else
// limits how many guesses someone gets at it. Wrong guesses are counted per
// network (an IPv4 address, or an IPv6 /64) and in total.
const TEST_OTP_FAILS_PER_NETWORK = 10; // per 15 minutes
const TEST_OTP_FAILS_TOTAL = 100; // per hour

// The shared reviewer account posts without the monthly cap, but not without
// any cap: if its code leaks, this is what stops it turning into unlimited
// illustrations billed to our OpenAI key.
const REVIEWER_POSTS_PER_DAY = 10;

// The six secrets are pre-created in the dashboard with this placeholder so
// the rows exist and can be edited without retyping their names. Until a real
// value replaces it, treat the secret as absent - otherwise a placeholder is
// a truthy string and the request fails deep inside Twilio/OpenAI with a
// confusing error instead of our clear "not configured" one.
const SECRET_PLACEHOLDER = 'REPLACE_ME';

function secret(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return !trimmed || trimmed === SECRET_PLACEHOLDER ? '' : trimmed;
}

function nowIso() {
  return new Date().toISOString();
}

function startOfMonthUtcIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function normalizePhone(input) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  return digits ? (hasPlus ? '+' : '') + digits : '';
}

function isE164(phone) {
  // Twilio Verify requires E.164: leading + and 8-15 digits total
  return /^\+\d{8,15}$/.test(phone);
}

// Effective tier: stored 'pro' only counts while subscription_expires_at is
// in the future. Anything else (including 'pro' past its expiry) is 'free'.
function effectiveTier(row) {
  if (!row || row.tier !== 'pro') return 'free';
  if (!row.subscription_expires_at) return 'free';
  return new Date(row.subscription_expires_at).getTime() > Date.now() ? 'pro' : 'free';
}

// The TEST_PHONE account is shared: Google's reviewers and every paid closed
// tester sign in as it, because none of them can receive a Georgian SMS. A
// 3-posts-a-month cap on one shared account is spent by the first tester and
// blocks everyone after them, so that phone skips the monthly quota (it has
// a daily ceiling instead - see REVIEWER_POSTS_PER_DAY).
function isReviewerPhone(env, phone) {
  const testPhone = normalizePhone(secret(env && env.TEST_PHONE));
  if (!testPhone) return false;
  return normalizePhone(phone) === testPhone;
}

// Shape every user response identically so the client always sees the same
// fields (id, phone, name, profile_image, tier, subscription_expires_at,
// post_limit).
function shapeUser(row, env) {
  if (!row) return null;
  const tier = effectiveTier(row);
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    profile_image: row.profile_image || null,
    tier,
    subscription_expires_at: row.subscription_expires_at || null,
    // The server owns the cap. null means "no monthly cap" (the shared
    // reviewer / closed-tester account). Clients built before this field
    // existed just ignore it and fall back to their own POST_QUOTA table.
    post_limit: isReviewerPhone(env, row.phone)
      ? null
      : (POST_QUOTA[tier] ?? POST_QUOTA.free),
  };
}

// D1 stores `images` as a JSON string; the app expects a real array. Every
// offer leaving this Worker goes through here so the shape matches what
// Supabase used to return.
function shapeOffer(row) {
  if (!row) return null;
  let images = [];
  if (typeof row.images === 'string' && row.images) {
    try {
      const parsed = JSON.parse(row.images);
      if (Array.isArray(parsed)) images = parsed;
    } catch {
      images = [];
    }
  } else if (Array.isArray(row.images)) {
    images = row.images;
  }
  return {
    id: row.id,
    description: row.description,
    price: row.price,
    location: row.location,
    category: row.category,
    name: row.name,
    avatar: row.avatar,
    phone: row.phone,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    profile_image: row.profile_image || null,
    images,
    image: row.image || null,
    created_at: row.created_at,
    // Only ever true on your own offers: the feed query filters everyone
    // else's hidden offers out entirely. Lets "My requests" say why a post
    // stopped appearing instead of leaving the owner to guess.
    hidden: Number(row.report_count || 0) >= REPORT_HIDE_THRESHOLD,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function html(body) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// Enough of a number to tell log lines apart, not enough to be the number.
function maskPhone(phone) {
  return phone ? `${phone.slice(0, 4)}...${phone.slice(-3)}` : '';
}

function initials(name) {
  return (name || '?').slice(0, 2).toUpperCase();
}

const IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,/i;

function isImageDataUrl(value) {
  return typeof value === 'string' && IMAGE_DATA_URL.test(value);
}

// The app's picker produces data: URLs. Anything else - a link to some
// other server - would make every viewer's phone fetch it, so it is dropped.
function sanitizeImages(images) {
  return Array.isArray(images) ? images.filter(isImageDataUrl).slice(0, MAX_OFFER_IMAGES) : [];
}

async function countOffersSince(db, phone, sinceIso) {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM offers WHERE phone = ? AND created_at >= ?')
    .bind(phone, sinceIso)
    .first();
  return row ? Number(row.n) : 0;
}

async function deleteIllustration(env, offerId) {
  if (!env.IMAGES || !offerId) return;
  const safeId = String(offerId).replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    await env.IMAGES.delete(safeId);
  } catch (err) {
    console.error('[image] delete failed', safeId, err && err.message);
  }
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Looks at every character whatever happens, so the response time says
// nothing about how much of a guess was right.
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return diff === 0;
}

// 401 with a code: the app signs the person out on `session_invalid`, which
// it must not do for the other 401 this API sends (a wrong SMS code).
function sessionInvalid() {
  return json({ error: 'Please sign in again.', code: 'session_invalid' }, 401);
}

// For builds too old for the API, and for requests without a session token
// once the legacy window is over. Builds 11/12 show `error` as it is, so it
// carries the app's default language as well as English.
function updateRequired() {
  return json(
    {
      error: 'განაახლეთ Kheli Google Play-დან. / Please update Kheli from Google Play.',
      code: 'update_required',
    },
    426
  );
}

function bearerToken(request) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('Authorization') || '');
  return match ? match[1] : '';
}

// The raw token goes to the app once; only its SHA-256 is stored, so reading
// the sessions table does not let anyone act as a user.
async function createSession(db, phone) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  // Housekeeping rides along with sign-ins: sessions idle past the limit,
  // and failure counts nobody will look at again.
  const idleCutoff = new Date(Date.now() - SESSION_IDLE_DAYS * DAY_MS).toISOString();
  const failureCutoff = new Date(Date.now() - DAY_MS).toISOString();
  await db.batch([
    db
      .prepare('INSERT INTO sessions (token_hash, phone, created_at, last_used_at) VALUES (?, ?, ?, NULL)')
      .bind(await sha256Hex(token), phone, nowIso()),
    db.prepare('DELETE FROM sessions WHERE COALESCE(last_used_at, created_at) < ?').bind(idleCutoff),
    db.prepare('DELETE FROM auth_failures WHERE created_at < ?').bind(failureCutoff),
  ]);
  return token;
}

// The live session behind a bearer token, or null if it is unknown or has
// sat idle too long.
async function findSession(db, token) {
  if (!token || token.length > 256) return null;
  const hash = await sha256Hex(token);
  const row = await db
    .prepare('SELECT token_hash, phone, created_at, last_used_at FROM sessions WHERE token_hash = ?')
    .bind(hash)
    .first();
  if (!row) return null;
  if (!(Date.now() - Date.parse(row.last_used_at || row.created_at) < SESSION_IDLE_DAYS * DAY_MS)) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  // One write a day keeps the idle clock honest. The first one also marks
  // this phone as being on a build that sends tokens (see acceptsLegacy).
  if (!row.last_used_at || Date.now() - Date.parse(row.last_used_at) > DAY_MS) {
    await db
      .prepare('UPDATE sessions SET last_used_at = ? WHERE token_hash = ?')
      .bind(nowIso(), hash)
      .run();
  }
  return row;
}

// { phone, session } for a valid token; { phone: null } when no token was
// sent at all; { response } when a token was sent but is no good - return
// that response as it is.
async function resolveCaller(request, env) {
  const token = bearerToken(request);
  if (!token) return { phone: null, session: null };
  const session = await findSession(env.DB, token);
  if (!session) return { response: sessionInvalid() };
  return { phone: session.phone, session };
}

function legacyWindowOpen(env) {
  const until = Date.parse(secret(env && env.LEGACY_WRITES_UNTIL) || LEGACY_WRITES_UNTIL);
  return Number.isFinite(until) && Date.now() < until;
}

// Whether a request without a token may still act for `phone`, the way
// builds 11/12 do. Only inside the legacy window, only for a real account,
// and never once that account has used a token: from then on it is on a
// build that sends one, so a token-less request for it can only be forged.
async function acceptsLegacy(env, phone) {
  if (!phone || !legacyWindowOpen(env)) return false;
  const row = await env.DB
    .prepare(
      `SELECT EXISTS (SELECT 1 FROM users WHERE phone = ?) AS has_account,
              EXISTS (SELECT 1 FROM sessions
                       WHERE phone = ? AND last_used_at IS NOT NULL) AS upgraded`
    )
    .bind(phone, phone)
    .first();
  return Boolean(row && row.has_account && !row.upgraded);
}

// null when `caller` may change `offer`, otherwise the response refusing it.
async function refuseUnlessOwner(env, caller, offer) {
  const owner = normalizePhone(offer.phone);
  if (caller.phone) {
    if (owner && owner === caller.phone) return null;
    return json({ error: 'You can only change your own requests' }, 403);
  }
  // Builds 11/12 send only the offer id here - no token, not even a phone.
  // Inside the legacy window that still works for owners who have never
  // used a token, which is the trust those builds always had.
  if (await acceptsLegacy(env, owner)) {
    console.log('[legacy] change offer', offer.id, maskPhone(owner));
    return null;
  }
  return updateRequired();
}

/* ------------------------------------------------------------------ *
 * Guess limit for the TEST_PHONE code
 * ------------------------------------------------------------------ */

// An IPv6 subscriber usually holds a whole /64, so guesses are counted per
// /64 - otherwise one phone could rotate through millions of addresses.
function networkOf(ip) {
  if (!ip) return 'unknown';
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (v4) return v4[1];
  const [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return `${groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

// Stored hashed: enough to count guesses from one network, not to say who.
async function failureKey(request) {
  const network = networkOf(request.headers.get('CF-Connecting-IP') || '');
  return `net:${(await sha256Hex(`kheli-otp|${network}`)).slice(0, 32)}`;
}

async function testOtpBlocked(db, key) {
  const row = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM auth_failures WHERE key = ? AND created_at >= ?) AS here,
              (SELECT COUNT(*) FROM auth_failures WHERE key = 'test-otp' AND created_at >= ?) AS total`
    )
    .bind(
      key,
      new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      new Date(Date.now() - 60 * 60 * 1000).toISOString()
    )
    .first();
  return (
    Number((row && row.here) || 0) >= TEST_OTP_FAILS_PER_NETWORK ||
    Number((row && row.total) || 0) >= TEST_OTP_FAILS_TOTAL
  );
}

async function recordTestOtpFailure(db, key) {
  const now = nowIso();
  await db.batch([
    db.prepare('INSERT INTO auth_failures (key, created_at) VALUES (?, ?)').bind(key, now),
    db.prepare("INSERT INTO auth_failures (key, created_at) VALUES ('test-otp', ?)").bind(now),
  ]);
}

/* ------------------------------------------------------------------ *
 * /api/auth
 * ------------------------------------------------------------------ */

async function handleAuth(request, env) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const db = env.DB;
  if (!db) return json({ error: 'Database not configured' }, 500);

  const twilioSid = secret(env.TWILIO_ACCOUNT_SID);
  const twilioToken = secret(env.TWILIO_AUTH_TOKEN);
  const twilioVerifySid = secret(env.TWILIO_VERIFY_SERVICE_SID);
  const twilioConfigured = Boolean(twilioSid && twilioToken && twilioVerifySid);

  async function twilioVerify(path, params) {
    const auth = btoa(`${twilioSid}:${twilioToken}`);
    const body = new URLSearchParams(params).toString();
    const fullUrl = `https://verify.twilio.com/v2/Services/${twilioVerifySid}${path}`;
    // The path only: params hold the number and, on a check, the SMS code.
    console.log('[auth] twilio ->', path);
    const r = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    console.log('[auth] twilio <-', r.status, r.ok ? data?.status || '' : data?.message || '');
    return { ok: r.ok, status: r.status, data };
  }

  async function findUser(phone) {
    return db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
  }

  async function createUser(phone, name, profileImage) {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO users (id, phone, name, profile_image, tier, subscription_expires_at, created_at)
         VALUES (?, ?, ?, ?, 'free', NULL, ?)`
      )
      .bind(id, phone, name, isImageDataUrl(profileImage) ? profileImage : null, nowIso())
      .run();
    return findUser(phone);
  }

  // The one place a session is born: the phone has just been proven.
  async function signedIn(row, status = 200) {
    const token = await createSession(db, row.phone);
    return json({ ...shapeUser(row, env), token }, status);
  }

  const body = await readJson(request);
  const { action, phone, code, intent, name, profile_image } = body;

  // Everything except signing in acts on an existing account, so it needs
  // the session token from verify_code. A phone in the body is ignored.
  if (ACCOUNT_ACTIONS.has(action)) {
    const caller = await resolveCaller(request, env);
    if (caller.response) return caller.response;
    if (!caller.phone) {
      if (action === 'logout') return json({ ok: true }); // nothing to revoke
      // Only builds 11/12 send these without a token. Old enough that they
      // must not be able to delete or change an account any more.
      return updateRequired();
    }
    return handleAccountAction(action, caller, body, env);
  }

  const cleanPhone = normalizePhone(phone);

  // Play Store review bypass: lets Google's reviewers (and our paid closed
  // testers, who cannot receive a Georgian SMS) log in without an SMS.
  // Activated only when both env vars are set and the inbound phone matches.
  // The OTP is checked locally instead of via Twilio Verify.
  const testPhone = normalizePhone(secret(env.TEST_PHONE));
  const testOtp = secret(env.TEST_OTP);
  const isTestPhone = Boolean(testPhone && testOtp && cleanPhone === testPhone);

  if (!isE164(cleanPhone)) {
    return json(
      { error: 'Enter a valid phone number with country code (e.g. +15551234567)' },
      400
    );
  }

  if (!twilioConfigured && !isTestPhone) {
    return json(
      {
        error:
          'SMS verification not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.',
      },
      500
    );
  }

  if (action === 'send_code') {
    const wantsRegister = intent === 'register';
    const wantsLogin = intent === 'login';
    if (!wantsRegister && !wantsLogin) {
      return json({ error: 'Unknown intent' }, 400);
    }

    if (isTestPhone) {
      console.log('[auth] test-phone send_code bypass');
      return json({ status: 'sent' });
    }

    const existing = await findUser(cleanPhone);
    const userExists = Boolean(existing);

    if (wantsRegister && userExists) {
      return json({ error: 'An account with this phone already exists' }, 409);
    }
    if (wantsLogin && !userExists) {
      return json({ error: 'No account found for this number' }, 404);
    }

    const sent = await twilioVerify('/Verifications', { To: cleanPhone, Channel: 'sms' });
    if (!sent.ok) {
      return json({ error: sent.data?.message || 'Could not send code. Try again.' }, sent.status);
    }
    return json({ status: 'sent' });
  }

  if (action === 'verify_code') {
    if (typeof code !== 'string' || !/^\d{4,10}$/.test(code.trim())) {
      return json({ error: 'Enter the code you received' }, 400);
    }
    const wantsRegister = intent === 'register';
    const wantsLogin = intent === 'login';
    if (!wantsRegister && !wantsLogin) {
      return json({ error: 'Unknown intent' }, 400);
    }

    if (isTestPhone) {
      console.log('[auth] test-phone verify_code bypass');
      // Twilio caps guesses at a real code; nothing caps them here but this.
      const guessKey = await failureKey(request);
      if (await testOtpBlocked(db, guessKey)) {
        return json({ error: 'Too many attempts. Wait a few minutes and try again.' }, 429);
      }
      if (!sameSecret(code.trim(), testOtp)) {
        await recordTestOtpFailure(db, guessKey);
        return json({ error: 'Incorrect or expired code' }, 401);
      }
      // Ensure-or-fetch: works for both register and login so a reviewer can
      // hit either flow without server-state coordination.
      const existingRow = await findUser(cleanPhone);
      if (existingRow) {
        return signedIn(existingRow);
      }
      const cleanName = (typeof name === 'string' && name.trim()) || 'Play Store Reviewer';
      const created = await createUser(cleanPhone, cleanName, profile_image);
      return signedIn(created, wantsRegister ? 201 : 200);
    }

    const checked = await twilioVerify('/VerificationCheck', {
      To: cleanPhone,
      Code: code.trim(),
    });
    if (!checked.ok) {
      return json({ error: checked.data?.message || 'Could not verify code' }, checked.status);
    }
    if (checked.data?.status !== 'approved') {
      return json({ error: 'Incorrect or expired code' }, 401);
    }

    if (wantsRegister) {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName) return json({ error: 'Enter your name' }, 400);

      const existing = await findUser(cleanPhone);
      if (existing) {
        return json({ error: 'An account with this phone already exists' }, 409);
      }
      const created = await createUser(cleanPhone, cleanName, profile_image);
      return signedIn(created, 201);
    }

    // login
    const row = await findUser(cleanPhone);
    if (!row) return json({ error: 'No account found for this number' }, 404);
    return signedIn(row);
  }

  return json({ error: 'Unknown action' }, 400);
}

// /api/auth actions that act on the caller's own account.
const ACCOUNT_ACTIONS = new Set([
  'me',
  'logout',
  'delete_account',
  'cancel_subscription',
  'update_profile_image',
]);

async function handleAccountAction(action, caller, body, env) {
  const db = env.DB;
  const phone = caller.phone;

  if (action === 'logout') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(caller.session.token_hash).run();
    return json({ ok: true });
  }

  if (action === 'delete_account') {
    // Illustrations first, while the offer rows still say which are theirs.
    const { results: owned } = await db
      .prepare('SELECT id FROM offers WHERE phone = ?')
      .bind(phone)
      .all();
    await Promise.all((owned || []).map((o) => deleteIllustration(env, o.id)));
    // One transaction. Deleting the account has to take the reports this
    // person filed and the blocks either side of them, or a "delete
    // everything about me" promise leaves their number in someone else's
    // block list - and it signs out every device on the account.
    await db.batch([
      db.prepare('DELETE FROM reports WHERE offer_id IN (SELECT id FROM offers WHERE phone = ?)').bind(phone),
      db.prepare('DELETE FROM offers WHERE phone = ?').bind(phone),
      db.prepare('DELETE FROM reports WHERE reporter_phone = ?').bind(phone),
      db.prepare('DELETE FROM blocks WHERE blocker_phone = ? OR blocked_phone = ?').bind(phone, phone),
      db.prepare('DELETE FROM users WHERE phone = ?').bind(phone),
      db.prepare('DELETE FROM sessions WHERE phone = ?').bind(phone),
    ]);
    console.log('[auth] account deleted', maskPhone(phone));
    return json({ ok: true });
  }

  const row = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
  // The account went away underneath the session (removed straight from the
  // database). The app signs out and the person can register again.
  if (!row) return sessionInvalid();

  if (action === 'me') {
    // Lightweight "who am I" used on app start to refresh the locally cached
    // user (tier may have changed since last login).
    return json(shapeUser(row, env));
  }

  if (action === 'cancel_subscription') {
    // Phase 1: manual / test downgrade. When Google Play Billing is live the
    // app deep-links to Google's "Manage subscription" screen instead - and
    // Google's RTDN webhook is what flips tier='free' here, not this action.
    await db
      .prepare(`UPDATE users SET tier = 'free', subscription_expires_at = NULL WHERE phone = ?`)
      .bind(phone)
      .run();
    return json(shapeUser({ ...row, tier: 'free', subscription_expires_at: null }, env));
  }

  if (action === 'update_profile_image') {
    const image = body.profile_image ?? null;
    if (image !== null && !isImageDataUrl(image)) {
      return json({ error: 'Invalid profile image' }, 400);
    }
    // The avatar on their existing offers follows, so Browse shows the new
    // photo without a repost.
    await db.batch([
      db.prepare('UPDATE users SET profile_image = ? WHERE phone = ?').bind(image, phone),
      db.prepare('UPDATE offers SET profile_image = ? WHERE phone = ?').bind(image, phone),
    ]);
    return json(shapeUser({ ...row, profile_image: image }, env));
  }

  return json({ error: 'Unknown action' }, 400);
}

/* ------------------------------------------------------------------ *
 * /api/offers
 * ------------------------------------------------------------------ */

async function handleOffers(request, env) {
  const db = env.DB;
  if (!db) return json({ error: 'Database not configured' }, 500);

  const caller = await resolveCaller(request, env);
  if (caller.response) return caller.response;

  if (request.method === 'GET') {
    // The viewer is whoever the session belongs to. Builds 11/12 read the
    // feed without one until the legacy window closes; their `?phone=` is
    // not trusted, so they get the public feed with no per-viewer filtering
    // (auto-hiding still applies). Afterwards the feed - which carries every
    // poster's number for the call button - is for signed-in people only.
    if (!caller.phone && !legacyWindowOpen(env)) return updateRequired();
    const viewer = caller.phone || '';

    // Four things happen in one statement so the feed stays a single round
    // trip: count reports per offer, drop offers by people the viewer has
    // blocked, drop offers the viewer has already reported, and drop offers
    // that crossed the report threshold for everyone. `report_count` rides
    // along so shapeOffer can mark the owner's own hidden posts.
    const sql = `
      SELECT o.*,
             (SELECT COUNT(*) FROM reports r WHERE r.offer_id = o.id) AS report_count
        FROM offers o
       WHERE (
               ? = ''
               OR o.phone IS NULL
               OR o.phone NOT IN (SELECT blocked_phone FROM blocks WHERE blocker_phone = ?)
             )
         -- Reporting something is also a request never to see it again.
         AND (
               ? = ''
               OR o.id NOT IN (SELECT offer_id FROM reports WHERE reporter_phone = ?)
             )
         AND (
               -- You always see your own posts, even once they are hidden
               -- from everyone else, so a request never just vanishes.
               (? <> '' AND o.phone = ?)
               OR (SELECT COUNT(*) FROM reports r WHERE r.offer_id = o.id) < ?
             )
       ORDER BY o.created_at DESC`;

    const { results } = await db
      .prepare(sql)
      .bind(viewer, viewer, viewer, viewer, viewer, viewer, REPORT_HIDE_THRESHOLD)
      .all();
    return json((results || []).map(shapeOffer));
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    const { description, price, location, category, latitude, longitude, images } = body;

    let phone = caller.phone;
    if (!phone) {
      const claimed = normalizePhone(body.phone);
      if (!(await acceptsLegacy(env, claimed))) return updateRequired();
      phone = claimed;
      console.log('[legacy] post', maskPhone(phone));
    }

    // Name, initials and photo come from the account, not the request, so a
    // post cannot go up under somebody else's name either.
    const account = await db
      .prepare('SELECT name, profile_image, tier, subscription_expires_at FROM users WHERE phone = ?')
      .bind(phone)
      .first();
    if (!account) return sessionInvalid();

    // Quota: the reviewer account gets a daily ceiling instead of the monthly
    // cap; everyone else counts posts since the start of the UTC month.
    if (isReviewerPhone(env, phone)) {
      const used = await countOffersSince(db, phone, new Date(Date.now() - DAY_MS).toISOString());
      if (used >= REVIEWER_POSTS_PER_DAY) {
        return json({ error: 'quota_exceeded', tier: 'free', limit: REVIEWER_POSTS_PER_DAY, used }, 402);
      }
    } else {
      const tier = effectiveTier(account);
      const limit = POST_QUOTA[tier] ?? POST_QUOTA.free;
      const used = await countOffersSince(db, phone, startOfMonthUtcIso());
      if (used >= limit) {
        return json({ error: 'quota_exceeded', tier, limit, used }, 402);
      }
    }

    const photos = sanitizeImages(images);
    const id = crypto.randomUUID();
    const createdAt = nowIso();
    await db
      .prepare(
        `INSERT INTO offers
           (id, description, price, location, category, name, avatar, phone,
            latitude, longitude, profile_image, images, image, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
      )
      .bind(
        id,
        description ?? null,
        typeof price === 'number' ? price : price != null ? Number(price) : null,
        location ?? null,
        category ?? null,
        account.name ?? null,
        initials(account.name),
        phone,
        typeof latitude === 'number' ? latitude : null,
        typeof longitude === 'number' ? longitude : null,
        account.profile_image || null,
        photos.length > 0 ? JSON.stringify(photos) : null,
        createdAt
      )
      .run();

    const row = await db.prepare('SELECT * FROM offers WHERE id = ?').bind(id).first();
    return json(shapeOffer(row), 201);
  }

  if (request.method === 'DELETE') {
    const { id } = await readJson(request);
    if (!id) return json({ error: 'Missing id' }, 400);
    const offer = await db.prepare('SELECT id, phone FROM offers WHERE id = ?').bind(id).first();
    if (!offer) return json({ error: 'Offer not found' }, 404);
    const refused = await refuseUnlessOwner(env, caller, offer);
    if (refused) return refused;
    await deleteIllustration(env, offer.id);
    // Reports go too: ids are UUIDs so they are never reused, but leaving
    // orphans behind would slowly bloat the table the feed query counts.
    await db.batch([
      db.prepare('DELETE FROM reports WHERE offer_id = ?').bind(offer.id),
      db.prepare('DELETE FROM offers WHERE id = ?').bind(offer.id),
    ]);
    return json({ ok: true });
  }

  if (request.method === 'PATCH') return patchOfferRequest(request, env, caller);

  return json({ error: 'Method not allowed' }, 405);
}

// What an owner may edit. Who posted it (name, initials, photo, phone) and
// the illustration are the server's to set, never the request's.
const PATCHABLE_OFFER_COLUMNS = new Set([
  'description', 'price', 'location', 'category', 'latitude', 'longitude', 'images',
]);

async function patchOffer(db, id, patch) {
  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(patch || {})) {
    if (!PATCHABLE_OFFER_COLUMNS.has(key)) continue;
    sets.push(`${key} = ?`);
    if (key === 'images') {
      const photos = sanitizeImages(value);
      values.push(photos.length > 0 ? JSON.stringify(photos) : null);
    } else {
      values.push(value ?? null);
    }
  }
  if (sets.length === 0) return { error: 'No updatable fields', status: 400 };
  values.push(id);
  await db.prepare(`UPDATE offers SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return { ok: true };
}

// Shared by PATCH /api/offers and PATCH /api/update-offer.
async function patchOfferRequest(request, env, caller) {
  const { id, ...patch } = await readJson(request);
  if (!id) return json({ error: 'Missing id' }, 400);
  if (!caller.phone) {
    // Builds 11/12 only ever PATCH `image`, straight after generate-image -
    // which now saves that URL itself. Nothing is left to do, and nothing a
    // forged request could change.
    if (!legacyWindowOpen(env)) return updateRequired();
    return json({ ok: true });
  }
  const offer = await env.DB.prepare('SELECT id, phone FROM offers WHERE id = ?').bind(id).first();
  if (!offer) return json({ error: 'Offer not found' }, 404);
  const refused = await refuseUnlessOwner(env, caller, offer);
  if (refused) return refused;
  const updated = await patchOffer(env.DB, offer.id, patch);
  if (updated.error) return json({ error: updated.error }, updated.status || 400);
  return json({ ok: true });
}

async function handleUpdateOffer(request, env) {
  if (request.method !== 'PATCH') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!env.DB) return json({ error: 'Database not configured' }, 500);
  const caller = await resolveCaller(request, env);
  if (caller.response) return caller.response;
  return patchOfferRequest(request, env, caller);
}

/* ------------------------------------------------------------------ *
 * /api/report  +  /api/blocks
 *
 * Google Play's UGC policy expects a way to flag a listing and block its
 * author. Both key off `phone` - the identity the whole API already uses,
 * and the only owner reference `offers` carries.
 * ------------------------------------------------------------------ */

async function handleReport(request, env) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const db = env.DB;
  if (!db) return json({ error: 'Database not configured' }, 500);

  // Reports decide what gets hidden from everyone, so each one has to come
  // from a real, signed-in person. Only token builds have a Report button.
  const caller = await resolveCaller(request, env);
  if (caller.response) return caller.response;
  if (!caller.phone) return updateRequired();

  const body = await readJson(request);
  // Accept both spellings: the app sends snake_case like every other route,
  // but camelCase is the obvious thing to reach for from a REST client.
  const offerId = body.offer_id || body.offerId;
  const reporterPhone = caller.phone;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const details = typeof body.details === 'string' ? body.details.trim().slice(0, 1000) : null;

  if (!offerId) return json({ error: 'Missing offer_id' }, 400);
  if (!REPORT_REASONS.has(reason)) return json({ error: 'Unknown reason' }, 400);

  const reporter = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(reporterPhone).first();
  const reporterId = reporter ? reporter.id : null;

  const offer = await db
    .prepare('SELECT id, phone FROM offers WHERE id = ?')
    .bind(offerId)
    .first();
  if (!offer) return json({ error: 'Offer not found' }, 404);
  if (normalizePhone(offer.phone) === reporterPhone) {
    return json({ error: 'You cannot report your own request' }, 400);
  }

  // Re-reporting the same offer overwrites the previous reason instead of
  // erroring on the unique index or adding a second vote toward the
  // threshold.
  await db
    .prepare(
      `INSERT INTO reports
         (id, offer_id, offer_phone, reporter_phone, reporter_id, reason, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (offer_id, reporter_phone) DO UPDATE SET
         reason     = excluded.reason,
         details    = excluded.details,
         created_at = excluded.created_at`
    )
    .bind(
      crypto.randomUUID(),
      offerId,
      offer.phone || null,
      reporterPhone,
      reporterId,
      reason,
      details,
      nowIso()
    )
    .run();

  const countRow = await db
    .prepare('SELECT COUNT(*) AS n FROM reports WHERE offer_id = ?')
    .bind(offerId)
    .first();
  const reports = countRow ? Number(countRow.n) : 0;
  const hidden = reports >= REPORT_HIDE_THRESHOLD;

  console.log('[report]', offerId, reason, `${reports}/${REPORT_HIDE_THRESHOLD}`, hidden ? 'HIDDEN' : '');
  return json({ ok: true, reports, hidden }, 201);
}

async function handleBlocks(request, env) {
  const db = env.DB;
  if (!db) return json({ error: 'Database not configured' }, 500);

  // Whose block list this is comes from the session, never from the request:
  // the list is private, and changing it is changing someone's feed.
  const caller = await resolveCaller(request, env);
  if (caller.response) return caller.response;
  if (!caller.phone) return updateRequired();
  const blocker = caller.phone;

  // GET /api/blocks - the list behind Profile > Blocked people.
  if (request.method === 'GET') {
    // A bare phone number is not a useful thing to show in a list, so pull a
    // name: the account's if they still have one, otherwise the name on
    // their most recent offer.
    const { results } = await db
      .prepare(
        `SELECT b.blocked_phone, b.created_at,
                COALESCE(
                  (SELECT u.name FROM users u WHERE u.phone = b.blocked_phone),
                  (SELECT o.name FROM offers o WHERE o.phone = b.blocked_phone
                    ORDER BY o.created_at DESC LIMIT 1)
                ) AS name
           FROM blocks b
          WHERE b.blocker_phone = ?
          ORDER BY b.created_at DESC`
      )
      .bind(blocker)
      .all();
    return json(
      (results || []).map((r) => ({
        phone: r.blocked_phone,
        name: r.name || null,
        created_at: r.created_at,
      }))
    );
  }

  if (request.method === 'POST' || request.method === 'DELETE') {
    const body = await readJson(request);
    let blocked = normalizePhone(body.blocked_phone || body.blockedPhone);
    const offerId = body.offer_id || body.offerId;

    // Blocking from a listing: the app knows the offer, not the owner's
    // number, so let it pass the offer id and resolve the owner here.
    if (!blocked && offerId) {
      const offer = await db
        .prepare('SELECT phone FROM offers WHERE id = ?')
        .bind(offerId)
        .first();
      if (!offer) return json({ error: 'Offer not found' }, 404);
      blocked = normalizePhone(offer.phone);
    }

    if (!blocked) return json({ error: 'Missing blocked_phone' }, 400);
    if (blocked === blocker) return json({ error: 'You cannot block yourself' }, 400);

    if (request.method === 'DELETE') {
      await db
        .prepare('DELETE FROM blocks WHERE blocker_phone = ? AND blocked_phone = ?')
        .bind(blocker, blocked)
        .run();
      return json({ ok: true, blocked_phone: blocked, blocked: false });
    }

    // Blocking twice is a no-op, not an error - the app fires this from a
    // button that can be double-tapped.
    await db
      .prepare(
        `INSERT INTO blocks (blocker_phone, blocked_phone, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT (blocker_phone, blocked_phone) DO NOTHING`
      )
      .bind(blocker, blocked, nowIso())
      .run();
    return json({ ok: true, blocked_phone: blocked, blocked: true }, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
}

/* ------------------------------------------------------------------ *
 * /api/generate-image  +  /api/image/<id>.png
 *
 * Replaces Supabase Storage. The PNG is written to a KV namespace and served
 * back from this Worker, so the app still just receives a plain URL string.
 * ------------------------------------------------------------------ */

async function handleGenerateImage(request, env) {
  console.log('[generate-image] called', request.method);
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const db = env.DB;
  if (!db) return json({ error: 'Database not configured' }, 500);

  const caller = await resolveCaller(request, env);
  if (caller.response) return caller.response;

  const { id } = await readJson(request);
  if (!id) {
    return json({ error: 'id is required' }, 400);
  }
  const offer = await db
    .prepare('SELECT id, phone, description, category, image FROM offers WHERE id = ?')
    .bind(id)
    .first();
  if (!offer) return json({ error: 'Offer not found' }, 404);
  const refused = await refuseUnlessOwner(env, caller, offer);
  if (refused) return refused;

  // One illustration per request, ever: asking again hands back the same
  // picture instead of paying for another, or swapping in a different one.
  if (offer.image) return json({ image: offer.image });

  const apiKey = secret(env.OPENAI_API_KEY);
  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY not configured on server' }, 500);
  }
  if (!env.IMAGES) {
    return json({ error: 'Image storage not configured' }, 500);
  }

  // Drawn from what was actually posted, not from anything in this request.
  const description = typeof offer.description === 'string' ? offer.description.trim() : '';
  if (!description) {
    return json({ error: 'description is required' }, 400);
  }
  const category = offer.category;

  const safeDescription = description.slice(0, 500);
  const safeCategory = typeof category === 'string' ? category.slice(0, 50) : 'service';
  const prompt =
    `Minimalist editorial illustration representing a help-request: "${safeDescription}". ` +
    `Category: ${safeCategory}. Clean modern flat style, soft neutral background, ` +
    `no text, no logos, no people's faces in close-up. Friendly and approachable. ` +
    `Composed for a 16:9 widescreen frame with the subject centered and breathing room on the sides.`;

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        size: '2048x1152',
        quality: 'low',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error', response.status, errText);
      return json({ error: 'Image generation failed', detail: errText }, response.status);
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      console.error('No image in response');
      return json({ error: 'No image returned' }, 500);
    }

    // base64 -> bytes, then store the raw PNG in KV under the offer id.
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const safeId = String(offer.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    await env.IMAGES.put(safeId, bytes, {
      metadata: { contentType: 'image/png', createdAt: nowIso() },
    });

    // Saved here rather than by a follow-up PATCH from the app, which is no
    // longer allowed to set it.
    const publicUrl = `${new URL(request.url).origin}/api/image/${safeId}.png`;
    await db.prepare('UPDATE offers SET image = ? WHERE id = ?').bind(publicUrl, offer.id).run();
    return json({ image: publicUrl });
  } catch (err) {
    console.error('generate-image exception', err && err.message);
    return json({ error: 'Internal error' }, 500);
  }
}

async function handleImage(request, env, pathname) {
  if (!env.IMAGES) return new Response('Not configured', { status: 500 });
  const raw = pathname.slice('/api/image/'.length).replace(/\.png$/i, '');
  const safeId = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeId) return new Response('Not found', { status: 404 });

  const object = await env.IMAGES.get(safeId, 'arrayBuffer');
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // Same immutable caching the Supabase public bucket used.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // Preflight, harmless for the native app but needed if anything else
    // ever calls this from a browser.
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Kheli-Build',
        },
      });
    }

    // Builds from 13 on say which build they are. Anything below MIN_BUILD is
    // told to update before it gets anywhere - pictures excepted, so an old
    // screen still draws. Builds 11/12 send no number at all; the legacy
    // rules in each handler deal with them.
    const build = Number(request.headers.get('X-Kheli-Build')) || 0;
    if (build && build < MIN_BUILD && path.startsWith('/api/') && !path.startsWith('/api/image/')) {
      return updateRequired();
    }

    try {
      if (path === '/api/auth') return await handleAuth(request, env);
      if (path === '/api/offers') return await handleOffers(request, env);
      if (path === '/api/update-offer') return await handleUpdateOffer(request, env);
      if (path === '/api/report') return await handleReport(request, env);
      if (path === '/api/blocks') return await handleBlocks(request, env);
      if (path === '/api/generate-image') return await handleGenerateImage(request, env);
      if (path.startsWith('/api/image/')) return await handleImage(request, env, path);

      if (path === '/privacy' || path === '/api/privacy') return html(PRIVACY_HTML);
      if (path === '/delete-account' || path === '/api/delete-account') {
        return html(DELETE_ACCOUNT_HTML);
      }

      // Cheap liveness probe - useful when checking the migration worked.
      if (path === '/' || path === '/health') {
        return json({ ok: true, service: 'kheli-api', time: nowIso() });
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      // Never leak a stack trace to the app; log it for `wrangler tail`.
      console.error('[worker] unhandled', err && (err.stack || err.message));
      return json({ error: 'Internal error' }, 500);
    }
  },
};
