'use strict';
/* =====================================================================
   FISH LIFE  -  title.js
   The title screen: a sunset over the sea, the camera sinks below the
   waves, and the logo splashes down into the water letter by letter.
   ===================================================================== */

const TITLE_SURF = 40;          // scene y of the sea surface
const TITLE_TOP = -120;         // how far up the intro pan starts

class TitleScene {
  constructor(opt = {}) {
    this.t = 0;
    this.skipIntro = !!opt.skipIntro || REDUCED_MOTION;
    this.camY = this.skipIntro ? 0 : TITLE_TOP;
    this.state = opt.skipIntro ? 'menu' : this.skipIntro ? 'press' : 'intro';
    this.parts = new Particles();
    this.save = Save.load();
    this.crowned = !!Save.options().crowned;
    this.sub = 0;
    this.help = false;
    this.confirm = null;
    this.buildStatic();
    this.buildEffects();
    this.buildLogo();
    this.buildMenu();
    this.school = { x: -80, y: 100, dir: 1, wait: 2 };
    this.manta = { x: 420, y: 96, wait: 8 };
    this.clam = { t: 0, open: 0, next: 4 };
    this.bubbleT = 0;
    this.gulls = [0, 1, 2].map(i => ({ x: 140 + i * 22, y: 10 + i * 5, s: 5 + i, f: i }));
    this.stars = [];
    const r = mulberry32(99);
    for (let i = 0; i < 60; i++) this.stars.push({ x: Math.floor(r() * W), y: Math.floor(TITLE_TOP + r() * 115), p: r() * 6, b: r() < 0.2 });
    this.clouds = [
      { x: 10, y: -24, w: 58, c: '#4a2667', l: '#74306f' },
      { x: 180, y: -8, w: 70, c: '#74306f', l: '#a8406e' },
      { x: 60, y: 8, w: 46, c: '#a8406e', l: '#f07d5a' },
      { x: 250, y: 16, w: 40, c: '#d9586a', l: '#fcd27a' },
      { x: 120, y: 24, w: 30, c: '#d9586a', l: '#fcd27a' },
    ];
  }

  enter() {
    Sound.play('title');   // starts right away, or as soon as the first key unlocks audio
  }

  /* ------------------------------------------------ static artwork */
  buildStatic() {
    // sunset sky from the top of the intro pan down to the horizon
    this.sky = gradientCanvas(W, TITLE_SURF - TITLE_TOP, [
      [0, '#0e0a24'], [0.31, '#1b1238'], [0.5, '#2d1b4e'], [0.66, '#4a2667'], [0.75, '#74306f'],
      [0.81, '#a8406e'], [0.875, '#d9586a'], [0.925, '#f07d5a'], [0.96, '#f9a857'], [0.985, '#fcd27a'], [1, '#fdeeb0'],
    ], 2.5);
    // the sea, lit warm near the surface and fading into deep blue
    this.water = gradientCanvas(W, H - TITLE_SURF, [
      [0, '#3aa9c6'], [0.12, '#2690b6'], [0.3, '#1d73a0'], [0.5, '#175b88'], [0.7, '#12466f'], [0.86, '#0e3559'], [1, '#0b2848'],
    ], 2.5);
    // distant reef silhouettes
    this.reef = makeCanvas(W, 80);
    {
      const g = this.reef.getContext('2d'), prev = setTarget(g);
      for (let x = 0; x < W; x++) {
        let h = 40 + Math.sin(x * 0.028) * 9 + Math.sin(x * 0.083 + 1) * 4 + Math.sin(x * 0.21) * 1.5;
        if (x > 30 && x < 70) h -= Math.max(0, 16 - Math.abs(x - 50) * 0.8);   // rock pillar
        if (x > 262 && x < 298) h -= Math.max(0, 22 - Math.abs(x - 280) * 1.2);
        rect(x, Math.round(h), 1, 80, '#0f3a57');
        rect(x, Math.round(h) + 10, 1, 80, '#0d3350');
      }
      // a few tall rock spires
      for (const [sx, sh, sw] of [[96, 30, 5], [104, 20, 4], [196, 24, 5], [230, 14, 4]]) {
        for (let y = 40 - sh; y < 60; y++) {
          const k = (y - (40 - sh)) / sh;
          const hw = Math.round(sw * (0.5 + k * 0.6));
          rect(sx - hw, y, hw * 2, 1, '#0f3a57');
        }
      }
      setTarget(prev);
    }
    // sandy sea floor with rocks and coral (drawn at scene y 148)
    this.floor = makeCanvas(W, 32);
    {
      const g = this.floor.getContext('2d'), prev = setTarget(g);
      const r = mulberry32(12);
      const top = x => Math.round(22 + Math.sin(x * 0.05) * 2 + Math.sin(x * 0.13 + 2) * 1);
      for (let x = 0; x < W; x++) {
        const ty = top(x);
        rect(x, ty, 1, 32, '#b09468');
        px(x, ty, '#d1b784');
        for (let y = ty + 2; y < 32; y++) if (r() < 0.12) px(x, y, r() < 0.5 ? '#8f7a58' : '#c4aa7a');
      }
      // rocks
      for (const [rx, rw, rh] of [[14, 16, 10], [72, 12, 7], [206, 18, 11], [296, 20, 12]]) {
        ellipse(rx, 24, rw / 2, rh / 2 + 1, '#1c3448');
        ellipse(rx - 1, 23, rw / 2 - 1, rh / 2, '#2b4a5e');
        ellipse(rx - 3, 21, rw / 4, rh / 4, '#3f6a80');
      }
      // branching coral
      const branch = (x, y, len, ang, col, depth) => {
        const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
        line(x, y, x2, y2, col);
        line(x + 1, y, x2 + 1, y2, col);
        if (depth > 0) {
          branch(x2, y2, len * 0.7, ang - 0.5, col, depth - 1);
          branch(x2, y2, len * 0.7, ang + 0.45, col, depth - 1);
        } else disc(x2, y2, 1, mix(col, '#ffffff', 0.35));
      };
      branch(40, 26, 7, -Math.PI / 2, '#f6757a', 2);
      branch(238, 26, 8, -Math.PI / 2 - 0.1, '#f77622', 2);
      branch(120, 27, 5, -Math.PI / 2 + 0.2, '#b55088', 2);
      // fan coral
      for (let a = -2.6; a < -0.5; a += 0.18) line(268, 24, 268 + Math.cos(a) * 11, 24 + Math.sin(a) * 11, '#b55088');
      ring(268, 24, 11, '#d77aa8');
      rect(255, 24, 26, 8, '#b09468');
      // tube sponges
      for (const [tx, th] of [[184, 9], [188, 6], [191, 11]]) { rect(tx, 26 - th, 3, th, '#feae34'); rect(tx, 26 - th, 3, 1, '#fee761'); px(tx + 1, 26 - th, '#be4a2f'); }
      // brain coral
      ellipse(92, 24, 6, 4, '#63c74d'); ellipse(92, 23, 5, 3, '#8fdc6a');
      for (let i = -4; i <= 4; i += 2) px(92 + i, 22 + (i % 4 ? 1 : 0), '#3e8948');
      // shells & star
      setTarget(prev);
      g.drawImage(SPR.star.r[0], 150 - 22, 22);
      g.drawImage(SPR.shell.r[0], 60, 25);
      g.drawImage(SPR.shell.r[0], 222, 26);
    }
  }

  buildEffects() {
    this.rays = [[112, 6, 100], [150, 10, 120], [188, 7, 96], [222, 13, 130], [256, 8, 110], [292, 6, 86]]
      .map(([x, w0, len]) => ({ x, img: makeRay(w0, len, -0.45, '#fff1c1', 0.16) }));
    this.waves = makeWaveStrips(W, '#fdeeb0', '#3aa9c6', '#bff4fb');
    this.sun = makeCanvas(71, 71);
    const prev = setTarget(this.sun.getContext('2d'));
    const sx = 35, sy = 35;
    for (const [r, cov] of [[34, 0.12], [28, 0.25], [22, 0.45]]) {
      for (let dy = -r; dy <= 0; dy++) {
        const hw = Math.floor(Math.sqrt(r * r - dy * dy));
        ditherRect(sx - hw, sy + dy, hw * 2 + 1, 1, '#fde69a', cov);
      }
    }
    disc(sx, sy, 16, '#fde69a');
    disc(sx, sy, 13, '#fff1c1');
    disc(sx, sy, 9, '#fffae8');
    for (let i = 0; i < 3; i++) rect(sx - 16, sy - 3 - i * 4, 33, 1, '#fcd27a');
    setTarget(prev);
  }

  buildLogo() {
    this.letters = [];
    const word = 'FISH LIFE';
    const imgs = [];
    let total = 0;
    for (const ch of word) {
      if (ch === ' ') { imgs.push(null); total += 9; continue; }
      const img = buildLogoLetter(ch);
      imgs.push(img);
      total += img.width + 1;
    }
    let x = Math.floor((W - total) / 2);
    let i = 0;
    for (let k = 0; k < word.length; k++) {
      const img = imgs[k];
      if (!img) { x += 9; continue; }
      // fill pixels for the shine effect
      const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
      const fill = [];
      const outline = hexRgb(LOGO_STYLE.out), ex0 = hexRgb(LOGO_STYLE.ex[0]), ex1 = hexRgb(LOGO_STYLE.ex[1]);
      for (let yy = 0; yy < img.height; yy++) for (let xx = 0; xx < img.width; xx++) {
        const o = (yy * img.width + xx) * 4;
        if (d[o + 3] === 0) continue;
        const same = c => d[o] === c[0] && d[o + 1] === c[1] && d[o + 2] === c[2];
        if (!same(outline) && !same(ex0) && !same(ex1)) fill.push([xx, yy]);
      }
      const L = { img, fill, x, y: -40, vy: 0, ty: 50, drop: 1.8 + i * 0.1, state: this.skipIntro ? 'rest' : 'wait', splashed: false, i };
      if (this.skipIntro) L.y = L.ty;
      this.letters.push(L);
      x += img.width + 1;
      i++;
    }
    this.subtitle = '~ A SMALL FISH WITH BIG DREAMS ~';
    if (this.skipIntro) this.sub = this.subtitle.length;
  }

  buildMenu() {
    const hasSave = !!(this.save && !this.save.won);
    this.menu = new Menu([
      { label: 'NEW GAME', action: () => this.newGame() },
      { label: 'CONTINUE', disabled: !hasSave, action: () => this.continueGame() },
      { label: 'HOW TO PLAY', action: () => { this.help = true; } },
    ], { y: 114, gap: 13 });
    if (hasSave) this.menu.sel = 1;
  }

  newGame() {
    const sv = this.save;
    const progress = sv && !sv.won && (sv.chapter !== 'sea' || (sv.sea && (sv.sea.stage > 0 || sv.sea.food > 0)));
    if (progress && !this.confirm) {
      this.confirm = new Menu([
        { label: 'YES, START OVER', action: () => { this.confirm = null; this.startNew(); } },
        { label: 'NO, GO BACK', action: () => { this.confirm = null; } },
      ], { y: 104, gap: 13 });
      this.confirm.sel = 1;
      return;
    }
    this.startNew();
  }
  startNew() {
    GS = newGameState();
    saveGame();
    Game.go(() => new ChapterCard(1, 'THE SEA', 'YOU ARE A TINY FISH IN A BIG, BIG SEA.', () => new SeaScene()));
  }
  continueGame() {
    GS = Object.assign(newGameState(), this.save);
    Game.go(() => sceneForChapter());
  }

  /* ------------------------------------------------------- update */
  update(dt, active) {
    this.t += dt;
    const t = this.t;
    // intro camera pan
    if (this.state === 'intro') {
      const k = clamp(t / 2, 0, 1);
      this.camY = Math.round(lerp(TITLE_TOP, 0, easeInOut(k)));
      if (active && (Input.any || Input.mhit) && t > 0.2) this.finishIntro();
      const last = this.letters[this.letters.length - 1];
      if (last.state === 'rest' && this.sub >= this.subtitle.length) this.state = 'press';
    } else if (this.state === 'press') {
      if (active && (hit('ok') || Input.mhit || Input.any)) {
        Sound.unlock();
        Sound.play('title');
        Sound.sfx('ok');
        this.state = 'menu';
        this.menu.t = 0;
      }
    } else if (this.state === 'menu' && active) {
      if (this.help) {
        if (hit('ok') || hit('back') || Input.mhit) { this.help = false; Sound.sfx('back'); }
      } else if (this.confirm) {
        if (hit('back')) { this.confirm = null; Sound.sfx('back'); } else this.confirm.update(dt);
      } else {
        this.menu.update(dt);
      }
    }
    // letters: wait, fall through the air, splash, bob in the water
    for (const L of this.letters) {
      if (L.state === 'wait' && t >= L.drop) { L.state = 'fall'; L.y = -44; L.vy = 40; }
      if (L.state === 'fall') {
        L.vy += 520 * dt;
        L.y += L.vy * dt;
        if (L.y + L.img.height * 0.6 > TITLE_SURF) {
          L.state = 'swim';
          L.vy *= 0.35;
          this.splash(L.x + L.img.width / 2, L.img.width);
        }
      } else if (L.state === 'swim') {
        const a = (L.ty - L.y) * 55 - L.vy * 5.5;
        L.vy += a * dt;
        L.y += L.vy * dt;
        if (Math.random() < 0.25) this.parts.add({ type: 'bubble', x: L.x + rnd(2, L.img.width - 2), y: L.y + rnd(0, 20), vy: -rnd(10, 22), life: rnd(1, 2), size: rndi(1, 2), c: '#c8f4ff', minY: TITLE_SURF + 1 });
        if (Math.abs(L.ty - L.y) < 0.4 && Math.abs(L.vy) < 3) { L.state = 'rest'; L.y = L.ty; }
      }
    }
    if (this.letters[this.letters.length - 1].state === 'rest' && this.sub < this.subtitle.length) {
      const before = Math.floor(this.sub);
      this.sub += dt * 30;
      if (Math.floor(this.sub) !== before && this.subtitle[before] !== ' ') Sound.sfx('type');
    }
    // ambient life
    this.bubbleT -= dt;
    if (this.bubbleT <= 0) {
      this.bubbleT = rnd(0.25, 0.7);
      this.parts.add({ type: 'bubble', x: rnd(0, W), y: 176, vy: -rnd(9, 18), life: 12, size: rndi(1, 3), c: '#9fe8f5', minY: TITLE_SURF + 1 });
    }
    const c = this.clam;
    c.next -= dt;
    if (c.next <= 0 && c.open === 0) { c.open = 0.01; c.t = 0; }
    if (c.open > 0) {
      c.t += dt;
      c.open = c.t < 0.4 ? c.t / 0.4 : c.t < 2.4 ? 1 : Math.max(0, 1 - (c.t - 2.4) / 0.4);
      if (c.t > 0.4 && c.t < 2.2 && Math.random() < 0.3) this.parts.add({ type: 'bubble', x: 150 + rnd(-2, 2), y: 164, vy: -rnd(14, 24), life: 9, size: rndi(1, 3), c: '#c8f4ff', minY: TITLE_SURF + 1 });
      if (c.t > 2.8) { c.open = 0; c.next = rnd(5, 9); }
    }
    const s = this.school;
    if (s.wait > 0) { s.wait -= dt; if (s.wait <= 0) { s.dir = Math.random() < 0.5 ? 1 : -1; s.x = s.dir > 0 ? -70 : W + 70; s.y = rnd(86, 104); } }
    else { s.x += s.dir * 16 * dt; if (s.x > W + 80 || s.x < -80) s.wait = rnd(3, 7); }
    const m = this.manta;
    if (m.wait > 0) m.wait -= dt;
    else { m.x -= 11 * dt; if (m.x < -60) { m.x = W + 60; m.y = rnd(84, 104); m.wait = rnd(14, 22); } }
    for (const gl of this.gulls) { gl.x += gl.s * dt; if (gl.x > W + 10) { gl.x = -10; gl.y = rnd(4, 26); } }
    for (const cl of this.clouds) { cl.x += (cl.y < 0 ? 1.5 : 3) * dt; if (cl.x > W + 10) cl.x = -cl.w - 10; }
    this.parts.update(dt);
  }

  finishIntro() {
    this.camY = 0;
    for (const L of this.letters) { L.state = 'rest'; L.y = L.ty; }
    this.sub = this.subtitle.length;
    this.state = 'press';
    this.t = Math.max(this.t, 4);
  }

  splash(x, w) {
    Sound.sfx('plop');
    for (let i = 0; i < 14; i++) {
      this.parts.add({ x: x + rnd(-w / 2, w / 2), y: TITLE_SURF - 1, vx: rnd(-30, 30), vy: -rnd(30, 80), g: 260, life: rnd(0.4, 0.8), c: pick(['#ffffff', '#c8f4ff', '#9fe8f5']) });
    }
    for (let i = 0; i < 6; i++) this.parts.add({ type: 'bubble', x: x + rnd(-w / 2, w / 2), y: TITLE_SURF + rnd(4, 14), vy: -rnd(4, 12), life: 1.2, size: rndi(1, 3), c: '#e8fbff', minY: TITLE_SURF + 1 });
  }

  /* --------------------------------------------------------- draw */
  draw() {
    const t = this.t, cy = this.camY;
    // sky
    blit(this.sky, 0, TITLE_TOP - cy);
    for (const s of this.stars) {
      const sy = s.y - cy;
      if (sy < 0 || sy > H) continue;
      const tw = Math.sin(t * 2 + s.p);
      if (tw > -0.6) px(s.x, sy, s.b && tw > 0.7 ? '#ffffff' : s.y < -60 ? '#c0cbdc' : '#8b9bb4');
      if (s.b && tw > 0.85) { px(s.x - 1, sy, '#8b9bb4'); px(s.x + 1, sy, '#8b9bb4'); px(s.x, sy - 1, '#8b9bb4'); px(s.x, sy + 1, '#8b9bb4'); }
    }
    // sun with a soft, dithered halo (baked once)
    blit(this.sun, 238 - 35, TITLE_SURF + 2 - cy - 35);
    // clouds
    for (const cl of this.clouds) this.drawCloud(cl.x, cl.y - cy, cl.w, cl.c, cl.l);
    // gulls
    for (const gl of this.gulls) {
      const f = Math.floor(t * 4 + gl.f) % 2, gx = Math.round(gl.x), gy = Math.round(gl.y - cy);
      if (f) { px(gx - 2, gy, '#2d1b4e'); px(gx - 1, gy + 1, '#2d1b4e'); px(gx, gy, '#2d1b4e'); px(gx + 1, gy + 1, '#2d1b4e'); px(gx + 2, gy, '#2d1b4e'); }
      else { px(gx - 2, gy + 1, '#2d1b4e'); px(gx - 1, gy, '#2d1b4e'); px(gx, gy + 1, '#2d1b4e'); px(gx + 1, gy, '#2d1b4e'); px(gx + 2, gy + 1, '#2d1b4e'); }
    }
    // a distant fishing boat on the horizon... foreshadowing!
    const bx = 64, by = TITLE_SURF - cy + (Math.sin(t * 1.4) > 0.3 ? 1 : 0);
    rect(bx - 9, by - 3, 18, 2, '#2d1b4e'); rect(bx - 7, by - 1, 14, 1, '#2d1b4e');
    rect(bx - 4, by - 6, 6, 3, '#2d1b4e'); rect(bx + 4, by - 12, 1, 9, '#2d1b4e');
    line(bx + 4, by - 11, bx - 8, by - 6, '#2d1b4e');
    px(bx - 3, by - 5, '#fcd27a');
    // the sea
    const wy = TITLE_SURF - cy;
    if (wy < H) {
      blit(this.water, 0, wy);
      // light rays from the setting sun (baked once, drawn as single blits)
      for (let i = 0; i < this.rays.length; i++) {
        const r = this.rays[i];
        gfx.globalAlpha = 0.85 + Math.sin(t * 1.3 + i * 2.3) * 0.15;
        gfx.drawImage(r.img, Math.round(r.x - r.img.anchor + Math.sin(t * 0.6 + i * 1.7) * 2), wy + 1);
      }
      gfx.globalAlpha = 1;
      // far reef + manta ray
      if (!this.manta.wait) this.drawManta(this.manta.x, this.manta.y - cy, t);
      blit(this.reef, 0, 100 - cy);
      // fish school
      if (this.school.wait <= 0) {
        for (let i = 0; i < 18; i++) {
          const ox = ((i * 37) % 50) - 25 + Math.sin(t * 2 + i) * 2;
          const oy = ((i * 23) % 18) - 9 + Math.sin(t * 1.6 + i * 0.7) * 2;
          const fx = Math.round(this.school.x + ox * this.school.dir), fy = Math.round(this.school.y + oy - cy);
          const glint = Math.sin(t * 5 + i * 2) > 0.92;
          const c1 = glint ? '#9fe8f5' : '#0e3d5c';
          const d = this.school.dir;
          rect(fx - 1, fy, 3, 2, c1);
          px(fx - 2 * d, fy - (Math.floor(t * 8 + i) % 2), c1);
          px(fx - 2 * d, fy + 1 + (Math.floor(t * 8 + i) % 2) - 1, c1);
        }
      }
      // jellyfish
      this.drawJelly(292, 70 + Math.sin(t * 0.8) * 6 - cy, t);
      this.drawJelly(30, 88 + Math.sin(t * 0.7 + 2) * 5 - cy, t + 1);
      // kelp forests on both sides
      const kelp = [[8, 70], [20, 92], [34, 60], [276, 66], [290, 96], [306, 78], [316, 58]];
      for (let i = 0; i < kelp.length; i++) drawKelp(kelp[i][0], 176 - cy, kelp[i][1], t, i * 1.3, '#1d5e4a', '#2c8a62');
      // sea floor
      blit(this.floor, 0, 148 - cy);
      this.drawClam(150, 166 - cy);
      // our hero, swimming around the bottom of the menu
      const hx = 160 + Math.sin(t * 0.21) * 128, hy = 150 + Math.sin(t * 0.9) * 5 - cy;
      const facing = Math.cos(t * 0.21) >= 0;
      sprC('hero2', Math.floor(t * 5) % 2, hx, hy, !facing);
      if (this.crowned) spr('crown', 0, Math.round(hx - 4 + (facing ? 1 : -1)), Math.round(hy - 11));
      // surface line with glinting sunlight
      drawWaves(this.waves, 0, wy, t);
      for (let i = 0; i < 12; i++) {
        const gx = 208 + ((i * 23 + Math.floor(t * 6) * 11) % 62);
        if (Math.sin(t * 5 + i * 1.7) > 0.4) px(gx, wy, '#ffffff');
      }
      for (let i = 0; i < 8; i++) {
        const gx = 214 + ((i * 29 + Math.floor(t * 3) * 7) % 50), gy = wy + 3 + ((i * 7) % 9);
        if (Math.sin(t * 4 + i) > 0.3) rect(gx, gy, 3, 1, 'rgba(255,241,193,0.6)');
      }
    }
    this.parts.draw(0, cy);
    // logo
    for (const L of this.letters) {
      if (L.state === 'wait') continue;
      const bob = L.state === 'rest' ? Math.round(Math.sin(t * 1.8 - L.i * 0.55) * 1.6) : 0;
      const lx = L.x, ly = Math.round(L.y + bob - cy);
      blit(L.img, lx, ly);
      // a shine sweeping across the letters every few seconds
      if (L.state === 'rest') {
        const sweep = ((t - 5) % 6) * 110 - 40;
        const local = sweep - (lx - 70);
        if (local > -10 && local < L.img.width + 40) {
          gfx.fillStyle = '#ffffff';
          for (const [fx, fy] of L.fill) {
            const d = fx + fy * 0.6 - local;
            if (d >= 0 && d < 3) gfx.fillRect(lx + fx, ly + fy, 1, 1);
          }
        }
      }
    }
    // subtitle
    if (this.sub > 0) {
      const s = this.subtitle.slice(0, Math.floor(this.sub));
      const x0 = Math.floor(W / 2 - textW(this.subtitle) / 2);
      text(s, x0, 91 - cy, '#9fe8f5', { outline: '#0b1d40' });
    }
    // press start / menu
    if (this.state === 'press') {
      if (Math.floor(t * 2.2) % 2 === 0) {
        const msg = Input.touchSeen ? 'TAP TO START' : 'PRESS ENTER';
        text(msg, W / 2, 122, '#ffffff', { align: 'center', outline: '#0b1d40' });
        const w = textW(msg);
        spr('cursorFish', Math.floor(t * 6) % 2, W / 2 - w / 2 - 14, 121);
        spr('cursorFish', Math.floor(t * 6) % 2, W / 2 + w / 2 + 6, 121, true);
      }
    } else if (this.state === 'menu') {
      if (this.help) this.drawHelp();
      else if (this.confirm) {
        panel(64, 84, 192, 58, { fill: '#141330' });
        text('ERASE YOUR SAVED FISH?', W / 2, 91, '#fee761', { align: 'center' });
        this.confirm.draw();
      } else {
        this.menu.draw('#0b1d40');
        const hint = '↑↓ CHOOSE   ENTER OK   M SOUND   F FULLSCREEN';
        text(hint, W / 2, 173, '#ead4aa', { font: F3, align: 'center', outline: '#3e2731' });
      }
    }
  }

  drawCloud(x, y, w, body, lit) {
    x = Math.round(x); y = Math.round(y);
    const r = Math.max(2, Math.round(w * 0.075));
    disc(x + w * 0.28, y + 2, r, body);
    disc(x + w * 0.5, y + 1, r + 1, body);
    disc(x + w * 0.72, y + 2, r - 1, body);
    rect(x + 2, y + 2, w - 4, 3, body);
    rect(x, y + 3, w, 2, body);
    rect(x + 1, y + 5, w - 2, 1, lit);
    rect(x + Math.floor(w * 0.35), y + 4, Math.floor(w * 0.4), 1, lit);
  }

  drawManta(x, y, t) {
    x = Math.round(x); y = Math.round(y);
    const f = Math.sin(t * 2.2);
    const wing = Math.round(f * 3);
    const c = '#123f5e';
    ellipse(x, y, 6, 3, c);
    for (let i = 1; i <= 12; i++) {
      const k = i / 12;
      const yy = y + Math.round(wing * k * k) - Math.round(k * 2);
      const hh = Math.max(1, Math.round(3 * (1 - k)));
      rect(x - 4 + i * 0, yy - hh + 1, 1, hh, c);
      rect(x - 2 - i, yy - hh + 1 + 1, 1, hh, c);
      rect(x + 2 + i, yy - hh + 1 + 1, 1, hh, c);
    }
    line(x + 6, y, x + 18, y + 1, c);
    rect(x - 7, y - 1, 2, 2, c);
  }

  drawJelly(x, y, t) {
    x = Math.round(x); y = Math.round(y);
    const p = Math.sin(t * 3) > 0 ? 1 : 0;
    gfx.globalAlpha = 0.75;
    rect(x - 3 - p, y + 1, 7 + p * 2, 3, '#d77aa8');
    rect(x - 2, y, 5, 1, '#f6a0c0');
    rect(x - 2 - p, y + 4, 5 + p * 2, 1, '#b55088');
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 6; j++) px(x - 2 + i * 2 + Math.round(Math.sin(t * 3 + j * 0.8 + i) * 0.8), y + 5 + j, '#d77aa8');
    }
    gfx.globalAlpha = 1;
    px(x - 1, y + 1, '#ffffff');
  }

  drawClam(x, y) {
    const o = this.clam.open;
    const lift = Math.round(o * 4);
    ellipse(x, y + 3, 7, 2, '#5a4a6a');
    rect(x - 7, y + 2, 15, 2, '#8a7a9a');
    if (o > 0.3) disc(x, y + 1, 1.5, '#ffffff');
    rect(x - 7, y + 1 - lift, 15, 2, '#a898b8');
    rect(x - 6, y - lift, 13, 1, '#c8b8d8');
    for (let i = -5; i <= 5; i += 2) px(x + i, y + 1 - lift, '#7a6a8a');
  }

  drawHelp() {
    panel(22, 20, 276, 146, { fill: '#141330' });
    drawBig('HOW TO PLAY', W / 2, 8, 'aqua');
    const lines = [
      ['{ARROWS / WASD}', 'SWIM'],
      ['{SPACE}', 'DASH (A QUICK BURST)'],
      ['{MOUSE / TOUCH}', 'HOLD TO SWIM THAT WAY'],
      ['{TAB}', 'BRAIN UPGRADES (IN THE BOWL)'],
    ];
    let y = 38;
    for (const [a, b] of lines) {
      text(a, 32, y, '#ffffff', { accent: '#fee761' });
      text(b, 118, y, '#c0cbdc');
      y += 11;
    }
    text('{ESC} PAUSE   {M} SOUND   {F} FULLSCREEN', 32, y, '#c0cbdc', { accent: '#fee761' });
    y += 11;
    const story = wrap('EAT WHAT FISH EAT AND GROW BIGGER. DODGE BIGGER FISH, JELLYFISH, EELS, CRABS AND HUNGRY SEAGULLS. ONE DAY A NET WILL COME... BUT THAT IS ONLY THE BEGINNING. YOUR TRUE DESTINY: {RULE THE WORLD.}', 256, F5);
    y += 4;
    for (const l of story) { text(l, 32, y, '#9fe8f5', { accent: '#fee761' }); y += 10; }
    if (Math.floor(this.t * 2) % 2 === 0) text('PRESS ENTER TO GO BACK', W / 2, 156, '#fee761', { align: 'center', font: F3 });
  }
}

// Picks the right scene for the chapter stored in the save.
function sceneForChapter() {
  switch (GS.chapter) {
    case 'caught': return new StoryScene('caught');
    case 'bowl': return new BowlScene();
    case 'ending': return new EndingScene();
    default: return new SeaScene();
  }
}
