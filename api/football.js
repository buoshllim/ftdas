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
      headers: { 'x-apisports-key': apiKey },
    });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=86400');
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'upstream fetch failed', detail: err.message });
  }
};
