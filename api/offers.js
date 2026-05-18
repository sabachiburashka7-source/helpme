module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  if (req.method === 'GET') {
    const r = await fetch(`${url}/rest/v1/offers?select=*&order=created_at.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const data = await r.json();
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
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.status(201).json(Array.isArray(data) ? data[0] : data);
  }

  res.status(405).json({ error: 'Method not allowed' });
};
