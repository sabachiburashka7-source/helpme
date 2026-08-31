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
//   GET    /privacy   /api/privacy
//   GET    /delete-account  /api/delete-account
// Plus one new route that replaces Supabase Storage:
//   GET    /api/image/<id>.png    generated illustrations, served from KV

// These are plain .html files, pulled in as strings by the "Text" rule in
// wrangler.jsonc. Edit them as normal HTML - no escaping needed.
import PRIVACY_HTML from './privacy.html';
import DELETE_ACCOUNT_HTML from './delete-account.html';

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

const POST_QUOTA = { free: 3, pro: 15 };

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

// Shape every user response identically so the client always sees the same
// fields (id, phone, name, profile_image, tier, subscription_expires_at).
function shapeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    profile_image: row.profile_image || null,
    tier: effectiveTier(row),
    subscription_expires_at: row.subscription_expires_at || null,
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

/* ------------------------------------------------------------------ *
 * /api/auth
 * ------------------------------------------------------------------ */

async function handleAuth(request, env) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const db = env.DB;
  if (!db) return json({ error: 'Database not configured' }, 500);

  const twilioSid = env.TWILIO_ACCOUNT_SID;
  const twilioToken = env.TWILIO_AUTH_TOKEN;
  const twilioVerifySid = env.TWILIO_VERIFY_SERVICE_SID;
  const twilioConfigured = Boolean(twilioSid && twilioToken && twilioVerifySid);

  async function twilioVerify(path, params) {
    const auth = btoa(`${twilioSid}:${twilioToken}`);
    const body = new URLSearchParams(params).toString();
    const fullUrl = `https://verify.twilio.com/v2/Services/${twilioVerifySid}${path}`;
    console.log('[auth] twilio ->', fullUrl, JSON.stringify(params));
    const r = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const text = await r.text();
    console.log('[auth] twilio <-', r.status, text.slice(0, 400));
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
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
      .bind(id, phone, name, profileImage || null, nowIso())
      .run();
    return findUser(phone);
  }

  const body = await readJson(request);
  const { action, phone, code, intent, name, profile_image } = body;
  const cleanPhone = normalizePhone(phone);

  if (action === 'delete_account') {
    if (!cleanPhone || cleanPhone.replace('+', '').length < 6) {
      return json({ error: 'Enter a valid phone number' }, 400);
    }
    // Remove all offers this user has posted, then the user row itself.
    // Offers go first so a row never lingers without an owner.
    await db.prepare('DELETE FROM offers WHERE phone = ?').bind(cleanPhone).run();
    await db.prepare('DELETE FROM users WHERE phone = ?').bind(cleanPhone).run();
    return json({ ok: true });
  }

  if (action === 'cancel_subscription') {
    // Phase 1: manual / test downgrade. When Google Play Billing is live the
    // app deep-links to Google's "Manage subscription" screen instead - and
    // Google's RTDN webhook is what flips tier='free' here, not this action.
    if (!cleanPhone || cleanPhone.replace('+', '').length < 6) {
      return json({ error: 'Enter a valid phone number' }, 400);
    }
    await db
      .prepare(`UPDATE users SET tier = 'free', subscription_expires_at = NULL WHERE phone = ?`)
      .bind(cleanPhone)
      .run();
    const row = await findUser(cleanPhone);
    if (!row) return json({ error: 'No account found' }, 404);
    return json(shapeUser(row));
  }

  if (action === 'me') {
    // Lightweight "who am I" used on app start to refresh the locally cached
    // user (tier may have changed since last login).
    if (!cleanPhone || cleanPhone.replace('+', '').length < 6) {
      return json({ error: 'Enter a valid phone number' }, 400);
    }
    const row = await findUser(cleanPhone);
    if (!row) return json({ error: 'No account found' }, 404);
    return json(shapeUser(row));
  }

  // Play Store review bypass: lets Google's reviewers (and our paid closed
  // testers, who cannot receive a Georgian SMS) log in without an SMS.
  // Activated only when both env vars are set and the inbound phone matches.
  // The OTP is checked locally instead of via Twilio Verify.
  const testPhone = normalizePhone(env.TEST_PHONE || '');
  const testOtp = (env.TEST_OTP || '').trim();
  const isTestPhone = Boolean(testPhone && testOtp && cleanPhone === testPhone);

  if (action === 'update_profile_image') {
    if (!cleanPhone || cleanPhone.replace('+', '').length < 6) {
      return json({ error: 'Enter a valid phone number' }, 400);
    }
    if (typeof profile_image !== 'string' && profile_image !== null) {
      return json({ error: 'Invalid profile image' }, 400);
    }
    await db
      .prepare('UPDATE users SET profile_image = ? WHERE phone = ?')
      .bind(profile_image, cleanPhone)
      .run();
    const row = await findUser(cleanPhone);
    if (!row) return json({ error: 'User not found' }, 404);

    // Best-effort: propagate the new image to all of this user's existing
    // offers so the avatar in Browse reflects the change without a repost.
    try {
      await db
        .prepare('UPDATE offers SET profile_image = ? WHERE phone = ?')
        .bind(profile_image, cleanPhone)
        .run();
    } catch {}

    return json(shapeUser(row));
  }

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
      if (code.trim() !== testOtp) {
        return json({ error: 'Incorrect or expired code' }, 401);
      }
      // Ensure-or-fetch: works for both register and login so a reviewer can
      // hit either flow without server-state coordination.
      const existingRow = await findUser(cleanPhone);
      if (existingRow) {
        return json(shapeUser(existingRow));
      }
      const cleanName = (typeof name === 'string' && name.trim()) || 'Play Store Reviewer';
      const created = await createUser(cleanPhone, cleanName, profile_image);
      return json(shapeUser(created), wantsRegister ? 201 : 200);
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
      return json(shapeUser(created), 201);
    }

    // login
    const row = await findUser(cleanPhone);
    if (!row) return json({ error: 'No account found for this number' }, 404);
    return json(shapeUser(row));
  }

  return json({ error: 'Unknown action' }, 400);
}

/* ------------------------------------------------------------------ *
 * /api/offers
 * ------------------------------------------------------------------ */

async function handleOffers(request, env) {
  const db = env.DB;
  if (!db) return json({ error: 'Database not configured' }, 500);

  if (request.method === 'GET') {
    const { results } = await db
      .prepare('SELECT * FROM offers ORDER BY created_at DESC')
      .all();
    return json((results || []).map(shapeOffer));
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    const {
      description, price, location, category, name, avatar, phone,
      latitude, longitude, profile_image, images,
    } = body;

    // Quota check: look up the user's tier, then count posts since the start
    // of the current UTC month. Tampered clients are caught here. A missing
    // phone falls back to free tier (kept from the Vercel version so the
    // endpoint stays debuggable).
    if (typeof phone === 'string' && phone) {
      const userRow = await db
        .prepare('SELECT tier, subscription_expires_at FROM users WHERE phone = ?')
        .bind(phone)
        .first();
      const tier = effectiveTier(userRow);
      const limit = POST_QUOTA[tier] ?? POST_QUOTA.free;
      const monthStart = startOfMonthUtcIso();
      const countRow = await db
        .prepare('SELECT COUNT(*) AS n FROM offers WHERE phone = ? AND created_at >= ?')
        .bind(phone, monthStart)
        .first();
      const usedThisMonth = countRow ? Number(countRow.n) : 0;

      if (usedThisMonth >= limit) {
        return json({ error: 'quota_exceeded', tier, limit, used: usedThisMonth }, 402);
      }
    }

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
        name ?? null,
        avatar ?? null,
        phone ?? null,
        typeof latitude === 'number' ? latitude : null,
        typeof longitude === 'number' ? longitude : null,
        typeof profile_image === 'string' && profile_image ? profile_image : null,
        Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : null,
        createdAt
      )
      .run();

    const row = await db.prepare('SELECT * FROM offers WHERE id = ?').bind(id).first();
    return json(shapeOffer(row), 201);
  }

  if (request.method === 'DELETE') {
    const { id } = await readJson(request);
    if (!id) return json({ error: 'Missing id' }, 400);
    await db.prepare('DELETE FROM offers WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  if (request.method === 'PATCH') {
    const body = await readJson(request);
    const { id, ...patch } = body;
    if (!id) return json({ error: 'Missing id' }, 400);
    const updated = await patchOffer(db, id, patch);
    if (updated.error) return json({ error: updated.error }, updated.status || 400);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

// Shared by PATCH /api/offers and PATCH /api/update-offer. Only columns that
// actually exist are writable, so a stray key can't break the statement.
const PATCHABLE_OFFER_COLUMNS = new Set([
  'description', 'price', 'location', 'category', 'name', 'avatar',
  'latitude', 'longitude', 'profile_image', 'images', 'image',
]);

async function patchOffer(db, id, patch) {
  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(patch || {})) {
    if (!PATCHABLE_OFFER_COLUMNS.has(key)) continue;
    sets.push(`${key} = ?`);
    if (key === 'images') {
      values.push(Array.isArray(value) ? JSON.stringify(value) : value ?? null);
    } else {
      values.push(value ?? null);
    }
  }
  if (sets.length === 0) return { error: 'No updatable fields', status: 400 };
  values.push(id);
  await db.prepare(`UPDATE offers SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return { ok: true };
}

async function handleUpdateOffer(request, env) {
  if (request.method !== 'PATCH') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const db = env.DB;
  if (!db) return json({ error: 'Database not configured' }, 500);
  const { id, ...patch } = await readJson(request);
  if (!id) return json({ error: 'Missing id' }, 400);
  const updated = await patchOffer(db, id, patch);
  if (updated.error) return json({ error: updated.error }, updated.status || 400);
  return json({ ok: true });
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

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY not configured on server' }, 500);
  }
  if (!env.IMAGES) {
    return json({ error: 'Image storage not configured' }, 500);
  }

  const { description, category, id } = await readJson(request);
  if (!description || typeof description !== 'string') {
    return json({ error: 'description is required' }, 400);
  }
  if (!id) {
    return json({ error: 'id is required' }, 400);
  }

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

    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    await env.IMAGES.put(safeId, bytes, {
      metadata: { contentType: 'image/png', createdAt: nowIso() },
    });

    const publicUrl = `${new URL(request.url).origin}/api/image/${safeId}.png`;
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
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      if (path === '/api/auth') return await handleAuth(request, env);
      if (path === '/api/offers') return await handleOffers(request, env);
      if (path === '/api/update-offer') return await handleUpdateOffer(request, env);
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
