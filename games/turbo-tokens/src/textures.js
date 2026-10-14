// Procedurally painted canvas textures (no image files needed).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { mulberry32 } from './utils.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function speckle(ctx, w, h, count, colors, rand, maxSize = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    const s = 1 + rand() * maxSize;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
}

// Road surface: u across the road, v along it. One tile = `tileLen` metres.
export function roadTexture(kind = 'asphalt') {
  return cached('road-' + kind, () => {
    const W = 512;
    const H = 1024;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    const rand = mulberry32(7);
    const base = { city: '#2a2a33', snow: '#4b4f57', sand: '#4a4440', beach: '#4c4642', lava: '#2e2a2a', moon: '#55585f', autumn: '#3b3c40' }[kind] || '#3b3d42';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    speckle(ctx, W, H, 26000, ['#2c2e33', '#46484e', '#34363b', '#505259', '#292a2e'], rand, 2);
    // Subtle tyre-worn darker lanes.
    for (const lane of [0.3, 0.7]) {
      const g = ctx.createLinearGradient(W * (lane - 0.12), 0, W * (lane + 0.12), 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.13)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (kind === 'snow') {
      // Icy frost patches.
      for (let i = 0; i < 40; i++) {
        const x = rand() * W;
        const y = rand() * H;
        const r = 20 + rand() * 60;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(220,235,255,0.35)');
        g.addColorStop(1, 'rgba(220,235,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    if (kind === 'autumn') {
      // Fallen leaves on the road.
      const cols = ['#d9531e', '#f0a020', '#b8341b', '#e8c040'];
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
        ctx.save();
        ctx.translate(rand() * W, rand() * H);
        ctx.rotate(rand() * Math.PI);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (kind === 'beach' || kind === 'sand') {
      // Wind-blown sand along the edges.
      for (const x0 of [0, W - 70]) {
        const g = ctx.createLinearGradient(x0 === 0 ? 0 : W, 0, x0 === 0 ? 70 : W - 70, 0);
        g.addColorStop(0, 'rgba(225,196,140,0.55)');
        g.addColorStop(1, 'rgba(225,196,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, 70, H);
      }
    }
    // Edge lines.
    const edge = kind === 'city' ? '#e9e9f2' : kind === 'moon' ? '#7fe3ff' : '#f2f2f2';
    ctx.fillStyle = edge;
    ctx.fillRect(10, 0, 12, H);
    ctx.fillRect(W - 22, 0, 12, H);
    // Dashed centre line.
    ctx.fillStyle = kind === 'city' || kind === 'lava' ? '#ffd23f' : kind === 'moon' ? '#7fe3ff' : '#f4f4f4';
    for (let y = 0; y < H; y += 256) ctx.fillRect(W / 2 - 5, y + 40, 10, 150);
    return toTexture(c);
  });
}

export function groundTexture(kind) {
  return cached('ground-' + kind, () => {
    const S = 512;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(13);
    const palettes = {
      grass: ['#6a9a3c', ['#5d8c33', '#78a845', '#6f9f3d', '#58852f', '#82b04c']],
      sand: ['#d9b07a', ['#cfa46c', '#e2bb86', '#c99c62', '#e8c695', '#d4aa73']],
      snow: ['#f1f5fa', ['#e6edf5', '#ffffff', '#dfe7f1', '#f7faff', '#d8e2ee']],
      city: ['#26222e', ['#2b2735', '#211d28', '#302b3a', '#1d1a24', '#35303f']],
      beach: ['#ecd3a0', ['#f2dcae', '#e4c690', '#f7e6c2', '#dcbc85', '#efd7a8']],
      autumn: ['#7a8a3a', ['#6f7f33', '#86913f', '#9a7a2f', '#a8652a', '#7b6a2c']],
      lava: ['#2b2422', ['#231d1b', '#352b28', '#3d2a22', '#1c1716', '#4a2a1e']],
      moon: ['#8c8e93', ['#7f8186', '#9a9ca1', '#86888d', '#a3a5aa', '#76787d']],
      seabed: ['#e8dcbc', ['#f0e6c8', '#dccfa8', '#f6eed6', '#d4c49c', '#e9dfc2']],
    };
    const [base, cols] = palettes[kind] || palettes.grass;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    // Blotches.
    for (let i = 0; i < 260; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const r = 8 + rand() * 40;
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // Wrap around for seamless tiling.
      for (const [ox, oy] of [[S, 0], [-S, 0], [0, S], [0, -S]]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    speckle(ctx, S, S, kind === 'grass' ? 14000 : 9000, cols, rand, kind === 'grass' ? 2.5 : 1.5);
    if (kind === 'grass') {
      ctx.strokeStyle = 'rgba(40,70,20,0.25)';
      for (let i = 0; i < 2500; i++) {
        const x = rand() * S;
        const y = rand() * S;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 3, y - 3 - rand() * 4);
        ctx.stroke();
      }
    }
    if (kind === 'autumn') {
      // Fallen leaves.
      const leaf = ['#d9531e', '#f0a020', '#b8341b', '#e8c040', '#c46a1a'];
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = leaf[Math.floor(rand() * leaf.length)];
        ctx.globalAlpha = 0.6 + rand() * 0.4;
        ctx.beginPath();
        ctx.ellipse(rand() * S, rand() * S, 3 + rand() * 3, 1.5 + rand() * 1.5, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (kind === 'moon' || kind === 'lava') {
      // Little craters / pits.
      for (let i = 0; i < 90; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const r = 2 + rand() * 9;
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (kind === 'seabed') {
      // Sand ripples and little shells.
      ctx.lineWidth = 3;
      for (let y = -20; y < S + 20; y += 11 + rand() * 4) {
        const ph = rand() * 6;
        for (const [col, dy] of [['rgba(120,100,60,0.12)', 0], ['rgba(255,255,255,0.18)', 3]]) {
          ctx.strokeStyle = col;
          ctx.beginPath();
          for (let x = 0; x <= S; x += 8) {
            const yy = y + dy + Math.sin((x / S) * Math.PI * 6 + ph) * 4;
            if (x === 0) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      }
      const shells = ['#ffd8c8', '#fff3e0', '#f5b7a5', '#e8d0ff', '#ffffff'];
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = shells[Math.floor(rand() * shells.length)];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(rand() * S, rand() * S, 1.5 + rand() * 2.5, 1 + rand() * 1.5, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (kind === 'city') {
      // Paving grid.
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= S; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, S);
        ctx.moveTo(0, i);
        ctx.lineTo(S, i);
        ctx.stroke();
      }
    }
    return toTexture(c);
  });
}

// Red/white kerb stones. v runs along the track.
export function curbTexture() {
  return cached('curb', () => {
    const c = canvas(64, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, 64, 256);
    ctx.fillStyle = '#d8232a';
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, 6, 256);
    return toTexture(c);
  });
}

export function barrierTexture(kind) {
  return cached('barrier-' + kind, () => {
    const c = canvas(256, 64);
    const ctx = c.getContext('2d');
    if (kind === 'tires') {
      ctx.fillStyle = '#1b1b1d';
      ctx.fillRect(0, 0, 256, 64);
      const cols = ['#e8e8e8', '#d8232a'];
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = cols[i % 2];
        ctx.fillRect(i * 32, 22, 32, 20);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let i = 0; i < 8; i++) ctx.fillRect(i * 32 + 2, 4, 28, 10);
    } else if (kind === 'concrete') {
      ctx.fillStyle = '#cfc6b8';
      ctx.fillRect(0, 0, 256, 64);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#f4f0ea' : '#e2672b';
        ctx.fillRect(i * 64, 28, 64, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(i * 64, 0, 2, 64);
      }
    } else if (kind === 'snow') {
      ctx.fillStyle = '#eef4fb';
      ctx.fillRect(0, 0, 256, 64);
      const rand = mulberry32(3);
      speckle(ctx, 256, 64, 900, ['#dfe9f5', '#ffffff', '#cddbea'], rand, 2);
      ctx.fillStyle = '#2a6fd6';
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 4, 40, 56, 6);
    } else if (kind === 'beach') {
      ctx.fillStyle = '#f7f4ec';
      ctx.fillRect(0, 0, 256, 64);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#1fb7c9' : '#ff8a5c';
        ctx.fillRect(i * 64, 24, 64, 18);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 64, 0, 2, 64);
    } else if (kind === 'wood') {
      ctx.fillStyle = '#7a4f2c';
      ctx.fillRect(0, 0, 256, 64);
      const rand = mulberry32(8);
      for (let y = 0; y < 64; y += 16) {
        ctx.fillStyle = y % 32 ? '#6b4426' : '#835631';
        ctx.fillRect(0, y + 1, 256, 14);
        ctx.strokeStyle = 'rgba(40,22,10,0.45)';
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          const yy = y + 3 + rand() * 10;
          ctx.moveTo(0, yy);
          ctx.bezierCurveTo(80, yy + rand() * 4 - 2, 170, yy + rand() * 4 - 2, 256, yy);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#3d2614';
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 30, 0, 6, 64);
    } else if (kind === 'lava') {
      ctx.fillStyle = '#2a2220';
      ctx.fillRect(0, 0, 256, 64);
      const rand = mulberry32(4);
      speckle(ctx, 256, 64, 1200, ['#1d1715', '#3a2e2a', '#463530'], rand, 3);
      ctx.fillStyle = '#ff7a1a';
      for (let i = 0; i < 8; i++) ctx.fillRect(i * 32 + 4, 46, 24, 4);
    } else if (kind === 'scifi') {
      ctx.fillStyle = '#e8ecf2';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#c9d0da';
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 2, 4, 60, 56);
      ctx.fillStyle = '#2b3140';
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 8, 40, 48, 8);
      ctx.fillStyle = '#ff9a1a';
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 26, 12, 12, 12);
    } else {
      // neon: dark concrete, emissive handled by separate strips.
      ctx.fillStyle = '#2b2933';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#3a3744';
      for (let i = 0; i < 8; i++) ctx.fillRect(i * 32 + 1, 2, 30, 60);
      ctx.fillStyle = '#ffcc00';
      for (let i = 0; i < 16; i++) {
        ctx.save();
        ctx.translate(i * 16, 50);
        ctx.transform(1, 0, -0.8, 1, 0, 0);
        ctx.fillRect(0, 0, 8, 10);
        ctx.restore();
      }
    }
    return toTexture(c);
  });
}

export function checkerTexture(cols = 8, rows = 2) {
  return cached(`checker-${cols}-${rows}`, () => {
    const c = canvas(cols * 32, rows * 32);
    const ctx = c.getContext('2d');
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5';
        ctx.fillRect(x * 32, y * 32, 32, 32);
      }
    const t = toTexture(c);
    t.magFilter = THREE.NearestFilter;
    return t;
  });
}

export function bannerTexture(text, sub, bg = '#d8232a') {
  const c = canvas(1024, 160);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 160);
  // Checker edges.
  for (let i = 0; i < 64; i++) {
    ctx.fillStyle = i % 2 ? '#111' : '#fff';
    ctx.fillRect(i * 16, 0, 16, 14);
    ctx.fillStyle = i % 2 ? '#fff' : '#111';
    ctx.fillRect(i * 16, 146, 16, 14);
  }
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 76px "Russo One", Impact, Arial Black, sans-serif';
  ctx.fillText(text, 512, sub ? 70 : 80);
  if (sub) {
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(sub, 512, 120);
  }
  return toTexture(c, { repeat: false });
}

// Soft round blob (used for underglow, fake shadows, particles, glows).
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  return cached(`radial-${inner}-${outer}-${size}`, () => {
    const c = canvas(size, size);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return toTexture(c, { repeat: false });
  });
}

// Building facade with lit windows. Pixel (0,0) is dark (used for roofs).
export function windowsTexture(night = true) {
  return cached('windows-' + night, () => {
    const W = 256;
    const H = 256;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    const rand = mulberry32(99);
    ctx.fillStyle = night ? '#0d0b14' : '#7d8794';
    ctx.fillRect(0, 0, W, H);
    const lit = night ? ['#ffd27a', '#ffe9b0', '#7fe7ff', '#ff8be0', '#fff4d6'] : ['#a9c8e6', '#8fb3d8', '#c4dbf0'];
    for (let y = 8; y < H; y += 32) {
      for (let x = 8; x < W; x += 24) {
        const on = night ? rand() < 0.42 : true;
        ctx.fillStyle = on ? lit[Math.floor(rand() * lit.length)] : '#1a1824';
        ctx.globalAlpha = on ? 0.55 + rand() * 0.45 : 1;
        ctx.fillRect(x, y, 14, 18);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = night ? '#0d0b14' : '#555c66';
    ctx.fillRect(0, 0, 4, 4);
    return toTexture(c);
  });
}

// Race number roundel for car doors.
export function numberTexture(num, ring = '#ffffff') {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 72px "Russo One", Impact, Arial Black, sans-serif';
  ctx.fillText(String(num), 64, 68);
  return toTexture(c, { repeat: false });
}

export function chevronTexture() {
  return cached('chevron', () => {
    const c = canvas(256, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#ffd400';
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 70;
      ctx.beginPath();
      ctx.moveTo(x, 14);
      ctx.lineTo(x + 40, 64);
      ctx.lineTo(x, 114);
      ctx.lineTo(x + 22, 114);
      ctx.lineTo(x + 62, 64);
      ctx.lineTo(x + 22, 14);
      ctx.closePath();
      ctx.fill();
    }
    return toTexture(c, { repeat: false });
  });
}

export function billboardTexture(title, color1, color2, seed = 1) {
  const c = canvas(512, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 512, 256);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  const rand = mulberry32(seed);
  for (let i = 0; i < 6; i++) ctx.fillRect(rand() * 512, rand() * 256, 80 + rand() * 120, 6);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 74px "Russo One", Impact, Arial Black, sans-serif';
  ctx.fillText(title, 256, 128);
  return toTexture(c, { repeat: false });
}

export function cloudTexture() {
  return cached('cloud', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(5);
    for (let i = 0; i < 26; i++) {
      const x = S * (0.2 + rand() * 0.6);
      const y = S * (0.4 + rand() * 0.25);
      const r = S * (0.08 + rand() * 0.16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.75)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return toTexture(c, { repeat: false });
  });
}

// Tiling water normal map (for animated ripples).
export function waterNormalTexture() {
  return cached('water-normal', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const h = (x, y) =>
      Math.sin((x / S) * Math.PI * 2 * 3 + Math.sin((y / S) * Math.PI * 2 * 2) * 1.2) * 0.5 +
      Math.sin((y / S) * Math.PI * 2 * 5 + Math.cos((x / S) * Math.PI * 2 * 3) * 1.4) * 0.35 +
      Math.sin(((x + y) / S) * Math.PI * 2 * 7) * 0.15;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = h(x + 1, y) - h(x - 1, y);
        const dy = h(x, y + 1) - h(x, y - 1);
        const nx = -dx * 2;
        const ny = -dy * 2;
        const l = Math.hypot(nx, ny, 1);
        const i = (y * S + x) * 4;
        img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
        img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, { srgb: false });
  });
}

// Glowing molten lava.
export function lavaTexture() {
  return cached('lava', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = (x / S) * Math.PI * 2;
        const v = (y / S) * Math.PI * 2;
        let n = Math.sin(u * 3 + Math.sin(v * 2) * 2) + Math.sin(v * 4 + Math.cos(u * 2) * 1.5) + Math.sin((u + v) * 5) * 0.5;
        n = (n + 2.5) / 5;
        const crust = Math.max(0, Math.min(1, (0.5 - n) * 4));
        const i = (y * S + x) * 4;
        img.data[i] = 255 * (1 - crust * 0.8);
        img.data[i + 1] = (60 + 170 * n) * (1 - crust * 0.9);
        img.data[i + 2] = 20 * n * (1 - crust);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c);
  });
}

// Planet Earth seen from the Moon.
export function earthTexture() {
  return cached('earth', () => {
    const W = 512;
    const H = 256;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1d5fbf';
    ctx.fillRect(0, 0, W, H);
    const rand = mulberry32(42);
    const land = ['#3f8f3a', '#5a9a3a', '#a08a4a', '#2f7a34'];
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = land[Math.floor(rand() * land.length)];
      const x = rand() * W;
      const y = H * 0.15 + rand() * H * 0.7;
      for (let k = 0; k < 8; k++) {
        ctx.beginPath();
        ctx.ellipse(x + (rand() - 0.5) * 60, y + (rand() - 0.5) * 30, 10 + rand() * 30, 6 + rand() * 18, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#f2f6fa';
    ctx.fillRect(0, 0, W, 14);
    ctx.fillRect(0, H - 14, W, 14);
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * W, rand() * H, 14 + rand() * 40, 3 + rand() * 6, rand() * 0.6 - 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return toTexture(c, { repeat: false });
  });
}

// Sponsor banners hung on the barriers.
export function adTexture(i) {
  return cached('ad-' + i, () => {
    const ads = [
      ['TURBO', '#ff3ea5', '#2b0a3d'],
      ['NITRO', '#22e4ff', '#06223a'],
      ['TOKENS', '#ffd23f', '#3a2600'],
      ['SPEED', '#ffffff', '#d8232a'],
      ['DRIFT', '#ff9a1a', '#111214'],
    ];
    const [txt, fg, bg] = ads[i % ads.length];
    const c = canvas(512, 64);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, 512, 5);
    ctx.fillRect(0, 59, 512, 5);
    ctx.font = 'bold italic 40px "Russo One", Impact, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const x of [128, 384]) ctx.fillText(txt, x, 34);
    return toTexture(c, { repeat: false });
  });
}

export function flagTexture(i) {
  return cached('flag-' + i, () => {
    const c = canvas(128, 80);
    const ctx = c.getContext('2d');
    if (i % 3 === 0) {
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 8; x++) {
          ctx.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5';
          ctx.fillRect(x * 16, y * 16, 16, 16);
        }
    } else {
      const cols = [['#ff3ea5', '#ffd23f'], ['#22e4ff', '#2f6bff']][i % 3 - 1];
      ctx.fillStyle = cols[0];
      ctx.fillRect(0, 0, 128, 80);
      ctx.fillStyle = cols[1];
      ctx.beginPath();
      ctx.moveTo(0, 80);
      ctx.lineTo(128, 0);
      ctx.lineTo(128, 80);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px "Russo One", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TT', 64, 52);
    }
    return toTexture(c, { repeat: false });
  });
}

// Pit garage front with roll-up doors.
export function pitTexture() {
  return cached('pit', () => {
    const c = canvas(512, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d9dde4';
    ctx.fillRect(0, 0, 512, 128);
    const team = ['#e3242b', '#2f6bff', '#ffc400', '#13b26b'];
    for (let i = 0; i < 4; i++) {
      const x = i * 128 + 14;
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(x, 34, 100, 94);
      ctx.fillStyle = '#4a505c';
      for (let y = 38; y < 128; y += 8) ctx.fillRect(x + 2, y, 96, 3);
      ctx.fillStyle = team[i];
      ctx.fillRect(x, 10, 100, 16);
    }
    return toTexture(c);
  });
}
