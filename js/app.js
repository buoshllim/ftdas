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

document.getElementById('formation-select').addEventListener('change', e => {
  if (e.target.value) {
    const team = document.getElementById('team-select').value;
    board.applyFormation(e.target.value, team);
  }
});

document.getElementById('add-player-btn').addEventListener('click', () => {
  const team = document.getElementById('team-select').value;
  const count = board.players.filter(p => p.team === team).length + 1;
  board.addPlayer(team, count, 'CM', 0.5, 0.5);
});

document.getElementById('clear-arrows-btn').addEventListener('click', () => {
  board.clearArrows();
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('전술 보드를 초기화할까요?')) board.reset();
});

// Apply default formation on load
board.applyFormation('4-3-3', 'home');

// --- Data Tab ---

let dataInitialized = false;
let currentLeague = 'EPL';

const REFRESH_KEY = 'ftdas_last_refresh';
const ONE_DAY = 24 * 60 * 60 * 1000;

const DEV_MODE = true; // 개발 중 — 완성 후 false로 변경

function updateRefreshBtn() {
  const btn = document.getElementById('refresh-btn');
  const status = document.getElementById('refresh-status');
  if (DEV_MODE) {
    btn.disabled = false;
    status.textContent = '개발 모드 (제한 없음)';
    return;
  }
  const last = parseInt(localStorage.getItem(REFRESH_KEY) || '0');
  const elapsed = Date.now() - last;
  const remaining = ONE_DAY - elapsed;

  if (last && remaining > 0) {
    btn.disabled = true;
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    status.textContent = `다음 새로고침까지 ${h}시간 ${m}분`;
  } else {
    btn.disabled = false;
    status.textContent = last ? '새로고침 가능!' : '';
  }
}

async function hardRefresh() {
  // Clear all API caches
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('ftdas_') && k !== 'ftdas_last_refresh' && k !== 'ftdas_son_stats_manual') {
      localStorage.removeItem(k);
    }
  });
  localStorage.setItem(REFRESH_KEY, String(Date.now()));
  updateRefreshBtn();

  await Promise.all([loadSonStats(), loadStandings(currentLeague), loadSpursFixtures(), loadLafcFixtures()]);
}

async function initDataTab() {
  if (dataInitialized) return;
  dataInitialized = true;

  updateRefreshBtn();
  document.getElementById('refresh-btn').addEventListener('click', hardRefresh);

  loadSonStats();
  loadStandings('EPL');
  loadSpursFixtures();
  loadLafcFixtures();

  document.querySelectorAll('.league-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.league-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLeague = btn.dataset.league;
      loadStandings(currentLeague);
    });
  });

  // Son stats edit
  document.getElementById('son-edit-btn').addEventListener('click', () => {
    document.getElementById('son-edit-form').classList.toggle('hidden');
  });

  document.getElementById('son-save-btn').addEventListener('click', () => {
    const data = {
      goals: document.getElementById('input-goals').value || '—',
      assists: document.getElementById('input-assists').value || '—',
      apps: document.getElementById('input-apps').value || '—',
    };
    saveManualSonStats(data);
    renderSonStats(data);
    document.getElementById('son-edit-form').classList.add('hidden');
  });
}

async function loadSonStats() {
  const data = await fetchSonStats();
  renderSonStats(data);
}

function renderSonStats(data) {
  document.getElementById('son-goals').textContent = data.goals;
  document.getElementById('son-assists').textContent = data.assists;
  document.getElementById('son-apps').textContent = data.apps;
}

async function loadStandings(league) {
  const tbody = document.getElementById('standings-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">불러오는 중...</td></tr>';

  const rows = await fetchStandings(league);

  if (rows === null) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">ESPN에서 지원하지 않는 리그예요.</td></tr>`;
    return;
  }
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">데이터를 불러오지 못했어요. 새로고침 눌러봐!</td></tr>`;
    return;
  }

  let html = '';
  let lastGroup = null;
  rows.forEach(t => {
    if (t.group && t.group !== lastGroup) {
      html += `<tr><td colspan="6" style="padding:8px 6px 4px;font-size:11px;color:var(--gold);font-weight:700;">— ${t.group} 지구 —</td></tr>`;
      lastGroup = t.group;
    }
    html += `<tr class="${t.teamId === SPURS_ID ? 'highlight-row' : ''}">
      <td class="rank-num">${t.rank}</td>
      <td class="team-name">${t.name}</td>
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
  const upcoming = (events || [])
    .filter(e => e.ts >= now)
    .slice(0, 3);

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
}

async function loadLafcFixtures() {
  const el = document.getElementById('lafc-fixtures-content');
  const data = await fetchLafcFixtures();
  renderFixtures(el, data);
}
