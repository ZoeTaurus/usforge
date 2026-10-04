'use strict';
/* The nest seen in cross-section: tunnels, chambers, the queen and her brood. */

const NEST_W = 1000, NEST_H = 720, SURFACE = 110;
// the soil is drawn well beyond the nest itself, so it fills any screen shape
const NEST_BX0 = -800, NEST_BX1 = 1800, NEST_BY1 = 1400;
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

/* An irregular, hand-dug outline: a domed ceiling over a flat, trodden floor. */
function blobPath(ctx, x, y, rx, ry, seed, k = 1) {
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * TAU;
    const n = 1 + (vnoise(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6, 7) - 0.5) * 0.16;
    const flat = Math.sin(a) > 0.45 ? 0.82 + 0.18 * (1 - Math.sin(a)) / 0.55 : 1;
    const px = x + Math.cos(a) * rx * n * k, py = y + Math.sin(a) * ry * n * k * flat;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/* Where a tunnel meets a chamber it comes in at floor level, off to one side. */
function tunnelEnd(name, other) {
  const [x, y] = NEST_NODES[name], r = NEST_ROOMS[name];
  if (!r) return [x, y];
  const [ox] = NEST_NODES[other];
  const side = Math.abs(ox - x) < 30 ? 0 : Math.sign(ox - x);
  return [x + side * r.rx * 0.55, y + r.ry * (side ? 0.32 : -0.55)];
}

/* Tunnels wobble a little, like they were chewed out grain by grain. */
const TUNNEL_PTS = NEST_EDGES.map(([a, b], ei) => {
  const [x0, y0] = tunnelEnd(a, b), [x1, y1] = tunnelEnd(b, a);
  const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const f = i / 12, j = i === 0 || i === 12 ? 0 : (vnoise(f * 3 + ei * 5, ei, 3) - 0.5) * 18 * Math.sin(f * Math.PI);
    pts.push([lerp(x0, x1, f) + (nx / nl) * j, lerp(y0, y1, f) + (ny / nl) * j]);
  }
  return pts;
});
const TUNNEL_LEN = TUNNEL_PTS.map((pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])); return c; });
const EDGE_OF = {};
NEST_EDGES.forEach(([a, b], ei) => { EDGE_OF[a + '|' + b] = { ei, rev: false }; EDGE_OF[b + '|' + a] = { ei, rev: true }; });

/* A point (and heading) a fraction f of the way along a tunnel, walking from `from` to `to`. */
function tunnelPoint(from, to, f) {
  const e = EDGE_OF[from + '|' + to];
  if (!e) { const p = NEST_NODES[from], q = NEST_NODES[to]; return { x: lerp(p[0], q[0], f), y: lerp(p[1], q[1], f), a: Math.atan2(q[1] - p[1], q[0] - p[0]) }; }
  const pts = TUNNEL_PTS[e.ei], cum = TUNNEL_LEN[e.ei], L = cum[cum.length - 1];
  const d = (e.rev ? 1 - f : f) * L;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const k = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  const p = pts[i - 1], q = pts[i];
  let a = Math.atan2(q[1] - p[1], q[0] - p[0]);
  if (e.rev) a += Math.PI;
  return { x: lerp(p[0], q[0], k), y: lerp(p[1], q[1], k), a };
}
function tunnelLength(from, to) { const e = EDGE_OF[from + '|' + to]; return e ? TUNNEL_LEN[e.ei][TUNNEL_LEN[e.ei].length - 1] : 100; }

/* A smooth curve through a tunnel's points. */
function tunnelPath(ctx, pts, dy = 0) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] + dy);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1] + dy, mx, my + dy);
  }
  const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1] + dy);
}

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
    this.cav = null; this.cavKey = '';
    this.agents = [];
    this.hover = null;
    this.selected = 'royal';
    this.adj = {};
    for (const [a, b] of NEST_EDGES) { (this.adj[a] ||= []).push(b); (this.adj[b] ||= []).push(a); }
    this.couriers = [];
    this.nurseT = 2;
    this.motes = [];
    for (let i = 0; i < 50; i++) this.motes.push({ x: rand(NEST_W), y: rand(SURFACE, NEST_H), v: rand(3, 9), p: rand(TAU) });
    this.drips = [];
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
  edgeOpen(a, b) { return (!NEST_ROOMS[a] || this.roomOpen(a)) && (!NEST_ROOMS[b] || this.roomOpen(b)); }

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
      const open = NEST_EDGES.filter(([a, b]) => this.edgeOpen(a, b));
      const e = pick(open);
      this.agents.push({ from: e[0], to: e[1], t: Math.random(), speed: rand(40, 70), wait: 0, id: UID++, carry: Math.random() < 0.3 ? pick(['egg', 'crumb']) : null, gait: 0, a: 0, x: 0, y: 0, ox: 0 });
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
      c.t += (c.speed * dt) / tunnelLength(c.path[c.i], c.path[c.i + 1]); c.gait += c.speed * dt * 0.3;
      if (c.t >= 1) { c.t = 0; c.i++; if (c.i >= c.path.length - 1) { c.done = true; continue; } }
      const p = tunnelPoint(c.path[c.i], c.path[c.i + 1], c.t);
      c.x = p.x; c.y = p.y; c.a = p.a;
    }
    this.couriers = this.couriers.filter((c) => !c.done);
    for (const m of this.motes) { m.y -= m.v * dt; m.x += Math.sin(this.game.time * 0.5 + m.p) * 4 * dt; if (m.y < SURFACE) { m.y = NEST_H; m.x = rand(NEST_W); } }
    // the odd grain of soil trickles from a chamber ceiling
    if (Math.random() < dt * 0.6) {
      const ks = Object.keys(NEST_ROOMS).filter((k) => this.roomOpen(k));
      if (ks.length) { const k = pick(ks), [x, y] = NEST_NODES[k], r = NEST_ROOMS[k]; this.drips.push({ x: x + rand(-r.rx * 0.5, r.rx * 0.5), y: y - r.ry * 0.85, v: 0, floor: y + r.ry * 0.5 }); }
    }
    for (const d of this.drips) { d.v += 300 * dt; d.y += d.v * dt; if (d.y > d.floor) d.done = true; }
    this.drips = this.drips.filter((d) => !d.done);
    for (const ag of this.agents) {
      if (ag.wait > 0) {
        // pottering about on the chamber floor
        ag.wait -= dt;
        ag.gait += dt * 6;
        const r = NEST_ROOMS[ag.from];
        if (r) {
          const [cx, cy] = NEST_NODES[ag.from];
          ag.ox += Math.sin(this.game.time * 0.9 + ag.id) * dt * 14;
          ag.ox = clamp(ag.ox, -r.rx * 0.6, r.rx * 0.6);
          ag.x = cx + ag.ox; ag.y = cy + r.ry * 0.36; ag.a = Math.cos(this.game.time * 0.9 + ag.id) > 0 ? 0 : Math.PI;
        }
        continue;
      }
      ag.t += (ag.speed * dt) / tunnelLength(ag.from, ag.to);
      ag.gait += ag.speed * dt * 0.3;
      if (ag.t >= 1) {
        const opts = this.adj[ag.to].filter((n) => n !== ag.from && (!NEST_ROOMS[n] || this.roomOpen(n)));
        const next = opts.length ? pick(opts) : ag.from;
        if (NEST_ROOMS[ag.to]) { ag.wait = rand(1.5, 4); ag.ox = (tunnelEnd(ag.to, ag.from)[0] - NEST_NODES[ag.to][0]); }
        ag.from = ag.to; ag.to = next; ag.t = 0;
        if (NEST_ROOMS[ag.from] && Math.random() < 0.4) ag.carry = ag.from === 'granary' ? 'crumb' : ag.from === 'nursery' || ag.from === 'royal' ? 'egg' : null;
        if (ag.wait > 0) continue;
      }
      const p = tunnelPoint(ag.from, ag.to, ag.t);
      ag.x = p.x; ag.y = p.y; ag.a = p.a;
    }
  }

  /* ------------------------------------------------------------ the soil */

  buildBg(s) {
    const g = this.game;
    const dpr = Math.min(g.dpr, 1.5);
    const key = `${s.toFixed(4)}:${dpr}`;
    if (this.bg && this.bgKey === key) return;
    this.bgKey = key;
    const W = NEST_BX1 - NEST_BX0, H = NEST_BY1;
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * s * dpr); c.height = Math.ceil(H * s * dpr);
    const x = c.getContext('2d');
    x.scale(s * dpr, s * dpr);
    x.translate(-NEST_BX0, 0);
    const R = mulberry32(42);
    const area = (W * H) / (NEST_W * NEST_H);

    // 1. soil horizons: humus topsoil, red clay subsoil, sandy parent soil, grey clay at depth
    const HZ = [
      { d: 0, c: [56, 38, 24] },
      { d: 70, c: [88, 58, 35] },
      { d: 150, c: [124, 80, 46] },
      { d: 300, c: [150, 112, 70] },
      { d: 470, c: [108, 90, 70] },
      { d: 700, c: [80, 68, 56] },
      { d: 1300, c: [60, 52, 46] },
    ];
    const soilAt = (X, Y) => {
      const wav = (fbm(X / 170, Y / 400, 11, 2) - 0.5) * 60;
      const d = Y - SURFACE + wav;
      let i = 0;
      while (i < HZ.length - 2 && d > HZ[i + 1].d) i++;
      const a = HZ[i], b = HZ[i + 1];
      const k = smoothstep(a.d, b.d, d);
      const n = fbm(X / 70, Y / 70, 3, 3), n2 = vnoise(X / 9, Y / 9, 9);
      // faint layering, like sediment laid down over the years
      const band = Math.sin(Y / 9 + fbm(X / 300, Y / 90, 5, 2) * 6) * 0.03;
      const sh = 0.82 + n * 0.32 + (n2 - 0.5) * 0.1 + band;
      return [lerp(a.c[0], b.c[0], k) * sh, lerp(a.c[1], b.c[1], k) * sh, lerp(a.c[2], b.c[2], k) * sh];
    };
    const STEP = 4.5, LW = Math.ceil(W / STEP), LH = Math.ceil(H / STEP);
    const lc = document.createElement('canvas'); lc.width = LW; lc.height = LH;
    const lctx = lc.getContext('2d'), img = lctx.createImageData(LW, LH);
    for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) {
      const col = soilAt(NEST_BX0 + i * STEP, j * STEP), k = (j * LW + i) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    lctx.putImageData(img, 0, 0);
    x.imageSmoothingEnabled = true;
    x.save(); x.beginPath(); x.rect(NEST_BX0, SURFACE - 4, W, H); x.clip();
    x.drawImage(lc, NEST_BX0, 0, LW * STEP, LH * STEP);

    // 2. fine grain: sand, crumbs and tiny flecks of mica
    for (let i = 0; i < 16000 * area; i++) {
      const px = NEST_BX0 + R() * W, py = SURFACE + R() * (H - SURFACE);
      const r = R();
      x.fillStyle = r < 0.45 ? 'rgba(25,15,6,0.35)' : r < 0.9 ? 'rgba(220,180,130,0.22)' : 'rgba(255,250,235,0.5)';
      x.fillRect(px, py, 0.6 + R() * 1.1, 0.6 + R() * 1.1);
    }
    for (let i = 0; i < 260 * area; i++) {
      const px = NEST_BX0 + R() * W, py = SURFACE + 6 + Math.pow(R(), 2) * 120, r = 2 + R() * 5;
      radialFill(x, px, py, r, [[0, 'rgba(30,18,8,0.35)'], [1, 'rgba(30,18,8,0)']]);
    }
    // a gravel band between the subsoil and the sandy layer
    for (let i = 0; i < 420 * (W / NEST_W); i++) {
      const px = NEST_BX0 + R() * W, py = SURFACE + 290 + (fbm(px / 170, 0.7, 11, 2) - 0.5) * 60 + (R() - 0.5) * 40, r = 1.2 + R() * 2.4;
      const gr = x.createRadialGradient(px - r * 0.3, py - r * 0.4, 0.2, px, py, r);
      gr.addColorStop(0, '#d8c8a8'); gr.addColorStop(1, '#6a5a44');
      x.fillStyle = gr; x.beginPath(); x.ellipse(px, py, r * 1.2, r, R() * 3, 0, TAU); x.fill();
    }

    // 3. worm burrows: old backfilled tunnels, slightly darker with a pale lining
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (let i = 0; i < 5 * area; i++) {
      let px = NEST_BX0 + R() * W, py = SURFACE + 60 + R() * (H - 200), a = R() * TAU;
      const pts = [[px, py]];
      for (let k = 0; k < 14; k++) { a += (R() - 0.5) * 0.8; px += Math.cos(a) * 14; py += Math.sin(a) * 14; pts.push([px, py]); }
      for (const [w, col] of [[7, 'rgba(40,24,12,0.35)'], [4, 'rgba(70,46,26,0.5)'], [1, 'rgba(210,170,120,0.2)']]) {
        x.strokeStyle = col; x.lineWidth = w;
        x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const q of pts) x.lineTo(q[0], q[1]); x.stroke();
      }
    }

    // 4. stones, partly buried, lit from above
    const inRoom = (px, py, r) => Object.keys(NEST_ROOMS).some((k) => ((px - NEST_NODES[k][0]) / (NEST_ROOMS[k].rx + r + 14)) ** 2 + ((py - NEST_NODES[k][1]) / (NEST_ROOMS[k].ry + r + 14)) ** 2 < 1.1);
    const nearTunnel = (px, py, r) => TUNNEL_PTS.some((pts) => pts.some((q) => dist2(px, py, q[0], q[1]) < (r + 20) ** 2));
    for (let i = 0; i < 38 * area; i++) {
      const depth = Math.pow(R(), 0.8);
      const px = NEST_BX0 + R() * W, py = SURFACE + 30 + depth * (H - SURFACE - 40), r = 4 + R() * 9 + depth * 14;
      if (inRoom(px, py, r) || nearTunnel(px, py, r)) continue;
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

    // 5. buried odds and ends: acorns, snail shells, a fossil shell deep down
    for (let i = 0; i < 3 * (W / NEST_W); i++) {
      const px = NEST_BX0 + 60 + R() * (W - 120), py = SURFACE + 30 + R() * 90;
      x.save(); x.translate(px, py); x.rotate(R() * 3); x.scale(1.4, 1.4);
      propAcorn(x, { x: 0, y: 0, rot: 0 });
      x.restore();
    }
    for (let i = 0; i < 3 * (W / NEST_W); i++) {
      const px = NEST_BX0 + 80 + R() * (W - 160), py = SURFACE + 200 + R() * 500;
      if (inRoom(px, py, 10)) continue;
      x.save(); x.translate(px, py); x.rotate(R() * 3);
      x.fillStyle = 'rgba(230,220,200,0.75)';
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 7, 0.4, 3.4); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(120,100,80,0.6)'; x.lineWidth = 0.6;
      for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(0.4 + k * 0.7) * 7, Math.sin(0.4 + k * 0.7) * 7); x.stroke(); }
      x.restore();
    }
    for (let i = 0; i < 2; i++) {
      const px = NEST_BX0 + R() * W, py = 800 + R() * 400;
      x.save(); x.translate(px, py);
      x.strokeStyle = 'rgba(200,190,170,0.4)'; x.lineWidth = 1.4;
      x.beginPath();
      for (let k = 0; k < 60; k++) { const a = k * 0.32, r = 1 + k * 0.28; k ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(r, 0); }
      x.stroke();
      x.restore();
    }
    // white fungal threads in the topsoil
    for (let i = 0; i < 4 * (W / NEST_W); i++) {
      const cx = NEST_BX0 + R() * W, cy = SURFACE + 25 + R() * 70;
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
    for (let i = 0; i < 7 * (W / NEST_W); i++) {
      const px = NEST_BX0 + 40 + (i / (7 * (W / NEST_W))) * (W - 80) + (R() - 0.5) * 60;
      if (Math.abs(px - 500) < 60) continue;
      root(px, SURFACE, Math.PI / 2 + (R() - 0.5) * 0.6, 5 + R() * 4, 10 + ((R() * 10) | 0), 0);
    }
    // a big tree root sweeping across one side
    root(NEST_BX0 + W * 0.18, SURFACE, Math.PI * 0.3, 16, 34, 0);
    // grass roots: a fine dense mat just under the turf
    for (let i = 0; i < 500 * (W / NEST_W); i++) {
      const px = NEST_BX0 + R() * W, l = 6 + R() * 22;
      x.strokeStyle = R() < 0.5 ? 'rgba(200,170,120,0.25)' : 'rgba(30,18,8,0.3)'; x.lineWidth = 0.5;
      x.beginPath(); x.moveTo(px, SURFACE); x.quadraticCurveTo(px + (R() - 0.5) * 6, SURFACE + l * 0.5, px + (R() - 0.5) * 8, SURFACE + l); x.stroke();
    }

    // 7. depth: it gets darker and cooler further down
    const deep = x.createLinearGradient(0, SURFACE, 0, H);
    deep.addColorStop(0, 'rgba(0,0,0,0)'); deep.addColorStop(0.35, 'rgba(10,6,2,0.12)'); deep.addColorStop(0.6, 'rgba(8,6,8,0.42)'); deep.addColorStop(1, 'rgba(4,3,4,0.75)');
    x.fillStyle = deep; x.fillRect(NEST_BX0, SURFACE, W, H - SURFACE);
    x.restore();
    this.bg = c; this.bgDpr = dpr;
  }

  /* ---------------------------------------------- tunnels and chambers */

  /* The dug-out spaces change only when a chamber is dug, so they are drawn once and cached. */
  buildCavities(s) {
    const g = this.game, home = g.home;
    const dpr = Math.min(g.dpr, 2);
    const key = `${s.toFixed(4)}:${dpr}:${JSON.stringify(home.chambers)}:${home.special}`;
    if (this.cav && this.cavKey === key) return;
    this.cavKey = key;
    const c = document.createElement('canvas');
    c.width = Math.ceil(NEST_W * s * dpr); c.height = Math.ceil(NEST_H * s * dpr);
    const x = c.getContext('2d');
    const T = (ctx) => ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
    T(x);
    x.lineCap = 'round'; x.lineJoin = 'round';

    // the hollow spaces themselves, in one flat colour, so we can light and texture them together
    const holes = document.createElement('canvas'); holes.width = c.width; holes.height = c.height;
    const h = holes.getContext('2d'); T(h);
    h.lineCap = 'round'; h.lineJoin = 'round';
    h.fillStyle = h.strokeStyle = '#000';
    NEST_EDGES.forEach(([a, b], ei) => { if (this.edgeOpen(a, b)) { h.lineWidth = 22; tunnelPath(h, TUNNEL_PTS[ei]); h.stroke(); } });
    for (const k in NEST_ROOMS) if (this.roomOpen(k)) { const [rx, ry] = NEST_NODES[k], r = NEST_ROOMS[k]; blobPath(h, rx, ry, r.rx, r.ry, rx * 0.01); h.fill(); }
    // the shaft up to the surface
    h.lineWidth = 24; h.beginPath(); h.moveTo(500, SURFACE - 6); h.lineTo(500, NEST_NODES.E[1] + 10); h.stroke();

    // 1. packed, darker soil around every tunnel and chamber, where the ants pressed the walls
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    x.filter = `blur(${7 * s * dpr}px)`; x.globalAlpha = 0.75;
    x.drawImage(holes, 0, 0);
    x.restore();
    const halo = document.createElement('canvas'); halo.width = c.width; halo.height = c.height;
    const hc = halo.getContext('2d');
    hc.drawImage(c, 0, 0); hc.globalCompositeOperation = 'source-in'; hc.fillStyle = 'rgba(28,16,6,0.9)'; hc.fillRect(0, 0, c.width, c.height);
    x.clearRect(0, 0, NEST_W, NEST_H);
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(halo, 0, 0); x.restore();

    // 2. the hollows: a dark back wall, darker still under the ceiling
    const cav = document.createElement('canvas'); cav.width = c.width; cav.height = c.height;
    const cv = cav.getContext('2d');
    cv.drawImage(holes, 0, 0);
    cv.globalCompositeOperation = 'source-in';
    T(cv);
    const wall = cv.createLinearGradient(0, SURFACE, 0, NEST_H);
    wall.addColorStop(0, '#2c1c0e'); wall.addColorStop(1, '#1a1008');
    cv.fillStyle = wall; cv.fillRect(0, 0, NEST_W, NEST_H);
    cv.globalCompositeOperation = 'source-atop';
    cv.lineCap = 'round'; cv.lineJoin = 'round';
    // each tunnel: shadow under its roof, light trodden floor
    NEST_EDGES.forEach(([a, b], ei) => {
      if (!this.edgeOpen(a, b)) return;
      const pts = TUNNEL_PTS[ei];
      cv.strokeStyle = 'rgba(6,3,0,0.55)'; cv.lineWidth = 12; tunnelPath(cv, pts, -7); cv.stroke();
      cv.strokeStyle = 'rgba(92,64,40,0.85)'; cv.lineWidth = 9; tunnelPath(cv, pts, 7); cv.stroke();
      cv.strokeStyle = 'rgba(200,150,100,0.3)'; cv.lineWidth = 2; tunnelPath(cv, pts, 9.5); cv.stroke();
    });
    for (const k in NEST_ROOMS) {
      if (!this.roomOpen(k)) continue;
      const [rx, ry] = NEST_NODES[k], r = NEST_ROOMS[k], sd = rx * 0.01;
      // the domed back wall, catching a little light in the middle
      const bw = cv.createRadialGradient(rx, ry + r.ry * 0.1, r.ry * 0.2, rx, ry, r.rx);
      bw.addColorStop(0, '#3e2816'); bw.addColorStop(0.7, '#24160a'); bw.addColorStop(1, '#120a04');
      cv.fillStyle = bw; blobPath(cv, rx, ry, r.rx, r.ry, sd); cv.fill();
      // ceiling shadow
      const cs = cv.createLinearGradient(0, ry - r.ry, 0, ry);
      cs.addColorStop(0, 'rgba(0,0,0,0.6)'); cs.addColorStop(1, 'rgba(0,0,0,0)');
      cv.fillStyle = cs; cv.fillRect(rx - r.rx, ry - r.ry, r.rx * 2, r.ry);
      // the floor: packed earth, lighter, with crumbs and a few pebbles
      const fl = ry + r.ry * 0.3;
      const fg = cv.createLinearGradient(0, fl, 0, ry + r.ry);
      fg.addColorStop(0, '#6a4a2e'); fg.addColorStop(0.3, '#563a22'); fg.addColorStop(1, '#3a2614');
      cv.fillStyle = fg;
      cv.beginPath(); cv.moveTo(rx - r.rx * 1.1, fl);
      for (let i = 0; i <= 12; i++) cv.lineTo(rx - r.rx * 1.1 + (i / 12) * r.rx * 2.2, fl + Math.sin(i * 1.7 + rx) * 1.5);
      cv.lineTo(rx + r.rx * 1.1, ry + r.ry * 1.2); cv.lineTo(rx - r.rx * 1.1, ry + r.ry * 1.2); cv.closePath(); cv.fill();
      cv.strokeStyle = 'rgba(210,160,110,0.35)'; cv.lineWidth = 1.5;
      cv.beginPath(); cv.moveTo(rx - r.rx, fl); cv.lineTo(rx + r.rx, fl); cv.stroke();
      const R = mulberry32((rx * 7 + ry) | 0);
      for (let i = 0; i < 90; i++) {
        const px = rx + (R() - 0.5) * r.rx * 2, py = fl + 2 + R() * r.ry * 0.7;
        cv.fillStyle = R() < 0.5 ? 'rgba(170,130,90,0.45)' : 'rgba(20,12,4,0.45)';
        cv.beginPath(); cv.arc(px, py, 0.5 + R() * 1.3, 0, TAU); cv.fill();
      }
      for (let i = 0; i < 4; i++) {
        const px = rx + (R() - 0.5) * r.rx * 1.6, py = fl + 4 + R() * 6;
        radialFill(cv, px, py, 2.5 + R() * 2, [[0, '#b8a488'], [0.7, '#7a6a54'], [1, 'rgba(60,50,40,0)']]);
      }
      // root tips that have broken through the ceiling
      if (R() < 0.7) {
        for (let k2 = 0; k2 < 2 + ((R() * 3) | 0); k2++) {
          let px = rx + (R() - 0.5) * r.rx * 1.2, py = ry - r.ry * 1.05, a = Math.PI / 2 + (R() - 0.5) * 0.6;
          cv.strokeStyle = '#5a3a24'; cv.lineWidth = 2.2;
          cv.beginPath(); cv.moveTo(px, py);
          for (let m = 0; m < 4; m++) { a += (R() - 0.5) * 0.5; px += Math.cos(a) * 6; py += Math.sin(a) * 6; cv.lineTo(px, py); }
          cv.stroke();
          cv.strokeStyle = 'rgba(220,190,150,0.45)'; cv.lineWidth = 0.7; cv.stroke();
        }
      }
    }
    // the light at the entrance shaft
    const sh = cv.createLinearGradient(0, SURFACE, 0, NEST_NODES.A[1]);
    sh.addColorStop(0, 'rgba(255,220,160,0.35)'); sh.addColorStop(1, 'rgba(255,220,160,0)');
    cv.fillStyle = sh; cv.fillRect(480, SURFACE - 10, 40, NEST_NODES.A[1] - SURFACE + 10);
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(cav, 0, 0); x.restore();

    // 3. a bright lip along the lower edge of each hollow, where the floor meets the wall
    for (const k in NEST_ROOMS) {
      if (!this.roomOpen(k)) continue;
      const [rx, ry] = NEST_NODES[k], r = NEST_ROOMS[k];
      x.strokeStyle = 'rgba(210,160,105,0.4)'; x.lineWidth = 1.6;
      x.beginPath(); x.ellipse(rx, ry + 1, r.rx * 0.98, r.ry * 0.86, 0, Math.PI * 0.12, Math.PI * 0.88); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 2.5;
      x.beginPath(); x.ellipse(rx, ry + 2, r.rx * 0.97, r.ry * 0.97, 0, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    }
    // tunnels not yet dug: faint dotted guides
    x.setLineDash([3, 9]); x.strokeStyle = 'rgba(240,220,180,0.25)'; x.lineWidth = 2;
    NEST_EDGES.forEach(([a, b], ei) => { if (!this.edgeOpen(a, b)) { tunnelPath(x, TUNNEL_PTS[ei]); x.stroke(); } });
    x.setLineDash([]);
    this.cav = c; this.cavDpr = dpr;
  }

  /* --------------------------------------------------------------- draw */

  renderSky(ctx, v, t) {
    const g = this.game, dark = g.darkness(), sw = g.sw || [0, 1, 0, 0];
    const mixC = (cols) => { const c = [0, 0, 0]; cols.forEach((hx, i) => { const r = hexRgb(hx); for (let j = 0; j < 3; j++) c[j] += r[j] * sw[i]; }); return c; };
    const night = smoothstep(0.1, 0.5, dark);
    const top = mixC(['#7ab4e0', '#5ea4e0', '#94aec4', '#aec0d4']), low = mixC(['#e4f2dc', '#dcecdc', '#eedcbc', '#e6eef4']);
    const mixN = (c, n) => `rgb(${lerp(c[0], n[0], night) | 0},${lerp(c[1], n[1], night) | 0},${lerp(c[2], n[2], night) | 0})`;
    const sky = ctx.createLinearGradient(0, v.y0, 0, SURFACE);
    sky.addColorStop(0, mixN(top, [10, 16, 44])); sky.addColorStop(1, mixN(low, [40, 48, 78]));
    ctx.fillStyle = sky; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, SURFACE - v.y0);
    // sun or moon
    const sx = lerp(v.x0, v.x1, (g.dayT * 1.6) % 1), sy = SURFACE - 70;
    if (night > 0.5) { radialFill(ctx, sx, sy, 40, [[0, 'rgba(240,240,255,0.5)'], [1, 'rgba(240,240,255,0)']]); ctx.fillStyle = '#eef0ff'; ctx.beginPath(); ctx.arc(sx, sy, 9, 0, TAU); ctx.fill(); }
    else radialFill(ctx, sx, sy, 90, [[0, 'rgba(255,250,220,0.9)'], [0.15, 'rgba(255,240,190,0.6)'], [1, 'rgba(255,240,190,0)']]);
    // soft clouds made of many overlapping puffs
    for (let i = 0; i < 6; i++) {
      const span = v.x1 - v.x0 + 400;
      const cx = v.x0 - 200 + ((i * 337 + t * (5 + i)) % span), cy = Math.max(v.y0 + 20, SURFACE - 95 + (i % 3) * 18);
      const R = mulberry32(i * 31 + 7);
      for (let k = 0; k < 7; k++) {
        const px = cx + (R() - 0.5) * 90, py = cy + (R() - 0.5) * 18, r = 16 + R() * 20;
        radialFill(ctx, px, py, r, [[0, `rgba(255,255,255,${0.55 * (1 - night * 0.7)})`], [0.6, `rgba(250,250,255,${0.3 * (1 - night * 0.7)})`], [1, 'rgba(255,255,255,0)']]);
      }
    }
    // distant hedgerow, then nearer meadow
    const hill = (yb, amp, f, col) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(v.x0, SURFACE);
      for (let px = v.x0; px <= v.x1 + 40; px += 30) ctx.lineTo(px, yb - (vnoise(px / f, 3, 11) * amp));
      ctx.lineTo(v.x1 + 40, SURFACE); ctx.closePath(); ctx.fill();
    };
    const tint = (c) => mixN(mixC(c), [20, 26, 34]);
    hill(SURFACE - 12, 34, 90, tint(['#6a9a6a', '#5a8a5a', '#a08a5a', '#a8b0b8']));
    hill(SURFACE - 4, 16, 50, tint(['#5a8a3a', '#4a7a32', '#8a7a3a', '#c8ccd4']));
    if (g.weather.k > 0.05) {
      const snow = sw[3] > 0.5;
      ctx.strokeStyle = snow ? `rgba(255,255,255,${0.7 * g.weather.k})` : `rgba(200,220,240,${0.4 * g.weather.k})`; ctx.lineWidth = snow ? 2 : 1;
      for (let i = 0; i < 90; i++) {
        const rx = v.x0 + ((i * 97 + t * (snow ? 40 : 400)) % (v.x1 - v.x0)), ry = v.y0 + ((i * 53 + t * (snow ? 60 : 700)) % (SURFACE - v.y0));
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - (snow ? 1 : 4), ry + (snow ? 2 : 12)); ctx.stroke();
      }
    }
    // the turf edge: topsoil band, then swaying grass in the season's colours
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(v.x0, SURFACE - 3, v.x1 - v.x0, 8);
    ctx.lineCap = 'round';
    const grassPal = [['#5e9a32', '#7ab840', '#4a8a28', '#88c84a'], ['#4e7a2a', '#5e8e32', '#3e6a22', '#6a9a3a'], ['#a8902e', '#c0a040', '#8a6a24', '#b88a30'], ['#8a8a6a', '#a09a80', '#7a7a60', '#b0a890']];
    const cols = [0, 1, 2, 3].map((k) => { const c = mixC(grassPal.map((p) => p[k])); return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; });
    for (let bx = Math.floor(v.x0 / 3.86) * 3.86; bx < v.x1; bx += 3.86) {
      const k = Math.round(bx / 3.86) & 0xffff, h = 8 + ((k * 37) % 17);
      if (Math.abs(bx - 500) < 70) continue;
      const sway = Math.sin(t * 1.4 + k * 0.7) * 2;
      ctx.strokeStyle = cols[k % 4]; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(bx, SURFACE); ctx.quadraticCurveTo(bx + sway * 0.4, SURFACE - h * 0.6, bx + sway, SURFACE - h); ctx.stroke();
    }
    // the nest mound over the entrance
    const mg = ctx.createRadialGradient(480, SURFACE - 22, 4, 500, SURFACE, 100);
    mg.addColorStop(0, '#9a7650'); mg.addColorStop(0.6, '#6a4a2a'); mg.addColorStop(1, '#4a321c');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(500, SURFACE + 2, 92, 28, 0, Math.PI, TAU); ctx.fill();
    const R = mulberry32(5);
    for (let i = 0; i < 90; i++) {
      const a = Math.PI + R() * Math.PI, d = Math.sqrt(R());
      soilGrain(ctx, 500 + Math.cos(a) * 88 * d, SURFACE + 2 + Math.sin(a) * 26 * d, 1 + R() * 1.5, ['#8a6a48', '#6a4a2a', '#a88458'][(R() * 3) | 0], R() * 3);
    }
    ctx.fillStyle = '#120a04'; ctx.beginPath(); ctx.ellipse(500, SURFACE - 4, 10, 4, 0, 0, TAU); ctx.fill();
    if (sw[3] > 0.02) {
      ctx.fillStyle = `rgba(245,250,255,${0.92 * sw[3]})`;
      ctx.beginPath(); ctx.moveTo(v.x0, SURFACE - 4);
      for (let px = v.x0; px <= v.x1 + 20; px += 20) ctx.lineTo(px, SURFACE - 7 - Math.sin(px * 0.085) * 3 - (Math.abs(px - 500) < 90 ? 22 * Math.cos(((px - 500) / 90) * Math.PI / 2) : 0));
      ctx.lineTo(v.x1 + 20, SURFACE); ctx.lineTo(v.x0, SURFACE); ctx.closePath(); ctx.fill();
    }
  }

  render(ctx) {
    const g = this.game, t = g.time, home = g.home;
    const { s, ox, oy } = this.layout();
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.fillStyle = '#140d07';
    ctx.fillRect(0, 0, g.vw, g.vh);
    this.buildBg(s);
    this.buildCavities(s);
    ctx.drawImage(this.bg, ox + NEST_BX0 * s, oy, (NEST_BX1 - NEST_BX0) * s, NEST_BY1 * s);
    ctx.setTransform(g.dpr * s, 0, 0, g.dpr * s, g.dpr * ox, g.dpr * oy);
    // the visible part of the world, in nest coordinates
    const v = { x0: -ox / s, x1: (g.vw - ox) / s, y0: -oy / s, y1: (g.vh - oy) / s };
    this.renderSky(ctx, v, t);
    ctx.drawImage(this.cav, 0, 0, NEST_W, NEST_H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // rooms
    for (const k in NEST_ROOMS) this.drawRoom(ctx, k, t);
    // workers carrying brood and food between chambers
    for (const c of this.couriers) {
      drawAnt(ctx, { x: c.x, y: c.y, a: c.a, size: 1.5 * home.sp.shape.size, sp: home.species, role: 'worker', gait: c.gait, hurtT: 0, greetT: 0, biteT: 0, id: c.id, carry: null }, t);
      const hx = c.x + Math.cos(c.a) * 16, hy = c.y + Math.sin(c.a) * 16;
      if (c.carry === 'egg') this.egg(ctx, hx, hy, 1.1);
      else if (c.carry === 'husk') { ctx.fillStyle = '#6a5d50'; ctx.beginPath(); ctx.ellipse(hx, hy, 5, 2.5, c.a, 0, TAU); ctx.fill(); }
      else this.crumb(ctx, hx, hy, c.id);
    }
    // workers walking the tunnels
    for (const ag of this.agents) {
      const e = { x: ag.x, y: ag.y, a: ag.a, size: 1.5 * home.sp.shape.size, sp: home.species, role: 'worker', gait: ag.gait, hurtT: 0, greetT: ag.wait > 0 ? 1 : 0, biteT: 0, id: ag.id, carry: null };
      drawAnt(ctx, e, t);
      if (ag.carry) {
        const hx = ag.x + Math.cos(ag.a) * 16, hy = ag.y + Math.sin(ag.a) * 16;
        if (ag.carry === 'egg') this.egg(ctx, hx, hy, 1);
        else this.crumb(ctx, hx, hy, ag.id);
      }
    }
    // trickles of soil from the ceilings
    ctx.fillStyle = 'rgba(160,120,80,0.8)';
    for (const d of this.drips) { ctx.beginPath(); ctx.arc(d.x, d.y, 0.9, 0, TAU); ctx.fill(); }
    // light spilling down the entrance shaft, dust drifting in it
    const dark = g.darkness();
    const light = ctx.createRadialGradient(500, SURFACE, 10, 500, SURFACE + 60, 420);
    light.addColorStop(0, `rgba(255,230,170,${0.2 * (1 - dark)})`); light.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = light; ctx.fillRect(v.x0, SURFACE, v.x1 - v.x0, NEST_H - SURFACE);
    for (const m of this.motes) {
      const near = 1 - Math.min(1, Math.abs(m.x - 500) / 260);
      ctx.fillStyle = `rgba(255,236,190,${(0.15 + 0.2 * Math.sin(t * 2 + m.p)) * (0.4 + near)})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, 0.9, 0, TAU); ctx.fill();
    }
    // the world darkens towards the edges of the view
    const cx = (v.x0 + v.x1) / 2, cy = (SURFACE + v.y1) / 2;
    const vg = ctx.createRadialGradient(cx, cy, Math.max(300, (v.x1 - v.x0) * 0.32), cx, cy, Math.max(700, (v.x1 - v.x0) * 0.7));
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(v.x0, SURFACE, v.x1 - v.x0, v.y1 - SURFACE);
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  }

  /* -------------------------------------------------------------- brood */

  egg(ctx, x, y, k) {
    ctx.fillStyle = 'rgba(30,20,10,0.25)'; ctx.beginPath(); ctx.ellipse(x + 0.6 * k, y + 1.2 * k, 3.4 * k, 2 * k, 0.3, 0, TAU); ctx.fill();
    const gr = ctx.createRadialGradient(x - 1 * k, y - 1 * k, 0.3, x, y, 4 * k);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#f4eedc'); gr.addColorStop(1, '#c8bea0');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, 3.4 * k, 2.3 * k, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - 1.2 * k, y - 0.8 * k, 0.7 * k, 0, TAU); ctx.fill();
  }

  larva(ctx, x, y, k) {
    // a plump, segmented grub curled into a C, with its little head tucked in
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(30,20,10,0.25)'; ctx.beginPath(); ctx.ellipse(1, 3, 7, 3.5, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = 0.35 + i * 0.62, r = 4.6, sx = Math.cos(a) * r, sy = Math.sin(a) * r, w = 3.4 - Math.abs(i - 4) * 0.25;
      const gr = ctx.createRadialGradient(sx - 1, sy - 1, 0.2, sx, sy, w);
      gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.7, '#efe4c8'); gr.addColorStop(1, '#c8b890');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, w, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#c89a60'; ctx.beginPath(); ctx.arc(Math.cos(0.35) * 4.6 + 1.5, Math.sin(0.35) * 4.6 - 1, 1.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,180,140,0.6)'; ctx.lineWidth = 0.3;
    for (let i = 0; i < 8; i++) { const a = 0.6 + i * 0.6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5); ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke(); }
    ctx.restore();
  }

  pupa(ctx, x, y, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = 'rgba(30,20,10,0.3)'; ctx.beginPath(); ctx.ellipse(1, 2.5, 10, 4.5, 0, 0, TAU); ctx.fill();
    const gr = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, 10);
    gr.addColorStop(0, '#f4e2b8'); gr.addColorStop(0.7, '#d0b07a'); gr.addColorStop(1, '#9a7a4a');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, 10, 5.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(110,80,40,0.3)'; ctx.lineWidth = 0.5;
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 2.6, -5); ctx.quadraticCurveTo(k * 2.6 + 1, 0, k * 2.6, 5); ctx.stroke(); }
    ctx.fillStyle = 'rgba(60,40,20,0.5)'; ctx.beginPath(); ctx.arc(-8.5, 0, 1, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,230,0.55)'; ctx.beginPath(); ctx.ellipse(-2, -2.5, 4, 1.2, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  crumb(ctx, x, y, seed) {
    const R = mulberry32(seed | 0);
    const kind = R();
    if (kind < 0.4) radialFill(ctx, x, y, 3.6, [[0, '#f4dca0'], [0.7, '#d4ac64'], [1, '#8a6a34']]);
    else if (kind < 0.75) { ctx.save(); ctx.translate(x, y); ctx.rotate(R() * 3); shadedEllipse(ctx, 0, 0, 4, 2, ['#3a3028', '#8a7a68', '#140e08'], LIGHT); ctx.restore(); }
    else radialFill(ctx, x, y, 3, [[0, '#fff0b0'], [0.5, '#ffc444'], [1, '#b8700a']]);
  }

  drawRoom(ctx, k, t) {
    const g = this.game, home = g.home;
    const key = this.roomKey(k), [x, y] = NEST_NODES[k], r = NEST_ROOMS[k];
    const lvl = home.chambers[key], open = lvl > 0;
    const hot = this.hover === k || this.selected === k;
    if (!open) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = hot ? 'rgba(255,214,120,0.9)' : 'rgba(240,220,180,0.4)'; ctx.lineWidth = 2;
      blobPath(ctx, x, y, r.rx, r.ry, x * 0.01); ctx.stroke();
      ctx.setLineDash([]);
      if (hot) { ctx.fillStyle = 'rgba(255,214,120,0.08)'; blobPath(ctx, x, y, r.rx, r.ry, x * 0.01); ctx.fill(); }
      ctx.fillStyle = 'rgba(240,220,180,0.85)';
      ctx.font = '700 15px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`Dig ${CHAMBERS[key].name.toLowerCase()}`, x, y - 2);
      ctx.font = '400 13px "Atkinson Hyperlegible", sans-serif';
      ctx.fillText(`${home.upgradeCost(key)} food`, x, y + 16);
      return;
    }
    if (hot) {
      ctx.strokeStyle = 'rgba(255,214,120,0.8)'; ctx.lineWidth = 2.5;
      blobPath(ctx, x, y, r.rx + 3, r.ry + 3, x * 0.01); ctx.stroke();
    }
    ctx.save();
    blobPath(ctx, x, y, r.rx, r.ry, x * 0.01, 0.98); ctx.clip();
    const floor = y + r.ry * 0.38;
    const sp = home.species;
    const ant = (o) => drawAnt(ctx, { role: 'worker', hurtT: 0, greetT: 0, biteT: 0, gait: 1, sp, size: 1.4 * home.sp.shape.size, ...o }, t);
    switch (key) {
      case 'royal': {
        // a warm pool of light around the queen and her retinue
        radialFill(ctx, x + 10, floor - 14, r.rx * 0.9, [[0, `rgba(255,200,120,${0.16 + 0.03 * Math.sin(t * 1.5)})`], [1, 'rgba(255,200,120,0)']]);
        const breathe = 1 + Math.sin(t * 2) * 0.02;
        const eggs = home.brood.filter((b) => b.stage === 'egg').length + 4;
        // the eggs she has just laid, in a little heap behind her
        for (let i = 0; i < eggs; i++) { const row = Math.floor(Math.sqrt(i * 2)); this.egg(ctx, x - 68 + (i * 7.3) % 34 + row * 2, floor - 2 - row * 4, 1.15); }
        drawAnt(ctx, { x: x + 10, y: floor - 16, a: Math.PI + 0.1, size: 3.1 * breathe * home.sp.shape.size, sp, queen: true, role: 'worker', gait: 0.3, hurtT: 0, greetT: 1, biteT: 0, id: 1 }, t);
        // attendants feed and groom her, one carries eggs away
        for (let i = 0; i < 3; i++) {
          const a = t * 0.5 + i * (TAU / 3);
          ant({ x: x + 14 + Math.cos(a) * 72, y: floor - 14 + Math.sin(a) * 8, a: a + Math.PI / 2, gait: t * 8, greetT: 1, id: 5 + i });
        }
        break;
      }
      case 'nursery': {
        const list = home.brood;
        // eggs in a pile, larvae lying in rows, pupae stacked at the far end, as nurses sort them
        const eggs = list.filter((b) => b.stage === 'egg'), larvae = list.filter((b) => b.stage === 'larva'), pupae = list.filter((b) => b.stage !== 'egg' && b.stage !== 'larva');
        eggs.forEach((b, i) => { const row = Math.floor(Math.sqrt(i * 2.2)); this.egg(ctx, x - r.rx + 30 + (i * 6.7) % 30 + row * 2, floor - row * 4, 1.4); });
        larvae.forEach((b, i) => { this.larva(ctx, x - 30 + (i % 4) * 22, floor - 6 - Math.floor(i / 4) * 16, 0.9 + clamp((b.t - 5) / 14, 0, 0.6)); if (b.role === 'soldier') { ctx.fillStyle = 'rgba(255,140,100,0.85)'; ctx.beginPath(); ctx.arc(x - 30 + (i % 4) * 22, floor - 18 - Math.floor(i / 4) * 16, 2, 0, TAU); ctx.fill(); } });
        pupae.forEach((b, i) => this.pupa(ctx, x + r.rx - 30 - (i % 3) * 22, floor - 5 - Math.floor(i / 3) * 11, 0.15 * (i % 2 ? 1 : -1)));
        if (list.length) for (let i = 0; i < 2; i++) ant({ x: x - 20 + i * 60 + Math.sin(t * 0.7 + i) * 20, y: floor - 16, a: Math.sin(t * 0.7 + i) > 0 ? 0.1 : Math.PI - 0.1, gait: t * 6, greetT: 1, id: 80 + i });
        if (!list.length) {
          ctx.fillStyle = 'rgba(240,220,180,0.55)'; ctx.font = '400 13px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('No brood. The queen needs food to lay.', x, y - 4);
        }
        break;
      }
      case 'granary': {
        // a heap of seeds, crumbs and sugar that grows with the stores
        const fill = home.food / Math.max(1, home.foodCap), n = Math.round(fill * 120);
        const R = mulberry32(7), hh = r.ry * 0.95 * Math.sqrt(fill);
        const items = [];
        for (let i = 0; i < n; i++) {
          const u = (R() - 0.5) * 2, py = floor + 6 - R() * hh * (1 - u * u);
          items.push([x + u * r.rx * 0.85, py, R()]);
        }
        items.sort((a, b) => a[1] - b[1]);
        for (const [px, py, kd] of items) {
          if (kd < 0.35) radialFill(ctx, px, py, 3.6, [[0, '#f4dca0'], [0.7, '#d4ac64'], [1, '#8a6a34']]);
          else if (kd < 0.7) {
            ctx.save(); ctx.translate(px, py); ctx.rotate(kd * 20);
            shadedEllipse(ctx, 0, 0, 4.4, 2.2, ['#3a3028', '#8a7a68', '#140e08'], LIGHT);
            ctx.strokeStyle = 'rgba(230,220,200,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(3.5, 0); ctx.stroke();
            ctx.restore();
          } else radialFill(ctx, px, py, 3.2, [[0, '#fff4c0'], [0.5, '#ffc444'], [1, '#b8700a']]);
        }
        ant({ x: x + r.rx * 0.6, y: floor - 10, a: Math.PI, gait: t * 4, id: 90 });
        break;
      }
      case 'barracks': {
        const n = Math.min(8, g.counts.homeSoldiers);
        for (let i = 0; i < n; i++) ant({ x: x - 70 + i * 20, y: floor - 10 - (i % 2) * 8, a: -Math.PI / 2 + (i % 3 - 1) * 0.3, size: 1.3 * 1.3 * home.sp.shape.size, role: 'soldier', id: 20 + i });
        break;
      }
      case 'infirmary': {
        radialFill(ctx, x, y, r.rx * 0.8, [[0, `rgba(180,255,170,${0.16 + 0.06 * Math.sin(t * 2)})`], [1, 'rgba(180,255,170,0)']]);
        ant({ x: x - 20, y: floor - 10, a: 0.1, gait: 0.5, id: 30 });
        ant({ x: x + 16, y: floor - 12, a: Math.PI - 0.2, gait: t * 3, greetT: 1, id: 31 });
        break;
      }
      case 'fungus': {
        // a spongy grey-white garden, built up in lumps, with leaf mulch at its base
        const R = mulberry32(9);
        const n = 40 + lvl * 30;
        const leaves = Math.min(30, Math.ceil(home.leaves));
        for (let i = 0; i < leaves; i++) {
          ctx.fillStyle = ['#6aa040', '#4e8a30', '#8aa848'][i % 3];
          ctx.beginPath(); ctx.ellipse(x - r.rx + 20 + (i % 10) * 9, floor + 2 - Math.floor(i / 10) * 5, 4, 2.4, i, 0, TAU); ctx.fill();
        }
        for (let i = 0; i < n; i++) {
          const u = (R() - 0.5) * 2, px = x + u * r.rx * 0.75, py = floor - R() * r.ry * (0.5 + lvl * 0.2) * (1 - u * u * 0.6);
          const rr = 6 + R() * 9;
          radialFill(ctx, px + 1, py + 2, rr, [[0, 'rgba(60,50,40,0.25)'], [1, 'rgba(60,50,40,0)']]);
          radialFill(ctx, px, py, rr, [[0, '#f8f4ea'], [0.6, '#d8d0c0'], [1, 'rgba(170,160,145,0)']]);
        }
        ctx.fillStyle = 'rgba(255,255,250,0.85)';
        for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(x + (R() - 0.5) * r.rx * 1.3, floor - R() * r.ry * 0.7, 0.9, 0, TAU); ctx.fill(); }
        ant({ x: x - 30 + Math.sin(t * 0.6) * 30, y: floor - r.ry * 0.5, a: Math.sin(t * 0.6) > 0 ? 0 : Math.PI, gait: t * 5, size: 1.1 * home.sp.shape.size, id: 95 });
        break;
      }
      case 'midden': {
        const R = mulberry32(13);
        for (let i = 0; i < 70 + lvl * 30; i++) {
          const u = (R() - 0.5) * 2, px = x + u * r.rx * 0.8, py = floor + 4 - R() * r.ry * 0.9 * (1 - u * u);
          ctx.fillStyle = ['#5a5048', '#6a5d50', '#3a3028', '#7a6a50', '#4a4030'][(R() * 5) | 0];
          ctx.beginPath(); ctx.ellipse(px, py, 1.5 + R() * 3, 1 + R() * 1.5, R() * 3, 0, TAU); ctx.fill();
        }
        for (let i = 0; i < 3; i++) drawAnt(ctx, { x: x - 40 + i * 40, y: floor - 4, a: i, size: 1.1, sp, husk: true, role: 'worker', gait: 0, hurtT: 0, greetT: 0, biteT: 0, id: 60 + i }, t);
        break;
      }
      case 'winter': {
        const n = g.season === 3 ? 18 : 6;
        for (let i = 0; i < n; i++) {
          const a = i * 2.4, d = Math.sqrt(i / n) * r.rx * 0.6;
          ant({ x: x + Math.cos(a) * d, y: floor - 10 + Math.sin(a) * d * 0.25, a: a + Math.PI / 2, size: 1.2 * home.sp.shape.size, greetT: g.season === 3 ? 0 : 1, id: 70 + i });
        }
        if (g.season === 3) radialFill(ctx, x, y, r.rx, [[0, 'rgba(200,230,255,0.12)'], [1, 'rgba(200,230,255,0)']]);
        break;
      }
      case 'honeypot': {
        // repletes hang from the ceiling, abdomens swollen with honey and glowing amber
        for (let i = 0; i < lvl * 4; i++) {
          const px = x - r.rx * 0.7 + i * (r.rx * 1.4 / Math.max(1, lvl * 4 - 1)), py = y - r.ry + 16;
          drawAnt(ctx, { x: px, y: py - 6, a: -Math.PI / 2, size: 1.1, sp, role: 'worker', gait: 1, hurtT: 0, greetT: 0, biteT: 0, id: 40 + i }, t);
          radialFill(ctx, px + 2, py + 17, 12, [[0, 'rgba(40,20,0,0.3)'], [1, 'rgba(40,20,0,0)']]);
          radialFill(ctx, px, py + 14, 11, [[0, '#ffe9a0'], [0.45, '#f0a828'], [1, '#8a5008']]);
          radialFill(ctx, px, py + 14, 18, [[0, 'rgba(255,200,90,0.18)'], [1, 'rgba(255,200,90,0)']]);
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(px - 3, py + 10, 2.4, 0, TAU); ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(250,236,200,0.92)';
    ctx.font = '800 15px Sniglet, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
    ctx.fillText(CHAMBERS[key].name, x, y - r.ry - 12);
    ctx.restore();
    for (let i = 0; i < CHAMBERS[key].max; i++) {
      ctx.fillStyle = i < lvl ? '#f4b740' : 'rgba(250,236,200,0.25)';
      ctx.beginPath(); ctx.arc(x - (CHAMBERS[key].max - 1) * 6 + i * 12, y - r.ry - 2, 3.5, 0, TAU); ctx.fill();
    }
  }
}
