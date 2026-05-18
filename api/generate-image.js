const STORAGE_BUCKET = 'offer-images';

module.exports = async function handler(req, res) {
  console.log('[generate-image] called', req.method);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
  }

  const rawSupabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!rawSupabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase storage not configured' });
  }
  const supabaseUrl = rawSupabaseUrl
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '');

  const { description, category, id } = req.body || {};
  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'description is required' });
  }
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
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
      return res.status(response.status).json({ error: 'Image generation failed', detail: errText });
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      console.error('No image in response', JSON.stringify(data));
      return res.status(500).json({ error: 'No image returned' });
    }

    const imageBuffer = Buffer.from(b64, 'base64');
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const objectPath = `${safeId}.png`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`;

    const uploadResp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: imageBuffer,
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      console.error('Supabase storage upload failed', uploadResp.status, errText);
      return res.status(500).json({ error: 'Storage upload failed', detail: errText });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`;
    res.json({ image: publicUrl });
  } catch (err) {
    console.error('generate-image exception', err);
    res.status(500).json({ error: 'Internal error' });
  }
};
