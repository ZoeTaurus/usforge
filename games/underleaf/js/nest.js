'use strict';
/* The nest seen in cross-section: tunnels, chambers, the queen and her brood. */

const NEST_W = 1000, NEST_H = 720, SURFACE = 110;
const NEST_NODES = {
  E: [500, 104], A: [500, 190], A2: [330, 215], A3: [670, 215],
  barracks: [215, 250], infirmary: [790, 240], special: [500, 310],
  C: [500, 410], N1: [380, 440], G1: [630, 425],
  nursery: [250, 455], granary: [760, 445], royal: [500, 600],
  midden: [160, 152], G2: [775, 540], winter: [790, 628],
};
const NEST_EDGES = [['E', 'A'], ['A', 'A2'], ['A2', 'barracks'], ['A', 'A3'], ['A3', 'infirmary'], ['A', 'special'], ['special', 'C'], ['C', 'N1'], ['N1', 'nursery'], ['C', 'G1'], ['G1', 'granary'], ['C', 'royal'], ['A2', 'midden'], ['granary', 'G2'], ['G2', 'winter']];
const NEST_ROOMS = {
  special: { rx: 108, ry: 46 }, barracks: { rx: 100, ry: 44 }, infirmary: { rx: 96, ry: 42 },
  nursery: { rx: 124, ry: 54 }, granary: { rx: 124, ry: 56 }, royal: { rx: 134, ry: 60 },
  midden: { rx: 92, ry: 30 }, winter: { rx: 118, ry: 44 },
};

/* An irregular, hand-dug outline instead of a perfect ellipse. */
function blobPath(ctx, x, y, rx, ry, seed, k = 1) {
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * TAU;
    const n = 1 + (vnoise(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6, 7) - 0.5) * 0.16;
    const flat = Math.sin(a) > 0.55 ? 0.92 : 1;
    const px = x + Math.cos(a) * rx * n * k, py = y + Math.sin(a) * ry * n * k * flat;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/* Tunnels wobble a little, like they were chewed out grain by grain. */
const TUNNEL_PTS = NEST_EDGES.map(([a, b], ei) => {
  const [x0, y0] = NEST_NODES[a], [x1, y1] = NEST_NODES[b];
  const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10, j = i === 0 || i === 10 ? 0 : (vnoise(f * 3 + ei * 5, ei, 3) - 0.5) * 16;
    pts.push([lerp(x0, x1, f) + (nx / nl) * j, lerp(y0, y1, f) + (ny / nl) * j]);
  }
  return pts;
});

function nestPath(adj, from, to) {
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const n = q.shift();
    if (n === to) break;
    for (const m of adj[n] || []) if (!(m in prev)) { prev[m] = n; q.push(m); }
  }
  if (!(to in prev)) return null;
  const path = [];
  for (let n = to; n !== null; n = prev[n]) path.unshift(n);
  return path;
}

class NestView {
  constructor(game) {
    this.game = game;
    this.bg = null; this.bgKey = '';
    this.agents = [];
    this.hover = null;
    this.selected = 'royal';
    this.adj = {};
    for (const [a, b] of NEST_EDGES) { (this.adj[a] ||= []).push(b); (this.adj[b] ||= []).push(a); }
    this.couriers = [];
    this.nurseT = 2;
    this.motes = [];
    for (let i = 0; i < 40; i++) this.motes.push({ x: rand(NEST_W), y: rand(SURFACE, NEST_H), v: rand(3, 9), p: rand(TAU) });
  }

  /* A worker carrying something along the tunnels from one chamber to another. */
  sendCourier(from, to, carry) {
    if (this.couriers.length > 10) return;
    const path = nestPath(this.adj, from, to);
    if (!path || path.length < 2) return;
    this.couriers.push({ path, i: 0, t: 0, carry, id: UID++, gait: 0, x: NEST_NODES[from][0], y: NEST_NODES[from][1], a: 0, speed: rand(55, 75) });
  }

  roomKey(k) { return k === 'special' ? this.game.home.special : k; }
  roomOpen(k) { return this.game.home.chambers[this.roomKey(k)] > 0; }

  layout() {
    const g = this.game;
    const side = g.vw > 760 ? 310 : 0, bottom = side ? 0 : g.vh * 0.42;
    const top = side ? 0 : 150;
    const s = Math.min((g.vw - side - 20) / NEST_W, (g.vh - bottom - top - 20) / NEST_H);
    const ox = (g.vw - side - NEST_W * s) / 2, oy = top + (g.vh - bottom - top - NEST_H * s) / 2;
    return { s, ox, oy };
  }

  toNest(px, py) {
    const { s, ox, oy } = this.layout();
    return [(px - ox) / s, (py - oy) / s];
  }

  hit(px, py) {
    const [x, y] = this.toNest(px, py);
    for (const k in NEST_ROOMS) {
      const [cx, cy] = NEST_NODES[k], r = NEST_ROOMS[k];
      if (((x - cx) / r.rx) ** 2 + ((y - cy) / r.ry) ** 2 < 1.15) return k;
    }
    return null;
  }

  spawnAgents() {
    const n = clamp(Math.round(this.game.counts.home / 2), 6, 28);
    while (this.agents.length < n) {
      const open = NEST_EDGES.filter(([a, b]) => (!NEST_ROOMS[a] || this.roomOpen(a)) && (!NEST_ROOMS[b] || this.roomOpen(b)));
      const e = pick(open);
      this.agents.push({ from: e[0], to: e[1], t: Math.random(), speed: rand(40, 70), wait: 0, id: UID++, carry: Math.random() < 0.3 ? pick(['egg', 'crumb']) : null, gait: 0, a: 0, x: 0, y: 0 });
    }
    this.agents.length = n;
  }

  update(dt) {
    this.spawnAgents();
    const home = this.game.home;
    this.nurseT -= dt;
    if (this.nurseT <= 0) {
      this.nurseT = rand(2.5, 5);
      if (home.brood.length) this.sendCourier('royal', 'nursery', 'egg');
      else if (Math.random() < 0.4) this.sendCourier('granary', 'royal', 'crumb');
      if (home.chambers.midden && Math.random() < 0.3) this.sendCourier('nursery', 'midden', 'husk');
    }
    for (const c of this.couriers) {
      const a = NEST_NODES[c.path[c.i]], b = NEST_NODES[c.path[c.i + 1]];
      const len = dist(a[0], a[1], b[0], b[1]) || 1;
      c.t += (c.speed * dt) / len; c.gait += c.speed * dt * 0.3;
      if (c.t >= 1) { c.t = 0; c.i++; if (c.i >= c.path.length - 1) { c.done = true; continue; } }
      const p0 = NEST_NODES[c.path[c.i]], p1 = NEST_NODES[c.path[c.i + 1]];
      c.x = lerp(p0[0], p1[0], c.t); c.y = lerp(p0[1], p1[1], c.t); c.a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    }
    this.couriers = this.couriers.filter((c) => !c.done);
    for (const m of this.motes) { m.y -= m.v * dt; m.x += Math.sin(this.game.time * 0.5 + m.p) * 4 * dt; if (m.y < SURFACE) { m.y = NEST_H; m.x = rand(NEST_W); } }
    for (const ag of this.agents) {
      const a = NEST_NODES[ag.from], b = NEST_NODES[ag.to];
      if (ag.wait > 0) {
        ag.wait -= dt;
        ag.gait += dt * 2;
        ag.a += Math.sin(this.game.time * 2 + ag.id) * dt;
        continue;
      }
      const len = dist(a[0], a[1], b[0], b[1]);
      ag.t += (ag.speed * dt) / len;
      ag.gait += ag.speed * dt * 0.3;
      if (ag.t >= 1) {
        const opts = this.adj[ag.to].filter((n) => n !== ag.from && (!NEST_ROOMS[n] || this.roomOpen(n)));
        const next = opts.length ? pick(opts) : ag.from;
        if (NEST_ROOMS[ag.to]) ag.wait = rand(1, 3.5);
        ag.from = ag.to; ag.to = next; ag.t = 0;
        if (NEST_ROOMS[ag.from] && Math.random() < 0.4) ag.carry = ag.from === 'granary' ? 'crumb' : ag.from === 'nursery' || ag.from === 'royal' ? 'egg' : null;
      }
      const p0 = NEST_NODES[ag.from], p1 = NEST_NODES[ag.to];
      ag.x = lerp(p0[0], p1[0], ag.t); ag.y = lerp(p0[1], p1[1], ag.t);
      ag.a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    }
  }

  buildBg(s) {
    const g = this.game;
    const key = `${s.toFixed(4)}:${g.home.species}`;
    if (this.bg && this.bgKey === key) return;
    this.bgKey = key;
    const c = document.createElement('canvas');
    c.width = Math.ceil(NEST_W * s * g.dpr); c.height = Math.ceil(NEST_H * s * g.dpr);
    const x = c.getContext('2d');
    x.scale(s * g.dpr, s * g.dpr);
    const R = mulberry32(42);

    // 1. soil horizons: humus topsoil, red clay subsoil, sandy parent soil, grey clay at depth
    const HZ = [
      { d: 0, c: [62, 42, 26] },
      { d: 70, c: [92, 60, 36] },
      { d: 150, c: [128, 82, 46] },
      { d: 300, c: [156, 116, 72] },
      { d: 470, c: [112, 92, 70] },
      { d: 700, c: [86, 72, 58] },
    ];
    const soilAt = (X, Y) => {
      const wav = (fbm(X / 170, Y / 400, 11, 2) - 0.5) * 60;
      const d = Y - SURFACE + wav;
      let i = 0;
      while (i < HZ.length - 2 && d > HZ[i + 1].d) i++;
      const a = HZ[i], b = HZ[i + 1];
      const k = smoothstep(a.d, b.d, d);
      const n = fbm(X / 70, Y / 70, 3, 3), n2 = vnoise(X / 9, Y / 9, 9);
      const sh = 0.82 + n * 0.32 + (n2 - 0.5) * 0.1;
      return [lerp(a.c[0], b.c[0], k) * sh, lerp(a.c[1], b.c[1], k) * sh, lerp(a.c[2], b.c[2], k) * sh];
    };
    const LW = 334, LH = 240, sx = NEST_W / LW, sy = NEST_H / LH;
    const lc = document.createElement('canvas'); lc.width = LW; lc.height = LH;
    const lctx = lc.getContext('2d'), img = lctx.createImageData(LW, LH);
    for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) {
      const col = soilAt(i * sx, j * sy), k = (j * LW + i) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    lctx.putImageData(img, 0, 0);
    x.imageSmoothingEnabled = true;
    x.save(); x.beginPath(); x.rect(0, SURFACE - 4, NEST_W, NEST_H); x.clip();
    x.drawImage(lc, 0, 0, NEST_W, NEST_H);

    // 2. fine grain: sand, crumbs and tiny flecks of mica
    for (let i = 0; i < 16000; i++) {
      const px = R() * NEST_W, py = SURFACE + R() * (NEST_H - SURFACE);
      const r = R();
      x.fillStyle = r < 0.45 ? 'rgba(25,15,6,0.35)' : r < 0.9 ? 'rgba(220,180,130,0.22)' : 'rgba(255,250,235,0.5)';
      x.fillRect(px, py, 0.6 + R() * 1.1, 0.6 + R() * 1.1);
    }
    // soft crumb clumps in the topsoil
    for (let i = 0; i < 260; i++) {
      const px = R() * NEST_W, py = SURFACE + 6 + Math.pow(R(), 2) * 120, r = 2 + R() * 5;
      radialFill(x, px, py, r, [[0, 'rgba(30,18,8,0.35)'], [1, 'rgba(30,18,8,0)']]);
    }
    // a gravel band between the subsoil and the sandy layer
    for (let i = 0; i < 420; i++) {
      const px = R() * NEST_W, py = SURFACE + 290 + (fbm(px / 170, 0.7, 11, 2) - 0.5) * 60 + (R() - 0.5) * 40, r = 1.2 + R() * 2.4;
      const gr = x.createRadialGradient(px - r * 0.3, py - r * 0.4, 0.2, px, py, r);
      gr.addColorStop(0, '#d8c8a8'); gr.addColorStop(1, '#6a5a44');
      x.fillStyle = gr; x.beginPath(); x.ellipse(px, py, r * 1.2, r, R() * 3, 0, TAU); x.fill();
    }

    // 3. worm burrows: old backfilled tunnels, slightly darker with a pale lining
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (let i = 0; i < 5; i++) {
      let px = R() * NEST_W, py = SURFACE + 60 + R() * 420, a = R() * TAU;
      const pts = [[px, py]];
      for (let k = 0; k < 14; k++) { a += (R() - 0.5) * 0.8; px += Math.cos(a) * 14; py += Math.sin(a) * 14; pts.push([px, py]); }
      for (const [w, col] of [[7, 'rgba(40,24,12,0.35)'], [4, 'rgba(70,46,26,0.5)'], [1, 'rgba(210,170,120,0.2)']]) {
        x.strokeStyle = col; x.lineWidth = w;
        x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const q of pts) x.lineTo(q[0], q[1]); x.stroke();
      }
    }

    // 4. stones, partly buried, lit from above
    const stones = [];
    for (let i = 0; i < 38; i++) {
      const depth = Math.pow(R(), 0.8);
      stones.push([R() * NEST_W, SURFACE + 30 + depth * (NEST_H - SURFACE - 40), 4 + R() * 9 + depth * 12]);
    }
    for (const [px, py, r] of stones) {
      if (Object.keys(NEST_ROOMS).some((k) => ((px - NEST_NODES[k][0]) / (NEST_ROOMS[k].rx + r)) ** 2 + ((py - NEST_NODES[k][1]) / (NEST_ROOMS[k].ry + r)) ** 2 < 1.1)) continue;
      const pts = polyPts(R, px, py, r, 9, 1.25, 0.85);
      x.save(); x.translate(r * 0.15, r * 0.3); smoothPoly(x, pts); x.fillStyle = 'rgba(25,14,4,0.45)'; x.fill(); x.restore();
      const base = ['#9a8e7e', '#8a7a64', '#a89a80', '#7a7268', '#b0946a'][(R() * 5) | 0];
      const gr = x.createLinearGradient(px, py - r, px, py + r);
      gr.addColorStop(0, shade(base, 0.35)); gr.addColorStop(0.5, base); gr.addColorStop(1, shade(base, -0.45));
      smoothPoly(x, pts); x.fillStyle = gr; x.fill();
      x.save(); smoothPoly(x, pts); x.clip();
      for (let k = 0; k < r * 2; k++) { x.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'; x.fillRect(px + (R() - 0.5) * r * 2, py + (R() - 0.5) * r * 1.6, 1, 1); }
      x.restore();
      x.strokeStyle = 'rgba(255,245,225,0.3)'; x.lineWidth = 1;
      x.beginPath(); x.ellipse(px, py, r * 1.05, r * 0.72, 0, Math.PI * 1.15, Math.PI * 1.75); x.stroke();
    }

    // 5. buried odds and ends
    for (let i = 0; i < 3; i++) {
      const px = 60 + R() * (NEST_W - 120), py = SURFACE + 30 + R() * 90;
      x.save(); x.translate(px, py); x.rotate(R() * 3); x.scale(1.4, 1.4);
      propAcorn(x, { x: 0, y: 0, rot: 0 });
      x.restore();
    }
    for (let i = 0; i < 2; i++) {
      const px = 80 + R() * (NEST_W - 160), py = SURFACE + 200 + R() * 300;
      x.save(); x.translate(px, py); x.rotate(R() * 3);
      x.fillStyle = 'rgba(230,220,200,0.75)';
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 7, 0.4, 3.4); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(120,100,80,0.6)'; x.lineWidth = 0.6;
      for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(0.4 + k * 0.7) * 7, Math.sin(0.4 + k * 0.7) * 7); x.stroke(); }
      x.restore();
    }
    // white fungal threads in the topsoil
    for (let i = 0; i < 4; i++) {
      const cx = R() * NEST_W, cy = SURFACE + 25 + R() * 70;
      x.strokeStyle = 'rgba(240,235,220,0.28)'; x.lineWidth = 0.5;
      for (let k = 0; k < 26; k++) {
        let px = cx, py = cy, a = R() * TAU;
        x.beginPath(); x.moveTo(px, py);
        for (let m = 0; m < 5; m++) { a += (R() - 0.5) * 1.2; px += Math.cos(a) * 7; py += Math.sin(a) * 5; x.lineTo(px, py); }
        x.stroke();
      }
    }

    // 6. roots: thick at the surface, tapering and branching, with fine root hairs
    const root = (px, py, a, w, len, depth) => {
      const pts = [[px, py]];
      for (let k = 0; k < len; k++) {
        a += (R() - 0.5) * 0.5 + (Math.PI / 2 - a) * 0.08;
        px += Math.cos(a) * 12; py += Math.sin(a) * 12;
        pts.push([px, py]);
        if (depth < 2 && R() < 0.16) root(px, py, a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), w * 0.55, (len - k) * 0.6 | 0, depth + 1);
      }
      for (let k = 0; k < pts.length - 1; k++) {
        const f = 1 - k / pts.length, ww = Math.max(0.6, w * f);
        x.strokeStyle = 'rgba(20,10,4,0.35)'; x.lineWidth = ww + 1.6;
        x.beginPath(); x.moveTo(pts[k][0] + 1, pts[k][1] + 1); x.lineTo(pts[k + 1][0] + 1, pts[k + 1][1] + 1); x.stroke();
        x.strokeStyle = '#4a3020'; x.lineWidth = ww;
        x.beginPath(); x.moveTo(pts[k][0], pts[k][1]); x.lineTo(pts[k + 1][0], pts[k + 1][1]); x.stroke();
        x.strokeStyle = 'rgba(200,160,110,0.35)'; x.lineWidth = ww * 0.3;
        x.beginPath(); x.moveTo(pts[k][0] - ww * 0.25, pts[k][1]); x.lineTo(pts[k + 1][0] - ww * 0.25, pts[k + 1][1]); x.stroke();
        if (R() < 0.6) {
          x.strokeStyle = 'rgba(210,180,140,0.3)'; x.lineWidth = 0.4;
          const ha = R() * TAU;
          x.beginPath(); x.moveTo(pts[k][0], pts[k][1]); x.lineTo(pts[k][0] + Math.cos(ha) * 5, pts[k][1] + Math.sin(ha) * 5); x.stroke();
        }
      }
    };
    for (let i = 0; i < 7; i++) {
      const px = 40 + (i / 6) * (NEST_W - 80) + (R() - 0.5) * 60;
      if (Math.abs(px - 500) < 50) continue;
      root(px, SURFACE, Math.PI / 2 + (R() - 0.5) * 0.6, 5 + R() * 4, 10 + ((R() * 10) | 0), 0);
    }
    // grass roots: a fine dense mat just under the turf
    for (let i = 0; i < 500; i++) {
      const px = R() * NEST_W, l = 6 + R() * 22;
      x.strokeStyle = R() < 0.5 ? 'rgba(200,170,120,0.25)' : 'rgba(30,18,8,0.3)'; x.lineWidth = 0.5;
      x.beginPath(); x.moveTo(px, SURFACE); x.quadraticCurveTo(px + (R() - 0.5) * 6, SURFACE + l * 0.5, px + (R() - 0.5) * 8, SURFACE + l); x.stroke();
    }

    // 7. depth: it gets darker and cooler further down, and darker at the edges
    const deep = x.createLinearGradient(0, SURFACE, 0, NEST_H);
    deep.addColorStop(0, 'rgba(0,0,0,0)'); deep.addColorStop(0.5, 'rgba(10,6,2,0.12)'); deep.addColorStop(1, 'rgba(8,6,8,0.45)');
    x.fillStyle = deep; x.fillRect(0, SURFACE, NEST_W, NEST_H - SURFACE);
    const side = x.createLinearGradient(0, 0, NEST_W, 0);
    side.addColorStop(0, 'rgba(8,4,0,0.35)'); side.addColorStop(0.12, 'rgba(8,4,0,0)'); side.addColorStop(0.88, 'rgba(8,4,0,0)'); side.addColorStop(1, 'rgba(8,4,0,0.35)');
    x.fillStyle = side; x.fillRect(0, SURFACE, NEST_W, NEST_H - SURFACE);
    x.restore();
    this.bg = c;
  }

  render(ctx) {
    const g = this.game, t = g.time, home = g.home;
    const { s, ox, oy } = this.layout();
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(0, 0, g.vw, g.vh);
    this.buildBg(s);
    ctx.drawImage(this.bg, ox, oy, NEST_W * s, NEST_H * s);
    ctx.setTransform(g.dpr * s, 0, 0, g.dpr * s, g.dpr * ox, g.dpr * oy);
    // sky and surface
    const dark = g.darkness();
    const sky = ctx.createLinearGradient(0, 0, 0, SURFACE);
    const sw = g.sw || [0, 1, 0, 0];
    const mixC = (cols) => { const c = [0, 0, 0]; cols.forEach((h, i) => { const r = hexRgb(h); for (let j = 0; j < 3; j++) c[j] += r[j] * sw[i]; }); return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; };
    sky.addColorStop(0, dark > 0.3 ? '#0c1230' : mixC(['#82bce0', '#6aaee0', '#9ab4c8', '#b8c8d8']));
    sky.addColorStop(1, dark > 0.3 ? '#28304e' : mixC(['#e0f0d8', '#d8ecdc', '#ecdcc0', '#e4ecf0']));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, NEST_W, SURFACE);
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 290 + t * 6) % (NEST_W + 200)) - 100, cy = 26 + (i % 2) * 18;
      ctx.fillStyle = dark > 0.3 ? 'rgba(80,90,120,0.25)' : 'rgba(255,255,255,0.55)';
      for (const [ox, oy, r] of [[0, 0, 18], [20, -6, 22], [42, 0, 16], [18, 6, 18]]) { ctx.beginPath(); ctx.arc(cx + ox, cy + oy, r, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = dark > 0.3 ? 'rgba(20,30,30,0.6)' : 'rgba(70,110,70,0.45)';
    ctx.beginPath(); ctx.moveTo(0, SURFACE - 18);
    for (let k = 0; k <= 20; k++) ctx.lineTo(k * 50, SURFACE - 18 - Math.sin(k * 1.3) * 10 - Math.sin(k * 0.4) * 8);
    ctx.lineTo(NEST_W, SURFACE); ctx.lineTo(0, SURFACE); ctx.closePath(); ctx.fill();
    if (g.weather.k > 0.05 && sw[3] < 0.5) {
      ctx.strokeStyle = `rgba(200,220,240,${0.4 * g.weather.k})`; ctx.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const rx = (i * 97 + t * 400) % NEST_W, ry = (i * 53 + t * 700) % SURFACE;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 12); ctx.stroke();
      }
    }
    // turf: a band of dark topsoil with individual grass blades swaying above it
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(0, SURFACE - 3, NEST_W, 8);
    ctx.lineCap = 'round';
    for (let k = 0; k < 260; k++) {
      const bx = (k * 3.86) % NEST_W + ((k * 13) % 7), h = 8 + ((k * 37) % 17);
      const sway = Math.sin(t * 1.4 + k * 0.7) * 2;
      const grassPal = [['#5e9a32', '#7ab840', '#4a8a28', '#88c84a'], ['#4e7a2a', '#5e8e32', '#3e6a22', '#6a9a3a'], ['#a8902e', '#c0a040', '#8a6a24', '#b88a30'], ['#8a8a6a', '#a09a80', '#7a7a60', '#b0a890']];
      ctx.strokeStyle = mixC(grassPal.map((p) => p[k % 4])); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(bx, SURFACE); ctx.quadraticCurveTo(bx + sway * 0.4, SURFACE - h * 0.6, bx + sway, SURFACE - h); ctx.stroke();
    }
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath(); ctx.ellipse(500, SURFACE + 2, 90, 26, 0, Math.PI, TAU); ctx.fill();
    if (sw[3] > 0.02) {
      ctx.fillStyle = `rgba(245,250,255,${0.9 * sw[3]})`;
      ctx.beginPath(); ctx.moveTo(0, SURFACE - 6);
      for (let k = 0; k <= 50; k++) ctx.lineTo(k * 20, SURFACE - 8 - Math.sin(k * 1.7) * 3);
      ctx.lineTo(NEST_W, SURFACE); ctx.lineTo(0, SURFACE); ctx.closePath(); ctx.fill();
    }
    // tunnels
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [[34, 'rgba(20,12,4,0.5)'], [30, '#24170c'], [24, '#3a2716'], [17, '#2c1d10'], [6, 'rgba(90,64,40,0.35)']]) {
      ctx.strokeStyle = pass[1]; ctx.lineWidth = pass[0];
      NEST_EDGES.forEach(([a, b], ei) => {
        const open = (!NEST_ROOMS[a] || this.roomOpen(a)) && (!NEST_ROOMS[b] || this.roomOpen(b));
        ctx.setLineDash(open ? [] : [4, 10]);
        ctx.globalAlpha = open ? 1 : 0.35;
        const pts = TUNNEL_PTS[ei];
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] + (pass[0] === 6 ? 5 : 0));
        for (const q of pts) ctx.lineTo(q[0], q[1] + (pass[0] === 6 ? 5 : 0));
        ctx.stroke();
      });
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // rooms
    for (const k in NEST_ROOMS) this.drawRoom(ctx, k, t);
    // workers carrying brood and food between chambers
    for (const c of this.couriers) {
      drawAnt(ctx, { x: c.x, y: c.y, a: c.a, size: 1.5 * home.sp.shape.size, sp: home.species, role: 'worker', gait: c.gait, hurtT: 0, greetT: 0, biteT: 0, id: c.id, carry: null }, t);
      const hx = c.x + Math.cos(c.a) * 16, hy = c.y + Math.sin(c.a) * 16;
      if (c.carry === 'egg') this.egg(ctx, hx, hy, 1.1);
      else if (c.carry === 'husk') { ctx.fillStyle = '#6a5d50'; ctx.beginPath(); ctx.ellipse(hx, hy, 5, 2.5, c.a, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = '#e6c88a'; ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, TAU); ctx.fill(); }
    }
    // workers walking the tunnels
    for (const ag of this.agents) {
      const e = { x: ag.x, y: ag.y, a: ag.a, size: 1.5 * home.sp.shape.size, sp: home.species, role: 'worker', gait: ag.gait, hurtT: 0, greetT: ag.wait > 0 ? 1 : 0, biteT: 0, id: ag.id, carry: null };
      drawAnt(ctx, e, t);
      if (ag.carry) {
        const hx = ag.x + Math.cos(ag.a) * 16, hy = ag.y + Math.sin(ag.a) * 16;
        if (ag.carry === 'egg') this.egg(ctx, hx, hy, 1);
        else { ctx.fillStyle = '#e6c88a'; ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, TAU); ctx.fill(); }
      }
    }
    // light spilling down the entrance shaft, dust drifting in it
    const light = ctx.createRadialGradient(500, SURFACE, 10, 500, SURFACE + 60, 420);
    light.addColorStop(0, `rgba(255,230,170,${0.22 * (1 - dark)})`); light.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = light; ctx.fillRect(0, SURFACE, NEST_W, NEST_H - SURFACE);
    for (const m of this.motes) {
      ctx.fillStyle = `rgba(255,236,190,${0.25 + 0.2 * Math.sin(t * 2 + m.p)})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, 0.9, 0, TAU); ctx.fill();
    }
    const vg = ctx.createRadialGradient(500, 380, 300, 500, 380, 700);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,5,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, SURFACE, NEST_W, NEST_H - SURFACE);
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  }

  egg(ctx, x, y, k) {
    const gr = ctx.createRadialGradient(x - 1 * k, y - 1 * k, 0.3, x, y, 4 * k);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d8d0b8');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, 3.4 * k, 2.3 * k, 0.3, 0, TAU); ctx.fill();
  }

  larva(ctx, x, y, k) {
    ctx.strokeStyle = '#f2ead6'; ctx.lineWidth = 5 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, 4.5 * k, 0.4, Math.PI * 1.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,140,110,0.5)'; ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const a = 0.5 + i * 0.75;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 2.2 * k, y + Math.sin(a) * 2.2 * k); ctx.lineTo(x + Math.cos(a) * 6.8 * k, y + Math.sin(a) * 6.8 * k); ctx.stroke();
    }
    ctx.fillStyle = '#c8a878'; ctx.beginPath(); ctx.arc(x + Math.cos(0.4) * 4.5 * k, y + Math.sin(0.4) * 4.5 * k, 1.8 * k, 0, TAU); ctx.fill();
  }

  pupa(ctx, x, y, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const gr = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, 10);
    gr.addColorStop(0, '#f0dcb0'); gr.addColorStop(1, '#a8885a');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, 10, 5.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(110,80,40,0.35)'; ctx.lineWidth = 0.6;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 3, -5); ctx.quadraticCurveTo(k * 3 + 1, 0, k * 3, 5); ctx.stroke(); }
    ctx.restore();
  }

  drawRoom(ctx, k, t) {
    const g = this.game, home = g.home;
    const key = this.roomKey(k), [x, y] = NEST_NODES[k], r = NEST_ROOMS[k];
    const lvl = home.chambers[key], open = lvl > 0;
    const hot = this.hover === k || this.selected === k;
    if (!open) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = hot ? 'rgba(255,214,120,0.9)' : 'rgba(240,220,180,0.45)'; ctx.lineWidth = 2;
      blobPath(ctx, x, y, r.rx, r.ry, x * 0.01); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(240,220,180,0.8)';
      ctx.font = '700 15px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`Dig ${CHAMBERS[key].name.toLowerCase()}`, x, y - 2);
      ctx.font = '400 13px "Atkinson Hyperlegible", sans-serif';
      ctx.fillText(`${home.upgradeCost(key)} food`, x, y + 16);
      return;
    }
    const sd = x * 0.01;
    ctx.fillStyle = 'rgba(15,8,2,0.55)';
    blobPath(ctx, x, y + 4, r.rx + 7, r.ry + 7, sd); ctx.fill();
    const gr = ctx.createLinearGradient(x, y - r.ry, x, y + r.ry);
    gr.addColorStop(0, '#120a04'); gr.addColorStop(0.55, '#2e1e10'); gr.addColorStop(1, '#4a3420');
    ctx.fillStyle = gr; blobPath(ctx, x, y, r.rx, r.ry, sd); ctx.fill();
    ctx.save(); blobPath(ctx, x, y, r.rx, r.ry, sd); ctx.clip();
    const R0 = mulberry32((x * 7 + y) | 0);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = R0() < 0.5 ? 'rgba(160,120,80,0.35)' : 'rgba(20,12,4,0.4)';
      ctx.beginPath(); ctx.arc(x + (R0() - 0.5) * r.rx * 2, y + r.ry * (0.4 + R0() * 0.6), 0.6 + R0() * 1.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = hot ? 'rgba(255,214,120,0.85)' : 'rgba(200,160,110,0.35)'; ctx.lineWidth = hot ? 2.5 : 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, r.rx, r.ry, 0, Math.PI * 0.08, Math.PI * 0.92); ctx.stroke();
    ctx.save();
    blobPath(ctx, x, y, r.rx, r.ry, sd, 0.97); ctx.clip();
    const floor = y + r.ry * 0.55;
    const sp = home.species;
    switch (key) {
      case 'royal': {
        const breathe = 1 + Math.sin(t * 2) * 0.02;
        drawAnt(ctx, { x: x + 10, y: floor - 18, a: Math.PI + 0.1, size: 3.1 * breathe * home.sp.shape.size, sp, queen: true, role: 'worker', gait: 0.3, hurtT: 0, greetT: 1, biteT: 0, id: 1 }, t);
        const eggs = home.brood.filter((b) => b.stage === 'egg').length + 3;
        for (let i = 0; i < eggs; i++) this.egg(ctx, x - 70 + (i % 6) * 8, floor - 4 - Math.floor(i / 6) * 5, 1.2);
        for (let i = 0; i < 2; i++) {
          const a = t * 0.6 + i * Math.PI;
          drawAnt(ctx, { x: x + 10 + Math.cos(a) * 70, y: floor - 16 + Math.sin(a) * 10, a: a + Math.PI / 2, size: 1.4 * home.sp.shape.size, sp, role: 'worker', gait: t * 8, hurtT: 0, greetT: 1, biteT: 0, id: 5 + i }, t);
        }
        break;
      }
      case 'nursery': {
        const list = home.brood;
        list.forEach((b, i) => {
          const bx = x - r.rx + 26 + (i % 7) * 30, by = floor - 6 - Math.floor(i / 7) * 22;
          if (b.stage === 'egg') this.egg(ctx, bx, by, 1.4);
          else if (b.stage === 'larva') this.larva(ctx, bx, by, 0.9 + (b.t - 5) / 14);
          else this.pupa(ctx, bx, by, 0.2);
          ctx.fillStyle = b.role === 'soldier' ? 'rgba(255,140,100,0.85)' : 'rgba(0,0,0,0)';
          ctx.beginPath(); ctx.arc(bx, by - 9, 2, 0, TAU); ctx.fill();
        });
        if (!list.length) {
          ctx.fillStyle = 'rgba(240,220,180,0.55)'; ctx.font = '400 13px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('No brood. The queen needs food to lay.', x, y + 4);
        }
        break;
      }
      case 'granary': {
        const n = Math.round((home.food / Math.max(1, home.foodCap)) * 90);
        const R = mulberry32(7);
        for (let i = 0; i < n; i++) {
          const px = x + (R() - 0.5) * r.rx * 1.6 * (1 - i / 140), py = floor - 4 - (i / 90) * r.ry * 0.9 * R();
          const kind = R();
          if (kind < 0.4) { ctx.fillStyle = '#e2c486'; ctx.beginPath(); ctx.arc(px, py, 3.2, 0, TAU); ctx.fill(); }
          else if (kind < 0.75) { ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.ellipse(px, py, 4, 2, R() * 3, 0, TAU); ctx.fill(); }
          else { radialFill(ctx, px, py, 3, [[0, '#fff0b0'], [0.5, '#ffc444'], [1, '#b8700a']]); }
        }
        break;
      }
      case 'barracks': {
        const n = Math.min(8, g.counts.homeSoldiers);
        for (let i = 0; i < n; i++) {
          drawAnt(ctx, { x: x - 70 + i * 20, y: floor - 12 - (i % 2) * 8, a: -Math.PI / 2 + (i % 3 - 1) * 0.3, size: 1.3 * 1.3 * home.sp.shape.size, sp, role: 'soldier', gait: 1, hurtT: 0, greetT: 0, biteT: 0, id: 20 + i }, t);
        }
        break;
      }
      case 'infirmary': {
        radialFill(ctx, x, y, r.rx * 0.8, [[0, `rgba(180,255,170,${0.2 + 0.08 * Math.sin(t * 2)})`], [1, 'rgba(180,255,170,0)']]);
        drawAnt(ctx, { x, y: floor - 14, a: 0.1, size: 1.5 * home.sp.shape.size, sp, role: 'worker', gait: 0.5, hurtT: 0, greetT: 1, biteT: 0, id: 30 }, t);
        break;
      }
      case 'fungus': {
        const R = mulberry32(9);
        const n = 30 + lvl * 25;
        for (let i = 0; i < n; i++) {
          const px = x + (R() - 0.5) * r.rx * 1.5, py = floor - R() * r.ry * (0.5 + lvl * 0.25);
          radialFill(ctx, px, py, 6 + R() * 8, [[0, '#f4f0e6'], [0.7, '#c8c0b0'], [1, 'rgba(160,150,140,0)']]);
        }
        const leaves = Math.min(30, Math.ceil(home.leaves));
        for (let i = 0; i < leaves; i++) {
          ctx.fillStyle = i % 2 ? '#6aa040' : '#4e8a30';
          ctx.beginPath(); ctx.ellipse(x - r.rx + 20 + (i % 10) * 9, floor - 4 - Math.floor(i / 10) * 6, 4, 2.4, i, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'midden': {
        const R = mulberry32(13);
        for (let i = 0; i < 60 + lvl * 30; i++) {
          const px = x + (R() - 0.5) * r.rx * 1.5, py = floor - R() * r.ry * 0.7 * (1 - Math.abs(px - x) / r.rx);
          ctx.fillStyle = ['#5a5048', '#6a5d50', '#3a3028', '#7a6a50', '#4a4030'][(R() * 5) | 0];
          ctx.beginPath(); ctx.ellipse(px, py, 1.5 + R() * 3, 1 + R() * 1.5, R() * 3, 0, TAU); ctx.fill();
        }
        for (let i = 0; i < 3; i++) drawAnt(ctx, { x: x - 40 + i * 40, y: floor - 6, a: i, size: 1.1, sp, husk: true, role: 'worker', gait: 0, hurtT: 0, greetT: 0, biteT: 0, id: 60 + i }, t);
        break;
      }
      case 'winter': {
        const n = g.season === 3 ? 18 : 6;
        for (let i = 0; i < n; i++) {
          const a = i * 2.4, d = Math.sqrt(i / n) * r.rx * 0.6;
          drawAnt(ctx, { x: x + Math.cos(a) * d, y: floor - 12 + Math.sin(a) * d * 0.25, a: a + Math.PI / 2, size: 1.2 * home.sp.shape.size, sp, role: 'worker', gait: 1, hurtT: 0, greetT: g.season === 3 ? 0 : 1, biteT: 0, id: 70 + i }, t);
        }
        if (g.season === 3) radialFill(ctx, x, y, r.rx, [[0, 'rgba(200,230,255,0.12)'], [1, 'rgba(200,230,255,0)']]);
        break;
      }
      case 'honeypot': {
        for (let i = 0; i < lvl * 4; i++) {
          const px = x - r.rx * 0.7 + i * (r.rx * 1.4 / Math.max(1, lvl * 4 - 1)), py = y - r.ry + 18;
          drawAnt(ctx, { x: px, y: py - 6, a: -Math.PI / 2, size: 1.1, sp, role: 'worker', gait: 1, hurtT: 0, greetT: 0, biteT: 0, id: 40 + i }, t);
          radialFill(ctx, px, py + 14, 11, [[0, '#ffe9a0'], [0.45, '#f0a828'], [1, '#8a5008']]);
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(px - 3, py + 10, 2.4, 0, TAU); ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(250,236,200,0.9)';
    ctx.font = '800 15px Sniglet, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(CHAMBERS[key].name, x, y - r.ry - 10);
    for (let i = 0; i < CHAMBERS[key].max; i++) {
      ctx.fillStyle = i < lvl ? '#f4b740' : 'rgba(250,236,200,0.25)';
      ctx.beginPath(); ctx.arc(x - (CHAMBERS[key].max - 1) * 6 + i * 12, y - r.ry + 2, 3.5, 0, TAU); ctx.fill();
    }
  }
}
