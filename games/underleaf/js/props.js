'use strict';
/* Scenery art baked into the ground chunks. */

const TUFT_GREEN = ['#4d7d29', '#5b8f30', '#6aa03a', '#7cae45', '#3e6c22', '#88b850'];
const TUFT_DRY = ['#9a9a4e', '#b0a85c', '#8a8a40', '#c2b66a'];
const TUFT_DARK = ['#3b6420', '#47722a', '#355a1c', '#557f30', '#2f5218'];
const LEAF_COLS = [
  ['#6f9a3a', '#a2c95a', '#4a6d24'],
  ['#c9a43a', '#ecd070', '#8f6d1e'],
  ['#c4652a', '#ec9a5e', '#7d3a14'],
  ['#8a5a32', '#bb8a5e', '#4f3018'],
  ['#a0903c', '#ccbe6a', '#5f5420'],
];
const PEB_COLS = ['#9b968b', '#a8957a', '#8b9198', '#b0a89a', '#7f7a70'];

const TUFT_DUNE = ['#8aa070', '#9ab27c', '#7a9264', '#a8bc88'];

function radialFill(g, x, y, r, stops) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

function propMoss(g, p) {
  const R = mulberry32(p.seed);
  const cols = ['#4f7a25', '#3e6a1e', '#6a9a32', '#86b440', '#5a8a2c'];
  for (let i = 0; i < 110; i++) {
    const a = R() * TAU, d = Math.pow(R(), 0.7) * p.r;
    g.fillStyle = rgba(cols[(R() * cols.length) | 0], 0.75);
    g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.8, 1 + R() * 2.6, 0, TAU); g.fill();
  }
}

function leafPath(g, l, w) {
  g.beginPath();
  g.moveTo(-l / 2, 0);
  g.bezierCurveTo(-l * 0.25, -w * 1.15, l * 0.22, -w * 1.0, l / 2, 0);
  g.bezierCurveTo(l * 0.22, w * 1.0, -l * 0.25, w * 1.15, -l / 2, 0);
  g.closePath();
}

function propLeaf(g, p) {
  const R = mulberry32(p.seed);
  const l = p.len, w = l * (0.22 + R() * 0.14), col = LEAF_COLS[p.col];
  g.save();
  g.translate(p.x, p.y);
  const so = rotV(3, 4, -p.rot);
  g.rotate(p.rot);
  g.save(); g.translate(so[0], so[1]); leafPath(g, l, w); g.fillStyle = 'rgba(20,25,5,0.26)'; g.fill(); g.restore();
  leafPath(g, l, w);
  const lg = g.createLinearGradient(0, -w, 0, w);
  lg.addColorStop(0, col[1]); lg.addColorStop(0.5, col[0]); lg.addColorStop(1, col[2]);
  g.fillStyle = lg; g.fill();
  g.strokeStyle = 'rgba(40,30,10,0.25)'; g.lineWidth = 0.7; g.stroke();
  g.strokeStyle = 'rgba(255,245,210,0.4)'; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(-l / 2, 0); g.quadraticCurveTo(0, w * 0.06, l * 0.47, 0); g.stroke();
  g.lineWidth = 0.55; g.strokeStyle = 'rgba(255,245,210,0.28)';
  for (let k = 1; k <= 6; k++) {
    const x = -l / 2 + (k * l) / 7.2;
    const hw = w * 0.8 * Math.sin((Math.PI * (x + l / 2)) / l);
    for (const side of [-1, 1]) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + l * 0.05, side * hw * 0.5, x + l * 0.1, side * hw); g.stroke(); }
  }
  g.strokeStyle = col[2]; g.lineWidth = 1.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-l / 2, 0); g.lineTo(-l / 2 - l * 0.12, R() * 3 - 1.5); g.stroke();
  for (let k = 0; k < 2; k++) {
    g.fillStyle = 'rgba(90,50,20,0.22)';
    g.beginPath(); g.arc((R() - 0.5) * l * 0.5, (R() - 0.5) * w * 0.8, 1.5 + R() * 3, 0, TAU); g.fill();
  }
  g.restore();
}

function propTwig(g, p) {
  const R = mulberry32(p.seed);
  const len = p.len, wd = 3 + R() * 3.5;
  const pts = [[-len / 2, 0], [-len / 6, (R() - 0.5) * 8], [len / 6, (R() - 0.5) * 8], [len / 2, (R() - 0.5) * 6]];
  const ba = (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.4), bl = len * (0.2 + R() * 0.2);
  const bEnd = [pts[2][0] + Math.cos(ba) * bl, pts[2][1] + Math.sin(ba) * bl];
  const path = () => {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.moveTo(pts[2][0], pts[2][1]); g.lineTo(bEnd[0], bEnd[1]);
  };
  g.save();
  g.translate(p.x, p.y);
  const so = rotV(3, 4, -p.rot);
  g.rotate(p.rot);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.save(); g.translate(so[0], so[1]); path(); g.strokeStyle = 'rgba(20,20,5,0.28)'; g.lineWidth = wd; g.stroke(); g.restore();
  path(); g.strokeStyle = '#5c4330'; g.lineWidth = wd; g.stroke();
  const hl = rotV(-wd * 0.18, -wd * 0.22, -p.rot);
  g.save(); g.translate(hl[0], hl[1]); path(); g.strokeStyle = 'rgba(176,146,110,0.55)'; g.lineWidth = wd * 0.35; g.stroke(); g.restore();
  g.fillStyle = '#3e2c1e';
  for (let k = 0; k < 3; k++) { const q = pts[1 + (k % 2)]; g.beginPath(); g.arc(q[0] + (R() - 0.5) * 6, q[1], wd * 0.22, 0, TAU); g.fill(); }
  g.restore();
}

function polyPts(R, x, y, r, n, sx = 1.08, sy = 0.92) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.3, rr = r * (0.82 + R() * 0.22);
    pts.push([x + Math.cos(a) * rr * sx, y + Math.sin(a) * rr * sy]);
  }
  return pts;
}

function propPebble(g, p) {
  const R = mulberry32(p.seed);
  const r = p.pr, pts = polyPts(R, p.x, p.y, r, 9);
  g.save(); g.translate(r * 0.3, r * 0.38); smoothPoly(g, pts); g.fillStyle = 'rgba(20,22,8,0.2)'; g.fill(); g.restore();
  g.save(); g.translate(r * 0.15, r * 0.2); smoothPoly(g, pts); g.fillStyle = 'rgba(20,22,8,0.2)'; g.fill(); g.restore();
  const base = PEB_COLS[p.col];
  const gr = g.createRadialGradient(p.x - r * 0.35, p.y - r * 0.45, r * 0.1, p.x, p.y, r * 1.15);
  gr.addColorStop(0, shade(base, 0.45)); gr.addColorStop(0.55, base); gr.addColorStop(1, shade(base, -0.45));
  smoothPoly(g, pts); g.fillStyle = gr; g.fill();
  for (let i = 0; i < 10 + r; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * r * 0.75;
    g.fillStyle = R() < 0.5 ? 'rgba(40,35,30,0.25)' : 'rgba(255,255,255,0.2)';
    g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.4 + R() * 0.7, 0, TAU); g.fill();
  }
  if (r > 16 && R() < 0.5) {
    g.strokeStyle = 'rgba(40,35,30,0.3)'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(p.x - r * 0.4, p.y - r * 0.1); g.lineTo(p.x, p.y + r * 0.1); g.lineTo(p.x + r * 0.3, p.y + r * 0.35); g.stroke();
  }
  g.fillStyle = 'rgba(255,255,250,0.22)';
  g.beginPath(); g.ellipse(p.x - r * 0.35, p.y - r * 0.42, r * 0.36, r * 0.17, -0.5, 0, TAU); g.fill();
}

function propMush(g, p) {
  const R = mulberry32(p.seed);
  const r = p.cr;
  radialFill(g, p.x + r * 0.35, p.y + r * 0.45, r * 1.2, [[0, 'rgba(20,18,5,0.38)'], [1, 'rgba(20,18,5,0)']]);
  const pal = p.variant === 0 ? ['#a8703f', '#e6b47e', '#5a361a'] : p.variant === 1 ? ['#c7301c', '#ff8e6e', '#6a1008'] : ['#e8dcc4', '#fffaf0', '#a89a80'];
  const gr = g.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.05, p.x, p.y, r * 1.05);
  gr.addColorStop(0, pal[1]); gr.addColorStop(0.55, pal[0]); gr.addColorStop(1, pal[2]);
  g.fillStyle = gr;
  g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,240,220,0.25)'; g.lineWidth = r * 0.07;
  g.beginPath(); g.arc(p.x, p.y, r * 0.94, 0, TAU); g.stroke();
  if (p.variant === 1) {
    for (let i = 0; i < 8; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * r * 0.75, wr = r * (0.07 + R() * 0.08);
      g.fillStyle = 'rgba(80,10,5,0.3)';
      g.beginPath(); g.arc(p.x + Math.cos(a) * d + 0.5, p.y + Math.sin(a) * d + 0.6, wr, 0, TAU); g.fill();
      g.fillStyle = '#fff6ea';
      g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, wr, 0, TAU); g.fill();
    }
  } else if (p.variant === 0) {
    g.strokeStyle = 'rgba(60,30,10,0.18)'; g.lineWidth = 0.8;
    g.beginPath(); g.arc(p.x, p.y, r * 0.6, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(70,40,15,0.35)';
    g.beginPath(); g.arc(p.x, p.y, r * 0.22, 0, TAU); g.fill();
  } else {
    for (let i = 0; i < 12; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * r * 0.8;
      g.fillStyle = 'rgba(150,120,80,0.35)';
      g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.6 + R() * 0.8, 0, TAU); g.fill();
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath(); g.ellipse(p.x - r * 0.35, p.y - r * 0.4, r * 0.32, r * 0.16, -0.6, 0, TAU); g.fill();
}

function bladePath(g, x0, y0, mx, my, ex, ey, nx, ny, w) {
  g.beginPath();
  g.moveTo(x0 + nx * w, y0 + ny * w);
  g.quadraticCurveTo(mx + nx * w * 0.6, my + ny * w * 0.6, ex, ey);
  g.quadraticCurveTo(mx - nx * w * 0.6, my - ny * w * 0.6, x0 - nx * w, y0 - ny * w);
  g.closePath();
}

function propTuft(g, p) {
  const R = mulberry32(p.seed);
  const n = p.big ? 14 + ((R() * 8) | 0) : 7 + ((R() * 8) | 0);
  const pal = p.big || p.pal === 'dark' ? TUFT_DARK : p.pal === 'dry' ? TUFT_DRY : p.pal === 'dune' ? TUFT_DUNE : R() < 0.15 ? TUFT_DRY : TUFT_GREEN;
  radialFill(g, p.x + 3, p.y + 4, p.r * 0.8, [[0, 'rgba(20,30,5,0.28)'], [1, 'rgba(20,30,5,0)']]);
  const blades = [];
  for (let i = 0; i < n; i++) {
    blades.push({ a: R() * TAU, l: p.r * (0.55 + R() * 0.5), w: 1.4 + R() * 1.8, c: pal[(R() * pal.length) | 0], b: (R() - 0.5) * 0.9 });
  }
  const geo = blades.map((b) => {
    const ca = Math.cos(b.a), sa = Math.sin(b.a), nx = -sa, ny = ca;
    return {
      b, nx, ny,
      ex: p.x + ca * b.l, ey: p.y + sa * b.l,
      mx: p.x + ca * b.l * 0.5 + nx * b.b * b.l * 0.35, my: p.y + sa * b.l * 0.5 + ny * b.b * b.l * 0.35,
    };
  });
  g.fillStyle = 'rgba(25,35,8,0.22)';
  for (const q of geo) { bladePath(g, p.x + 2.5, p.y + 3.5, q.mx + 2.5, q.my + 3.5, q.ex + 2.5, q.ey + 3.5, q.nx, q.ny, q.b.w); g.fill(); }
  for (const q of geo) {
    g.fillStyle = q.b.c;
    bladePath(g, p.x, p.y, q.mx, q.my, q.ex, q.ey, q.nx, q.ny, q.b.w);
    g.fill();
    g.strokeStyle = 'rgba(232,248,184,0.22)'; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(q.mx, q.my, q.ex, q.ey); g.stroke();
  }
}

function propFlower(g, p) {
  const R = mulberry32(p.seed);
  const r = p.fr, rot = R() * TAU;
  for (let k = 0; k < 3; k++) {
    const a = rot + k * 2.1 + R() * 0.5;
    g.fillStyle = TUFT_GREEN[(R() * TUFT_GREEN.length) | 0];
    g.beginPath(); g.ellipse(p.x + Math.cos(a) * r * 1.0, p.y + Math.sin(a) * r * 1.0, r * 0.95, r * 0.34, a, 0, TAU); g.fill();
  }
  radialFill(g, p.x + 3, p.y + 4, r * 1.25, [[0, 'rgba(20,25,5,0.28)'], [1, 'rgba(20,25,5,0)']]);
  if (p.kind === 'daisy') {
    const n = 14 + ((R() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU;
      g.fillStyle = '#fbf7ec'; g.strokeStyle = 'rgba(150,140,120,0.35)'; g.lineWidth = 0.4;
      g.beginPath(); g.ellipse(p.x + Math.cos(a) * r * 0.55, p.y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.15, a, 0, TAU); g.fill(); g.stroke();
    }
    radialFill(g, p.x, p.y, r * 0.32, [[0, '#ffe65a'], [0.7, '#f0b81e'], [1, '#c98a12']]);
    g.fillStyle = 'rgba(160,100,10,0.5)';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.beginPath(); g.arc(p.x + Math.cos(a) * r * 0.18, p.y + Math.sin(a) * r * 0.18, 0.5, 0, TAU); g.fill(); }
  } else if (p.kind === 'buttercup') {
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * TAU, x = p.x + Math.cos(a) * r * 0.45, y = p.y + Math.sin(a) * r * 0.45;
      radialFill(g, x, y, r * 0.52, [[0, '#fff27a'], [0.55, '#f6c814'], [1, '#c88a08']]);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath(); g.ellipse(x - r * 0.12, y - r * 0.14, r * 0.16, r * 0.08, a, 0, TAU); g.fill();
    }
    radialFill(g, p.x, p.y, r * 0.24, [[0, '#d8e050'], [1, '#9aa020']]);
  } else if (p.kind === 'violet') {
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * TAU;
      const x = p.x + Math.cos(a) * r * 0.45, y = p.y + Math.sin(a) * r * 0.45;
      const gr = g.createRadialGradient(p.x, p.y, 0, x, y, r * 0.6);
      gr.addColorStop(0, '#5a3a9a'); gr.addColorStop(1, '#a88ae6');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x, y, r * 0.55, r * 0.38, a, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,20,80,0.4)'; g.lineWidth = 0.4;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(a) * r * 0.7, p.y + Math.sin(a) * r * 0.7); g.stroke();
    }
    radialFill(g, p.x, p.y, r * 0.22, [[0, '#ffe066'], [0.5, '#ffffff'], [1, 'rgba(255,255,255,0.6)']]);
  } else if (p.kind === 'iris') {
    for (let i = 0; i < 3; i++) {
      const a = rot + (i / 3) * TAU;
      radialFill(g, p.x + Math.cos(a) * r * 0.5, p.y + Math.sin(a) * r * 0.5, r * 0.6, [[0, '#f0e060'], [0.25, '#6a5ad8'], [1, '#3a2a9a']]);
      const b = a + Math.PI / 3;
      g.fillStyle = '#8a7ae8';
      g.beginPath(); g.ellipse(p.x + Math.cos(b) * r * 0.35, p.y + Math.sin(b) * r * 0.35, r * 0.4, r * 0.18, b, 0, TAU); g.fill();
    }
  } else {
    const cols = ['#f2b81a', '#ffd33a', '#ffe66e'];
    for (let k = 0; k < 3; k++) {
      const n = 22 - k * 5, len = r * (1.05 - k * 0.28);
      g.strokeStyle = cols[k]; g.lineWidth = 1.5; g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU + k * 0.2;
        g.beginPath(); g.moveTo(p.x + Math.cos(a) * r * 0.1, p.y + Math.sin(a) * r * 0.1); g.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len); g.stroke();
      }
    }
    radialFill(g, p.x, p.y, r * 0.18, [[0, '#ffe066'], [1, '#e8a810']]);
  }
}

function propClover(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x, p.y, p.pr * 1.25, [[0, 'rgba(35,70,20,0.5)'], [0.75, 'rgba(35,70,20,0.3)'], [1, 'rgba(35,70,20,0)']]);
  const cols = ['#3f7a2e', '#4c8c36', '#5a9a3f', '#46823a'];
  const leaves = [];
  for (let i = 0; i < 80; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * p.pr * 1.05;
    leaves.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, s: 0.8 + R() * 0.5, rot: R() * TAU, c: cols[(R() * cols.length) | 0] });
  }
  const leaflets = (L, ox, oy, fill) => {
    for (let k = 0; k < 3; k++) {
      const a = L.rot + (k * TAU) / 3;
      const cx = L.x + ox + Math.cos(a) * 4.2 * L.s, cy = L.y + oy + Math.sin(a) * 4.2 * L.s;
      g.fillStyle = fill || L.c;
      g.beginPath(); g.ellipse(cx, cy, 4.6 * L.s, 4.0 * L.s, a, 0, TAU); g.fill();
      if (!fill) {
        g.strokeStyle = 'rgba(232,246,212,0.35)'; g.lineWidth = 0.8;
        const ix = cx - Math.cos(a) * 1.2 * L.s, iy = cy - Math.sin(a) * 1.2 * L.s;
        const px = -Math.sin(a), py = Math.cos(a);
        g.beginPath();
        g.moveTo(ix + px * 2.4 * L.s, iy + py * 2.4 * L.s);
        g.lineTo(ix + Math.cos(a) * 1.6 * L.s, iy + Math.sin(a) * 1.6 * L.s);
        g.lineTo(ix - px * 2.4 * L.s, iy - py * 2.4 * L.s);
        g.stroke();
        g.strokeStyle = 'rgba(20,50,10,0.35)'; g.lineWidth = 0.4;
        g.beginPath(); g.moveTo(L.x + ox, L.y + oy); g.lineTo(cx + Math.cos(a) * 3.8 * L.s, cy + Math.sin(a) * 3.8 * L.s); g.stroke();
      }
    }
  };
  for (const L of leaves) leaflets(L, 2, 3, 'rgba(15,35,5,0.22)');
  for (const L of leaves) leaflets(L, 0, 0, null);
  for (let i = 0; i < 6; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * p.pr;
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    radialFill(g, x + 2, y + 3, 7, [[0, 'rgba(20,25,5,0.25)'], [1, 'rgba(20,25,5,0)']]);
    for (let k = 0; k < 20; k++) {
      const pa = (k / 20) * TAU;
      g.fillStyle = k % 3 ? '#fbf6ee' : '#f2d8dc';
      g.beginPath(); g.ellipse(x + Math.cos(pa) * 3.4, y + Math.sin(pa) * 3.4, 2.4, 0.9, pa, 0, TAU); g.fill();
    }
    radialFill(g, x, y, 2.4, [[0, '#f6eee0'], [1, '#d8c8b0']]);
  }
}

function propPit(g, p) {
  const R = mulberry32(p.seed);
  const r = p.pr;
  radialFill(g, p.x, p.y, r * 1.22, [[0.7, 'rgba(222,202,152,0.75)'], [1, 'rgba(222,202,152,0)']]);
  radialFill(g, p.x, p.y, r, [[0, '#3e2f1a'], [0.22, '#7d6440'], [0.65, '#c4aa76'], [1, '#dcc797']]);
  g.strokeStyle = 'rgba(90,70,40,0.14)'; g.lineWidth = 1;
  for (let k = 1; k <= 5; k++) { g.beginPath(); g.arc(p.x, p.y, (r * k) / 6, 0, TAU); g.stroke(); }
  for (let i = 0; i < 160; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * r * 1.1;
    g.fillStyle = R() < 0.5 ? 'rgba(255,245,215,0.45)' : 'rgba(90,70,40,0.35)';
    g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.5 + R() * 0.8, 0, TAU); g.fill();
  }
  g.strokeStyle = 'rgba(255,245,215,0.4)'; g.lineWidth = 2;
  g.beginPath(); g.arc(p.x, p.y, r * 0.93, Math.PI * 0.95, Math.PI * 1.6); g.stroke();
}

function nestHole(g, x, y, r) {
  radialFill(g, x + 1.5, y + 2, r * 1.35, [[0, '#030201'], [0.55, '#1a110a'], [0.8, 'rgba(40,26,14,0.6)'], [1, 'rgba(40,26,14,0)']]);
}

function propNestBlack(g, p, nr) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x, p.y, nr * 1.7, [[0, 'rgba(70,48,28,0.95)'], [0.45, 'rgba(98,72,44,0.85)'], [1, 'rgba(110,82,50,0)']]);
  const cols = ['#5a3f26', '#6e4f31', '#83623f', '#4a331f', '#9a7650', '#7a5a38'];
  for (let i = 0; i < 560; i++) {
    const a = R() * TAU, d = nr * (0.22 + Math.pow(R(), 0.75) * 1.1);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, s = 1.1 + R() * 2.6;
    g.fillStyle = 'rgba(20,12,4,0.35)';
    g.beginPath(); g.ellipse(x + 0.7, y + 0.9, s, s * 0.8, a, 0, TAU); g.fill();
    g.fillStyle = cols[(R() * cols.length) | 0];
    g.beginPath(); g.ellipse(x, y, s, s * 0.8, a, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,240,210,0.22)';
    g.beginPath(); g.arc(x - s * 0.3, y - s * 0.3, s * 0.35, 0, TAU); g.fill();
  }
  nestHole(g, p.x, p.y, 15);
  nestHole(g, p.x + 30, p.y - 20, 7);
  nestHole(g, p.x - 26, p.y + 22, 6);
}

function propNestRed(g, p, nr) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x, p.y, nr * 1.6, [[0, 'rgba(92,60,32,0.95)'], [0.6, 'rgba(100,70,40,0.8)'], [1, 'rgba(100,70,40,0)']]);
  const cols = ['#a8682e', '#8a5224', '#c88848', '#704018', '#b8783a', '#5e3a1a'];
  g.lineCap = 'round';
  for (let i = 0; i < 1100; i++) {
    const a = R() * TAU, d = nr * 1.2 * Math.sqrt(R());
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    const na = R() * TAU, l = 6 + R() * 9;
    const x2 = x + Math.cos(na) * l, y2 = y + Math.sin(na) * l;
    g.strokeStyle = 'rgba(20,10,0,0.28)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(x + 0.8, y + 1.1); g.lineTo(x2 + 0.8, y2 + 1.1); g.stroke();
    g.strokeStyle = cols[(R() * cols.length) | 0]; g.lineWidth = 0.9 + R() * 0.7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
  }
  const gr = g.createRadialGradient(p.x - nr * 0.3, p.y - nr * 0.35, 0, p.x, p.y, nr * 1.25);
  gr.addColorStop(0, 'rgba(255,225,165,0.16)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,15,5,0.3)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(p.x, p.y, nr * 1.25, 0, TAU); g.fill();
  nestHole(g, p.x, p.y, 14);
  nestHole(g, p.x + 34, p.y + 18, 7);
  nestHole(g, p.x - 30, p.y - 26, 7);
}

function propLair(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x, p.y, 80, [[0, 'rgba(30,25,15,0.4)'], [1, 'rgba(30,25,15,0)']]);
  g.lineWidth = 0.55;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + R() * 0.2, l = 40 + R() * 40;
    g.strokeStyle = 'rgba(245,245,238,0.3)';
    g.beginPath(); g.moveTo(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14); g.lineTo(p.x + Math.cos(a) * l, p.y + Math.sin(a) * l); g.stroke();
    if (R() < 0.5) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(p.x + Math.cos(a) * l * 0.7, p.y + Math.sin(a) * l * 0.7, 0.9, 0, TAU); g.fill(); }
  }
  for (let k = 0; k < 7; k++) {
    g.strokeStyle = `rgba(240,240,232,${0.38 - k * 0.04})`;
    g.beginPath(); g.arc(p.x, p.y, 15 + k * 4, R() * TAU, R() * TAU + 4); g.stroke();
  }
  radialFill(g, p.x, p.y, 17, [[0, '#020101'], [0.65, '#14100a'], [1, 'rgba(220,220,210,0.4)']]);
}


/* ------------------------------------------------------- woodland props */

function propCone(g, p) {
  const R = mulberry32(p.seed);
  g.save(); g.translate(p.x, p.y);
  const so = rotV(3, 4, -p.rot); g.rotate(p.rot);
  g.fillStyle = 'rgba(15,12,4,0.3)'; g.beginPath(); g.ellipse(so[0], so[1], p.len * 0.55, p.len * 0.3, 0, 0, TAU); g.fill();
  const rows = 7;
  for (let i = rows; i >= 0; i--) {
    const x = -p.len / 2 + (i / rows) * p.len, wdt = p.len * 0.3 * Math.sin(((i + 0.5) / (rows + 1)) * Math.PI) + 2;
    for (let side = -1; side <= 1; side += 2) {
      const gr = g.createRadialGradient(x, side * wdt * 0.4, 0.5, x, side * wdt * 0.4, wdt * 0.8);
      gr.addColorStop(0, '#b07a48'); gr.addColorStop(1, '#4a2c14');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x, side * wdt * 0.45, p.len * 0.09, wdt * 0.6, side * 0.5, 0, TAU); g.fill();
    }
  }
  g.restore();
}

function propAcorn(g, p) {
  g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
  softShadow(g, 2, 3, 0, 7, 5, 0.3);
  shadedEllipse(g, -1.5, 0, 6, 4.4, ['#a8783a', '#e8c080', '#4a2e10'], LIGHT);
  g.fillStyle = '#6a5030';
  g.beginPath(); g.ellipse(3.6, 0, 3.2, 4.8, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(40,25,10,0.5)'; g.lineWidth = 0.5;
  for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(1.5, k * 1.2); g.lineTo(6, k * 1.2); g.stroke(); }
  g.restore();
}

function propFern(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x + 4, p.y + 5, p.r * 0.8, [[0, 'rgba(15,25,5,0.3)'], [1, 'rgba(15,25,5,0)']]);
  const n = 5 + ((R() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, l = p.r * (0.7 + R() * 0.3), bend = (R() - 0.5) * 0.6;
    g.save(); g.translate(p.x, p.y); g.rotate(a);
    g.strokeStyle = '#3e6a22'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, bend * l * 0.4, l, bend * l * 0.6); g.stroke();
    for (let k = 1; k < 12; k++) {
      const f = k / 12, x = l * f, y = bend * l * 0.6 * f * f, pl = (1 - f) * l * 0.22 + 2;
      for (let side = -1; side <= 1; side += 2) {
        g.fillStyle = k % 2 ? '#5a9a34' : '#4a8a2c';
        g.beginPath(); g.ellipse(x + pl * 0.3, y + side * pl * 0.5, pl * 0.55, 1.6, side * 0.9, 0, TAU); g.fill();
      }
    }
    g.restore();
  }
}

/* ---------------------------------------------------------- shore props */

function propShell(g, p) {
  const R = mulberry32(p.seed);
  g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
  const r = p.sr;
  softShadow(g, r * 0.25, r * 0.35, 0, r * 1.05, r * 0.95, 0.28);
  if (p.kind === 'spiral') {
    shadedEllipse(g, 0, 0, r, r * 0.8, ['#d8b890', '#fff2dc', '#7a5a3a'], LIGHT);
    g.strokeStyle = 'rgba(120,80,50,0.55)'; g.lineWidth = 0.8;
    g.beginPath();
    for (let k = 0; k <= 40; k++) { const th = (k / 40) * 3 * Math.PI, rr = r * 0.9 * (1 - th / (3.4 * Math.PI)); const x = Math.cos(th) * rr, y = Math.sin(th) * rr * 0.8; k ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  } else {
    const cols = ['#f0e0cc', '#e8c4a8', '#d8d0e0', '#f4d8b8'];
    const c = cols[(R() * cols.length) | 0];
    g.beginPath(); g.moveTo(0, r * 0.7); g.bezierCurveTo(-r * 1.2, r * 0.2, -r * 0.8, -r, 0, -r); g.bezierCurveTo(r * 0.8, -r, r * 1.2, r * 0.2, 0, r * 0.7); g.closePath();
    const gr = g.createRadialGradient(-r * 0.3, -r * 0.4, 0.5, 0, 0, r * 1.1);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.35));
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(120,90,70,0.4)'; g.lineWidth = 0.5;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(0, r * 0.65); g.lineTo(k * r * 0.25, -r * 0.92); g.stroke(); }
  }
  g.restore();
}

function propWeed(g, p) {
  const R = mulberry32(p.seed);
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = p.rot + (R() - 0.5) * 1.2, l = p.r * (0.6 + R() * 0.5);
    g.strokeStyle = R() < 0.5 ? 'rgba(70,80,30,0.85)' : 'rgba(90,70,30,0.85)'; g.lineWidth = 2 + R() * 2.5;
    g.beginPath(); g.moveTo(p.x, p.y);
    g.bezierCurveTo(p.x + Math.cos(a) * l * 0.3 + (R() - 0.5) * 12, p.y + Math.sin(a) * l * 0.3 + (R() - 0.5) * 12, p.x + Math.cos(a) * l * 0.7 + (R() - 0.5) * 12, p.y + Math.sin(a) * l * 0.7 + (R() - 0.5) * 12, p.x + Math.cos(a) * l, p.y + Math.sin(a) * l);
    g.stroke();
    g.fillStyle = 'rgba(110,100,40,0.8)';
    g.beginPath(); g.arc(p.x + Math.cos(a) * l * 0.6, p.y + Math.sin(a) * l * 0.6, 1.8, 0, TAU); g.fill();
  }
}

function propRipple(g, p) {
  g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
  for (let k = -3; k <= 3; k++) {
    g.strokeStyle = 'rgba(120,95,60,0.18)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-p.r, k * 9); g.bezierCurveTo(-p.r * 0.3, k * 9 - 5, p.r * 0.3, k * 9 + 5, p.r, k * 9); g.stroke();
    g.strokeStyle = 'rgba(255,248,225,0.18)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-p.r, k * 9 - 2); g.bezierCurveTo(-p.r * 0.3, k * 9 - 7, p.r * 0.3, k * 9 + 3, p.r, k * 9 - 2); g.stroke();
  }
  g.restore();
}

function propCrabhole(g, p) {
  const R = mulberry32(p.seed);
  for (let i = 0; i < 40; i++) {
    const a = R() * TAU, d = 10 + R() * 22;
    g.fillStyle = R() < 0.5 ? 'rgba(200,180,140,0.9)' : 'rgba(170,150,110,0.9)';
    g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.4 + R(), 0, TAU); g.fill();
  }
  radialFill(g, p.x, p.y, 10, [[0, '#2a2014'], [0.7, '#5a4a30'], [1, 'rgba(90,74,48,0)']]);
}

/* ---------------------------------------------------------- marsh props */

function propReed(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x + 4, p.y + 5, p.r * 0.7, [[0, 'rgba(15,25,5,0.3)'], [1, 'rgba(15,25,5,0)']]);
  const n = 8 + ((R() * 6) | 0);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, l = p.r * (0.6 + R() * 0.5);
    g.strokeStyle = R() < 0.5 ? '#5a7a30' : '#6a8a3a'; g.lineWidth = 2 + R() * 1.5;
    g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 8, p.y + Math.sin(a) * l * 0.5 + (R() - 0.5) * 8, p.x + Math.cos(a) * l, p.y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const x = p.x + (R() - 0.5) * p.r * 0.5, y = p.y + (R() - 0.5) * p.r * 0.5, a = R() * TAU;
    g.save(); g.translate(x, y); g.rotate(a);
    shadedEllipse(g, 0, 0, 8, 3, ['#6a4224', '#a87a50', '#2a160a'], LIGHT);
    g.restore();
  }
}

function propMud(g, p) {
  radialFill(g, p.x, p.y, p.r, [[0, 'rgba(50,40,24,0.55)'], [0.7, 'rgba(60,48,28,0.35)'], [1, 'rgba(60,48,28,0)']]);
  const R = mulberry32(p.seed);
  g.fillStyle = 'rgba(200,210,220,0.15)';
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(p.x + (R() - 0.5) * p.r, p.y + (R() - 0.5) * p.r, 4 + R() * 8, 2 + R() * 3, R() * 3, 0, TAU); g.fill(); }
}

function propLily(g, p) {
  const R = mulberry32(p.seed);
  const r = p.lr, a = p.rot;
  g.fillStyle = 'rgba(10,30,20,0.3)';
  g.beginPath(); g.moveTo(p.x + 3, p.y + 4); g.arc(p.x + 3, p.y + 4, r, a + 0.3, a + TAU - 0.3); g.closePath(); g.fill();
  const lg = g.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 1, p.x, p.y, r);
  lg.addColorStop(0, '#8cc45a'); lg.addColorStop(1, '#3f7a2e');
  g.fillStyle = lg;
  g.beginPath(); g.moveTo(p.x, p.y); g.arc(p.x, p.y, r, a + 0.3, a + TAU - 0.3); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(220,245,190,0.3)'; g.lineWidth = 0.6;
  for (let k = 0; k < 7; k++) { const va = a + 0.5 + k * 0.8; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(va) * r * 0.9, p.y + Math.sin(va) * r * 0.9); g.stroke(); }
  if (R() < 0.3) {
    for (let k = 0; k < 10; k++) {
      const pa = (k / 10) * TAU;
      g.fillStyle = k % 2 ? '#f6c8d6' : '#fbe4ea';
      g.beginPath(); g.ellipse(p.x + Math.cos(pa) * 4, p.y + Math.sin(pa) * 4, 4.2, 1.8, pa, 0, TAU); g.fill();
    }
    radialFill(g, p.x, p.y, 2.5, [[0, '#ffe066'], [1, '#e8a810']]);
  }
}

/* ------------------------------------------------------------ dry props */

function propRock(g, p) {
  const R = mulberry32(p.seed);
  const r = p.pr, pts = polyPts(R, p.x, p.y, r, 11, 1.12, 0.9);
  g.save(); g.translate(r * 0.3, r * 0.4); smoothPoly(g, pts); g.fillStyle = 'rgba(20,18,6,0.28)'; g.fill(); g.restore();
  const base = ['#8a8070', '#9a8a74', '#7a7a78'][(R() * 3) | 0];
  const gr = g.createRadialGradient(p.x - r * 0.4, p.y - r * 0.5, r * 0.1, p.x, p.y, r * 1.2);
  gr.addColorStop(0, shade(base, 0.5)); gr.addColorStop(0.5, base); gr.addColorStop(1, shade(base, -0.5));
  smoothPoly(g, pts); g.fillStyle = gr; g.fill();
  g.save(); smoothPoly(g, pts); g.clip();
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = 'rgba(30,25,20,0.35)'; g.lineWidth = 0.9;
    let x = p.x + (R() - 0.5) * r, y = p.y + (R() - 0.5) * r;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (R() - 0.5) * r * 0.5; y += (R() - 0.5) * r * 0.5; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 5; i++) {
    g.fillStyle = 'rgba(190,200,120,0.5)';
    g.beginPath(); g.arc(p.x + (R() - 0.5) * r, p.y + (R() - 0.5) * r, 2 + R() * 5, 0, TAU); g.fill();
  }
  g.restore();
}

function propThistle(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x + 3, p.y + 4, p.r, [[0, 'rgba(15,20,5,0.3)'], [1, 'rgba(15,20,5,0)']]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + R() * 0.3, l = p.r * (0.8 + R() * 0.3);
    g.save(); g.translate(p.x, p.y); g.rotate(a);
    g.fillStyle = i % 2 ? '#6a8a5a' : '#5a7a4a';
    g.beginPath(); g.moveTo(0, 0);
    for (let k = 1; k <= 5; k++) { const x = (k / 5) * l; g.lineTo(x - l * 0.08, -l * 0.13); g.lineTo(x, -l * 0.04); }
    for (let k = 5; k >= 1; k--) { const x = (k / 5) * l; g.lineTo(x, l * 0.04); g.lineTo(x - l * 0.08, l * 0.13); }
    g.closePath(); g.fill();
    g.restore();
  }
  radialFill(g, p.x, p.y, p.r * 0.32, [[0, '#d07ad8'], [0.6, '#9a3aa8'], [1, '#5a7a4a']]);
}

function propCrack(g, p) {
  const R = mulberry32(p.seed);
  g.strokeStyle = 'rgba(60,45,25,0.4)'; g.lineWidth = 1.2; g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    let x = p.x, y = p.y, a = R() * TAU;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { a += (R() - 0.5) * 1.2; x += Math.cos(a) * p.r / 6; y += Math.sin(a) * p.r / 6; g.lineTo(x, y); }
    g.stroke();
  }
}

/* ---------------------------------------------------------- ant nests */

function propNestBare(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x, p.y, 150, [[0, 'rgba(150,90,50,0.95)'], [0.6, 'rgba(140,86,50,0.75)'], [1, 'rgba(140,86,50,0)']]);
  for (let i = 0; i < 400; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * 120;
    g.fillStyle = R() < 0.5 ? 'rgba(190,120,70,0.7)' : 'rgba(100,60,30,0.6)';
    g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.8 + R() * 1.8, 0, TAU); g.fill();
  }
  for (let i = 0; i < 9; i++) {
    const a = R() * TAU, d = i === 0 ? 0 : 30 + R() * 70;
    nestHole(g, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, i === 0 ? 14 : 6 + R() * 4);
  }
}

function propNestDome(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x + 10, p.y + 14, 110, [[0, 'rgba(20,14,5,0.4)'], [1, 'rgba(20,14,5,0)']]);
  const gr = g.createRadialGradient(p.x - 30, p.y - 36, 6, p.x, p.y, 95);
  gr.addColorStop(0, '#c09a6c'); gr.addColorStop(0.55, '#8a6640'); gr.addColorStop(1, 'rgba(90,64,38,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, 95, 0, TAU); g.fill();
  for (let i = 0; i < 700; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * 85;
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, s = 1 + R() * 2.4;
    const lit = 0.5 - ((x - p.x) * 0.6 + (y - p.y) * 0.8) / 170;
    g.fillStyle = `rgba(${150 + lit * 80 | 0},${110 + lit * 60 | 0},${70 + lit * 40 | 0},0.8)`;
    g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  }
  nestHole(g, p.x + 40, p.y + 50, 6);
  nestHole(g, p.x - 50, p.y + 30, 5);
}

function propNestLitter(g, p) {
  const R = mulberry32(p.seed);
  for (let i = 0; i < 14; i++) {
    propLeaf(g, { x: p.x + (R() - 0.5) * 140, y: p.y + (R() - 0.5) * 140, len: 30 + R() * 30, rot: R() * TAU, col: 2 + ((R() * 3) | 0), seed: (R() * 1e9) | 0 });
  }
  radialFill(g, p.x, p.y, 40, [[0, 'rgba(60,40,20,0.8)'], [1, 'rgba(60,40,20,0)']]);
  nestHole(g, p.x, p.y, 12);
}

function propNestRoots(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x, p.y, 130, [[0, 'rgba(60,44,26,0.8)'], [1, 'rgba(60,44,26,0)']]);
  g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = R() * TAU, l = 90 + R() * 60;
    const pts = [[p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20]];
    let x = pts[0][0], y = pts[0][1], aa = a;
    for (let k = 0; k < 4; k++) { aa += (R() - 0.5) * 0.6; x += Math.cos(aa) * l / 4; y += Math.sin(aa) * l / 4; pts.push([x, y]); }
    for (const [col, w, ox] of [['rgba(15,10,4,0.35)', 14, 4], ['#5a4030', 12, 0], ['rgba(170,130,95,0.45)', 4, -2]]) {
      g.strokeStyle = col; g.lineWidth = w;
      g.beginPath(); g.moveTo(pts[0][0] + ox, pts[0][1] + ox);
      for (const q of pts) g.lineTo(q[0] + ox, q[1] + ox);
      g.stroke();
    }
  }
  nestHole(g, p.x, p.y, 16);
}

function propNestLeafball(g, p) {
  drawOutpost(g, { x: p.x, y: p.y, seed: p.seed });
  drawOutpost(g, { x: p.x + 30, y: p.y - 20, seed: p.seed + 1 });
  drawOutpost(g, { x: p.x - 24, y: p.y + 22, seed: p.seed + 2 });
}


/* ------------------------------------------------------------- trees */

const BARK = {
  oak: ['#6a5038', '#a08060', '#2e2014'],
  pine: ['#7a4a30', '#b07a58', '#3a2014'],
  birch: ['#e8e2d6', '#ffffff', '#9a9488'],
  willow: ['#5e5040', '#9a8a70', '#2a2218'],
};

function propShade(g, p) {
  radialFill(g, p.x, p.y, p.r, [[0, 'rgba(15,22,8,0.34)'], [0.7, 'rgba(15,22,8,0.22)'], [1, 'rgba(15,22,8,0)']]);
}

function propTermound(g, p) {
  const R = mulberry32(p.seed);
  castShadow(g, p.x, p.y, 70, 0.5);
  radialFill(g, p.x, p.y, 80, [[0, 'rgba(150,100,60,0.85)'], [0.8, 'rgba(140,92,56,0.5)'], [1, 'rgba(140,92,56,0)']]);
  const spires = [];
  for (let i = 0; i < 9; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 40; spires.push([p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 12 + R() * 16]); }
  spires.push([p.x, p.y, 30]);
  spires.sort((u, v) => u[2] - v[2]);
  for (const [x, y, r] of spires) {
    radialFill(g, x + r * 0.35, y + r * 0.45, r * 1.2, [[0, 'rgba(20,10,0,0.35)'], [1, 'rgba(20,10,0,0)']]);
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.05, x, y, r);
    gr.addColorStop(0, '#e8b47c'); gr.addColorStop(0.5, '#b47844'); gr.addColorStop(1, '#6a4020');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(80,45,20,0.35)'; g.lineWidth = 0.8;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(x, y, r * k / 4, R() * TAU, R() * TAU + 3); g.stroke(); }
  }
  for (let i = 0; i < 8; i++) { const a = R() * TAU, d = 30 + R() * 40; antHole(g, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 3); }
}

function drawProp(g, p) {
  switch (p.type) {
    case 'blob': {
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      gr.addColorStop(0, rgba(p.c, p.al)); gr.addColorStop(1, rgba(p.c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
      break;
    }
    case 'moss': propMoss(g, p); break;
    case 'leaf': propLeaf(g, p); break;
    case 'twig': propTwig(g, p); break;
    case 'pebble': propPebble(g, p); break;
    case 'mush': propMush(g, p); break;
    case 'tuft': propTuft(g, p); break;
    case 'flower': propFlower(g, p); break;
    case 'clover': propClover(g, p); break;
    case 'pit': propPit(g, p); break;
    case 'lair': propLair(g, p); break;
    case 'nest': propNest(g, p); break;
    case 'log': case 'drift': propLog(g, p); break;
    case 'cone': propCone(g, p); break;
    case 'acorn': propAcorn(g, p); break;
    case 'fern': propFern(g, p); break;
    case 'shell': propShell(g, p); break;
    case 'weed': propWeed(g, p); break;
    case 'ripple': propRipple(g, p); break;
    case 'crabhole': propCrabhole(g, p); break;
    case 'reed': propReed(g, p); break;
    case 'mud': propMud(g, p); break;
    case 'lily': propLily(g, p); break;
    case 'rock': propRock(g, p); break;
    case 'thistle': propThistle(g, p); break;
    case 'crack': propCrack(g, p); break;
    case 'shade': propShade(g, p); break;
    case 'trunk': propTrunk(g, p); break;
    case 'termound': propTermound(g, p); break;
  }
}

/* ---------------------------------------------- species anthills (v3) */

function soilGrain(g, x, y, s, col, a) {
  g.fillStyle = 'rgba(20,12,4,0.32)';
  g.beginPath(); g.ellipse(x + s * 0.35, y + s * 0.45, s, s * 0.8, a, 0, TAU); g.fill();
  g.fillStyle = col;
  g.beginPath(); g.ellipse(x, y, s, s * 0.8, a, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,240,210,0.22)';
  g.beginPath(); g.arc(x - s * 0.3, y - s * 0.3, s * 0.35, 0, TAU); g.fill();
}

function domeLight(g, x, y, r, k) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  gr.addColorStop(0, `rgba(255,236,190,${0.3 * k})`);
  gr.addColorStop(0.5, 'rgba(255,236,190,0)');
  gr.addColorStop(0.82, `rgba(20,10,0,${0.16 * k})`);
  gr.addColorStop(1, `rgba(20,10,0,${0.34 * k})`);
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

function castShadow(g, x, y, r, a) {
  radialFill(g, x + r * 0.22, y + r * 0.3, r * 1.1, [[0, `rgba(15,10,2,${a})`], [0.7, `rgba(15,10,2,${a * 0.6})`], [1, 'rgba(15,10,2,0)']]);
}

/* An entrance: dark shaft with the far inner wall catching the light. */
function antHole(g, x, y, r) {
  const gr = g.createRadialGradient(x + r * 0.2, y + r * 0.25, 0, x, y, r * 1.25);
  gr.addColorStop(0, '#020100'); gr.addColorStop(0.55, '#140b04'); gr.addColorStop(0.8, 'rgba(40,24,10,0.7)'); gr.addColorStop(1, 'rgba(40,24,10,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r * 1.25, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,220,160,0.22)'; g.lineWidth = r * 0.22;
  g.beginPath(); g.arc(x, y, r * 0.78, -0.1, 1.7); g.stroke();
}

/* A ring of excavated soil around a hole, the way workers dump spoil at the door. */
function spoilCrater(g, R, x, y, size, cols) {
  radialFill(g, x, y, size * 1.9, [[0, 'rgba(70,48,26,0.55)'], [1, 'rgba(70,48,26,0)']]);
  const n = Math.round(size * size * 0.9);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = size * (0.42 + Math.pow(R(), 0.8) * 1.25);
    const s = 0.7 + R() * (d < size * 0.9 ? 1.6 : 1.1);
    soilGrain(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.95, s, cols[(R() * cols.length) | 0], R() * 3);
  }
  g.strokeStyle = 'rgba(255,236,190,0.18)'; g.lineWidth = size * 0.18;
  g.beginPath(); g.arc(x, y, size * 0.8, Math.PI * 0.95, Math.PI * 1.65); g.stroke();
  antHole(g, x, y, size * 0.34);
}

function nestGarden(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x, p.y, 140, [[0, 'rgba(62,42,24,0.6)'], [0.6, 'rgba(62,42,24,0.3)'], [1, 'rgba(62,42,24,0)']]);
  const cols = ['#6e5034', '#80603e', '#5a3e26', '#94704a', '#a88458', '#7a5636'];
  const craters = [[0, 0, 36], [58, -34, 18], [-52, 38, 16], [28, 60, 13], [-46, -50, 14], [80, 34, 11]];
  for (const [cx, cy, s] of craters.slice(1)) spoilCrater(g, R, p.x + cx + (R() - 0.5) * 8, p.y + cy + (R() - 0.5) * 8, s, cols);
  spoilCrater(g, R, p.x, p.y, 36, cols);
  for (let i = 0; i < 5; i++) {
    const a = R() * TAU, d = 70 + R() * 40;
    propTuft(g, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: 10 + R() * 8, seed: (R() * 1e9) | 0 });
  }
}

function nestThatch(g, p) {
  const R = mulberry32(p.seed), r = 100;
  for (let k = 0; k < 4; k++) {
    const a = R() * TAU;
    g.strokeStyle = 'rgba(120,85,50,0.3)'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(p.x + Math.cos(a) * r * 0.9, p.y + Math.sin(a) * r * 0.9);
    g.quadraticCurveTo(p.x + Math.cos(a + 0.2) * r * 1.4, p.y + Math.sin(a + 0.2) * r * 1.4, p.x + Math.cos(a) * r * 1.8, p.y + Math.sin(a) * r * 1.8);
    g.stroke();
  }
  castShadow(g, p.x, p.y, r, 0.5);
  radialFill(g, p.x, p.y, r * 1.05, [[0, '#7a5230'], [0.8, '#5e3c20'], [1, 'rgba(70,46,24,0)']]);
  const light = ['#d8a060', '#c08648', '#a86e36'], dark = ['#6a4220', '#583418', '#7a4c26'];
  g.lineCap = 'round';
  for (let i = 0; i < 1900; i++) {
    const a = R() * TAU, d = r * Math.sqrt(R());
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    const lit = clamp(0.5 - (Math.cos(a) * 0.6 + Math.sin(a) * 0.8) * (d / r) * 0.6 + (1 - d / r) * 0.25, 0, 1);
    const na = a + Math.PI / 2 + (R() - 0.5) * 1.6, l = 6 + R() * 9;
    const x2 = x + Math.cos(na) * l, y2 = y + Math.sin(na) * l;
    g.strokeStyle = 'rgba(20,10,0,0.3)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x + 0.7, y + 1); g.lineTo(x2 + 0.7, y2 + 1); g.stroke();
    const pal = R() < lit ? light : dark;
    g.strokeStyle = pal[(R() * pal.length) | 0]; g.lineWidth = 0.9 + R() * 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const a = R() * TAU, d = r * 0.85 * Math.sqrt(R()), na = R() * TAU, l = 14 + R() * 14;
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    g.strokeStyle = '#4a2e18'; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(na) * l, y + Math.sin(na) * l); g.stroke();
    g.strokeStyle = 'rgba(200,150,100,0.4)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(x - 0.6, y - 0.6); g.lineTo(x + Math.cos(na) * l - 0.6, y + Math.sin(na) * l - 0.6); g.stroke();
  }
  for (let i = 0; i < 10; i++) {
    const a = R() * TAU, d = r * Math.sqrt(R());
    radialFill(g, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 2.2, [[0, '#ffe6a0'], [0.5, '#e0a030'], [1, 'rgba(160,90,20,0)']]);
  }
  domeLight(g, p.x, p.y, r, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + R() * 0.4, d = r * (0.55 + R() * 0.3);
    antHole(g, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 4.5 + R() * 2.5);
  }
  antHole(g, p.x, p.y, 9);
}

function nestAtta(g, p) {
  const R = mulberry32(p.seed), r = 118;
  const trails = 3 + ((R() * 2) | 0);
  for (let k = 0; k < trails; k++) {
    const a = (k / trails) * TAU + R() * 0.8;
    const pts = [];
    let x = p.x + Math.cos(a) * r * 0.8, y = p.y + Math.sin(a) * r * 0.8, aa = a;
    pts.push([x, y]);
    for (let i = 0; i < 8; i++) { aa += (R() - 0.5) * 0.45; x += Math.cos(aa) * 22; y += Math.sin(aa) * 22; pts.push([x, y]); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, c] of [[16, 'rgba(120,80,45,0.28)'], [10, 'rgba(176,124,78,0.4)']]) {
      g.strokeStyle = c; g.lineWidth = w;
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const q = pts[1 + ((R() * 7) | 0)];
      g.fillStyle = R() < 0.5 ? '#6aa040' : '#4e8a30';
      g.beginPath(); g.ellipse(q[0] + (R() - 0.5) * 8, q[1] + (R() - 0.5) * 8, 3.5, 2, R() * 3, 0, TAU); g.fill();
    }
  }
  const ra = R() * TAU, rx = p.x + Math.cos(ra) * 150, ry = p.y + Math.sin(ra) * 150;
  castShadow(g, rx, ry, 30, 0.35);
  radialFill(g, rx, ry, 32, [[0, '#7a7060'], [0.7, '#5e5446'], [1, 'rgba(80,70,58,0)']]);
  for (let i = 0; i < 140; i++) { const a = R() * TAU, d = 28 * Math.sqrt(R()); g.fillStyle = R() < 0.5 ? 'rgba(160,150,130,0.6)' : 'rgba(50,44,36,0.6)'; g.beginPath(); g.arc(rx + Math.cos(a) * d, ry + Math.sin(a) * d, 0.8 + R(), 0, TAU); g.fill(); }
  const pts = polyPts(R, p.x, p.y, r, 14, 1.08, 0.94);
  g.save(); g.translate(r * 0.18, r * 0.24); smoothPoly(g, pts); g.fillStyle = 'rgba(15,10,2,0.3)'; g.fill(); g.restore();
  smoothPoly(g, pts);
  const gr = g.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, 4, p.x, p.y, r * 1.1);
  gr.addColorStop(0, '#e0a068'); gr.addColorStop(0.55, '#b86a38'); gr.addColorStop(1, '#7a4420');
  g.fillStyle = gr; g.fill();
  g.save(); smoothPoly(g, pts); g.clip();
  for (let i = 0; i < 1200; i++) {
    const a = R() * TAU, d = r * Math.sqrt(R());
    g.fillStyle = R() < 0.5 ? 'rgba(240,180,120,0.45)' : 'rgba(110,56,24,0.4)';
    g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.6 + R() * 1.2, 0, TAU); g.fill();
  }
  domeLight(g, p.x, p.y, r, 0.9);
  g.restore();
  const holes = [[0, 0, 11]];
  for (let i = 0; i < 11; i++) { const a = R() * TAU, d = 30 + R() * 70; holes.push([Math.cos(a) * d, Math.sin(a) * d, 5 + R() * 4]); }
  for (const [hx, hy, hs] of holes) {
    const x = p.x + hx, y = p.y + hy;
    radialFill(g, x - 1, y - 1, hs * 2.4, [[0, 'rgba(236,170,110,0.9)'], [0.6, 'rgba(200,120,70,0.6)'], [1, 'rgba(200,120,70,0)']]);
    radialFill(g, x + hs * 0.6, y + hs * 0.8, hs * 2.2, [[0, 'rgba(60,25,8,0.35)'], [1, 'rgba(60,25,8,0)']]);
    antHole(g, x, y, hs * 0.55);
    for (let k = 0; k < 2; k++) {
      g.fillStyle = '#5e9a36';
      g.beginPath(); g.ellipse(x + (R() - 0.5) * hs * 3, y + (R() - 0.5) * hs * 3, 3, 1.8, R() * 3, 0, TAU); g.fill();
    }
  }
}

function nestFireDome(g, p) {
  const R = mulberry32(p.seed), r = 92;
  castShadow(g, p.x, p.y, r, 0.5);
  radialFill(g, p.x, p.y, r, [[0, '#8a6440'], [0.85, '#5e422a'], [1, 'rgba(70,50,30,0)']]);
  const clumps = [];
  for (let i = 0; i < 340; i++) { const a = R() * TAU, d = r * 0.95 * Math.sqrt(R()); clumps.push([a, d, 3 + R() * 5]); }
  clumps.sort((u, v) => v[1] - u[1]);
  for (const [a, d, s] of clumps) {
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    const nx = (Math.cos(a) * d) / r, ny = (Math.sin(a) * d) / r;
    const lit = clamp(0.55 - (nx * 0.6 + ny * 0.8) * 0.55 + (1 - d / r) * 0.15, 0, 1);
    const base = [lerp(110, 210, lit), lerp(78, 160, lit), lerp(48, 108, lit)];
    g.fillStyle = 'rgba(30,18,8,0.45)';
    g.beginPath(); g.ellipse(x + s * 0.3, y + s * 0.4, s * 1.05, s * 0.9, a, 0, TAU); g.fill();
    const gg = g.createRadialGradient(x - s * 0.35, y - s * 0.4, 0.3, x, y, s * 1.1);
    gg.addColorStop(0, `rgb(${base[0] + 30 | 0},${base[1] + 26 | 0},${base[2] + 20 | 0})`);
    gg.addColorStop(1, `rgb(${base[0] * 0.7 | 0},${base[1] * 0.7 | 0},${base[2] * 0.7 | 0})`);
    g.fillStyle = gg;
    g.beginPath(); g.ellipse(x, y, s, s * 0.85, a, 0, TAU); g.fill();
  }
  domeLight(g, p.x, p.y, r, 0.7);
  g.strokeStyle = 'rgba(40,24,10,0.4)'; g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    let x = p.x + (R() - 0.5) * r, y = p.y + (R() - 0.5) * r;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 18; y += (R() - 0.5) * 18; g.lineTo(x, y); }
    g.stroke();
  }
  antHole(g, p.x, p.y, 6);
  for (let i = 0; i < 3; i++) { const a = R() * TAU; antHole(g, p.x + Math.cos(a) * r * 0.92, p.y + Math.sin(a) * r * 0.92, 3.5); }
}

function nestTrapjaw(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x, p.y, 130, [[0, 'rgba(50,34,18,0.55)'], [1, 'rgba(50,34,18,0)']]);
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU, d = 30 + R() * 90;
    propLeaf(g, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, len: 26 + R() * 30, rot: R() * TAU, col: 2 + ((R() * 3) | 0), seed: (R() * 1e9) | 0 });
  }
  const lr = R() * 0.6 - 0.3;
  propLog(g, { type: 'log', x: p.x + 6, y: p.y - 48, len: 110, w: 34, rot: lr, seed: (R() * 1e9) | 0 });
  g.save(); g.translate(p.x + 6, p.y - 48); g.rotate(lr);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = 'rgba(30,18,8,0.5)';
    g.beginPath(); g.ellipse(-45 + R() * 90, (R() - 0.5) * 22, 3 + R() * 5, 2 + R() * 3, R() * 3, 0, TAU); g.fill();
  }
  for (let i = 0; i < 4; i++) propMush(g, { x: -30 + i * 18, y: -14 + (R() - 0.5) * 6, cr: 4 + R() * 3, variant: 2, seed: (R() * 1e9) | 0 });
  g.restore();
  spoilCrater(g, R, p.x, p.y, 16, ['#4a3420', '#5e4228', '#3a2816', '#6e5032']);
}

function nestBullet(g, p) {
  const R = mulberry32(p.seed);
  const tx = p.x - 8, ty = p.y - 96, tr = 66;
  castShadow(g, tx + 30, ty + 40, tr * 1.6, 0.4);
  radialFill(g, tx, ty, tr * 2.4, [[0, 'rgba(50,34,20,0.75)'], [0.6, 'rgba(56,40,24,0.45)'], [1, 'rgba(56,40,24,0)']]);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const angles = [];
  for (let a = R() * TAU, i = 0; i < 5; i++) { angles.push(a); a += 0.9 + R() * 0.75; }
  for (const a of angles) {
    const len = 70 + R() * 50, bend = (R() - 0.5) * 0.7;
    // a buttress: a wide flared wedge where it leaves the trunk, narrowing into a surface root
    const path = (o, k) => {
      g.beginPath();
      for (let j = 0; j <= 12; j++) {
        const f = j / 12, aa = a + bend * f * f, d = tr * 0.6 + len * f;
        const w = (30 * Math.pow(1 - f, 1.6) + 3) * k;
        const x = tx + Math.cos(aa) * d - Math.sin(aa) * w + o, y = ty + Math.sin(aa) * d + Math.cos(aa) * w + o;
        j ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      for (let j = 12; j >= 0; j--) {
        const f = j / 12, aa = a + bend * f * f, d = tr * 0.6 + len * f;
        const w = (30 * Math.pow(1 - f, 1.6) + 3) * k;
        g.lineTo(tx + Math.cos(aa) * d + Math.sin(aa) * w + o, ty + Math.sin(aa) * d - Math.cos(aa) * w + o);
      }
      g.closePath();
    };
    path(5, 1); g.fillStyle = 'rgba(15,10,4,0.35)'; g.fill();
    path(0, 1);
    const rg = g.createRadialGradient(tx, ty, tr * 0.5, tx, ty, tr + len);
    rg.addColorStop(0, '#5e4632'); rg.addColorStop(1, '#3a2a1c');
    g.fillStyle = rg; g.fill();
    path(-2, 0.35); g.fillStyle = 'rgba(180,150,115,0.28)'; g.fill();
    g.strokeStyle = 'rgba(20,12,6,0.4)'; g.lineWidth = 0.8;
    for (let k = 0; k < 6; k++) {
      const f = 0.1 + R() * 0.6, aa = a + bend * f * f, d = tr * 0.6 + len * f;
      g.beginPath(); g.moveTo(tx + Math.cos(aa) * d, ty + Math.sin(aa) * d); g.lineTo(tx + Math.cos(aa) * (d + 14), ty + Math.sin(aa) * (d + 14)); g.stroke();
    }
  }
  for (let i = 0; i < 10; i++) {
    const a = R() * TAU, d = tr + 20 + R() * 70;
    propLeaf(g, { x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, len: 22 + R() * 20, rot: R() * TAU, col: 3 + ((R() * 2) | 0), seed: (R() * 1e9) | 0 });
  }
  const gr = g.createRadialGradient(tx - tr * 0.35, ty - tr * 0.4, 6, tx, ty, tr);
  gr.addColorStop(0, '#8a7058'); gr.addColorStop(0.6, '#5a4432'); gr.addColorStop(1, '#2e2016');
  g.fillStyle = gr; g.beginPath(); g.arc(tx, ty, tr, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(20,12,6,0.45)'; g.lineWidth = 1.4;
  for (let i = 0; i < 40; i++) {
    const a = R() * TAU, d1 = tr * (0.2 + R() * 0.7);
    g.beginPath(); g.arc(tx, ty, d1, a, a + 0.3 + R() * 0.6); g.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const a = R() * TAU, d = tr * R() * 0.9;
    for (let k = 0; k < 24; k++) {
      g.fillStyle = R() < 0.5 ? 'rgba(110,150,50,0.8)' : 'rgba(80,120,40,0.8)';
      g.beginPath(); g.arc(tx + Math.cos(a) * d + (R() - 0.5) * 18, ty + Math.sin(a) * d + (R() - 0.5) * 18, 1 + R() * 2, 0, TAU); g.fill();
    }
  }
  spoilCrater(g, R, p.x, p.y, 18, ['#4a3420', '#3a2816', '#5e4228', '#2e2012']);
}

function nestWeaver(g, p) {
  const R = mulberry32(p.seed), r = 120;
  castShadow(g, p.x, p.y, r, 0.45);
  const leaves = [];
  for (let i = 0; i < 90; i++) {
    const a = R() * TAU, d = r * Math.sqrt(R());
    leaves.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, a: a + (R() - 0.5) * 1.5, l: 26 + R() * 18, d });
  }
  leaves.sort((u, v) => v.d - u.d);
  for (const L of leaves) {
    g.save(); g.translate(L.x, L.y); g.rotate(L.a);
    const so = rotV(3, 4, -L.a);
    g.save(); g.translate(so[0], so[1]); leafPath(g, L.l, L.l * 0.3); g.fillStyle = 'rgba(10,25,5,0.3)'; g.fill(); g.restore();
    leafPath(g, L.l, L.l * 0.3);
    const lit = clamp(0.6 - (L.x - p.x) / r * 0.3 - (L.y - p.y) / r * 0.4, 0.2, 1);
    const gr = g.createLinearGradient(0, -8, 0, 8);
    gr.addColorStop(0, `rgb(${110 + lit * 70 | 0},${150 + lit * 70 | 0},${60 + lit * 30 | 0})`);
    gr.addColorStop(1, `rgb(${40 + lit * 20 | 0},${80 + lit * 30 | 0},${24 | 0})`);
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(230,250,200,0.3)'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(-L.l / 2, 0); g.lineTo(L.l / 2, 0); g.stroke();
    g.restore();
  }
  for (const [ox, oy, s] of [[0, 0, 1], [48, -36, 0.75], [-44, 30, 0.7]]) {
    const x = p.x + ox, y = p.y + oy;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + R() * 0.3, l = (30 + R() * 10) * s;
      g.save(); g.translate(x + Math.cos(a) * 9 * s, y + Math.sin(a) * 9 * s); g.rotate(a + Math.PI / 2 * 0.6);
      leafPath(g, l, l * 0.34);
      const gg = g.createLinearGradient(0, -8, 0, 8);
      gg.addColorStop(0, '#a8d070'); gg.addColorStop(1, '#3e6e22');
      g.fillStyle = gg; g.fill();
      g.restore();
    }
    radialFill(g, x, y, 22 * s, [[0, 'rgba(255,255,250,0.5)'], [0.7, 'rgba(255,255,250,0.25)'], [1, 'rgba(255,255,250,0)']]);
    g.strokeStyle = 'rgba(255,255,250,0.6)'; g.lineWidth = 0.5;
    for (let i = 0; i < 18; i++) {
      const a = R() * TAU, b = a + 0.8 + R() * 2;
      g.beginPath(); g.moveTo(x + Math.cos(a) * 20 * s, y + Math.sin(a) * 20 * s); g.lineTo(x + Math.cos(b) * 20 * s, y + Math.sin(b) * 20 * s); g.stroke();
    }
    antHole(g, x + 3 * s, y + 4 * s, 5 * s);
  }
}

/* Army ants: no nest at all, just a living ball of linked bodies hanging under a log or in a hollow. */
function nestBivouac(g, p) {
  const R = mulberry32(p.seed), r = 70;
  castShadow(g, p.x, p.y, r, 0.5);
  for (let i = 0; i < 14; i++) {
    const a = R() * TAU, d = r + 20 + R() * 60;
    propLeaf(g, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, len: 26 + R() * 26, rot: R() * TAU, col: 2 + ((R() * 3) | 0), seed: (R() * 1e9) | 0 });
  }
  radialFill(g, p.x, p.y, r, [[0, '#3a1c0a'], [0.8, '#2a1206'], [1, 'rgba(40,18,6,0)']]);
  const bodies = [];
  for (let i = 0; i < 520; i++) { const a = R() * TAU, d = r * Math.sqrt(R()); bodies.push([p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, R() * TAU, d]); }
  bodies.sort((u, v) => v[3] - u[3]);
  for (const [x, y, a, d] of bodies) {
    const lit = clamp(0.55 - ((x - p.x) * 0.6 + (y - p.y) * 0.8) / (r * 1.4) + (1 - d / r) * 0.2, 0, 1);
    g.save(); g.translate(x, y); g.rotate(a);
    g.strokeStyle = 'rgba(30,12,4,0.8)'; g.lineWidth = 0.5;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(k * 1.5, -2.5); g.lineTo(k * 1.5 + 1, 2.5); g.stroke(); }
    g.fillStyle = `rgb(${110 + lit * 110 | 0},${55 + lit * 60 | 0},${20 + lit * 25 | 0})`;
    g.beginPath(); g.ellipse(-2, 0, 2.1, 1.4, 0, 0, TAU); g.ellipse(1.6, 0, 1.3, 1.1, 0, 0, TAU); g.fill();
    g.restore();
  }
  domeLight(g, p.x, p.y, r, 0.6);
}

/* Honeypot ants in dry country: a low crater with a small chimney rising at the entrance. */
function nestTurret(g, p) {
  const R = mulberry32(p.seed);
  radialFill(g, p.x, p.y, 110, [[0, 'rgba(180,140,90,0.7)'], [1, 'rgba(180,140,90,0)']]);
  spoilCrater(g, R, p.x, p.y, 34, ['#c8a070', '#b08858', '#d8b484', '#a07848', '#e0c094']);
  castShadow(g, p.x, p.y, 16, 0.5);
  const gr = g.createRadialGradient(p.x - 6, p.y - 7, 1, p.x, p.y, 16);
  gr.addColorStop(0, '#e8c898'); gr.addColorStop(0.6, '#b8905e'); gr.addColorStop(1, '#7a5a34');
  g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, 16, 0, TAU); g.fill();
  for (let i = 0; i < 60; i++) {
    const a = R() * TAU, d = 9 + R() * 7;
    g.fillStyle = R() < 0.5 ? 'rgba(90,60,30,0.5)' : 'rgba(250,230,190,0.5)';
    g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.7 + R(), 0, TAU); g.fill();
  }
  antHole(g, p.x, p.y, 7);
}

/* Carpenter ants: a rotting stump, its heart hollowed into galleries, with sawdust spilling out. */
function nestStump(g, p) {
  const R = mulberry32(p.seed), r = 62;
  castShadow(g, p.x, p.y, r * 1.3, 0.45);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + R() * 0.6;
    drawRoot(g, R, p.x + Math.cos(a) * r * 0.8, p.y + Math.sin(a) * r * 0.8, a, r * (0.6 + R() * 0.5), r * 0.3, ROOT_COL.oak);
  }
  // sawdust ("frass") pushed out of the galleries
  for (let k = 0; k < 3; k++) {
    const a = R() * TAU, cx = p.x + Math.cos(a) * (r + 22), cy = p.y + Math.sin(a) * (r + 22);
    radialFill(g, cx, cy, 26, [[0, 'rgba(230,200,150,0.85)'], [0.7, 'rgba(210,175,120,0.5)'], [1, 'rgba(210,175,120,0)']]);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = R() < 0.5 ? '#e8d0a0' : '#c8a070';
      g.fillRect(cx + (R() - 0.5) * 36, cy + (R() - 0.5) * 30, 1.2, 0.8);
    }
  }
  g.fillStyle = '#4a3424'; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
  const top = g.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, 4, p.x, p.y, r * 0.9);
  top.addColorStop(0, '#d8b080'); top.addColorStop(0.7, '#a07848'); top.addColorStop(1, '#6a4a2c');
  g.fillStyle = top; g.beginPath(); g.arc(p.x, p.y, r * 0.86, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(90,60,30,0.45)'; g.lineWidth = 0.8;
  for (let k = 1; k < 9; k++) { g.beginPath(); g.ellipse(p.x + (R() - 0.5) * 2, p.y + (R() - 0.5) * 2, r * 0.86 * k / 9, r * 0.84 * k / 9, R(), 0, TAU); g.stroke(); }
  g.strokeStyle = 'rgba(40,25,10,0.5)'; g.lineWidth = 1.2;
  for (let k = 0; k < 6; k++) { const a = R() * TAU; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(a) * r * 0.85, p.y + Math.sin(a) * r * 0.85); g.stroke(); }
  // the rotten, hollowed heart where the colony lives
  radialFill(g, p.x + 4, p.y + 5, r * 0.42, [[0, '#0a0604'], [0.6, '#2a1a0e'], [1, 'rgba(60,40,20,0)']]);
  for (let i = 0; i < 4; i++) { const a = R() * TAU, d = r * (0.45 + R() * 0.3); antHole(g, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 4); }
  for (let i = 0; i < 60; i++) {
    const a = -Math.PI * 0.3 + (R() - 0.5) * 2, d = r * (0.88 + R() * 0.14);
    g.fillStyle = R() < 0.5 ? 'rgba(100,140,45,0.85)' : 'rgba(70,110,35,0.85)';
    g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1 + R() * 2, 0, TAU); g.fill();
  }
}

/* Harvester ants clear a bare disc around the nest and pave it with fine gravel. */
function nestDisc(g, p) {
  const R = mulberry32(p.seed), r = 130;
  radialFill(g, p.x, p.y, r, [[0, 'rgba(176,140,96,0.95)'], [0.8, 'rgba(170,134,92,0.85)'], [1, 'rgba(170,134,92,0)']]);
  for (let i = 0; i < 900; i++) {
    const a = R() * TAU, d = r * 0.95 * Math.sqrt(R()), s2 = 0.8 + R() * 1.8;
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    g.fillStyle = 'rgba(40,25,10,0.3)'; g.beginPath(); g.arc(x + 0.5, y + 0.6, s2, 0, TAU); g.fill();
    g.fillStyle = ['#d8c4a0', '#b8a080', '#e8dcc0', '#a08868', '#c8b090'][(R() * 5) | 0];
    g.beginPath(); g.arc(x, y, s2, 0, TAU); g.fill();
  }
  // piles of discarded seed husks at the edge of the disc
  for (let k = 0; k < 3; k++) {
    const a = R() * TAU, cx = p.x + Math.cos(a) * r * 0.8, cy = p.y + Math.sin(a) * r * 0.8;
    for (let i = 0; i < 40; i++) {
      g.save(); g.translate(cx + (R() - 0.5) * 30, cy + (R() - 0.5) * 24); g.rotate(R() * TAU);
      g.fillStyle = R() < 0.5 ? '#8a6a3a' : '#c8a868';
      g.beginPath(); g.ellipse(0, 0, 2.6, 1.2, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
  spoilCrater(g, R, p.x, p.y, 22, ['#a07850', '#b88a5a', '#8a6844']);
}

function propNest(g, p) {
  switch (ANT_SPECIES[p.species].nest) {
    case 'crater': nestGarden(g, p); break;
    case 'thatch': nestThatch(g, p); break;
    case 'bare': nestAtta(g, p); break;
    case 'dome': nestFireDome(g, p); break;
    case 'litter': nestTrapjaw(g, p); break;
    case 'roots': nestBullet(g, p); break;
    case 'leafball': nestWeaver(g, p); break;
    case 'bivouac': nestBivouac(g, p); break;
    case 'turret': nestTurret(g, p); break;
    case 'stump': nestStump(g, p); break;
    case 'disc': nestDisc(g, p); break;
  }
}

/* ------------------------------------------------- bark & wood (v2) */

const ROOT_COL = { oak: ['#5a4232', '#9a7a5c', '#2a1c12'], pine: ['#6a4028', '#a87452', '#2e1a0e'], birch: ['#5e5446', '#968a76', '#2a241c'], willow: ['#54483a', '#8c7c64', '#26201a'] };

/* A surface root: wide where it leaves the trunk, tapering as it dives into the soil. */
function drawRoot(g, R, x0, y0, a, len, w, col) {
  const bend = (R() - 0.5) * 1.3, pts = [];
  for (let j = 0; j <= 14; j++) {
    const f = j / 14, aa = a + bend * f * f, d = len * f;
    pts.push({ x: x0 + Math.cos(aa) * d, y: y0 + Math.sin(aa) * d, w: w * (1 - f * 0.75) * (0.9 + Math.sin(f * 9 + bend * 5) * 0.08) + 1, aa });
  }
  const outline = (o, k) => {
    g.beginPath();
    pts.forEach((q, j) => { const px = q.x - Math.sin(q.aa) * q.w * k + o, py = q.y + Math.cos(q.aa) * q.w * k + o; j ? g.lineTo(px, py) : g.moveTo(px, py); });
    for (let j = pts.length - 1; j >= 0; j--) { const q = pts[j]; g.lineTo(q.x + Math.sin(q.aa) * q.w * k + o, q.y - Math.cos(q.aa) * q.w * k + o); }
    g.closePath();
  };
  outline(3, 1.1); g.fillStyle = 'rgba(15,10,4,0.3)'; g.fill();
  outline(0, 1);
  const gr = g.createLinearGradient(x0, y0, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len);
  gr.addColorStop(0, col[0]); gr.addColorStop(0.45, col[0]); gr.addColorStop(0.85, rgba(col[0], 0.35)); gr.addColorStop(1, rgba(col[0], 0));
  g.fillStyle = gr; g.fill();
  g.save(); outline(0, 1); g.clip();
  // grain running along the root, lit on the upper-left edge
  for (let k = -3; k <= 3; k++) {
    g.strokeStyle = k < 0 ? rgba(col[1], 0.35) : rgba(col[2], 0.4); g.lineWidth = 0.8;
    g.beginPath();
    pts.forEach((q, j) => { const off = (k / 4) * q.w; const px = q.x - Math.sin(q.aa) * off + (R() - 0.5) * 0.6, py = q.y + Math.cos(q.aa) * off; j ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke();
  }
  g.restore();
  // soil crumbs where it sinks into the ground
  for (let i = 0; i < 14; i++) {
    const q = pts[10 + ((R() * 4) | 0)];
    g.fillStyle = R() < 0.5 ? 'rgba(70,50,30,0.7)' : 'rgba(110,85,55,0.6)';
    g.beginPath(); g.arc(q.x + (R() - 0.5) * q.w * 3, q.y + (R() - 0.5) * q.w * 3, 0.8 + R() * 1.6, 0, TAU); g.fill();
  }
}

/* Looking straight down a trunk, its vertical furrows fan out from the centre. */
function propTrunk(g, p) {
  const R = mulberry32(p.seed), tr = p.tr, x = p.x, y = p.y;
  const bark = BARK[p.kind], rc = ROOT_COL[p.kind] || ROOT_COL.oak;
  radialFill(g, x + tr * 0.2, y + tr * 0.25, tr * 2.2, [[0, 'rgba(15,10,4,0.45)'], [0.5, 'rgba(15,10,4,0.2)'], [1, 'rgba(15,10,4,0)']]);
  // a collar of loose soil and leaf litter where the trunk meets the ground
  radialFill(g, x, y, tr * 1.9, [[0.4, 'rgba(70,50,30,0.7)'], [1, 'rgba(70,50,30,0)']]);
  for (let i = 0; i < 90; i++) {
    const a = R() * TAU, d = tr * (0.9 + R() * 0.9);
    g.fillStyle = ['rgba(60,40,22,0.6)', 'rgba(110,82,50,0.5)', 'rgba(140,90,40,0.45)'][(R() * 3) | 0];
    g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + R() * 2.4, 0.7 + R() * 1.2, R() * 3, 0, TAU); g.fill();
  }
  const roots = 4 + ((R() * 3) | 0);
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * TAU + R() * 0.7;
    drawRoot(g, R, x + Math.cos(a) * tr * 0.55, y + Math.sin(a) * tr * 0.55, a, tr * (0.8 + R() * 0.6), tr * (0.4 + R() * 0.14), rc);
  }
  // the trunk itself
  const base = p.kind === 'birch' ? ['#e6e0d4', '#fbf8f0', '#8a8478'] : bark;
  const gr = g.createRadialGradient(x - tr * 0.35, y - tr * 0.4, tr * 0.05, x, y, tr * 1.02);
  gr.addColorStop(0, base[1]); gr.addColorStop(0.55, base[0]); gr.addColorStop(1, base[2]);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, tr, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(x, y, tr, 0, TAU); g.clip();
  if (p.kind === 'birch') {
    for (let i = 0; i < 40; i++) {
      const a = R() * TAU, d = tr * (0.3 + R() * 0.65), l = 0.15 + R() * 0.3;
      g.strokeStyle = `rgba(30,25,20,${0.5 + R() * 0.4})`; g.lineWidth = 1 + R() * 1.6; g.lineCap = 'round';
      g.beginPath(); g.arc(x, y, d, a, a + l); g.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const a = R() * TAU, d = tr * (0.4 + R() * 0.5);
      g.fillStyle = 'rgba(255,245,230,0.6)';
      g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + R() * 3, 0, TAU); g.fill();
    }
    radialFill(g, x, y, tr, [[0.75, 'rgba(40,34,28,0)'], [1, 'rgba(40,34,28,0.75)']]);
  } else {
    const n = p.kind === 'pine' ? 22 : 34;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + R() * 0.12;
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const f = k / 8, d = tr * (0.12 + f * 0.9), a = a0 + Math.sin(f * 5 + i) * 0.05 + (R() - 0.5) * 0.04;
        pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
      }
      const lit = 0.5 - (Math.cos(a0) * 0.6 + Math.sin(a0) * 0.8) * 0.5;
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(15,8,2,0.6)'; g.lineWidth = p.kind === 'pine' ? 1.6 : 2.2;
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.stroke();
      g.strokeStyle = `rgba(255,235,200,${0.08 + lit * 0.22})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(pts[0][0] - 1.4, pts[0][1] - 1.4); for (const q of pts) g.lineTo(q[0] - 1.4, q[1] - 1.4); g.stroke();
    }
    if (p.kind === 'pine') {
      for (let i = 0; i < 26; i++) {
        const a = R() * TAU, d = tr * (0.2 + R() * 0.6), s = 3 + R() * 4;
        g.fillStyle = R() < 0.5 ? 'rgba(220,120,70,0.45)' : 'rgba(170,90,50,0.45)';
        g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, s, s * 0.6, a, 0, TAU); g.fill();
      }
    }
    // cross-cracks between furrows break the ridges into plates
    g.strokeStyle = 'rgba(15,8,2,0.4)'; g.lineWidth = 0.9;
    for (let i = 0; i < 50; i++) {
      const a = R() * TAU, d = tr * (0.25 + R() * 0.7);
      g.beginPath(); g.arc(x, y, d, a, a + 0.08 + R() * 0.1); g.stroke();
    }
  }
  // moss on the shaded north-east side, lichen spots
  for (let i = 0; i < 70; i++) {
    const a = -Math.PI * 0.35 + (R() - 0.5) * 1.6, d = tr * (0.7 + R() * 0.32);
    g.fillStyle = R() < 0.5 ? 'rgba(100,140,45,0.75)' : 'rgba(70,110,35,0.75)';
    g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.8 + R() * 1.8, 0, TAU); g.fill();
  }
  for (let i = 0; i < 6; i++) {
    const a = R() * TAU, d = tr * (0.3 + R() * 0.6);
    g.fillStyle = 'rgba(190,200,150,0.5)';
    g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.5 + R() * 2.5, 0, TAU); g.fill();
  }
  g.restore();
  g.strokeStyle = 'rgba(15,8,2,0.5)'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(x, y, tr, 0, TAU); g.stroke();
}

/* Fallen logs and driftwood: furrowed bark, knots, lichen, moss and a cut end with growth rings. */
function propLog(g, p) {
  const R = mulberry32(p.seed);
  const l = p.len, w = p.w;
  const drift = p.type === 'drift';
  const bark = drift ? ['#b8b0a2', '#e8e2d4', '#6e675c'] : ['#5a4030', '#9a7a5a', '#241810'];
  g.save();
  g.translate(p.x, p.y);
  const so = rotV(5, 7, -p.rot);
  g.rotate(p.rot);
  g.save(); g.translate(so[0], so[1]); roundRectPath(g, -l / 2, -w / 2, l, w, w / 2); g.fillStyle = 'rgba(15,12,4,0.32)'; g.fill(); g.restore();
  roundRectPath(g, -l / 2, -w / 2, l, w, w / 2);
  const lg = g.createLinearGradient(0, -w / 2, 0, w / 2);
  lg.addColorStop(0, bark[1]); lg.addColorStop(0.35, bark[0]); lg.addColorStop(1, bark[2]);
  g.fillStyle = lg; g.fill();
  g.save(); roundRectPath(g, -l / 2, -w / 2, l, w, w / 2); g.clip();
  // long furrows that wander along the log, each with a lit ridge beside it
  const rows = Math.round(w / 3.2);
  for (let k = 0; k < rows; k++) {
    const yy = -w / 2 + (k + 0.5) * (w / rows);
    let px = -l / 2;
    while (px < l / 2) {
      const seg = 14 + R() * 40, wob = (R() - 0.5) * 2;
      const shadeK = (yy + w / 2) / w;
      g.strokeStyle = drift ? `rgba(90,85,75,${0.35 + shadeK * 0.25})` : `rgba(15,8,2,${0.45 + shadeK * 0.3})`; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(px, yy); g.quadraticCurveTo(px + seg / 2, yy + wob, px + seg, yy + wob * 0.5); g.stroke();
      g.strokeStyle = `rgba(255,240,215,${0.22 * (1 - shadeK)})`; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(px, yy - 1.3); g.quadraticCurveTo(px + seg / 2, yy - 1.3 + wob, px + seg, yy - 1.3 + wob * 0.5); g.stroke();
      px += seg + 2 + R() * 6;
    }
  }
  // knots
  for (let i = 0; i < 2 + ((R() * 2) | 0); i++) {
    const kx = (R() - 0.5) * l * 0.8, ky = (R() - 0.5) * w * 0.5, kr = 2.5 + R() * 3;
    for (let r = 3; r >= 1; r--) {
      g.fillStyle = r === 1 ? '#2a1a10' : rgba(drift ? '#8a8070' : '#4a3020', 0.6);
      g.beginPath(); g.ellipse(kx, ky, kr * r * 0.6, kr * r * 0.35, 0, 0, TAU); g.fill();
    }
  }
  if (!drift) {
    // bark sloughed off in places, showing pale wood beneath
    for (let i = 0; i < 2; i++) {
      const bx = (R() - 0.5) * l * 0.7, by = (R() - 0.5) * w * 0.4, bw = 16 + R() * 26, bh = 5 + R() * 6;
      g.fillStyle = '#b89a72';
      g.beginPath(); g.ellipse(bx, by, bw / 2, bh / 2, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,90,55,0.6)'; g.lineWidth = 0.5;
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(bx - bw / 2 + 3, by + k * bh * 0.25); g.lineTo(bx + bw / 2 - 3, by + k * bh * 0.25); g.stroke(); }
    }
    for (let i = 0; i < 4; i++) {
      const mx = (R() - 0.5) * l * 0.9, my = -w * 0.2 + (R() - 0.5) * w * 0.4;
      for (let k = 0; k < 40; k++) {
        g.fillStyle = ['rgba(110,150,50,0.85)', 'rgba(80,125,40,0.85)', 'rgba(140,175,70,0.7)'][(R() * 3) | 0];
        g.beginPath(); g.arc(mx + (R() - 0.5) * 24, my + (R() - 0.5) * 9, 0.8 + R() * 1.6, 0, TAU); g.fill();
      }
    }
  }
  for (let i = 0; i < 5; i++) {
    const lx = (R() - 0.5) * l * 0.85, ly = (R() - 0.5) * w * 0.6, lr = 2 + R() * 4;
    g.fillStyle = R() < 0.5 ? 'rgba(200,205,160,0.55)' : 'rgba(170,190,140,0.5)';
    g.beginPath(); g.arc(lx, ly, lr, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(230,235,200,0.5)'; g.lineWidth = 0.4; g.stroke();
  }
  g.restore();
  // cut ends: growth rings, heartwood and radial cracks
  for (const end of [-1, 1]) {
    const ex = end * (l / 2 - w * 0.12);
    const ring = drift ? ['#e0d8c8', '#b8ae9c'] : ['#c49a6a', '#8a6038'];
    g.fillStyle = ring[0]; g.beginPath(); g.ellipse(ex, 0, w * 0.18, w * 0.48, 0, 0, TAU); g.fill();
    g.strokeStyle = rgba(ring[1], 0.75); g.lineWidth = 0.5;
    for (let k = 1; k < 6; k++) { g.beginPath(); g.ellipse(ex, 0, w * 0.18 * k / 6, w * 0.48 * k / 6, 0, 0, TAU); g.stroke(); }
    g.fillStyle = rgba(ring[1], 0.8); g.beginPath(); g.ellipse(ex, 0, w * 0.05, w * 0.12, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(40,25,10,0.5)'; g.lineWidth = 0.6;
    for (let k = 0; k < 3; k++) { const a = R() * TAU; g.beginPath(); g.moveTo(ex, 0); g.lineTo(ex + Math.cos(a) * w * 0.17, Math.sin(a) * w * 0.45); g.stroke(); }
    g.strokeStyle = rgba(bark[2], 0.9); g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(ex, 0, w * 0.18, w * 0.48, 0, 0, TAU); g.stroke();
  }
  g.restore();
}
