// ESPN unofficial API — no API key required
// Proxy via /api/football for server-side KST-day caching

const LEAGUE_SLUGS = {
  'EPL':    'eng.1',
  '라리가':  'esp.1',
  '분데스리가': 'ger.1',
  '세리에A': 'ita.1',
  'K리그':   'kor.1',
  'MLS':    'usa.1',
};

const SPURS_ID  = '367';   // Tottenham Hotspur (ESPN)
const LAFC_ID   = '18966'; // Los Angeles FC (ESPN)
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

async function apiFetch(path) {
  try {
    const res = await fetch(`/api/football?path=${encodeURIComponent(path)}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// 손흥민 스탯 — ESPN 선수 통계가 불안정해서 수동 입력 우선
async function fetchSonStats() {
  return getManualSonStats();
}

function getManualSonStats() {
  const cached = getCache('son_stats_manual', THIRTY_DAYS_MS);
  return cached ?? { goals: '—', assists: '—', apps: '—', rating: '—' };
}

function saveManualSonStats(data) {
  setCache('son_stats_manual', data);
}

// 리그 순위 — ESPN standings
async function fetchStandings(leagueName) {
  const slug = LEAGUE_SLUGS[leagueName];
  if (!slug) return [];

  const cacheKey = `standings_${slug}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const json = await apiFetch(`/${slug}/standings`);
  if (!json) return [];

  const data = parseStandingsJson(json);
  if (data.length) setCache(cacheKey, data);
  return data;
}

function parseStandingsJson(json) {
  const s = json?.standings;
  if (!s) return [];

  // MLS 등 컨퍼런스 분리 리그
  if (s.groups?.length > 0) {
    return s.groups.flatMap(group => {
      const groupName = /east/i.test(group.name) ? '동부'
                      : /west/i.test(group.name) ? '서부'
                      : group.name ?? null;
      const entries = group.standings?.entries ?? group.entries ?? [];
      return entries.map((e, i) => parseEntry(e, groupName, i + 1));
    });
  }

  // 단일 그룹
  const entries = s.entries ?? [];
  return entries.map((e, i) => parseEntry(e, null, i + 1));
}

function parseEntry(entry, group, fallbackRank) {
  const stats = {};
  (entry.stats ?? []).forEach(s => { stats[s.name] = s.value; });
  return {
    rank:   stats.rank ?? fallbackRank ?? 0,
    name:   entry.team?.displayName ?? '—',
    teamId: entry.team?.id,
    points: stats.points ?? 0,
    played: stats.gamesPlayed ?? 0,
    win:    stats.wins ?? 0,
    draw:   stats.ties ?? 0,
    lose:   stats.losses ?? 0,
    group,
  };
}

// 팀 경기 일정 — ESPN team schedule (past 3 + next 3)
async function fetchTeamFixtures(league, teamId, cacheKey) {
  if (!teamId) return { past: [], next: [] };
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const json = await apiFetch(`/${league}/teams/${teamId}/schedule`);
  if (!json?.events) return { past: [], next: [] };

  const now = Date.now();
  const events = json.events.map(e => {
    const comp = e.competitions?.[0];
    const isCompleted = comp?.status?.type?.completed === true;
    const home = comp?.competitors?.find(c => c.homeAway === 'home');
    const away = comp?.competitors?.find(c => c.homeAway === 'away');
    return {
      fixture: { date: e.date },
      teams: {
        home: { name: home?.team?.displayName ?? '—' },
        away: { name: away?.team?.displayName ?? '—' },
      },
      goals: isCompleted ? {
        home: home?.score ?? '0',
        away: away?.score ?? '0',
      } : null,
      _ts: new Date(e.date).getTime(),
    };
  });

  const past = events.filter(e => e._ts < now).slice(-3);
  const next = events.filter(e => e._ts >= now).slice(0, 3);
  // _ts는 렌더링에 불필요하므로 제거
  const clean = arr => arr.map(({ _ts, ...rest }) => rest);

  const data = { past: clean(past), next: clean(next) };
  setCache(cacheKey, data);
  return data;
}

async function fetchSpursFixtures() {
  return fetchTeamFixtures(SPURS_LEAGUE, SPURS_ID, 'spurs_fixtures');
}

async function fetchLafcFixtures() {
  return fetchTeamFixtures(LAFC_LEAGUE, LAFC_ID, 'lafc_fixtures');
}
