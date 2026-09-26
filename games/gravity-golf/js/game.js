// Gravity Golf — a pixel-art mini-golf in space. Planets pull your ball; land it in the cup in as few strokes as you can.
(() => {
  'use strict';
  const GG = window.GG;
  const W = 320, H = 180, BR = 1.5, VMAX = 230, PULL = 48, DT = 1 / 120;
  const WALL = { l: 2, r: W - 2, t: 2, b: H - 2 };   // the edges of the screen are force-field walls
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const TAU = Math.PI * 2, rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const $ = id => document.getElementById(id);

  // ---------- kinds of planet ----------
  // g: surface gravity (px/s²) · e: bounciness · mu: surface friction · pal: 4 shades dark→light
  const KINDS = {
    home:     { g: 120, e: .35, mu: 5,   pal: ['#0f2a18', '#246b3a', '#4fae5c', '#b4f08e'], label: 'Grass' },
    rock:     { g: 120, e: .4,  mu: 4,   pal: ['#241c2a', '#54465a', '#8a7a86', '#cdbcb4'], label: 'Rock' },
    ice:      { g: 120, e: .3,  mu: .22, pal: ['#12294a', '#2f6aa0', '#7cc2e8', '#eafaff'], label: 'Ice' },
    sand:     { g: 120, e: .1,  mu: 11,  pal: ['#40290c', '#946a2c', '#d6ae5c', '#f8e8a4'], label: 'Sand' },
    bouncy:   { g: 110, e: .92, mu: .4,  pal: ['#3a0c2c', '#9c2670', '#ee5ea2', '#ffc6e2'], label: 'Bouncy' },
    repel:    { g: -110, e: .5, mu: 2,   pal: ['#170e3a', '#43309c', '#8f6ef2', '#e2d6ff'], label: 'Repel' },
    sun:      { g: 230, deadly: true,     pal: ['#8c1800', '#ea5a00', '#ffb000', '#fff38a'], label: 'Sun' },
    asteroid: { g: 0,   e: .5,  mu: 2,   pal: ['#1c1616', '#463838', '#786a60', '#a89888'], label: 'Asteroid' },
    moon:     { g: 40,  e: .6,  mu: 2,   pal: ['#2c2c34', '#5c5c6c', '#a0a0b2', '#e2e2f2'], label: 'Moon' },
  };
  GG.KINDS = KINDS;

  // ---------- tiny seeded random ----------
  const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // ---------- pixel planet sprites (lit from the top-left, ordered dithering, a little texture per kind) ----------
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const spriteCache = new Map();
  function planetSprite(k, r, seed = 1, frame = 0) {
    const key = `${k}|${r}|${seed}|${frame}`;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const K = KINDS[k], size = r * 2 + 3, c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), rnd = rng(seed * 97 + r * 13 + frame * 7), o = r + 1.5;
    const L = [-.52, -.62, .58], craters = [];
    const nCr = k === 'rock' || k === 'moon' || k === 'asteroid' ? Math.max(1, Math.round(r / 5)) : 0;
    for (let i = 0; i < nCr; i++) { const a = rnd() * TAU, d = rnd() * r * .7; craters.push([Math.cos(a) * d, Math.sin(a) * d, 1 + rnd() * r * .22]); }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x + .5 - o, dy = y + .5 - o, d = Math.hypot(dx, dy);
      if (d > r + .5) continue;
      const nz = Math.sqrt(Math.max(0, 1 - (d / (r + .5)) ** 2));
      let lit = clamp((dx / r) * L[0] + (dy / r) * L[1] + nz * L[2], 0, 1);
      // textures
      if (k === 'ice' && ((x * 3 + y * 5 + seed) % 11 === 0)) lit += .25;
      if (k === 'sand') lit += (rnd() - .5) * .25;
      if (k === 'bouncy') lit += Math.sin((dy + dx * .3) * .8) * .12;
      if (k === 'home') lit += (Math.sin(x * .9 + seed) + Math.cos(y * .7)) * .06;
      if (k === 'sun') lit = .45 + nz * .5 + (rnd() - .5) * .35;   // a bubbling, glowing surface (each frame differs)
      if (k === 'repel') lit += Math.sin(Math.atan2(dy, dx) * 3 + d * .5 + frame) * .1;
      for (const [cx, cy, cr] of craters) if (Math.hypot(dx - cx, dy - cy) < cr) lit -= .28;
      const t = BAYER[(y & 3) * 4 + (x & 3)];
      let shade = clamp(Math.floor(lit * 3.2 + t * .9), 0, 3);
      if (d > r - .6) shade = 0;   // outline
      g.fillStyle = K.pal[shade]; g.fillRect(x, y, 1, 1);
    }
    spriteCache.set(key, c);
    return c;
  }

  // ---------- sound (tiny synth, starts after the first click) ----------
  let ac = null, muted = false;
  try { muted = localStorage.getItem('gg-muted') === '1'; } catch (e) {}
  const beep = (f0, f1, dur, type = 'square', vol = .06, delay = 0) => {
    if (muted) return;
    try {
      ac ??= new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime + delay, o = ac.createOscillator(), gn = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + dur + .02);
    } catch (e) {}
  };
  const SND = {
    shot: p => { beep(180 + p * 260, 80, .12, 'triangle', .08); beep(900, 300, .05, 'square', .02); },
    bounce: s => beep(220 + s, 120, .05, 'square', Math.min(.05, s / 3000)),
    sink: () => [523, 659, 784, 1046].forEach((f, i) => beep(f, f, .14, 'square', .05, i * .08)),
    ace: () => [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => beep(f, f * 1.01, .16, 'square', .05, i * .07)),
    burn: () => { beep(300, 40, .5, 'sawtooth', .06); beep(90, 30, .5, 'square', .04); },
    lost: () => beep(400, 90, .45, 'triangle', .06),
    warp: () => beep(200, 1400, .25, 'sine', .07),
    click: () => beep(700, 700, .03, 'square', .03),
  };

  // ---------- level state ----------
  let level = null, bodies = [], moons = [], warps = [], tee = null, hole = null, t = 0;
  let ball = null, state = 'menu', strokes = 0, lastRest = null, flight = 0, restT = 0, msg = null, parts = [], warpCd = 0;
  let aim = null;   // { sx, sy, dx, dy } while dragging
  let keyAim = { a: -45, p: .5, on: false };
  let starfield = null, playMode = null;   // 'course' | 'custom' | 'test'
  let holeIndex = 0, card = [];

  function load(lv) {
    level = lv; t = 0; parts = []; warpCd = 0; msg = null;
    bodies = lv.b.map((b, i) => ({ ...b, ...KINDS[b.k], seed: i + 3 }));
    moons = (lv.moons || []).map((m, i) => ({ k: 'moon', ...KINDS.moon, ...m, x: 0, y: 0, seed: 50 + i }));
    warps = (lv.w || []).map(w => ({ ax: w[0], ay: w[1], bx: w[2], by: w[3] }));
    tee = lv.tee; hole = lv.hole;
    placeMoons(0);
    strokes = 0; flight = 0; restT = 0;
    const b = bodies[tee.b];
    ball = { x: 0, y: 0, vx: 0, vy: 0, rest: { b: tee.b, a: rad(tee.a) }, trail: [] };
    snapToRest(ball);
    lastRest = { ...ball.rest };
    starfield = makeStars(lv.name);
    state = 'aim';
  }
  function placeMoons(time) {
    for (const m of moons) {
      const p = bodies[m.of], a = m.ph + m.w * time;
      m.x = p.x + Math.cos(a) * m.d; m.y = p.y + Math.sin(a) * m.d;
      m.vx = -Math.sin(a) * m.d * m.w; m.vy = Math.cos(a) * m.d * m.w;
    }
  }
  const allBodies = () => moons.length ? bodies.concat(moons) : bodies;
  function snapToRest(bl) {
    if (bl.rest.b === undefined) { bl.x = bl.rest.x; bl.y = bl.rest.y; bl.vx = bl.vy = 0; return; }   // resting against a wall
    const b = allBodies()[bl.rest.b], d = b.r + BR + .3;
    bl.x = b.x + Math.cos(bl.rest.a) * d; bl.y = b.y + Math.sin(bl.rest.a) * d; bl.vx = bl.vy = 0;
  }
  const cupPoint = () => { const b = bodies[hole.b], a = rad(hole.a); return { x: b.x + Math.cos(a) * (b.r + BR), y: b.y + Math.sin(a) * (b.r + BR), nx: Math.cos(a), ny: Math.sin(a) }; };

  function gravAt(x, y, list) {
    let ax = 0, ay = 0;
    for (const b of list) {
      if (!b.g) continue;
      const dx = b.x - x, dy = b.y - y, d2 = Math.max(dx * dx + dy * dy, b.r * b.r), d = Math.sqrt(d2), a = b.g * b.r * b.r / d2;
      ax += dx / d * a; ay += dy / d * a;
    }
    return [ax, ay];
  }

  // one physics step for a ball; returns an event string or null. Used by the game and by the level checker.
  function step(bl, time, fx) {
    const list = allBodies();
    const [ax, ay] = gravAt(bl.x, bl.y, list);
    bl.vx += ax * DT; bl.vy += ay * DT;
    bl.x += bl.vx * DT; bl.y += bl.vy * DT;
    // the force-field walls
    let wall = false;
    const hit = v => { if (fx && Math.abs(v) > 30) SND.bounce(Math.abs(v) * .6); };
    if (bl.x < WALL.l) { bl.x = WALL.l; if (bl.vx < 0) { hit(bl.vx); bl.vx = -bl.vx * .55; } wall = true; }
    if (bl.x > WALL.r) { bl.x = WALL.r; if (bl.vx > 0) { hit(bl.vx); bl.vx = -bl.vx * .55; } wall = true; }
    if (bl.y < WALL.t) { bl.y = WALL.t; if (bl.vy < 0) { hit(bl.vy); bl.vy = -bl.vy * .55; } wall = true; }
    if (bl.y > WALL.b) { bl.y = WALL.b; if (bl.vy > 0) { hit(bl.vy); bl.vy = -bl.vy * .55; } wall = true; }
    if (wall) { bl.vx *= Math.max(0, 1 - 3 * DT); bl.vy *= Math.max(0, 1 - 3 * DT); }
    // wormholes
    if (bl.warpCd > 0) bl.warpCd -= DT;
    else for (const w of warps) {
      for (const [fx1, fy1, tx, ty] of [[w.ax, w.ay, w.bx, w.by], [w.bx, w.by, w.ax, w.ay]]) {
        if (Math.hypot(bl.x - fx1, bl.y - fy1) < 5) { bl.x = tx; bl.y = ty; bl.warpCd = .5; if (fx) { SND.warp(); burst(tx, ty, ['#9f7bff', '#5ef0e0'], 14, 40); } return 'warp'; }
      }
    }
    let contact = null;
    for (let i = 0; i < list.length; i++) {
      const b = list[i], dx = bl.x - b.x, dy = bl.y - b.y, d = Math.hypot(dx, dy) || .001, min = b.r + BR;
      if (d >= min + .35) continue;
      if (b.deadly && d < min) return 'burn';
      const nx = dx / d, ny = dy / d;
      if (d < min) { bl.x = b.x + nx * min; bl.y = b.y + ny * min; }
      const rvx = bl.vx - (b.vx || 0), rvy = bl.vy - (b.vy || 0), vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        bl.vx -= (1 + b.e) * vn * nx; bl.vy -= (1 + b.e) * vn * ny;
        if (fx && -vn > 30) { SND.bounce(-vn); if (-vn > 60) burst(bl.x, bl.y, [b.pal[3], b.pal[2]], 3 + (-vn / 40 | 0), 25); }
      }
      // friction along the surface while touching
      const tvx = (bl.vx - (b.vx || 0)) - ((bl.vx - (b.vx || 0)) * nx + (bl.vy - (b.vy || 0)) * ny) * nx;
      const tvy = (bl.vy - (b.vy || 0)) - ((bl.vx - (b.vx || 0)) * nx + (bl.vy - (b.vy || 0)) * ny) * ny;
      const f = Math.max(0, 1 - b.mu * DT);
      bl.vx -= tvx * (1 - f); bl.vy -= tvy * (1 - f);
      contact = { i, a: Math.atan2(ny, nx), moving: !!b.vx };
    }
    // the cup
    const c = cupPoint(), sp = Math.hypot(bl.vx, bl.vy);
    if (Math.hypot(bl.x - c.x, bl.y - c.y) < 5 && sp < 120) return 'sink';
    // coming to rest (on a planet, or against a wall)
    if (((contact && !contact.moving) || wall) && sp < 9) {
      bl.restT = (bl.restT || 0) + DT;
      if (bl.restT > .28) { bl.rest = contact && !contact.moving ? { b: contact.i, a: contact.a } : { x: bl.x, y: bl.y }; return 'rest'; }
    } else bl.restT = 0;
    return null;
  }

  // ---------- particles ----------
  function burst(x, y, cols, n, sp) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * (.3 + Math.random() * .7); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .4 + Math.random() * .5, col: cols[i % cols.length] }); }
  }

  // ---------- shooting ----------
  function launchVel(dx, dy) {
    const len = Math.hypot(dx, dy), p = Math.min(len, PULL) / PULL;
    return { vx: -dx / (len || 1) * p * VMAX, vy: -dy / (len || 1) * p * VMAX, p };
  }
  function shoot(vx, vy, p) {
    if (state !== 'aim' || p < .04) return;
    ball.rest = null; ball.vx = vx; ball.vy = vy; ball.restT = 0; ball.warpCd = 0;
    strokes++; flight = 0; state = 'fly'; aim = null; hudUpdate();
    SND.shot(p); burst(ball.x, ball.y, ['#ffffff', '#c8fff6'], 6, 30);
    $('hint').hidden = true;
  }

  function penalty(text) {
    strokes++; msg = { text, t: 1.4 }; hudUpdate();
    ball.rest = { ...lastRest }; snapToRest(ball); ball.trail = [];
    state = 'aim';
    if (tooMany()) giveUp();
  }
  const tooMany = () => strokes >= level.par + 6;
  function giveUp() { msg = { text: 'Picked up', t: 1.4 }; finishHole(true); }

  function sink() {
    state = 'sunk';
    const c = cupPoint();
    burst(c.x, c.y, ['#ffd23a', '#ffffff', '#7fe0d4', '#ff6a8a'], strokes === 1 ? 60 : 30, strokes === 1 ? 90 : 60);
    strokes === 1 ? SND.ace() : SND.sink();
    const n = strokes - level.par;
    msg = { text: strokes === 1 ? 'HOLE IN ONE!' : ({ '-3': 'ALBATROSS!', '-2': 'EAGLE!', '-1': 'BIRDIE!', 0: 'PAR', 1: 'Bogey', 2: 'Double bogey' }[n] ?? `+${n}`), t: 2, big: n <= 0 };
    setTimeout(() => finishHole(false), 1400);
  }

  // ---------- main loop ----------
  let acc = 0, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    update(real);
    draw(real);
  }
  // fast-forward the real game loop (used by the automatic tests)
  GG.advance = secs => { for (let k = 0; k < secs / .05; k++) update(.05); draw(0); };
  function update(real) {
    if (state === 'fly' || state === 'aim' || state === 'sunk') {
      acc += real;
      while (acc >= DT) {
        acc -= DT; t += DT; placeMoons(t); if (warpCd > 0) warpCd -= DT;
        if (state === 'fly') {
          flight += DT;
          const ev = step(ball, t, true);
          ball.trail.push([ball.x, ball.y]); if (ball.trail.length > 16) ball.trail.shift();
          if (ev === 'burn') { burst(ball.x, ball.y, ['#ffb000', '#ff5a00', '#fff38a'], 26, 60); SND.burn(); penalty('Burned up! +1'); break; }
          if (ev === 'lost') { SND.lost(); penalty('Lost in space! +1'); break; }
          if (ev === 'sink') { sink(); break; }
          if (ev === 'rest') { lastRest = { ...ball.rest }; snapToRest(ball); state = 'aim'; ball.trail = []; if (tooMany()) giveUp(); break; }
          if (flight > 14) { SND.lost(); penalty('Lost in orbit! +1'); break; }
        }
      }
      if (state === 'aim' && ball.rest && ball.rest.b >= bodies.length) snapToRest(ball);   // (never rests on moons, but just in case)
    }
    for (const p of parts) { p.x += p.vx * real; p.y += p.vy * real; p.vx *= .96; p.vy *= .96; p.life -= real; }
    parts = parts.filter(p => p.life > 0);
    if (msg) { msg.t -= real; if (msg.t <= 0) msg = null; }
    if (keyAim.on && state === 'aim') keyStep(real);
  }

  // ---------- drawing ----------
  function makeStars(name) {
    const r = rng([...name].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) >>> 0), c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#07060d'; g.fillRect(0, 0, W, H);
    // a dithered nebula
    const hue = [['#140a26', '#1f0f36'], ['#0a1426', '#0f2036'], ['#200a18', '#321028']][Math.floor(r() * 3)];
    const cx = r() * W, cy = r() * H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = Math.sin(x * .03 + r() * .2) * Math.cos(y * .05) + Math.sin((x + y) * .02) - Math.hypot(x - cx, y - cy) / 140;
      if (v + BAYER[(y & 3) * 4 + (x & 3)] * .8 > .7) { g.fillStyle = v > 1.05 ? hue[1] : hue[0]; g.fillRect(x, y, 1, 1); }
    }
    const stars = [];
    for (let i = 0; i < 110; i++) stars.push({ x: r() * W | 0, y: r() * H | 0, b: r(), tw: r() * TAU });
    return { bg: c, stars };
  }
  const px = (x, y, col, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  function drawWorld(time, sel) {
    ctx.drawImage(starfield.bg, 0, 0);
    for (const s of starfield.stars) { const tw = .5 + .5 * Math.sin(time * 2 + s.tw); if (s.b * tw > .25) px(s.x, s.y, s.b > .85 ? '#ffffff' : s.b > .6 ? '#b8c4ff' : '#5a5a86'); }
    // the force-field walls
    for (let x = WALL.l - 1; x <= WALL.r + 1; x += 4) { px(x, WALL.t - 2, '#2a2448'); px(x, WALL.b + 1, '#2a2448'); }
    for (let y = WALL.t - 2; y <= WALL.b + 1; y += 4) { px(WALL.l - 2, y, '#2a2448'); px(WALL.r + 1, y, '#2a2448'); }
    // wormholes
    // wormholes: two spinning spiral arms around a bright core (purple in, teal out — they work both ways)
    for (const w of warps) for (const [x, y, col, dark] of [[w.ax, w.ay, '#b18cff', '#4a2a9a'], [w.bx, w.by, '#6ff5e4', '#1a6a64']]) {
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU * 1.5 + time * 4, rr = 1.5 + i * .4; px(x + Math.cos(a) * rr, y + Math.sin(a) * rr, i > 9 ? dark : col); px(x - Math.cos(a) * rr, y - Math.sin(a) * rr, i > 9 ? dark : col); }
      for (let i = 0; i < 20; i++) { const a = i / 20 * TAU - time * 1.5; if (i % 2) px(x + Math.cos(a) * 7.5, y + Math.sin(a) * 7.5, dark); }
      px(x - 1, y - 1, '#ffffff', 2, 2);
    }
    // gravity hint: faint dotted halo around each planet
    for (const b of bodies) if (b.g && !b.deadly) {
      const rr = b.r + 9 + Math.sin(time * 1.5 + b.seed) * .8;
      for (let i = 0; i < 28; i++) { const a = i / 28 * TAU + time * .15 * Math.sign(b.g); if (i % 2) continue; px(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr, b.g < 0 ? '#4a3c8a' : '#1e1c30'); }
    }
    for (const b of allBodies()) {
      const f = b.k === 'sun' || b.k === 'repel' ? Math.floor(time * 6) % 4 : 0, sp = planetSprite(b.k, b.r, b.seed, f);
      if (b.k === 'sun') for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + time, rr = b.r + 2 + ((i * 7 + Math.floor(time * 8)) % 4); px(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr, i % 3 ? '#ff7a00' : '#ffe060'); }
      ctx.drawImage(sp, Math.round(b.x - b.r - 1.5), Math.round(b.y - b.r - 1.5));
      if (sel === b) { for (let i = 0; i < 30; i++) { const a = i / 30 * TAU + time; if (i % 2) px(b.x + Math.cos(a) * (b.r + 3), b.y + Math.sin(a) * (b.r + 3), '#ffd23a'); } }
    }
    // the cup and flag
    if (hole && bodies[hole.b]) {
      const c = cupPoint(), b = bodies[hole.b], a = rad(hole.a);
      for (let k = -2; k <= 2; k++) { const aa = a + k / b.r; px(b.x + Math.cos(aa) * (b.r - .5) - .5, b.y + Math.sin(aa) * (b.r - .5) - .5, '#000000'); }
      const tipx = c.x + c.nx * 9, tipy = c.y + c.ny * 9;
      for (let i = 1; i <= 9; i++) px(c.x + c.nx * i, c.y + c.ny * i, '#e8e8e8');
      const wave = Math.floor(time * 5) % 2, tx = -c.ny, ty = c.nx;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) px(tipx - c.nx * j + tx * (i + 1) + (i > 1 && wave ? c.nx * .7 : 0), tipy - c.ny * j + ty * (i + 1), j === 1 ? '#ff3a4a' : '#d02030');
    }
    // tee marker
    if (tee && bodies[tee.b] && playMode === 'edit') { const b = bodies[tee.b], a = rad(tee.a); px(b.x + Math.cos(a) * (b.r + 2) - 1, b.y + Math.sin(a) * (b.r + 2) - 1, '#ffffff', 3, 3); }
  }

  function draw(real) {
    if (!starfield) return;
    if (state === 'edit') return drawEditor();
    drawWorld(t);
    // trail and ball
    ball.trail.forEach(([x, y], i) => { if (i % 2) px(x - .5, y - .5, i > 10 ? '#c8fff6' : i > 5 ? '#6aa8a8' : '#2e5058'); });
    if (state !== 'sunk') { px(ball.x - 1.5, ball.y - .5, '#ffffff', 3, 1); px(ball.x - .5, ball.y - 1.5, '#ffffff', 1, 3); px(ball.x - .5, ball.y - .5, '#ffffff'); }
    // aim preview
    let v = null;
    if (state === 'aim' && aim) v = launchVel(aim.dx, aim.dy);
    if (state === 'aim' && keyAim.on && !aim) v = { vx: Math.cos(rad(keyAim.a)) * keyAim.p * VMAX, vy: Math.sin(rad(keyAim.a)) * keyAim.p * VMAX, p: keyAim.p };
    if (v && v.p > .03) {
      const g = { x: ball.x, y: ball.y, vx: v.vx, vy: v.vy };
      // the aiming dots show about the first second of the flight (gravity only), fading out
      for (let i = 0; i < 130; i++) {
        const [ax, ay] = gravAt(g.x, g.y, allBodies()); g.vx += ax * DT; g.vy += ay * DT; g.x += g.vx * DT; g.y += g.vy * DT;
        if (i % 6 === 5) px(g.x - .5, g.y - .5, i < 45 ? '#ffffff' : i < 90 ? '#9aa0c0' : '#4a4a6a');
      }
      // power bar beside the ball
      const bx = Math.round(ball.x) + 6, by = Math.round(ball.y) - 8;
      px(bx, by, '#1a1624', 3, 12);
      const h = Math.round(v.p * 10);
      px(bx + 1, by + 11 - h, v.p > .85 ? '#ff5a3a' : v.p > .5 ? '#ffd23a' : '#7fe0d4', 1, h);
    }
    for (const p of parts) px(p.x, p.y, p.col);
    if (msg) {
      const el = $('msg'); el.textContent = msg.text; el.className = 'msg show' + (msg.big ? ' big' : '');
    } else $('msg').className = 'msg';
  }

  // ---------- input ----------
  const toGame = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  cv.addEventListener('pointerdown', e => {
    if (state === 'edit') return edDown(e);
    if (state !== 'aim') return;
    cv.setPointerCapture(e.pointerId);
    const p = toGame(e); aim = { sx: p.x, sy: p.y, dx: 0, dy: 0 }; keyAim.on = false;
  });
  cv.addEventListener('pointermove', e => {
    if (state === 'edit') return edMove(e);
    if (!aim) return;
    const p = toGame(e); aim.dx = p.x - aim.sx; aim.dy = p.y - aim.sy;
  });
  const release = e => {
    if (state === 'edit') return edUp(e);
    if (!aim || e.target.closest?.('button, .screen')) { aim = null; return; }
    const v = launchVel(aim.dx, aim.dy); aim = null; shoot(v.vx, v.vy, v.p);
  };
  addEventListener('pointerup', release);   // (the whole window, so letting go anywhere still shoots)
  cv.addEventListener('pointercancel', () => { aim = null; });
  cv.addEventListener('contextmenu', e => { e.preventDefault(); aim = null; });

  const keys = new Set();
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (state === 'edit') return edKey(e);
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
    if (k === 'm') toggleMute();
    if (k === 'escape') { if (aim) aim = null; else if (state === 'aim' || state === 'fly') openPause(); }
    if (state !== 'aim') return;
    keys.add(k);
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) { if (!keyAim.on) { keyAim.on = true; const rb = bodies[ball.rest.b]; keyAim.a = rb ? deg(Math.atan2(ball.y - rb.y, ball.x - rb.x)) : -90; } }
    if (k === ' ' || k === 'enter') { if (keyAim.on) { shoot(Math.cos(rad(keyAim.a)) * keyAim.p * VMAX, Math.sin(rad(keyAim.a)) * keyAim.p * VMAX, keyAim.p); keyAim.on = false; } else keyAim.on = true; }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  function keyStep(dt) {
    if (keys.has('arrowleft')) keyAim.a -= 90 * dt;
    if (keys.has('arrowright')) keyAim.a += 90 * dt;
    if (keys.has('arrowup')) keyAim.p = clamp(keyAim.p + .6 * dt, .05, 1);
    if (keys.has('arrowdown')) keyAim.p = clamp(keyAim.p - .6 * dt, .05, 1);
  }

  // ---------- HUD, menus, scorecard ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('gg-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('gg-' + k, JSON.stringify(v)); } catch (e) {} },
  };
  function hudUpdate() {
    $('hud').hidden = false;
    $('hHole').textContent = playMode === 'course' ? `Hole ${holeIndex + 1}` : playMode === 'test' ? 'Testing' : 'Friend’s hole';
    $('hName').textContent = level.name;
    $('hPar').textContent = level.par;
    $('hStrokes').textContent = strokes;
    const tot = card.reduce((a, c) => a + c.s - c.p, 0);
    $('hTotal').textContent = playMode === 'course' && card.length ? (tot === 0 ? 'E' : (tot > 0 ? '+' : '') + tot) : '';
    $('hTotalWrap').hidden = !(playMode === 'course' && card.length);
  }
  function show(id) { for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id; }
  function hideScreens() { for (const el of document.querySelectorAll('.screen')) el.hidden = true; }

  function startCourse(from = 0) { playMode = 'course'; holeIndex = from; card = from ? store.get('run', []).slice(0, from) : []; playHole(); }
  function playHole() {
    hideScreens(); $('editbar').hidden = true;
    load(GG.COURSE[holeIndex]); hudUpdate();
    $('hint').hidden = !(holeIndex === 0 && playMode === 'course' && !store.get('played', false));
  }
  function finishHole(pickedUp) {
    state = 'done';
    if (playMode === 'test') { setTimeout(() => editor(), 900); return; }
    if (playMode === 'custom') { setTimeout(() => { show('customDone'); $('cdText').textContent = `${strokes} stroke${strokes === 1 ? '' : 's'} (par ${level.par})`; }, 600); return; }
    store.set('played', true);
    card.push({ s: strokes, p: level.par, n: level.name, up: pickedUp });
    store.set('run', card);
    const best = store.get('best', {}); if (!best[holeIndex] || strokes < best[holeIndex]) best[holeIndex] = strokes; store.set('best', best);
    store.set('unlocked', Math.max(store.get('unlocked', 1), holeIndex + 2));
    setTimeout(() => {
      if (holeIndex === GG.COURSE.length - 1) return showCard(true);
      showCard(false);
    }, pickedUp ? 900 : 300);
  }
  function scoreName(s, p) { return s === 1 ? 'Ace' : ({ '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey' }[s - p] ?? (s - p > 0 ? '+' + (s - p) : String(s - p))); }
  function showCard(final) {
    show('card');
    const tot = card.reduce((a, c) => a + c.s, 0), par = card.reduce((a, c) => a + c.p, 0), diff = tot - par;
    $('cardTitle').textContent = final ? 'Course complete!' : `Hole ${holeIndex + 1}: ${scoreName(strokes, level.par)}`;
    $('cardRows').innerHTML = '<tr class="head"><td>#</td><td>Hole</td><td>Par</td><td>You</td></tr>' + card.map((c, i) => `<tr${i === card.length - 1 ? ' class="now"' : ''}><td>${i + 1}</td><td>${c.n}</td><td>${c.p}</td><td class="${c.s < c.p ? 'good' : c.s > c.p ? 'bad' : ''}">${c.s}${c.up ? '*' : ''}</td></tr>`).join('');
    $('cardTotal').textContent = `${tot} stroke${tot === 1 ? '' : 's'} · ${diff === 0 ? 'even par' : (diff > 0 ? '+' : '') + diff}`;
    $('cardNext').textContent = final ? 'Play again' : 'Next hole';
    $('cardNext').onclick = () => { SND.click(); if (final) { startCourse(0); } else { holeIndex++; playHole(); } };
    if (final) {
      const best = store.get('bestTotal', null);
      if (best === null || diff < best) { store.set('bestTotal', diff); $('cardBest').textContent = 'New best round!'; }
      else $('cardBest').textContent = `Best round: ${best === 0 ? 'even' : (best > 0 ? '+' : '') + best}`;
      store.set('run', []);
    } else $('cardBest').textContent = '';
    setTimeout(() => $('cardNext').focus(), 50);
  }

  function title() {
    state = 'menu'; playMode = null; show('title'); $('hud').hidden = true; $('editbar').hidden = true;
    if (!starfield) { load(GG.COURSE[0]); state = 'menu'; }
    const run = store.get('run', []), bt = store.get('bestTotal', null);
    $('tContinue').hidden = !(run.length && run.length < GG.COURSE.length);
    $('tContinue').textContent = `Continue (hole ${run.length + 1})`;
    $('tBest').textContent = bt === null ? '' : `Best round: ${bt === 0 ? 'even par' : (bt > 0 ? '+' : '') + bt}`;
    setTimeout(() => $('tPlay').focus(), 50);
  }
  function holeSelect() {
    show('holes');
    const best = store.get('best', {}), open = store.get('unlocked', 1);
    $('holeGrid').innerHTML = GG.COURSE.map((h, i) => `<button type="button" data-i="${i}" ${i >= open ? 'disabled' : ''}><b>${i + 1}</b><span>${h.name}</span><small>${i >= open ? 'locked' : best[i] ? `best ${best[i]} · par ${h.par}` : `par ${h.par}`}</small></button>`).join('');
    for (const b of $('holeGrid').children) b.onclick = () => { SND.click(); playMode = 'course'; holeIndex = +b.dataset.i; card = []; store.set('run', []); playHole(); };
  }
  function openPause() { if (state === 'fly') return; show('pause'); }
  function toggleMute() { muted = !muted; store.set('muted', muted); try { localStorage.setItem('gg-muted', muted ? '1' : '0'); } catch (e) {} for (const b of document.querySelectorAll('[data-mute]')) b.textContent = muted ? 'Sound: off' : 'Sound: on'; }

  $('tPlay').onclick = () => { SND.click(); store.set('run', []); startCourse(0); };
  $('tContinue').onclick = () => { SND.click(); startCourse(store.get('run', []).length); };
  $('tHoles').onclick = () => { SND.click(); holeSelect(); };
  $('tEdit').onclick = () => { SND.click(); editor(); };
  $('tCode').onclick = () => { SND.click(); show('codeIn'); $('codeText').value = ''; $('codeErr').textContent = ''; setTimeout(() => $('codeText').focus(), 50); };
  $('codeGo').onclick = () => { const lv = decode($('codeText').value); if (!lv) { $('codeErr').textContent = 'That code doesn’t work — check you copied all of it.'; return; } playMode = 'custom'; hideScreens(); load(lv); hudUpdate(); };
  for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { SND.click(); title(); };
  for (const b of document.querySelectorAll('[data-mute]')) { b.textContent = muted ? 'Sound: off' : 'Sound: on'; b.onclick = toggleMute; }
  $('menuBtn').onclick = () => { if (state === 'aim' || state === 'fly') openPause(); };
  $('pResume').onclick = () => { hideScreens(); };
  $('pRestart').onclick = () => { hideScreens(); load(level); hudUpdate(); };
  $('pQuit').onclick = () => { playMode === 'test' ? editor() : title(); };
  $('cdAgain').onclick = () => { hideScreens(); load(level); hudUpdate(); };

  // ---------- sharing holes as codes ----------
  const KLIST = ['home', 'rock', 'ice', 'sand', 'bouncy', 'repel', 'sun', 'asteroid'];
  function encode(lv) {
    const o = { n: lv.name.slice(0, 24), p: lv.par, b: lv.b.map(b => [KLIST.indexOf(b.k), Math.round(b.x), Math.round(b.y), Math.round(b.r)]), t: [lv.tee.b, Math.round(lv.tee.a)], h: [lv.hole.b, Math.round(lv.hole.a)], w: (lv.w || []).map(w => w.map(Math.round)) };
    return 'GG1-' + btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(code) {
    try {
      code = String(code).trim().replace(/\s+/g, '');
      if (!code.startsWith('GG1-')) return null;
      let s = code.slice(4).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
      const o = JSON.parse(decodeURIComponent(escape(atob(s))));
      const num = (v, a, b) => { v = Number(v); if (!Number.isFinite(v)) throw 0; return clamp(v, a, b); };
      const b = (o.b || []).slice(0, 40).map(a => ({ k: KLIST[num(a[0], 0, KLIST.length - 1) | 0], x: num(a[1], -20, W + 20), y: num(a[2], -20, H + 20), r: num(a[3], 3, 45) }));
      const lv = { name: String(o.n || 'Custom hole').slice(0, 24), par: num(o.p, 1, 9) | 0, b, w: (o.w || []).slice(0, 4).map(w => w.slice(0, 4).map(v => num(v, -20, W + 20))), tee: { b: num(o.t[0], 0, b.length - 1) | 0, a: num(o.t[1], -360, 360) }, hole: { b: num(o.h[0], 0, b.length - 1) | 0, a: num(o.h[1], -360, 360) } };
      if (!b.length || KINDS[b[lv.tee.b].k].deadly || KINDS[b[lv.hole.b].k].deadly) return null;
      return lv;
    } catch (e) { return null; }
  }
  GG.encode = encode; GG.decode = decode;

  // ---------- hole editor ----------
  let draft = store.get('draft', null) || { name: 'My hole', par: 3, b: [{ k: 'home', x: 60, y: 110, r: 18 }, { k: 'rock', x: 250, y: 100, r: 20 }], tee: { b: 0, a: -80 }, hole: { b: 1, a: -100 }, w: [] };
  let tool = 'move', sel = null, drag = null, pendingWarp = null;
  const DEF_R = { home: 16, rock: 18, ice: 18, sand: 18, bouncy: 14, repel: 16, sun: 14, asteroid: 4 };
  function editor() {
    state = 'edit'; playMode = 'edit'; hideScreens(); $('hud').hidden = true; $('editbar').hidden = false;
    level = draft; bodies = draft.b.map((b, i) => ({ ...b, ...KINDS[b.k], seed: i + 3 })); moons = []; warps = (draft.w || []).map(w => ({ ax: w[0], ay: w[1], bx: w[2], by: w[3] }));
    tee = draft.tee; hole = draft.hole;
    starfield = starfield || makeStars('editor');
    $('edName').value = draft.name; $('edPar').textContent = draft.par;
    setTool(tool);
  }
  function syncDraft() {
    draft.b = bodies.map(b => ({ k: b.k, x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.r) }));
    draft.w = warps.map(w => [w.ax, w.ay, w.bx, w.by].map(Math.round));
    draft.tee = tee; draft.hole = hole; draft.name = $('edName').value.trim() || 'My hole';
    store.set('draft', draft);
  }
  function setTool(tl) { tool = tl; pendingWarp = null; for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tl)); $('edTip').textContent = TIPS[tl] || (KINDS[tl] ? `Click in space to add a ${KINDS[tl].label.toLowerCase()} planet, then drag it where you like.` : ''); }
  const TIPS = { move: 'Drag planets to move them. Scroll (or [ and ]) to resize the selected one.', tee: 'Click the edge of a planet to put the ball there.', hole: 'Click the edge of a planet to put the cup there.', warp: 'Click two spots to make a wormhole pair.', del: 'Click a planet or wormhole to delete it.' };
  const bodyAt = p => { let best = null, bd = 1e9; for (const b of bodies) { const d = Math.hypot(p.x - b.x, p.y - b.y) - b.r; if (d < 8 && d < bd) { bd = d; best = b; } } return best; };
  function edDown(e) {
    const p = toGame(e); cv.setPointerCapture(e.pointerId);
    if (KINDS[tool]) { if (bodies.length >= 40) return; const b = { k: tool, x: p.x, y: p.y, r: DEF_R[tool], ...KINDS[tool], seed: bodies.length + 3 }; bodies.push(b); sel = b; drag = { b, ox: 0, oy: 0 }; SND.click(); return; }
    const b = bodyAt(p);
    if (tool === 'move') { sel = b; if (b) drag = { b, ox: p.x - b.x, oy: p.y - b.y }; return; }
    if (tool === 'tee' || tool === 'hole') {
      if (!b || b.deadly) return;
      const v = { b: bodies.indexOf(b), a: Math.round(deg(Math.atan2(p.y - b.y, p.x - b.x))) };
      if (tool === 'tee') tee = v; else hole = v;
      SND.click(); syncDraft(); return;
    }
    if (tool === 'warp') {
      if (!pendingWarp) { pendingWarp = p; SND.click(); return; }
      if (warps.length < 4) warps.push({ ax: pendingWarp.x, ay: pendingWarp.y, bx: p.x, by: p.y });
      pendingWarp = null; SND.click(); syncDraft(); return;
    }
    if (tool === 'del') {
      const wi = warps.findIndex(w => Math.hypot(p.x - w.ax, p.y - w.ay) < 7 || Math.hypot(p.x - w.bx, p.y - w.by) < 7);
      if (wi >= 0) { warps.splice(wi, 1); syncDraft(); return; }
      if (b) deleteBody(b);
    }
  }
  function deleteBody(b) {
    const i = bodies.indexOf(b); if (i < 0) return;
    bodies.splice(i, 1);
    const fix = v => v && (v.b === i ? null : { b: v.b > i ? v.b - 1 : v.b, a: v.a });   // tee/cup on it go away; later indexes shift down
    tee = fix(tee); hole = fix(hole); sel = null; SND.click(); syncDraft();
  }
  function edMove(e) { if (!drag) return; const p = toGame(e); drag.b.x = clamp(p.x - drag.ox, 0, W); drag.b.y = clamp(p.y - drag.oy, 14, H); }
  function edUp() { if (drag) { drag = null; syncDraft(); } }
  function resizeSel(d) { if (!sel) return; sel.r = clamp(sel.r + d, sel.k === 'asteroid' ? 2 : 6, sel.k === 'asteroid' ? 8 : 45); syncDraft(); }
  cv.addEventListener('wheel', e => { if (state !== 'edit' || !sel) return; e.preventDefault(); resizeSel(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  function edKey(e) {
    if (e.key === '[') resizeSel(-1); if (e.key === ']') resizeSel(1);
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); deleteBody(sel); }
  }
  function drawEditor() {
    drawWorld(performance.now() / 1000, sel);
    if (tee && bodies[tee.b]) { const b = bodies[tee.b], a = rad(tee.a); px(b.x + Math.cos(a) * (b.r + BR + .3) - 1.5, b.y + Math.sin(a) * (b.r + BR + .3) - .5, '#ffffff', 3, 1); px(b.x + Math.cos(a) * (b.r + BR + .3) - .5, b.y + Math.sin(a) * (b.r + BR + .3) - 1.5, '#ffffff', 1, 3); }
    if (pendingWarp) px(pendingWarp.x - 1, pendingWarp.y - 1, '#9f7bff', 3, 3);
  }
  for (const b of document.querySelectorAll('[data-tool]')) b.onclick = () => { SND.click(); setTool(b.dataset.tool); };
  $('edParDown').onclick = () => { draft.par = clamp(draft.par - 1, 1, 9); $('edPar').textContent = draft.par; syncDraft(); };
  $('edParUp').onclick = () => { draft.par = clamp(draft.par + 1, 1, 9); $('edPar').textContent = draft.par; syncDraft(); };
  $('edName').oninput = syncDraft;
  $('edTest').onclick = () => {
    syncDraft();
    if (!tee || !hole) { $('edTip').textContent = 'Place the ball (Tee) and the cup (Cup) first.'; return; }
    playMode = 'test'; $('editbar').hidden = true; load(JSON.parse(JSON.stringify(draft))); hudUpdate();
  };
  $('edShare').onclick = () => {
    syncDraft();
    if (!tee || !hole) { $('edTip').textContent = 'Place the ball (Tee) and the cup (Cup) first.'; return; }
    show('codeOut'); $('shareText').value = encode(draft); $('shareText').select();
  };
  $('shareCopy').onclick = async () => { try { await navigator.clipboard.writeText($('shareText').value); $('shareCopy').textContent = 'Copied!'; } catch (e) { $('shareText').select(); } };
  $('shareClose').onclick = () => { hideScreens(); };
  $('edClear').onclick = () => { if ($('edClear').dataset.arm) { bodies = []; warps = []; tee = hole = null; sel = null; syncDraft(); delete $('edClear').dataset.arm; $('edClear').textContent = 'Clear'; } else { $('edClear').dataset.arm = '1'; $('edClear').textContent = 'Sure?'; setTimeout(() => { delete $('edClear').dataset.arm; $('edClear').textContent = 'Clear'; }, 2500); } };
  $('edExit').onclick = () => { syncDraft(); title(); };

  // ---------- fit the pixel canvas to the window (whole-number scaling when it fits) ----------
  function fit() {
    const box = $('stage').getBoundingClientRect(), s = Math.min(box.width / W, (box.height - 34) / H), si = Math.floor(s);   // (34px: the bar above)
    const scale = si >= 2 ? si : s;
    cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px';
    document.documentElement.style.setProperty('--scale', scale);
  }
  addEventListener('resize', fit); fit();

  // for the level checker
  GG.sim = { load, step, get ball() { return ball; }, set ball(b) { ball = b; }, snapToRest, placeMoons, DT, VMAX, cupPoint, get bodies() { return bodies; } };
  title();
  requestAnimationFrame(frame);
})();
