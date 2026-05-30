// kleague.com 공식 API 프록시 (CORS 없어서 서버 경유 필요)
module.exports = async function handler(req, res) {
  try {
    const response = await fetch('https://www.kleague.com/api/clubRank.do', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.kleague.com/index.do',
      },
    });
    const data = await response.json();
    const now = new Date();
    const nextMidnightKST = new Date();
    nextMidnightKST.setUTCHours(15, 0, 0, 0);
    if (nextMidnightKST <= now) nextMidnightKST.setUTCDate(nextMidnightKST.getUTCDate() + 1);
    const sMaxAge = Math.max(60, Math.floor((nextMidnightKST - now) / 1000));
    res.setHeader('Cache-Control', `s-maxage=${sMaxAge}`);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
