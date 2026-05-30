module.exports = async function handler(req, res) {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const path = req.query.path;
  if (!path) {
    return res.status(400).json({ error: 'path required' });
  }

  const url = `https://v3.football.api-sports.io${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-apisports-key': apiKey,
        'Origin': 'https://ftdas.vercel.app',
        'Referer': 'https://ftdas.vercel.app/',
      },
    });
    const data = await response.json();
    // KST 자정까지 남은 초로 캐시 설정 (midnight KST = 15:00 UTC)
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
