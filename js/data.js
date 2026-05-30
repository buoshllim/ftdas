// API-Football 연동 + 로컬 캐시
// API 키는 Vercel 환경변수(FOOTBALL_API_KEY) — /api/football 프록시 경유

const LEAGUE_IDS = {
  'EPL': 39,
  '라리가': 140,
  '분데스리가': 78,
  '세리에A': 135,
  'K리그': 292,
  'MLS': 253,
};

const SPURS_ID = 47;
const SEASON = 2025;
const SEASON_FALLBACK = 2024;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const KST_OFFSET = 9 * 60 * 60 * 1000; // UTC+9

function todayKST() {
  return new Date(Date.now() + KST_OFFSET).toISOString().slice(0, 10);
}

function getCacheKey(key) { return `ftdas_${key}`; }

// ttl: 'kst-day' = KST 당일, number = ms TTL
function getCache(key, ttl = 'kst-day') {
  try {
    const raw = localStorage.getItem(getCacheKey(key));
    if (!raw) return null;
    const { ts, date, data } = JSON.parse(raw);
    if (ttl === 'kst-day') {
      if (date !== todayKST()) return null;
    } else {
      if (Date.now() - ts > ttl) return null;
    }
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    localStorage.setItem(getCacheKey(key), JSON.stringify({ ts: Date.now(), date: todayKST(), data }));
  } catch {}
}

async function apiFetch(path) {
  try {
    const res = await fetch(`/api/football?path=${encodeURIComponent(path)}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// 손흥민 스탯 — 1 API 콜 (2025 먼저, 응답 내 결과 없으면 2024 재시도)
async function fetchSonStats() {
  const cached = getCache('son_stats');
  if (cached) return cached;

  const findSon = (json) => json?.response?.find(p =>
    p.player.lastname?.toLowerCase().includes('son') &&
    p.player.firstname?.toLowerCase().includes('heung')
  );

  let player = findSon(await apiFetch(`/players?search=Heung-Min&season=${SEASON}`));
  if (!player) player = findSon(await apiFetch(`/players?search=Heung-Min&season=${SEASON_FALLBACK}`));
  if (!player) return getManualSonStats();

  const s = player.statistics[0];
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
  const cached = getCache('son_stats_manual', THIRTY_DAYS_MS);
  return cached ?? { goals: '—', assists: '—', apps: '—', rating: '—' };
}

function saveManualSonStats(data) {
  setCache('son_stats_manual', data);
}

// 리그 순위 — 1 API 콜 (폴백 시 최대 2콜, 캐시 있으면 0콜)
async function fetchStandings(leagueName) {
  const leagueId = LEAGUE_IDS[leagueName];
  if (!leagueId) return [];

  const cacheKey = `standings_${leagueId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let json = await apiFetch(`/standings?league=${leagueId}&season=${SEASON}`);
  if (!json?.response?.[0]?.league?.standings) {
    json = await apiFetch(`/standings?league=${leagueId}&season=${SEASON_FALLBACK}`);
  }
  const allGroups = json?.response?.[0]?.league?.standings;
  if (!allGroups) return [];

  const data = allGroups.flatMap((group, groupIdx) =>
    group.map(t => ({
      rank: t.rank,
      name: t.team.name,
      teamId: t.team.id,
      points: t.points,
      played: t.all.played,
      win: t.all.win,
      draw: t.all.draw,
      lose: t.all.lose,
      group: allGroups.length > 1 ? (groupIdx === 0 ? '동부' : '서부') : null,
    }))
  );
  setCache(cacheKey, data);
  return data;
}

// LAFC 팀 ID — 30일 캐시, 이름 여러 개 시도
async function findLafcId() {
  const cacheKey = 'teamid_lafc';
  const cached = getCache(cacheKey, THIRTY_DAYS_MS);
  if (cached) return cached;

  // API-Football에서 LAFC 이름 변형들 시도
  const names = ['Los Angeles FC', 'LAFC', 'LA FC'];
  for (const name of names) {
    const json = await apiFetch(`/teams?name=${encodeURIComponent(name)}&league=${LEAGUE_IDS['MLS']}`);
    const id = json?.response?.[0]?.team?.id ?? null;
    if (id) { setCache(cacheKey, id); return id; }
  }
  return null;
}

// 팀 경기 일정 — past 3 + next 3
async function fetchTeamFixtures(teamId, cacheKey) {
  if (!teamId) return { past: [], next: [] };
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const [pastJson, nextJson] = await Promise.all([
    apiFetch(`/fixtures?team=${teamId}&season=${SEASON}&last=3`),
    apiFetch(`/fixtures?team=${teamId}&season=${SEASON}&next=3`),
  ]);

  const data = {
    past: pastJson?.response ?? [],
    next: nextJson?.response ?? [],
  };
  setCache(cacheKey, data);
  return data;
}

async function fetchSpursFixtures() {
  return fetchTeamFixtures(SPURS_ID, 'spurs_fixtures');
}

async function fetchLafcFixtures() {
  const lafcId = await findLafcId();
  return fetchTeamFixtures(lafcId, 'lafc_fixtures');
}
