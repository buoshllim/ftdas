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

async function initDataTab() {
  if (dataInitialized) return;
  dataInitialized = true;

  loadSonStats();
  loadStandings('EPL');
  loadFixtures();

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
      rating: document.getElementById('input-rating').value || '—',
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
  document.getElementById('son-rating').textContent = data.rating;
}

async function loadStandings(league) {
  const tbody = document.getElementById('standings-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">불러오는 중...</td></tr>';

  const rows = await fetchStandings(league);

  if (!rows.length) {
    // If no API key, show placeholder
    tbody.innerHTML = `
      <tr><td colspan="6" class="loading">
        API 키를 설정하면 실시간 순위를 볼 수 있어요!<br>
        <small>data.js에서 API_KEY를 입력해주세요</small>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(t => `
    <tr class="${t.teamId === SPURS_ID ? 'highlight-row' : ''}">
      <td class="rank-num">${t.rank}</td>
      <td class="team-name">${t.name}</td>
      <td><strong>${t.points}</strong></td>
      <td>${t.win}</td>
      <td>${t.draw}</td>
      <td>${t.lose}</td>
    </tr>
  `).join('');
}

async function loadFixtures() {
  const el = document.getElementById('fixtures-content');

  const data = await fetchSpursFixtures();

  if (!data || (!data.next?.length && !data.past?.length)) {
    el.innerHTML = `<div class="loading">API 키를 설정하면 경기 일정을 볼 수 있어요!</div>`;
    return;
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  const allFixtures = [
    ...(data.past || []).slice(-3).map(f => ({ ...f, isPast: true })),
    ...(data.next || []).slice(0, 3).map(f => ({ ...f, isPast: false })),
  ];

  el.innerHTML = allFixtures.map(f => {
    const home = f.teams.home.name;
    const away = f.teams.away.name;
    const homeG = f.goals?.home ?? '';
    const awayG = f.goals?.away ?? '';
    const score = f.isPast ? `${homeG} - ${awayG}` : 'vs';
    return `
      <div class="fixture-item">
        <div class="fixture-date">${formatDate(f.fixture.date)}</div>
        <div class="fixture-teams">
          <span>${home}</span>
          <span class="fixture-score">${score}</span>
          <span>${away}</span>
        </div>
      </div>
    `;
  }).join('');
}
