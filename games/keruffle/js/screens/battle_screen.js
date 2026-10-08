'use strict';
// ---------------------------------------------------------------------------
// VS splash, the in-battle screen (pause menu, move list, training options).
// ---------------------------------------------------------------------------

class VersusScreen {
  constructor(s) {
    this.s = s;
    this.t = 0;
    this.p1 = new Puppet(s.p1.char, s.p1.pal);
    this.p2 = new Puppet(s.p2.char, s.p2.pal);
    if (s.p2.palette) this.p2.pal = s.p2.palette;
    this.p1.play('intro', 0);
    this.p2.play('intro', 0);
    this.parts = new Particles();
    this.leaving = false;
  }
  enter() {
    Sound.playSong('versus');
  }
  touchMode() {
    return 'off';
  }
  update() {
    this.t++;
    this.p1.update();
    this.p2.update();
    this.parts.update();
    if (this.t === 4) {
      try {
        StageKit.prewarm(this.s.stage);
      } catch (e) {
        /* stage caches are optional */
      }
    }
    if (this.t === 20) {
      Sound.sfx('hitX');
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * TAU, sp = 4 + Math.random() * 10;
        this.parts.add({ type: Math.random() < 0.5 ? 'star' : 'shard', x: 640, y: 330, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.95, size: 8 + Math.random() * 8, life: 50 + Math.random() * 20, color: U.choose(['#ffd23f', '#ffffff', '#ff5a7a']), rot: Math.random() * TAU, vr: 0.2 });
      }
    }
    const m = Input.menu(-1);
    const tap = Input.tapped();
    if (!this.leaving && (this.t >= 175 || (this.t > 40 && (m.ok || m.start || tap)))) {
      this.leaving = true;
      Game.go(() => new BattleScreen(this.s));
    }
  }
  render(ctx) {
    const t = this.t;
    const C1 = CHARS[this.s.p1.char], C2 = CHARS[this.s.p2.char];
    const col2 = this.s.p2.palette ? '#4a2a7a' : C2.color;
    const k = U.ease.out3(Math.min(1, t / 16));
    // split background
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, 1280, 720);
    const seam = (y) => 700 - y * 0.18;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(seam(0) - (1 - k) * 800, -10);
    ctx.lineTo(seam(720) - (1 - k) * 800, 730);
    ctx.lineTo(-10, 730);
    ctx.closePath();
    ctx.fillStyle = U.shade(C1.color, -0.3);
    ctx.fill();
    ctx.clip();
    UI.dots(ctx, '#ffffff', 0.12, 24, t * 2);
    this.speed(ctx, t, 1);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(1290, -10);
    ctx.lineTo(seam(0) + 24 + (1 - k) * 800, -10);
    ctx.lineTo(seam(720) + 24 + (1 - k) * 800, 730);
    ctx.lineTo(1290, 730);
    ctx.closePath();
    ctx.fillStyle = U.shade(col2, -0.3);
    ctx.fill();
    ctx.clip();
    UI.dots(ctx, '#ffffff', 0.12, 24, -t * 2);
    this.speed(ctx, t, -1);
    ctx.restore();
    // lightning seam
    if (k >= 1) {
      ctx.save();
      ctx.lineJoin = 'round';
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const y = -10 + i * 62;
        pts.push([seam(y) + 12 + (U.hash(i * 7 + Math.floor(t / 3)) - 0.5) * 30, y]);
      }
      for (const [w, c] of [[14, INK], [7, '#ffd23f'], [3, '#ffffff']]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
      }
      ctx.restore();
    }
    // fighters slide in
    const sl = U.ease.out3(U.clamp((t - 4) / 22, 0, 1));
    ctx.save();
    ctx.globalAlpha = 0.25;
    Draw.ellipse(ctx, 330 - (1 - sl) * 600, 668, 190, 26, 0, '#000000', 0);
    Draw.ellipse(ctx, 950 + (1 - sl) * 600, 668, 190, 26, 0, '#000000', 0);
    ctx.restore();
    const s1 = 1.85 * (C1.vsScale || 1), s2 = 1.85 * (C2.vsScale || 1);
    this.p1.draw(ctx, 330 - (1 - sl) * 600, 668, s1, 1);
    this.p2.draw(ctx, 950 + (1 - sl) * 600, 668, s2, -1);
    // names
    const nk = U.ease.back(U.clamp((t - 14) / 16, 0, 1));
    ctx.save();
    ctx.translate(40, 600);
    ctx.scale(nk, nk);
    Draw.text(ctx, C1.name, 0, 30, { size: 84, align: 'left', fill: '#ffffff', lw: 14, extrude: 7, extrudeColor: INK });
    Draw.text(ctx, C1.title || '', 4, 88, { size: 22, align: 'left', font: FONT_UI, fill: '#ffe9f3', lw: 5 });
    ctx.restore();
    ctx.save();
    ctx.translate(1240, 600);
    ctx.scale(nk, nk);
    Draw.text(ctx, this.s.p2.name || C2.name, 0, 30, { size: this.s.p2.name ? 64 : 84, align: 'right', fill: this.s.p2.name ? '#d9b3ff' : '#ffffff', lw: 14, extrude: 7, extrudeColor: INK });
    Draw.text(ctx, this.s.p2.name ? 'Your darkest rival...' : C2.title || '', -4, 88, { size: 22, align: 'right', font: FONT_UI, fill: '#ffe9f3', lw: 5 });
    ctx.restore();
    // VS
    if (t >= 18) {
      const vk = t < 30 ? U.ease.back((t - 18) / 12) : 1;
      const wob = Math.sin(t * 0.25) * 0.04;
      ctx.save();
      ctx.translate(640 + (t < 26 ? (Math.random() - 0.5) * 16 : 0), 320);
      ctx.scale(vk * (1 + Math.max(0, 26 - t) * 0.04), vk * (1 + Math.max(0, 26 - t) * 0.04));
      ctx.rotate(-0.12 + wob);
      Draw.star(ctx, 0, 0, 150, 92, 12, '#ff5a7a', 7, INK, t * 0.01);
      Draw.text(ctx, 'VS', 0, 8, { size: 170, fill: '#ffd23f', lw: 18, extrude: 10, extrudeColor: '#9c1f45' });
      ctx.restore();
    }
    this.parts.draw(ctx, 0, 0, 0);
    this.parts.draw(ctx, 0, 0, 1);
    // stage / ladder info
    const S = STAGES[this.s.stage];
    let top = S ? 'STAGE: ' + S.name.toUpperCase() : '';
    if (this.s.mode === 'arcade' && this.s.arcade) top = 'BATTLE ' + (this.s.arcade.idx + 1) + ' / ' + this.s.arcade.order.length + '   •   ' + top;
    Draw.roundRect(ctx, 640 - 330, 18, 660, 46, 23, 'rgba(20,10,35,0.8)', 4);
    Draw.text(ctx, top, 640, 42, { size: 26, fill: '#ffffff', lw: 0 });
  }
  speed(ctx, t, dir) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 26; i++) {
      const y = U.hash(i * 3.1) * 720;
      const len = 120 + U.hash(i * 5.7) * 260;
      const sp = 14 + U.hash(i * 1.3) * 20;
      let x = ((U.hash(i * 9.1) * 1800 + t * sp) % 1800) - 300;
      if (dir < 0) x = 1280 - x - len;
      ctx.fillRect(x, y, len, 3 + (i % 3));
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
class BattleScreen {
  constructor(s) {
    this.s = s;
    this.b = new Battle(Flow.battleOptions(s));
    this.t = 0;
    this.paused = false;
    this.menu = null;
    this.moveList = null;
    this.ended = false;
  }
  enter() {
    Sound.playSong(this.b.stage.music || 'rooftop');
  }
  touchMode() {
    return this.paused || this.moveList ? 'menu' : 'battle';
  }
  exit() {
    Sound.duck(false);
  }

  pause() {
    this.paused = true;
    Sound.duck(true);
    Sound.sfx('menuOk');
    const s = this.s;
    const items = [{ label: 'RESUME', action: () => this.resume() }, { label: 'MOVE LIST', action: () => (this.moveList = new MoveList(this.b.fighters.map((f) => f.charId), 0)) }];
    if (s.mode === 'training') {
      const modes = ['stand', 'crouch', 'jump', 'block', 'cpu'];
      const opts = s.trainingOpts;
      const setDummy = (d) => {
        const i = (modes.indexOf(opts.dummy) + d + modes.length) % modes.length;
        opts.dummy = modes[i];
        this.b.fighters[1].ctrl = new DummyController(opts.dummy);
      };
      items.push({ label: 'DUMMY', value: () => opts.dummy.toUpperCase(), left: () => setDummy(-1), right: () => setDummy(1) });
      items.push({ label: 'POW METER', value: () => (opts.meter ? 'FULL' : 'NORMAL'), left: () => (opts.meter = !opts.meter), right: () => (opts.meter = !opts.meter) });
      items.push({ label: 'RESET POSITIONS', action: () => this.resetTraining() });
    } else {
      items.push({ label: 'RESTART MATCH', action: () => Game.go(() => new BattleScreen(s)) });
    }
    items.push({ label: 'CHARACTER SELECT', action: () => Flow.toSelect() });
    items.push({ label: 'MAIN MENU', action: () => Flow.title() });
    const n = items.length;
    this.menu = new Menu(items, { y: 360 - (n * 58) / 2 + 30, gap: 58, w: 420, h: 48, size: 24, onBack: () => this.resume() });
  }
  resume() {
    this.paused = false;
    this.menu = null;
    Sound.duck(false);
  }
  resetTraining() {
    const b = this.b;
    const [a, c] = b.fighters;
    const ma = a.meter, mc = c.meter;
    a.resetRound(STAGE_W / 2 - 190, 1);
    c.resetRound(STAGE_W / 2 + 190, -1);
    a.meter = ma;
    c.meter = mc;
    for (const f of b.fighters) f.inputEnabled = true;
    b.projs = [];
    FX.clear();
    this.resume();
  }

  update() {
    this.t++;
    if (this.moveList) {
      if (this.moveList.update()) this.moveList = null;
      return;
    }
    if (this.paused) {
      this.menu.update();
      return;
    }
    if (!this.b.over && this.b.phase !== 'over' && Input.pausePressed()) {
      this.pause();
      return;
    }
    this.b.update();
    if (this.b.phase === 'over' && !this.jingle) {
      this.jingle = true;
      Sound.playSong('victory');
    }
    if (this.b.over && !this.ended) {
      this.ended = true;
      Flow.battleOver(this.b);
    }
  }

  render(ctx) {
    this.b.render(ctx);
    if (this.paused || this.moveList) {
      ctx.fillStyle = 'rgba(16,8,30,0.66)';
      ctx.fillRect(0, 0, 1280, 720);
    }
    if (this.moveList) {
      this.moveList.draw(ctx);
      return;
    }
    if (this.paused) {
      UI.header(ctx, 'PAUSED', 110, this.t, '#7a5cff', 50);
      this.menu.draw(ctx);
      UI.hint(ctx, 'J / ENTER: select    ←/→: change    K / ESC: resume', 700, 'TAP TO CHOOSE');
    }
  }
}

// ---------------------------------------------------------------------------
// Move list overlay. update() returns true when closed.
class MoveList {
  constructor(chars, idx = 0) {
    this.chars = chars.filter((c, i) => chars.indexOf(c) === i);
    this.idx = Math.min(idx, this.chars.length - 1);
    this.t = 0;
  }
  update() {
    this.t++;
    const m = Input.menu(-1);
    if (this.chars.length > 1 && (m.left || m.right)) {
      this.idx = (this.idx + 1) % this.chars.length;
      Sound.sfx('menuMove');
    }
    if (m.back || m.ok || m.start || Input.mouse.clicked) {
      Sound.sfx('menuBack');
      return true;
    }
    return false;
  }
  static command(id) {
    const parts = [];
    let body = id;
    const touch = typeof Touch !== 'undefined' && Touch.active;
    if (body === 'SUP') return touch ? [['pill', 'SUPER']] : [['key', 'K'], ['plus'], ['key', 'L'], ['or'], ['key', 'I']];
    if (body === 'THROW') return touch ? [['pill', 'THROW']] : [['key', 'J'], ['plus'], ['key', 'K'], ['or'], ['key', 'U']];
    if (body[0] === 'j') {
      parts.push(['tag', 'AIR']);
      body = body.slice(1);
    }
    const dirs = { 2: '↓', 6: '→', 4: '←' };
    if (dirs[body[0]]) {
      parts.push(['dir', dirs[body[0]]]);
      parts.push(['plus']);
    }
    const b = body.replace(/^[0-9]/, '');
    // on touch the caps read L / H / S, colored like the on-screen buttons
    if (touch) parts.push(['key', b, { L: '#7fe3ff', H: '#ff8a9a', S: '#ffd23f' }[b]]);
    else parts.push(['key', { L: 'J', H: 'K', S: 'L' }[b] || b]);
    return parts;
  }
  static tags(m) {
    const t = [];
    const lv = new Set(m.hits.map((h) => h.level));
    if (m.type === 'super') t.push('SUPER');
    if (m.cmdGrab) t.push('COMMAND GRAB');
    if (lv.has('low') && !m.air) t.push('LOW');
    if (lv.has('high') && !m.air) t.push('OVERHEAD');
    const k = m.ai && m.ai.kind;
    if (k === 'aa' || m.airInv) t.push('ANTI-AIR');
    if (k === 'proj') t.push('PROJECTILE');
    if (k === 'trap') t.push('TRAP');
    if (k === 'heal') t.push('HEALS');
    if (k === 'teleport') t.push('TELEPORT');
    if (m.counter) t.push('COUNTER');
    if (m.armor) t.push('ARMOR');
    if (m.inv) t.push('INVINCIBLE');
    if (m.hits.some((h) => h.kd)) t.push('KNOCKDOWN');
    if (m.tags) t.push(...m.tags);
    return t.slice(0, 3);
  }
  drawCmd(ctx, parts, x, y) {
    for (const [kind, v, c] of parts) {
      if (kind === 'pill') {
        Draw.roundRect(ctx, x, y - 15, 84, 30, 15, v === 'SUPER' ? '#ffb300' : '#c9b6ff', 3);
        Draw.text(ctx, v, x + 42, y + 1, { size: 17, fill: INK, lw: 0 });
        x += 92;
      } else if (kind === 'key') {
        const col = c || (v === 'J' ? '#7fe3ff' : v === 'K' ? '#ff8a9a' : v === 'L' ? '#ffd23f' : '#c9b6ff');
        Draw.keycap(ctx, v, x + 15, y, 30, 30, col);
        x += 36;
      } else if (kind === 'dir') {
        Draw.keycap(ctx, v, x + 15, y, 30, 30, '#e8e0f5');
        x += 36;
      } else if (kind === 'plus') {
        Draw.text(ctx, '+', x + 6, y, { size: 20, font: FONT_UI, fill: '#ffffff', lw: 4 });
        x += 16;
      } else if (kind === 'or') {
        Draw.text(ctx, 'or', x + 12, y, { size: 15, font: FONT_UI, fill: '#cbbbe6', lw: 0 });
        x += 26;
      } else if (kind === 'tag') {
        Draw.roundRect(ctx, x, y - 12, 44, 24, 8, '#4dabff', 3);
        Draw.text(ctx, v, x + 22, y + 1, { size: 14, font: FONT_UI, fill: '#ffffff', lw: 0 });
        x += 52;
      }
    }
    return x;
  }
  draw(ctx) {
    const C = CHARS[this.chars[this.idx]];
    const x = 130, y = 64, w = 1020, h = 600;
    UI.panel(ctx, x, y, w, h, '#24173a');
    Draw.roundRect(ctx, x, y, w, 76, 18, C.color, 5);
    Portrait.head(ctx, C, C.palettes[0], x + 62, y + 44, 36, 1, 'happy', this.t);
    Draw.text(ctx, C.name + ' — MOVE LIST', x + 116, y + 40, { size: 40, align: 'left', fill: '#ffffff', lw: 8 });
    Draw.text(ctx, C.style || '', x + w - 24, y + 40, { size: 24, align: 'right', fill: '#ffffff', lw: 6 });
    // legend
    Draw.text(ctx, 'J = LIGHT   K = HEAVY   L = SPECIAL   (P2: Num1 Num2 Num3 • Pad: X Y B)', x + w / 2, y + 100, { size: 15, font: FONT_UI, fill: '#cbbbe6', lw: 0 });
    const order = ['5S', '6S', '4S', '2S', 'jS', 'j6S', 'j4S', 'j2S', 'SUP', 'THROW'];
    const special = order.filter((id) => C.moves[id]);
    let yy = y + 138;
    for (const id of special) {
      const m = C.moves[id];
      const cx = this.drawCmd(ctx, MoveList.command(id), x + 30, yy);
      Draw.text(ctx, m.name || id, Math.max(cx + 14, x + 300), yy + 1, { size: 24, align: 'left', fill: m.type === 'super' ? '#ffd23f' : '#ffffff', lw: 5 });
      let tx = x + w - 30;
      for (const tg of MoveList.tags(m).reverse()) {
        const tw = Draw.measure(ctx, tg, 13, FONT_UI) + 18;
        tx -= tw;
        Draw.roundRect(ctx, tx, yy - 12, tw, 24, 12, tg === 'SUPER' ? '#ff9a3c' : '#5b3f8c', 3);
        Draw.text(ctx, tg, tx + tw / 2, yy + 1, { size: 13, font: FONT_UI, fill: '#ffffff', lw: 0 });
        tx -= 8;
      }
      yy += 40;
    }
    // normals, compact two columns
    yy += 6;
    Draw.text(ctx, 'NORMALS', x + 30, yy, { size: 22, align: 'left', fill: '#7fe3ff', lw: 5 });
    yy += 30;
    const normals = ['5L', '2L', '6L', '5H', '2H', '6H', '4H', 'jL', 'jH', 'j2H'].filter((id) => C.moves[id]);
    normals.forEach((id, i) => {
      const m = C.moves[id];
      const col = i % 2, row = Math.floor(i / 2);
      const nx = x + 30 + col * 500, ny = yy + row * 34;
      const cx = this.drawCmd(ctx, MoveList.command(id), nx, ny);
      const tg = MoveList.tags(m).filter((q) => q !== 'KNOCKDOWN')[0];
      Draw.text(ctx, (m.name || id) + (tg ? '  (' + tg.toLowerCase() + ')' : ''), Math.max(cx + 10, nx + 140), ny + 1, { size: 17, font: FONT_UI, align: 'left', fill: '#efe6ff', lw: 0, weight: 600 });
    });
    const hint = this.chars.length > 1 ? '←/→: other fighter    ANY BUTTON: close' : 'ANY BUTTON: close';
    UI.hint(ctx, hint, y + h - 20, 'TAP TO CLOSE');
  }
}
