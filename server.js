const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');

app.use(express.json({ limit: '1mb' }));

app.post('/api/generate-image', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
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
        size: '1024x1024',
        quality: 'low',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error', response.status, errText);
      return res.status(response.status).json({ error: 'Image generation failed' });
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({ error: 'No image returned' });
    }
    res.json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error('generate-image exception', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.use(express.static(DIST));
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`helpme server listening on port ${PORT}`);
});
