'use strict';
// ============================================================
//  CRAZY DENTIST — zoomed-in single tooth minigames:
//  drill the decay, fill the hole, root canal maze
// ============================================================

const MZ = { cx: 126, ox: 58, oy: 26, w: 136, h: 104 };
const _mzCv = makeCanvas(MZ.w, MZ.h);
const _rgb = new Map();
const RGB = (hex) => {
  let v = _rgb.get(hex);
  if (!v) { v = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; _rgb.set(hex, v); }
  return v;
};

// background for the zoom view: dark mouth, neighbouring teeth, gum, lens ring
function drawMacroBack(t) {
  rect(0, 0, W, H, P.ddbrown);
  dellipse(126, 60, 120, 60, P.black);
  for (const s of [-1, 1]) {
    const nx = 126 + s * 118;
    ellipse(nx, 70, 34, 46, P.gray); ellipse(nx, 70, 32, 44, P.lgray); ellipse(nx - s * 4, 66, 26, 38, P.white);
  }
}
function drawMacroGum() {
  for (let x = 0; x < 252; x++) {
    const y = Math.round(118 + Math.cos((x - 126) / 30) * -5 + Math.abs(x - 126) * 0.05);
    rect(x, y, 1, H - y, P.salmon); rect(x, y, 1, 1, P.pink);
  }
  drect(0, 150, 252, 30, P.pink);
}
function drawLens() {
  ringE(126, 90, 150, 112, 16, P.black);
  ringE(126, 90, 136, 98, 2, P.slate);
  text('ZOOM X10', 8, 6, P.gray, 1, { ol: P.black });
}

// ---------- cell-based crown shared by drill & fill ----------
function crownTop(x) {
  const d = Math.abs(x - MZ.cx) / 52;
  return 38 + 5 * Math.cos(d * Math.PI) ** 2 + (d > 0.72 ? (d - 0.72) ** 2 * 190 : 0);
}
function buildCrown(gold) {
  const C = { cells: new Uint8Array(MZ.w * MZ.h), col: [], img: _mzCv.g.createImageData(MZ.w, MZ.h), dirty: true, gold };
  const inside = (x, y) => Math.abs(x - MZ.cx) <= 52 && y >= crownTop(x) && y < 128;
  for (let j = 0; j < MZ.h; j++) for (let i = 0; i < MZ.w; i++) {
    const x = i + MZ.ox, y = j + MZ.oy, k = j * MZ.w + i;
    if (!inside(x, y)) continue;
    C.cells[k] = 1;
    let c = P.white;
    if (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y - 1)) c = P.gray;
    else if (x > MZ.cx + 40 || !inside(x + 5, y)) c = P.lgray;
    else if (x < MZ.cx - 38 && y < 80) c = P.white;
    else if ((x + y) % 2 && y > 100) c = P.lgray;
    C.col[k] = c;
  }
  // decay blob at the biting surface
  const bx = MZ.cx + rand(-22, 22);
  const blobs = [];
  for (let n = 0; n < 4; n++) blobs.push([bx + rand(-12, 12), crownTop(bx) + rand(3, 12), rand(7, 11)]);
  for (let j = 0; j < MZ.h; j++) for (let i = 0; i < MZ.w; i++) {
    const k = j * MZ.w + i;
    if (C.cells[k] !== 1) continue;
    const x = i + MZ.ox, y = j + MZ.oy;
    if (blobs.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r)) { C.cells[k] = 2; C.col[k] = pick([P.dbrown, P.ddbrown, P.ddbrown, P.black, P.dgreen]); }
  }
  return C;
}
const CELL_HOLE = RGB(P.black), CELL_HOLE2 = RGB(P.ddbrown);
function flushCrown(C, t) {
  if (!C.dirty && !C.wet) return;
  const d = C.img.data;
  for (let k = 0; k < C.cells.length; k++) {
    const v = C.cells[k], o = k * 4;
    if (!v) { d[o + 3] = 0; continue; }
    let rgb;
    if (v === 1 || v === 2) rgb = RGB(C.col[k]);
    else if (v === 3) rgb = ((k % MZ.w) + ((k / MZ.w) | 0)) % 2 ? CELL_HOLE : CELL_HOLE2;
    else if (v === 4) rgb = RGB(C.gold ? (((k + Math.floor(t * 8)) % 5) ? P.gold : P.yellow) : (((k + Math.floor(t * 8)) % 5) ? P.lgray : P.white));
    else rgb = RGB(C.gold ? P.gold : P.cream);
    d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
  }
  _mzCv.g.putImageData(C.img, 0, 0);
  C.dirty = false;
}
function drawCrown(C, t) { flushCrown(C, t); ctx.drawImage(_mzCv, MZ.ox, MZ.oy); }
function cellAt(x, y) {
  const i = Math.floor(x) - MZ.ox, j = Math.floor(y) - MZ.oy;
  if (i < 0 || j < 0 || i >= MZ.w || j >= MZ.h) return -1;
  return j * MZ.w + i;
}

// ---------- DRILL ----------
function mgDrill(T) {
  const C = T.crown = buildCrown(T.patient.type === 'pirate');
  let total = 0; for (const v of C.cells) if (v === 2) total++;
  let left = total, damage = 0, painAcc = 0;
  const amp = (T.up.drill ? 0.5 : 1.7) + T.day * 0.08;
  let flinchT = rand(2, 4), warn = 0, jx = 0, jy = 0, lx = null, ly = null;
  const r = 3;
  const g = { kind: 'drill', title: 'DRILL THE CAVITY', hint: 'HOLD TO DRILL OUT ALL THE BROWN DECAY. SPARE THE WHITE ENAMEL!', tool: 'drill', time: 18, view: 'macro', done: false, quality: 1, t: 0 };
  g.pos = () => ({ x: input.x + Math.sin(g.t * 11) * amp + Math.sin(g.t * 17.3) * amp * 0.7 + jx, y: input.y + Math.cos(g.t * 13.1) * amp + jy });
  g.update = (dt) => {
    g.t += dt;
    flinchT -= dt;
    if (flinchT < 0.5 && !warn) { warn = 1; SND.sfx('blip'); }
    if (flinchT <= 0) {
      const a = rand(0, Math.PI * 2); jx = Math.cos(a) * 9; jy = Math.sin(a) * 9; warn = 0;
      flinchT = rand(2.5, 4.5) - Math.min(1.2, T.day * 0.12);
      if (input.down) floatText('FLINCH!', MZ.cx, 24, P.yellow);
    }
    jx *= Math.exp(-dt * 7); jy *= Math.exp(-dt * 7);
    const p = g.pos();
    if (input.down) {
      let touching = false;
      const fx = lx == null ? p.x : lx, fy = ly == null ? p.y : ly;
      segSamples(fx, fy, p.x, p.y, (sx, sy) => {
        for (let y = Math.floor(sy - r); y <= sy + r; y++) for (let x = Math.floor(sx - r); x <= sx + r; x++) {
          if ((x - sx) ** 2 + (y - sy) ** 2 > r * r) continue;
          const k = cellAt(x, y);
          if (k < 0) continue;
          const v = C.cells[k];
          if (v === 2) { C.cells[k] = 3; left--; touching = true; C.dirty = true; if (chance(0.15)) burst(x, y, 1, [P.dbrown, P.ddbrown], { spd: 50, up: 30 }); }
          else if (v === 1) { C.cells[k] = 3; damage++; painAcc += 0.25; touching = true; C.dirty = true; if (chance(0.3)) burst(x, y, 1, [P.white, P.lgray], { spd: 60, up: 30 }); }
        }
      });
      lx = p.x; ly = p.y;
      SND.drillOn(touching);
      if (painAcc >= 2) { T.hurt(painAcc); painAcc = 0; }
    } else { SND.drillOff(); lx = ly = null; }
    if (left <= total * 0.04) {
      for (let k = 0; k < C.cells.length; k++) if (C.cells[k] === 2) C.cells[k] = 3;
      C.dirty = true; SND.drillOff();
      g.done = true;
      g.quality = clamp(timedQuality(1 - damage / total * 0.9, g.t, 9, 0.02), 0.15, 1);
    }
  };
  g.timeout = () => {
    for (let k = 0; k < C.cells.length; k++) if (C.cells[k] === 2) C.cells[k] = 3;
    C.dirty = true; SND.drillOff();
    g.quality = clamp((1 - left / total) * 0.8 - damage / total * 0.6, 0.05, 1); g.done = true;
  };
  g.end = () => SND.drillOff();
  g.gadget = () => { for (let k = 0; k < C.cells.length; k++) if (C.cells[k] === 2) C.cells[k] = 3; left = 0; C.dirty = true; SND.drillOff(); };
  g.drawWorld = () => drawCrown(C, g.t);
  g.draw = () => {
    if (warn && Math.floor(g.t * 12) % 2) text('! PATIENT IS GOING TO FLINCH !', MZ.cx, 14, P.yellow, 1, { align: 'c', ol: P.black });
    text(`DECAY LEFT ${Math.round(left / total * 100)}%`, MZ.cx, 168, P.white, 1, { align: 'c', ol: P.black });
    if (damage > 0) text(`ENAMEL DAMAGE ${damage}`, MZ.cx, 160, damage > total * 0.3 ? P.red : P.gold, 1, { align: 'c', ol: P.black });
  };
  g.cursorPos = g.pos;
  return g;
}

// ---------- FILL ----------
function mgFill(T) {
  const C = T.crown;
  const holes = [];
  for (let k = 0; k < C.cells.length; k++) if (C.cells[k] === 3) holes.push(k);
  let hx = 0, hy = 999;
  for (const k of holes) { hx += k % MZ.w; hy = Math.min(hy, (k / MZ.w) | 0); }
  hx = hx / Math.max(1, holes.length) + MZ.ox; hy += MZ.oy;
  holes.sort((a, b) => ((b / MZ.w) | 0) - ((a / MZ.w) | 0) || Math.abs((a % MZ.w) + MZ.ox - hx) - Math.abs((b % MZ.w) + MZ.ox - hx));
  let filled = 0, over = 0, flow = 0, amt = 0, holdT = 0, cure = -1;
  const n = Math.max(1, holes.length);
  const gold = C.gold;
  const g = { kind: 'fill', title: gold ? 'GOLD FILLING' : 'FILL THE HOLE', hint: 'HOLD OVER THE HOLE TO SQUIRT. LET GO EARLY, IT KEEPS DRIPPING!', tool: 'gun', time: 14, view: 'macro', done: false, quality: 1, t: 0 };
  function finish() {
    if (cure >= 0) return;
    cure = 0; SND.sfx('uv'); flow = 0;
    for (const k of holes.slice(0, filled)) C.cells[k] = 5;
    C.dirty = true;
  }
  g.update = (dt) => {
    g.t += dt;
    if (cure >= 0) {
      cure += dt;
      if (cure > 0.9) {
        g.done = true;
        const f = filled / n, o = over / n;
        g.quality = clamp(f - Math.max(0, o - 0.03) * 1.8, 0.05, 1);
      }
      return;
    }
    const near = dist(input.x, input.y, hx, hy) < 32;
    if (input.down && near) { holdT += dt; flow = 30 + holdT * 110; SND.sfx('squirt'); }
    else { holdT = 0; flow *= Math.exp(-dt * 6); if (flow < 3) flow = 0; else SND.sfx('squirt'); }
    amt += flow * dt;
    while (amt >= 1) {
      amt -= 1;
      if (filled < holes.length) { C.cells[holes[filled++]] = 4; C.wet = true; } else over++;
    }
    if (!input.down && flow === 0 && filled >= holes.length * 0.97) finish();
  };
  g.timeout = () => finish();
  g.gadget = () => { while (filled < holes.length) C.cells[holes[filled++]] = 5; C.dirty = true; cure = 0; flow = 0; };
  g.drawWorld = () => {
    drawCrown(C, g.t);
    if (over > 0) {
      const rx = Math.min(30, Math.sqrt(over) * 1.4), ry = Math.max(1, rx * 0.45);
      ellipse(hx, hy - ry / 2, rx + 1, ry + 1, P.gray); ellipse(hx, hy - ry / 2, rx, ry, gold ? P.gold : P.lgray);
    }
    if (flow > 0 && cure < 0) {
      const tx = clamp(input.x, hx - 30, hx + 30);
      for (let y = Math.round(input.y); y < hy; y += 2) px(tx + Math.round(Math.sin(y + g.t * 20)), y, gold ? P.yellow : P.white);
    }
    if (cure >= 0) { G.globalAlpha = 0.35 * (1 - cure); rect(0, 0, 252, H, P.cyan); G.globalAlpha = 1; }
  };
  g.draw = () => {
    const f = Math.min(1, filled / n), o = over / n;
    UI.panel(MZ.cx - 42, 160, 84, 14, P.navy);
    rect(MZ.cx - 38, 165, 76, 4, P.slate);
    rect(MZ.cx - 38, 165, Math.round(76 * f), 4, f >= 0.97 ? P.green : P.sky);
    if (o > 0.03) rect(MZ.cx + 38 - Math.min(20, Math.round(o * 60)), 165, Math.min(20, Math.round(o * 60)), 4, P.red);
    text(o > 0.03 ? 'OVERFLOW!' : `FILL ${Math.round(f * 100)}%`, MZ.cx, 152, o > 0.03 ? P.red : P.white, 1, { align: 'c', ol: P.black });
    if (input.down && dist(input.x, input.y, hx, hy) >= 32 && cure < 0) text('AIM AT THE HOLE!', MZ.cx, 20, P.yellow, 1, { align: 'c', ol: P.black });
    if (cure >= 0) text('CURING...', MZ.cx, 20, P.cyan, 2, { align: 'c', ol: P.black });
  };
  return g;
}

// ---------- ROOT CANAL ----------
const _canalCv = makeCanvas(W, H);
function mgCanal(T) {
  const cx = 126, R = T.day >= 6 ? 3 : 4;
  const mask = new Uint8Array(W * H), tooth = new Uint8Array(W * H);
  const stamp = (arr, x, y, r, v) => {
    for (let j = Math.floor(y - r); j <= y + r; j++) for (let i = Math.floor(x - r); i <= x + r; i++)
      if (i >= 0 && j >= 0 && i < W && j < H && (i - x) ** 2 + (j - y) ** 2 <= r * r) arr[j * W + i] = v;
  };
  const paths = [-1, 1].map((s, idx) => {
    const sx = cx + s * 9, sy = 80, ex = cx + s * rand(28, 36), ey = 166;
    const ph = rand(0, 6.28), am = rand(4, 7), pts = [];
    const len = Math.ceil(ey - sy);
    for (let i = 0; i <= len; i++) {
      const k = i / len;
      pts.push({ x: lerp(sx, ex, k) + Math.sin(k * Math.PI * 2.2 + ph) * am * Math.sin(k * Math.PI), y: lerp(sy, ey, k) });
    }
    return { pts, prog: 0, done: false, idx };
  });
  // tooth body
  for (let j = 24; j < 112; j++) for (let i = cx - 54; i <= cx + 54; i++) {
    const d = (i - cx) / 54, top = 30 + 5 * Math.abs(Math.sin(d * Math.PI)) + Math.pow(Math.abs(d), 5) * 26;
    if (j >= top) tooth[j * W + i] = 1;
  }
  for (const p of paths) p.pts.forEach((q, i) => stamp(tooth, q.x, q.y, lerp(16, 7, i / p.pts.length), 1));
  // pulp chamber + canals
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (((i - cx) / 22) ** 2 + ((j - 70) / 12) ** 2 <= 1) mask[j * W + i] = 9;
  for (const p of paths) for (const q of p.pts) stamp(mask, q.x, q.y, R, p.idx + 1);
  // prerender
  _canalCv.g.clearRect(0, 0, W, H);
  withCtx(_canalCv.g, () => {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (!tooth[k]) {
        if ((i + 1 < W && tooth[k + 1]) || (i > 0 && tooth[k - 1]) || (j + 1 < H && tooth[k + W]) || (j > 0 && tooth[k - W])) px(i, j, P.black);
        continue;
      }
      let c = P.cream;
      const edge = !tooth[k + 3] || !tooth[k - 3] || !tooth[k - 3 * W];
      if (edge && j < 100) c = P.white;
      if (mask[k]) c = (i + j) % 2 ? P.dred : P.ddbrown;
      else if (mask[k + 1] || mask[k - 1] || mask[k + W] || mask[k - W]) c = P.tan;
      px(i, j, c);
    }
  });
  let armed = false, hits = 0, lx = 0, ly = 0;
  const g0 = { paths };
  const g = { ...g0, kind: 'canal', title: 'ROOT CANAL', hint: 'HOLD IN THE RED CANAL AND TRACE IT DOWN TO THE X. NO TOUCHING THE WALLS!', tool: 'file', time: 24, view: 'macro', done: false, quality: 1, t: 0 };
  g.update = (dt) => {
    g.t += dt;
    if (input.pressed) {
      const k = cellIdx(input.x, input.y);
      if (k >= 0 && mask[k]) { armed = true; lx = input.x; ly = input.y; SND.sfx('blip'); }
    }
    if (!input.down) armed = false;
    if (!armed) return;
    segSamples(lx, ly, input.x, input.y, (sx, sy) => {
      const k = cellIdx(sx, sy);
      const v = k >= 0 ? mask[k] : 0;
      if (!v) {
        armed = false; hits++; T.hurt(7); SND.sfx('buzz'); addShake(2); flash(P.red, 0.25);
        burst(sx, sy, 8, [P.yellow, P.white], { star: true, spd: 60, g: 0 });
        floatText('BZZT!', sx, sy - 8, P.yellow);
        return false;
      }
      for (const p of paths) {
        if (p.done || (v !== p.idx + 1 && v !== 9)) continue;
        for (let j = p.prog; j < Math.min(p.pts.length, p.prog + 10); j++) {
          if (dist(sx, sy, p.pts[j].x, p.pts[j].y) <= R + 1.5) p.prog = Math.max(p.prog, j);
        }
        if (p.prog >= p.pts.length - 3) {
          p.done = true; SND.sfx('good');
          const e = p.pts[p.pts.length - 1];
          burst(e.x, e.y, 14, [P.white, P.cyan, P.yellow], { star: true, spd: 70, g: 0 });
          floatText('CLEAN!', e.x, e.y - 10, P.green);
        }
      }
    });
    lx = input.x; ly = input.y;
    if (paths.every((p) => p.done)) { g.done = true; g.quality = clamp(timedQuality(1 - hits * 0.12, g.t, 12, 0.02), 0.15, 1); }
  };
  g.gadget = () => { armed = false; for (const p of paths) { p.prog = p.pts.length - 1; p.done = true; } };
  g.timeout = () => { const d = paths.filter((p) => p.done).length; g.quality = clamp(d * 0.3 - hits * 0.05, 0.05, 1); g.done = true; };
  g.drawWorld = () => {
    ctx.drawImage(_canalCv, 0, 0);
    for (const p of paths) {
      for (let i = 0; i <= p.prog; i += 2) { const q = p.pts[i]; circle(q.x, q.y, R - 1, P.white); }
      if (!p.done) {
        const e = p.pts[p.pts.length - 1], b = Math.floor(g.t * 5) % 2 ? P.yellow : P.red;
        line(e.x - 3, e.y - 3, e.x + 3, e.y + 3, b); line(e.x - 3, e.y + 3, e.x + 3, e.y - 3, b);
      }
    }
    if (paths.some((p) => p.prog > 0)) ellipse(cx, 70, 18, 8, P.white);
  };
  g.draw = () => {
    text(armed ? 'TRACING... STEADY!' : 'PRESS INSIDE THE RED CHAMBER TO START', MZ.cx, 12, armed ? P.green : P.white, 1, { align: 'c', ol: P.black });
    text(`CANALS ${paths.filter((p) => p.done).length}/2   WALL HITS ${hits}`, MZ.cx, 172, P.white, 1, { align: 'c', ol: P.black });
  };
  return g;
}
function cellIdx(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return -1;
  return y * W + x;
}
