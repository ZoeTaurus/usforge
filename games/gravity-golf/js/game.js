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
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- saved stuff ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('gg-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('gg-' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const settings = Object.assign({ sound: store.get('muted', false) !== true, shake: true, guide: 'long', hard: false }, store.get('settings', {}));
  // scores are kept apart for Normal and Hard
  const KEY = (k, id) => `${k}:${id}${settings.hard ? ':hard' : ''}`;
  const saveSettings = () => store.set('settings', settings);

  // ---------- courses ----------
  const COURSES = [
    { id: 'classic', name: 'Classic', blurb: '18 holes · learn every trick', holes: GG.COURSE },
    { id: 'deep', name: 'Deep Space', blurb: '9 harder holes · moons, relays, storms', holes: GG.DEEP },
    { id: 'abyss', name: 'Black Hole', blurb: '9 expert holes · black holes, moving cups', holes: GG.ABYSS, lock: 'Finish Deep Space to open' },
  ];
  const isLocked = c => c.lock && !unlocks.has('void');   // (finishing Deep Space earns the Void ball)
  const courseById = id => COURSES.find(c => c.id === id) || COURSES[0];
  const parOf = c => c.holes.reduce((a, h) => a + h.par, 0);

  // ---------- kinds of planet ----------
  // g: surface gravity (px/s²) · e: bounciness · mu: surface friction · pal: 4 shades dark→light · aura: glow colour
  const KINDS = {
    home:     { g: 120, e: .35, mu: 5,   pal: ['#0f2a18', '#246b3a', '#4fae5c', '#b4f08e'], label: 'Grass' },
    rock:     { g: 120, e: .4,  mu: 4,   pal: ['#241c2a', '#54465a', '#8a7a86', '#cdbcb4'], label: 'Rock' },
    ice:      { g: 120, e: .3,  mu: .22, pal: ['#12294a', '#2f6aa0', '#7cc2e8', '#eafaff'], label: 'Ice', aura: '#5ab0f0' },
    sand:     { g: 120, e: .1,  mu: 11,  pal: ['#40290c', '#946a2c', '#d6ae5c', '#f8e8a4'], label: 'Sand' },
    bouncy:   { g: 110, e: .92, mu: .4,  pal: ['#3a0c2c', '#9c2670', '#ee5ea2', '#ffc6e2'], label: 'Bouncy', aura: '#ff4aa0' },
    repel:    { g: -110, e: .5, mu: 2,   pal: ['#170e3a', '#43309c', '#8f6ef2', '#e2d6ff'], label: 'Repel', aura: '#8a5cff' },
    sun:      { g: 230, deadly: true,     pal: ['#8c1800', '#ea5a00', '#ffb000', '#fff38a'], label: 'Sun', aura: '#ff7a00' },
    asteroid: { g: 0,   e: .5,  mu: 2,   pal: ['#1c1616', '#463838', '#786a60', '#a89888'], label: 'Asteroid' },
    moon:     { g: 40,  e: .6,  mu: 2,   pal: ['#2c2c34', '#5c5c6c', '#a0a0b2', '#e2e2f2'], label: 'Moon' },
    // r is the event horizon: tiny, but the pull is huge — cross it and the ball is gone
    blackhole: { g: 1100, deadly: true,  pal: ['#000000', '#1a0a2e', '#6a2ac0', '#ffb070'], label: 'Black hole', aura: '#8a4aff' },
  };
  GG.KINDS = KINDS;

  // ---------- ball skins (unlocked by playing) ----------
  const SKINS = [
    { id: 'classic', name: 'Classic', ball: '#ffffff', trail: ['#2e5058', '#6aa8a8', '#c8fff6'], glow: '#9ffff0', how: 'Yours from the start' },
    { id: 'ember', name: 'Ember', ball: '#ffd080', trail: ['#6a1800', '#ff6a2a', '#ffd080'], glow: '#ff7a2a', how: 'Finish “Hot Stuff” (Classic, hole 6)' },
    { id: 'frost', name: 'Frost', ball: '#e8faff', trail: ['#1a3a6a', '#5ab0f0', '#e8faff'], glow: '#7cc8ff', how: 'Par or better on “Slippery Slope”' },
    { id: 'gold', name: 'Gold', ball: '#ffe066', trail: ['#6a4a00', '#e0a800', '#fff0a0'], glow: '#ffd23a', how: 'Get a hole-in-one' },
    { id: 'comet', name: 'Comet', ball: '#ffffff', trail: ['#ff4a6a', '#ffd23a', '#7fe0d4', '#9f7bff'], glow: '#ffffff', how: 'Finish all 18 Classic holes' },
    { id: 'void', name: 'Void', ball: '#d8c0ff', trail: ['#1a0a3a', '#6a3ac0', '#d8c0ff'], glow: '#9f7bff', how: 'Finish the Deep Space course' },
    { id: 'nova', name: 'Nova', ball: '#fff6c8', trail: ['#6a2a00', '#ff9a2a', '#fff6c8', '#ffffff'], glow: '#ffd27a', how: 'Earn 40 stars on Classic' },
    { id: 'horizon', name: 'Horizon', ball: '#1a1024', trail: ['#ff8a3a', '#b98cff', '#1a1024'], glow: '#8a4aff', how: 'Finish the Black Hole course' },
    { id: 'aurora', name: 'Aurora', ball: '#c8fff0', trail: ['#1a6a54', '#4af0b0', '#9f7bff', '#ff7ad8'], glow: '#6af0c8', how: 'Reach hole 10 in Endless' },
  ];
  const unlocks = new Set(store.get('unlocks', ['classic']));
  const skinOf = id => SKINS.find(s => s.id === id) || SKINS[0];
  let skin = skinOf(store.get('skin', 'classic'));
  function unlock(id) {
    if (unlocks.has(id)) return;
    unlocks.add(id); store.set('unlocks', [...unlocks]);
    toast(`New ball unlocked: ${skinOf(id).name}!`);
  }
  const PLAYER_COLORS = ['#7fe0d4', '#ff7a8a', '#ffd23a', '#b18cff'];
  // stars for a hole: 1 = finished, 2 = par, 3 = under par (picked up = none)
  const starsFor = (s, par, picked) => picked ? 0 : s < par ? 3 : s === par ? 2 : 1;
  const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const starTotal = c => (store.get(KEY('stars', c.id), [])).reduce((a, b) => a + (b || 0), 0);

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
      // a thin bright rim on the lit side (atmosphere)
      if (d > r - 1.6 && d <= r - .6 && (dx * L[0] + dy * L[1]) / r > .35 && k !== 'sun' && k !== 'asteroid') shade = 3;
      g.fillStyle = K.pal[shade]; g.fillRect(x, y, 1, 1);
    }
    spriteCache.set(key, c);
    return c;
  }
  // soft light, drawn additively on top of the pixels
  const glowCache = new Map();
  function glow(x, y, r, col, a) {
    const key = col + '|' + r;
    let c = glowCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = r * 2 + 2;
      const g = c.getContext('2d'), gr = g.createRadialGradient(r + 1, r + 1, 0, r + 1, r + 1, r + 1);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      glowCache.set(key, c);
    }
    ctx.globalAlpha = a; ctx.drawImage(c, Math.round(x - r - 1), Math.round(y - r - 1)); ctx.globalAlpha = 1;
  }
  const VIGNETTE = (() => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), gr = g.createRadialGradient(W / 2, H / 2, H * .4, W / 2, H / 2, W * .62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    return c;
  })();

  // ---------- sound (tiny synth) + phone buzz ----------
  let ac = null;
  const beep = (f0, f1, dur, type = 'square', vol = .06, delay = 0) => {
    if (!settings.sound) return;
    try {
      ac ??= new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime + delay, o = ac.createOscillator(), gn = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + dur + .02);
    } catch (e) {}
  };
  const buzz = ms => { try { navigator.vibrate?.(ms); } catch (e) {} };
  const SND = {
    shot: p => { beep(180 + p * 260, 80, .12, 'triangle', .08); beep(900, 300, .05, 'square', .02); buzz(12); },
    bounce: s => beep(220 + s, 120, .05, 'square', Math.min(.05, s / 3000)),
    sink: () => { [523, 659, 784, 1046].forEach((f, i) => beep(f, f, .14, 'square', .05, i * .08)); buzz([20, 40, 30]); },
    ace: () => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => beep(f, f * 1.01, .16, 'square', .05, i * .07)); buzz([30, 40, 30, 40, 60]); },
    burn: () => { beep(300, 40, .5, 'sawtooth', .06); beep(90, 30, .5, 'square', .04); buzz(120); },
    lost: () => beep(400, 90, .45, 'triangle', .06),
    void: () => { beep(900, 30, .8, 'sine', .08); beep(60, 20, .7, 'sawtooth', .04, .05); buzz([60, 30, 120]); },
    warp: () => beep(200, 1400, .25, 'sine', .07),
    click: () => beep(700, 700, .03, 'square', .03),
    unlock: () => [784, 988, 1318].forEach((f, i) => beep(f, f, .12, 'triangle', .06, i * .09)),
  };

  // ---------- level state ----------
  let level = null, bodies = [], moons = [], warps = [], tee = null, hole = null, t = 0;
  let ball = null, state = 'menu', strokes = 0, lastRest = null, flight = 0, msg = null, parts = [], rings = [];
  let aim = null, keyAim = { a: -45, p: .5, on: false }, starfield = null, ff = false;
  let shakeT = 0, shakeA = 0, freezeT = 0;

  function load(lv) {
    level = lv; t = 0; parts = []; rings = []; msg = null;
    bodies = lv.b.map((b, i) => ({ ...b, ...KINDS[b.k], seed: i + 3 }));
    moons = (lv.moons || []).map((m, i) => ({ k: 'moon', ...KINDS.moon, ...m, x: 0, y: 0, seed: 50 + i }));
    warps = (lv.w || []).map(w => ({ ax: w[0], ay: w[1], bx: w[2], by: w[3] }));
    tee = lv.tee; hole = lv.hole;
    placeMoons(0);
    strokes = 0; flight = 0;
    ball = { x: 0, y: 0, vx: 0, vy: 0, rest: { b: tee.b, a: rad(tee.a) }, trail: [] };
    snapToRest(ball);
    lastRest = { ...ball.rest };
    starfield = makeStars(lv.name);
    state = 'aim';
  }
  function placeMoons(time) {
    for (const b of bodies) if (b.orbit) {
      const p = bodies[b.orbit.of], a = b.orbit.ph + b.orbit.w * time;
      b.x = p.x + Math.cos(a) * b.orbit.d; b.y = p.y + Math.sin(a) * b.orbit.d;
      b.vx = -Math.sin(a) * b.orbit.d * b.orbit.w; b.vy = Math.cos(a) * b.orbit.d * b.orbit.w;
    }
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

  // ---------- effects ----------
  function burst(x, y, cols, n, sp) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * (.3 + Math.random() * .7); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .4 + Math.random() * .5, col: cols[i % cols.length] }); }
  }
  const ring = (x, y, col, max = 12, life = .35) => rings.push({ x, y, col, max, life, t: 0 });
  const shake = (a, dur) => { if (!settings.shake) return; shakeA = Math.max(shakeA, a); shakeT = Math.max(shakeT, dur); };

  // one physics step for a ball; returns an event string or null. Used by the game and by the level checker.
  function step(bl, time, fx) {
    const list = allBodies();
    const [ax, ay] = gravAt(bl.x, bl.y, list);
    bl.vx += ax * DT; bl.vy += ay * DT;
    bl.x += bl.vx * DT; bl.y += bl.vy * DT;
    // the force-field walls
    let wall = false;
    const hit = v => { if (fx && Math.abs(v) > 30) { SND.bounce(Math.abs(v) * .6); if (Math.abs(v) > 90) { ring(bl.x, bl.y, '#6a5cc0', 8); shake(1, .08); } } };
    if (bl.x < WALL.l) { bl.x = WALL.l; if (bl.vx < 0) { hit(bl.vx); bl.vx = -bl.vx * .55; } wall = true; }
    if (bl.x > WALL.r) { bl.x = WALL.r; if (bl.vx > 0) { hit(bl.vx); bl.vx = -bl.vx * .55; } wall = true; }
    if (bl.y < WALL.t) { bl.y = WALL.t; if (bl.vy < 0) { hit(bl.vy); bl.vy = -bl.vy * .55; } wall = true; }
    if (bl.y > WALL.b) { bl.y = WALL.b; if (bl.vy > 0) { hit(bl.vy); bl.vy = -bl.vy * .55; } wall = true; }
    if (wall) { bl.vx *= Math.max(0, 1 - 3 * DT); bl.vy *= Math.max(0, 1 - 3 * DT); }
    // wormholes
    if (bl.warpCd > 0) bl.warpCd -= DT;
    else for (const w of warps) {
      for (const [fx1, fy1, tx, ty] of [[w.ax, w.ay, w.bx, w.by], [w.bx, w.by, w.ax, w.ay]]) {
        if (Math.hypot(bl.x - fx1, bl.y - fy1) < 5) {
          bl.x = tx; bl.y = ty; bl.warpCd = .5;
          if (fx) { SND.warp(); burst(tx, ty, ['#9f7bff', '#5ef0e0'], 14, 40); ring(fx1, fy1, '#b18cff', 14); ring(tx, ty, '#6ff5e4', 14); bl.trail = []; }
          return 'warp';
        }
      }
    }
    let contact = null;
    for (let i = 0; i < list.length; i++) {
      const b = list[i], dx = bl.x - b.x, dy = bl.y - b.y, d = Math.hypot(dx, dy) || .001, min = b.r + BR;
      if (d >= min + .35) continue;
      if (b.deadly && d < min) return b.k === 'blackhole' ? 'void' : 'burn';
      const nx = dx / d, ny = dy / d;
      if (d < min) { bl.x = b.x + nx * min; bl.y = b.y + ny * min; }
      const rvx = bl.vx - (b.vx || 0), rvy = bl.vy - (b.vy || 0), vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        bl.vx -= (1 + b.e) * vn * nx; bl.vy -= (1 + b.e) * vn * ny;
        if (fx && -vn > 30) {
          SND.bounce(-vn);
          if (-vn > 60) { burst(bl.x, bl.y, [b.pal[3], b.pal[2]], 3 + (-vn / 40 | 0), 25); ring(bl.x, bl.y, b.pal[3], 6 + Math.min(10, -vn / 20)); }
          if (-vn > 110) shake(1.2, .1);
        }
      }
      // friction along the surface while touching
      const tvx = (bl.vx - (b.vx || 0)) - ((bl.vx - (b.vx || 0)) * nx + (bl.vy - (b.vy || 0)) * ny) * nx;
      const tvy = (bl.vy - (b.vy || 0)) - ((bl.vx - (b.vx || 0)) * nx + (bl.vy - (b.vy || 0)) * ny) * ny;
      const f = Math.max(0, 1 - b.mu * DT);
      bl.vx -= tvx * (1 - f); bl.vy -= tvy * (1 - f);
      contact = { i, a: Math.atan2(ny, nx), b };
    }
    // the cup (speed measured against the cup's planet, which may be moving)
    const c = cupPoint(), cb = bodies[hole.b], sp = Math.hypot(bl.vx - (cb.vx || 0), bl.vy - (cb.vy || 0));
    if (Math.hypot(bl.x - c.x, bl.y - c.y) < 5 && sp < 120) return 'sink';
    // coming to rest (on a planet — even a moving one — or against a wall)
    const rel = contact ? Math.hypot(bl.vx - (contact.b.vx || 0), bl.vy - (contact.b.vy || 0)) : Math.hypot(bl.vx, bl.vy);
    if ((contact || wall) && rel < 9) {
      bl.restT = (bl.restT || 0) + DT;
      if (bl.restT > .28) { bl.rest = contact ? { b: contact.i, a: contact.a } : { x: bl.x, y: bl.y }; return 'rest'; }
    } else bl.restT = 0;
    return null;
  }

  // ---------- shooting ----------
  function launchVel(dx, dy) {
    const len = Math.hypot(dx, dy), p = Math.min(len, PULL) / PULL;
    return { vx: -dx / (len || 1) * p * VMAX, vy: -dy / (len || 1) * p * VMAX, p };
  }
  // a ball sitting on a moving planet moves with it (and keeps that speed when you hit it)
  const carry = bl => { const b = bl.rest?.b !== undefined ? allBodies()[bl.rest.b] : null; return b ? [b.vx || 0, b.vy || 0] : [0, 0]; };
  function shoot(vx, vy, p) {
    if (state !== 'aim' || p < .04) return;
    const [cx, cy] = carry(ball);
    ball.rest = null; ball.vx = vx + cx; ball.vy = vy + cy; ball.restT = 0; ball.warpCd = 0;
    strokes++; flight = 0; state = 'fly'; aim = null; keyAim.on = false; hudUpdate();
    SND.shot(p); burst(ball.x, ball.y, ['#ffffff', skin.glow], 6, 30); ring(ball.x, ball.y, '#ffffff', 5 + p * 6, .25);
    if (p > .8) shake(.8, .08);
    $('hint').hidden = true;
  }
  function penalty(text) {
    strokes++; msg = { text, t: 1.4 }; hudUpdate();
    ball.rest = { ...lastRest }; snapToRest(ball); ball.trail = [];
    state = 'aim';
    if (tooMany()) giveUp();
  }
  const tooMany = () => strokes >= level.par + (settings.hard ? 3 : 6);
  function giveUp() { msg = { text: 'Picked up', t: 1.4 }; finishHole(true); }
  function sink() {
    state = 'sunk'; freezeT = strokes === 1 ? .22 : .12;   // a beat of stillness as it drops
    const c = cupPoint();
    burst(c.x, c.y, ['#ffd23a', '#ffffff', '#7fe0d4', '#ff6a8a'], strokes === 1 ? 70 : 32, strokes === 1 ? 100 : 60);
    ring(c.x, c.y, '#ffd23a', strokes === 1 ? 40 : 22, .6); ring(c.x, c.y, '#ffffff', strokes === 1 ? 26 : 14, .45);
    shake(strokes === 1 ? 2.5 : 1.2, strokes === 1 ? .45 : .2);
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
    if (freezeT > 0) { freezeT -= real; real *= .1; }
    if (state === 'fly' || state === 'aim' || state === 'sunk') {
      acc += real * (ff && state === 'fly' ? 3 : 1);   // hold ⏩ (or F) to hurry a slow roll along
      let steps = 0;
      while (acc >= DT && steps++ < 480) {
        acc -= DT; t += DT; placeMoons(t);
        if (state === 'aim' && ball.rest) snapToRest(ball);   // riding a moving planet
        if (state === 'fly') {
          flight += DT;
          const ev = step(ball, t, true);
          ball.trail.push([ball.x, ball.y]); if (ball.trail.length > 22) ball.trail.shift();
          if (ev === 'burn') { burst(ball.x, ball.y, ['#ffb000', '#ff5a00', '#fff38a'], 30, 70); ring(ball.x, ball.y, '#ff7a00', 18, .5); shake(2, .3); SND.burn(); penalty('Burned up! +1'); break; }
          if (ev === 'void') { burst(ball.x, ball.y, ['#8a4aff', '#ffb070', '#ffffff'], 26, 50); ring(ball.x, ball.y, '#8a4aff', 22, .6); ring(ball.x, ball.y, '#ffb070', 12, .4); shake(2.2, .35); SND.void(); penalty('Spaghettified! +1'); break; }
          if (ev === 'sink') { sink(); break; }
          if (ev === 'rest') { lastRest = { ...ball.rest }; snapToRest(ball); state = 'aim'; ball.trail = []; if (tooMany()) giveUp(); break; }
          if (flight > 14) { SND.lost(); penalty('Lost in orbit! +1'); break; }
        }
      }
      if (acc > DT * 4) acc = 0;
    }
    for (const p of parts) { p.x += p.vx * real; p.y += p.vy * real; p.vx *= .96; p.vy *= .96; p.life -= real; }
    parts = parts.filter(p => p.life > 0);
    for (const r of rings) r.t += real;
    rings = rings.filter(r => r.t < r.life);
    if (shakeT > 0) shakeT -= real; else shakeA = 0;
    if (msg) { msg.t -= real; if (msg.t <= 0) msg = null; }
    if (keyAim.on && state === 'aim') keyStep(real);
    for (const s of starfield?.shooting || []) { s.x += s.vx * real; s.y += s.vy * real; s.life -= real; }
    if (starfield) {
      starfield.shooting = starfield.shooting.filter(s => s.life > 0);
      if (Math.random() < real * .12) starfield.shooting.push({ x: Math.random() * W, y: Math.random() * H * .4, vx: -120 - Math.random() * 80, vy: 40 + Math.random() * 30, life: .6 });
    }
  }

  // ---------- drawing ----------
  function makeStars(name) {
    const r = rng([...name].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) >>> 0), c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#07060d'; g.fillRect(0, 0, W, H);
    // a dithered nebula
    const hue = [['#140a26', '#1f0f36', '#2a1446'], ['#0a1426', '#0f2036', '#14304a'], ['#200a18', '#321028', '#461838']][Math.floor(r() * 3)];
    const cx = r() * W, cy = r() * H, cx2 = r() * W, cy2 = r() * H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = Math.sin(x * .03 + y * .01) * Math.cos(y * .05) + Math.sin((x + y) * .02) - Math.min(Math.hypot(x - cx, y - cy), Math.hypot(x - cx2, y - cy2) * 1.3) / 140;
      const d = v + BAYER[(y & 3) * 4 + (x & 3)] * .8;
      if (d > .7) { g.fillStyle = v > 1.25 ? hue[2] : v > 1.05 ? hue[1] : hue[0]; g.fillRect(x, y, 1, 1); }
    }
    const stars = [];
    for (let i = 0; i < 130; i++) stars.push({ x: r() * W, y: r() * H | 0, b: r(), tw: r() * TAU, z: 1 + Math.floor(r() * 3) });
    return { bg: c, stars, shooting: [] };
  }
  const px = (x, y, col, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  function drawWorld(time, sel) {
    ctx.drawImage(starfield.bg, 0, 0);
    // three layers of stars drifting at different speeds (parallax)
    for (const s of starfield.stars) {
      const x = ((s.x - time * s.z * 1.6) % W + W) % W, tw = .5 + .5 * Math.sin(time * 2 + s.tw);
      if (s.b * tw > .22) px(x, s.y, s.z === 3 ? '#ffffff' : s.z === 2 ? '#b8c4ff' : '#5a5a86');
    }
    for (const s of starfield.shooting) for (let k = 0; k < 6; k++) px(s.x - s.vx * k * .006, s.y - s.vy * k * .006, k < 2 ? '#ffffff' : '#6a6aa0');
    // the force-field walls
    for (let x = WALL.l - 1; x <= WALL.r + 1; x += 4) { px(x, WALL.t - 2, '#2a2448'); px(x, WALL.b + 1, '#2a2448'); }
    for (let y = WALL.t - 2; y <= WALL.b + 1; y += 4) { px(WALL.l - 2, y, '#2a2448'); px(WALL.r + 1, y, '#2a2448'); }
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
      if (b.k === 'blackhole') { drawBlackHole(b, time); if (sel === b) for (let i = 0; i < 30; i++) { const a = i / 30 * TAU + time; if (i % 2) px(b.x + Math.cos(a) * (b.r + 10), b.y + Math.sin(a) * (b.r + 10), '#ffd23a'); } continue; }
      const f = b.k === 'sun' || b.k === 'repel' ? Math.floor(time * 6) % 4 : 0, sp = planetSprite(b.k, b.r, b.seed, f);
      if (b.k === 'sun') for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + time, rr = b.r + 2 + ((i * 7 + Math.floor(time * 8)) % 4); px(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr, i % 3 ? '#ff7a00' : '#ffe060'); }
      ctx.drawImage(sp, Math.round(b.x - b.r - 1.5), Math.round(b.y - b.r - 1.5));
      if (sel === b) { for (let i = 0; i < 30; i++) { const a = i / 30 * TAU + time; if (i % 2) px(b.x + Math.cos(a) * (b.r + 3), b.y + Math.sin(a) * (b.r + 3), '#ffd23a'); } }
    }
    // the cup and a waving flag
    if (hole && bodies[hole.b]) {
      const c = cupPoint(), b = bodies[hole.b], a = rad(hole.a);
      for (let k = -2; k <= 2; k++) { const aa = a + k / b.r; px(b.x + Math.cos(aa) * (b.r - .5) - .5, b.y + Math.sin(aa) * (b.r - .5) - .5, '#000000'); }
      const tipx = c.x + c.nx * 10, tipy = c.y + c.ny * 10, tx = -c.ny, ty = c.nx;
      for (let i = 1; i <= 10; i++) px(c.x + c.nx * i, c.y + c.ny * i, i > 8 ? '#ffffff' : '#c8c8d0');
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
        const wv = Math.sin(time * 6 - i * .9) * i * .25;
        px(tipx - c.nx * (j + wv) + tx * (i + 1), tipy - c.ny * (j + wv) + ty * (i + 1), j === 1 ? '#ff3a4a' : '#c01828');
      }
      // pulsing ring around the cup
      const pr = 5 + (time * 6 % 5);
      ctx.globalAlpha = .5 * (1 - (pr - 5) / 5);
      for (let i = 0; i < 12; i++) { const aa = i / 12 * TAU; px(c.x + Math.cos(aa) * pr, c.y + Math.sin(aa) * pr, '#ffd23a'); }
      ctx.globalAlpha = 1;
    }
  }
  // a black hole: rings sucked inward, a dark shadow, a thick tilted accretion disc streaming round it, a bent-light ring
  function drawBlackHole(b, time) {
    const R = b.r, cx = Math.round(b.x), cy = Math.round(b.y);
    // the pull: faint rings shrinking toward the middle
    for (let k = 0; k < 3; k++) {
      const ph = (time * .45 + k / 3) % 1, rr = R + 4 + (1 - ph) * 30, n = Math.round(rr * 1.6);
      ctx.globalAlpha = .55 * ph;
      for (let i = 0; i < n; i++) if (i % 2 === 0) { const a = i / n * TAU - time * .6; px(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr, '#4a2a7a'); }
      ctx.globalAlpha = 1;
    }
    // the shadow: space itself goes darker around it
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(cx + .5, cy + .5, R + 7, 0, TAU); ctx.fill();
    const disc = front => {
      for (let ring = 0; ring < 5; ring++) {
        const rr = R + 3 + ring * 1.6, n = 70, spin = time * (2.8 - ring * .35);
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + spin, x = Math.cos(a) * rr * 2, y = Math.sin(a) * rr * .42;
          if ((y >= 0) !== front) continue;
          const hot = ring < 2, tick = (i + ring * 3) % 7 === 0;
          px(b.x + x, b.y + y, tick ? '#ffffff' : hot ? (front ? '#ffd0a0' : '#ff9a4a') : (front ? '#ff8a3a' : '#b0401a'));
        }
      }
    };
    disc(false);   // the far side, behind the hole
    for (let i = 0; i < 48; i++) { const a = i / 48 * TAU - time; px(b.x + Math.cos(a) * (R + 1.4), b.y + Math.sin(a) * (R + 1.4), i % 3 ? '#c9a0ff' : '#ffffff'); }   // photon ring
    ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(cx + .5, cy + .5, R + .5, 0, TAU); ctx.fill();
    disc(true);    // the near side, in front
    // matter spiralling in
    for (let k = 0; k < 8; k++) { const ph = (time * .5 + k / 8) % 1, a = k * 2.4 + ph * 11, rr = (R + 28) * (1 - ph) + R + 1; px(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr * .8, ph > .75 ? '#ffe0b0' : ph > .4 ? '#b07aff' : '#5a3a8a'); }
  }
  function drawLights(time) {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of allBodies()) {
      const K = KINDS[b.k];
      if (b.k === 'sun') glow(b.x, b.y, b.r + 22, K.aura, .55 + Math.sin(time * 7 + b.seed) * .06);
      else if (b.k === 'blackhole') { glow(b.x, b.y, b.r + 34, K.aura, .34 + Math.sin(time * 2) * .06); glow(b.x, b.y, b.r + 16, '#ff8a3a', .3); }
      else if (K.aura) glow(b.x, b.y, b.r + 10, K.aura, b.k === 'repel' ? .22 + Math.sin(time * 3) * .06 : .16);
    }
    for (const w of warps) { glow(w.ax, w.ay, 12, '#9f7bff', .5); glow(w.bx, w.by, 12, '#5ef0e0', .45); }
    if (hole && bodies[hole.b]) { const c = cupPoint(); glow(c.x, c.y, 10, '#ffd23a', .28 + Math.sin(time * 5) * .08); }
    if (ball && state !== 'sunk' && state !== 'edit') glow(ball.x, ball.y, 7, ballColor().glow, .7);
    for (const p of parts) glow(p.x, p.y, 3, p.col, p.life * .5);
    ctx.globalCompositeOperation = 'source-over';
  }

  function draw() {
    if (!starfield) return;
    const time = state === 'edit' ? performance.now() / 1000 : t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (shakeA > 0 && shakeT > 0) { const k = shakeA * Math.min(1, shakeT * 6); ctx.translate(Math.round((Math.random() - .5) * 2 * k), Math.round((Math.random() - .5) * 2 * k)); }
    if (state === 'edit') { drawWorld(time, sel); drawEditorExtras(); }
    else {
      drawWorld(time);
      drawLights(time);
      const bc = ballColor();
      // trail and ball
      ball.trail.forEach(([x, y], i) => { if (i % 2 && i > 1) px(x - .5, y - .5, bc.trail[Math.min(bc.trail.length - 1, Math.floor(i / ball.trail.length * bc.trail.length))]); });
      if (state !== 'sunk') { px(ball.x - 1.5, ball.y - .5, bc.ball, 3, 1); px(ball.x - .5, ball.y - 1.5, bc.ball, 1, 3); }
      // aim guide
      let v = null;
      if (state === 'aim' && aim) v = launchVel(aim.dx, aim.dy);
      if (state === 'aim' && keyAim.on && !aim) v = { vx: Math.cos(rad(keyAim.a)) * keyAim.p * VMAX, vy: Math.sin(rad(keyAim.a)) * keyAim.p * VMAX, p: keyAim.p };
      if (v && v.p > .03) {
        const [cx, cy] = carry(ball), g = { x: ball.x, y: ball.y, vx: v.vx + cx, vy: v.vy + cy }, n = settings.hard ? 14 : settings.guide === 'short' ? 60 : 130;
        for (let i = 0; i < n; i++) {
          const [ax, ay] = gravAt(g.x, g.y, allBodies()); g.vx += ax * DT; g.vy += ay * DT; g.x += g.vx * DT; g.y += g.vy * DT;
          if (i % 6 === 5) px(g.x - .5, g.y - .5, i < n * .35 ? '#ffffff' : i < n * .7 ? '#9aa0c0' : '#4a4a6a');
        }
        // power meter beside the ball
        const bx = Math.round(ball.x) + 6, by = Math.round(ball.y) - 8, h = Math.round(v.p * 10);
        px(bx, by, '#1a1624', 3, 12);
        px(bx + 1, by + 11 - h, v.p > .85 ? '#ff5a3a' : v.p > .5 ? '#ffd23a' : '#7fe0d4', 1, h);
      }
      for (const p of parts) px(p.x, p.y, p.col);
      for (const r of rings) {
        const k = r.t / r.life, rr = 2 + k * r.max, n = Math.max(8, Math.round(rr * 2.4));
        ctx.globalAlpha = 1 - k;
        for (let i = 0; i < n; i++) { const a = i / n * TAU; px(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr, r.col); }
        ctx.globalAlpha = 1;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(VIGNETTE, 0, 0);
    if (msg) { const el = $('msg'); el.textContent = msg.text; el.className = 'msg show' + (msg.big ? ' big' : ''); } else $('msg').className = 'msg';
    $('ffBtn').hidden = state !== 'fly';
  }

  // ---------- input ----------
  const toGame = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  cv.addEventListener('pointerdown', e => {
    if (state === 'edit') return edDown(e);
    if (state !== 'aim') return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    const p = toGame(e); aim = { sx: p.x, sy: p.y, dx: 0, dy: 0 }; keyAim.on = false;
  });
  addEventListener('pointermove', e => {
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
  // fast-forward: hold the ⏩ button or F
  const ffOn = e => { e.preventDefault(); ff = true; }, ffOff = () => { ff = false; };
  $('ffBtn').addEventListener('pointerdown', ffOn); addEventListener('pointerup', ffOff); $('ffBtn').addEventListener('pointerleave', ffOff);

  const keys = new Set();
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (state === 'edit') return edKey(e);
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
    if (k === 'm') { settings.sound = !settings.sound; saveSettings(); paintSettings(); toast(settings.sound ? 'Sound on' : 'Sound off'); }
    if (k === 'f') ff = true;
    if (k === 'escape') { if (aim) aim = null; else if (state === 'aim' || state === 'fly') openPause(); }
    if (state !== 'aim') return;
    keys.add(k);
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k) && !keyAim.on) {
      keyAim.on = true; const rb = bodies[ball.rest?.b]; keyAim.a = rb ? deg(Math.atan2(ball.y - rb.y, ball.x - rb.x)) : -90;
    }
    if (k === ' ' || k === 'enter') {
      if (keyAim.on) shoot(Math.cos(rad(keyAim.a)) * keyAim.p * VMAX, Math.sin(rad(keyAim.a)) * keyAim.p * VMAX, keyAim.p);
      else keyAim.on = true;
    }
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys.delete(k); if (k === 'f') ff = false; });
  function keyStep(dt) {
    if (keys.has('arrowleft')) keyAim.a -= 90 * dt;
    if (keys.has('arrowright')) keyAim.a += 90 * dt;
    if (keys.has('arrowup')) keyAim.p = clamp(keyAim.p + .6 * dt, .05, 1);
    if (keys.has('arrowdown')) keyAim.p = clamp(keyAim.p - .6 * dt, .05, 1);
  }

  // ---------- a round: solo, party, a friend's hole, or testing an editor hole ----------
  // round = { mode, course, i (hole index), players: [{ name, color, card: [] }], turn }
  let round = null;
  const player = () => round.players[round.turn];
  function ballColor() {
    if (round?.mode === 'party') { const c = player().color; return { ball: c, glow: c, trail: ['#2a2440', c, '#ffffff'] }; }
    return skin;
  }
  function toast(text) { const el = $('toast'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); if (/unlocked/.test(text)) SND.unlock(); }
  function hudUpdate() {
    $('hud').hidden = false;
    const c = round.course;
    $('hHole').textContent = (settings.hard && round.mode !== 'test' ? 'HARD · ' : '') + (round.mode === 'custom' ? 'Friend’s hole' : round.mode === 'test' ? 'Testing'
      : round.mode === 'daily' ? 'Daily hole' : round.mode === 'endless' ? `Endless #${round.endless.n} ${'♥'.repeat(round.endless.lives)}` : `${c.name} ${round.i + 1}/${c.holes.length}`);
    $('hName').textContent = level.name;
    $('hPar').textContent = level.par;
    $('hStrokes').textContent = strokes;
    const party = round.mode === 'party';
    $('hPlayer').hidden = !party;
    if (party) { $('hPlayer').textContent = player().name; $('hPlayer').style.setProperty('--pc', player().color); }
    const card = player().card, tot = card.reduce((a, s, i) => a + (s == null ? 0 : s - c.holes[i].par), 0);
    $('hTotalWrap').hidden = !(round.mode === 'solo' || party) || !card.some(x => x != null);
    $('hTotal').textContent = tot === 0 ? 'E' : (tot > 0 ? '+' : '') + tot;
  }
  function show(id) { for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id; }
  function hideScreens() { for (const el of document.querySelectorAll('.screen')) el.hidden = true; }

  // ---------- Endless: freshly built holes, one after another, until your lives run out ----------
  let buildId = 0;
  async function building(text, make) {   // → the hole, or null if you backed out while it was being built
    const id = ++buildId;
    show('building'); $('hud').hidden = true; $('bText').textContent = text; state = 'gen';
    const lv = await make();
    return id === buildId ? lv : null;
  }
  function startEndless() {
    round = { mode: 'endless', course: { id: 'endless', name: 'Endless', holes: [] }, i: -1, players: [{ name: 'You', color: PLAYER_COLORS[0], card: [] }], turn: 0,
      endless: { n: 0, lives: 3, cleared: 0, seed: (Math.random() * 1e9) >>> 0 } };
    nextEndless();
  }
  async function nextEndless() {
    const e = round.endless; e.n++;
    const lv = await building(`Hole ${e.n} · the solver is checking it can be done`, () => generate(e.seed + e.n * 104729, e.n));
    if (!lv || round?.mode !== 'endless') return;   // (quit while it was building)
    round.course.holes.push(lv); round.i = round.course.holes.length - 1;
    playTurn();
    if (e.n === 1) msg = { text: '3 lives · over par costs lives', t: 2.2 };
  }
  // ---------- the Daily hole: the same built hole for everyone, all day ----------
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  async function startDaily() {
    const day = today(), seed = [...day].reduce((h, c) => (h * 131 + c.charCodeAt(0)) >>> 0, 7);
    const lv = await building(`Daily hole · ${day}`, () => generate(seed, 6));
    if (!lv) return;
    lv.name = `Daily: ${lv.name}`;
    round = { mode: 'daily', day, course: { id: 'daily', name: 'Daily', holes: [lv] }, i: 0, players: [{ name: 'You', color: PLAYER_COLORS[0], card: [] }], turn: 0 };
    playTurn();
  }
  function startRound(mode, courseId, from = 0, names = null) {
    const course = courseById(courseId);
    const players = (names || ['You']).map((name, k) => ({ name, color: PLAYER_COLORS[k], card: [] }));
    if (mode === 'solo' && from) players[0].card = store.get(KEY('run', course.id), []).slice(0, from);
    round = { mode, course, i: from, players, turn: 0 };
    playTurn();
  }
  function playTurn() {
    hideScreens(); $('editbar').hidden = true;
    load(round.course.holes[round.i]); hudUpdate();
    $('hint').hidden = !(round.mode === 'solo' && round.i === 0 && round.course.id === 'classic' && !store.get('played', false));
    if (round.mode === 'party') { msg = { text: `${player().name}'s turn`, t: 1.6 }; }
  }
  function finishHole(pickedUp) {
    state = 'done';
    if (round.mode === 'test') { setTimeout(() => editor(), 900); return; }
    if (round.mode === 'daily') {   // today's hole: keep your best for the day
      const k = KEY('daily', round.day), best = store.get(k, null), now = pickedUp ? null : strokes;
      if (now !== null && (best === null || now < best)) store.set(k, now);
      const b2 = store.get(k, null);
      if (strokes === 1) unlock('gold');
      setTimeout(() => { show('customDone'); $('cdTitle').textContent = pickedUp ? 'Picked up' : scoreName(strokes, level.par) + '!';
        $('cdText').textContent = `${pickedUp ? 'No score' : `${strokes} stroke${strokes === 1 ? '' : 's'}`} · par ${level.par} · ${starText(starsFor(strokes, level.par, pickedUp))}${b2 !== null ? ` · today’s best ${b2}` : ''}. A new hole tomorrow.`; }, 600);
      return;
    }
    if (round.mode === 'custom') { setTimeout(() => { show('customDone'); $('cdTitle').textContent = 'Hole complete!'; $('cdText').textContent = `${strokes} stroke${strokes === 1 ? '' : 's'} (par ${level.par})`; }, 600); return; }
    const c = round.course, p = player();
    p.card[round.i] = strokes;
    if (round.mode === 'solo') {
      store.set('played', true);
      if (!round.single) store.set(KEY('run', c.id), p.card);
      const best = store.get(KEY('best', c.id), {}); if (!best[round.i] || strokes < best[round.i]) best[round.i] = strokes; store.set(KEY('best', c.id), best);
      store.set('open:' + c.id, Math.max(store.get('open:' + c.id, 1), round.i + 2));
      const sk = KEY('stars', c.id), st = store.get(sk, []); st[round.i] = Math.max(st[round.i] || 0, starsFor(strokes, level.par, pickedUp)); store.set(sk, st);
      if (c.id === 'classic' && starTotal(c) >= 40) unlock('nova');
    }
    if (round.mode === 'endless') {   // lives: over par costs one per stroke, under par wins one back (max 5)
      const e = round.endless, d = pickedUp ? 99 : strokes - level.par;
      e.lives = d > 0 ? e.lives - d : d < 0 ? Math.min(5, e.lives + 1) : e.lives;
      if (strokes === 1) unlock('gold');
      if (e.lives > 0) { e.cleared = e.n; if (e.n >= 10) unlock('aurora'); }
      const bk = KEY('endlessBest', 'all'); if (e.cleared > store.get(bk, 0)) { store.set(bk, e.cleared); e.record = true; }
      setTimeout(() => showCard(e.lives <= 0), pickedUp ? 900 : 300);
      return;
    }
    // unlocks (any mode except custom/test)
    if (strokes === 1) unlock('gold');
    if (c.id === 'classic' && round.i === 5) unlock('ember');
    if (c.id === 'classic' && round.i === 3 && strokes <= level.par) unlock('frost');
    const lastHole = round.i === c.holes.length - 1;
    if (round.mode === 'party' && round.turn < round.players.length - 1) {   // next player, same hole
      setTimeout(() => { round.turn++; playTurn(); }, 900);
      return;
    }
    if (lastHole) { if (c.id === 'classic') unlock('comet'); if (c.id === 'deep') unlock('void'); if (c.id === 'abyss') unlock('horizon'); }
    setTimeout(() => showCard(lastHole), pickedUp ? 900 : 300);
  }
  const vsPar = n => n === 0 ? 'E' : (n > 0 ? '+' : '') + n;
  function scoreName(s, p) { return s === 1 ? 'Ace' : ({ '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' }[s - p] ?? vsPar(s - p)); }
  function showCard(final) {
    show('card');
    const c = round.course, ps = round.players, upto = round.i + 1;
    const totals = ps.map(p => ({ p, s: p.card.slice(0, upto).reduce((a, b) => a + (b || 0), 0), vs: p.card.slice(0, upto).reduce((a, b, i) => a + (b == null ? 0 : b - c.holes[i].par), 0) }));
    const party = round.mode === 'party';
    // table: one row per hole, one column per player
    const head = `<tr class="head"><td>#</td><td>Hole</td><td>Par</td>${ps.map(p => `<td style="color:${p.color}">${esc(party ? p.name : 'You')}</td>`).join('')}</tr>`;
    const rows = c.holes.slice(0, upto).map((h, i) => [h, i]).filter(([, i]) => ps.some(p => p.card[i] != null) && (round.mode !== 'endless' || i > round.i - 8)).map(([h, i]) => `<tr${i === round.i ? ' class="now"' : ''}><td>${i + 1}</td><td>${esc(h.name)}</td><td>${h.par}</td>${ps.map(p => { const s = p.card[i]; return `<td class="${s < h.par ? 'good' : s > h.par ? 'bad' : ''}">${s ?? '–'}</td>`; }).join('')}</tr>`).join('');
    $('cardRows').innerHTML = head + rows;
    const lead = [...totals].sort((a, b) => a.s - b.s);
    if (party) {
      $('cardTitle').textContent = final ? `${lead[0].p.name} wins!` : `After hole ${upto}`;
      $('cardTotal').innerHTML = lead.map((x, k) => `<span style="color:${x.p.color}">${k + 1}. ${esc(x.p.name)} ${x.s} (${vsPar(x.vs)})</span>`).join(' · ');
    } else if (round.mode === 'endless') {
      const e = round.endless, s0 = ps[0].card[round.i];
      $('cardTitle').textContent = final ? `Out of lives after ${e.cleared || 0} hole${e.cleared === 1 ? '' : 's'}` : `Hole ${e.n}: ${scoreName(s0, c.holes[round.i].par)}`;
      $('cardTotal').textContent = final ? `${totals[0].s} strokes · ${vsPar(totals[0].vs)}` : `Lives ${'♥'.repeat(e.lives)} · ${e.n} cleared`;
    } else {
      $('cardTitle').textContent = final ? `${c.name} complete!` : `Hole ${upto}: ${scoreName(ps[0].card[round.i], c.holes[round.i].par)} ${round.mode === 'solo' ? starText(starsFor(ps[0].card[round.i], c.holes[round.i].par, false)) : ''}`;
      $('cardTotal').textContent = `${totals[0].s} stroke${totals[0].s === 1 ? '' : 's'} · ${totals[0].vs === 0 ? 'even par' : vsPar(totals[0].vs)}`;
    }
    $('cardNext').textContent = final ? 'Play again' : 'Next hole';
    $('cardNext').onclick = () => {
      SND.click();
      if (round.mode === 'endless') { final ? startEndless() : nextEndless(); return; }
      if (final) startRound(round.mode, c.id, 0, party ? ps.map(p => p.name) : null);
      else { round.i++; round.turn = 0; playTurn(); }
    };
    $('cardBest').textContent = round.mode === 'endless' && final ? (round.endless.record ? 'New best run!' : `Best run: ${store.get(KEY('endlessBest', 'all'), 0)} hole${store.get(KEY('endlessBest', 'all'), 0) === 1 ? '' : 's'}`) : '';
    if (final && round.mode === 'solo' && !round.single) {
      const bk = KEY('bestRound', c.id), best = store.get(bk, null);
      if (best === null || totals[0].vs < best) { store.set(bk, totals[0].vs); $('cardBest').textContent = 'New best round!'; }
      else $('cardBest').textContent = `Best round: ${vsPar(best)}`;
      store.set(KEY('run', c.id), []);
    }
    setTimeout(() => $('cardNext').focus(), 50);
  }

  // ---------- menus ----------
  function title() {
    state = 'menu'; round = null; show('title'); $('hud').hidden = true; $('editbar').hidden = true;
    if (!starfield) { load(GG.COURSE[0]); state = 'menu'; }
    const bits = COURSES.map(c => { const b = store.get(KEY('bestRound', c.id), null); return b === null ? null : `${c.name} best: ${vsPar(b)}`; }).filter(Boolean);
    const eb = store.get(KEY('endlessBest', 'all'), 0); if (eb) bits.push(`Endless best: ${eb} hole${eb === 1 ? '' : 's'}`);
    if (settings.hard) bits.unshift('Hard mode');
    $('tBest').textContent = bits.join(' · ');
    setTimeout(() => $('tPlay').focus(), 50);
  }
  function courses(mode) {
    show('courses'); $('coursesTitle').textContent = mode === 'party' ? 'Party: pick a course' : 'Pick a course';
    $('courseList').innerHTML = COURSES.map(c => {
      const run = store.get(KEY('run', c.id), []), best = store.get(KEY('bestRound', c.id), null);
      const cont = mode === 'solo' && run.length && run.length < c.holes.length;
      if (isLocked(c)) return `<div class="course locked"><div><b>${c.name}</b><small>${c.blurb} · 🔒 ${c.lock}</small></div></div>`;
      return `<div class="course"><div><b>${c.name}</b><small>${c.blurb} · par ${parOf(c)}${best !== null ? ` · best ${vsPar(best)}` : ''} · ★ ${starTotal(c)}/${c.holes.length * 3}</small></div>
        <div class="row"><button class="btn go" type="button" data-play="${c.id}">Play</button>${cont ? `<button class="btn" type="button" data-cont="${c.id}">Continue (hole ${run.length + 1})</button>` : ''}</div></div>`;
    }).join('');
    for (const b of $('courseList').querySelectorAll('[data-play]')) b.onclick = () => { SND.click(); if (mode === 'party') startRound('party', b.dataset.play, 0, partyNames()); else { store.set(KEY('run', b.dataset.play), []); startRound('solo', b.dataset.play); } };
    for (const b of $('courseList').querySelectorAll('[data-cont]')) b.onclick = () => { SND.click(); startRound('solo', b.dataset.cont, store.get(KEY('run', b.dataset.cont), []).length); };
  }
  let holesCourse = 'classic';
  function holeSelect() {
    show('holes');
    $('holeTabs').innerHTML = COURSES.map(c => `<button type="button" class="tab" data-c="${c.id}" aria-pressed="${c.id === holesCourse}">${c.name}</button>`).join('');
    for (const b of $('holeTabs').children) b.onclick = () => { holesCourse = b.dataset.c; holeSelect(); };
    const c = courseById(holesCourse), best = store.get(KEY('best', c.id), {}), open = isLocked(c) ? 0 : store.get('open:' + c.id, 1), st = store.get(KEY('stars', c.id), []);
    $('holeGrid').innerHTML = c.holes.map((h, i) => `<button type="button" data-i="${i}" ${i >= open ? 'disabled' : ''}><b>${i + 1}</b><span>${esc(h.name)}</span><small>${i >= open ? (isLocked(c) ? c.lock : 'locked') : best[i] ? `best ${best[i]} · par ${h.par}` : `par ${h.par}`}</small>${st[i] ? `<i class="stars">${starText(st[i])}</i>` : ''}</button>`).join('');
    for (const b of $('holeGrid').children) b.onclick = () => { SND.click(); round = { mode: 'solo', single: true, course: c, i: +b.dataset.i, players: [{ name: 'You', color: PLAYER_COLORS[0], card: [] }], turn: 0 }; playTurn(); };
  }
  // party setup
  let partyCount = 2;
  const partyNames = () => [...$('partyNames').querySelectorAll('input')].map((el, k) => el.value.trim().slice(0, 12) || `Player ${k + 1}`);
  function partySetup() {
    show('party');
    const saved = store.get('partyNames', []);
    $('partyCount').innerHTML = [2, 3, 4].map(n => `<button type="button" class="tab" data-n="${n}" aria-pressed="${n === partyCount}">${n} players</button>`).join('');
    for (const b of $('partyCount').children) b.onclick = () => { store.set('partyNames', partyNames()); partyCount = +b.dataset.n; partySetup(); };
    $('partyNames').innerHTML = Array.from({ length: partyCount }, (_, k) => `<label><i class="dot" style="background:${PLAYER_COLORS[k]}"></i><input type="text" maxlength="12" value="${esc(saved[k] || `Player ${k + 1}`)}" aria-label="Player ${k + 1} name"></label>`).join('');
  }
  function skinsScreen() {
    show('skins');
    $('skinGrid').innerHTML = SKINS.map(s => {
      const got = unlocks.has(s.id);
      return `<button type="button" class="skin${s.id === skin.id ? ' on' : ''}" data-s="${s.id}" ${got ? '' : 'disabled'}>
        <span class="ballpv" style="background:${got ? s.ball : '#2a2448'};box-shadow:0 0 12px ${got ? s.glow : 'transparent'}"></span>
        <span class="trail">${s.trail.map(c => `<i style="background:${got ? c : '#2a2448'}"></i>`).join('')}</span>
        <b>${s.name}</b><small>${got ? (s.id === skin.id ? 'Equipped' : 'Tap to use') : esc(s.how)}</small></button>`;
    }).join('');
    for (const b of $('skinGrid').children) b.onclick = () => { SND.click(); skin = skinOf(b.dataset.s); store.set('skin', skin.id); skinsScreen(); };
  }
  function paintSettings() {
    $('sSound').textContent = `Sound: ${settings.sound ? 'on' : 'off'}`;
    $('sShake').textContent = `Screen shake: ${settings.shake ? 'on' : 'off'}`;
    $('sGuide').textContent = `Aim guide: ${settings.guide}`;
    $('sHard').textContent = `Difficulty: ${settings.hard ? 'Hard — short aim line, picked up at par +3' : 'Normal'}`;
  }
  function openPause() { if (state === 'fly') return; show('pause'); }

  $('tPlay').onclick = () => { SND.click(); courses('solo'); };
  $('tEndless').onclick = () => { SND.click(); startEndless(); };
  $('tDaily').onclick = () => { SND.click(); startDaily(); };
  $('tParty').onclick = () => { SND.click(); partySetup(); };
  $('partyGo').onclick = () => { SND.click(); store.set('partyNames', partyNames()); courses('party'); };
  $('tHoles').onclick = () => { SND.click(); holeSelect(); };
  $('tEdit').onclick = () => { SND.click(); editor(); };
  $('tSkins').onclick = () => { SND.click(); skinsScreen(); };
  $('tSettings').onclick = () => { SND.click(); paintSettings(); show('settings'); $('settingsBack').onclick = () => title(); };
  $('tCode').onclick = () => { SND.click(); show('codeIn'); $('codeText').value = ''; $('codeErr').textContent = ''; setTimeout(() => $('codeText').focus(), 50); };
  $('codeGo').onclick = () => {
    const lv = decode($('codeText').value);
    if (!lv) { $('codeErr').textContent = 'That code doesn’t work — check you copied all of it.'; return; }
    round = { mode: 'custom', course: { id: 'custom', name: 'Custom', holes: [lv] }, i: 0, players: [{ name: 'You', color: PLAYER_COLORS[0], card: [] }], turn: 0 };
    hideScreens(); load(lv); hudUpdate();
  };
  $('sSound').onclick = () => { settings.sound = !settings.sound; saveSettings(); paintSettings(); SND.click(); };
  $('sShake').onclick = () => { settings.shake = !settings.shake; saveSettings(); paintSettings(); SND.click(); if (settings.shake) shake(2, .25); };
  $('sGuide').onclick = () => { settings.guide = settings.guide === 'long' ? 'short' : 'long'; saveSettings(); paintSettings(); SND.click(); };
  $('sHard').onclick = () => { if (round && state !== 'menu') { toast('Change difficulty from the title screen'); return; } settings.hard = !settings.hard; saveSettings(); paintSettings(); SND.click(); };
  for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { SND.click(); title(); };
  $('menuBtn').onclick = () => { if (state === 'aim' || state === 'fly') openPause(); };
  $('pResume').onclick = () => { hideScreens(); };
  $('pRestart').onclick = () => { hideScreens(); load(level); hudUpdate(); };
  $('pSettings').onclick = () => { paintSettings(); show('settings'); $('settingsBack').onclick = () => { show('pause'); }; };
  $('pQuit').onclick = () => { round?.mode === 'test' ? editor() : title(); };
  $('settingsBack').onclick = () => title();
  $('cdAgain').onclick = () => { hideScreens(); load(level); hudUpdate(); };
  $('buildCancel').onclick = () => { SND.click(); buildId++; round = null; title(); };

  // ---------- sharing holes as codes ----------
  const KLIST = ['home', 'rock', 'ice', 'sand', 'bouncy', 'repel', 'sun', 'asteroid', 'blackhole'];   // (new kinds go on the end, so old codes still work)
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
  const DEF_R = { home: 16, rock: 18, ice: 18, sand: 18, bouncy: 14, repel: 16, sun: 14, asteroid: 4, blackhole: 5 };
  function editor() {
    state = 'edit'; round = null; hideScreens(); $('hud').hidden = true; $('editbar').hidden = false;
    level = draft; bodies = draft.b.map((b, i) => ({ ...b, ...KINDS[b.k], seed: i + 3 })); moons = []; warps = (draft.w || []).map(w => ({ ax: w[0], ay: w[1], bx: w[2], by: w[3] }));
    tee = draft.tee; hole = draft.hole; parts = []; rings = [];
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
  const TIPS = { move: 'Drag planets to move them. Scroll (or [ and ]) to resize the selected one.', tee: 'Click the edge of a planet to put the ball there.', hole: 'Click the edge of a planet to put the cup there.', warp: 'Click two spots to make a wormhole pair.', del: 'Click a planet or wormhole to delete it.' };
  function setTool(tl) { tool = tl; pendingWarp = null; for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tl)); $('edTip').textContent = TIPS[tl] || (KINDS[tl] ? `Click in space to add a ${KINDS[tl].label.toLowerCase()} planet, then drag it where you like.` : ''); }
  const bodyAt = p => { let best = null, bd = 1e9; for (const b of bodies) { const d = Math.hypot(p.x - b.x, p.y - b.y) - b.r; if (d < 8 && d < bd) { bd = d; best = b; } } return best; };
  function edDown(e) {
    const p = toGame(e); try { cv.setPointerCapture(e.pointerId); } catch (err) {}
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
  function edMove(e) { if (!drag) return; const p = toGame(e); drag.b.x = clamp(p.x - drag.ox, 0, W); drag.b.y = clamp(p.y - drag.oy, 0, H); }
  function edUp() { if (drag) { drag = null; syncDraft(); } }
  function resizeSel(d) { if (!sel) return; sel.r = clamp(sel.r + d, sel.k === 'asteroid' || sel.k === 'blackhole' ? 2 : 6, sel.k === 'asteroid' ? 8 : sel.k === 'blackhole' ? 9 : 45); syncDraft(); }
  cv.addEventListener('wheel', e => { if (state !== 'edit' || !sel) return; e.preventDefault(); resizeSel(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  function edKey(e) {
    if (e.key === '[') resizeSel(-1); if (e.key === ']') resizeSel(1);
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); deleteBody(sel); }
  }
  function drawEditorExtras() {
    if (tee && bodies[tee.b]) { const b = bodies[tee.b], a = rad(tee.a), x = b.x + Math.cos(a) * (b.r + BR + .3), y = b.y + Math.sin(a) * (b.r + BR + .3); px(x - 1.5, y - .5, '#ffffff', 3, 1); px(x - .5, y - 1.5, '#ffffff', 1, 3); }
    if (pendingWarp) px(pendingWarp.x - 1, pendingWarp.y - 1, '#9f7bff', 3, 3);
  }
  for (const b of document.querySelectorAll('[data-tool]')) b.onclick = () => { SND.click(); setTool(b.dataset.tool); };
  $('edParDown').onclick = () => { draft.par = clamp(draft.par - 1, 1, 9); $('edPar').textContent = draft.par; syncDraft(); };
  $('edParUp').onclick = () => { draft.par = clamp(draft.par + 1, 1, 9); $('edPar').textContent = draft.par; syncDraft(); };
  $('edName').oninput = syncDraft;
  $('edTest').onclick = () => {
    syncDraft();
    if (!tee || !hole) { $('edTip').textContent = 'Place the ball (Tee) and the cup (Cup) first.'; return; }
    const lv = JSON.parse(JSON.stringify(draft));
    round = { mode: 'test', course: { id: 'test', name: 'Test', holes: [lv] }, i: 0, players: [{ name: 'You', color: PLAYER_COLORS[0], card: [] }], turn: 0 };
    $('editbar').hidden = true; load(lv); hudUpdate();
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

  // ---------- the solver: plays a hole by brute force (sets pars, and checks generated holes can be finished) ----------
  // It borrows the loaded level, so only run it when nobody is mid-shot.
  function simShot(rest, t0, vx, vy, maxT = 9) {
    placeMoons(t0);
    const bl = { rest, x: 0, y: 0, vx: 0, vy: 0, restT: 0, warpCd: 0 };
    snapToRest(bl);
    const [cx, cy] = carry(bl);
    bl.rest = null; bl.vx = vx + cx; bl.vy = vy + cy;
    let tt = t0;
    for (let k = 0, n = maxT / DT; k < n; k++) {
      tt += DT; placeMoons(tt);
      const ev = step(bl, tt, false);
      if (ev === 'sink') return { sink: true };
      if (ev === 'burn' || ev === 'void') return null;
      if (ev === 'rest') return { rest: bl.rest, t: tt + .6, x: bl.x, y: bl.y };   // (+.6: a moment to aim)
    }
    return null;
  }
  const SOLVE_ANGLES = 60, SOLVE_POWERS = [.22, .34, .46, .58, .7, .82, .94];
  // best number of strokes found (up to maxDepth), or 0 if none; `beam` = how many landing spots to explore further
  function solve(lv, { maxDepth = 3, beam = 4, steady = 2.5, need = 6, angles = SOLVE_ANGLES, powers = SOLVE_POWERS, maxT = 9 } = {}) {
    const saved = { level, t, ball };
    load(lv);
    const c0 = cupPoint();
    let frontier = [{ rest: { b: lv.tee.b, a: rad(lv.tee.a) }, t: 0 }], found = 0, shots = 0;
    for (let depth = 1; depth <= maxDepth && !found; depth++) {
      const next = [];
      for (const node of frontier) {
        for (let i = 0; i < angles && !found; i++) for (const p of powers) {
          const a = i / angles * TAU, r = simShot(node.rest, node.t, Math.cos(a) * p * VMAX, Math.sin(a) * p * VMAX, maxT); shots++;
          if (r?.sink) {
            // only count it if a slightly shaky hand would still make it (like a person would)
            let ok = 0;
            // (and shooting a moment early or late — it matters when planets move)
            for (const [da, dp, dt] of [[-steady, 0, 0], [steady, 0, 0], [0, -.025, 0], [0, .025, 0], [0, 0, -.15], [0, 0, .15]]) { const aa = a + rad(da), pp = p + dp; if (simShot(node.rest, node.t + dt, Math.cos(aa) * pp * VMAX, Math.sin(aa) * pp * VMAX, maxT)?.sink) ok++; shots++; }
            if (ok >= need) { found = depth; break; }
            continue;
          }
          if (r?.rest) { const c = cupPoint(); next.push({ ...r, d: Math.hypot(r.x - c.x, r.y - c.y) }); }
        }
        if (found) break;
      }
      // keep the closest landing spots (not two in the same place)
      next.sort((a, b) => a.d - b.d);
      frontier = [];
      for (const n of next) { if (frontier.length >= beam) break; if (!frontier.some(f => Math.hypot(f.x - n.x, f.y - n.y) < 8)) frontier.push(n); }
      if (!frontier.length) break;
    }
    if (saved.level) { load(saved.level); } level = saved.level; t = saved.t; if (saved.ball) ball = saved.ball;
    return { strokes: found, shots, cup: c0 };
  }
  // par = what a steady player needs, plus one (checked against the hand-tested Classic and Deep Space pars)
  const parFrom = best => clamp(best + 1, 2, 6);

  // ---------- generated holes (Endless mode and the Daily hole) ----------
  const NAME_A = ['Lonely', 'Crooked', 'Frozen', 'Hungry', 'Silent', 'Burning', 'Tiny', 'Wobbly', 'Distant', 'Sneaky', 'Heavy', 'Lazy', 'Cosmic', 'Twisted', 'Dizzy', 'Forgotten'];
  const NAME_B = ['Orbit', 'Nebula', 'Crater', 'Drift', 'Comet', 'Pulsar', 'Rift', 'Moonrise', 'Gap', 'Belt', 'Void', 'Spiral', 'Harbor', 'Reach', 'Maze', 'Potato'];
  function makeHole(seed, level = 1) {
    const r = rng((Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ (seed >>> 13)) >>> 0), pick = a => a[Math.floor(r() * a.length)], rr = (a, b) => a + r() * (b - a);   // (seed mixed first, so neighbouring seeds differ)
    const b = [], fits = (x, y, rd, gap = 12) => x - rd > 8 && x + rd < W - 8 && y - rd > 8 && y + rd < H - 8 && b.every(o => Math.hypot(o.x - x, o.y - y) > o.r + rd + gap);
    const place = (k, x0, x1, r0, r1, gap) => { for (let i = 0; i < 40; i++) { const rd = Math.round(rr(r0, r1)), x = Math.round(rr(x0, x1)), y = Math.round(rr(20, H - 20)); if (fits(x, y, rd, gap)) { b.push({ k, x, y, r: rd }); return b.length - 1; } } return -1; };
    const teeI = place('home', 30, 70, 12, 17, 0);
    const cupKind = pick(level < 3 ? ['rock', 'rock', 'sand'] : ['rock', 'sand', 'ice', 'rock', 'bouncy']);
    const cupI = place(cupKind, 250, 292, 11, 17, 0);
    // the stuff in between gets busier as you go
    const n = Math.min(6, 1 + Math.floor(level / 2) + Math.floor(r() * 2));
    const pool = ['rock', 'rock', 'bouncy', 'repel', 'sand', 'ice', ...(level >= 2 ? ['sun', 'sun'] : []), ...(level >= 4 ? ['asteroids', 'sun'] : []), ...(level >= 6 ? ['blackhole'] : [])];
    for (let k = 0; k < n; k++) {
      const kind = pick(pool);
      if (kind === 'asteroids') { const cx = rr(110, 210); for (let j = 0; j < 6; j++) place('asteroid', cx - 14, cx + 14, 3, 5, 3); continue; }
      if (kind === 'blackhole') place('blackhole', 110, 210, 4, 6, 22); else place(kind, 100, 220, kind === 'sun' ? 10 : 11, kind === 'sun' ? 15 : 22, 10);
    }
    const lv = { name: `${pick(NAME_A)} ${pick(NAME_B)}`, par: 3, b, tee: { b: teeI, a: Math.round(rr(-80, -30)) }, hole: { b: cupI, a: Math.round(pick([rr(-160, -20), rr(-160, -20), rr(20, 160)])) } };
    if (level >= 3 && r() < .3) {   // a wormhole pair, somewhere empty
      const pts = [];
      for (let i = 0; i < 30 && pts.length < 2; i++) { const x = rr(70, 250), y = rr(20, H - 20); if (b.every(o => Math.hypot(o.x - x, o.y - y) > o.r + 14) && pts.every(p => Math.hypot(p[0] - x, p[1] - y) > 80)) pts.push([Math.round(x), Math.round(y)]); }
      if (pts.length === 2) lv.w = [[...pts[0], ...pts[1]]];
    }
    // the cup must not be buried in a neighbour
    const cb = b[cupI], ca = rad(lv.hole.a), cx = cb.x + Math.cos(ca) * (cb.r + 3), cy = cb.y + Math.sin(ca) * (cb.r + 3);
    if (b.some((o, i) => i !== cupI && Math.hypot(o.x - cx, o.y - cy) < o.r + 6)) return null;
    if (r() < .5) {   // sometimes it plays right-to-left: mirror the whole hole
      for (const o of b) o.x = W - o.x;
      lv.tee.a = 180 - lv.tee.a; lv.hole.a = 180 - lv.hole.a;
      for (const w of lv.w || []) { w[0] = W - w[0]; w[2] = W - w[2]; }
    }
    return lv;
  }
  // a hole that the solver has finished, with a par to match (tries seeds until one works)
  // (async: it takes a breath between tries so the screen keeps moving)
  const GEN = { angles: 40, powers: [.25, .4, .55, .7, .85, 1], maxDepth: 3, beam: 2, maxT: 6 };
  async function generate(seed, level) {
    for (let tries = 0; tries < 16; tries++) {
      const lv = makeHole((seed + tries * 7919) >>> 0, level);
      if (!lv) continue;
      await new Promise(r => setTimeout(r, 0));
      const res = solve(lv, GEN); state = 'gen';   // (nothing playable while building)
      if (res.strokes) { lv.par = parFrom(res.strokes); lv.solved = res.strokes; return lv; }
    }
    const fb = JSON.parse(JSON.stringify(GG.DEEP[seed % GG.DEEP.length]));   // (a fallback that's known to work)
    fb.name += ' (again)'; return fb;
  }
  GG.solve = solve; GG.generate = generate; GG.makeHole = makeHole;

  // ---------- fit the pixel canvas to the window (whole-number scaling when it fits) ----------
  function fit() {
    const box = $('stage').getBoundingClientRect(), s = Math.min(box.width / W, (box.height - 34) / H), si = Math.floor(s);   // (34px: the bar above)
    const scale = si >= 2 ? si : s;
    cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px';
  }
  addEventListener('resize', fit); fit();

  // for the level checker
  GG.sim = { load, step, get ball() { return ball; }, set ball(b) { ball = b; }, snapToRest, placeMoons, DT, VMAX, cupPoint, get bodies() { return bodies; } };
  GG.COURSES = COURSES;
  GG.test = { finish: (n, picked) => { strokes = n; finishHole(!!picked); }, get round() { return round; }, get state() { return state; }, get level() { return level; } };   // (for the automatic tests)
  title();
  requestAnimationFrame(frame);
})();
