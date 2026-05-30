// API-Football 연동 + 로컬 캐시 (하루 1회)
// API 키는 Vercel 환경변수(FOOTBALL_API_KEY)로 관리 — /api/football 프록시를 통해 호출

const LEAGUE_IDS = {
  'EPL': 39,
  '라리가': 140,
  '분데스리가': 78,
  '세리에A': 135,
  'K리그': 292,
  'MLS': 253,
};

const SPURS_ID = 47; // API-Football Tottenham team ID
const SEASON = 2025;
const SEASON_FALLBACK = 2024;

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
  try {
    const res = await fetch(`/api/football?path=${encodeURIComponent(path)}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// 손흥민 스탯 — 이름으로만 검색 (팀 이적해도 찾을 수 있게)
async function fetchSonStats() {
  const cached = getCache('son_stats');
  if (cached) return cached;

  const findSon = (json) => json?.response?.find(p =>
    p.player.lastname?.toLowerCase().includes('son') &&
    p.player.firstname?.toLowerCase().includes('heung')
  );

  // 2025 시즌 먼저, 없으면 2024 폴백
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

  let json = await apiFetch(`/standings?league=${leagueId}&season=${SEASON}`);
  // 데이터 없으면 이전 시즌으로 폴백
  if (!json?.response?.[0]?.league?.standings) {
    json = await apiFetch(`/standings?league=${leagueId}&season=${SEASON_FALLBACK}`);
  }
  const allGroups = json?.response?.[0]?.league?.standings;
  if (!allGroups) return [];

  // MLS 같이 동부/서부 지구가 있는 경우 모두 합치기
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

// 팀 ID 검색 (LAFC 등 동적으로 찾기)
async function findTeamId(name, leagueId, season) {
  const cacheKey = `teamid_${name}_${season}`;
  const cached = getCache(cacheKey);
  if (cached !== null) return cached;

  const json = await apiFetch(`/teams?name=${encodeURIComponent(name)}&league=${leagueId}&season=${season}`);
  const id = json?.response?.[0]?.team?.id ?? null;
  setCache(cacheKey, id);
  return id;
}

// 팀 경기 일정 (최근 3경기 + 다음 3경기)
async function fetchTeamFixtures(teamId, teamName, season) {
  if (!teamId) return { teamName, next: [], past: [] };

  const [nextJson, pastJson] = await Promise.all([
    apiFetch(`/fixtures?team=${teamId}&season=${season}&next=3`),
    apiFetch(`/fixtures?team=${teamId}&season=${season}&last=3`),
  ]);

  return {
    teamName,
    next: nextJson?.response ?? [],
    past: pastJson?.response ?? [],
  };
}

// 손흥민 팀들 경기 일정 (토트넘 + LAFC)
async function fetchSonFixtures() {
  const cached = getCache('son_fixtures');
  if (cached) return cached;

  // LAFC ID 동적 조회
  const lafcId = await findTeamId('Los Angeles FC', LEAGUE_IDS['MLS'], SEASON);

  const [spurs, lafc] = await Promise.all([
    fetchTeamFixtures(SPURS_ID, 'Tottenham', SEASON),
    fetchTeamFixtures(lafcId, 'LA FC', SEASON),
  ]);

  const data = [spurs, lafc].filter(t => t.next.length || t.past.length);
  setCache('son_fixtures', data);
  return data;
}
