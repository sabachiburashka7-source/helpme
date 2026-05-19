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

  const firebaseApiKey = process.env.FIREBASE_API_KEY;
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;

  async function lookupFirebaseUser(idToken) {
    // identitytoolkit accounts:lookup both validates the JWT and returns
    // the user record. Replaces a full firebase-admin SDK dependency.
    const fullUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`;
    console.log('[auth] firebase ->', fullUrl);
    const r = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const text = await r.text();
    console.log('[auth] firebase <-', r.status, text.slice(0, 400));
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    return { ok: r.ok, status: r.status, data };
  }

  const { action, phone, intent, name, profile_image, id_token } = req.body || {};
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

  // Cheap fail-fast check the client runs before Firebase sends an SMS:
  // tell us whether the phone is already taken (for register) or unknown
  // (for login). No verification involved — the real auth happens after
  // Firebase confirms the OTP, via the firebase_auth action below.
  if (action === 'check_phone') {
    if (!isE164(cleanPhone)) {
      return res.status(400).json({ error: 'Enter a valid phone number with country code (e.g. +995555123456)' });
    }
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
    return res.json({ status: 'ok' });
  }

  if (action === 'firebase_auth') {
    if (!firebaseApiKey || !firebaseProjectId) {
      return res.status(500).json({
        error: 'Firebase not configured. Set FIREBASE_API_KEY and FIREBASE_PROJECT_ID.',
      });
    }
    if (typeof id_token !== 'string' || !id_token) {
      return res.status(400).json({ error: 'Missing id_token' });
    }
    const wantsRegister = intent === 'register';
    const wantsLogin = intent === 'login';
    if (!wantsRegister && !wantsLogin) {
      return res.status(400).json({ error: 'Unknown intent' });
    }

    const lookup = await lookupFirebaseUser(id_token);
    if (!lookup.ok) {
      const msg = lookup.data?.error?.message || lookup.data?.message || 'Token verification failed';
      return res.status(401).json({ error: msg });
    }
    const firebaseUser = Array.isArray(lookup.data?.users) ? lookup.data.users[0] : null;
    const verifiedPhone = firebaseUser?.phoneNumber;
    if (!firebaseUser || !verifiedPhone) {
      return res.status(401).json({ error: 'Token has no verified phone' });
    }
    const phoneFromToken = normalizePhone(verifiedPhone);
    if (!isE164(phoneFromToken)) {
      return res.status(400).json({ error: 'Verified phone is not in E.164 format' });
    }

    if (wantsRegister) {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName) return res.status(400).json({ error: 'Enter your name' });

      const existing = await callSupabase(
        `/rest/v1/users?phone=eq.${encodeURIComponent(phoneFromToken)}&select=id`,
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

      const insertPayload = { phone: phoneFromToken, name: cleanName };
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
      `/rest/v1/users?phone=eq.${encodeURIComponent(phoneFromToken)}&select=id,phone,name,profile_image`,
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
