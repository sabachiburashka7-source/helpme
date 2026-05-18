module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

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
    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json(data);
  }
  res.json({ ok: true });
};
