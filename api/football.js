// api-football via RapidAPI — set FOOTBALL_API_KEY in Vercel env vars
module.exports = async function handler(req, res) {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const path = req.query.path;
  if (!path) {
    return res.status(400).json({ error: 'path required' });
  }

  const url = `https://api-football-v1.p.rapidapi.com/v3${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
      },
    });
    const data = await response.json();
    const now = new Date();
    const nextMidnightKST = new Date();
    nextMidnightKST.setUTCHours(15, 0, 0, 0);
    if (nextMidnightKST <= now) nextMidnightKST.setUTCDate(nextMidnightKST.getUTCDate() + 1);
    const sMaxAge = Math.max(60, Math.floor((nextMidnightKST - now) / 1000));
    res.setHeader('Cache-Control', `s-maxage=${sMaxAge}`);
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'upstream fetch failed', detail: err.message });
  }
};
