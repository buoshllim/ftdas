const POSITIONS = {
  GK: 'GK', CB: 'CB', LB: 'LB', RB: 'RB', CDM: 'CDM',
  CM: 'CM', CAM: 'CAM', LM: 'LM', RM: 'RM', LW: 'LW',
  RW: 'RW', ST: 'ST', CF: 'CF'
};

const FORMATIONS = {
  '4-3-3': [
    { num: 1, pos: 'GK', x: 0.5, y: 0.92 },
    { num: 2, pos: 'RB', x: 0.82, y: 0.75 },
    { num: 5, pos: 'CB', x: 0.62, y: 0.75 },
    { num: 6, pos: 'CB', x: 0.38, y: 0.75 },
    { num: 3, pos: 'LB', x: 0.18, y: 0.75 },
    { num: 8, pos: 'CM', x: 0.75, y: 0.55 },
    { num: 4, pos: 'CM', x: 0.5,  y: 0.55 },
    { num: 11, pos: 'CM', x: 0.25, y: 0.55 },
    { num: 7, pos: 'RW', x: 0.78, y: 0.3 },
    { num: 9, pos: 'ST', x: 0.5,  y: 0.25 },
    { num: 10, pos: 'LW', x: 0.22, y: 0.3 },
  ],
  '4-4-2': [
    { num: 1, pos: 'GK', x: 0.5, y: 0.92 },
    { num: 2, pos: 'RB', x: 0.82, y: 0.75 },
    { num: 5, pos: 'CB', x: 0.62, y: 0.75 },
    { num: 6, pos: 'CB', x: 0.38, y: 0.75 },
    { num: 3, pos: 'LB', x: 0.18, y: 0.75 },
    { num: 7, pos: 'RM', x: 0.82, y: 0.52 },
    { num: 8, pos: 'CM', x: 0.62, y: 0.52 },
    { num: 4, pos: 'CM', x: 0.38, y: 0.52 },
    { num: 11, pos: 'LM', x: 0.18, y: 0.52 },
    { num: 9, pos: 'ST', x: 0.65, y: 0.28 },
    { num: 10, pos: 'ST', x: 0.35, y: 0.28 },
  ],
  '4-2-3-1': [
    { num: 1, pos: 'GK', x: 0.5, y: 0.92 },
    { num: 2, pos: 'RB', x: 0.82, y: 0.75 },
    { num: 5, pos: 'CB', x: 0.62, y: 0.75 },
    { num: 6, pos: 'CB', x: 0.38, y: 0.75 },
    { num: 3, pos: 'LB', x: 0.18, y: 0.75 },
    { num: 4, pos: 'CDM', x: 0.62, y: 0.58 },
    { num: 8, pos: 'CDM', x: 0.38, y: 0.58 },
    { num: 7, pos: 'RW', x: 0.78, y: 0.38 },
    { num: 10, pos: 'CAM', x: 0.5,  y: 0.38 },
    { num: 11, pos: 'LW', x: 0.22, y: 0.38 },
    { num: 9, pos: 'ST', x: 0.5,  y: 0.22 },
  ],
  '3-5-2': [
    { num: 1, pos: 'GK', x: 0.5, y: 0.92 },
    { num: 5, pos: 'CB', x: 0.7,  y: 0.75 },
    { num: 4, pos: 'CB', x: 0.5,  y: 0.75 },
    { num: 6, pos: 'CB', x: 0.3,  y: 0.75 },
    { num: 2, pos: 'RM', x: 0.88, y: 0.55 },
    { num: 8, pos: 'CM', x: 0.67, y: 0.55 },
    { num: 10, pos: 'CM', x: 0.5,  y: 0.55 },
    { num: 7, pos: 'CM', x: 0.33, y: 0.55 },
    { num: 3, pos: 'LM', x: 0.12, y: 0.55 },
    { num: 9, pos: 'ST', x: 0.65, y: 0.28 },
    { num: 11, pos: 'ST', x: 0.35, y: 0.28 },
  ],
};

class TacticalBoard {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.players = [];
    this.arrows = [];
    this.dragging = null;
    this.drawingArrow = null;
    this.nextId = 1;

    this.mode = 'move'; // 'move' | 'arrow'
    this.history = [];
    this.future = [];
    this.onHistoryChange = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindEvents();
  }

  resize() {
    const container = this.canvas.parentElement;
    const maxW = Math.min(container ? container.clientWidth : window.innerWidth - 32, 680);
    const ratio = 1.5;
    this.canvas.width = maxW;
    this.canvas.height = maxW / ratio;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this.render();
  }

  addPlayer(team = 'home', num = null, pos = 'CM', x = 0.5, y = 0.5) {
    const id = this.nextId++;
    const number = num ?? (this.players.filter(p => p.team === team).length + 1);
    this.players.push({ id, team, num: number, pos, x, y });
    this.renderPlayerList();
    this.render();
    return id;
  }

  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);
    this.arrows = this.arrows.filter(a => a.fromId !== id && a.toId !== id);
    this.renderPlayerList();
    this.render();
  }

  applyFormation(name, team = 'home') {
    const slots = FORMATIONS[name];
    if (!slots) return;
    this.saveSnapshot();
    this.players = this.players.filter(p => p.team !== team);
    this.arrows = this.arrows.filter(a => {
      const from = this.players.find(p => p.id === a.fromId);
      return from && from.team !== team;
    });
    const yFlip = team === 'away';
    slots.forEach(slot => {
      const y = yFlip ? 1 - slot.y : slot.y;
      this.addPlayer(team, slot.num, slot.pos, slot.x, y);
    });
  }

  // --- Drawing ---

  drawPitch() {
    const { ctx, W, H } = this;
    // Background
    ctx.fillStyle = '#2d8a4e';
    ctx.fillRect(0, 0, W, H);

    // Stripe pattern
    const stripeW = W / 10;
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(i * stripeW, 0, stripeW, H);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;

    const pad = W * 0.04;
    const pw = W - pad * 2;
    const ph = H - pad * 2;

    // Outer boundary
    ctx.strokeRect(pad, pad, pw, ph);

    // Center line
    ctx.beginPath();
    ctx.moveTo(pad, H / 2);
    ctx.lineTo(pad + pw, H / 2);
    ctx.stroke();

    // Center circle
    const cr = pw * 0.1;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, cr, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Penalty boxes
    const boxW = pw * 0.46;
    const boxH = ph * 0.18;
    // Top
    ctx.strokeRect(pad + (pw - boxW) / 2, pad, boxW, boxH);
    // Bottom
    ctx.strokeRect(pad + (pw - boxW) / 2, pad + ph - boxH, boxW, boxH);

    // Goal boxes
    const gboxW = pw * 0.22;
    const gboxH = ph * 0.07;
    ctx.strokeRect(pad + (pw - gboxW) / 2, pad, gboxW, gboxH);
    ctx.strokeRect(pad + (pw - gboxW) / 2, pad + ph - gboxH, gboxW, gboxH);

    // Penalty spots
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(W / 2, pad + ph * 0.12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W / 2, pad + ph * 0.88, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawArrows() {
    this.arrows.forEach(arrow => {
      let fx, fy;
      if (arrow.fromId != null) {
        const from = this.players.find(p => p.id === arrow.fromId);
        if (!from) return;
        fx = from.x * this.W;
        fy = from.y * this.H;
      } else {
        fx = arrow.fx * this.W;
        fy = arrow.fy * this.H;
      }
      this.drawArrow(fx, fy, arrow.tx * this.W, arrow.ty * this.H, arrow.color || '#f5a623');
    });
    if (this.drawingArrow) {
      this.ctx.globalAlpha = 0.5;
      this.drawArrow(
        this.drawingArrow.fx, this.drawingArrow.fy,
        this.drawingArrow.tx, this.drawingArrow.ty,
        this.drawingArrow.color
      );
      this.ctx.globalAlpha = 1;
    }
  }

  drawArrow(fx, fy, tx, ty, color) {
    const { ctx } = this;
    const dx = tx - fx, dy = ty - fy;
    const angle = Math.atan2(dy, dx);
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 10) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const hs = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - hs * Math.cos(angle - 0.4), ty - hs * Math.sin(angle - 0.4));
    ctx.lineTo(tx - hs * Math.cos(angle + 0.4), ty - hs * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  drawPlayers() {
    const { ctx, W, H } = this;
    const r = Math.min(W, H) * 0.038;

    this.players.forEach(p => {
      const x = p.x * W;
      const y = p.y * H;
      const color = p.team === 'home' ? '#4a9eff' : '#ff4a4a';
      const shadow = p.team === 'home' ? '#1a5fb4' : '#b41a1a';

      // Shadow
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      // Circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Number
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${r * 0.75}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.num, x, y - r * 0.12);

      // Position text below circle
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${r * 0.55}px sans-serif`;
      ctx.fillText(p.pos, x, y + r + r * 0.6);

      // Player name if set
      if (p.name) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `${r * 0.5}px sans-serif`;
        ctx.fillText(p.name, x, y + r + r * 1.3);
      }
    });
  }

  render() {
    this.drawPitch();
    this.drawArrows();
    this.drawPlayers();
  }

  // --- Events ---

  getPlayerAt(cx, cy) {
    const r = Math.min(this.W, this.H) * 0.045;
    return this.players.find(p => {
      const dx = p.x * this.W - cx;
      const dy = p.y * this.H - cy;
      return Math.sqrt(dx * dx + dy * dy) < r;
    });
  }

  getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const src = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
    return {
      x: src.clientX - rect.left,
      y: src.clientY - rect.top,
    };
  }

  bindEvents() {
    const onDown = (e) => {
      if (e.touches && e.touches.length > 1) return;
      const { x, y } = this.getPos(e);
      const p = this.getPlayerAt(x, y);

      if (this.mode === 'move') {
        if (p) { e.preventDefault(); this.saveSnapshot(); this.dragging = p; }
      } else {
        e.preventDefault();
        if (p) {
          const color = p.team === 'home' ? '#4a9eff' : '#ff4a4a';
          this.drawingArrow = { fromId: p.id, fx: p.x * this.W, fy: p.y * this.H, tx: x, ty: y, color };
        } else {
          this.drawingArrow = { fx: x, fy: y, tx: x, ty: y, color: '#f5a623' };
        }
      }
    };

    const onMove = (e) => {
      if (e.touches && e.touches.length > 1) return;
      if (this.dragging || this.drawingArrow) {
        e.preventDefault();
        const { x, y } = this.getPos(e);
        if (this.dragging) {
          this.dragging.x = Math.max(0, Math.min(1, x / this.W));
          this.dragging.y = Math.max(0, Math.min(1, y / this.H));
        } else {
          this.drawingArrow.tx = x;
          this.drawingArrow.ty = y;
        }
        this.render();
      }
    };

    const onUp = (e) => {
      const { x, y } = this.getPos(e);
      let needsRender = false;

      if (this.mode === 'move' && this.dragging) {
        if (x < 0 || x > this.W || y < 0 || y > this.H) {
          this.removePlayer(this.dragging.id); // render 내부 호출
        }
      } else if (this.drawingArrow) {
        const dist = Math.sqrt((x - this.drawingArrow.fx) ** 2 + (y - this.drawingArrow.fy) ** 2);
        if (dist < 8) {
          // 탭 → 화살표 삭제 시도
          const idx = this.getArrowAt(this.drawingArrow.fx, this.drawingArrow.fy);
          if (idx !== -1 && confirm('이 화살표를 삭제할까요?')) {
            this.saveSnapshot();
            this.arrows.splice(idx, 1);
            needsRender = true;
          }
        } else {
          // 드래그 → 화살표 생성
          this.saveSnapshot();
          const arrow = { tx: x / this.W, ty: y / this.H, color: this.drawingArrow.color };
          if (this.drawingArrow.fromId != null) {
            arrow.fromId = this.drawingArrow.fromId;
          } else {
            arrow.fx = this.drawingArrow.fx / this.W;
            arrow.fy = this.drawingArrow.fy / this.H;
          }
          this.arrows.push(arrow);
          needsRender = true;
        }
        this.drawingArrow = null;
      }

      this.dragging = null;
      if (needsRender) this.render();
    };

    this.canvas.addEventListener('mousedown', onDown);
    this.canvas.addEventListener('mousemove', onMove);
    this.canvas.addEventListener('mouseup', onUp);
    this.canvas.addEventListener('touchstart', onDown, { passive: false });
    this.canvas.addEventListener('touchmove', onMove, { passive: false });
    this.canvas.addEventListener('touchend', onUp);
  }

  cloneState() {
    return {
      players: this.players.map(p => ({ ...p })),
      arrows: this.arrows.map(a => ({ ...a })),
    };
  }

  saveSnapshot() {
    this.history.push(this.cloneState());
    this.future = [];
    if (this.onHistoryChange) this.onHistoryChange();
  }

  undo() {
    if (!this.history.length) return;
    this.future.push(this.cloneState());
    const state = this.history.pop();
    this.players = state.players;
    this.arrows = state.arrows;
    this.dragging = null;
    this.drawingArrow = null;
    this.renderPlayerList();
    this.render();
    if (this.onHistoryChange) this.onHistoryChange();
  }

  redo() {
    if (!this.future.length) return;
    this.history.push(this.cloneState());
    const state = this.future.pop();
    this.players = state.players;
    this.arrows = state.arrows;
    this.dragging = null;
    this.drawingArrow = null;
    this.renderPlayerList();
    this.render();
    if (this.onHistoryChange) this.onHistoryChange();
  }

  setMode(mode) {
    this.mode = mode;
    this.canvas.style.cursor = mode === 'arrow' ? 'crosshair' : 'default';
  }

  resetTeam(team) {
    this.saveSnapshot();
    this.arrows = this.arrows.filter(a => {
      const from = this.players.find(p => p.id === a.fromId);
      return from && from.team !== team;
    });
    this.players = this.players.filter(p => p.team !== team);
    this.renderPlayerList();
    this.render();
  }

  clearArrows() {
    this.saveSnapshot();
    this.arrows = [];
    this.render();
  }

  distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
  }

  getArrowAt(x, y) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      let fx, fy;
      if (arrow.fromId != null) {
        const from = this.players.find(p => p.id === arrow.fromId);
        if (!from) continue;
        fx = from.x * this.W;
        fy = from.y * this.H;
      } else {
        fx = arrow.fx * this.W;
        fy = arrow.fy * this.H;
      }
      if (this.distToSegment(x, y, fx, fy, arrow.tx * this.W, arrow.ty * this.H) < 10) return i;
    }
    return -1;
  }

  renderPlayerList() {
    ['home', 'away'].forEach(team => {
      const el = document.getElementById(`${team}-list`);
      if (!el) return;
      el.innerHTML = '';
      this.players.filter(p => p.team === team).forEach(p => {
        const row = document.createElement('div');
        row.className = 'player-item';
        row.innerHTML = `
          <div class="player-dot" style="background:${p.team === 'home' ? '#4a9eff' : '#ff4a4a'}"></div>
          <span>${p.num}</span>
          <input type="text" value="${p.name || ''}" placeholder="${p.pos}" data-id="${p.id}" />
          <button class="delete-btn" data-id="${p.id}">✕</button>
        `;
        row.querySelector('input').addEventListener('input', (e) => {
          const player = this.players.find(pl => pl.id === parseInt(e.target.dataset.id));
          if (player) { player.name = e.target.value; this.render(); }
        });
        row.querySelector('.delete-btn').addEventListener('click', (e) => {
          this.saveSnapshot();
          this.removePlayer(parseInt(e.target.dataset.id));
        });
        el.appendChild(row);
      });
    });
  }
}
