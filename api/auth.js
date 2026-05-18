const crypto = require('crypto');

function normalizePhone(input) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  return digits ? (hasPlus ? '+' : '') + digits : '';
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  try {
    const test = crypto.scryptSync(password, salt, 64);
    const known = Buffer.from(hash, 'hex');
    if (test.length !== known.length) return false;
    return crypto.timingSafeEqual(test, known);
  } catch {
    return false;
  }
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

  const { action, phone, password, name, profile_image } = req.body || {};
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone || cleanPhone.replace('+', '').length < 6) {
    return res.status(400).json({ error: 'Enter a valid phone number' });
  }

  if (action === 'update_profile_image') {
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
    return res.json({ id: row.id, phone: row.phone, name: row.name, profile_image: row.profile_image });
  }

  if (typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  if (action === 'register') {
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

    const password_hash = hashPassword(password);
    const insertPayload = { phone: cleanPhone, password_hash, name: cleanName };
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

  if (action === 'login') {
    const found = await callSupabase(
      `/rest/v1/users?phone=eq.${encodeURIComponent(cleanPhone)}&select=id,phone,name,password_hash,profile_image`,
      { headers: baseHeaders }
    );
    if (!found.ok) {
      return res.status(found.status).json({
        error: supabaseError(found.data, 'Could not reach users table'),
        supabase: found.data,
      });
    }
    const row = Array.isArray(found.data) ? found.data[0] : null;
    if (!row || !verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ error: 'Wrong phone or password' });
    }
    return res.json({
      id: row.id,
      phone: row.phone,
      name: row.name,
      profile_image: row.profile_image || null,
    });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
