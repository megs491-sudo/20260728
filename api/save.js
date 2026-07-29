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
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    res.status(500).json({
      error: 'Supabase env vars are missing.',
      detail: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.'
    });
    return;
  }

  try {
    const payload = await readBody(req);
    const { birthDate, zodiacName, zodiacTrait, numbers, explanation } = payload || {};

    if (!birthDate || !zodiacName || !Array.isArray(numbers?.main) || numbers.main.length !== 6 || typeof numbers?.bonus !== 'number') {
      res.status(400).json({ error: 'Invalid payload.' });
      return;
    }

    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/lotto_draws`, {
      method: 'POST',
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        birth_date: birthDate,
        zodiac_name: zodiacName,
        zodiac_trait: zodiacTrait || null,
        main_numbers: numbers.main,
        bonus_number: numbers.bonus,
        explanation: explanation || null
      })
    });

    const text = await response.text();
    if (!response.ok) {
      res.status(response.status).json({
        error: 'Supabase insert failed.',
        detail: text
      });
      return;
    }

    const saved = text ? JSON.parse(text) : [];
    res.status(200).json({ ok: true, saved: saved[0] || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
