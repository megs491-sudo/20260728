function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  const endpoint = process.env.HIGGSFIELD_API_URL;
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  const apiSecret = process.env.HIGGSFIELD_API_SECRET;

  if (!endpoint || !apiKey) {
    json(res, 500, {
      error: 'Higgsfield env vars are missing.',
      detail: 'Set HIGGSFIELD_API_URL and HIGGSFIELD_API_KEY in Vercel.'
    });
    return;
  }

  try {
    const payload = await readBody(req);
    const { prompt, aspect_ratio = '1:1', quality = '2k', model = 'soul2' } = payload || {};

    if (!prompt) {
      json(res, 400, { error: 'Prompt is required.' });
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      apikey: apiKey,
      'x-api-key': apiKey,
      'x-api-secret': apiSecret || ''
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        prompt,
        aspect_ratio,
        quality
      })
    });

    const text = await response.text();
    if (!response.ok) {
      json(res, response.status, { error: 'Higgsfield request failed.', detail: text });
      return;
    }

    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    json(res, 200, data);
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}
