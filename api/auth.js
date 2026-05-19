const crypto = require('crypto');

const CODE_TTL_MS = 5 * 60 * 1000;          // code valid for 5 min
const MAX_ATTEMPTS = 5;                      // attempts per code
const MAX_CODES_PER_PHONE_PER_WINDOW = 3;    // anti-abuse: codes per phone per window
const ABUSE_WINDOW_MS = 10 * 60 * 1000;      // 10 min window

function normalizePhone(input) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  return digits ? (hasPlus ? '+' : '') + digits : '';
}

function isE164(phone) {
  return /^\+\d{8,15}$/.test(phone);
}

function generateCode() {
  // 6-digit zero-padded, cryptographically random
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

function hashCode(code, phone, secret) {
  return crypto.createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!rawUrl || !key) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const url = rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

  async function callSupabase(path, init) {
    const fullUrl = `${url}${path}`;
    console.log('[auth] ->', init?.method || 'GET', fullUrl);
    const r = await fetch(fullUrl, init);
    const text = await r.text();
    console.log('[auth] <-', r.status, text.slice(0, 400));
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    return { ok: r.ok, status: r.status, data };
  }

  function supabaseError(data, fallback) {
    if (!data) return fallback;
    return data.message || data.error || data.hint || data.details || fallback;
  }

  const baseHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const smsKey = process.env.SMSOFFICE_API_KEY;
  const smsSender = process.env.SMSOFFICE_SENDER || 'helpme';
  const otpSecret = process.env.OTP_HASH_SECRET || key; // falls back to anon key
  const smsConfigured = Boolean(smsKey);

  async function sendSms(phoneE164, text) {
    // smsoffice.ge v2 expects E.164 without leading "+"
    const destination = phoneE164.replace(/^\+/, '');
    const fullUrl = 'https://smsoffice.ge/api/v2/send/';
    const params = new URLSearchParams({
      key: smsKey,
      destination,
      sender: smsSender,
      content: text,
    });
    console.log('[auth] sms ->', fullUrl, { destination, sender: smsSender });
    const r = await fetch(`${fullUrl}?${params.toString()}`, { method: 'GET' });
    const body = await r.text();
    console.log('[auth] sms <-', r.status, body.slice(0, 400));
    // smsoffice returns JSON like { Success: true, ... } or a numeric/text status
    let data;
    try { data = JSON.parse(body); } catch { data = { raw: body }; }
    const ok = r.ok && (data?.Success === true || data?.success === true || /success/i.test(data?.raw || ''));
    return { ok, status: r.status, data };
  }

  const { action, phone, code, intent, name, profile_image } = req.body || {};
  const cleanPhone = normalizePhone(phone);

  if (action === 'update_profile_image') {
    if (!cleanPhone || cleanPhone.replace('+', '').length < 6) {
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }
    if (typeof profile_image !== 'string' && profile_image !== null) {
      return res.status(400).json({ error: 'Invalid profile image' });
    }
    const updated = await callSupabase(
      `/rest/v1/users?phone=eq.${encodeURIComponent(cleanPhone)}`,
      {
        method: 'PATCH',
        headers: { ...baseHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({ profile_image }),
      }
    );
    if (!updated.ok) {
      return res.status(updated.status).json({
        error: supabaseError(updated.data, 'Could not update profile image'),
        supabase: updated.data,
      });
    }
    const row = Array.isArray(updated.data) ? updated.data[0] : updated.data;
    if (!row) return res.status(404).json({ error: 'User not found' });

    // Best-effort: propagate the new image to all of this user's existing offers
    // so the avatar in Browse reflects the change without requiring a repost.
    await callSupabase(
      `/rest/v1/offers?phone=eq.${encodeURIComponent(cleanPhone)}`,
      {
        method: 'PATCH',
        headers: baseHeaders,
        body: JSON.stringify({ profile_image }),
      }
    ).catch(() => {});

    return res.json({ id: row.id, phone: row.phone, name: row.name, profile_image: row.profile_image });
  }

  if (!isE164(cleanPhone)) {
    return res.status(400).json({ error: 'Enter a valid phone number with country code (e.g. +995555123456)' });
  }

  if (!smsConfigured) {
    return res.status(500).json({
      error: 'SMS provider not configured. Set SMSOFFICE_API_KEY.',
    });
  }

  if (action === 'send_code') {
    const wantsRegister = intent === 'register';
    const wantsLogin = intent === 'login';
    if (!wantsRegister && !wantsLogin) {
      return res.status(400).json({ error: 'Unknown intent' });
    }

    const existing = await callSupabase(
      `/rest/v1/users?phone=eq.${encodeURIComponent(cleanPhone)}&select=id`,
      { headers: baseHeaders }
    );
    if (!existing.ok) {
      return res.status(existing.status).json({
        error: supabaseError(existing.data, 'Could not reach users table'),
        supabase: existing.data,
      });
    }
    const userExists = Array.isArray(existing.data) && existing.data.length > 0;

    if (wantsRegister && userExists) {
      return res.status(409).json({ error: 'An account with this phone already exists' });
    }
    if (wantsLogin && !userExists) {
      return res.status(404).json({ error: 'No account found for this number' });
    }

    // Rate limit: too many codes for this phone recently?
    const recentSince = new Date(Date.now() - ABUSE_WINDOW_MS).toISOString();
    const recent = await callSupabase(
      `/rest/v1/otp_codes?phone=eq.${encodeURIComponent(cleanPhone)}&created_at=gte.${encodeURIComponent(recentSince)}&select=id`,
      { headers: baseHeaders }
    );
    if (recent.ok && Array.isArray(recent.data) && recent.data.length >= MAX_CODES_PER_PHONE_PER_WINDOW) {
      return res.status(429).json({ error: 'Too many code requests. Please wait a few minutes.' });
    }

    const codeStr = generateCode();
    const code_hash = hashCode(codeStr, cleanPhone, otpSecret);
    const expires_at = new Date(Date.now() + CODE_TTL_MS).toISOString();

    const inserted = await callSupabase('/rest/v1/otp_codes', {
      method: 'POST',
      headers: { ...baseHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ phone: cleanPhone, code_hash, expires_at }),
    });
    if (!inserted.ok) {
      return res.status(inserted.status).json({
        error: supabaseError(inserted.data, 'Could not create code'),
        supabase: inserted.data,
      });
    }

    const sent = await sendSms(cleanPhone, `helpme code: ${codeStr}. Valid for 5 min.`);
    if (!sent.ok) {
      return res.status(502).json({
        error: 'Could not send SMS. Try again.',
        provider: sent.data,
      });
    }
    return res.json({ status: 'sent' });
  }

  if (action === 'verify_code') {
    if (typeof code !== 'string' || !/^\d{4,10}$/.test(code.trim())) {
      return res.status(400).json({ error: 'Enter the code you received' });
    }
    const wantsRegister = intent === 'register';
    const wantsLogin = intent === 'login';
    if (!wantsRegister && !wantsLogin) {
      return res.status(400).json({ error: 'Unknown intent' });
    }

    // Get the most recent non-consumed, non-expired code for this phone
    const nowIso = new Date().toISOString();
    const lookup = await callSupabase(
      `/rest/v1/otp_codes?phone=eq.${encodeURIComponent(cleanPhone)}&consumed=is.false&expires_at=gte.${encodeURIComponent(nowIso)}&order=created_at.desc&limit=1`,
      { headers: baseHeaders }
    );
    if (!lookup.ok) {
      return res.status(lookup.status).json({
        error: supabaseError(lookup.data, 'Could not check code'),
        supabase: lookup.data,
      });
    }
    const row = Array.isArray(lookup.data) ? lookup.data[0] : null;
    if (!row) {
      return res.status(401).json({ error: 'Code expired — request a new one' });
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      // Burn the code so it can't be brute-forced further
      await callSupabase(
        `/rest/v1/otp_codes?id=eq.${row.id}`,
        {
          method: 'PATCH',
          headers: baseHeaders,
          body: JSON.stringify({ consumed: true }),
        }
      ).catch(() => {});
      return res.status(429).json({ error: 'Too many attempts — request a new code' });
    }

    const expected = hashCode(code.trim(), cleanPhone, otpSecret);
    if (expected !== row.code_hash) {
      await callSupabase(
        `/rest/v1/otp_codes?id=eq.${row.id}`,
        {
          method: 'PATCH',
          headers: baseHeaders,
          body: JSON.stringify({ attempts: (row.attempts || 0) + 1 }),
        }
      ).catch(() => {});
      return res.status(401).json({ error: 'Incorrect code' });
    }

    // Code is good — burn it so it can't be replayed
    await callSupabase(
      `/rest/v1/otp_codes?id=eq.${row.id}`,
      {
        method: 'PATCH',
        headers: baseHeaders,
        body: JSON.stringify({ consumed: true }),
      }
    ).catch(() => {});

    if (wantsRegister) {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName) return res.status(400).json({ error: 'Enter your name' });

      const existing = await callSupabase(
        `/rest/v1/users?phone=eq.${encodeURIComponent(cleanPhone)}&select=id`,
        { headers: baseHeaders }
      );
      if (!existing.ok) {
        return res.status(existing.status).json({
          error: supabaseError(existing.data, 'Could not reach users table'),
          supabase: existing.data,
        });
      }
      if (Array.isArray(existing.data) && existing.data.length > 0) {
        return res.status(409).json({ error: 'An account with this phone already exists' });
      }

      const insertPayload = { phone: cleanPhone, name: cleanName };
      if (typeof profile_image === 'string' && profile_image) {
        insertPayload.profile_image = profile_image;
      }
      const created = await callSupabase('/rest/v1/users', {
        method: 'POST',
        headers: { ...baseHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(insertPayload),
      });
      if (!created.ok) {
        return res.status(created.status).json({
          error: supabaseError(created.data, 'Could not create account'),
          supabase: created.data,
        });
      }
      const createdRow = Array.isArray(created.data) ? created.data[0] : created.data;
      return res.status(201).json({
        id: createdRow.id,
        phone: createdRow.phone,
        name: createdRow.name,
        profile_image: createdRow.profile_image || null,
      });
    }

    // login
    const found = await callSupabase(
      `/rest/v1/users?phone=eq.${encodeURIComponent(cleanPhone)}&select=id,phone,name,profile_image`,
      { headers: baseHeaders }
    );
    if (!found.ok) {
      return res.status(found.status).json({
        error: supabaseError(found.data, 'Could not reach users table'),
        supabase: found.data,
      });
    }
    const userRow = Array.isArray(found.data) ? found.data[0] : null;
    if (!userRow) return res.status(404).json({ error: 'No account found for this number' });
    return res.json({
      id: userRow.id,
      phone: userRow.phone,
      name: userRow.name,
      profile_image: userRow.profile_image || null,
    });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
