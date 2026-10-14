// Builds the 3D environment for a track: sky, terrain, road, barriers,
// start gantry, grandstands and themed scenery.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js/+esm';
import { mulberry32, fbm, smoothstep, clamp } from './utils.js';
import {
  roadTexture, groundTexture, curbTexture, barrierTexture, checkerTexture, bannerTexture,
  radialTexture, windowsTexture, chevronTexture, billboardTexture, cloudTexture,
  waterNormalTexture, lavaTexture, earthTexture,
} from './textures.js';
import { addTrackDetails } from './details.js';
import { makeCaustics, buildUnderwater } from './underwater.js';

// ---------------------------------------------------------------------------
// Distance-to-track lookup grid (used for terrain + scenery placement).
// ---------------------------------------------------------------------------
class DistanceField {
  constructor(path, cx, cz, size, cell) {
    this.cx = cx;
    this.cz = cz;
    this.size = size;
    this.cell = cell;
    this.n = Math.ceil(size / cell) + 1;
    this.x0 = cx - size / 2;
    this.z0 = cz - size / 2;
    const step = Math.max(1, Math.round(6 / path.step));
    const sx = [];
    const sz = [];
    const sy = [];
    for (let i = 0; i < path.count; i += step) {
      sx.push(path.px[i]);
      sz.push(path.pz[i]);
      sy.push(path.py[i]);
    }
    const SX = Float32Array.from(sx);
    const SZ = Float32Array.from(sz);
    const m = SX.length;
    const d = new Float32Array(this.n * this.n);
    const hy = new Float32Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) {
      const z = this.z0 + j * cell;
      for (let i = 0; i < this.n; i++) {
        const x = this.x0 + i * cell;
        let best = 1e12;
        let bk = 0;
        for (let k = 0; k < m; k++) {
          const dx = x - SX[k];
          const dz = z - SZ[k];
          const q = dx * dx + dz * dz;
          if (q < best) {
            best = q;
            bk = k;
          }
        }
        d[j * this.n + i] = Math.sqrt(best);
        hy[j * this.n + i] = sy[bk];
      }
    }
    this.d = d;
    this.hy = hy;
  }

  // Height of the nearest point of the road.
  trackY(x, z) {
    const i = Math.round(clamp((x - this.x0) / this.cell, 0, this.n - 1));
    const j = Math.round(clamp((z - this.z0) / this.cell, 0, this.n - 1));
    return this.hy[j * this.n + i];
  }

  at(x, z) {
    const fx = clamp((x - this.x0) / this.cell, 0, this.n - 1.001);
    const fz = clamp((z - this.z0) / this.cell, 0, this.n - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const n = this.n;
    const a = this.d[j * n + i];
    const b = this.d[j * n + i + 1];
    const c = this.d[(j + 1) * n + i];
    const e = this.d[(j + 1) * n + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
  }
}

// Strip geometry generated per path sample. fn(i) -> [x1,y1,z1,u1,v1, x2,y2,z2,u2,v2]
function stripGeometry(path, fn, from = 0, to = path.count) {
  const pos = [];
  const uv = [];
  const idx = [];
  let n = 0;
  for (let k = from; k <= to; k++) {
    const i = path.wrapIndex(k);
    const r = fn(i, k);
    pos.push(r[0], r[1], r[2], r[5], r[6], r[7]);
    uv.push(r[3], r[4], r[8], r[9]);
    if (n > 0) {
      const a = (n - 1) * 2;
      const b = n * 2;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function colorGeo(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

function merged(parts) {
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// Scenery prop geometries (vertex coloured, instanced).
// ---------------------------------------------------------------------------
const PROPS = {
  roundTree() {
    const trunk = new THREE.CylinderGeometry(0.22, 0.35, 3, 6).translate(0, 1.5, 0);
    const c1 = new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4.2, 0);
    const c2 = new THREE.IcosahedronGeometry(1.7, 0).translate(0.9, 5.4, 0.4);
    return merged([colorGeo(trunk, '#6b4a2b'), colorGeo(c1, '#4f8f2f'), colorGeo(c2, '#5fa137')]);
  },
  pine(snow = false) {
    const parts = [colorGeo(new THREE.CylinderGeometry(0.2, 0.3, 2, 6).translate(0, 1, 0), '#5a3d22')];
    const tiers = [[2.4, 3.4, 2.6], [1.9, 3, 4.4], [1.3, 2.6, 6.1]];
    for (const [r, h, y] of tiers) {
      parts.push(colorGeo(new THREE.ConeGeometry(r, h, 7).translate(0, y, 0), '#2f5e34'));
      if (snow) parts.push(colorGeo(new THREE.ConeGeometry(r * 0.75, h * 0.45, 7).translate(0, y + h * 0.3, 0), '#f4f8fc'));
    }
    return merged(parts);
  },
  bush(color = '#4a7f2a') {
    return merged([
      colorGeo(new THREE.IcosahedronGeometry(1, 0).scale(1.3, 0.8, 1.2).translate(0, 0.5, 0), color),
      colorGeo(new THREE.IcosahedronGeometry(0.7, 0).translate(0.7, 0.6, 0.3), color),
    ]);
  },
  rock(color = '#8a8a86') {
    return merged([colorGeo(new THREE.DodecahedronGeometry(1.6, 0).scale(1.4, 0.8, 1.1).translate(0, 0.5, 0), color)]);
  },
  cactus() {
    const c = '#3f7f3a';
    const parts = [
      new THREE.CylinderGeometry(0.42, 0.48, 6, 8).translate(0, 3, 0),
      new THREE.SphereGeometry(0.42, 8, 6).translate(0, 6, 0),
      new THREE.CylinderGeometry(0.28, 0.28, 1.4, 8).rotateZ(Math.PI / 2).translate(0.9, 2.6, 0),
      new THREE.CylinderGeometry(0.28, 0.28, 2.2, 8).translate(1.55, 3.6, 0),
      new THREE.SphereGeometry(0.28, 8, 6).translate(1.55, 4.7, 0),
      new THREE.CylinderGeometry(0.26, 0.26, 1.2, 8).rotateZ(Math.PI / 2).translate(-0.8, 3.4, 0),
      new THREE.CylinderGeometry(0.26, 0.26, 1.6, 8).translate(-1.35, 4.1, 0),
      new THREE.SphereGeometry(0.26, 8, 6).translate(-1.35, 4.9, 0),
    ];
    return merged(parts.map((p) => colorGeo(p, c)));
  },
  snowman() {
    return merged([
      colorGeo(new THREE.SphereGeometry(1.0, 12, 10).translate(0, 0.9, 0), '#f6f9fc'),
      colorGeo(new THREE.SphereGeometry(0.72, 12, 10).translate(0, 2.25, 0), '#f6f9fc'),
      colorGeo(new THREE.SphereGeometry(0.5, 12, 10).translate(0, 3.25, 0), '#f6f9fc'),
      colorGeo(new THREE.ConeGeometry(0.09, 0.5, 8).rotateX(Math.PI / 2).translate(0, 3.25, 0.65), '#ff7a1a'),
      colorGeo(new THREE.SphereGeometry(0.06, 6, 4).translate(0.17, 3.4, 0.43), '#111111'),
      colorGeo(new THREE.SphereGeometry(0.06, 6, 4).translate(-0.17, 3.4, 0.43), '#111111'),
      colorGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 12).translate(0, 3.66, 0), '#222222'),
      colorGeo(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12).translate(0, 3.9, 0), '#222222'),
      colorGeo(new THREE.TorusGeometry(0.5, 0.1, 6, 14).rotateX(Math.PI / 2).translate(0, 2.85, 0), '#d8232a'),
    ]);
  },
  cabin(roof = '#f4f8fc', wall = '#7a4a2a') {
    const body = new THREE.BoxGeometry(8, 4, 6).translate(0, 2, 0);
    const shape = new THREE.Shape();
    shape.moveTo(-4.6, 0);
    shape.lineTo(4.6, 0);
    shape.lineTo(0, 3.2);
    shape.lineTo(-4.6, 0);
    const r = new THREE.ExtrudeGeometry(shape, { depth: 7, bevelEnabled: false }).translate(0, 4, -3.5);
    const door = new THREE.BoxGeometry(1.4, 2.4, 0.1).translate(0, 1.2, 3.02);
    const win = new THREE.BoxGeometry(1.4, 1.2, 0.1).translate(2.4, 2.4, 3.02);
    return merged([colorGeo(body, wall), colorGeo(r, roof), colorGeo(door, '#3b2414'), colorGeo(win, '#ffd98a')]);
  },
  palm() {
    const parts = [];
    for (let k = 0; k < 7; k++) {
      const off = Math.pow(k / 7, 2) * 1.6;
      parts.push(colorGeo(new THREE.CylinderGeometry(0.22 - k * 0.012, 0.26 - k * 0.012, 1.15, 7).translate(off, k * 1.1 + 0.55, 0), k % 2 ? '#8a6a44' : '#7a5a38'));
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const leaf = new THREE.ConeGeometry(0.5, 3.6, 4, 1).rotateZ(-Math.PI / 2).translate(1.8, 0, 0).scale(1, 0.22, 1).rotateZ(-0.38).rotateY(a).translate(1.6, 7.7, 0);
      parts.push(colorGeo(leaf, k % 2 ? '#3f9a3a' : '#2f8a34'));
    }
    parts.push(colorGeo(new THREE.SphereGeometry(0.4, 6, 5).translate(1.6, 7.45, 0), '#6a4a2a'));
    return merged(parts);
  },
  umbrella() {
    return merged([
      colorGeo(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6).translate(0, 1.2, 0), '#f2f2f2'),
      colorGeo(new THREE.ConeGeometry(1.5, 0.6, 10, 1, true).translate(0, 2.3, 0), '#ffffff'),
      colorGeo(new THREE.BoxGeometry(0.7, 0.08, 1.8).translate(1.1, 0.3, 0.2), '#ffffff'),
    ]);
  },
  boat() {
    const sail = new THREE.Shape();
    sail.moveTo(0, 0);
    sail.lineTo(0, 6);
    sail.lineTo(2.8, 0.4);
    sail.lineTo(0, 0);
    return merged([
      colorGeo(new THREE.CylinderGeometry(0.9, 0.5, 4.4, 8, 1).rotateX(Math.PI / 2).scale(1, 0.55, 1).translate(0, 0.3, 0), '#f5f5f5'),
      colorGeo(new THREE.CylinderGeometry(0.06, 0.06, 6.5, 6).translate(0, 3.6, 0.3), '#c9c9c9'),
      colorGeo(new THREE.ExtrudeGeometry(sail, { depth: 0.04, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(0, 0.9, 0.4), '#ffffff'),
    ]);
  },
  autumnTree() {
    const trunk = new THREE.CylinderGeometry(0.22, 0.35, 3, 6).translate(0, 1.5, 0);
    const c1 = new THREE.IcosahedronGeometry(2.3, 0).translate(0, 4.1, 0);
    const c2 = new THREE.IcosahedronGeometry(1.6, 0).translate(-0.8, 5.3, 0.4);
    const c3 = new THREE.IcosahedronGeometry(1.3, 0).translate(0.9, 4.9, -0.6);
    return merged([colorGeo(trunk, '#7a5a3a'), colorGeo(c1, '#ffffff'), colorGeo(c2, '#f2e2d2'), colorGeo(c3, '#ffe9c9')]);
  },
  pumpkin() {
    return merged([
      colorGeo(new THREE.SphereGeometry(0.55, 10, 8).scale(1, 0.72, 1).translate(0, 0.38, 0), '#ff7a1a'),
      colorGeo(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 5).translate(0, 0.85, 0), '#4a6a2a'),
    ]);
  },
  deadTree() {
    const parts = [colorGeo(new THREE.CylinderGeometry(0.16, 0.32, 5, 6).translate(0, 2.5, 0), '#2a201c')];
    for (const [a, y, l] of [[0.6, 3.2, 2.2], [2.6, 3.9, 1.8], [4.4, 2.6, 1.6]]) {
      parts.push(colorGeo(new THREE.CylinderGeometry(0.05, 0.1, l, 5).translate(0, l / 2, 0).rotateZ(0.9).rotateY(a).translate(0, y, 0), '#2a201c'));
    }
    return merged(parts);
  },
  dome() {
    return merged([
      colorGeo(new THREE.SphereGeometry(6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#e8ecf2'),
      colorGeo(new THREE.CylinderGeometry(6.05, 6.05, 0.7, 24, 1, true).translate(0, 1.4, 0), '#2f8fd8'),
      colorGeo(new THREE.BoxGeometry(2.4, 2.6, 3).translate(0, 1.3, 6.4), '#c9d0da'),
      colorGeo(new THREE.BoxGeometry(1.4, 2, 0.1).translate(0, 1.1, 7.92), '#3a4252'),
    ]);
  },
  antenna() {
    const dish = new THREE.LatheGeometry(
      Array.from({ length: 8 }, (_, k) => new THREE.Vector2(0.05 + (k / 7) * 2.4, Math.pow(k / 7, 2) * 0.9)),
      18,
    ).rotateX(-0.9).translate(0, 5, 0);
    return merged([
      colorGeo(new THREE.CylinderGeometry(0.18, 0.3, 5, 8).translate(0, 2.5, 0), '#9aa3ad'),
      colorGeo(dish, '#e8ecf2'),
      colorGeo(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5).rotateX(-0.9).translate(0, 5.6, 0.6), '#9aa3ad'),
    ]);
  },
  rocket() {
    const parts = [
      colorGeo(new THREE.CylinderGeometry(1.1, 1.1, 11, 14).translate(0, 6.5, 0), '#f2f2f2'),
      colorGeo(new THREE.ConeGeometry(1.1, 3, 14).translate(0, 13.5, 0), '#d8232a'),
      colorGeo(new THREE.CylinderGeometry(1.12, 1.12, 0.8, 14).translate(0, 9, 0), '#d8232a'),
      colorGeo(new THREE.CylinderGeometry(0.8, 1.0, 1.0, 12).translate(0, 0.5, 0), '#3a3f47'),
    ];
    for (let k = 0; k < 3; k++) parts.push(colorGeo(new THREE.BoxGeometry(0.15, 2.4, 1.6).translate(0, 2.2, 1.6).rotateY((k / 3) * Math.PI * 2), '#d8232a'));
    return merged(parts);
  },
  solar() {
    return merged([
      colorGeo(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 5).translate(0, 0.7, 0), '#9aa3ad'),
      colorGeo(new THREE.BoxGeometry(4, 0.08, 2.4).rotateX(-0.5).translate(0, 1.5, 0), '#1c2f6f'),
    ]);
  },
  crate() {
    return merged([colorGeo(new THREE.BoxGeometry(1.4, 1.4, 1.4).translate(0, 0.7, 0), '#c9a227'), colorGeo(new THREE.BoxGeometry(1.45, 0.2, 1.45).translate(0, 0.7, 0), '#3a3f47')]);
  },
  hay() {
    return merged([colorGeo(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 12).rotateZ(Math.PI / 2).translate(0, 0.9, 0), '#d9b45a')]);
  },
};

function instanced(geo, mat, transforms, { cast = true } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, transforms.length));
  const o = new THREE.Object3D();
  transforms.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.rotation.set(0, t.ry || 0, 0);
    if (t.sx) o.scale.set(t.sx, t.sy, t.sz);
    else o.scale.setScalar(t.s || 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (t.color) m.setColorAt(i, t.color);
  });
  m.count = transforms.length;
  m.castShadow = cast;
  m.receiveShadow = false;
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return m;
}

// ---------------------------------------------------------------------------
// Sky dome.
// ---------------------------------------------------------------------------
function skyMaterial(sky) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(sky.top) },
      horizon: { value: new THREE.Color(sky.horizon) },
      bottom: { value: new THREE.Color(sky.bottom) },
      sunDir: { value: new THREE.Vector3(...sky.sun).normalize() },
      sunColor: { value: new THREE.Color(sky.sunColor) },
      night: { value: sky.stars ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top, horizon, bottom, sunDir, sunColor;
      uniform float night;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.55, h), 0.7)) : mix(horizon, bottom, smoothstep(0.0, -0.15, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        float disc = night > 0.5 ? smoothstep(0.9993, 0.9996, s) * 1.5 : pow(s, 900.0) * 6.0;
        col += sunColor * (disc + pow(s, 14.0) * (night > 0.5 ? 0.12 : 0.35));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// ---------------------------------------------------------------------------
// Main builder.
// ---------------------------------------------------------------------------
export function buildWorld(def, path, { quality = 'high', renderer } = {}) {
  const T = def.theme;
  const hi = quality === 'high';
  const scene = new THREE.Scene();
  const rand = mulberry32(def.seed);
  const hw = path.halfWidth;
  const wall = path.wallDist;
  const updaters = [];
  const disposables = [];
  const uw = T.underwater || null;
  const caustics = uw ? makeCaustics(hi, uw.level) : null;
  if (caustics) updaters.push((dt) => caustics.tick(dt));

  // --- Distance field & height function ----------------------------------
  const b = path.bounds();
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  const size = span + 2000;
  const df = new DistanceField(path, cx, cz, size + 40, 10);
  const terr = T.terrain;
  const flat = wall + 14;
  const seed = def.seed;
  // Moon craters: bowls with a raised rim.
  const craters = [];
  if (terr.style === 'craters') {
    const cr = mulberry32(seed + 7);
    for (let k = 0; k < 70; k++) {
      const r = 15 + Math.pow(cr(), 2) * 95;
      craters.push({ x: cx + (cr() * 2 - 1) * size * 0.45, z: cz + (cr() * 2 - 1) * size * 0.45, r, d: r * (0.16 + cr() * 0.1) });
    }
  }

  function heightAt(x, z) {
    if (terr.style === 'flat') return -0.05;
    const d = df.at(x, z);
    if (terr.style === 'seabed') return seabedHeight(x, z, d);
    const t = smoothstep(flat, flat + 170, d);
    if (t <= 0) return -0.05;
    const sc = terr.scale;
    const far = smoothstep(450, 1100, d);
    let h = 0;
    if (terr.style === 'hills') {
      const n = fbm(x * sc, z * sc, 4, seed);
      h = Math.max(0, n - 0.32) * terr.height * 2.2 + far * terr.height * 1.6 * fbm(x * sc * 0.5, z * sc * 0.5, 3, seed + 5);
    } else if (terr.style === 'mesa') {
      const n = fbm(x * sc, z * sc, 4, seed);
      const mesa = smoothstep(0.5, 0.54, n) * 0.55 + smoothstep(0.6, 0.63, n) * 0.45;
      h = mesa * terr.height + fbm(x * 0.02, z * 0.02, 2, seed + 9) * 5 + far * terr.height * 1.2 * smoothstep(0.35, 0.5, n);
    } else if (terr.style === 'mountains') {
      const n = fbm(x * sc, z * sc, 5, seed);
      const ridge = 1 - Math.abs(2 * fbm(x * sc * 1.7, z * sc * 1.7, 4, seed + 3) - 1);
      h = Math.pow(n, 1.5) * terr.height * 0.9 + ridge * terr.height * 0.35 * smoothstep(250, 700, d) + far * terr.height * 1.2;
    } else if (terr.style === 'coast') {
      // Hills inland, a sandy beach, then the sea floor drops away.
      const n = fbm(x * sc, z * sc, 4, seed);
      const c = terr.coast;
      const sea = (c.axis === 'z' ? z : x) * c.dir - c.at;
      h = (Math.max(0, n - 0.3) * terr.height * 2.2 + far * terr.height * 1.4) * (1 - smoothstep(-260, -20, sea));
      h -= smoothstep(-10, 160, sea) * 24;
    } else if (terr.style === 'volcano') {
      // Rough ground with lava-filled hollows and a big volcano in the middle.
      const n = fbm(x * sc, z * sc, 4, seed);
      h = (n - 0.47) * terr.height * 1.8 + far * terr.height * 1.6 * fbm(x * sc * 0.5, z * sc * 0.5, 3, seed + 5);
      const c = terr.cone;
      const r = Math.hypot(x - c.x, z - c.z);
      if (r < c.r) {
        const k = 1 - r / c.r;
        let cone = Math.pow(k, 1.6) * c.h;
        const crater = c.r * 0.16;
        if (r < crater) cone -= (1 - r / crater) * c.h * 0.22;
        h = Math.max(h, cone);
      }
    } else if (terr.style === 'craters') {
      h = (fbm(x * sc, z * sc, 3, seed) - 0.45) * terr.height * 0.8 + far * terr.height * 3 * fbm(x * sc * 0.6, z * sc * 0.6, 3, seed + 5);
      for (const c of craters) {
        const dx = x - c.x;
        const dz = z - c.z;
        const q2 = (dx * dx + dz * dz) / (c.r * c.r);
        if (q2 > 1.69) continue;
        const q = Math.sqrt(q2);
        h += q < 1 ? -c.d * (1 - q2) : c.d * 0.3 * (1 - (q - 1) / 0.3);
      }
    }
    return -0.05 + t * h;
  }

  // Deep sea floor far below the floating road, plus the island it crosses.
  function seabedHeight(x, z, d) {
    const sc = terr.scale;
    const n = fbm(x * sc, z * sc, 4, seed);
    let h = uw.floor + (n - 0.5) * terr.height * 2.4 + smoothstep(450, 1100, d) * 45 * fbm(x * 0.002, z * 0.002, 3, seed + 3);
    const isl = def.island;
    if (isl) {
      const r = Math.hypot((x - isl.x) / 130, (z - isl.z) / 62);
      const top = isl.height + 0.8 + Math.max(0, fbm(x * 0.03, z * 0.03, 2, seed + 11) - 0.45) * 8 * smoothstep(0.2, 0.7, r);
      const island = top - smoothstep(0.72, 1.0, r) * (top - (uw.level - 1.5)) - smoothstep(1.0, 1.9, r) * (uw.level - 1.5 - uw.floor);
      h = Math.max(h, island);
    }
    // Keep the sea floor well below the floating road. On the island the
    // ground meets the road instead.
    if (d < wall + 70) {
      const ty = df.trackY(x, z);
      const gap = 0.45 + (1 - smoothstep(uw.level - 8, uw.level - 1, ty)) * 9;
      h = Math.min(h, ty - gap + smoothstep(wall + 8, wall + 70, d) * 60);
    }
    return h;
  }

  // --- Sky, fog, lights ---------------------------------------------------
  const skyMat = skyMaterial(T.sky);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);
  scene.fog = new THREE.Fog(T.fog.color, T.fog.near, hi ? T.fog.far : T.fog.far * 0.8);
  scene.background = new THREE.Color(T.fog.color);

  const hemi = new THREE.HemisphereLight(T.hemi.sky, T.hemi.ground, T.hemi.intensity);
  scene.add(hemi);
  const sunDir = new THREE.Vector3(...T.sky.sun).normalize();
  const sun = new THREE.DirectionalLight(T.sunLight.color, T.sunLight.intensity);
  sun.position.copy(sunDir).multiplyScalar(200);
  sun.castShadow = hi;
  if (hi) {
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -70;
    sc.right = 70;
    sc.top = 70;
    sc.bottom = -70;
    sc.near = 10;
    sc.far = 500;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
  }
  scene.add(sun);
  scene.add(sun.target);

  // Environment map (reflections on the cars) rendered from a mini sky.
  if (renderer) {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial(T.sky));
    envScene.add(envSky);
    const groundEnv = new THREE.Mesh(
      new THREE.CircleGeometry(48, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: T.night ? '#120a1e' : T.hemi.ground }),
    );
    groundEnv.position.y = -5;
    envScene.add(groundEnv);
    if (T.night && !T.nightMode) {
      const cols = ['#ff2fa8', '#2fe6ff', '#ffd23f', '#8a5bff'];
      for (let i = 0; i < 10; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ color: cols[i % 4], side: THREE.DoubleSide }));
        const a = (i / 10) * Math.PI * 2;
        p.position.set(Math.cos(a) * 40, 4 + (i % 3) * 5, Math.sin(a) * 40);
        p.lookAt(0, 0, 0);
        envScene.add(p);
      }
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = T.night ? 0.9 : 0.75;
    pmrem.dispose();
    disposables.push(env);
    envScene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }

  // Stars & moon for night maps.
  if (T.sky.stars) {
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rand() * Math.PI * 2;
      const v = 0.05 + rand() * 0.95;
      const r = 3500;
      const y = v * r;
      const rr = Math.sqrt(r * r - y * y);
      pos.set([Math.cos(u) * rr, y, Math.sin(u) * rr], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    stars.frustumCulled = false;
    scene.add(stars);
    updaters.push((dt, cam) => stars.position.copy(cam.position));
  }
  updaters.push((dt, cam) => sky.position.copy(cam.position));

  // Clouds.
  if (T.clouds) {
    const cmat = new THREE.SpriteMaterial({ map: cloudTexture(), fog: false, transparent: true, opacity: 0.9, depthWrite: false });
    if (T.cloudTint) cmat.color.set(T.cloudTint);
    const group = new THREE.Group();
    group.name = 'clouds';
    for (let i = 0; i < (hi ? 40 : 20) * (T.wet ? 2 : 1); i++) {
      const s = new THREE.Sprite(cmat);
      const a = rand() * Math.PI * 2;
      const r = 400 + rand() * 1600;
      s.position.set(cx + Math.cos(a) * r, 220 + rand() * 260, cz + Math.sin(a) * r);
      const sc = 260 + rand() * 300;
      s.scale.set(sc, sc * 0.5, 1);
      group.add(s);
    }
    scene.add(group);
    updaters.push((dt) => {
      group.position.x += dt * 4;
      if (group.position.x > 600) group.position.x = -600;
    });
  }

  // --- Terrain ------------------------------------------------------------
  {
    const segs = hi ? 220 : 140;
    const g = new THREE.PlaneGeometry(size, size, segs, segs);
    g.rotateX(-Math.PI / 2);
    g.translate(cx, 0, cz);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const nrm = g.attributes.normal;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    const tint = {
      grass: (h, slope) => c.setRGB(1, 1, 1).lerp(new THREE.Color(0.55, 0.62, 0.45), smoothstep(0.15, 0.45, slope)).lerp(new THREE.Color(0.75, 0.85, 0.65), smoothstep(80, 160, h)),
      sand: (h, slope) => c.setRGB(1, 1, 1).lerp(new THREE.Color(0.85, 0.5, 0.35), smoothstep(0.25, 0.55, slope)).lerp(new THREE.Color(0.95, 0.8, 0.65), smoothstep(60, 120, h) * (1 - smoothstep(0.25, 0.5, slope))),
      snow: (h, slope) => c.setRGB(1, 1, 1).lerp(new THREE.Color(0.42, 0.45, 0.5), smoothstep(0.35, 0.6, slope)),
      city: () => c.setRGB(1, 1, 1),
      beach: (h) => (h < -1.2 ? c.setRGB(0.78, 0.88, 0.85) : c.setRGB(1, 1, 1).lerp(new THREE.Color(0.55, 0.72, 0.38), smoothstep(3, 16, h))),
      autumn: (h, slope) => c.setRGB(1, 1, 1).lerp(new THREE.Color(0.62, 0.55, 0.45), smoothstep(0.2, 0.5, slope)).lerp(new THREE.Color(1.1, 0.85, 0.7), smoothstep(60, 150, h)),
      lava: (h, slope) => c.setRGB(1, 1, 1).lerp(new THREE.Color(0.65, 0.6, 0.6), smoothstep(0.3, 0.6, slope)).lerp(new THREE.Color(2.2, 0.8, 0.35), smoothstep(-1.4, -2.9, h)),
      moon: (h, slope) => c.setRGB(1, 1, 1).lerp(new THREE.Color(0.62, 0.62, 0.66), smoothstep(0.2, 0.5, slope)),
      seabed: (h, slope, x, z) => {
        const lv = T.underwater.level;
        if (h > lv - 0.6) return c.setRGB(1.02, 0.9, 0.72).lerp(new THREE.Color(0.5, 0.78, 0.36), smoothstep(lv + 1.6, lv + 3, h));
        // Patches of sea grass, pink coral sand and dark rock on the sea floor.
        const n1 = fbm(x * 0.02, z * 0.02, 3, seed + 21);
        const n2 = fbm(x * 0.035, z * 0.035, 2, seed + 33);
        c.setRGB(0.74, 0.88, 0.9);
        c.lerp(new THREE.Color(0.45, 0.72, 0.5), smoothstep(0.55, 0.68, n1) * 0.8);
        c.lerp(new THREE.Color(1.0, 0.72, 0.74), smoothstep(0.58, 0.7, n2) * 0.6);
        c.lerp(new THREE.Color(0.5, 0.56, 0.62), smoothstep(0.25, 0.55, slope));
        return c.lerp(new THREE.Color(0.6, 0.76, 0.82), smoothstep(-8, -34, h) * 0.6);
      },
    }[T.ground];
    for (let i = 0; i < p.count; i++) {
      const slope = 1 - nrm.getY(i);
      tint(p.getY(i), slope, p.getX(i), p.getZ(i));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tex = groundTexture(T.ground);
    tex.repeat.set(size / 26, size / 26);
    const mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: T.ground === 'snow' ? 0.7 : 0.95, metalness: 0 });
    if (caustics) caustics.patch(mat);
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = hi;
    scene.add(mesh);
    disposables.push(g, mat);
  }

  // --- Sea, lava and planets ----------------------------------------------------
  if (T.water) {
    const wn = waterNormalTexture();
    wn.repeat.set(size / 90, size / 90);
    const wmat = new THREE.MeshStandardMaterial({
      color: T.water.color, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.86,
      normalMap: wn, normalScale: new THREE.Vector2(0.32, 0.32),
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.6, size * 1.6).rotateX(-Math.PI / 2), wmat);
    water.position.set(cx, T.water.level, cz);
    water.receiveShadow = hi;
    scene.add(water);
    updaters.push((dt) => {
      wn.offset.x += dt * 0.012;
      wn.offset.y += dt * 0.007;
    });
    disposables.push(water.geometry, wmat);
  }
  if (T.lava) {
    const lt = lavaTexture();
    lt.repeat.set(size / 70, size / 70);
    const lmat = new THREE.MeshBasicMaterial({ map: lt, color: new THREE.Color(1.45, 1.45, 1.45) });
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.6, size * 1.6).rotateX(-Math.PI / 2), lmat);
    lava.position.set(cx, T.lava.level, cz);
    scene.add(lava);
    updaters.push((dt) => {
      lt.offset.x += dt * 0.004;
      lt.offset.y -= dt * 0.003;
    });
    disposables.push(lava.geometry, lmat);
    const cone = T.terrain.cone;
    if (cone) {
      // Glowing crater and a smoke plume.
      const crater = new THREE.Mesh(new THREE.CircleGeometry(cone.r * 0.13, 24).rotateX(-Math.PI / 2), lmat);
      crater.position.set(cone.x, heightAt(cone.x, cone.z) + 2, cone.z);
      scene.add(crater);
      const smokeMat = new THREE.SpriteMaterial({ map: radialTexture('rgba(70,60,60,0.85)', 'rgba(70,60,60,0)'), transparent: true, depthWrite: false });
      const puffs = [];
      for (let k = 0; k < 14; k++) {
        const sp = new THREE.Sprite(smokeMat.clone());
        sp.userData.t = k / 14;
        scene.add(sp);
        puffs.push(sp);
      }
      const top = crater.position.y;
      updaters.push((dt) => {
        for (const sp of puffs) {
          sp.userData.t = (sp.userData.t + dt * 0.03) % 1;
          const u = sp.userData.t;
          sp.position.set(cone.x + u * 120, top + u * 260, cone.z + u * 40 + Math.sin(u * 9) * 10);
          sp.scale.setScalar(40 + u * 160);
          sp.material.opacity = 0.9 * (1 - u);
        }
      });
      disposables.push(smokeMat, crater.geometry);
    }
  }
  if (T.sky.earth) {
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(300, 48, 32),
      new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.9, emissive: '#1a3a7a', emissiveIntensity: 0.25, fog: false }),
    );
    const dir = new THREE.Vector3(-0.55, 0.3, 0.78).normalize();
    scene.add(earth);
    updaters.push((dt, cam) => {
      earth.position.copy(cam.position).addScaledVector(dir, 3200);
      earth.rotation.y += dt * 0.01;
    });
  }

  // --- Road -----------------------------------------------------------------
  const L = path.length;
  const roadTile = L / Math.round(L / 22);
  // Bubble Reef has no road: the cars float in their bubbles between the stones.
  if (!uw) {
    const g = stripGeometry(path, (i, k) => {
      const s = k * path.step;
      const x = path.px[i];
      const z = path.pz[i];
      const y = path.py[i] + 0.02;
      return [
        x + path.nx[i] * hw, y, z + path.nz[i] * hw, 0, s / roadTile,
        x - path.nx[i] * hw, y, z - path.nz[i] * hw, 1, s / roadTile,
      ];
    });
    const kind = T.ground === 'city' ? 'city' : T.ground;
    // A wet road is darker and shiny, so it reflects the sky and the lights.
    const mat = new THREE.MeshStandardMaterial({
      map: roadTexture(kind),
      color: T.wet ? '#9aa0a8' : '#ffffff',
      roughness: T.wet ? 0.18 : T.night ? 0.42 : 0.88,
      metalness: T.wet ? 0.35 : T.night ? 0.25 : 0,
    });
    const road = new THREE.Mesh(g, mat);
    road.receiveShadow = hi;
    scene.add(road);
    disposables.push(g, mat);
  }

  // Run-off shoulders (gravel/sand/snow/pavement) between road and wall.
  if (!uw) {
    const shoulder = { grass: '#b8c9a0', sand: '#e0c49c', snow: '#e8eef6', city: '#57526a', beach: '#f2dcb0', autumn: '#c9b090', lava: '#6a5048', moon: '#b8bac0' }[T.ground];
    const mat = new THREE.MeshStandardMaterial({ color: shoulder, roughness: 1, map: groundTexture(T.ground) });
    mat.map = mat.map.clone();
    mat.map.repeat.set(1, 1);
    mat.map.needsUpdate = true;
    for (const side of [1, -1]) {
      const a = side > 0 ? wall : -hw;
      const bb = side > 0 ? hw : -wall;
      const g = stripGeometry(path, (i, k) => {
        const x = path.px[i];
        const z = path.pz[i];
        const s = (k * path.step) / 8;
        const y = path.py[i];
        return [
          x + path.nx[i] * a, y, z + path.nz[i] * a, 0, s,
          x + path.nx[i] * bb, y, z + path.nz[i] * bb, (wall - hw) / 8, s,
        ];
      });
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = hi;
      scene.add(m);
      disposables.push(g);
    }
    disposables.push(mat);
  }

  // Kerbs on the corners.
  if (T.ground !== 'city' && !uw) {
    const mat = new THREE.MeshStandardMaterial({ map: curbTexture(), roughness: 0.7 });
    const N = path.count;
    const corner = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (Math.abs(path.curv[i]) > 1 / 160) for (let k = -8; k <= 8; k++) corner[path.wrapIndex(i + k)] = 1;
    let start = -1;
    // Find a non-corner starting index so ranges don't wrap.
    let base = 0;
    while (base < N && corner[base]) base++;
    for (let kk = 0; kk <= N; kk++) {
      const i = (base + kk) % N;
      const on = corner[i] && kk < N;
      if (on && start < 0) start = base + kk;
      if (!on && start >= 0) {
        const end = base + kk;
        for (const side of [1, -1]) {
          const a = side > 0 ? hw + 1.4 : -hw;
          const bb = side > 0 ? hw : -hw - 1.4;
          const g = stripGeometry(path, (ii, k) => {
            const x = path.px[ii];
            const z = path.pz[ii];
            const v = (k * path.step) / 4;
            return [
              x + path.nx[ii] * a, path.py[ii] + 0.05, z + path.nz[ii] * a, 0, v,
              x + path.nx[ii] * bb, path.py[ii] + 0.05, z + path.nz[ii] * bb, 1, v,
            ];
          }, start, end);
          const m = new THREE.Mesh(g, mat);
          m.receiveShadow = hi;
          scene.add(m);
          disposables.push(g);
        }
        start = -1;
      }
    }
    disposables.push(mat);
  }

  // --- Barriers -------------------------------------------------------------
  if (T.barrier !== 'none') {
    const BAR = {
      snow: { h: 1.4, thick: 1.6, top: '#ffffff' },
      neon: { top: '#2b2933', glow: ['#ff2fa8', '#22e4ff'] },
      lava: { top: '#2a2220', glow: ['#ff6a1a', '#ff6a1a'] },
      scifi: { top: '#e8ecf2', glow: ['#39d5ff', '#39d5ff'] },
      wood: { h: 1.0, top: '#5a3a20' },
      beach: { top: '#f7f4ec' },
    }[T.barrier] || {};
    const H = BAR.h || 1.1;
    const thick = BAR.thick || 0.6;
    const mat = new THREE.MeshStandardMaterial({ map: barrierTexture(T.barrier), roughness: 0.8, side: THREE.DoubleSide });
    const topMat = new THREE.MeshStandardMaterial({ color: BAR.top || '#9a9a9a', roughness: 0.8 });
    const tile = 6;
    for (const side of [1, -1]) {
      const o1 = side * wall;
      const o2 = side * (wall + thick);
      const face = (off) =>
        stripGeometry(path, (i, k) => {
          const x = path.px[i] + path.nx[i] * off;
          const z = path.pz[i] + path.nz[i] * off;
          const u = (k * path.step) / tile;
          const y = path.py[i];
          return [x, y, z, u, 0, x, y + H, z, u, 1];
        });
      for (const off of [o1, o2]) {
        const g = face(off);
        const m = new THREE.Mesh(g, mat);
        m.receiveShadow = hi;
        m.castShadow = hi;
        scene.add(m);
        disposables.push(g);
      }
      const top = stripGeometry(path, (i) => {
        const x = path.px[i];
        const z = path.pz[i];
        const a = side > 0 ? o2 : o1;
        const bb = side > 0 ? o1 : o2;
        const y = path.py[i] + H;
        return [x + path.nx[i] * a, y, z + path.nz[i] * a, 0, 0, x + path.nx[i] * bb, y, z + path.nz[i] * bb, 1, 0];
      });
      scene.add(new THREE.Mesh(top, topMat));
      disposables.push(top);
      if (BAR.glow) {
        const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(BAR.glow[side > 0 ? 0 : 1]).multiplyScalar(1.5), fog: false });
        const strip = stripGeometry(path, (i) => {
          const x = path.px[i];
          const z = path.pz[i];
          const off = side * (wall - 0.01);
          const y = path.py[i];
          return [x + path.nx[i] * off, y + H - 0.12, z + path.nz[i] * off, 0, 0, x + path.nx[i] * off, y + H + 0.02, z + path.nz[i] * off, 1, 0];
        });
        const sm = new THREE.Mesh(strip, neon);
        sm.material.side = THREE.DoubleSide;
        scene.add(sm);
        disposables.push(strip, neon);
      }
    }
    disposables.push(mat, topMat);
  }

  // Corner chevron boards on the outside of tight turns.
  if (T.barrier !== 'none') {
    const tex = chevronTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.6, emissive: T.night ? 0xffffff : 0x000000, emissiveMap: T.night ? tex : null, emissiveIntensity: 0.6 });
    const geo = new THREE.PlaneGeometry(2.6, 1.3);
    const items = [];
    for (let i = 0; i < path.count; i += Math.round(14 / path.step)) {
      const k = path.curv[i];
      if (Math.abs(k) < 1 / 75) continue;
      const side = k > 0 ? -1 : 1; // outside of the turn
      const off = side * (wall - 0.05);
      const x = path.px[i] + path.nx[i] * off;
      const z = path.pz[i] + path.nz[i] * off;
      const fx = -side * path.nx[i];
      const fz = -side * path.nz[i];
      const ry = Math.atan2(fx, fz);
      const lx = Math.cos(ry);
      const lz = -Math.sin(ry);
      const mirror = lx * path.tx[i] + lz * path.tz[i] < 0;
      items.push({ x: x - fx * 0.02, y: path.py[i] + 1.1 + 0.75, z: z - fz * 0.02, ry, sx: mirror ? -1 : 1, sy: 1, sz: 1 });
    }
    if (items.length) scene.add(instanced(geo, mat, items, { cast: false }));
    disposables.push(geo, mat);
  }

  // --- Start line, grid & gantry --------------------------------------------
  const startHeading = Math.atan2(path.tx[0], path.tz[0]);
  const gantryLamps = [];
  {
    if (uw) {
      // No road to paint on underwater: a glowing laser line marks the start.
      const laser = new THREE.Mesh(
        new THREE.BoxGeometry(wall * 2, 0.07, 0.07),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 2.6), toneMapped: false }),
      );
      laser.position.set(path.px[0], path.py[0] + 0.05, path.pz[0]);
      laser.rotation.y = startHeading;
      scene.add(laser);
    } else {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(path.def.width, 2.4).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ map: checkerTexture(Math.round(path.def.width / 1.2), 2), roughness: 0.8 }),
      );
      line.position.set(path.px[0], path.py[0] + 0.035, path.pz[0]);
      line.rotation.y = startHeading;
      line.receiveShadow = hi;
      scene.add(line);

      // Grid boxes.
      const gm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
      for (let k = 0; k < 8; k++) {
        const slot = gridSlot(path, k);
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.3).rotateX(-Math.PI / 2), gm);
        bar.position.set(slot.x + path.tx[slot.i] * 3, path.py[slot.i] + 0.035, slot.z + path.tz[slot.i] * 3);
        bar.rotation.y = slot.heading;
        scene.add(bar);
      }
    }

    // Gantry. Underwater it stands outside the marker stones on pillars from the sea floor.
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x2b2e36, metalness: 0.6, roughness: 0.4 });
    const span = uw ? (wall + 2) * 2 : path.def.width + 3;
    for (const sx of [-1, 1]) {
      const px = path.px[0] + path.nx[0] * (sx * span) / 2;
      const pz = path.pz[0] + path.nz[0] * (sx * span) / 2;
      const foot = uw ? Math.min(0, heightAt(px, pz) - path.py[0]) : 0;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8.5 - foot, 0.8), steel);
      pillar.position.set((sx * span) / 2, (8.5 + foot) / 2, 0);
      pillar.castShadow = hi;
      g.add(pillar);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 0.8, 1.9, 0.9), steel);
    beam.position.set(0, 7.6, 0);
    beam.castShadow = hi;
    g.add(beam);
    const banner = bannerTexture('START · FINISH', 'TURBO TOKENS GRAND PRIX');
    const bm = new THREE.MeshBasicMaterial({ map: banner, toneMapped: false });
    bm.color.setScalar(T.night ? 1.4 : 1);
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(span, 1.6), bm);
      p.position.set(0, 7.6, sz * 0.46);
      if (sz < 0) p.rotation.y = Math.PI;
      g.add(p);
    }
    // Start lights hanging under the beam (facing the grid).
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0x000000, emissiveIntensity: 3, roughness: 0.3 });
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 16).rotateX(Math.PI / 2), mat);
      lamp.position.set((i - 2) * 0.95, 6.15, -0.2);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.3), steel);
      housing.position.set((i - 2) * 0.95, 6.15, -0.02);
      g.add(housing, lamp);
      gantryLamps.push(mat);
    }
    g.position.set(path.px[0], path.py[0], path.pz[0]);
    g.rotation.y = startHeading;
    scene.add(g);
  }

  function setStartLights(red, green = false) {
    gantryLamps.forEach((m, i) => {
      if (green) {
        m.emissive.set(0x18ff40);
        m.color.set(0x0a3310);
      } else if (i < red) {
        m.emissive.set(0xff1010);
        m.color.set(0x330000);
      } else {
        m.emissive.set(0x000000);
        m.color.set(0x220000);
      }
    });
  }

  // --- Grandstands near the start ---------------------------------------------
  let standSide = 1;
  if (!uw) {
    // Pick the side of the straight with more free space.
    const probe = (side) => {
      let m = Infinity;
      for (const s of [-60, 0, 60]) {
        const i = path.indexAt((s + L) % L);
        m = Math.min(m, df.at(path.px[i] + path.nx[i] * side * (wall + 30), path.pz[i] + path.nz[i] * side * (wall + 30)));
      }
      return m;
    };
    const side = probe(1) > probe(-1) ? 1 : -1;
    standSide = side;
    const seatMat = new THREE.MeshStandardMaterial({ color: T.night ? '#3b3550' : '#b9bec8', roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: T.night ? '#20202a' : '#d8232a', roughness: 0.6 });
    const crowdGeo = new THREE.BoxGeometry(0.5, 0.75, 0.4).translate(0, 0.38, 0);
    const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const people = [];
    const palette = ['#e3242b', '#2f6bff', '#ffc400', '#13b26b', '#ffffff', '#ff6a13', '#8a2be2', '#19c3d6', '#222222'];
    for (const centre of [38, L - 38]) {
      const i = path.indexAt(centre);
      const heading = Math.atan2(path.tx[i], path.tz[i]);
      const stand = new THREE.Group();
      const len = 54;
      const rows = 9;
      for (let r = 0; r < rows; r++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6 + r * 0.6, 1.3), seatMat);
        step.position.set(0, (0.6 + r * 0.6) / 2, r * 1.3);
        step.castShadow = hi;
        step.receiveShadow = hi;
        stand.add(step);
        for (let p = 0; p < len / 0.7; p++) {
          if (rand() < 0.22) continue;
          people.push({ local: new THREE.Vector3(-len / 2 + 0.35 + p * 0.7, 0.6 + r * 0.6, r * 1.3), stand, color: new THREE.Color(palette[Math.floor(rand() * palette.length)]) });
        }
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 0.4, rows * 1.3 + 2), roofMat);
      roof.position.set(0, 0.6 + rows * 0.6 + 4.5, (rows * 1.3) / 2);
      roof.rotation.x = -0.08;
      roof.castShadow = hi;
      stand.add(roof);
      for (const px of [-len / 2, 0, len / 2]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 10, 0.4), seatMat);
        post.position.set(px, 5, rows * 1.3);
        stand.add(post);
      }
      const off = side * (wall + 5);
      stand.position.set(path.px[i] + path.nx[i] * off, 0, path.pz[i] + path.nz[i] * off);
      // Face the track: local +Z should point away from the road.
      stand.rotation.y = heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      scene.add(stand);
      stand.updateMatrixWorld(true);
    }
    const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, people.length);
    const o = new THREE.Object3D();
    people.forEach((p, k) => {
      const w = p.local.clone().applyMatrix4(p.stand.matrixWorld);
      o.position.copy(w);
      o.rotation.set(0, p.stand.rotation.y, 0);
      o.scale.set(1, 0.85 + rand() * 0.35, 1);
      o.updateMatrix();
      crowd.setMatrixAt(k, o.matrix);
      crowd.setColorAt(k, p.color);
    });
    crowd.instanceMatrix.needsUpdate = true;
    if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
    scene.add(crowd);
    // Little crowd bounce.
    const p0 = [];
    let t = 0;
    updaters.push((dt) => {
      t += dt;
      if (!hi) return;
      const m = new THREE.Matrix4();
      for (let k = 0; k < people.length; k += 3) {
        crowd.getMatrixAt(k, m);
        const y = m.elements[13];
        const base = p0[k] ?? (p0[k] = y);
        m.elements[13] = base + Math.max(0, Math.sin(t * 8 + k)) * 0.15;
        crowd.setMatrixAt(k, m);
      }
      crowd.instanceMatrix.needsUpdate = true;
    });
  }

  // --- Themed scenery ---------------------------------------------------------
  const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  disposables.push(propMat);
  const B = size / 2 - 50;

  function scatter(count, minD, maxD, opts = {}) {
    const out = [];
    let tries = 0;
    while (out.length < count && tries < count * 40) {
      tries++;
      const x = cx + (rand() * 2 - 1) * B;
      const z = cz + (rand() * 2 - 1) * B;
      const d = df.at(x, z);
      if (d < minD || d > maxD) continue;
      if (opts.bias && rand() > Math.exp(-(d - minD) / opts.bias)) continue;
      const y = heightAt(x, z);
      if (opts.accept && !opts.accept(x, z, y)) continue;
      const s = (opts.smin || 1) + rand() * ((opts.smax || 1) - (opts.smin || 1));
      out.push({ x, y: (opts.y ?? y) - 0.2, z, ry: rand() * Math.PI * 2, s });
    }
    return out;
  }
  const q = hi ? 1 : 0.5;
  const tint = (items, base, spread) =>
    items.map((t) => ({ ...t, color: new THREE.Color(base).offsetHSL((rand() - 0.5) * spread, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.12) }));

  const sceneryAdd = (geo, items) => {
    if (!items.length) return;
    scene.add(instanced(geo, propMat, items, { cast: hi }));
    disposables.push(geo);
  };

  if (T.scenery === 'valley') {
    sceneryAdd(PROPS.roundTree(), tint(scatter(900 * q, wall + 6, 900, { bias: 220, smin: 0.8, smax: 1.7 }), '#ffffff', 0.06));
    sceneryAdd(PROPS.pine(), scatter(500 * q, wall + 8, 1000, { bias: 300, smin: 0.9, smax: 1.8 }));
    sceneryAdd(PROPS.bush(), tint(scatter(500 * q, wall + 3, 300, { bias: 80, smin: 0.6, smax: 1.4 }), '#ffffff', 0.08));
    sceneryAdd(PROPS.rock(), scatter(150 * q, wall + 4, 600, { bias: 200, smin: 0.5, smax: 2.2 }));
    sceneryAdd(PROPS.hay(), scatter(60, wall + 2, wall + 25, { smin: 0.9, smax: 1.1 }));
    sceneryAdd(PROPS.cabin('#b83a2a', '#e8dcc4'), scatter(14, wall + 40, 400, { smin: 1, smax: 1.4 }));
  } else if (T.scenery === 'desert') {
    sceneryAdd(PROPS.cactus(), scatter(420 * q, wall + 4, 800, { bias: 220, smin: 0.7, smax: 1.5 }));
    sceneryAdd(PROPS.rock('#b5653a'), tint(scatter(380 * q, wall + 4, 900, { bias: 260, smin: 0.6, smax: 4 }), '#ffffff', 0.04));
    sceneryAdd(PROPS.bush('#8a7a45'), scatter(500 * q, wall + 3, 500, { bias: 140, smin: 0.4, smax: 1.0 }));
    sceneryAdd(PROPS.cabin('#7a5a3a', '#d8b88a'), scatter(8, wall + 40, 400, { smin: 1, smax: 1.3 }));
  } else if (T.scenery === 'snow') {
    sceneryAdd(PROPS.pine(true), scatter(1100 * q, wall + 5, 1000, { bias: 260, smin: 0.8, smax: 2.0 }));
    sceneryAdd(PROPS.rock('#7c8590'), scatter(160 * q, wall + 4, 700, { bias: 200, smin: 0.5, smax: 2.5 }));
    sceneryAdd(PROPS.snowman(), scatter(24, wall + 3, wall + 30, { smin: 0.9, smax: 1.3 }));
    sceneryAdd(PROPS.cabin('#f4f8fc', '#7a4a2a'), scatter(16, wall + 30, 350, { smin: 1, smax: 1.4 }));
  } else if (T.scenery === 'city') {
    buildCity();
  } else if (T.scenery === 'beach') {
    const lvl = T.water.level;
    const land = (x, z, y) => y > lvl + 0.6;
    const pick = (cols) => new THREE.Color(cols[Math.floor(rand() * cols.length)]);
    sceneryAdd(PROPS.palm(), scatter(560 * q, wall + 4, 750, { bias: 170, smin: 0.8, smax: 1.4, accept: land }));
    sceneryAdd(PROPS.bush('#3f8a2c'), scatter(300 * q, wall + 3, 400, { bias: 100, smin: 0.6, smax: 1.3, accept: land }));
    sceneryAdd(PROPS.rock('#a89880'), scatter(120 * q, wall + 4, 600, { bias: 200, smin: 0.5, smax: 2, accept: land }));
    sceneryAdd(PROPS.umbrella(), scatter(70, wall + 4, 200, { accept: (x, z, y) => y > lvl + 0.2 && y < lvl + 3 }).map((t) => ({ ...t, color: pick(['#ff3ea5', '#ffd23f', '#22c4e0', '#ff6a13', '#7ed321']) })));
    sceneryAdd(PROPS.cabin('#d8b56a', '#f2e6cc'), scatter(12, wall + 25, 300, { smin: 0.9, smax: 1.2, accept: land }));
    sceneryAdd(PROPS.boat(), scatter(24, 120, 1200, { y: lvl + 0.15, accept: (x, z, y) => y < lvl - 3 }));
  } else if (T.scenery === 'autumn') {
    const leafCols = ['#e8641e', '#d93a1e', '#f0a020', '#c8a030', '#b8341b', '#e88a2a'];
    sceneryAdd(PROPS.autumnTree(), scatter(950 * q, wall + 5, 900, { bias: 200, smin: 0.8, smax: 1.7 }).map((t) => ({ ...t, color: new THREE.Color(leafCols[Math.floor(rand() * leafCols.length)]) })));
    sceneryAdd(PROPS.pine(), scatter(300 * q, wall + 8, 1000, { bias: 300, smin: 0.9, smax: 1.8 }));
    sceneryAdd(PROPS.bush('#c86a2a'), tint(scatter(400 * q, wall + 3, 300, { bias: 80, smin: 0.6, smax: 1.3 }), '#ffffff', 0.06));
    sceneryAdd(PROPS.pumpkin(), scatter(50, wall + 2, wall + 20, { smin: 0.8, smax: 1.6 }));
    sceneryAdd(PROPS.hay(), scatter(40, wall + 2, wall + 25, { smin: 0.9, smax: 1.1 }));
    sceneryAdd(PROPS.cabin('#8a3a22', '#7a4a2a'), scatter(10, wall + 40, 400, { smin: 1, smax: 1.4 }));
  } else if (T.scenery === 'volcano') {
    const lvl = T.lava.level;
    const solid = (x, z, y) => y > lvl + 0.8;
    sceneryAdd(PROPS.deadTree(), scatter(260 * q, wall + 5, 700, { bias: 220, smin: 0.7, smax: 1.5, accept: solid }));
    sceneryAdd(PROPS.rock('#2e2624'), scatter(500 * q, wall + 4, 900, { bias: 240, smin: 0.5, smax: 3.5, accept: solid }));
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.9, 0.25) });
    const glowRocks = scatter(160 * q, wall + 3, 500, { bias: 160, smin: 0.25, smax: 0.7, accept: solid });
    if (glowRocks.length) {
      const g = new THREE.DodecahedronGeometry(1, 0).translate(0, 0.4, 0);
      scene.add(instanced(g, glow, glowRocks, { cast: false }));
      disposables.push(g, glow);
    }
  } else if (T.scenery === 'moon') {
    sceneryAdd(PROPS.dome(), scatter(14, wall + 22, 260, { smin: 0.8, smax: 1.5 }));
    sceneryAdd(PROPS.antenna(), scatter(12, wall + 10, 300, { smin: 0.9, smax: 1.6 }));
    sceneryAdd(PROPS.rocket(), scatter(5, wall + 30, 260, { smin: 1, smax: 1.4 }));
    sceneryAdd(PROPS.solar(), scatter(60, wall + 6, 200, { smin: 0.9, smax: 1.2 }));
    sceneryAdd(PROPS.crate(), scatter(40, wall + 3, 60, { smin: 0.7, smax: 1.2 }));
    sceneryAdd(PROPS.rock('#8a8c92'), scatter(320 * q, wall + 4, 900, { bias: 260, smin: 0.4, smax: 2.6 }));
  }

  // Street lamps for night races (Neon City has its own).
  if (T.nightLights && T.scenery !== 'city') {
    const poles = [];
    const heads = [];
    const pools = [];
    let k = 0;
    for (let i = 0; i < path.count; i += Math.round(42 / path.step)) {
      // Underwater there is nothing to stand on; the reef glows by itself.
      if (uw && path.py[i] < uw.level - 0.5) continue;
      const side = k++ % 2 ? 1 : -1;
      const off = side * (wall + 1.3);
      const x = path.px[i] + path.nx[i] * off;
      const z = path.pz[i] + path.nz[i] * off;
      const y = path.py[i];
      const ry = Math.atan2(-side * path.nx[i], -side * path.nz[i]);
      poles.push({ x, y, z, ry });
      const hx = x - side * path.nx[i] * 2.4;
      const hz = z - side * path.nz[i] * 2.4;
      heads.push({ x: hx, y: y + 8.1, z: hz, ry });
      pools.push({ x: hx - side * path.nx[i] * 2.5, y: y + 0.05, z: hz - side * path.nz[i] * 2.5, ry: 0, s: 1 });
    }
    if (poles.length) {
      const poleGeo = merged([
        colorGeo(new THREE.CylinderGeometry(0.12, 0.16, 8.4, 8).translate(0, 4.2, 0), '#4a4d57'),
        colorGeo(new THREE.BoxGeometry(0.14, 0.14, 2.6).translate(0, 8.35, 1.25), '#4a4d57'),
      ]);
      scene.add(instanced(poleGeo, propMat, poles, { cast: false }));
      const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe0a0').multiplyScalar(3), toneMapped: false });
      const headGeo = new THREE.BoxGeometry(0.5, 0.15, 1.0);
      scene.add(instanced(headGeo, headMat, heads, { cast: false }));
      const poolMat = new THREE.MeshBasicMaterial({
        map: radialTexture('rgba(255,205,150,0.3)', 'rgba(255,205,150,0)'),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const poolGeo = new THREE.PlaneGeometry(18, 18).rotateX(-Math.PI / 2);
      const poolMesh = instanced(poolGeo, poolMat, pools, { cast: false });
      poolMesh.renderOrder = 2;
      scene.add(poolMesh);
      disposables.push(poleGeo, headMat, headGeo, poolMat, poolGeo);
    }
  }

  let uwState = null;
  if (uw) {
    uwState = buildUnderwater({ scene, path, T, def, hi, rand, df, heightAt, caustics, updaters, disposables, sky, skyMat, hemi, sun, size, cx, cz, PROPS, instanced });
  } else {
    addTrackDetails({ scene, path, T, hi, rand, df, heightAt, standSide, propMat, updaters, disposables });
  }

  function buildCity() {
    // Buildings: merged boxes with window-mapped UVs.
    const parts = [];
    const roofLights = [];
    const addBuilding = (x, z, ry, w, d, h) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const uv = g.attributes.uv;
      const tile = 15;
      for (let v = 0; v < 24; v++) {
        const face = Math.floor(v / 4);
        let u = uv.getX(v);
        let vv = uv.getY(v);
        if (face === 2 || face === 3) {
          u = 0.005;
          vv = 0.995;
        } else {
          const width = face < 2 ? d : w;
          u *= width / tile;
          vv *= h / tile;
        }
        uv.setXY(v, u, vv);
      }
      g.translate(0, h / 2, 0);
      g.rotateY(ry);
      g.translate(x, 0, z);
      parts.push(g.toNonIndexed());
      if (rand() < 0.35) {
        const l = new THREE.BoxGeometry(w * 0.9, 0.5, 0.3).translate(0, h + 0.3, d / 2 - 0.2).rotateY(ry).translate(x, 0, z);
        roofLights.push(l.toNonIndexed());
      }
    };
    const fits = (x, z, ry, w, d, minD) => {
      const c = Math.cos(ry);
      const s = Math.sin(ry);
      for (const [a, bb] of [[0, 0], [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, d / 2], [0, -d / 2], [w / 2, 0], [-w / 2, 0]]) {
        const px = x + a * c + bb * s;
        const pz = z - a * s + bb * c;
        if (df.at(px, pz) < minD) return false;
      }
      return true;
    };
    for (let i = 0; i < path.count; i += Math.round(20 / path.step)) {
      for (const side of [1, -1]) {
        if (rand() < 0.15) continue;
        const w = 12 + rand() * 14;
        const d = 12 + rand() * 12;
        const h = 14 + Math.pow(rand(), 1.6) * 80;
        const off = side * (wall + 10 + d / 2 + rand() * 8);
        const x = path.px[i] + path.nx[i] * off;
        const z = path.pz[i] + path.nz[i] * off;
        const ry = Math.atan2(path.tx[i], path.tz[i]);
        if (fits(x, z, ry, w, d, wall + 6)) addBuilding(x, z, ry, w, d, h);
      }
    }
    for (let k = 0; k < (hi ? 420 : 220); k++) {
      const x = cx + (rand() * 2 - 1) * B;
      const z = cz + (rand() * 2 - 1) * B;
      const dist = df.at(x, z);
      if (dist < 80) continue;
      const w = 20 + rand() * 30;
      const d = 20 + rand() * 30;
      const h = 30 + Math.pow(rand(), 1.4) * (dist > 300 ? 200 : 120);
      const ry = rand() < 0.5 ? 0 : Math.PI / 2;
      if (fits(x, z, ry, w, d, wall + 10)) addBuilding(x, z, ry, w, d, h);
    }
    const tex = windowsTexture(true);
    const bmat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.7, metalness: 0.2 });
    const bgeo = mergeGeometries(parts);
    const bmesh = new THREE.Mesh(bgeo, bmat);
    bmesh.castShadow = hi;
    bmesh.receiveShadow = hi;
    scene.add(bmesh);
    disposables.push(bgeo, bmat);
    if (roofLights.length) {
      const lg = mergeGeometries(roofLights);
      const cols = ['#ff2fa8', '#22e4ff', '#ffd23f', '#9b5bff'];
      const cArr = new Float32Array(lg.attributes.position.count * 3);
      const per = roofLights[0].attributes.position.count;
      for (let k = 0; k < roofLights.length; k++) {
        const c = new THREE.Color(cols[k % cols.length]);
        for (let v = 0; v < per; v++) cArr.set([c.r * 2, c.g * 2, c.b * 2], (k * per + v) * 3);
      }
      lg.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
      const lm = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
      scene.add(new THREE.Mesh(lg, lm));
      disposables.push(lg, lm);
    }

    // Street lamps + light pools on the road.
    const poles = [];
    const heads = [];
    const pools = [];
    for (let i = 0; i < path.count; i += Math.round(32 / path.step)) {
      for (const side of [1, -1]) {
        const off = side * (wall + 0.9);
        const x = path.px[i] + path.nx[i] * off;
        const z = path.pz[i] + path.nz[i] * off;
        const ry = Math.atan2(-side * path.nx[i], -side * path.nz[i]);
        poles.push({ x, y: 0, z, ry });
        const hx = x - side * path.nx[i] * 2.4;
        const hz = z - side * path.nz[i] * 2.4;
        heads.push({ x: hx, y: 8.1, z: hz, ry });
        pools.push({ x: hx - side * path.nx[i] * 1.5, y: 0.04, z: hz - side * path.nz[i] * 1.5, ry: 0, s: 1 });
      }
    }
    const poleGeo = merged([
      colorGeo(new THREE.CylinderGeometry(0.12, 0.16, 8.4, 8).translate(0, 4.2, 0), '#4a4d57'),
      colorGeo(new THREE.BoxGeometry(0.14, 0.14, 2.6).translate(0, 8.35, 1.25), '#4a4d57'),
    ]);
    scene.add(instanced(poleGeo, propMat, poles, { cast: false }));
    const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe0a0').multiplyScalar(3), toneMapped: false });
    const headGeo = new THREE.BoxGeometry(0.5, 0.15, 1.0);
    scene.add(instanced(headGeo, headMat, heads, { cast: false }));
    const poolMat = new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(255,200,140,0.22)', 'rgba(255,200,140,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const poolGeo = new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2);
    const poolMesh = instanced(poolGeo, poolMat, pools, { cast: false });
    poolMesh.renderOrder = 2;
    scene.add(poolMesh);
    disposables.push(poleGeo, headMat, headGeo, poolMat, poolGeo);

    // Neon arches over the track.
    const archCols = ['#ff2fa8', '#22e4ff', '#ffd23f', '#9b5bff'];
    let a = 0;
    for (let s = 120; s < L - 60; s += 260) {
      const i = path.indexAt(s);
      const span = path.def.width + 2;
      const col = new THREE.Color(archCols[a++ % archCols.length]).multiplyScalar(2.2);
      const m = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
      const g = new THREE.Group();
      for (const sx of [-1, 1]) {
        const pl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 9, 0.35), m);
        pl.position.set((sx * span) / 2, 4.5, 0);
        g.add(pl);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(span + 0.35, 0.35, 0.35), m);
      top.position.y = 9;
      g.add(top);
      g.position.set(path.px[i], 0, path.pz[i]);
      g.rotation.y = Math.atan2(path.tx[i], path.tz[i]);
      scene.add(g);
      disposables.push(m);
    }

    // Billboards.
    const ads = [
      ['TURBO', '#ff2fa8', '#5a1a9a'], ['NITRO', '#22e4ff', '#1a3a9a'], ['TOKENS', '#ffd23f', '#ff6a13'],
      ['SPEED', '#9b5bff', '#ff2fa8'], ['RACE!', '#13b26b', '#22e4ff'],
    ];
    let k = 0;
    for (let s = 200; s < L - 100; s += 330) {
      const i = path.indexAt(s);
      const side = k % 2 ? 1 : -1;
      const off = side * (wall + 6);
      const [t, c1, c2] = ads[k++ % ads.length];
      const tex = billboardTexture(t, c1, c2, k);
      const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
      m.color.setScalar(1.3);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), m);
      const x = path.px[i] + path.nx[i] * off;
      const z = path.pz[i] + path.nz[i] * off;
      board.position.set(x, 12, z);
      board.rotation.y = Math.atan2(path.tx[i], path.tz[i]) + Math.PI / 2 + (side > 0 ? 0.5 : -0.5);
      scene.add(board);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 8), new THREE.MeshStandardMaterial({ color: '#333' }));
      post.position.set(x, 4, z);
      scene.add(post);
      disposables.push(tex, m);
    }
  }

  // --- Weather ----------------------------------------------------------------
  if (T.weather === 'leaves' || T.weather === 'embers') {
    const embers = T.weather === 'embers';
    const n = hi ? (embers ? 1400 : 1600) : 700;
    const box = 120;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const base = new Float32Array(n * 3);
    const cols = embers ? ['#ff8a2a', '#ffb347', '#ff5a1a'] : ['#e8641e', '#d93a1e', '#f0a020', '#c8a030'];
    for (let i = 0; i < n; i++) {
      base.set([rand() * box, rand() * box, rand() * box], i * 3);
      const c = new THREE.Color(cols[Math.floor(rand() * cols.length)]);
      if (embers) c.multiplyScalar(2.2);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({
      size: embers ? 0.22 : 0.45, map: radialTexture(), vertexColors: true, transparent: true, depthWrite: false,
      blending: embers ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    pts.frustumCulled = false;
    scene.add(pts);
    let t = 0;
    updaters.push((dt, cam) => {
      t += dt;
      const ox = cam.position.x - box / 2;
      const oy = cam.position.y - box / 4;
      const oz = cam.position.z - box / 2;
      const mod = (v) => ((v % box) + box) % box;
      for (let i = 0; i < n; i++) {
        const sway = Math.sin(t * 1.3 + i) * (embers ? 0.8 : 2.4);
        const bx = base[i * 3] + sway + t * (embers ? 1 : 3);
        const by = base[i * 3 + 1] + t * (embers ? 2.5 : -1.6);
        const bz = base[i * 3 + 2] + Math.cos(t * 0.9 + i) * (embers ? 0.8 : 2);
        pos[i * 3] = ox + mod(bx - ox);
        pos[i * 3 + 1] = oy + mod(by - oy) * 0.5;
        pos[i * 3 + 2] = oz + mod(bz - oz);
      }
      g.attributes.position.needsUpdate = true;
    });
    disposables.push(g);
  }

  if (T.weather === 'snow' || T.weather === 'blizzard') {
    const storm = T.weather === 'blizzard';
    const n = (hi ? 4000 : 1800) * (storm ? 2 : 1);
    const box = 140;
    const pos = new Float32Array(n * 3);
    const base = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) base[i] = rand() * box;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flakes = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.28, map: radialTexture(), transparent: true, depthWrite: false, opacity: 0.9,
    }));
    flakes.frustumCulled = false;
    scene.add(flakes);
    let t = 0;
    updaters.push((dt, cam) => {
      t += dt;
      const ox = cam.position.x - box / 2;
      const oy = cam.position.y - box / 4;
      const oz = cam.position.z - box / 2;
      const mod = (v) => ((v % box) + box) % box;
      for (let i = 0; i < n; i++) {
        const bx = base[i * 3] + Math.sin(t * 0.7 + i) * 1.5 + t * (storm ? 14 : 2);
        const by = base[i * 3 + 1] - t * (storm ? 6 : 4);
        const bz = base[i * 3 + 2] + t * (storm ? 5 : 1.2);
        pos[i * 3] = ox + mod(bx - ox);
        pos[i * 3 + 1] = oy + mod(by - oy) * 0.5;
        pos[i * 3 + 2] = oz + mod(bz - oz);
      }
      g.attributes.position.needsUpdate = true;
    });
    disposables.push(g);
  }

  // Rain: streaks falling around the camera (not underwater).
  if (T.weather === 'rain') {
    const n = hi ? 3200 : 1400;
    const box = 70;
    const base = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) base[i] = rand() * box;
    const pos = new Float32Array(n * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const drops = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: T.night ? '#7d8ca3' : '#c8d4e0', transparent: true, opacity: T.night ? 0.4 : 0.45, depthWrite: false }));
    drops.frustumCulled = false;
    scene.add(drops);
    let t = 0;
    updaters.push((dt, cam) => {
      t += dt;
      drops.visible = !(uw && cam.position.y < uw.level);
      if (!drops.visible) return;
      const ox = cam.position.x - box / 2;
      const oy = cam.position.y - box / 3;
      const oz = cam.position.z - box / 2;
      const mod = (v) => ((v % box) + box) % box;
      for (let i = 0; i < n; i++) {
        const x = ox + mod(base[i * 3] + t * 3 - ox);
        const y = oy + mod(base[i * 3 + 1] - t * 28 - oy) * 0.7;
        const z = oz + mod(base[i * 3 + 2] + t * 1.5 - oz);
        pos.set([x, y, z, x + 0.12, y - 1.1, z + 0.05], i * 6);
      }
      g.attributes.position.needsUpdate = true;
    });
    disposables.push(g, drops.material);
  }

  // --- Per-frame updates --------------------------------------------------------
  const tmp = new THREE.Vector3();
  function update(dt, camera, focus) {
    if (focus) {
      // Keep the shadow frustum centred on the action, snapped to texels.
      const snap = 140 / 2048;
      tmp.set(Math.round(focus.x / snap) * snap, focus.y || 0, Math.round(focus.z / snap) * snap);
      sun.target.position.copy(tmp);
      sun.position.copy(tmp).addScaledVector(sunDir, 200);
    }
    for (const u of updaters) u(dt, camera, focus);
  }

  function dispose() {
    scene.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isSprite) {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m) m.dispose();
      }
    });
    for (const d of disposables) d.dispose && d.dispose();
  }

  return { scene, sun, heightAt, update, dispose, setStartLights, startHeading, isUnderwater: () => !!uwState?.under };
}

// Starting grid slot k (0 = pole position).
export function gridSlot(path, k) {
  const along = path.length - (9 + k * 7);
  const i = path.indexAt(along);
  const lat = k % 2 === 0 ? 3.4 : -3.4;
  return {
    i,
    along,
    x: path.px[i] + path.nx[i] * lat,
    z: path.pz[i] + path.nz[i] * lat,
    heading: Math.atan2(path.tx[i], path.tz[i]),
  };
}
