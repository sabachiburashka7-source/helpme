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
    const { description, price, location, category, name, avatar, phone, latitude, longitude } = req.body || {};
    const payload = { description, price, location, category, name, avatar, phone };
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      payload.latitude = latitude;
      payload.longitude = longitude;
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
