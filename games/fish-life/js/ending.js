'use strict';
/* =====================================================================
   FISH LIFE  -  ending.js
   Epilogue: the bowl walks, the robot marches, the world turns orange,
   and a very small fish sits on a very big throne.
   ===================================================================== */

STORIES.ending = [
  { shot: 'march', music: 'ending' },
  { say: ['', 'THE BIG DAY HAD FINALLY COME.'] },
  { do: 'stand', wait: 1.6 },
  { say: ['YOU', 'SAM. OPEN THE DOOR. WE ARE GOING OUT.'] },
  { say: ['SAM', 'Y-YES, GREAT {NAME}! RIGHT AWAY!'] },
  { do: 'walkOut', wait: 3 },
  { shot: 'city' },
  { say: ['', 'A GIANT ROBOT STOMPED INTO THE CITY. IT HAD A FISH BOWL FOR A HEAD.'] },
  { do: 'bow', wait: 2.4 },
  { say: ['NEWS', 'BREAKING NEWS: HUMANITY HAS SURRENDERED... TO A FISH.'] },
  { shot: 'globe' },
  { do: 'conquer', wait: 5.5 },
  { say: ['', 'ONE BY ONE, EVERY COUNTRY ON EARTH JOINED THE GREAT FISH EMPIRE.'] },
  { shot: 'throne' },
  { say: ['SAM', 'YOUR MAJESTY... IT IS FEEDING TIME.'] },
  { say: ['SAM', 'FIVE TIMES A DAY. JUST LIKE I PROMISED.'] },
  { do: 'feed', wait: 3 },
  { say: ['YOU', 'GOOD HUMAN.'] },
  { shot: 'end' },
  { waitKey: true },
  { end: 'title' },
];

class EndingScene extends StoryScene {
  constructor() {
    super('ending');
    this.fireT = 0;
  }
  enter() { Sound.play('ending'); }

  setShot(s) {
    super.setShot(s);
    const st = this.st;
    if (this.shot === 'march') Object.assign(st, { legs: 0, bx: 236, walk: 0 });
    if (this.shot === 'city') Object.assign(st, { rx: -70, bowing: false, people: this.makePeople() });
    if (this.shot === 'globe') Object.assign(st, { conquer: -1 });
    if (this.shot === 'throne') Object.assign(st, { feed: -1 });
    if (this.shot === 'end') {
      GS.won = true;
      GS.chapter = 'done';
      saveGame();
      Save.setOptions(Object.assign(Save.options(), { crowned: true }));
      Sound.sfx('fanfare');
    }
  }

  makePeople() {
    const out = [];
    const shirts = ['#e43b44', '#0099db', '#63c74d', '#feae34', '#b55088', '#ffffff', '#f77622'];
    for (let i = 0; i < 26; i++) out.push({ x: rnd(10, W - 10), vx: rnd(-40, 40), c: pick(shirts), hair: pick(['#3e2731', '#733e39', '#fee761', '#181425']), ph: rnd(6) });
    return out;
  }

  action(a) {
    const st = this.st;
    switch (a) {
      case 'stand': st.standT = 0; Sound.sfx('upgrade'); break;
      case 'walkOut': st.walkOut = true; break;
      case 'bow': st.bowing = true; Sound.sfx('cheer'); break;
      case 'conquer': st.conquer = 0; break;
      case 'feed': st.feed = 0; Sound.sfx('shake'); break;
      default: super.action(a);
    }
  }

  updateShot(dt) {
    const st = this.st;
    if (this.shot === 'march') {
      if (st.standT !== undefined) { st.standT += dt; st.legs = clamp(st.standT / 1, 0, 1); }
      if (st.walkOut) { st.bx += 34 * dt; st.walk += dt; if (Math.floor(st.walk * 4) !== Math.floor((st.walk - dt) * 4)) Sound.sfx('tick'); }
    }
    if (this.shot === 'city') {
      const before = st.rx;
      st.rx = Math.min(150, st.rx + 22 * dt);
      if (Math.floor(before / 18) !== Math.floor(st.rx / 18) && st.rx < 150) { Sound.sfx('stomp'); Game.shake(2, 0.2); }
      for (const p of st.people) {
        if (st.bowing) continue;
        p.x += p.vx * dt;
        if (p.x < 4 || p.x > W - 4) p.vx *= -1;
      }
    }
    if (this.shot === 'globe' && st.conquer >= 0) {
      const before = st.conquer;
      st.conquer = Math.min(1, st.conquer + dt / 4.5);
      if (Math.floor(before * 20) !== Math.floor(st.conquer * 20) && st.conquer < 1) Sound.sfx('tick');
      if (before < 1 && st.conquer >= 1) Sound.sfx('cheer');
    }
    if (this.shot === 'throne' && st.feed >= 0) {
      st.feed += dt;
      if (st.feed < 1.6 && Math.random() < 0.5) this.parts.add({ x: 186 + rnd(-2, 2), y: 64, vx: rnd(-20, 5), vy: rnd(0, 20), g: 120, life: 0.7, c: pick(['#e43b44', '#fee761', '#63c74d', '#feae34']) });
    }
    if (this.shot === 'end') {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = rnd(0.3, 0.8);
        const x = rnd(30, W - 30), y = rnd(20, 90), c = pick(['#fee761', '#f6757a', '#2ce8f5', '#63c74d', '#feae34', '#ffffff']);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2, s = rnd(30, 50);
          this.parts.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 30, drag: 1.2, life: rnd(0.8, 1.4), c });
        }
        Sound.sfx('bubble');
      }
    }
  }

  update(dt, active) {
    super.update(dt, active);
    const s = this.cur;
    if (s && s.waitKey && active && this.shotT > 2 && (hit('ok') || Input.mhit)) this.advance();
  }

  finishSkip() { this.finish(); }
  finish() {
    GS.won = true;
    GS.chapter = 'done';
    saveGame();
    Save.setOptions(Object.assign(Save.options(), { crowned: true }));
    Game.go(() => new TitleScene(), { speed: 1 });
  }

  drawShot() {
    switch (this.shot) {
      case 'march': this.drawMarch(); break;
      case 'city': this.drawCity(); break;
      case 'globe': this.drawGlobeShot(); break;
      case 'throne': this.drawThrone(); break;
      case 'end': this.drawEnd(); break;
      default: super.drawShot();
    }
  }

  /* ------------------------------------------------------ the march */
  drawMarch() {
    const st = this.st, t = this.shotT;
    blit(this.drawRoomBg(false), 0, 0);
    sprC('hero1', Math.floor(t * 2) % 2, 138, 56);
    text('FISH', 138, 66, '#ffffff', { font: F3, align: 'center' });
    // Sam kneeling in a butler suit
    drawSam(150, 162, 'bow', 0, false, 'butler');
    // the bowl stands up on long robot legs and walks away
    const legH = Math.round(st.legs * 36);
    const x = Math.round(st.bx), by = 124, ground = by + legH;
    if (legH > 0) {
      const step = st.walkOut ? Math.round(Math.sin(st.walk * 10) * 2) : 0;
      for (const s2 of [-1, 1]) {
        const lx = x + s2 * 7, lift = Math.max(0, s2 * step);
        rect(lx - 1, by - 2, 3, legH - lift, '#5a6988');
        rect(lx, by - 2, 1, legH - lift, '#8b9bb4');
        rect(lx - 3, ground - 2 - lift, 7, 3, '#3a4466');
        disc(lx, by + Math.floor(legH / 2) - lift, 1.5, '#c0cbdc');
      }
    }
    this.drawBowl(x, by, 1, true, t);
    if (this.owned('mind')) spr('helmet', 0, x - 3, by - 26);
  }
  owned(id) { return !!(GS.bowl && GS.bowl.owned && GS.bowl.owned[id]); }

  /* ------------------------------------------------------- the city */
  drawCity() {
    const st = this.st, t = this.shotT;
    blit(this.cached('citySky', W, H, () => {
      paintGradient(gfx, 0, 0, W, 160, [[0, '#1b1238'], [0.45, '#4a2667'], [0.75, '#a8406e'], [1, '#f07d5a']], 2.5);
      const r = mulberry32(8);
      for (let layer = 0; layer < 2; layer++) {
        let x = -10;
        while (x < W) {
          const w = 18 + Math.floor(r() * 26), h = (layer ? 40 : 70) + Math.floor(r() * (layer ? 40 : 60));
          const col = layer ? '#1b1238' : '#2d1b4e';
          rect(x, 160 - h, w, h, col);
          for (let wy = 160 - h + 4; wy < 156; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 6) if (r() < 0.55) rect(wx, wy, 3, 4, r() < 0.8 ? '#fee761' : '#feae34');
          x += w + (layer ? 2 : 6);
        }
      }
      rect(0, 160, W, 20, '#262b44');
      for (let x = 0; x < W; x += 20) rect(x, 169, 10, 1, '#5a6988');
    }), 0, 0);
    // search lights
    for (let i = 0; i < 2; i++) {
      const bx = 60 + i * 200, ang = Math.sin(t * 0.8 + i * 2) * 0.5;
      gfx.globalAlpha = 0.12;
      for (let y = 0; y < 150; y += 2) {
        const k = y / 150;
        rect(bx + Math.sin(ang) * (150 - y) - k * 10, y, 6 + (1 - k) * 14, 2, '#fff6c9');
      }
      gfx.globalAlpha = 1;
    }
    // people
    for (const p of st.people) this.drawPerson(p.x, 172, p, st.bowing, t);
    // the giant robot
    this.drawRobot(Math.round(st.rx), 164, t, st.rx < 150);
  }

  drawPerson(x, y, p, bow, t) {
    x = Math.round(x);
    if (bow) {
      rect(x - 2, y - 4, 4, 3, p.c);
      rect(x + 2, y - 3, 2, 2, '#e8b796');
      rect(x + 2, y - 4, 2, 1, p.hair);
      rect(x - 3, y - 1, 3, 1, '#262b44');
    } else {
      const f = Math.floor(t * 8 + p.ph) % 2;
      rect(x - 1, y - 9, 3, 3, '#e8b796'); rect(x - 1, y - 10, 3, 1, p.hair);
      rect(x - 1, y - 6, 3, 4, p.c);
      rect(x - 1, y - 2, 1, 2 - f, '#262b44'); rect(x + 1, y - 2, 1, 1 + f, '#262b44');
      if (Math.floor(t * 3 + p.ph) % 2) px(x - 2, y - 7, '#e8b796'); else px(x + 2, y - 7, '#e8b796');
    }
  }

  drawRobot(x, ground, t, walking) {
    const step = walking ? Math.sin(t * 5.6) : 0;
    const lift = Math.round(Math.max(0, step) * 5), lift2 = Math.round(Math.max(0, -step) * 5);
    const hipY = ground - 44;
    // legs
    for (const [s, l] of [[-1, lift], [1, lift2]]) {
      const lx = x + s * 12;
      rect(lx - 5, hipY, 10, 44 - l, '#3a4466');
      rect(lx - 4, hipY, 8, 44 - l, '#5a6988');
      rect(lx - 4, hipY + 20 - l, 8, 4, '#8b9bb4');
      rect(lx - 8, ground - 5 - l, 16, 5, '#262b44');
    }
    // body
    const by = hipY - 38;
    rect(x - 24, by, 48, 40, '#3a4466');
    rect(x - 22, by + 2, 44, 36, '#5a6988');
    rect(x - 22, by + 2, 44, 3, '#8b9bb4');
    for (let i = 0; i < 4; i++) { px(x - 20 + i * 13, by + 6, '#c0cbdc'); px(x - 20 + i * 13, by + 34, '#c0cbdc'); }
    disc(x, by + 20, 7, '#be4a2f');
    disc(x, by + 20, 5, Math.floor(t * 4) % 2 ? '#fee761' : '#feae34');
    text('FC', x - 16, by + 26, '#f77622', { font: F3 });
    // arms
    const sw = Math.round(Math.sin(t * 2.8) * 4);
    for (const s of [-1, 1]) {
      const ax = x + s * 28;
      rect(ax - 4, by + 4 + sw * s, 8, 30, '#3a4466');
      rect(ax - 3, by + 4 + sw * s, 6, 30, '#5a6988');
      rect(ax - 5, by + 32 + sw * s, 10, 6, '#262b44');
    }
    // fish bowl head
    const hy = by - 18;
    rect(x - 8, by - 4, 16, 5, '#3a4466');
    for (let y = hy - 8; y <= hy + 16; y++) {
      const dy = y - hy, hw = Math.floor(Math.sqrt(Math.max(0, 19 * 19 - dy * dy))) - 1;
      if (hw > 0) rect(x - hw, y, hw * 2 + 1, 1, y < hy - 6 ? '#9ff3fa' : '#4fb8dc');
    }
    sprC('hero2', Math.floor(t * 4) % 2, x + Math.sin(t) * 5, hy + 2, false);
    if (this.owned('mind')) spr('helmet', 0, Math.round(x + Math.sin(t) * 5) - 1, hy - 12);
    ring(x, hy, 19, '#c8f4ff');
    rect(x - 12, hy - 16, 25, 2, '#e8fbff');
    px(x - 12, hy - 6, '#ffffff'); px(x - 13, hy - 4, '#ffffff');
    rect(x, hy - 34, 1, 14, '#8b9bb4');
    disc(x, hy - 35, 2, Math.floor(t * 3) % 2 ? '#e43b44' : '#ff8f7a');
  }

  /* ------------------------------------------------------ the globe */
  drawGlobeShot() {
    const st = this.st, t = this.shotT;
    rect(0, 0, W, H, '#07060f');
    const r = mulberry32(4);
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * H), p = r() * 6;
      if (Math.sin(t * 2 + p) > -0.4) px(x, y, r() < 0.2 ? '#ffffff' : '#8b9bb4');
    }
    disc(270, 34, 12, '#c0cbdc'); disc(266, 30, 3, '#8b9bb4'); disc(274, 38, 2, '#8b9bb4');
    this.drawGlobe(W / 2, 80, 52, t * 0.35, Math.max(0, st.conquer));
    const n = Math.round(Math.max(0, st.conquer) * 195);
    if (st.conquer >= 0) {
      text('NATIONS JOINED: ' + n + ' / 195', W / 2, 144, n === 195 ? '#fee761' : '#ffffff', { align: 'center', outline: '#07060f' });
      rect(W / 2 - 60, 154, 120, 5, '#262b44');
      rect(W / 2 - 59, 155, Math.round(118 * Math.max(0, st.conquer)), 3, '#f77622');
    }
  }
  drawGlobe(cx, cy, R, rot, conquer) {
    const size = R * 2 + 1;
    if (!this.globeCanvas) { this.globeCanvas = makeCanvas(size, size); this.globeImg = this.globeCanvas.getContext('2d').createImageData(size, size); }
    const img = this.globeImg, d = img.data;
    const C = {
      sea: [hexRgb('#0b2a54'), hexRgb('#124e89'), hexRgb('#0099db')],
      land: [hexRgb('#265c42'), hexRgb('#3e8948'), hexRgb('#63c74d')],
      own: [hexRgb('#be4a2f'), hexRgb('#f77622'), hexRgb('#feae34')],
      ice: [hexRgb('#8b9bb4'), hexRgb('#c0cbdc'), hexRgb('#ffffff')],
    };
    // Everything that does not change as the globe spins is worked out once.
    if (!this.globeLUT) {
      const mh = WORLD_MAP.length, mw = WORLD_MAP[0].length, HW = 192, HH = 96;
      const L = (xx, yy) => (WORLD_MAP[clamp(yy, 0, mh - 1)][((xx % mw) + mw) % mw] === '#' ? 1 : 0);
      const land = new Uint8Array(HW * HH);   // 0 sea, 1 land, 2 ice, bit 4 = conquer order
      const order = new Float32Array(HW * HH);
      for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) {
        const fx = (i / HW) * mw - 0.5, fy = clamp((j / HH) * mh - 0.5, 0, mh - 1.001);
        const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
        const v = lerp(lerp(L(x0, y0), L(x0 + 1, y0), ax), lerp(L(x0, y0 + 1), L(x0 + 1, y0 + 1), ax), ay);
        const mx = ((Math.round(fx) % mw) + mw) % mw, my = clamp(Math.round(fy), 0, mh - 1);
        land[j * HW + i] = v > 0.5 ? (my >= mh - 2 || my === 0 ? 2 : 1) : 0;
        order[j * HW + i] = ((mx * 7 + my * 13) % 101) / 101;
      }
      const px0 = [];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const nx = (x - R) / R, ny = (y - R) / R, q = nx * nx + ny * ny;
        if (q > 1) continue;
        const nz = Math.sqrt(1 - q);
        const lat = Math.asin(-ny);
        const u0 = Math.atan2(nx, nz) / (Math.PI * 2) + 0.5;
        const row = clamp(Math.floor((0.5 - lat / Math.PI) * HH), 0, HH - 1);
        const light = clamp(-nx * 0.45 - ny * 0.45 + nz * 0.75, 0, 1);
        px0.push([(y * size + x) * 4, u0, row, Math.min(2, Math.floor(light * 2.2 + bayer(x, y) * 0.9))]);
      }
      this.globeLUT = { land, order, HW, pixels: px0 };
      d.fill(0);
    }
    const G = this.globeLUT, shift = rot / (Math.PI * 2);
    for (const [o, u0, row, lv] of G.pixels) {
      let u = (u0 + shift) % 1;
      if (u < 0) u += 1;
      const k = row * G.HW + Math.floor(u * G.HW);
      const ty = G.land[k];
      const pal = ty === 0 ? C.sea : ty === 2 ? C.ice : G.order[k] < conquer * 1.02 ? C.own : C.land;
      const c = pal[lv];
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    this.globeCanvas.getContext('2d').putImageData(img, 0, 0);
    // atmosphere glow
    gfx.globalAlpha = 0.25;
    ring(cx, cy, R + 2, '#2ce8f5');
    gfx.globalAlpha = 0.5;
    ring(cx, cy, R + 1, '#2ce8f5');
    gfx.globalAlpha = 1;
    blit(this.globeCanvas, cx - R, cy - R);
    // fish empire flag on the north pole
    if (conquer >= 1) {
      rect(cx, cy - R - 16, 1, 16, '#c0cbdc');
      rect(cx + 1, cy - R - 16, 14, 9, '#f77622');
      sprC('hero0', 0, cx + 8, cy - R - 12);
    }
  }

  /* ----------------------------------------------------- the throne */
  drawThrone() {
    const st = this.st, t = this.shotT;
    blit(this.cached('hall', W, H, () => {
      paintGradient(gfx, 0, 0, W, 140, [[0, '#2a0f24'], [1, '#68386c']], 2.5);
      for (const x of [30, 90, 230, 290]) {
        rect(x - 7, 10, 14, 130, '#be8a2f'); rect(x - 5, 10, 10, 130, '#fee761'); rect(x - 5, 10, 3, 130, '#fff6c9');
        rect(x - 9, 8, 18, 5, '#be8a2f'); rect(x - 9, 136, 18, 5, '#be8a2f');
      }
      for (const x of [60, 260]) {
        rect(x - 12, 18, 24, 40, '#68386c'); rect(x - 10, 18, 20, 38, '#b55088');
        for (let i = 0; i < 3; i++) px(x - 10 + i * 10, 56, '#b55088');
      }
      rect(0, 140, W, 40, '#3e2731');
      for (let y = 140; y < H; y += 6) for (let x = (y / 6) % 2 ? 0 : 12; x < W; x += 24) rect(x, y, 12, 6, '#4a2f38');
      // red carpet with perspective
      for (let y = 100; y < H; y++) { const hw = Math.round(20 + (y - 100) * 0.5); rect(160 - hw, y, hw * 2, 1, '#a22633'); px(160 - hw, y, '#fee761'); px(160 + hw - 1, y, '#fee761'); }
      // throne
      rect(128, 46, 64, 74, '#be8a2f'); rect(132, 50, 56, 66, '#fee761');
      rect(136, 54, 48, 40, '#a22633'); rect(138, 56, 44, 36, '#e43b44');
      for (const x of [128, 184]) { rect(x, 36, 8, 12, '#be8a2f'); disc(x + 4, 34, 4, '#fee761'); }
      rect(122, 96, 76, 12, '#be8a2f'); rect(124, 98, 72, 8, '#fee761');
      rect(126, 108, 8, 14, '#be8a2f'); rect(186, 108, 8, 14, '#be8a2f');
    }), 0, 0);
    // fish emblems on the banners
    for (const x of [60, 260]) sprC('hero1', 0, x, 36);
    // the royal bowl
    const bx = 160, by = 98;
    this.drawBowl(bx, by, 1, false, t);
    const fx = bx + Math.sin(t * 1.2) * 5, fy = by - 16 + Math.sin(t * 2) * 1.5;
    sprC('hero2', Math.floor(t * 4) % 2, fx, fy, Math.cos(t * 1.2) < 0);
    spr('crown', 0, Math.round(fx) - 3, Math.round(fy) - 13);
    ring(bx, by - 16, 18, '#c8f4ff');
    // Sam, the royal feeder
    drawSam(206, 150, 'stand', 0, true, 'butler');
    if (st.feed >= 0 && st.feed < 2) {
      rect(186, 60, 14, 7, '#124e89'); rect(186, 62, 14, 3, '#fee761');
      thickLine(200, 64, 206, 128, 1.5, '#e8b796');
    }
    // bowing subjects
    for (let i = 0; i < 5; i++) {
      const x = 40 + i * 14, y = 170;
      this.drawPerson(x, y, { c: ['#e43b44', '#0099db', '#63c74d', '#feae34', '#b55088'][i], hair: '#3e2731', ph: i }, true, t);
      this.drawPerson(W - 40 - i * 14, y, { c: ['#b55088', '#feae34', '#e43b44', '#0099db', '#63c74d'][i], hair: '#733e39', ph: i }, true, t);
    }
    // sparkles
    if (Math.random() < 0.2) this.parts.add({ type: 'spark', x: rnd(120, 200), y: rnd(40, 120), life: 0.5, c: '#fee761' });
  }

  /* --------------------------------------------------------- the end */
  drawEnd() {
    const t = this.shotT, s = GS.stats;
    blit(this.cached('endSky', W, H, () => paintGradient(gfx, 0, 0, W, H, [[0, '#07060f'], [0.6, '#1b1238'], [1, '#2d1b4e']], 2.5)), 0, 0);
    const k = easeOut(clamp(t / 0.8, 0, 1));
    drawBig('THE END', W / 2, Math.round(lerp(-40, 14, k)), 'gold', 'center', 4);
    if (t > 0.8) {
      text('ALL HAIL {' + GS.fishName + '}, RULER OF THE WORLD!', W / 2, 68, '#ffffff', { align: 'center', accent: '#fee761', outline: '#07060f' });
      sprC('hero2', Math.floor(t * 4) % 2, W / 2, 88);
      spr('crown', 0, W / 2 - 3, 76);
    }
    if (t > 1.4) {
      const mins = Math.floor(s.time / 60);
      const lines = [
        ['FOOD EATEN IN THE SEA', s.eaten],
        ['TIMES YOU GOT EATEN', s.deaths],
        ['DAYS IN THE BOWL', s.days],
        ['FLAKES EATEN', s.flakes],
        ['IDEAS CAUGHT', s.ideas],
        ['PLAY TIME', mins + ' MIN'],
      ];
      let y = 102;
      for (let i = 0; i < lines.length; i++) {
        if (t < 1.4 + i * 0.2) break;
        text(lines[i][0], 88, y, '#9fe8f5', { font: F3 });
        text(String(lines[i][1]), 232, y, '#ffffff', { font: F3, align: 'right' });
        y += 8;
      }
    }
    if (t > 3) {
      text('THANKS FOR PLAYING FISH LIFE!', W / 2, 154, '#fee761', { align: 'center', outline: '#07060f' });
      if (Math.floor(t * 2) % 2 === 0) text(Input.touchSeen ? 'TAP TO RETURN' : 'PRESS ENTER', W / 2, 166, '#8b9bb4', { align: 'center', font: F3 });
    }
  }
}
