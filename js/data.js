// ESPN v2 API — no API key, direct browser calls (CORS *)
// 순위: site.web.api.espn.com/apis/v2/sports/soccer/{league}/standings
// 일정: site.api.espn.com/apis/site/v2/sports/soccer/{league}/teams/{id}/schedule

const LEAGUE_SLUGS = {
  'EPL':      'eng.1',
  '라리가':   'esp.1',
  '분데스리가': 'ger.1',
  '세리에A':  'ita.1',
  'K리그':    'kleague', // kleague.com 공식 API (별도 처리)
  'MLS':      'usa.1',
};

const SPURS_ID     = '367';    // Tottenham Hotspur (ESPN ID)
const LAFC_ID      = '18966';  // Los Angeles FC (ESPN ID)
const SON_ESPN_ID  = '149945'; // Son Heung-Min (ESPN athlete ID)
const SPURS_LEAGUE = 'eng.1';
const LAFC_LEAGUE  = 'usa.1';

// MLS Cup 우승팀 ESPN ID — 챔피언 결정 후 추가
// 예: 2025: '18966'  (LAFC가 우승했을 경우)
const MLS_CUP_CHAMPIONS = {
  // 2025: '...',
  // 2026: '...',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const KST_OFFSET = 9 * 60 * 60 * 1000;

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

async function espnFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const EMPTY_SON_STATS = { goals: '—', assists: '—', apps: '—' };

// 손흥민 스탯 — ESPN MLS 통계, season 파라미터로 연도별 조회
async function fetchSonStats(season) {
  const cacheKey = `son_stats_${season ?? 'cur'}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const seasonParam = season ? `?season=${season}` : '';
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/soccer/${LAFC_LEAGUE}/athletes/${SON_ESPN_ID}/overview${seasonParam}`;
    const res = await fetch(url);
    if (!res.ok) return EMPTY_SON_STATS;
    const json = await res.json();

    const stats = json.statistics ?? {};
    const names = stats.names ?? [];
    const splits = Array.isArray(stats.splits) ? stats.splits : [];

    const mlsSplit = splits.find(s =>
      s.leagueSlug === LAFC_LEAGUE && String(s.teamId) === LAFC_ID
    );
    if (!mlsSplit) return EMPTY_SON_STATS;

    const vals = mlsSplit.stats ?? [];
    const m = {};
    names.forEach((name, i) => { m[name] = vals[i] ?? '—'; });

    const data = {
      goals:   m.totalGoals  ?? '—',
      assists: m.goalAssists ?? '—',
      apps:    m.starts      ?? '—',
    };
    setCache(cacheKey, data);
    return data;
  } catch {
    return EMPTY_SON_STATS;
  }
}

function getManualSonStats() {
  const cached = getCache('son_stats_manual', THIRTY_DAYS_MS);
  return cached ?? { goals: '—', assists: '—', apps: '—' };
}

function saveManualSonStats(data) {
  setCache('son_stats_manual', data);
}

// 리그 순위 — ESPN v2 (K리그는 kleague.com 공식 API)
async function fetchStandings(leagueName, season) {
  const slug = LEAGUE_SLUGS[leagueName];
  if (!slug) return [];
  if (slug === 'kleague') return fetchKLeagueStandings();

  const cacheKey = `standings_${slug}_${season ?? 'cur'}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const seasonParam = season ? `&season=${season}` : '';
  const url = `https://site.web.api.espn.com/apis/v2/sports/soccer/${slug}/standings?region=us&lang=en&contentorigin=espn${seasonParam}`;
  const json = await espnFetch(url);
  if (!json) return [];

  const data = parseStandingsJson(json);
  if (data.length) setCache(cacheKey, data);
  return data;
}

async function fetchKLeagueStandings() {
  const cached = getCache('standings_kleague');
  if (cached) return cached;

  try {
    const res = await fetch('/api/kleague');
    if (!res.ok) return [];
    const json = await res.json();
    const league1 = json?.data?.league1 ?? [];
    const data = league1
      .sort((a, b) => a.rank - b.rank)
      .map(t => ({
        rank:   t.rank,
        name:   t.teamName,
        teamId: t.teamId,
        points: t.gainPoint,
        played: t.gameCount,
        win:    t.winCnt,
        draw:   t.tieCnt,
        lose:   t.lossCnt,
        group:  null,
      }));
    if (data.length) setCache('standings_kleague', data);
    return data;
  } catch {
    return [];
  }
}

function parseStandingsJson(json) {
  const children = json.children ?? [];
  if (!children.length) return [];

  return children.flatMap(child => {
    const entries = child.standings?.entries ?? [];
    const groupName = children.length > 1
      ? (/eastern|east/i.test(child.name) ? '동부' : /western|west/i.test(child.name) ? '서부' : child.name)
      : null;

    return entries
      .map(e => {
        const stats = {};
        (e.stats ?? []).forEach(s => { if (s.value !== undefined) stats[s.name] = s.value; });
        return {
          rank:   stats.rank   ?? 0,
          name:   e.team?.displayName ?? '—',
          teamId: e.team?.id,
          points: stats.points ?? 0,
          played: stats.gamesPlayed ?? 0,
          win:    stats.wins   ?? 0,
          draw:   stats.ties   ?? 0,
          lose:   stats.losses ?? 0,
          group:  groupName,
        };
      })
      .sort((a, b) => a.rank - b.rank);
  });
}

// 팀 경기 일정 — 스코어보드 날짜 범위로 미래 경기 조회
// /teams/{id}/schedule 은 이미 치른 경기만 반환하므로 scoreboard 방식 사용
async function fetchTeamFixtures(league, teamId, cacheKey) {
  if (!teamId) return [];
  const cached = getCache(cacheKey);
  if (Array.isArray(cached)) return cached;

  const now = new Date();
  const toStr = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const start = toStr(now);
  const end = `${now.getFullYear()}1231`;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${start}-${end}&limit=500`;
  const json = await espnFetch(url);
  if (!json?.events) return [];

  const events = json.events
    .filter(e => (e.competitions?.[0]?.competitors ?? []).some(c => c.team?.id === teamId))
    .map(e => {
      const comp = e.competitions?.[0];
      const home = comp?.competitors?.find(c => c.homeAway === 'home');
      const away = comp?.competitors?.find(c => c.homeAway === 'away');
      return {
        ts: new Date(e.date).getTime(),
        fixture: { date: e.date },
        teams: {
          home: { name: home?.team?.displayName ?? '—' },
          away: { name: away?.team?.displayName ?? '—' },
        },
      };
    })
    .sort((a, b) => a.ts - b.ts);

  if (events.length) setCache(cacheKey, events);
  return events;
}

async function fetchSpursFixtures() {
  return fetchTeamFixtures(SPURS_LEAGUE, SPURS_ID, 'spurs_fixtures');
}

async function fetchLafcFixtures() {
  return fetchTeamFixtures(LAFC_LEAGUE, LAFC_ID, 'lafc_fixtures');
}
