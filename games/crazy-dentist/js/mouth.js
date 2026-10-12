'use strict';
// ============================================================
//  CRAZY DENTIST — the open mouth: teeth model, rendering,
//  and the mouth-view minigames (extract, clean, numb, braces)
// ============================================================

function buildMouth(L) {
  const shark = L.type === 'shark';
  const N = shark ? 8 : 6, tw = shark ? 15 : 20, gap = 2;
  const total = N * tw + (N - 1) * gap, x0 = Math.round(MOUTH.cx - total / 2);
  const teeth = [];
  for (const row of ['up', 'down']) for (let i = 0; i < N; i++) {
    const x = x0 + i * (tw + gap), xc = x + tw / 2;
    const k = Math.abs(i - (N - 1) / 2);
    const e = Math.sqrt(Math.max(0, 1 - ((xc - MOUTH.cx) / MOUTH.rx) ** 2));
    let h, y;
    if (row === 'up') { h = Math.round((shark ? 20 : 25) - k * 2.4); y = Math.round(MOUTH.cy - MOUTH.ry * e + 5); }
    else { h = Math.round((shark ? 17 : 20) - k * 1.8); y = Math.round(MOUTH.cy + MOUTH.ry * e - 5 - h); }
    teeth.push({ row, i, x, y, w: tw, h, state: 'ok', style: shark ? 'sharp' : 'normal', ox: 0, oy: 0, bracket: false, num: 0, loose: 0 });
  }
  if (L.type === 'vampire') for (const t of [teeth[1], teeth[N - 2]]) { t.style = 'fang'; t.h += 7; }
  if (L.type === 'pirate') teeth[N + randi(1, N - 2)].state = 'gold';
  return { teeth, N, stain: new Uint8Array(W * H), stainList: [], stainCol: [P.yellow, P.green] };
}

function inTooth(t, x, y, ignoreOff) {
  const lx = x - t.x - (ignoreOff ? 0 : t.ox), ly = y - t.y - (ignoreOff ? 0 : t.oy);
  if (lx < 0 || ly < 0 || lx >= t.w || ly >= t.h) return false;
  const cxl = t.w / 2 - 0.5;
  // distance from root (gum side) 0..h-1
  const d = t.row === 'up' ? ly : t.h - 1 - ly;
  if (t.style === 'sharp') return Math.abs(lx - cxl) <= (t.w / 2) * (1 - d / t.h) + 0.3;
  if (t.style === 'fang') { const tip = t.h - 9; if (d > tip) return Math.abs(lx - cxl) <= (t.w / 2) * (1 - (d - tip) / 9) + 0.3; }
  const r = 6, r2 = 2;
  if (d > t.h - 1 - r) {
    const cy = t.h - 1 - r;
    if (lx < r) return Math.hypot(lx - r, d - cy) <= r + 0.3;
    if (lx > t.w - 1 - r) return Math.hypot(lx - (t.w - 1 - r), d - cy) <= r + 0.3;
  }
  if (d < r2) {
    if (lx < r2) return Math.hypot(lx - r2, d - r2) <= r2 + 0.5;
    if (lx > t.w - 1 - r2) return Math.hypot(lx - (t.w - 1 - r2), d - r2) <= r2 + 0.5;
  }
  return true;
}
function toothAt(M, x, y) {
  for (const t of M.teeth) if (t.state !== 'missing' && inTooth(t, x, y)) return t;
  // a little forgiveness for fingers
  let best = null, bd = 5;
  for (const t of M.teeth) {
    if (t.state === 'missing') continue;
    const d = dist(x, y, clamp(x, t.x, t.x + t.w), clamp(y, t.y, t.y + t.h));
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
function mouthTop(x) { const e = Math.sqrt(Math.max(0, 1 - ((x - MOUTH.cx) / MOUTH.rx) ** 2)); return MOUTH.cy - MOUTH.ry * e; }
function mouthBot(x) { const e = Math.sqrt(Math.max(0, 1 - ((x - MOUTH.cx) / MOUTH.rx) ** 2)); return MOUTH.cy + MOUTH.ry * e; }
function inMouth(x, y) { return ((x - MOUTH.cx) / MOUTH.rx) ** 2 + ((y - MOUTH.cy) / MOUTH.ry) ** 2 <= 1; }
function isGum(M, x, y) {
  if (!inMouth(x, y)) return false;
  if (y > mouthTop(x) + 8 && y < mouthBot(x) - 8) return false;
  for (const t of M.teeth) if (t.state !== 'missing' && inTooth(t, x, y)) return false;
  return true;
}

const TOOTH_COLS = {
  ok: [P.white, P.lgray, P.gray],
  rotten: [P.dbrown, P.ddbrown, P.black],
  gold: [P.gold, P.orange, P.dbrown],
};
const _toothCache = new Map();
function toothSprite(t) {
  const key = [t.style, t.w, t.h, t.row, t.state].join(',');
  if (_toothCache.has(key)) return _toothCache.get(key);
  const c = makeCanvas(t.w, t.h), col = TOOTH_COLS[t.state] || TOOTH_COLS.ok;
  const probe = { ...t, x: 0, y: 0, ox: 0, oy: 0 };
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    if (!inTooth(probe, x, y)) continue;
    let cc = col[0];
    const edge = !inTooth(probe, x + 1, y) || !inTooth(probe, x - 1, y) || !inTooth(probe, x, y + 1) || !inTooth(probe, x, y - 1);
    if (edge) cc = col[2];
    else if (x >= t.w - 4 || !inTooth(probe, x, y + (t.row === 'up' ? 3 : -3))) cc = col[1];
    else if (t.state === 'ok' && x === 2 && y > 2 && y < t.h - 5) cc = P.white;
    if (t.state === 'rotten' && !edge && ((x * 7 + y * 13) % 11 === 0)) cc = (x + y) % 2 ? P.dgreen : P.black;
    if (t.state === 'gold' && !edge && x === 3) cc = P.yellow;
    c.g.fillStyle = cc; c.g.fillRect(x, y, 1, 1);
  }
  _toothCache.set(key, c);
  return c;
}

const _mc = makeCanvas(W, H), _mask = makeCanvas(W, H);
let _maskKey = '';
function drawMouth(M, open, o = {}) {
  const m = mouthShape(open);
  const key = m.rx + ',' + m.ry;
  if (key !== _maskKey) { _mask.g.clearRect(0, 0, W, H); withCtx(_mask.g, () => ellipse(m.cx, m.cy, m.rx, m.ry, '#000')); _maskKey = key; }
  const g = _mc.g;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  withCtx(g, () => {
    const { cx, cy } = MOUTH;
    ellipse(cx, cy, MOUTH.rx, MOUTH.ry, P.ddbrown);
    ellipse(cx, cy + 2, 50, 20, P.black);
    ellipse(cx, cy - 12, 4, 7, P.pink); ellipse(cx, cy - 10, 3, 5, P.salmon);
    // tongue
    ellipse(cx, cy + 22, 58, 19, P.dred);
    ellipse(cx - 2, cy + 20, 54, 16, P.red);
    dellipse(cx - 14, cy + 13, 20, 5, P.salmon);
    rect(cx, cy + 8, 1, 16, P.dred);
    // gums
    for (let x = cx - MOUTH.rx; x <= cx + MOUTH.rx; x++) {
      const t = Math.round(mouthTop(x)), b = Math.round(mouthBot(x));
      rect(x, t - 2, 1, 10, P.pink); rect(x, t - 2, 1, 3, P.salmon);
      rect(x, b - 8, 1, 10, P.pink); rect(x, b, 1, 2, P.salmon);
    }
    // teeth
    for (const t of M.teeth) {
      if (t.state === 'missing') {
        const sx = t.x + t.w / 2;
        if (t.row === 'up') ellipse(sx, t.y + 1, 6, 3, P.dred); else ellipse(sx, t.y + t.h - 2, 6, 3, P.dred);
        continue;
      }
      if (t.hidden) continue;
      G.drawImage(toothSprite(t), Math.round(t.x + t.ox), Math.round(t.y + t.oy));
      if (t.state === 'cavity') { const hy = t.row === 'up' ? t.y + t.h - 9 : t.y + 5; ellipse(t.x + t.w / 2, hy, 3, 2, P.ddbrown); px(t.x + t.w / 2 - 1, hy, P.black); }
    }
    // stains / plaque
    if (M.stainList.length) {
      const [c1, c2] = M.stainCol;
      for (const idx of M.stainList) {
        if (!M.stain[idx]) continue;
        const x = idx % W, y = (idx / W) | 0;
        G.fillStyle = (x + y) % 3 ? c1 : c2;
        G.fillRect(x, y, 1, 1);
      }
    }
    // braces
    for (const row of ['up', 'down']) {
      const br = M.teeth.filter((t) => t.row === row && t.bracket && t.state !== 'missing').sort((a, b) => a.x - b.x);
      const by = (t) => Math.round(t.row === 'up' ? t.y + t.h * 0.55 : t.y + t.h * 0.4);
      for (let i = 1; i < br.length; i++) line(br[i - 1].x + br[i - 1].w / 2, by(br[i - 1]), br[i].x + br[i].w / 2, by(br[i]), P.lgray);
      for (const t of br) { const bx = Math.round(t.x + t.w / 2 - 3); rect(bx, by(t) - 3, 6, 6, P.dgray); rect(bx + 1, by(t) - 2, 4, 4, P.lgray); px(bx + 1, by(t) - 2, P.white); }
    }
  });
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(_mask, 0, 0);
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(_mc, 0, 0);
}

// ---------- minigame helpers ----------
function segSamples(x0, y0, x1, y1, fn) {
  const n = Math.max(1, Math.ceil(dist(x0, y0, x1, y1)));
  for (let i = 1; i <= n; i++) if (fn(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n) === false) return;
}
function timedQuality(base, t, par, per = 0.02) { return base - Math.max(0, t - par) * per; }

// ---------- EXTRACTION ----------
function mgExtract(T, count) {
  const M = T.mouth;
  const pool = shuffle(M.teeth.filter((t) => t.state === 'ok' && t.style !== 'fang'));
  const targets = pool.slice(0, count);
  targets.forEach((t) => { t.state = 'rotten'; t.loose = 0; });
  const g = { kind: 'extract', title: 'EXTRACTION', hint: 'HOLD A ROTTEN TOOTH, WIGGLE LEFT-RIGHT, THEN PULL IT OUT', tool: 'pliers', time: 12 + count * 8, view: 'mouth', done: false, quality: 1, t: 0 };
  let grab = null, gx = 0, gy = 0, dir = 0, acc = 0, strain = 0, lastX = 0, snaps = 0;
  const loosen = T.up.pliers ? 0.12 : 0.075;
  function release() { if (grab) { grab.ox = 0; grab.oy = 0; } grab = null; strain = 0; }
  g.update = (dt) => {
    g.t += dt;
    if (input.pressed) {
      const tt = toothAt(M, input.x, input.y);
      if (tt && tt.state === 'rotten') { grab = tt; gx = input.x; gy = input.y; lastX = input.x; dir = 0; acc = 0; strain = 0; SND.sfx('clink'); }
      else if (tt) { T.hurt(4); SND.sfx('wrong'); floatText('THAT ONE IS HEALTHY!', input.x, input.y - 8, P.yellow); }
    }
    if (grab && input.down) {
      const dx = input.x - lastX; lastX = input.x;
      if (Math.abs(dx) > 0.05) {
        const d = Math.sign(dx);
        if (d !== dir) {
          if (Math.abs(acc) > 2.5 && grab.loose < 1) {
            grab.loose = Math.min(1, grab.loose + loosen); T.hurt(1.5); SND.sfx('creak');
            burst(grab.x + grab.w / 2, grab.row === 'up' ? grab.y + 2 : grab.y + grab.h - 2, 2, [P.salmon, P.white], { spd: 30 });
            if (grab.loose >= 1) floatText('LOOSE! PULL!', grab.x + grab.w / 2, grab.row === 'up' ? grab.y - 10 : grab.y + grab.h + 4, P.green);
          }
          dir = d; acc = 0;
        }
        acc += dx;
      }
      const sgn = grab.row === 'up' ? 1 : -1;
      const pull = sgn * (input.y - gy);
      grab.ox = clamp(Math.round((input.x - gx) / 2), -3, 3);
      grab.oy = sgn * clamp(Math.round(pull), 0, Math.round(1 + grab.loose * 7));
      if (pull > 13) {
        if (grab.loose >= 1) {
          const t = grab;
          t.state = 'missing'; t.ox = 0; t.oy = 0;
          T.flying.push({ spr: toothSprite({ ...t, state: 'rotten' }), x: t.x, y: t.y, vx: rand(-60, 60), vy: sgn * 40 - 110, r: 0, vr: rand(-8, 8) });
          burst(t.x + t.w / 2, t.y + t.h / 2, 14, [P.white, P.yellow, P.gold], { star: true, spd: 90 });
          floatText('POP!', t.x + t.w / 2, t.y - 4, P.yellow, { sc: 2 });
          SND.sfx('pop'); addShake(3); T.hurt(4);
          grab = null; strain = 0;
        } else {
          strain += dt;
          if (strain > 0.45) {
            snaps++; T.hurt(15); SND.sfx('snap'); addShake(4);
            floatText('SNAP! WIGGLE MORE!', grab.x + grab.w / 2, grab.y + grab.h / 2, P.red);
            grab.loose = Math.max(0, grab.loose - 0.2);
            release();
          }
        }
      } else strain = Math.max(0, strain - dt * 2);
    } else if (grab) release();
    if (targets.every((t) => t.state === 'missing')) {
      g.done = true;
      g.quality = clamp(timedQuality(1 - snaps * 0.18, g.t, count * 6), 0.2, 1);
    }
  };
  g.gadget = () => {
    release();
    for (const t of targets) if (t.state === 'rotten') {
      t.state = 'missing';
      T.flying.push({ spr: toothSprite({ ...t, state: 'rotten' }), x: t.x, y: t.y, vx: rand(-120, 120), vy: rand(-280, -170), r: 0, vr: rand(-14, 14) });
    }
  };
  g.timeout = () => {
    for (const t of targets) if (t.state === 'rotten') { t.state = 'missing'; T.hurt(20); }
    release(); g.quality = 0.25; g.done = true;
  };
  g.draw = () => {
    for (const t of targets) {
      if (t.state !== 'rotten') continue;
      const bx = t.x, by = t.row === 'up' ? t.y + t.h + 3 : t.y - 6;
      rect(bx - 1, by - 1, t.w + 2, 5, P.black);
      rect(bx, by, t.w, 3, P.slate);
      rect(bx, by, Math.round(t.w * t.loose), 3, t.loose >= 1 ? P.green : P.gold);
      if (grab === t && strain > 0.05 && Math.floor(g.t * 16) % 2) text('!!', t.x + t.w / 2, by + (t.row === 'up' ? 6 : -8), P.red, 1, { align: 'c', ol: P.black });
      for (let k = 0; k < 2; k++) { // stink lines
        const ph = (g.t * 0.8 + k * 0.5) % 1, sx = t.x + 5 + k * 9, sy = (t.row === 'up' ? t.y + t.h + 8 : t.y - 10) - ph * 10 * (t.row === 'up' ? -1 : 1);
        if (t.row === 'down') px(sx + Math.round(Math.sin(ph * 9) * 2), sy, P.green);
      }
    }
  };
  return g;
}

// ---------- CLEANING ----------
const STAIN_KIND = {
  plaque: { cols: [P.yellow, P.green], title: 'CLEANING', hint: 'SCRUB OFF ALL THE GUNK. AVOID THE GUMS!' },
  blood: { cols: [P.red, P.dred], title: 'FANG POLISH', hint: 'SCRUB THE BLOOD STAINS OFF THE FANGS. AVOID THE GUMS!' },
  coffee: { cols: [P.brown, P.dbrown], title: 'CLEANING', hint: '60 YEARS OF COFFEE STAINS. SCRUB! AVOID THE GUMS!' },
};
function mgClean(T, kind) {
  const M = T.mouth, K = STAIN_KIND[kind];
  M.stain.fill(0); M.stainList = []; M.stainCol = K.cols;
  const cand = shuffle(M.teeth.filter((t) => t.state === 'ok' || t.state === 'gold'));
  if (kind === 'blood') cand.sort((a, b) => (b.style === 'fang') - (a.style === 'fang'));
  const chosen = cand.slice(0, Math.min(cand.length, randi(5, 8)));
  const per = new Map();
  for (const t of chosen) {
    let n = 0;
    for (let b = 0; b < randi(2, 3); b++) {
      const bx = t.x + rand(2, t.w - 2), by = t.y + rand(2, t.h - 2), r = rand(3, 6);
      for (let y = Math.floor(by - r); y <= by + r; y++) for (let x = Math.floor(bx - r); x <= bx + r; x++) {
        if ((x - bx) ** 2 + (y - by) ** 2 > r * r || !inTooth(t, x, y)) continue;
        const idx = y * W + x;
        if (!M.stain[idx]) { M.stain[idx] = 1; M.stainList.push(idx); n++; }
      }
    }
    per.set(t, n);
  }
  const total = M.stainList.length;
  let left = total, gumAcc = 0, gumHits = 0;
  const r = T.up.brush ? 6 : 4;
  const g = { kind: 'clean', title: K.title, hint: K.hint, tool: 'brush', time: 15 + chosen.length, view: 'mouth', done: false, quality: 1, t: 0 };
  g.update = (dt) => {
    g.t += dt;
    if (!input.down) return;
    let removed = 0;
    segSamples(input.px, input.py, input.x, input.y, (sx, sy) => {
      for (let y = Math.floor(sy - r); y <= sy + r; y++) for (let x = Math.floor(sx - r); x <= sx + r; x++) {
        if ((x - sx) ** 2 + (y - sy) ** 2 > r * r || x < 0 || y < 0 || x >= W || y >= H) continue;
        const idx = y * W + x;
        if (M.stain[idx]) { M.stain[idx] = 0; removed++; left--; }
      }
      if (isGum(M, sx, sy)) gumAcc += 1;
    });
    if (removed) {
      SND.sfx('scrub');
      if (chance(0.5)) burst(input.x, input.y, 1, [P.white, P.cyan], { spd: 25, g: -10, life: 0.5 });
      for (const [t, n] of per) {
        if (n <= 0) continue;
        let c = 0;
        for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) if (M.stain[y * W + x]) c++;
        if (c === 0) { per.set(t, 0); burst(t.x + t.w / 2, t.y + t.h / 2, 8, [P.white, P.yellow, P.cyan], { star: true, spd: 50, g: 0 }); SND.sfx('sparkle'); }
      }
    }
    if (gumAcc > 7) { gumAcc = 0; gumHits++; T.hurt(3); floatText('OW! GUMS!', input.x, input.y - 10, P.red); }
    if (left <= total * 0.03) {
      for (const idx of M.stainList) M.stain[idx] = 0;
      g.done = true;
      g.quality = clamp(timedQuality(1 - gumHits * 0.05, g.t, 9, 0.015), 0.2, 1);
    }
  };
  g.gadget = () => {
    for (const idx of M.stainList) M.stain[idx] = 0;
    left = 0;
    for (const t of chosen) burst(t.x + t.w / 2, t.y + t.h / 2, 5, [P.white, P.yellow, P.cyan], { star: true, spd: 50, g: 0 });
  };
  g.timeout = () => { g.quality = clamp((1 - left / total) * 0.85 - gumHits * 0.05, 0.1, 1); g.done = true; };
  g.draw = () => {
    const pct = Math.round((1 - left / total) * 100);
    text(`CLEAN ${pct}%`, MOUTH.cx, 172, P.white, 1, { align: 'c', ol: P.black });
  };
  return g;
}

// ---------- NUMBING SHOT ----------
function mgNumb(T) {
  const x0 = 46, w = 160, y = 168;
  const zw = clamp(22 - T.day, 12, 22), zx = x0 + randi(16, w - zw - 16);
  let pos = x0, dir = 1, fired = false, wait = 0;
  const speed = 110 + T.day * 12;
  const g = { kind: 'numb', title: 'NUMBING SHOT', hint: 'CLICK WHEN THE NEEDLE IS IN THE GREEN ZONE', tool: 'syringe', time: 0, view: 'mouth', done: false, quality: 1, t: 0, noScore: true };
  g.update = (dt) => {
    g.t += dt;
    if (!fired) {
      pos += dir * speed * dt;
      if (pos > x0 + w) { pos = x0 + w; dir = -1; } else if (pos < x0) { pos = x0; dir = 1; }
      if (input.pressed || input.key(' ') || input.key('Enter')) {
        fired = true;
        if (pos >= zx && pos <= zx + zw) {
          T.numb = true; SND.sfx('inject'); setTimeout(() => SND.sfx('numb'), 150);
          floatText('NUMB! PAIN HALVED', MOUTH.cx, 80, P.cyan, { dur: 1.4 });
          burst(pos, MOUTH.cy - 30, 16, [P.cyan, P.white], { star: true, spd: 60, g: 20 });
        } else {
          T.hurt(18); SND.sfx('ouch'); addShake(3);
          floatText('MISSED! OUCH!', MOUTH.cx, 80, P.red, { dur: 1.2 });
        }
      }
    } else if ((wait += dt) > 1) g.done = true;
  };
  g.draw = () => {
    UI.panel(x0 - 4, y - 5, w + 8, 12, P.navy);
    rect(x0, y - 1, w, 4, P.slate);
    rect(zx, y - 1, zw, 4, P.green); rect(zx + Math.floor(zw / 2) - 1, y - 1, 2, 4, P.yellow);
    const p = Math.round(pos);
    tri(p - 3, y - 8, p + 3, y - 8, p, y - 2, P.white);
    rect(p, y - 2, 1, 6, P.white);
  };
  return g;
}

// ---------- BRACES ----------
function mgBraces(T) {
  const M = T.mouth;
  const avail = shuffle(M.teeth.filter((t) => t.state !== 'missing'));
  const K = Math.min(8, avail.length);
  avail.slice(0, K).forEach((t, i) => { t.num = i + 1; });
  let next = 1, mistakes = 0;
  const g = { kind: 'braces', title: 'BRACES', hint: 'CLICK THE TEETH IN NUMBER ORDER: 1, 2, 3...', tool: 'tweezers', time: 15, view: 'mouth', done: false, quality: 1, t: 0 };
  g.update = (dt) => {
    g.t += dt;
    if (!input.pressed) return;
    const tt = toothAt(M, input.x, input.y);
    if (!tt) return;
    if (tt.num === next) {
      tt.bracket = true; next++; SND.sfx('clink');
      burst(tt.x + tt.w / 2, tt.y + tt.h / 2, 5, [P.lgray, P.white], { spd: 40, g: 0 });
      if (next > K) { g.done = true; g.quality = clamp(timedQuality(1 - mistakes * 0.1, g.t, 7, 0.04), 0.2, 1); }
    } else if (!tt.bracket) {
      mistakes++; T.hurt(5); SND.sfx('wrong');
      floatText(`FIND ${next}!`, input.x, input.y - 8, P.yellow);
    }
  };
  g.gadget = () => { for (const t of M.teeth) if (t.num && !t.bracket) t.bracket = true; next = K + 1; };
  g.timeout = () => { g.quality = clamp(((next - 1) / K) * 0.6 - mistakes * 0.05, 0.1, 1); g.done = true; };
  g.draw = () => {
    for (const t of M.teeth) {
      if (!t.num || t.bracket) continue;
      const cx = Math.round(t.x + t.w / 2), cy = Math.round(t.y + t.h / 2);
      const hot = t.num === next && Math.floor(g.t * 6) % 2;
      circle(cx, cy, 5, P.black); circle(cx, cy, 4, hot ? P.yellow : P.sky);
      text(t.num, cx + 1, cy - 2, P.black, 1, { align: 'c' });
    }
  };
  return g;
}
