// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'data') initDataTab();
  });
});

// Tactical Board
const board = new TacticalBoard('pitch-canvas');

// Home team
document.getElementById('home-formation-select').addEventListener('change', e => {
  if (e.target.value) board.applyFormation(e.target.value, 'home');
});
document.getElementById('home-add-btn').addEventListener('click', () => {
  board.saveSnapshot();
  const count = board.players.filter(p => p.team === 'home').length + 1;
  board.addPlayer('home', count, 'CM', 0.5, 0.5);
});
document.getElementById('home-reset-btn').addEventListener('click', () => {
  if (confirm('홈팀 작업을 모두 Reset 할까요?')) board.resetTeam('home');
});

// Away team
document.getElementById('away-formation-select').addEventListener('change', e => {
  if (e.target.value) board.applyFormation(e.target.value, 'away');
});
document.getElementById('away-add-btn').addEventListener('click', () => {
  board.saveSnapshot();
  const count = board.players.filter(p => p.team === 'away').length + 1;
  board.addPlayer('away', count, 'CM', 0.5, 0.5);
});
document.getElementById('away-reset-btn').addEventListener('click', () => {
  if (confirm('원정팀 작업을 모두 Reset 할까요?')) board.resetTeam('away');
});

// Mode toggle
const moveModeBtn = document.getElementById('mode-move-btn');
const arrowModeBtn = document.getElementById('mode-arrow-btn');
moveModeBtn.addEventListener('click', () => {
  board.setMode('move');
  moveModeBtn.classList.add('active');
  arrowModeBtn.classList.remove('active');
});
arrowModeBtn.addEventListener('click', () => {
  board.setMode('arrow');
  arrowModeBtn.classList.add('active');
  moveModeBtn.classList.remove('active');
});

document.getElementById('clear-arrows-btn').addEventListener('click', () => {
  if (confirm('모든 화살표를 삭제할까요?')) board.clearArrows();
});

// Undo / Redo
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

board.onHistoryChange = () => {
  undoBtn.disabled = board.history.length === 0;
  redoBtn.disabled = board.future.length === 0;
};
board.onHistoryChange();

undoBtn.addEventListener('click', () => board.undo());
redoBtn.addEventListener('click', () => board.redo());

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); board.undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); board.redo(); }
});


// --- Data Tab ---

let dataInitialized = false;
let currentLeague = 'EPL';
let currentSeason = null;
let currentSonSeason = null;

function defaultSeason(leagueName) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (['MLS', 'K리그'].includes(leagueName)) return y;
  // 유럽 리그: 8월부터 새 시즌 시작
  return m >= 8 ? y : y - 1;
}

function getLeagueSeasons(leagueName) {
  const def = defaultSeason(leagueName);
  if (leagueName === 'K리그') return [def]; // kleague API는 현재 시즌만 지원
  return [def - 1, def];
}

function seasonYearToLabel(leagueName, year) {
  if (['MLS', 'K리그'].includes(leagueName)) return String(year);
  return `${year}-${String(year + 1).slice(-2)}`;
}

function isSeasonComplete(leagueName, season) {
  if (leagueName === 'K리그') return false;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if (leagueName === 'MLS') return season < y;
  // 유럽: season Y → Y+1년 5월 하순 종료
  if (season + 1 < y) return true;
  if (season + 1 === y && (m > 5 || (m === 5 && d >= 20))) return true;
  return false;
}

function renderSeasonSelector(leagueName) {
  const el = document.getElementById('season-selector');
  const seasons = getLeagueSeasons(leagueName);
  if (!seasons) { el.innerHTML = ''; return; }

  el.innerHTML = seasons.map(s => {
    const label = seasonYearToLabel(leagueName, s);
    const ended = isSeasonComplete(leagueName, s);
    const active = s === currentSeason ? 'active' : '';
    const badge = ended ? '<span class="ended-badge">종료</span>' : '';
    return `<button class="season-btn ${active}" data-season="${s}">${label}${badge}</button>`;
  }).join('');

  el.querySelectorAll('.season-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSeason = parseInt(btn.dataset.season);
      loadStandings(currentLeague);
    });
  });
}

function renderSonSeasonSelector() {
  const el = document.getElementById('son-season-selector');
  const def = defaultSeason('MLS');
  const seasons = [def];

  el.innerHTML = seasons.map(s => {
    const ended = isSeasonComplete('MLS', s);
    const active = s === currentSonSeason ? 'active' : '';
    const badge = ended ? '<span class="ended-badge">종료</span>' : '';
    return `<button class="season-btn ${active}" data-season="${s}">MLS ${s}${badge}</button>`;
  }).join('');

  el.querySelectorAll('.season-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSonSeason = parseInt(btn.dataset.season);
      loadSonStats();
    });
  });
}

async function hardRefresh() {
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('ftdas_')) localStorage.removeItem(k);
  });
  await Promise.all([loadSonStats(), loadStandings(currentLeague), loadSpursFixtures(), loadLafcFixtures()]);
}

async function initDataTab() {
  if (dataInitialized) return;
  dataInitialized = true;

  document.getElementById('refresh-btn').addEventListener('click', hardRefresh);

  currentSonSeason = defaultSeason('MLS');
  loadSonStats();
  currentSeason = defaultSeason('EPL');
  loadStandings('EPL');
  loadSpursFixtures();
  loadLafcFixtures();

  document.querySelectorAll('.league-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.league-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLeague = btn.dataset.league;
      currentSeason = defaultSeason(currentLeague);
      loadStandings(currentLeague);
    });
  });
}

function seasonLabel(leagueName) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const calYear = ['MLS', 'K리그'];
  if (calYear.includes(leagueName)) return `${y}`;
  // 유럽 리그는 5월 하순(~20일)에 시즌 종료 → 그 이후는 다음 시즌 기준
  const nextSeason = m > 5 || (m === 5 && d >= 20);
  const start = nextSeason ? y : y - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

async function loadSonStats() {
  const data = await fetchSonStats(currentSonSeason);
  renderSonStats(data);
  renderSonSeasonSelector();
}

function renderSonStats(data) {
  document.getElementById('son-goals').textContent = data.goals;
  document.getElementById('son-assists').textContent = data.assists;
  document.getElementById('son-apps').textContent = data.apps;
}

async function loadStandings(league) {
  const tbody = document.getElementById('standings-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">불러오는 중...</td></tr>';

  renderSeasonSelector(league);

  const rows = await fetchStandings(league, currentSeason);

  if (rows === null) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">ESPN에서 지원하지 않는 리그예요.</td></tr>`;
    return;
  }
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">아직 시즌 일정이 없어요.</td></tr>`;
    return;
  }

  const completed = isSeasonComplete(league, currentSeason);
  const hasGroups = rows.some(t => t.group);
  const showTrophy = completed && !hasGroups && league !== 'UCL';
  const mlsCupId = MLS_CUP_CHAMPIONS[currentSeason];
  const uclChampId = UCL_CHAMPIONS[currentSeason];

  // 챔피언 배너 (UCL / MLS Cup)
  const banner = document.getElementById('champion-banner');
  if (league === 'UCL' && uclChampId && completed) {
    const champTeam = rows.find(t => String(t.teamId) === String(uclChampId));
    if (champTeam) {
      banner.textContent = `🏆 ${seasonYearToLabel(league, currentSeason)} UCL 챔피언: ${champTeam.name}`;
      banner.classList.remove('hidden');
    } else { banner.classList.add('hidden'); }
  } else if (league === 'MLS' && mlsCupId && completed) {
    const champTeam = rows.find(t => String(t.teamId) === String(mlsCupId));
    if (champTeam) {
      banner.textContent = `🏆 ${currentSeason} MLS Cup 챔피언: ${champTeam.name}`;
      banner.classList.remove('hidden');
    } else { banner.classList.add('hidden'); }
  } else {
    banner.classList.add('hidden');
  }

  let html = '';
  let lastGroup = null;
  rows.forEach(t => {
    if (t.group && t.group !== lastGroup) {
      html += `<tr><td colspan="6" style="padding:8px 6px 4px;font-size:11px;color:var(--gold);font-weight:700;">— ${t.group} 지구 —</td></tr>`;
      lastGroup = t.group;
    }
    const isLeagueChamp = showTrophy && t.rank === 1;
    const isDivisionChamp = completed && hasGroups && t.rank === 1;
    const isMlsCup = league === 'MLS' && mlsCupId && String(t.teamId) === String(mlsCupId);
    const isUclChamp = league === 'UCL' && uclChampId && String(t.teamId) === String(uclChampId);
    const trophy = isLeagueChamp || isMlsCup || isUclChamp ? '🏆 ' : (isDivisionChamp ? '⭐ ' : '');
    html += `<tr>
      <td class="rank-num">${t.rank}</td>
      <td class="team-name">${trophy}${t.name}</td>
      <td><strong>${t.points}</strong></td>
      <td>${t.win}</td>
      <td>${t.draw}</td>
      <td>${t.lose}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function renderFixtures(el, events) {
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
    const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' });
    return `${date} ${time}`;
  };

  const now = Date.now();
  const list = Array.isArray(events) ? events : [];
  const upcoming = list.filter(e => e.ts >= now).slice(0, 3);

  if (!upcoming.length) {
    el.innerHTML = `<div class="loading">예정된 경기가 없어요.</div>`;
    return;
  }

  el.innerHTML = upcoming.map(f => `
    <div class="fixture-item">
      <div class="fixture-date">${formatDate(f.fixture.date)}</div>
      <div class="fixture-teams">
        <span>${f.teams.home.name}</span>
        <span class="fixture-score">vs</span>
        <span>${f.teams.away.name}</span>
      </div>
    </div>
  `).join('');
}

async function loadSpursFixtures() {
  const el = document.getElementById('spurs-fixtures-content');
  const data = await fetchSpursFixtures();
  renderFixtures(el, data);
  document.getElementById('spurs-season').textContent = seasonLabel('EPL');
}

async function loadLafcFixtures() {
  const el = document.getElementById('lafc-fixtures-content');
  const data = await fetchLafcFixtures();
  renderFixtures(el, data);
  document.getElementById('lafc-season').textContent = seasonLabel('MLS');
}
