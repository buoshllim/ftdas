// API-Football 연동 + 로컬 캐시
// API 키는 Vercel 환경변수(FOOTBALL_API_KEY)로 관리 — /api/football 프록시를 통해 호출

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
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getCacheKey(key) { return `ftdas_${key}`; }

function getCache(key, ttl = ONE_DAY_MS) {
  try {
    const raw = localStorage.getItem(getCacheKey(key));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > ttl) return null;
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    localStorage.setItem(getCacheKey(key), JSON.stringify({ ts: Date.now(), data }));
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

// 팀 ID — 30일 캐시 (팀 ID는 잘 안 바뀜)
async function findTeamId(name, leagueId) {
  const cacheKey = `teamid_${name}`;
  const cached = getCache(cacheKey, THIRTY_DAYS_MS);
  if (cached) return cached;

  const json = await apiFetch(`/teams?name=${encodeURIComponent(name)}&league=${leagueId}&season=${SEASON}`);
  const id = json?.response?.[0]?.team?.id ?? null;
  if (id) setCache(cacheKey, id);
  return id;
}

// 팀 경기 일정 — last=6으로 단일 콜, 클라이언트에서 과거/미래 분리
async function fetchTeamFixtures(teamId, teamName) {
  if (!teamId) return { teamName, next: [], past: [] };

  const now = Date.now();
  // 최근 6경기 + 다음 3경기 — 2콜 대신 last/next 각 1콜씩
  const [pastJson, nextJson] = await Promise.all([
    apiFetch(`/fixtures?team=${teamId}&season=${SEASON}&last=3`),
    apiFetch(`/fixtures?team=${teamId}&season=${SEASON}&next=3`),
  ]);

  return {
    teamName,
    past: pastJson?.response ?? [],
    next: nextJson?.response ?? [],
  };
}

// 손흥민 경기 일정 (토트넘 + LAFC) — 최대 5콜, 캐시 있으면 0콜
async function fetchSonFixtures() {
  const cached = getCache('son_fixtures');
  if (cached) return cached;

  // LAFC ID는 30일 캐시라 대부분 0콜
  const lafcId = await findTeamId('Los Angeles FC', LEAGUE_IDS['MLS']);

  const [spurs, lafc] = await Promise.all([
    fetchTeamFixtures(SPURS_ID, 'Tottenham'),
    fetchTeamFixtures(lafcId, 'LA FC'),
  ]);

  const data = [spurs, lafc].filter(t => t.next.length || t.past.length);
  setCache('son_fixtures', data);
  return data;
}
