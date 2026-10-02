'use strict';
// ---------- the sunset city (title, day-end and ending backdrop) ----------
let CITY = null;
const STARS = [];
const CITY_WINDOWS = [];
const SKY = ['#120a26', '#1d0f38', '#2e1650', '#4a1d63', '#6e2470', '#9a2f73', '#c84470', '#e86a64', '#f7955c', '#ffbe6a'];

function wireY(x, base) { const u = x / W; return base - 5 * u + 12 * 4 * u * (1 - u); }

function buildCity() {
  CITY = mkCanvas(W, H);
  withCtx(CITY, () => {
    srand(777);
    // dithered sky gradient
    const bot = 130;
    for (let y = 0; y < bot; y++) {
      const fpos = y / (bot - 1) * (SKY.length - 1);
      const i = Math.min(SKY.length - 2, fl(fpos)), fr = fpos - i;
      for (let x = 0; x < W; x++) {
        ctx.fillStyle = (BAYER[y & 3][x & 3] + 0.5) / 16 < fr ? SKY[i + 1] : SKY[i];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // distant stars
    for (let i = 0; i < 70; i++) {
      const s = { x: fl(srnd() * W), y: fl(srnd() * 60), p: srnd() * 6, b: srnd() < 0.25 };
      STARS.push(s); R(s.x, s.y, 1, 1, '#6a5a8a');
    }
    // the sun: glow ring + striped disc
    ditherCirc(160, 106, 38, '#ffb36b', 0);
    for (let dy = -32; dy <= 32; dy++) {
      if (dy > 2 && (dy % 6) < fl(dy / 9) + 1) continue;
      const dx = fl(Math.sqrt(32 * 32 - dy * dy));
      R(160 - dx, 106 + dy, dx * 2 + 1, 1, mixCol('#fff3a8', '#ff6b8a', (dy + 32) / 64));
    }
    // a couple of pixel clouds
    const cloud = (x, y, w, c) => { R(x, y, w, 2, c); R(x + 4, y - 2, w - 10, 2, c); R(x + 8, y - 3, w - 18, 1, c); };
    cloud(20, 74, 46, '#c84470'); cloud(236, 66, 54, '#c84470'); cloud(60, 40, 34, '#6e2470'); cloud(250, 30, 30, '#4a1d63');
    // far skyline
    let x = 0;
    while (x < W) {
      const w = 8 + fl(srnd() * 16), top = 84 + fl(srnd() * 22);
      R(x, top, w, 150 - top, '#3a1d52');
      if (srnd() < 0.3) R(x + fl(w / 2), top - 5, 1, 5, '#3a1d52');
      for (let wy = top + 3; wy < 146; wy += 4) for (let wx = x + 2; wx < x + w - 1; wx += 3)
        if (srnd() < 0.22) R(wx, wy, 1, 2, srnd() < 0.8 ? '#ffcf7a' : '#7fd1ff');
      x += w + 1;
    }
    // near buildings, left and right
    const near = (x0, x1, top, col) => {
      R(x0, top, x1 - x0, 152 - top, col);
      R(x0, top, x1 - x0, 2, '#2e1a40');
      for (let wy = top + 6; wy < 140; wy += 9) for (let wx = x0 + 4; wx < x1 - 6; wx += 8) {
        R(wx, wy, 5, 6, '#160a22');
        if (srnd() < 0.45) { const c = srnd() < 0.7 ? '#ffcf7a' : '#ff9ad5'; R(wx + 1, wy + 1, 3, 4, c); CITY_WINDOWS.push([wx + 1, wy + 1, c]); }
      }
    };
    near(0, 34, 62, '#22102f'); near(34, 92, 76, '#1c0d29'); near(228, 286, 70, '#1c0d29'); near(286, 320, 58, '#22102f');
    // water tank on a roof
    R(244, 58, 14, 10, '#2a1638'); R(246, 68, 1, 2, '#2a1638'); R(255, 68, 1, 2, '#2a1638'); R(243, 56, 16, 2, '#2e1a40');
    // street
    R(0, 150, W, 8, '#4a3a5c');
    for (let i = 0; i < W; i += 12) R(i, 150, 1, 8, '#3e3050');
    R(0, 157, W, 1, '#6a5a7c');
    R(0, 158, W, 22, '#1e1529');
    for (let i = 6; i < W; i += 24) R(i, 170, 12, 1, '#3b2f48');
    // the shop: roof
    for (let r = 0; r < 14; r++) {
      const w0 = 100 + r * 2;
      R(160 - w0 / 2, 84 + r, w0, 1, (fl(r / 3) & 1) ? '#52386a' : '#3f2a52');
    }
    R(110, 82, 100, 3, '#2a1b38');
    R(92, 96, 6, 2, '#3f2a52'); R(90, 94, 3, 2, '#3f2a52'); R(222, 96, 6, 2, '#3f2a52'); R(227, 94, 3, 2, '#3f2a52');
    for (let i = 0; i < 14; i++) R(100 + i * 9, 86, 1, 11, '#2a1b38');
    // walls
    R(104, 110, 112, 40, '#5a3322');
    for (let i = 106; i < 216; i += 6) R(i, 110, 1, 40, '#4a2a1b');
    R(104, 98, 112, 12, '#4a2a1b');
    R(102, 108, 5, 42, '#3d2016'); R(213, 108, 5, 42, '#3d2016');
    // sign board
    R(126, 97, 68, 14, '#e8b84a'); R(127, 98, 66, 12, '#a32a2a');
    txt('NOODLES', 134, 101, '#5a1010', 2); txt('NOODLES', 133, 100, '#ffd36b', 2);
    // potted plants & a barrel
    R(90, 140, 8, 10, '#8b4a2b'); R(89, 140, 10, 2, '#a65d36'); R(91, 132, 2, 8, '#2f7a3c'); R(94, 130, 2, 10, '#3c9a4c'); R(88, 134, 3, 2, '#2f7a3c'); R(96, 133, 3, 2, '#3c9a4c');
    R(222, 136, 10, 14, '#6b3f22'); R(222, 139, 10, 1, '#3a2010'); R(222, 145, 10, 1, '#3a2010');
  });
}

// Animated parts of the shop (interior glow, chef, noren curtains, lanterns, neon, steam).
function drawShopLive(t) {
  // interior
  const fl1 = (fl(t * 7) % 9 === 0) ? '#ffc56a' : '#ffcf7a';
  R(116, 114, 88, 36, fl1);
  R(116, 114, 88, 6, '#ffdc98');
  // chef silhouette stirring a big pot
  const s = fl(t * 4) & 1;
  R(150, 124, 8, 7, '#a0522d'); R(151, 118, 6, 6, '#a0522d'); R(150, 115, 8, 3, '#ffffff'); R(151, 113, 6, 2, '#ffffff');
  R(158, 125 + s, 6, 2, '#a0522d');
  R(160, 132, 18, 9, '#6a6f80'); R(160, 131, 18, 1, '#9aa0b2');
  R(162 + s * 6, 127, 1, 5, '#5a3322');
  R(116, 140, 88, 4, '#8b5a2b'); R(116, 144, 88, 6, '#6b3f22');
  // bowls on the inside counter
  R(124, 138, 6, 2, '#efe8da'); R(134, 138, 6, 2, '#efe8da'); R(186, 138, 6, 2, '#efe8da');
  // noren curtains, swaying
  for (let i = 0; i < 4; i++) {
    const sw = fl(Math.sin(t * 1.6 + i * 0.9) * 1.2);
    const x = 116 + i * 22;
    R(x, 114, 21, 2, '#8e1f14');
    R(x + 1, 116, 19, 11, '#c0392b');
    R(x + 1 + sw, 127, 19, 2, '#c0392b');
    R(x + 1, 116, 1, 13, '#a3271d');
  }
  // bowl logo across the middle curtains
  R(148, 119, 24, 2, '#ffffff'); R(150, 121, 20, 2, '#ffffff'); R(153, 123, 14, 2, '#ffffff');
  R(152, 117, 2, 2, '#ffffff'); R(158, 116, 2, 3, '#ffffff'); R(164, 117, 2, 2, '#ffffff');
  // lanterns with flickering glow
  for (const lx of [98, 222]) {
    const sw = fl(Math.sin(t * 1.3 + lx) * 1.4);
    const g = fl(t * 9 + lx) % 13 === 0 ? 11 : 13;
    ditherCirc(lx + sw, 106, g, '#ff9a5a', fl(t * 2) & 1);
    R(lx, 97, 1, 4, '#1a1020');
    const X = lx + sw;
    R(X - 2, 100, 5, 1, '#1a1020');
    const widths = [5, 7, 9, 9, 9, 9, 7, 5];
    widths.forEach((w, i) => R(X - (w >> 1), 101 + i, w, 1, i % 3 === 2 ? '#9a1f1a' : '#e03c31'));
    R(X - 2, 103, 1, 4, '#ff7a5a');
    R(X - 2, 109, 5, 1, '#1a1020'); R(X, 110, 1, 2, '#ffd34d');
    // reflection on the road
    for (let r = 0; r < 14; r++) if ((r + fl(t * 6)) % 3) R(X - 1 + fl(Math.sin(t * 3 + r) * 1.5), 160 + r, 3, 1, '#7a3a50');
  }
  // neon signs
  const on = !(fl(t * 5) % 17 === 0);
  const pink = on ? '#ff4fa3' : '#5a2a4a';
  R(64, 82, 13, 44, '#160a22');
  'RAMEN'.split('').forEach((c, i) => txt(c, 69, 85 + i * 8, pink));
  if (on) { dith(62, 80, 17, 48, '#ff4fa355', fl(t * 2) & 1); }
  const blue = (fl(t * 3) % 11 === 0) ? '#1a3a5a' : '#5fd3ff';
  R(238, 92, 30, 11, '#160a22'); txt('OPEN', 245, 95, blue);
  R(237, 91, 32, 1, blue); R(237, 103, 32, 1, blue); R(237, 91, 1, 13, blue); R(268, 91, 1, 13, blue);
  // little window lights twinkle on and off
  for (let i = 0; i < CITY_WINDOWS.length; i += 7) {
    const w = CITY_WINDOWS[i];
    if ((fl(t * 0.7 + i) % 5) === 0) R(w[0], w[1], 3, 4, '#160a22');
  }
}

function drawStars(t) {
  for (const s of STARS) {
    const v = Math.sin(t * 2 + s.p);
    if (v > 0.3) R(s.x, s.y, 1, 1, v > 0.85 ? '#ffffff' : '#c9b8ff');
    if (s.b && v > 0.9) { R(s.x - 1, s.y, 3, 1, '#ffffff'); R(s.x, s.y - 1, 1, 3, '#ffffff'); }
  }
}

function drawWires(t, garyOn = true) {
  for (let x = 0; x < W; x++) { R(x, fl(wireY(x, 52)), 1, 1, '#1a0f26'); R(x, fl(wireY(x, 58)), 1, 1, '#1a0f26'); }
  if (garyOn) drawChar(CAST_BY_ID.gary, 296, fl(wireY(296, 52)), { t, dir: -1 });
}

// Steam puffs rising out of the shop chimney / window.
const STEAM = [];
function updateSteam(dt) {
  if (Math.random() < dt * 6) STEAM.push({ x: 160 + rand(-30, 30), y: 112, life: 0, max: rand(1.5, 2.6) });
  for (const s of STEAM) { s.life += dt; s.y -= dt * 9; s.x += Math.sin(s.life * 3 + s.y) * dt * 4; }
  for (let i = STEAM.length - 1; i >= 0; i--) if (STEAM[i].life > STEAM[i].max) STEAM.splice(i, 1);
}
function drawSteam() {
  for (const s of STEAM) {
    const k = s.life / s.max, r = k < 0.5 ? 1 : 2;
    dith(s.x - r, s.y - r, r * 2 + 1, r * 2 + 1, k < 0.6 ? '#fff4e6' : '#d9b8c8', fl(s.y) & 1);
  }
}

// ---------- Title scene ----------
const Title = {
  t: 0, walkers: [], petals: [], wT: 0.5,
  enter() { playMusic('title'); this.walkers = []; this.wT = 0.3; },
  update(dt) {
    this.t += dt; updateSteam(dt);
    this.wT -= dt;
    if (this.wT <= 0) {
      this.wT = rand(1.8, 3.5);
      const ch = pick(CAST.filter(c => c.id !== 'gary'));
      const dir = Math.random() < 0.5 ? 1 : -1;
      const sp = ch.id === 'zoomie' ? 42 : ch.id === 'boris' ? 14 : rand(18, 26);
      this.walkers.push({ ch, x: dir > 0 ? -14 : W + 14, dir, sp, t: rand(0, 3) });
    }
    for (const w of this.walkers) { w.x += w.dir * w.sp * dt; w.t += dt; }
    this.walkers = this.walkers.filter(w => w.x > -20 && w.x < W + 20);
    if (this.petals.length < 34 && Math.random() < dt * 8)
      this.petals.push({ x: rand(-20, W), y: -4, vx: rand(6, 14), vy: rand(8, 16), p: rand(0, 6), c: pick(['#ffb7d5', '#ff8fbf', '#ffd6e8']) });
    for (const p of this.petals) { p.x += (p.vx + Math.sin(this.t * 2 + p.p) * 6) * dt; p.y += p.vy * dt; }
    this.petals = this.petals.filter(p => p.y < H + 4 && p.x < W + 10);
  },
  draw() {
    const t = this.t;
    ctx.drawImage(CITY, 0, 0);
    drawStars(t);
    drawShopLive(t);
    drawSteam();
    drawWires(t);
    for (const w of this.walkers) drawChar(w.ch, w.x, 156, { t: w.t, walk: true, dir: w.dir });
    for (const p of this.petals) { R(p.x, p.y, 2, 1, p.c); if ((fl(t * 4 + p.p) & 1)) R(p.x + 1, p.y + 1, 1, 1, p.c); }

    // ---- logo ----
    const l1 = 'NOODLE SHOP';
    const sc1 = 3, w1 = tw(l1, sc1), x1 = 160 - (w1 >> 1);
    for (let i = 0; i < l1.length; i++) {
      const dy = fl(Math.sin(t * 2.5 + i * 0.5) * 1.5);
      const lx = x1 + i * 4 * sc1;
      txtO(l1[i], lx + 1, 14 + dy + 2, '#7a2470', '#7a2470', sc1, 2);
      txtO(l1[i], lx, 14 + dy, ['#fff7d6', '#ffe9b0', '#ffd98a', '#ffc66b', '#ffb14d'], '#2b1236', sc1, 2);
    }
    const l2 = 'CHAOS!';
    const sc2 = 6, w2 = tw(l2, sc2), x2 = 160 - (w2 >> 1);
    const cyc = fl(t * 2) % 3;
    const grads = [
      ['#fff36b', '#ffd23d', '#ffa53d', '#ff7a3d', '#ff3d6b'],
      ['#ffe36b', '#ffc23d', '#ff953d', '#ff6a3d', '#ff3d5b'],
      ['#fff36b', '#ffd23d', '#ff9a3d', '#ff703d', '#ff3d7b'],
    ];
    for (let i = 0; i < l2.length; i++) {
      const shake = (fl(t * 10 + i * 3) % 23 === 0) ? 1 : 0;
      const jx = shake ? pick([-1, 1]) : 0, jy = shake ? pick([-1, 1]) : 0;
      const dy = fl(Math.sin(t * 3 + i * 0.8) * 2);
      const lx = x2 + i * 4 * sc2 + jx;
      txtO(l2[i], lx + 2, 36 + dy + 3 + jy, '#3d0f3a', '#3d0f3a', sc2, 2);
      txtO(l2[i], lx, 36 + dy + jy, grads[cyc], '#1a0b26', sc2, 2);
      R(lx + 1, 37 + dy + jy, 2, 1, '#ffffff');
    }
    // steaming bowls flanking the logo
    this.drawBigBowl(52, 50, t); this.drawBigBowl(250, 50, t + 1);

    txtOC('A TINY SHOP. A WEIRD CREW. TOTAL CHAOS.', 160, 72, '#ffe9f4', '#2b1236');

    // ---- menu ----
    const blink = fl(t * 2) & 1;
    btn(118, 160, 84, 11, 'START SHIFT', () => { sfx.start(); newGame(); go('play'); }, { col: '#d6402f', hov: '#ff5a44' });
    btn(48, 162, 62, 9, 'HOW TO PLAY', () => { sfx.click(); go('howto'); }, { col: '#5a3a7a', hov: '#7a52a3' });
    btn(210, 162, 62, 9, SND.muted ? 'SOUND: OFF' : 'SOUND: ON', () => { toggleMute(); sfx.click(); }, { col: '#5a3a7a', hov: '#7a52a3' });
    if (blink) txtOC('CLICK START OR PRESS ENTER', 160, 174, '#ffd36b', '#1a0b26');
    const best = getBest();
    if (best > 0) txtO('BEST CHARM ' + best, 3, 3, '#ff9ad5', '#1a0b26');
    txtO('V1.0', W - 19, 3, '#9a86c0', '#1a0b26');
  },
  drawBigBowl(x, y, t) {
    // a fat steaming ramen bowl with chopsticks
    R(x - 13, y - 1, 26, 3, OUT); R(x - 12, y, 24, 2, '#8a4a1c');
    for (let i = 0; i < 5; i++) R(x - 10 + i * 4, y + (i & 1), 3, 1, '#f6d55c');
    R(x + 3, y - 2, 6, 3, OUT); R(x + 4, y - 1, 4, 2, '#fff'); R(x + 5, y - 1, 2, 1, '#f7a21b');
    R(x - 14, y + 2, 28, 7, OUT); R(x - 13, y + 2, 26, 1, '#ffffff'); R(x - 13, y + 3, 26, 4, '#efe8da');
    R(x - 12, y + 4, 24, 1, '#c0392b'); R(x - 11, y + 7, 22, 2, OUT); R(x - 10, y + 7, 20, 1, '#d8cfbd');
    R(x - 4, y + 9, 8, 2, OUT);
    R(x + 6, y - 12, 1, 12, '#c98b4f'); R(x + 9, y - 13, 1, 13, '#a86d38');
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.8 + i / 3) % 1);
      const sy = y - 3 - fl(k * 14), sx = x - 6 + i * 5 + fl(Math.sin(t * 3 + i) * 2);
      if (k < 0.8) dith(sx, sy, 2, 3, '#fff4e6', fl(t * 4) & 1);
    }
  },
  click() {},
  key(k) { if (k === 'Enter' || k === ' ') { sfx.start(); newGame(); go('play'); } if (k === 'h' || k === 'H') go('howto'); },
};

// ---------- How to play ----------
const HowTo = {
  t: 0,
  enter() { this.t = 0; },
  update(dt) { this.t += dt; updateSteam(dt); },
  draw() {
    ctx.drawImage(CITY, 0, 0); drawStars(this.t); drawShopLive(this.t);
    ctx.fillStyle = 'rgba(16,8,28,0.82)'; ctx.fillRect(0, 0, W, H);
    panel(10, 6, 300, 168, '#2a1b3d', '#f3e3c3');
    txtOC('HOW TO RUN A NOODLE SHOP', 160, 11, '#ffd36b', OUT, 2);
    const rows = [
      ['order', 'CUSTOMERS SHOUT ORDERS: NOODLE + BROTH + TOPPING.'],
      ['pot', 'CLICK A NOODLE BIN AND A BROTH BIN. THEY GO IN A POT.'],
      ['ready', 'WHEN THE POT SAYS READY, CLICK IT TO POUR A BOWL.'],
      ['top', 'CLICK A TOPPING BIN TO ADD IT TO A BOWL ON THE PASS.'],
      ['serve', 'CLICK A BOWL, THEN CLICK THE CUSTOMER. SERVE IT FAST!'],
      ['crate', 'CATCH FLYING SUPPLY CRATES. CLICK COINS TO COLLECT.'],
      ['star', 'STARRED CUSTOMERS CAN BE HIRED AFTER A CORRECT BOWL!'],
    ];
    rows.forEach((r, i) => {
      const y = 28 + i * 16;
      this.drawRowIcon(r[0], 28, y);
      txt(r[1], 50, y + 3, '#fffaf0');
    });
    txtOC('A WEIRDER CREW MEANS MORE CHAOS, AND MORE CHARM.', 160, 142, '#ff9ad5', OUT);
    txtC('KEYS: 1-9 BINS  QWE POTS  ASD BOWLS  ZXCV SERVE  ESC PAUSE', 160, 151, '#9a86c0');
    btn(130, 159, 60, 11, 'GOT IT!', () => { sfx.click(); go('title'); }, { col: '#d6402f', hov: '#ff5a44' });
  },
  drawRowIcon(k, x, y) {
    if (k === 'order') { drawIcon('ramen', x - 14, y + 1); drawIcon('shoyu', x - 5, y + 1); drawIcon('egg', x + 4, y + 1); return; }
    if (k === 'pot' || k === 'ready') {
      R(x - 9, y + 1, 18, 4, OUT); R(x - 8, y + 2, 16, 2, ING.miso.col); R(x - 6, y + 2, 2, 1, '#fffaf0'); R(x + 1, y + 3, 2, 1, '#fffaf0');
      R(x - 10, y + 4, 20, 10, OUT); R(x - 9, y + 5, 18, 8, '#8a94a6'); R(x - 9, y + 5, 18, 2, '#c4ccd8'); R(x + 4, y + 7, 3, 6, '#6a7386');
      if (k === 'pot') { const f = fl(this.t * 10) & 1; R(x - 7, y + 13 - f, 2, 2 + f, '#ff8a3d'); R(x - 1, y + 13 - (1 - f), 2, 2 + (1 - f), '#ff8a3d'); R(x + 5, y + 13 - f, 2, 2 + f, '#ff8a3d'); }
      else txtO('!', x + 12, y + 3 - (fl(this.t * 4) & 1), '#7dff9a', OUT);
      return;
    }
    if (k === 'top') { drawBowl(x - 6, y + 2, { n: 'ramen', b: 'spicy', t: 'nori' }); return; }
    if (k === 'serve') { drawBowl(x - 6, y + 2, { n: 'soba', b: 'shoyu', t: 'pork' }); return; }
    if (k === 'crate') { drawCrate(x - 4, y, 'egg'); R(x + 9, y + 4, 5, 5, OUT); R(x + 10, y + 5, 3, 3, '#f5c542'); return; }
    if (k === 'star') { star(x, y + 2); }
  },
  click() {},
  key(k) { if (k === 'Escape' || k === 'Enter') go('title'); },
};
