// API-Football 연동 + 로컬 캐시 (하루 1회)
const API_KEY = ''; // API-Football 키 입력 필요

const LEAGUE_IDS = {
  'EPL': 39,
  '라리가': 140,
  '분데스리가': 78,
  '세리에A': 135,
  'K리그': 292,
  'MLS': 253,
};

const SPURS_ID = 47; // API-Football Tottenham team ID
const SON_ID = 308;  // API-Football Son Heung-min player ID
const SEASON = 2024;

function getCacheKey(key) { return `ftdas_${key}`; }

function getCache(key) {
  try {
    const raw = localStorage.getItem(getCacheKey(key));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > 24 * 60 * 60 * 1000) return null; // 24h TTL
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    localStorage.setItem(getCacheKey(key), JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

async function apiFetch(path) {
  if (!API_KEY) return null;
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { 'x-apisports-key': API_KEY }
  });
  if (!res.ok) return null;
  return res.json();
}

// 손흥민 스탯
async function fetchSonStats() {
  const cached = getCache('son_stats');
  if (cached) return cached;

  const json = await apiFetch(`/players?id=${SON_ID}&season=${SEASON}`);
  if (!json?.response?.[0]) return getManualSonStats();

  const s = json.response[0].statistics[0];
  const data = {
    goals: s.goals.total ?? '—',
    assists: s.goals.assists ?? '—',
    apps: s.games.appearences ?? '—',
    rating: s.games.rating ? parseFloat(s.games.rating).toFixed(1) : '—',
  };
  setCache('son_stats', data);
  return data;
}

function getManualSonStats() {
  const cached = getCache('son_stats_manual');
  return cached ?? { goals: '—', assists: '—', apps: '—', rating: '—' };
}

function saveManualSonStats(data) {
  setCache('son_stats_manual', data);
}

// 리그 순위
async function fetchStandings(leagueName) {
  const leagueId = LEAGUE_IDS[leagueName];
  if (!leagueId) return [];

  const cacheKey = `standings_${leagueId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const json = await apiFetch(`/standings?league=${leagueId}&season=${SEASON}`);
  const rows = json?.response?.[0]?.league?.standings?.[0];
  if (!rows) return [];

  const data = rows.map(t => ({
    rank: t.rank,
    name: t.team.name,
    teamId: t.team.id,
    points: t.points,
    played: t.all.played,
    win: t.all.win,
    draw: t.all.draw,
    lose: t.all.lose,
  }));
  setCache(cacheKey, data);
  return data;
}

// 토트넘 경기
async function fetchSpursFixtures() {
  const cached = getCache('spurs_fixtures');
  if (cached) return cached;

  const json = await apiFetch(`/fixtures?team=${SPURS_ID}&season=${SEASON}&next=5`);
  const next = json?.response ?? [];

  const pastJson = await apiFetch(`/fixtures?team=${SPURS_ID}&season=${SEASON}&last=5`);
  const past = pastJson?.response ?? [];

  const data = { next, past };
  setCache('spurs_fixtures', data);
  return data;
}
