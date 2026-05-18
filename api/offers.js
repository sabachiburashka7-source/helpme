module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  async function supabaseJson(r) {
    const text = await r.text();
    console.log('[offers] supabase status:', r.status, 'body:', text.slice(0, 200));
    try { return JSON.parse(text); } catch { return { error: text }; }
  }

  if (req.method === 'GET') {
    const r = await fetch(`${url}/rest/v1/offers?select=*&order=created_at.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const data = await supabaseJson(r);
    if (!r.ok) return res.status(r.status).json(data);
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { description, price, location, category, name, avatar, phone } = req.body || {};
    const r = await fetch(`${url}/rest/v1/offers`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ description, price, location, category, name, avatar, phone }),
    });
    const data = await supabaseJson(r);
    if (!r.ok) return res.status(r.status).json(data);
    return res.status(201).json(Array.isArray(data) ? data[0] : data);
  }

  if (req.method === 'PATCH') {
    const { id, ...patch } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const r = await fetch(`${url}/rest/v1/offers?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const data = await supabaseJson(r);
      return res.status(r.status).json(data);
    }
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
