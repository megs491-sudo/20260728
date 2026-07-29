export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    res.status(500).json({ error: 'Supabase env vars are missing.' });
    return;
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { birthDate, zodiacName, zodiacTrait, numbers, explanation } = payload || {};

    if (!birthDate || !zodiacName || !Array.isArray(numbers?.main) || typeof numbers?.bonus !== 'number') {
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

    if (!response.ok) {
      const text = await response.text();
      res.status(500).json({ error: `Supabase insert failed: ${text}` });
      return;
    }

    const saved = await response.json();
    res.status(200).json({ ok: true, saved: saved[0] || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
