'use strict';
// ---------------------------------------------------------------------------
// Results, settings, how-to-play and the arcade ladder / continue / ending.
// ---------------------------------------------------------------------------

function speechBubble(ctx, x, y, w, h, tailX, tailY, text, t) {
  ctx.save();
  const wob = Math.sin(t * 0.05) * 2;
  ctx.translate(0, wob);
  Draw.roundRect(ctx, x + 6, y + 8, w, h, 26, 'rgba(10,4,20,0.35)', 0);
  ctx.beginPath();
  Draw.roundRectPath(ctx, x, y, w, h, 26);
  ctx.moveTo(x + 50, y + h - 2);
  ctx.lineTo(tailX, tailY);
  ctx.lineTo(x + 110, y + h - 2);
  Draw.fillStroke(ctx, '#ffffff', 5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 48, y + h - 9, 64, 8);
  const lines = Draw.wrap(ctx, text, w - 50, 28, FONT_UI, 700);
  lines.slice(0, 3).forEach((ln, i) => Draw.text(ctx, ln, x + w / 2, y + h / 2 + (i - (Math.min(3, lines.length) - 1) / 2) * 34, { size: 28, font: FONT_UI, fill: INK, lw: 0 }));
  ctx.restore();
}

class ResultsScreen {
  constructor(s, opts = {}) {
    this.s = s;
    this.opts = opts;
    this.t = 0;
    const w = s.lastWinner || 0;
    this.side = w;
    const wp = w === 0 ? s.p1 : s.p2;
    this.C = CHARS[wp.char];
    this.pup = new Puppet(wp.char, wp.pal);
    if (w === 1 && s.p2.palette) this.pup.pal = s.p2.palette;
    this.pup.play('win', 0);
    this.quote = U.choose(this.C.quotes && this.C.quotes.length ? this.C.quotes : ['Good fight!']);
    this.parts = new Particles();
    const items = [];
    if (opts.arcadeWin) {
      items.push({ label: 'NEXT BATTLE', action: () => Flow.arcadeNext() });
      items.push({ label: 'MAIN MENU', action: () => Flow.title() });
    } else {
      items.push({ label: 'REMATCH', action: () => Flow.versus() });
      items.push({ label: 'CHARACTER SELECT', action: () => Flow.toSelect() });
      items.push({ label: 'MAIN MENU', action: () => Flow.title() });
    }
    this.menu = new Menu(items, { x: 920, y: 452, w: 400, h: 52, gap: 66, size: 26 });
    const lost = s.mode !== 'vs' && w === 1;
    this.headline = s.mode === 'vs' ? 'PLAYER ' + (w + 1) + ' WINS!' : lost ? 'YOU LOSE...' : (this.C.name + ' WINS!');
    this.lost = lost;
  }
  enter() {
    if (Sound.current !== 'victory') Sound.playSong('victory');
    for (let i = 0; i < 3; i++) setTimeout(() => this.confetti(), i * 300);
  }
  confetti() {
    if (this.lost) return;
    for (let i = 0; i < 40; i++) {
      this.parts.add({ type: 'shard', x: 100 + Math.random() * 1080, y: -20, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, grav: 0.05, drag: 0.99, size: 8 + Math.random() * 8, life: 200, color: U.choose(UI.colors), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.3 });
    }
  }
  update() {
    this.t++;
    this.pup.update();
    this.parts.update();
    if (this.t === 330) Sound.playSong('results');
    if (this.t > 30) this.menu.update();
  }
  render(ctx) {
    const t = this.t;
    const col = this.lost ? '#3b3555' : this.C.color;
    ctx.fillStyle = U.shade(col, -0.3);
    ctx.fillRect(0, 0, 1280, 720);
    ctx.save();
    ctx.globalAlpha = 0.5;
    Draw.sunburst(ctx, 330, 420, 1300, 20, t * 0.003, U.shade(col, -0.3), U.shade(col, -0.12));
    ctx.restore();
    UI.dots(ctx, '#ffffff', 0.06, 26, t);
    // podium + winner
    Draw.ellipse(ctx, 330, 650, 230, 40, 0, U.shade(col, -0.5), 5);
    Draw.ellipse(ctx, 330, 642, 230, 40, 0, U.shade(col, 0.1), 5);
    const sc = 1.65 * (this.C.vsScale || 1);
    const k = U.ease.back(Math.min(1, t / 20));
    this.pup.draw(ctx, 330, 642, sc * k, 1);
    // headline
    const hk = U.ease.back(U.clamp((t - 6) / 16, 0, 1));
    ctx.save();
    ctx.translate(640, 80);
    ctx.scale(hk, hk);
    ctx.rotate(-0.03);
    Draw.text(ctx, this.headline, 0, 0, { size: 86, fill: this.lost ? '#b8b0d8' : '#ffd23f', lw: 14, extrude: 8, extrudeColor: INK });
    ctx.restore();
    // quote
    if (t > 24) speechBubble(ctx, 660, 160, 520, 170, 560, 300, this.quote, t);
    // stats
    const st = this.s.lastStats && this.s.lastStats[this.side];
    if (st) {
      UI.panel(ctx, 700, 352, 440, 70, 'rgba(20,10,35,0.75)', { shine: false, lw: 4 });
      Draw.text(ctx, 'MAX COMBO: ' + st.maxCombo + '     DAMAGE: ' + Math.round(st.dmg), 920, 388, { size: 24, fill: '#ffffff', lw: 5 });
    }
    this.menu.draw(ctx);
    this.parts.draw(ctx, 0, 0, 1);
    this.parts.draw(ctx, 0, 0, 0);
  }
}

// ---------------------------------------------------------------------------
class SettingsScreen {
  constructor() {
    this.t = 0;
    const S = Game.settings;
    const save = () => Game.saveSettings();
    const cyc = (key, vals) => (d) => {
      const i = vals.indexOf(S[key]);
      S[key] = vals[(i + d + vals.length) % vals.length];
      save();
    };
    const vol = (key) => (d) => {
      S[key] = U.clamp(S[key] + d, 0, 10);
      save();
      if (key === 'sfx') Sound.sfx('hitM');
    };
    const diff = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];
    const items = [
      { label: 'MUSIC VOLUME', value: () => this.volBar(S.music), left: () => vol('music')(-1), right: () => vol('music')(1) },
      { label: 'SFX VOLUME', value: () => this.volBar(S.sfx), left: () => vol('sfx')(-1), right: () => vol('sfx')(1) },
      { label: 'CPU LEVEL', value: () => diff[S.difficulty], left: () => cyc('difficulty', [0, 1, 2, 3])(-1), right: () => cyc('difficulty', [0, 1, 2, 3])(1) },
      { label: 'ROUND TIME', value: () => (S.time ? String(S.time) : '∞'), left: () => cyc('time', [60, 99, 0])(-1), right: () => cyc('time', [60, 99, 0])(1) },
      { label: 'ROUNDS TO WIN', value: () => String(S.rounds), left: () => cyc('rounds', [1, 2, 3])(-1), right: () => cyc('rounds', [1, 2, 3])(1) },
      { label: 'SCREEN SHAKE', value: () => (S.shake ? 'ON' : 'OFF'), left: () => cyc('shake', [true, false])(1), right: () => cyc('shake', [true, false])(1) },
      { label: 'FULLSCREEN', value: () => (document.fullscreenElement ? 'ON' : 'OFF'), left: () => Game.toggleFullscreen(), right: () => Game.toggleFullscreen() },
      { label: 'BACK', action: () => Flow.title(), color: '#36d6c3' },
    ];
    this.menu = new Menu(items, { y: 150, gap: 62, w: 620, h: 50, size: 25, onBack: () => Flow.title() });
  }
  volBar(v) {
    return '■'.repeat(v) + '□'.repeat(10 - v);
  }
  enter() {
    Sound.playSong('select');
  }
  update() {
    this.t++;
    this.menu.update();
  }
  render(ctx) {
    UI.stripes(ctx, this.t, '#2e2350', '#352a5c', 64, 0.4);
    UI.header(ctx, 'SETTINGS', 70, this.t, '#7a5cff', 50);
    this.menu.draw(ctx);
    UI.hint(ctx, '↑/↓: choose    ←/→: change    K / ESC: back', 704, 'TAP A SETTING TO CHANGE IT');
  }
}

// ---------------------------------------------------------------------------
class HowToScreen {
  constructor() {
    this.t = 0;
    this.page = 0;
    this.pages = ['CONTROLS', 'MOVING & BLOCKING', 'ATTACKING', 'POW & SUPERS'];
    this.demo = CHARS.mochi && CHARS.mochi.moves ? new Puppet('mochi', 0) : new Puppet('jett', 0);
  }
  enter() {
    Sound.playSong('select');
  }
  update() {
    this.t++;
    this.demo.update();
    const m = Input.menu(-1);
    if (m.right || (m.ok && this.page < this.pages.length - 1)) {
      this.page = Math.min(this.pages.length - 1, this.page + 1);
      Sound.sfx('menuMove');
    } else if (m.left) {
      this.page = Math.max(0, this.page - 1);
      Sound.sfx('menuMove');
    } else if (m.back || (m.ok && this.page === this.pages.length - 1) || Input.mouse.clicked) {
      if (Input.mouse.clicked && this.page < this.pages.length - 1) {
        this.page++;
        Input.mouse.clicked = false;
        return;
      }
      Sound.sfx('menuBack');
      Flow.title();
    }
  }
  line(ctx, x, y, text, size = 22, col = '#efe6ff') {
    Draw.text(ctx, text, x, y, { size, font: FONT_UI, align: 'left', fill: col, lw: 0, weight: 600 });
  }
  keys(ctx, list, x, y, col) {
    for (const k of list) {
      const w = Math.max(40, k.length * 13 + 18);
      Draw.keycap(ctx, k, x + w / 2, y, w, 40, col || '#ffd23f');
      x += w + 8;
    }
    return x;
  }
  render(ctx) {
    const t = this.t;
    UI.stripes(ctx, t, '#25385e', '#2b416b', 64, 0.4);
    UI.header(ctx, 'HOW TO PLAY', 62, t, '#36d6c3', 46);
    UI.panel(ctx, 90, 120, 1100, 520, '#1f2440');
    Draw.text(ctx, (this.page + 1) + '/' + this.pages.length + '  ' + this.pages[this.page], 640, 158, { size: 34, fill: '#ffd23f', lw: 7 });
    const X = 140;
    const touch = Touch.active;
    if (this.page === 0 && touch) {
      this.line(ctx, X, 215, 'TOUCH CONTROLS', 24, '#ff8a9a');
      this.line(ctx, X, 262, 'Put your thumb down anywhere on the LEFT half and drag: a stick appears under it.');
      this.line(ctx, X, 300, 'Drag sideways to walk (away from your foe blocks), up to jump, down to crouch.', 21, '#cbe6ff');
      const btn = (x, y, r, col, label) => {
        Draw.circle(ctx, x, y, r, '#2a1d3d', 4, col);
        Draw.text(ctx, label, x, y + 1, { size: r * 0.42, fill: '#ffffff', lw: 4 });
      };
      btn(X + 40, 380, 34, '#7fe3ff', 'LIGHT');
      this.line(ctx, X + 86, 380, 'fast jabs');
      btn(X + 330, 380, 34, '#ff8a9a', 'HEAVY');
      this.line(ctx, X + 376, 380, 'big hits');
      btn(X + 620, 380, 34, '#ffd23f', 'SPECIAL');
      this.line(ctx, X + 666, 380, 'signature moves');
      btn(X + 40, 460, 28, '#c9b6ff', 'THROW');
      this.line(ctx, X + 86, 460, 'up close, beats blocking');
      btn(X + 420, 460, 28, '#ffb300', 'SUPER');
      this.line(ctx, X + 466, 460, 'when the POW meter is full');
      this.line(ctx, X, 540, 'Hold a direction on the stick while pressing a button for other moves (↓ + LIGHT, → + SPECIAL...).', 19, '#cbe6ff');
      this.line(ctx, X, 575, 'The ❚❚ button pauses the fight and opens your MOVE LIST. Menus are tapped directly.', 19, '#cbe6ff');
      this.line(ctx, X, 610, 'Play with your phone held sideways. A keyboard or gamepad works too.', 19, '#cbe6ff');
    } else if (this.page === 0) {
      this.line(ctx, X, 215, 'PLAYER 1 (keyboard)', 24, '#ff8a9a');
      let x = this.keys(ctx, ['W', 'A', 'S', 'D'], X, 262, '#e8e0f5');
      this.line(ctx, x + 10, 262, 'move / jump / crouch');
      x = this.keys(ctx, ['J'], X, 314, '#7fe3ff');
      this.line(ctx, x + 6, 314, 'LIGHT');
      x = this.keys(ctx, ['K'], X + 190, 314, '#ff8a9a');
      this.line(ctx, x + 6, 314, 'HEAVY');
      x = this.keys(ctx, ['L'], X + 390, 314, '#ffd23f');
      this.line(ctx, x + 6, 314, 'SPECIAL');
      x = this.keys(ctx, ['U'], X, 366, '#c9b6ff');
      this.line(ctx, x + 6, 366, 'THROW (or J+K)');
      x = this.keys(ctx, ['I'], X + 390, 366, '#c9b6ff');
      this.line(ctx, x + 6, 366, 'SUPER (or K+L)');
      this.line(ctx, X, 425, 'PLAYER 2 (keyboard)', 24, '#7fc6ff');
      x = this.keys(ctx, ['↑', '←', '↓', '→'], X, 470, '#e8e0f5');
      this.line(ctx, x + 10, 470, 'move');
      x = this.keys(ctx, ['Num1', 'Num2', 'Num3'], X + 430, 470, '#ffd23f');
      this.line(ctx, x + 10, 470, 'L / H / S');
      x = this.keys(ctx, ['Num4', 'Num5'], X, 522, '#c9b6ff');
      this.line(ctx, x + 10, 522, 'throw / super    (or , . / ; \')');
      this.line(ctx, X, 585, 'GAMEPAD: stick/d-pad move, A jump, X light, Y heavy, B special, LB throw, RB super, START pause', 19, '#cbe6ff');
      this.line(ctx, X, 615, 'ESC / ENTER pauses the fight. In 1-player modes any keyboard or pad controls Player 1.', 19, '#cbe6ff');
    } else if (this.page === 1) {
      const rows = [
        ['WALK', 'Hold forward or back. Hold ↑ to JUMP (diagonals for angled jumps).'],
        ['DASH', 'Double-tap forward to dash in, double-tap back to hop away.'],
        ['BLOCK', 'Hold BACK (away from your foe) to block high and mid attacks.'],
        ['LOWS', 'Sweeps and low kicks must be blocked CROUCHING (hold down-back).'],
        ['OVERHEADS', 'Jump-ins and overheads must be blocked STANDING.'],
        ['THROW', touch ? 'Up close tap THROW. Throws beat blocking!' : 'Up close press J+K (or U). Throws beat blocking!'],
        ['TECH', 'Got grabbed? Press throw right away to break free.'],
      ];
      rows.forEach(([a, b], i) => {
        Draw.roundRect(ctx, X, 200 + i * 60, 170, 42, 12, '#36d6c3', 4);
        Draw.text(ctx, a, X + 85, 222 + i * 60, { size: 22, fill: '#ffffff', lw: 5 });
        this.line(ctx, X + 190, 222 + i * 60, b, 21);
      });
    } else if (this.page === 2) {
      const rows = [
        [touch ? 'L  H  S' : 'J  K  L', 'Light, Heavy and Special attacks. Lights are fast, heavies hit hard.'],
        ['↓ / → / ←', 'Hold a direction while attacking for different moves (↓ = low).'],
        ['SPECIALS', touch ? 'SPECIAL + a direction gives each fighter their unique moves.' : 'Special (L) + a direction gives each fighter their unique moves.'],
        ['COMBOS', 'Chain LIGHT → HEAVY → SPECIAL when your attacks connect!'],
        ['AIR', 'Attack while jumping. Some fighters have air specials too.'],
        ['COUNTER', 'Hit someone while they start an attack for extra damage.'],
        ['MOVE LIST', "Pause during a fight to see your fighter's moves."],
      ];
      rows.forEach(([a, b], i) => {
        Draw.roundRect(ctx, X, 200 + i * 60, 170, 42, 12, '#ff5a7a', 4);
        Draw.text(ctx, a, X + 85, 222 + i * 60, { size: 20, fill: '#ffffff', lw: 5 });
        this.line(ctx, X + 190, 222 + i * 60, b, 21);
      });
    } else {
      // POW meter illustration
      const fill = (Math.sin(t * 0.03) * 0.5 + 0.5) * 100;
      Draw.roundRect(ctx, X, 210, 420, 30, 12, '#2a1d3d', 5);
      Draw.roundRect(ctx, X + 4, 214, (412 * fill) / 100, 22, 9, '#9b5cff', 0);
      Draw.text(ctx, 'POW', X + 470, 226, { size: 30, fill: '#ffd23f', lw: 6 });
      const rows = [
        'Your POW meter fills when you hit — and when you get hit.',
        touch ? 'When it is FULL, tap SUPER to unleash your super move!' : 'When it is FULL, press K+L (or I) to unleash your SUPER!',
        'Supers are invincible as they start and many turn into a',
        'big cinematic finisher if they connect. Cancel a combo into one!',
        'Every fighter plays differently: rushdown, zoner, grappler,',
        'counter-fighter... try them all in TRAINING mode.',
      ];
      rows.forEach((r, i) => this.line(ctx, X, 300 + i * 40, r, 22));
      this.demo.draw(ctx, 1010, 600, 1.4, -1);
    }
    UI.hint(ctx, '←/→: page    K / ESC: back', 690, 'TAP FOR THE NEXT PAGE');
  }
}

// ---------------------------------------------------------------------------
// Arcade: ladder between fights, continue screen, ending.
class LadderScreen {
  constructor(s) {
    this.s = s;
    this.t = 0;
    this.left = false;
  }
  enter() {
    Sound.playSong('select');
  }
  update() {
    this.t++;
    const m = Input.menu(-1);
    const tap = Input.tapped();
    if (!this.left && (this.t > 170 || (this.t > 25 && (m.ok || m.start || tap)))) {
      this.left = true;
      Flow.versus();
    }
    if (!this.left && m.back) {
      this.left = true;
      Flow.title();
    }
  }
  render(ctx) {
    const t = this.t, s = this.s, a = s.arcade;
    UI.stripes(ctx, t, '#3a1e63', '#432470', 64, 0.6);
    UI.header(ctx, 'ARCADE', 60, t, '#ff9a3c', 46);
    const n = a.order.length;
    const top = 140, step = Math.min(84, 470 / n);
    for (let i = 0; i < n; i++) {
      const o = a.order[n - 1 - i];
      const idx = n - 1 - i;
      const y = top + i * step;
      const C = CHARS[o.char];
      const cur = idx === a.idx, done = idx < a.idx;
      const x = 640;
      ctx.save();
      const sc = cur ? 1.1 + Math.sin(t * 0.12) * 0.03 : 1;
      ctx.translate(x, y + step / 2);
      ctx.scale(sc, sc);
      Draw.roundRect(ctx, -230, -step / 2 + 4, 460, step - 8, 16, cur ? '#ffd23f' : done ? '#3a3355' : '#5b3f8c', 4);
      const pal = o.boss ? Flow.shadowPalette(C.palettes[s.p1.pal]) : C.palettes[0];
      ctx.save();
      if (done) ctx.globalAlpha = 0.5;
      Portrait.head(ctx, C, pal, -180, 2, step * 0.36, 1, done ? 'ko' : 'normal', t);
      ctx.restore();
      Draw.text(ctx, (o.boss ? 'SHADOW ' : '') + C.name, -120, 2, { size: 30, align: 'left', fill: cur ? INK : done ? '#8a82a6' : '#ffffff', lw: cur ? 0 : 6 });
      if (done) Draw.text(ctx, 'K.O.', 190, 2, { size: 30, fill: '#ff5a7a', lw: 6 });
      if (cur) Draw.text(ctx, 'NEXT!', 190, 2, { size: 30, fill: '#ff5a7a', lw: 6 });
      ctx.restore();
    }
    // the player climbing
    const C = CHARS[s.p1.char];
    const cy = top + (n - 1 - a.idx) * step + step / 2;
    Portrait.head(ctx, C, C.palettes[s.p1.pal], 340, cy, 40, 1, 'angry', t);
    Draw.text(ctx, 'YOU', 340, cy + 56, { size: 24, fill: '#ff4d6d', lw: 6 });
    UI.hint(ctx, 'J / ENTER: fight!    K / ESC: quit', 704, 'TAP TO FIGHT!');
  }
}

class ContinueScreen {
  constructor(s) {
    this.s = s;
    this.t = 0;
    this.count = 9;
    this.pup = new Puppet(s.p1.char, s.p1.pal);
    this.pup.play('lose', 0);
    this.done = false;
  }
  enter() {
    Sound.playSong('results');
  }
  update() {
    this.t++;
    this.pup.update();
    if (this.done) return;
    if (this.t % 60 === 0) {
      this.count--;
      Sound.sfx('tick');
      if (this.count < 0) {
        this.done = true;
        Game.go(() => new GameOverScreen());
        return;
      }
    }
    const m = Input.menu(-1);
    if (m.ok || m.start || Input.mouse.clicked) {
      this.done = true;
      this.s.arcade.continues++;
      Sound.sfx('select');
      Flow.versus();
    } else if (m.back) this.t += 20;
  }
  render(ctx) {
    const t = this.t;
    ctx.fillStyle = '#140c24';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.save();
    ctx.globalAlpha = 0.4;
    Draw.sunburst(ctx, 640, 420, 1000, 18, t * 0.002, '#140c24', '#24183c');
    ctx.restore();
    this.pup.draw(ctx, 640, 640, 1.5, 1);
    Draw.text(ctx, 'CONTINUE?', 640, 120, { size: 96, fill: '#ffffff', lw: 14, extrude: 8, extrudeColor: '#5a1030' });
    const k = 1 + ((60 - (t % 60)) / 60) * 0.25;
    ctx.save();
    ctx.translate(640, 270);
    ctx.scale(k, k);
    Draw.text(ctx, String(Math.max(0, this.count)), 0, 0, { size: 130, fill: '#ffd23f', lw: 14 });
    ctx.restore();
    UI.hint(ctx, 'J / ENTER: continue!    K / ESC: hurry up', 704, 'TAP TO CONTINUE!');
  }
}

class GameOverScreen {
  constructor() {
    this.t = 0;
  }
  update() {
    this.t++;
    const m = Input.menu(-1);
    const tap = Input.tapped();
    if (this.t > 200 || (this.t > 40 && (m.ok || m.back || m.start || tap))) {
      if (!this.left) Flow.title();
      this.left = true;
    }
  }
  render(ctx) {
    ctx.fillStyle = '#0d0818';
    ctx.fillRect(0, 0, 1280, 720);
    const k = U.ease.back(Math.min(1, this.t / 25));
    ctx.save();
    ctx.translate(640, 340);
    ctx.scale(k, k);
    Draw.text(ctx, 'GAME OVER', 0, 0, { size: 120, fill: '#ff4d6d', lw: 14, extrude: 8, extrudeColor: '#3a0a1a' });
    ctx.restore();
  }
}

class EndingScreen {
  constructor(s) {
    this.s = s;
    this.t = 0;
    this.C = CHARS[s.p1.char];
    this.pup = new Puppet(s.p1.char, s.p1.pal);
    this.pup.play('win', 0);
    this.parts = new Particles();
    this.credits = [
      'KERFUFFLE!',
      '',
      'A cartoon fighting game',
      '',
      'Fighters: Jett · Mochi · Bruno · Volt · Kiri · Nana',
      '',
      'Thanks for playing!',
    ];
  }
  enter() {
    Sound.playSong('victory');
  }
  update() {
    this.t++;
    this.pup.update();
    this.parts.update();
    if (this.t === 300) Sound.playSong('title');
    if (this.t % 25 === 0) {
      const x = 150 + Math.random() * 980, y = 80 + Math.random() * 250;
      const col = U.choose(UI.colors);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU, sp = 3 + Math.random() * 4;
        this.parts.add({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 0.06, drag: 0.97, size: 4, life: 60, color: col, lw: 0 });
      }
      Sound.sfx('pop', { vol: 0.5 });
    }
    const m = Input.menu(-1);
    const tap = Input.tapped();
    if (this.t > 120 && (m.ok || m.back || m.start || tap)) {
      if (!this.left) Flow.title();
      this.left = true;
    }
  }
  render(ctx) {
    const t = this.t;
    ctx.fillStyle = '#1a0f33';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.save();
    ctx.globalAlpha = 0.6;
    Draw.sunburst(ctx, 640, 500, 1300, 24, t * 0.003, '#1a0f33', U.shade(this.C.color, -0.4));
    ctx.restore();
    this.parts.draw(ctx, 0, 0, 0);
    Draw.ellipse(ctx, 640, 668, 220, 34, 0, U.shade(this.C.color, -0.2), 5);
    this.pup.draw(ctx, 640, 662, 1.7, 1);
    Draw.text(ctx, 'CONGRATULATIONS!', 640, 90, { size: 80, fill: '#ffd23f', lw: 14, extrude: 8, extrudeColor: '#9c1f45' });
    Draw.text(ctx, this.C.name + ' IS THE KERFUFFLE CHAMPION!', 640, 170, { size: 38, fill: '#ffffff', lw: 8 });
    if (this.s.arcade && this.s.arcade.continues === 0) Draw.text(ctx, '★ NO CONTINUES! ★', 640, 220, { size: 28, fill: '#7fe3ff', lw: 6 });
    const y0 = 760 - ((t * 0.6) % 900);
    this.credits.forEach((ln, i) => Draw.text(ctx, ln, 1080, y0 + i * 34, { size: 20, font: FONT_UI, fill: '#efe6ff', lw: 4 }));
    if (t > 120) UI.hint(ctx, 'PRESS ANY BUTTON', 704, 'TAP TO CONTINUE');
  }
}
