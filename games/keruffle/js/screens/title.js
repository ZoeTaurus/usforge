'use strict';
// ---------------------------------------------------------------------------
// Title screen: twilight sky, glowing horizon, the whole cast posing on a
// hill, a bouncy logo and the main menu.
// ---------------------------------------------------------------------------

const Logo = {
  letters: 'KERFUFFLE!'.split(''),
  colors: ['#ff5a7a', '#ffd23f', '#36d6c3', '#ff9a3c', '#a77bff', '#ff5a7a', '#ffd23f', '#36d6c3', '#ff9a3c', '#ffffff'],
  _w: null,
  widths(ctx, size) {
    if (this._w && this._wSize === size) return this._w;
    this._w = this.letters.map((ch) => Draw.measure(ctx, ch, size));
    this._wSize = size;
    return this._w;
  },
  draw(ctx, x, y, t, scale = 1, introT = 999) {
    const size = 150;
    const ws = this.widths(ctx, size);
    const gap = -8;
    const total = ws.reduce((a, b) => a + b + gap, -gap);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    let cx = -total / 2;
    this.letters.forEach((ch, i) => {
      const w = ws[i];
      const lx = cx + w / 2;
      cx += w + gap;
      const appear = U.clamp((introT - i * 4) / 18, 0, 1);
      if (appear <= 0) return;
      const drop = (1 - U.ease.back(appear)) * -260;
      const bob = Math.sin(t * 0.055 + i * 0.55) * 6;
      const rot = (i % 2 ? 0.05 : -0.05) + Math.sin(t * 0.04 + i * 1.3) * 0.035;
      const sq = 1 + Math.sin(t * 0.11 + i * 0.7) * 0.025;
      ctx.save();
      ctx.translate(lx, bob + drop);
      ctx.rotate(rot);
      ctx.scale(1 / sq, sq);
      ctx.font = `400 ${size}px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      // extrusion
      for (let k = 12; k > 0; k -= 2) {
        ctx.fillStyle = '#2a1245';
        ctx.strokeStyle = '#2a1245';
        ctx.lineWidth = 16;
        ctx.strokeText(ch, 0, k);
        ctx.fillText(ch, 0, k);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 16;
      ctx.strokeText(ch, 0, 0);
      const col = this.colors[i];
      const g = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.4);
      g.addColorStop(0, U.shade(col, 0.55));
      g.addColorStop(0.45, col);
      g.addColorStop(1, U.shade(col, -0.18));
      ctx.fillStyle = g;
      ctx.fillText(ch, 0, 0);
      // glossy highlight
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-w * 0.16, -size * 0.27, w * 0.13, size * 0.06, -0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
    // subtitle ribbon
    const ra = U.clamp((introT - 50) / 20, 0, 1);
    if (ra > 0) {
      ctx.save();
      ctx.translate(0, 112);
      ctx.scale(U.ease.back(ra), U.ease.back(ra));
      ctx.rotate(-0.02);
      const rw = 470;
      Draw.poly(ctx, [-rw / 2 - 40, -6, -rw / 2 + 20, -6, -rw / 2 + 20, 34, -rw / 2 - 40, 34, -rw / 2 - 22, 14], '#8c1f4a', 4);
      Draw.poly(ctx, [rw / 2 + 40, -6, rw / 2 - 20, -6, rw / 2 - 20, 34, rw / 2 + 40, 34, rw / 2 + 22, 14], '#8c1f4a', 4);
      Draw.roundRect(ctx, -rw / 2, -22, rw, 48, 10, '#ff5a7a', 4);
      Draw.text(ctx, 'A CARTOON FIGHTING GAME', 0, 3, { size: 30, fill: '#ffffff', lw: 6 });
      ctx.restore();
    }
    ctx.restore();
  },
};

class TitleScreen {
  constructor(skipPress) {
    this.t = 0;
    this.phase = skipPress ? 'menu' : 'press';
    this.menuT = skipPress ? 30 : 0;
    this.introT = skipPress ? 999 : 0;
    this.parts = new Particles();
    const rnd = U.rng(7);
    this.stars = [];
    for (let i = 0; i < 110; i++) this.stars.push([rnd() * 1280, rnd() * 430, 0.6 + rnd() * 1.8, rnd() * TAU, 0.02 + rnd() * 0.05]);
    this.shooting = null;
    this.lineup = this.makeLineup();
    this.cheer = 200;
    const go = (mode) => () => Flow.start(mode);
    this.menu = new Menu([
      { label: 'ARCADE', action: go('arcade') },
      { label: 'ONLINE MATCH', action: go('online') },
      { label: 'VERSUS CPU', action: go('cpu') },
      { label: 'VERSUS PLAYER', action: go('vs') },
      { label: 'TRAINING', action: go('training') },
      { label: 'HOW TO PLAY', action: () => Game.go(() => new HowToScreen()) },
      { label: 'SETTINGS', action: () => Game.go(() => new SettingsScreen()) },
    ], { y: 286, gap: 56, w: 340, h: 46, size: 25, sel: TitleScreen.lastSel || 0 });
  }

  makeLineup() {
    const slots = {
      kiri: { x: 112, s: 0.9, f: 1, back: false },
      bruno: { x: 252, s: 0.8, f: 1, back: true },
      jett: { x: 388, s: 0.95, f: 1, back: false },
      mochi: { x: 892, s: 1.0, f: -1, back: false },
      volt: { x: 1030, s: 0.82, f: -1, back: true },
      nana: { x: 1170, s: 0.98, f: -1, back: false },
    };
    const free = [112, 252, 388, 892, 1030, 1170];
    const list = [];
    for (const id of CHAR_ORDER) {
      const C = CHARS[id];
      if (!C || !C.moves) continue;
      let slot = slots[id];
      if (!slot) slot = { x: free[list.length % 6], s: 0.9, f: list.length % 6 < 3 ? 1 : -1, back: false };
      const p = new Puppet(id, 0);
      p.facing = slot.f;
      list.push({ id, p, slot, react: 0, delay: Math.floor(Math.random() * 60) });
    }
    list.sort((a, b) => (a.slot.back ? 0 : 1) - (b.slot.back ? 0 : 1));
    return list;
  }

  enter() {
    Sound.playSong('title');
  }
  touchMode() {
    return 'title';
  }

  update() {
    this.t++;
    this.introT++;
    this.parts.update();
    for (const L of this.lineup) {
      if (L.delay > 0) {
        L.delay--;
        continue;
      }
      L.p.update();
      if (L.react > 0) {
        L.react--;
        if (L.react === 0) L.p.play('idle', 10);
      }
    }
    // a random cast member celebrates now and then
    if (--this.cheer <= 0) {
      this.cheer = 220 + Math.floor(Math.random() * 200);
      const L = U.choose(this.lineup);
      if (L && L.p.C.anims.win) {
        L.p.play('win', 8);
        L.react = 90;
      }
    }
    // ambient particles
    if (this.t % 7 === 0) {
      const kind = U.choose(['star', 'heart', 'dot', 'star']);
      this.parts.add({ type: kind, x: Math.random() * 1280, y: 740, vx: (Math.random() - 0.5) * 0.6, vy: -0.6 - Math.random() * 1.1, size: 4 + Math.random() * 6, life: 400, color: U.choose(['#ffd23f', '#ff9cc8', '#7fe3ff', '#ffffff']), rot: Math.random() * TAU, vr: 0.02 });
    }
    if (!this.shooting && Math.random() < 0.004) this.shooting = { x: 200 + Math.random() * 900, y: 40 + Math.random() * 120, t: 0 };
    if (this.shooting && ++this.shooting.t > 50) this.shooting = null;

    if (this.phase === 'press') {
      if (this.introT > 40 && (Input.anyPressed || Input.mouse.clicked)) {
        this.phase = 'menu';
        this.menuT = 0;
        Sound.init();
        Sound.sfx('start');
        Sound.playSong('title');
        for (let i = 0; i < 4; i++) {
          const x = 640 + (i - 1.5) * 220;
          for (let k = 0; k < 14; k++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
            const sp = 5 + Math.random() * 8;
            this.parts.add({ type: 'shard', x, y: 200, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 0.22, drag: 0.98, size: 9 + Math.random() * 6, life: 90, color: U.choose(UI.colors), rot: Math.random() * TAU, vr: 0.3 });
          }
        }
        Input.mouse.clicked = false;
      }
      return;
    }
    this.menuT++;
    if (this.menuT > 12) this.menu.update();
    TitleScreen.lastSel = this.menu.sel;
    if (this.menuT > 20 && Input.menu().back) {
      this.phase = 'press';
      this.introT = 999;
    }
  }

  drawSky(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, '#160c3a');
    g.addColorStop(0.3, '#3d1a66');
    g.addColorStop(0.58, '#9b2f7f');
    g.addColorStop(0.78, '#ff6f61');
    g.addColorStop(1, '#ffc46b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);
    // rotating rays from the horizon glow
    ctx.save();
    ctx.globalAlpha = 0.09;
    Draw.sunburst(ctx, 640, 640, 1100, 22, t * 0.0015, 'rgba(0,0,0,0)', '#ffe6c2');
    ctx.restore();
    // stars
    for (const [x, y, r, ph, sp] of this.stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * sp + ph));
      ctx.globalAlpha = a * (1 - y / 520);
      ctx.fillStyle = '#ffffff';
      if (r > 2.1) Draw.star(ctx, x, y, r * 2.2, r * 0.7, 4, '#fff7d6', 0, INK, t * 0.01);
      else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (this.shooting) {
      const s = this.shooting, k = s.t / 50;
      const x = s.x + k * 260, y = s.y + k * 110;
      const grd = ctx.createLinearGradient(x - 120, y - 50, x, y);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(1, `rgba(255,255,255,${1 - k})`);
      ctx.strokeStyle = grd;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 120, y - 50);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    // horizon glow (the sun is setting behind the hill)
    const sun = ctx.createRadialGradient(640, 660, 30, 640, 660, 520);
    sun.addColorStop(0, 'rgba(255,248,214,0.95)');
    sun.addColorStop(0.18, 'rgba(255,214,140,0.75)');
    sun.addColorStop(0.5, 'rgba(255,140,110,0.28)');
    sun.addColorStop(1, 'rgba(255,120,120,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 140, 1280, 580);
    Draw.circle(ctx, 640, 668, 150, '#fff3c4', 0);
    // clouds, inked like the stages' scenery (live, so with a fixed seed)
    StageKit.inked(ctx, () => {
      StageKit.cloudBand(ctx, { x: STAGE_W / 2, y: 0 }, 0, 120, { seed: 4, n: 5, color: '#ff9fc0', speed: 0.12, t, scale: 1.1, alpha: 0.55 });
      StageKit.cloudBand(ctx, { x: STAGE_W / 2, y: 0 }, 0, 330, { seed: 11, n: 6, color: '#ffc0a8', speed: 0.22, t, scale: 0.9, alpha: 0.62, shade: '#f59bb0' });
    }, 77);
    // hills: painted once with the stages' ink finish, see TitleScreen.scenery
    const sc = TitleScreen.scenery(), m = ctx.getTransform(), cam = { zoom: 1 };
    ctx.save();
    ctx.globalAlpha = 0.62;
    StageKit.spr(ctx, cam, m, sc.far, 0, 480);
    ctx.globalAlpha = 0.88;
    StageKit.spr(ctx, cam, m, sc.near, 0, 480);
    ctx.restore();
  }

  // Cached title scenery: two rows of hills made of separate mounds (so each
  // gets its own brush mark down its shadow side) and the ground with its
  // sunlit rim, hatching, ink specks and shadow patches. Painted through
  // StageKit, so it gets the same hand-drawn ink finish as the stages.
  static scenery() {
    if (TitleScreen._sc) return TitleScreen._sc;
    const mounds = (g, base, amp, color, seed, n) => {
      g.translate(0, -480);
      g.fillStyle = color;
      const rnd = U.rng(seed);
      let x = -120;
      for (let i = 0; i < n && x < 1400; i++) {
        const w = 220 + rnd() * 200, top = base - amp * (0.45 + 0.55 * rnd());
        g.beginPath();
        g.moveTo(x, 760);
        g.lineTo(x, base + 30);
        g.bezierCurveTo(x + w * 0.22, top, x + w * 0.6, top, x + w, base + 30);
        g.lineTo(x + w, 760);
        g.closePath();
        g.fill();
        x += w * (0.55 + rnd() * 0.25);
      }
    };
    const ground = (g) => {
      g.translate(0, -480);
      const gy = (x) => TitleScreen.prototype.groundY(x) + 4;
      g.beginPath();
      g.moveTo(-10, 740);
      for (let x = -10; x <= 1290; x += 16) g.lineTo(x, gy(x));
      g.lineTo(1290, 740);
      g.closePath();
      const gr = g.createLinearGradient(0, 640, 0, 720);
      gr.addColorStop(0, '#3b1d5c');
      gr.addColorStop(1, '#1d0e33');
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      // jagged ink patches hanging under the rim
      const rnd = U.rng(31);
      g.fillStyle = 'rgba(16,6,28,0.8)';
      for (let i = 0; i < 9; i++) {
        const x0 = rnd() * 1280, w = 90 + rnd() * 140, y0 = gy(x0) + 10 + rnd() * 8;
        g.beginPath();
        g.moveTo(x0, 760);
        g.lineTo(x0, y0 + 10);
        const teeth = Math.round(w / 18);
        for (let k = 0; k <= teeth * 2; k++) {
          const xx = x0 + (k / (teeth * 2)) * w;
          g.lineTo(xx, k % 2 ? y0 - 4 - rnd() * 14 : y0 + 6 + rnd() * 8);
        }
        g.lineTo(x0 + w, 760);
        g.closePath();
        g.fill();
      }
      // hatching and specks
      g.strokeStyle = '#120620';
      g.lineWidth = 1.3;
      g.lineCap = 'round';
      g.beginPath();
      for (let i = 0; i < 70; i++) {
        const x = rnd() * 1280, y = gy(x) + 8 + rnd() * 34;
        for (let k = 0; k < 3; k++) {
          g.moveTo(x + k * 5, y);
          g.lineTo(x + k * 5 + 7, y - 9);
        }
      }
      g.stroke();
      g.fillStyle = '#120620';
      g.beginPath();
      for (let i = 0; i < 60; i++) {
        const x = rnd() * 1280, y = gy(x) + 10 + rnd() * 40, r = 0.8 + rnd() * 1.6;
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, TAU);
      }
      g.fill();
      // pale specks catching the sunset
      g.fillStyle = 'rgba(255,190,150,0.35)';
      g.beginPath();
      for (let i = 0; i < 40; i++) {
        const x = rnd() * 1280, y = gy(x) + 8 + rnd() * 20;
        g.moveTo(x + 1.2, y);
        g.arc(x, y, 1.2, 0, TAU);
      }
      g.fill();
      g.restore();
      // sunlit rim
      g.beginPath();
      for (let x = -10; x <= 1290; x += 16) {
        if (x === -10) g.moveTo(x, gy(x));
        else g.lineTo(x, gy(x));
      }
      g.lineWidth = 5;
      g.strokeStyle = '#ff9f7a';
      g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = '#ffe1b0';
      g.stroke();
    };
    TitleScreen._sc = {
      far: StageKit.sprite({ w: 1280, h: 240, paint: (g) => mounds(g, 572, 70, '#7a3a8c', 5, 12) }),
      near: StageKit.sprite({ w: 1280, h: 240, paint: (g) => mounds(g, 612, 52, '#5a2a78', 9, 14) }),
      ground: StageKit.sprite({ w: 1280, h: 240, paint: ground }),
    };
    return TitleScreen._sc;
  }

  groundY(x) {
    const k = (x - 640) / 640;
    return 668 + 26 * k * k;
  }

  drawGround(ctx) {
    StageKit.spr(ctx, { zoom: 1 }, ctx.getTransform(), TitleScreen.scenery().ground, 0, 480);
    ctx.save();
    // grass tufts
    ctx.fillStyle = '#2b1547';
    for (let i = 0; i < 40; i++) {
      const x = U.hash(i * 3.3) * 1280;
      const y = this.groundY(x) + 6 + U.hash(i * 7.1) * 30;
      const s = 6 + U.hash(i) * 6;
      const sway = Math.sin(this.t * 0.04 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x - s * 0.3 + sway, y - s * 1.6);
      ctx.lineTo(x, y);
      ctx.lineTo(x + s * 0.4 + sway, y - s * 1.9);
      ctx.lineTo(x + s, y);
      ctx.fill();
    }
    ctx.restore();
  }

  drawLineup(ctx) {
    const rise = this.introT < 999 ? U.ease.out3(U.clamp((this.introT - 10) / 50, 0, 1)) : 1;
    for (const L of this.lineup) {
      const { x, s, back } = L.slot;
      const y = this.groundY(x) - (back ? 12 : 0) + (1 - rise) * 300;
      // soft shadow
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#12061f';
      ctx.beginPath();
      ctx.ellipse(x, y + 2, L.p.S.width * s * 0.9 + 12, 9, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      const pal = back ? Rig.tinted(L.p.pal, '#3d1a66', 0.28) : L.p.pal;
      L.p.draw(ctx, x, y, s, L.slot.f, pal);
    }
  }

  render(ctx) {
    this.drawSky(ctx);
    this.drawGround(ctx);
    this.drawLineup(ctx);
    this.parts.draw(ctx, 0, 0, 0);
    // logo glow
    ctx.save();
    const lg = ctx.createRadialGradient(640, 140, 40, 640, 140, 520);
    lg.addColorStop(0, 'rgba(255,214,240,0.28)');
    lg.addColorStop(1, 'rgba(255,214,240,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(100, -100, 1080, 520);
    ctx.restore();
    Logo.draw(ctx, 640, 122, this.t, 0.92, this.introT);
    if (this.phase === 'press') {
      if (this.introT > 60) {
        const a = 0.55 + 0.45 * Math.sin(this.t * 0.09);
        const s = 1 + Math.sin(this.t * 0.09) * 0.03;
        ctx.save();
        ctx.translate(640, 455);
        ctx.scale(s, s);
        Draw.text(ctx, Touch.active ? 'TAP TO START' : 'PRESS ANY KEY', 0, 0, { size: 46, fill: '#ffffff', lw: 10, alpha: a, extrude: 5, extrudeColor: '#8c1f4a' });
        ctx.restore();
        const help = Touch.active ? 'Touch: drag on the left to move and jump, tap the buttons on the right to attack' : 'Keyboard: WASD + J K L   •   2P: Arrows + Num 1 2 3   •   Gamepads supported';
        Draw.text(ctx, help, 640, 700, { size: 17, font: FONT_UI, fill: '#ffe9f3', lw: 4, weight: 600 });
      }
    } else {
      const k = U.ease.out3(U.clamp(this.menuT / 18, 0, 1));
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(0, (1 - k) * 60);
      this.menu.draw(ctx);
      ctx.restore();
      UI.hint(ctx, 'J / ENTER: select    K / ESC: back    F11: fullscreen', 702, '');
    }
    this.parts.draw(ctx, 0, 0, 1);
    Draw.text(ctx, 'v1.0', 1262, 704, { size: 14, font: FONT_UI, align: 'right', fill: '#ffd9ec', lw: 3, weight: 600 });
  }
}
