// ESPN unofficial API proxy — no API key required
module.exports = async function handler(req, res) {
  const path = req.query.path;
  if (!path) {
    return res.status(400).json({ error: 'path required' });
  }

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer${path}`;

  try {
    const response = await fetch(url);
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
