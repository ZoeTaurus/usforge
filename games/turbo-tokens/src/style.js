// Fun style extras: sticker art and the light trails behind your car.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';

// ---------------------------------------------------------------------------
// Stickers: drawn on a canvas with a thick white border, like a real sticker.
// ---------------------------------------------------------------------------
const S = 256;

function starPath(ctx, cx, cy, r1, r2, n = 5) {
  ctx.beginPath();
  for (let k = 0; k < n * 2; k++) {
    const a = (k / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = k % 2 ? r2 : r1;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function heartPath(ctx, cx, cy, w) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + w * 0.85);
  ctx.bezierCurveTo(cx - w * 1.25, cy + w * 0.05, cx - w * 0.75, cy - w * 0.95, cx, cy - w * 0.35);
  ctx.bezierCurveTo(cx + w * 0.75, cy - w * 0.95, cx + w * 1.25, cy + w * 0.05, cx, cy + w * 0.85);
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Fill a path with a white sticker border around it.
function sticker(ctx, path, fill, border = 18) {
  path();
  ctx.lineJoin = 'round';
  ctx.lineWidth = border;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

function grad(ctx, stops, x0 = 0, y0 = S, x1 = 0, y1 = 0) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

const DRAW = {
  flame(ctx) {
    const flame = (sx, sy, k) => () => {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx - 80 * k, sy - 10 * k, sx - 70 * k, sy - 110 * k, sx - 20 * k, sy - 170 * k);
      ctx.bezierCurveTo(sx - 25 * k, sy - 110 * k, sx + 5 * k, sy - 100 * k, sx + 10 * k, sy - 130 * k);
      ctx.bezierCurveTo(sx + 30 * k, sy - 95 * k, sx + 60 * k, sy - 120 * k, sx + 55 * k, sy - 190 * k);
      ctx.bezierCurveTo(sx + 110 * k, sy - 110 * k, sx + 85 * k, sy - 20 * k, sx, sy);
      ctx.closePath();
    };
    sticker(ctx, flame(118, 236, 1.05), grad(ctx, ['#c81a10', '#ff6a13', '#ffd23f']));
    flame(124, 228, 0.55)();
    ctx.fillStyle = grad(ctx, ['#ff9b2f', '#fff3a0']);
    ctx.fill();
  },
  bolt(ctx) {
    sticker(ctx, () => {
      ctx.beginPath();
      for (const [x, y] of [[150, 14], [62, 140], [120, 140], [92, 242], [196, 104], [136, 104], [176, 14]]) ctx.lineTo(x, y);
      ctx.closePath();
    }, grad(ctx, ['#ff9b2f', '#ffe14d', '#fff8b0']));
  },
  star(ctx) {
    sticker(ctx, () => starPath(ctx, 128, 136, 116, 50), grad(ctx, ['#ff9b2f', '#ffd23f', '#fff3a0']));
    starPath(ctx, 128, 136, 62, 27);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  },
  heart(ctx) {
    sticker(ctx, () => heartPath(ctx, 128, 120, 118), grad(ctx, ['#c8104a', '#ff3e7a', '#ff8fb8']));
    ctx.beginPath();
    ctx.ellipse(84, 78, 22, 12, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  },
  smiley(ctx) {
    sticker(ctx, () => {
      ctx.beginPath();
      ctx.arc(128, 128, 110, 0, Math.PI * 2);
    }, '#ffd23f');
    ctx.fillStyle = '#3a2a00';
    for (const x of [90, 166]) {
      ctx.beginPath();
      ctx.ellipse(x, 100, 13, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a2a00';
    ctx.beginPath();
    ctx.arc(128, 132, 62, 0.25, Math.PI - 0.25);
    ctx.stroke();
  },
  eyes(ctx) {
    for (const [x, px] of [[76, 92], [180, 196]]) {
      sticker(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, 128, 62, 0, Math.PI * 2);
      }, '#ffffff', 10);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#222';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, 150, 30, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px - 9, 140, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  },
  paw(ctx) {
    const pads = () => {
      ctx.beginPath();
      ctx.ellipse(128, 168, 62, 52, 0, 0, Math.PI * 2);
      for (const [x, y, r] of [[52, 104, 28], [92, 58, 30], [164, 58, 30], [204, 104, 28]]) {
        ctx.moveTo(x + r, y);
        ctx.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2);
      }
    };
    sticker(ctx, pads, '#7a3cff');
  },
  checker(ctx) {
    sticker(ctx, () => {
      ctx.beginPath();
      ctx.rect(30, 30, 20, 200);
      ctx.moveTo(50, 36);
      ctx.bezierCurveTo(110, 10, 150, 70, 226, 40);
      ctx.lineTo(226, 150);
      ctx.bezierCurveTo(150, 180, 110, 120, 50, 146);
      ctx.closePath();
    }, '#ffffff');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(50, 36);
    ctx.bezierCurveTo(110, 10, 150, 70, 226, 40);
    ctx.lineTo(226, 150);
    ctx.bezierCurveTo(150, 180, 110, 120, 50, 146);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#111';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) ctx.fillRect(50 + i * 30, 10 + j * 30 + Math.sin(i) * 8, 30, 30);
    ctx.restore();
    ctx.fillStyle = '#555';
    ctx.fillRect(30, 30, 20, 200);
  },
  skull(ctx) {
    sticker(ctx, () => {
      ctx.beginPath();
      ctx.arc(128, 108, 92, Math.PI * 0.85, Math.PI * 0.15);
      ctx.lineTo(186, 196);
      ctx.lineTo(70, 196);
      ctx.closePath();
    }, '#f4f1e8');
    ctx.fillStyle = '#1a1a1a';
    for (const x of [90, 166]) {
      ctx.beginPath();
      ctx.ellipse(x, 116, 26, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(128, 146);
    ctx.lineTo(114, 172);
    ctx.lineTo(142, 172);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(84, 184, 88, 6);
    for (let x = 96; x <= 160; x += 16) ctx.fillRect(x, 176, 5, 22);
  },
  crown(ctx) {
    sticker(ctx, () => {
      ctx.beginPath();
      for (const [x, y] of [[30, 200], [30, 70], [80, 130], [128, 40], [176, 130], [226, 70], [226, 200]]) ctx.lineTo(x, y);
      ctx.closePath();
    }, grad(ctx, ['#c98a00', '#ffd23f', '#fff3a0']));
    for (const [x, c] of [[78, '#ff3e7a'], [128, '#2fa8ff'], [178, '#3fdc6a']]) {
      ctx.beginPath();
      ctx.arc(x, 170, 15, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    }
  },
  turbo(ctx) {
    sticker(ctx, () => roundRect(ctx, 14, 70, 228, 116, 26), grad(ctx, ['#c8102e', '#ff3e5c'], 0, 186, 0, 70));
    ctx.font = 'italic 900 64px "Arial Black", "Russo One", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#7a0010';
    ctx.strokeText('TURBO', 128, 130);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TURBO', 128, 130);
  },
};

const stickerCache = new Map();
export function stickerTexture(id) {
  if (!DRAW[id]) return null;
  if (!stickerCache.has(id)) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    DRAW[id](ctx);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    stickerCache.set(id, t);
  }
  return stickerCache.get(id);
}

// Small picture of a sticker for the shop cards.
const urlCache = new Map();
export function stickerImage(id) {
  if (!urlCache.has(id)) {
    const t = stickerTexture(id);
    urlCache.set(id, t ? t.image.toDataURL() : '');
  }
  return urlCache.get(id);
}

// ---------------------------------------------------------------------------
// Light trails: two glowing ribbons streaming from the back corners of the car.
// ---------------------------------------------------------------------------
const TRAIL_VERT = /* glsl */ `
  attribute float alpha;
  attribute vec3 color;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vEdge;
  attribute float edge;
  void main() {
    vAlpha = alpha;
    vColor = color;
    vEdge = edge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const TRAIL_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vEdge;
  void main() {
    // Bright core, soft edges.
    float core = 1.0 - abs(vEdge);
    float a = vAlpha * smoothstep(0.0, 0.7, core);
    gl_FragColor = vec4(vColor * (0.8 + core * 0.9), a);
  }
`;

const LIFE = 0.55; // seconds a trail point lives
const MAXP = 44;
const _c = new THREE.Color();
const _a = new THREE.Color();
const _b = new THREE.Color();

function trailColor(kind, accent, age, time, out) {
  const mix3 = (c0, c1, c2, u) => (u < 0.5 ? out.copy(_a.set(c0)).lerp(_b.set(c1), u * 2) : out.copy(_a.set(c1)).lerp(_b.set(c2), (u - 0.5) * 2));
  switch (kind) {
    case 'rainbow':
      return out.setHSL((age * 1.3 + time * 0.35) % 1, 1, 0.55);
    case 'fire':
      return mix3('#fff2a0', '#ff7a1a', '#c01010', age);
    case 'ice':
      return mix3('#ffffff', '#7ff3ff', '#2a6bff', age);
    case 'gold':
      return mix3('#fffbe0', '#ffd23f', '#ff9500', age);
    case 'galaxy':
      return mix3('#ff4fd8', '#8a5bff', '#2fe0ff', (age + Math.sin(time * 2) * 0.1 + 0.1) % 1);
    default:
      return out.copy(accent);
  }
}

export class Trail {
  // halfWidth / rear: where on the car the ribbons start (car space).
  constructor(kind, accent, halfWidth, rear, height = 0.55) {
    this.kind = kind;
    this.accent = new THREE.Color(accent);
    this.offsets = [new THREE.Vector3(halfWidth, height, rear), new THREE.Vector3(-halfWidth, height, rear)];
    this.pts = [[], []];
    this.time = 0;
    const n = 2 * MAXP * 2;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.alpha = new Float32Array(n);
    const edge = new Float32Array(n);
    for (let i = 0; i < n; i++) edge[i] = i % 2 ? -1 : 1;
    const idx = [];
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < MAXP - 1; i++) {
        const a = (r * MAXP + i) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('edge', new THREE.BufferAttribute(edge, 1));
    g.setIndex(idx);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this._w = new THREE.Vector3();
  }

  reset() {
    this.pts = [[], []];
  }

  // Call every frame with the car's model root. Points are added while the car moves fast.
  update(dt, root, camera, speed) {
    this.time += dt;
    root.updateWorldMatrix(true, false);
    for (let r = 0; r < 2; r++) {
      const pts = this.pts[r];
      const p = this._w.copy(this.offsets[r]).applyMatrix4(root.matrixWorld);
      const last = pts[0];
      const d = last ? last.p.distanceTo(p) : Infinity;
      if (last && d > 14) pts.length = 0; // the car jumped (respawn or a new replay clip)
      if (speed > 7 && (!pts.length || d > 0.4)) {
        pts.unshift({ p: p.clone(), t: this.time });
        if (pts.length > MAXP) pts.pop();
      }
      while (pts.length && this.time - pts[pts.length - 1].t > LIFE) pts.pop();
      // The newest point always follows the car so the ribbon stays attached.
      if (pts.length && speed > 7) pts[0].p.copy(p);
    }
    this.build(camera);
  }

  // Garage preview: a frozen trail straight out behind the car.
  preview(root, camera, dt) {
    this.time += dt;
    root.updateWorldMatrix(true, false);
    for (let r = 0; r < 2; r++) {
      const pts = (this.pts[r] = []);
      for (let k = 0; k < 22; k++) {
        const p = this._w.copy(this.offsets[r]).add(new THREE.Vector3(0, 0, -k * 0.32)).applyMatrix4(root.matrixWorld);
        pts.push({ p: p.clone(), t: this.time - (k / 22) * LIFE * 0.95 });
      }
    }
    this.build(camera);
  }

  build(camera) {
    const pos = this.pos;
    const col = this.col;
    const alpha = this.alpha;
    alpha.fill(0);
    const tang = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const side = new THREE.Vector3();
    for (let r = 0; r < 2; r++) {
      const pts = this.pts[r];
      for (let i = 0; i < MAXP; i++) {
        const v = (r * MAXP + i) * 2;
        if (i >= pts.length) {
          // Collapse unused vertices onto the last point.
          const q = pts.length ? pts[pts.length - 1].p : this._w;
          for (let k = 0; k < 2; k++) pos.set([q.x, q.y, q.z], (v + k) * 3);
          continue;
        }
        const pt = pts[i];
        const age = Math.min(1, (this.time - pt.t) / LIFE);
        const a = pts[Math.max(0, i - 1)].p;
        const b = pts[Math.min(pts.length - 1, i + 1)].p;
        tang.subVectors(a, b);
        if (tang.lengthSq() < 1e-6) tang.set(0, 0, 1);
        toCam.subVectors(camera.position, pt.p);
        side.crossVectors(tang, toCam).normalize().multiplyScalar(0.2 * (1 - age * 0.6));
        pos.set([pt.p.x + side.x, pt.p.y + side.y, pt.p.z + side.z], v * 3);
        pos.set([pt.p.x - side.x, pt.p.y - side.y, pt.p.z - side.z], (v + 1) * 3);
        trailColor(this.kind, this.accent, age, this.time, _c);
        for (let k = 0; k < 2; k++) {
          col.set([_c.r, _c.g, _c.b], (v + k) * 3);
          alpha[v + k] = Math.pow(1 - age, 1.4) * 0.95;
        }
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.mesh.removeFromParent();
  }
}
