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

  const vonageKey = process.env.VONAGE_API_KEY;
  const vonageSecret = process.env.VONAGE_API_SECRET;
  const vonageBrand = process.env.VONAGE_BRAND || 'helpme';
  const vonageConfigured = Boolean(vonageKey && vonageSecret);

  function vonageAuthHeader() {
    const token = Buffer.from(`${vonageKey}:${vonageSecret}`).toString('base64');
    return `Basic ${token}`;
  }

  async function vonageStartVerify(phoneE164) {
    // Vonage expects E.164 without the leading "+"
    const to = phoneE164.replace(/^\+/, '');
    const fullUrl = 'https://api.nexmo.com/v2/verify';
    const body = {
      brand: vonageBrand,
      code_length: 6,
      workflow: [{ channel: 'sms', to }],
    };
    console.log('[auth] vonage ->', fullUrl, body);
    const r = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        Authorization: vonageAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    console.log('[auth] vonage <-', r.status, text.slice(0, 400));
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    return { ok: r.ok, status: r.status, data };
  }

  async function vonageCheckCode(requestId, code) {
    const fullUrl = `https://api.nexmo.com/v2/verify/${encodeURIComponent(requestId)}`;
    console.log('[auth] vonage check ->', fullUrl);
    const r = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        Authorization: vonageAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    const text = await r.text();
    console.log('[auth] vonage check <-', r.status, text.slice(0, 400));
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    return { ok: r.ok, status: r.status, data };
  }

  function vonageErrorMessage(data, fallback) {
    if (!data) return fallback;
    // Vonage v2 uses RFC 7807: { type, title, detail, ... }
    return data.detail || data.title || data.error_text || data.message || fallback;
  }

  const { action, phone, code, intent, name, profile_image, verification_id } = req.body || {};
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

  if (!vonageConfigured) {
    return res.status(500).json({
      error: 'SMS verification not configured. Set VONAGE_API_KEY and VONAGE_API_SECRET.',
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

    const sent = await vonageStartVerify(cleanPhone);
    if (!sent.ok || !sent.data?.request_id) {
      return res.status(sent.status || 502).json({
        error: vonageErrorMessage(sent.data, 'Could not send code. Try again.'),
      });
    }
    return res.json({ status: 'sent', verification_id: sent.data.request_id });
  }

  if (action === 'verify_code') {
    if (typeof code !== 'string' || !/^\d{4,10}$/.test(code.trim())) {
      return res.status(400).json({ error: 'Enter the code you received' });
    }
    if (typeof verification_id !== 'string' || !verification_id) {
      return res.status(400).json({ error: 'Missing verification session — request a new code' });
    }
    const wantsRegister = intent === 'register';
    const wantsLogin = intent === 'login';
    if (!wantsRegister && !wantsLogin) {
      return res.status(400).json({ error: 'Unknown intent' });
    }

    const checked = await vonageCheckCode(verification_id, code.trim());
    if (!checked.ok) {
      // Vonage returns 400 for wrong code, 410 when too many attempts, 404 expired
      const msg =
        checked.status === 400
          ? 'Incorrect code'
          : checked.status === 404
          ? 'Code expired — request a new one'
          : checked.status === 410
          ? 'Too many attempts — request a new code'
          : vonageErrorMessage(checked.data, 'Could not verify code');
      return res.status(checked.status === 400 ? 401 : checked.status).json({ error: msg });
    }

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
      const row = Array.isArray(created.data) ? created.data[0] : created.data;
      return res.status(201).json({
        id: row.id,
        phone: row.phone,
        name: row.name,
        profile_image: row.profile_image || null,
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
    const row = Array.isArray(found.data) ? found.data[0] : null;
    if (!row) return res.status(404).json({ error: 'No account found for this number' });
    return res.json({
      id: row.id,
      phone: row.phone,
      name: row.name,
      profile_image: row.profile_image || null,
    });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
