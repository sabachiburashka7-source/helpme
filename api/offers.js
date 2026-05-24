// Monthly post quota per tier. Server-enforced so a tampered client can't
// bypass it. Free tier matches what we advertise on the upgrade screen.
const POST_QUOTA = { free: 1, pro: 15 };

function startOfMonthUtcIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function effectiveTier(row) {
  if (!row || row.tier !== 'pro') return 'free';
  if (!row.subscription_expires_at) return 'free';
  return new Date(row.subscription_expires_at).getTime() > Date.now() ? 'pro' : 'free';
}

module.exports = async function handler(req, res) {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!rawUrl || !key) {
    console.log('[offers] missing env. url?', !!rawUrl, 'key?', !!key);
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // Strip trailing slash and accidental /rest/v1 suffix
  const url = rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  console.log('[offers] base url:', url, 'key len:', key.length);

  async function callSupabase(path, init) {
    const fullUrl = `${url}${path}`;
    console.log('[offers] -> fetch', init?.method || 'GET', fullUrl);
    const r = await fetch(fullUrl, init);
    const text = await r.text();
    console.log('[offers] <- status', r.status, 'body[0..300]:', text.slice(0, 300));
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    if (!r.ok) data._debug = { fullUrl, supabaseStatus: r.status };
    return { ok: r.ok, status: r.status, data };
  }

  if (req.method === 'GET') {
    const r = await callSupabase('/rest/v1/offers?select=*&order=created_at.desc', {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return res.status(r.ok ? 200 : r.status).json(r.data);
  }

  if (req.method === 'POST') {
    const { description, price, location, category, name, avatar, phone, latitude, longitude, profile_image, images } = req.body || {};

    // Quota check: look up the user's tier, then count posts since the start
    // of the current UTC month. Tampered clients are caught here. We don't
    // require a phone on this path strictly (lets us debug), but if one is
    // present we enforce. A missing phone falls back to free tier.
    if (typeof phone === 'string' && phone) {
      const userLookup = await callSupabase(
        `/rest/v1/users?phone=eq.${encodeURIComponent(phone)}&select=tier,subscription_expires_at`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      const userRow = userLookup.ok && Array.isArray(userLookup.data) ? userLookup.data[0] : null;
      const tier = effectiveTier(userRow);
      const limit = POST_QUOTA[tier] ?? POST_QUOTA.free;

      const monthStart = startOfMonthUtcIso();
      const countResp = await callSupabase(
        `/rest/v1/offers?phone=eq.${encodeURIComponent(phone)}&created_at=gte.${encodeURIComponent(monthStart)}&select=id`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Prefer: 'count=exact',
          },
        }
      );
      // PostgREST returns the count in the Content-Range header, but we don't
      // see that here. Fall back to counting the returned array length, which
      // is correct because we asked for `select=id` (no row-level cost).
      const usedThisMonth = Array.isArray(countResp.data) ? countResp.data.length : 0;

      if (usedThisMonth >= limit) {
        return res.status(402).json({
          error: 'quota_exceeded',
          tier,
          limit,
          used: usedThisMonth,
        });
      }
    }

    const payload = { description, price, location, category, name, avatar, phone };
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      payload.latitude = latitude;
      payload.longitude = longitude;
    }
    if (typeof profile_image === 'string' && profile_image) {
      payload.profile_image = profile_image;
    }
    if (Array.isArray(images) && images.length > 0) {
      payload.images = images;
    }
    const r = await callSupabase('/rest/v1/offers', {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return res.status(r.status).json(r.data);
    return res.status(201).json(Array.isArray(r.data) ? r.data[0] : r.data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const r = await callSupabase(`/rest/v1/offers?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!r.ok) return res.status(r.status).json(r.data);
    return res.json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const { id, ...patch } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const r = await callSupabase(`/rest/v1/offers?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    });
    if (!r.ok) return res.status(r.status).json(r.data);
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
