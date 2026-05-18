module.exports = async function handler(req, res) {
  console.log('[generate-image] called', req.method);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY not configured on server' });
  }

  const { description, category } = req.body || {};
  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'description is required' });
  }

  const safeDescription = description.slice(0, 500);
  const safeCategory = typeof category === 'string' ? category.slice(0, 50) : 'service';
  const prompt =
    `Minimalist editorial illustration representing a help-request: "${safeDescription}". ` +
    `Category: ${safeCategory}. Clean modern flat style, soft neutral background, ` +
    `no text, no logos, no people's faces in close-up. Friendly and approachable.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }], role: 'user' }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            responseMimeType: 'image/png',
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error', response.status, errText);
      return res.status(response.status).json({ error: 'Image generation failed' });
    }

    const data = await response.json();
    const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    const b64 = part?.inlineData?.data;
    const mime = part?.inlineData?.mimeType || 'image/png';
    if (!b64) {
      console.error('No image in Gemini response', JSON.stringify(data));
      return res.status(500).json({ error: 'No image returned' });
    }
    res.json({ image: `data:${mime};base64,${b64}` });
  } catch (err) {
    console.error('generate-image exception', err);
    res.status(500).json({ error: 'Internal error' });
  }
};
