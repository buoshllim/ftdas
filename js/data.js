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

// 손흥민 스탯 — ESPN MLS 통계 자동, 실패 시 수동 입력 폴백
async function fetchSonStats() {
  const cached = getCache('son_stats');
  if (cached) return cached;

  try {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/soccer/${LAFC_LEAGUE}/athletes/${SON_ESPN_ID}/overview`;
    const res = await fetch(url);
    if (!res.ok) return getManualSonStats();
    const json = await res.json();

    const stats = json.statistics ?? {};
    const names = stats.names ?? [];
    const splits = Array.isArray(stats.splits) ? stats.splits : [];

    // MLS LAFC 시즌 스탯만 추출
    const mlsSplit = splits.find(s =>
      s.leagueSlug === LAFC_LEAGUE && String(s.teamId) === LAFC_ID
    );
    if (!mlsSplit) return getManualSonStats();

    const vals = mlsSplit.stats ?? [];
    const m = {};
    names.forEach((name, i) => { m[name] = vals[i] ?? '—'; });

    const data = {
      goals:   m.totalGoals  ?? '—',
      assists: m.goalAssists ?? '—',
      apps:    m.starts      ?? '—',
    };
    setCache('son_stats', data);
    return data;
  } catch {
    return getManualSonStats();
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
async function fetchStandings(leagueName) {
  const slug = LEAGUE_SLUGS[leagueName];
  if (!slug) return [];
  if (slug === 'kleague') return fetchKLeagueStandings();

  const cacheKey = `standings_${slug}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = `https://site.web.api.espn.com/apis/v2/sports/soccer/${slug}/standings?region=us&lang=en&contentorigin=espn`;
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

// 팀 경기 일정 — ESPN team schedule (past 3 + next 3)
async function fetchTeamFixtures(league, teamId, cacheKey) {
  if (!teamId) return { past: [], next: [] };
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}/schedule`;
  const json = await espnFetch(url);
  if (!json?.events) return { past: [], next: [] };

  const now = Date.now();
  const events = json.events.map(e => {
    const comp = e.competitions?.[0];
    const isCompleted = comp?.status?.type?.completed === true;
    const home = comp?.competitors?.find(c => c.homeAway === 'home');
    const away = comp?.competitors?.find(c => c.homeAway === 'away');
    return {
      _ts: new Date(e.date).getTime(),
      fixture: { date: e.date },
      teams: {
        home: { name: home?.team?.displayName ?? '—' },
        away: { name: away?.team?.displayName ?? '—' },
      },
      goals: isCompleted
        ? { home: home?.score ?? '0', away: away?.score ?? '0' }
        : null,
    };
  });

  const strip = arr => arr.map(({ _ts, ...rest }) => rest);
  const past = strip(events.filter(e => e._ts < now).slice(-3));
  const next = strip(events.filter(e => e._ts >= now).slice(0, 3));

  const data = { past, next };
  setCache(cacheKey, data);
  return data;
}

async function fetchSpursFixtures() {
  return fetchTeamFixtures(SPURS_LEAGUE, SPURS_ID, 'spurs_fixtures');
}

async function fetchLafcFixtures() {
  return fetchTeamFixtures(LAFC_LEAGUE, LAFC_ID, 'lafc_fixtures');
}
