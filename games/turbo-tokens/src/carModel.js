// Procedural 3D car models built from the player's garage configuration.
// Local space: +Z is forward, +Y is up, X is across the car (left = +X).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js/+esm';
import { numberTexture, radialTexture } from './textures.js';
import { partItem } from './state.js';
import { stickerTexture } from './style.js';

const wheelGeoCache = new Map();

// ---------------------------------------------------------------------------
// Nitro fire: an animated shader flame in two layers (white-hot core with
// shock diamonds, ragged coloured outer flame), a nozzle glow and a shock ring.
// ---------------------------------------------------------------------------
const FLAME_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uLen;
  uniform float uSeed;
  varying float vT;
  varying float vU;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vT = uv.y;
    vU = uv.x;
    vec3 p = position;
    // Flicker: the flame wobbles and breathes.
    float w = sin(uTime * 37.0 + uv.y * 9.0 + uSeed) * 0.09 + sin(uTime * 23.0 - uv.y * 5.0 + uSeed * 2.0) * 0.06;
    p.xy *= 1.0 + w * uv.y;
    p.z *= uLen;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const FLAME_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uK;
  uniform float uBurst;
  uniform float uFire;
  uniform float uSeed;
  uniform float uLayer;
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uOuter;
  varying float vT;
  varying float vU;
  varying vec3 vN;
  varying vec3 vV;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int k = 0; k < 4; k++) {
      s += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return s;
  }
  void main() {
    float t = vT;
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float body = pow(facing, uLayer < 0.5 ? 2.2 : 1.1);
    float ang = vU * 6.2831;
    vec2 q = vec2(cos(ang), sin(ang)) * 1.4;
    // Tongues of fire racing backwards.
    float n = fbm(vec2(q.x + t * 1.5, q.y + t * 6.0 - uTime * 16.0 + uSeed));
    float tip = smoothstep(1.0, 0.12 + 0.55 * n, t);
    float base = smoothstep(0.0, 0.05, t);
    float I;
    vec3 col;
    if (uLayer < 0.5) {
      // White-hot core with bright shock diamonds near the pipe.
      float dia = 0.5 + 0.5 * cos(t * 44.0 - uTime * 9.0);
      I = body * tip * base * (0.45 + 1.5 * dia * smoothstep(0.7, 0.0, t));
      col = mix(uCore, uMid, smoothstep(0.1, 0.7, t));
    } else if (uLayer < 1.5) {
      // The main flame: licking tongues that fade from bright to deep colour.
      I = body * tip * base * (0.1 + 1.6 * smoothstep(0.32, 0.78, n));
      col = mix(uMid, uOuter, smoothstep(0.0, 0.6, t + (n - 0.5) * 0.4));
    } else {
      // Wispy outer tongues and a soft halo.
      float w = fbm(vec2(q.x * 2.0 + t * 3.0, q.y * 2.0 + t * 9.0 - uTime * 22.0 + uSeed * 1.7));
      I = body * smoothstep(1.0, 0.3 * w, t) * base * pow(w, 3.0) * 1.5;
      col = uOuter * 1.2;
    }
    // Backfire pops burn orange.
    col = mix(col, mix(vec3(1.0, 0.9, 0.5), vec3(1.0, 0.3, 0.04), t), uFire);
    I *= uK * (1.0 + uBurst * 1.3);
    // The core burns brightest; the outer layers keep their colour instead of washing out white.
    gl_FragColor = vec4(col * (uLayer < 0.5 ? 1.15 : 0.75), clamp(I, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

// Flame shape: widest just behind the pipe, then licking to a point (points along -Z).
let flameGeoCache = null;
function flameGeometry() {
  if (!flameGeoCache) {
    const pts = [];
    for (let k = 0; k <= 22; k++) {
      const t = k / 22;
      const r = Math.pow(Math.sin(Math.PI * (0.16 + 0.84 * t)), 0.6) * (1 - 0.2 * t);
      pts.push(new THREE.Vector2(Math.max(0.0001, r), -t));
    }
    flameGeoCache = new THREE.LatheGeometry(pts, 18).rotateX(Math.PI / 2);
  }
  return flameGeoCache;
}

// Colours for each nitro bottle: [core, middle, outer].
const NITRO_COLORS = [
  ['#ffffff', '#8ff0ff', '#2f8cff'],
  ['#ffffff', '#7fb8ff', '#2f4dff'],
  ['#fff4ff', '#ff8af0', '#8a2bff'],
];

function extrude(shape, width, bevel = 0.08, segments = 3) {
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: segments,
    curveSegments: 18,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2); // shape x -> car z, extrusion -> car x
  g.computeVertexNormals();
  return g;
}

function paintMaterial(color, finish) {
  const p = {
    gloss: { metalness: 0.2, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 },
    metallic: { metalness: 0.7, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.04 },
    matte: { metalness: 0.05, roughness: 0.78, clearcoat: 0, clearcoatRoughness: 1 },
    chrome: { metalness: 1, roughness: 0.07, clearcoat: 0.6, clearcoatRoughness: 0.05 },
  }[finish] || {};
  return new THREE.MeshPhysicalMaterial({ color, ...p });
}

function tube(a, b, r, mat) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(r, r, len, 8);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// Shared wheel geometry: tyre, rim barrel and spokes, axle along X.
function wheelGeometry(style, radius, width) {
  const key = `${style}-${radius}-${width}`;
  if (wheelGeoCache.has(key)) return wheelGeoCache.get(key);
  const rimR = radius * (style === 'offroad' ? 0.55 : 0.66);
  const hw = width / 2;
  const pts = [
    new THREE.Vector2(rimR * 0.98, -hw),
    new THREE.Vector2(radius - 0.05, -hw),
    new THREE.Vector2(radius - 0.01, -hw + 0.04),
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(radius - 0.01, hw - 0.04),
    new THREE.Vector2(radius - 0.05, hw),
    new THREE.Vector2(rimR * 0.98, hw),
  ];
  const tyre = new THREE.LatheGeometry(pts, 30);
  tyre.rotateZ(Math.PI / 2);

  const barrel = new THREE.CylinderGeometry(rimR, rimR, width * 0.92, 26);
  barrel.rotateZ(Math.PI / 2);

  const parts = [];
  const face = hw * 0.92 + 0.012;
  const addSpoke = (angle, len, thick, depth, twist = 0, inner = 0.05) => {
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(depth, len, thick);
      g.translate(0, inner + len / 2, 0);
      g.rotateY(twist);
      g.rotateX(angle);
      g.translate(side * face, 0, 0);
      parts.push(g);
    }
  };
  const spokeLen = rimR - 0.06;
  if (style === 'classic') {
    for (let i = 0; i < 5; i++) addSpoke((i / 5) * Math.PI * 2, spokeLen, 0.075, 0.035);
  } else if (style === 'turbine') {
    for (let i = 0; i < 12; i++) addSpoke((i / 12) * Math.PI * 2, spokeLen, 0.03, 0.03, 0.5);
  } else if (style === 'star') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      addSpoke(a - 0.12, spokeLen, 0.032, 0.035);
      addSpoke(a + 0.12, spokeLen, 0.032, 0.035);
    }
  } else {
    // Off-road beadlock: solid dish with lug holes.
    for (const side of [-1, 1]) {
      const d = new THREE.CylinderGeometry(rimR * 0.95, rimR * 0.95, 0.03, 24);
      d.rotateZ(Math.PI / 2);
      d.translate(side * face, 0, 0);
      parts.push(d);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const b = new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6);
        b.rotateZ(Math.PI / 2);
        b.translate(side * (face + 0.01), Math.cos(a) * rimR * 0.85, Math.sin(a) * rimR * 0.85);
        parts.push(b);
      }
    }
  }
  for (const side of [-1, 1]) {
    const hub = new THREE.CylinderGeometry(0.07, 0.08, 0.05, 12);
    hub.rotateZ(Math.PI / 2);
    hub.translate(side * (face + 0.01), 0, 0);
    parts.push(hub);
  }
  const spokes = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  const res = { tyre, barrel, spokes, radius };
  wheelGeoCache.set(key, res);
  return res;
}

const SHARED = {};
function shared() {
  if (SHARED.tyre) return SHARED;
  SHARED.tyre = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.92, side: THREE.DoubleSide });
  SHARED.barrel = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.7, roughness: 0.4 });
  SHARED.glass = new THREE.MeshPhysicalMaterial({
    color: 0x0a0e14, metalness: 0.3, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02,
  });
  SHARED.trim = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.2 });
  SHARED.metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 1, roughness: 0.25 });
  SHARED.head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 1.6 });
  SHARED.shadow = new THREE.MeshBasicMaterial({
    map: radialTexture('rgba(0,0,0,0.6)', 'rgba(0,0,0,0)'),
    transparent: true,
    depthWrite: false,
  });
  return SHARED;
}

// ---------------------------------------------------------------------------
// Body styles. Each returns { parts: [...meshes], wheels: [...], exhaust: [...] }
// ---------------------------------------------------------------------------

function streetBody(M, cfg) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-2.18, 0.34);
  s.lineTo(-1.86, 0.34);
  s.absarc(-1.36, 0.36, 0.5, Math.PI, 0, true);
  s.lineTo(0.86, 0.34);
  s.absarc(1.36, 0.36, 0.5, Math.PI, 0, true);
  s.lineTo(2.12, 0.34);
  s.quadraticCurveTo(2.3, 0.36, 2.29, 0.56);
  s.quadraticCurveTo(2.26, 0.72, 1.95, 0.77);
  s.lineTo(0.9, 0.9);
  s.lineTo(-1.2, 0.95);
  s.lineTo(-1.98, 0.98);
  s.quadraticCurveTo(-2.22, 0.98, -2.25, 0.8);
  s.lineTo(-2.27, 0.5);
  s.quadraticCurveTo(-2.27, 0.34, -2.18, 0.34);
  const bodyGeo = extrude(s, 1.88, 0.1, 4);
  g.add(new THREE.Mesh(bodyGeo, M.paint));

  const cab = new THREE.Shape();
  cab.moveTo(1.0, 0.84);
  cab.lineTo(0.04, 1.3);
  cab.quadraticCurveTo(-0.3, 1.36, -0.78, 1.32);
  cab.lineTo(-1.62, 0.92);
  cab.lineTo(1.0, 0.84);
  g.add(new THREE.Mesh(extrude(cab, 1.5, 0.07, 3), M.glass));

  const roof = new THREE.Shape();
  roof.moveTo(0.14, 1.24);
  roof.lineTo(0.02, 1.318);
  roof.quadraticCurveTo(-0.3, 1.378, -0.8, 1.338);
  roof.lineTo(-0.95, 1.26);
  roof.lineTo(0.14, 1.24);
  const roofGeo = extrude(roof, 1.54, 0.04, 2);
  g.add(new THREE.Mesh(roofGeo, M.paint));

  if (cfg.stripes === 'racing') {
    for (const x of [-0.2, 0.2]) {
      for (const geo of [bodyGeo, roofGeo]) {
        const st = new THREE.Mesh(geo, M.stripe);
        st.scale.set(0.1, 1.012, 1.004);
        st.position.x = x;
        g.add(st);
      }
    }
  }
  // Lights, grille, mirrors.
  for (const x of [-0.62, 0.62]) {
    const h = box(0.42, 0.09, 0.2, M.head, x, 0.7, 2.13);
    h.rotation.x = -0.35;
    g.add(h);
  }
  g.add(box(1.5, 0.08, 0.06, M.tail, 0, 0.82, -2.26));
  g.add(box(1.0, 0.13, 0.06, M.trim, 0, 0.45, 2.28));
  g.add(box(1.6, 0.1, 0.08, M.trim, 0, 0.4, -2.25));
  for (const x of [-0.98, 0.98]) g.add(box(0.12, 0.09, 0.2, M.paint, x, 1.0, 0.72));
  return {
    group: g,
    wheels: [
      { x: 0.83, z: 1.36, r: 0.37, w: 0.3, front: true },
      { x: -0.83, z: 1.36, r: 0.37, w: 0.3, front: true },
      { x: 0.83, z: -1.36, r: 0.37, w: 0.3, front: false },
      { x: -0.83, z: -1.36, r: 0.37, w: 0.3, front: false },
    ],
    exhaust: [[-0.45, 0.36, -2.3], [0.45, 0.36, -2.3]],
    hood: { y: 0.92, z: 1.35, tilt: 0.12 },
    front: { y: 0.33, z: 2.33, w: 1.15 },
    door: { x: 0.955, y: 0.62, z: -0.1 },
    sticker: { x: 0.957, y: 0.62, z: 0.5, size: 0.44 },
    stickerTop: { y: 1.43, z: -0.39, size: 0.52 },
    sideStripe: { x: 0.955, y: 0.5, z0: -0.85, z1: 0.85 },
    spoiler: { z: -2.0, y: 0.98, w: 1.7 },
    length: 4.5,
    width: 1.9,
  };
}

function muscleBody(M, cfg) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-2.3, 0.36);
  s.lineTo(-1.95, 0.36);
  s.absarc(-1.42, 0.4, 0.54, Math.PI, 0, true);
  s.lineTo(0.92, 0.36);
  s.absarc(1.46, 0.4, 0.54, Math.PI, 0, true);
  s.lineTo(2.3, 0.36);
  s.lineTo(2.37, 0.62);
  s.lineTo(2.33, 0.88);
  s.lineTo(0.62, 1.0);
  s.lineTo(-1.25, 1.02);
  s.lineTo(-2.28, 1.03);
  s.lineTo(-2.38, 0.9);
  s.lineTo(-2.36, 0.42);
  s.lineTo(-2.3, 0.36);
  const bodyGeo = extrude(s, 1.98, 0.09, 3);
  g.add(new THREE.Mesh(bodyGeo, M.paint));

  const cab = new THREE.Shape();
  cab.moveTo(0.66, 0.96);
  cab.lineTo(-0.22, 1.4);
  cab.lineTo(-1.05, 1.4);
  cab.lineTo(-1.75, 1.0);
  cab.lineTo(0.66, 0.96);
  g.add(new THREE.Mesh(extrude(cab, 1.56, 0.06, 2), M.glass));
  const roof = new THREE.Shape();
  roof.moveTo(-0.1, 1.34);
  roof.lineTo(-0.2, 1.425);
  roof.lineTo(-1.08, 1.425);
  roof.lineTo(-1.2, 1.34);
  roof.lineTo(-0.1, 1.34);
  const roofGeo = extrude(roof, 1.6, 0.03, 2);
  g.add(new THREE.Mesh(roofGeo, M.paint));

  // Stock hood scoop (bigger engines bring their own).
  if (partItem('engine', cfg.engine).tier < 2) {
    const scoop = box(0.6, 0.14, 0.9, M.trim, 0, 1.0, 1.25);
    scoop.rotation.x = 0.06;
    g.add(scoop);
  }

  if (cfg.stripes === 'racing') {
    for (const x of [-0.22, 0.22]) {
      for (const geo of [bodyGeo, roofGeo]) {
        const st = new THREE.Mesh(geo, M.stripe);
        st.scale.set(0.1, 1.012, 1.004);
        st.position.x = x;
        g.add(st);
      }
    }
  }
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16), M.head);
    h.rotation.x = Math.PI / 2;
    h.position.set(x, 0.72, 2.37);
    g.add(h);
  }
  g.add(box(1.1, 0.2, 0.05, M.trim, 0, 0.66, 2.38));
  g.add(box(0.5, 0.12, 0.05, M.tail, -0.6, 0.8, -2.38));
  g.add(box(0.5, 0.12, 0.05, M.tail, 0.6, 0.8, -2.38));
  g.add(box(2.0, 0.1, 0.12, M.metal, 0, 0.42, 2.38));
  g.add(box(2.0, 0.1, 0.12, M.metal, 0, 0.44, -2.4));
  for (const x of [-1.02, 1.02]) g.add(box(0.12, 0.09, 0.2, M.paint, x, 1.08, 0.55));
  return {
    group: g,
    wheels: [
      { x: 0.86, z: 1.46, r: 0.38, w: 0.32, front: true },
      { x: -0.86, z: 1.46, r: 0.38, w: 0.32, front: true },
      { x: 0.86, z: -1.42, r: 0.41, w: 0.38, front: false },
      { x: -0.86, z: -1.42, r: 0.41, w: 0.38, front: false },
    ],
    exhaust: [[-0.6, 0.38, -2.42], [0.6, 0.38, -2.42]],
    hood: { y: 1.03, z: 1.3, tilt: 0.07 },
    front: { y: 0.52, z: 2.42, w: 1.2 },
    door: { x: 1.0, y: 0.7, z: -0.25 },
    sticker: { x: 1.002, y: 0.7, z: 0.42, size: 0.46 },
    stickerTop: { y: 1.485, z: -0.64, size: 0.62 },
    sideStripe: { x: 1.0, y: 0.56, z0: -0.85, z1: 0.9 },
    spoiler: { z: -2.15, y: 1.03, w: 1.8 },
    length: 4.7,
    width: 2.0,
  };
}

function buggyBody(M, cfg) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-1.45, 0.55);
  s.lineTo(1.45, 0.55);
  s.lineTo(1.85, 0.78);
  s.lineTo(1.35, 0.98);
  s.lineTo(-1.15, 0.98);
  s.lineTo(-1.55, 0.82);
  s.lineTo(-1.45, 0.55);
  g.add(new THREE.Mesh(extrude(s, 1.35, 0.08, 3), M.paint));
  if (cfg.stripes !== 'none') {
    const st = new THREE.Mesh(extrude(s, 1.35, 0.08, 3), M.stripe);
    st.scale.set(cfg.stripes === 'racing' ? 0.18 : 1.03, 0.5, 1.01);
    st.position.y = cfg.stripes === 'racing' ? 0.5 : 0.29;
    g.add(st);
  }
  // Engine block and seat.
  g.add(box(0.9, 0.45, 0.7, M.trim, 0, 1.05, -1.2));
  g.add(box(0.7, 0.12, 0.6, M.metal, 0, 1.33, -1.2));
  g.add(box(0.6, 0.6, 0.12, M.trim, 0, 1.25, -0.55));
  // Driver.
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M.stripe);
  helmet.position.set(0, 1.55, -0.25);
  g.add(helmet);
  const visor = box(0.3, 0.1, 0.1, M.glass, 0, 1.56, -0.08);
  g.add(visor);
  // Roll cage.
  const r = 0.045;
  const cage = M.cage;
  const fy = 1.0;
  const ty = 1.95;
  const pts = {
    fl: [0.6, fy, 0.55], fr: [-0.6, fy, 0.55], bl: [0.6, fy, -0.75], br: [-0.6, fy, -0.75],
    tfl: [0.5, ty, 0.05], tfr: [-0.5, ty, 0.05], tbl: [0.5, ty, -0.7], tbr: [-0.5, ty, -0.7],
  };
  const bars = [
    ['fl', 'tfl'], ['fr', 'tfr'], ['bl', 'tbl'], ['br', 'tbr'],
    ['tfl', 'tfr'], ['tbl', 'tbr'], ['tfl', 'tbl'], ['tfr', 'tbr'], ['tfl', 'tbr'],
  ];
  for (const [a, b] of bars) g.add(tube(pts[a], pts[b], r, cage));
  // Front bumper and lights.
  g.add(tube([0.75, 0.55, 1.95], [-0.75, 0.55, 1.95], 0.05, cage));
  g.add(tube([0.75, 0.55, 1.95], [0.6, 0.85, 1.6], 0.04, cage));
  g.add(tube([-0.75, 0.55, 1.95], [-0.6, 0.85, 1.6], 0.04, cage));
  for (const x of [-0.35, 0.35]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 14), M.head);
    h.rotation.x = Math.PI / 2;
    h.position.set(x, 2.0, 0.12);
    g.add(h);
  }
  g.add(box(0.8, 0.08, 0.05, M.tail, 0, 0.9, -1.58));
  // Suspension arms.
  for (const [x, z] of [[1, 1.4], [-1, 1.4], [1, -1.4], [-1, -1.4]]) {
    g.add(tube([x * 0.55, 0.65, z], [x * 0.95, 0.52, z], 0.05, M.metal));
  }
  return {
    group: g,
    wheels: [
      { x: 1.0, z: 1.42, r: 0.5, w: 0.42, front: true },
      { x: -1.0, z: 1.42, r: 0.5, w: 0.42, front: true },
      { x: 1.0, z: -1.38, r: 0.53, w: 0.48, front: false },
      { x: -1.0, z: -1.38, r: 0.53, w: 0.48, front: false },
    ],
    exhaust: [[0.3, 0.9, -1.62], [-0.3, 0.9, -1.62]],
    engineTop: { y: 1.39, z: -1.2 },
    door: { x: 0.69, y: 0.77, z: 0.1 },
    sticker: { x: 0.692, y: 0.77, z: 0.76, size: 0.36 },
    stickerTop: { y: 1.075, z: 1.02, size: 0.5 },
    sideStripe: null,
    spoiler: { z: -1.5, y: 1.6, w: 1.6 },
    length: 4.2,
    width: 2.4,
  };
}

function formulaBody(M, cfg) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-1.95, 0.22);
  s.lineTo(2.3, 0.22);
  s.quadraticCurveTo(2.78, 0.24, 2.72, 0.34);
  s.lineTo(1.2, 0.58);
  s.lineTo(0.45, 0.74);
  s.lineTo(-0.25, 0.74);
  s.lineTo(-0.55, 1.08);
  s.lineTo(-1.15, 0.9);
  s.lineTo(-1.95, 0.6);
  s.lineTo(-1.95, 0.22);
  const tub = extrude(s, 0.78, 0.08, 3);
  g.add(new THREE.Mesh(tub, M.paint));
  if (cfg.stripes === 'racing') {
    const st = new THREE.Mesh(tub, M.stripe);
    st.scale.set(0.3, 1.015, 1.005);
    g.add(st);
  }
  const pod = new THREE.Shape();
  pod.moveTo(-1.45, 0.22);
  pod.lineTo(0.55, 0.22);
  pod.lineTo(0.65, 0.58);
  pod.lineTo(-0.55, 0.66);
  pod.lineTo(-1.6, 0.42);
  pod.lineTo(-1.45, 0.22);
  g.add(new THREE.Mesh(extrude(pod, 1.42, 0.08, 3), cfg.stripes === 'side' ? M.stripe : M.paint));
  // Cockpit hole + driver.
  g.add(box(0.5, 0.06, 0.75, M.trim, 0, 0.75, 0.12));
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), M.stripe);
  helmet.position.set(0, 0.88, -0.05);
  g.add(helmet);
  g.add(box(0.26, 0.08, 0.06, M.glass, 0, 0.9, 0.11));
  // Halo.
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 20, Math.PI), M.trim);
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(0, 1.0, -0.05);
  g.add(halo);
  g.add(tube([0, 0.74, 0.55], [0, 1.0, 0.29], 0.035, M.trim));
  // Front wing.
  g.add(box(2.05, 0.05, 0.5, M.stripe, 0, 0.16, 2.5));
  g.add(box(1.7, 0.04, 0.25, M.paint, 0, 0.24, 2.38));
  for (const x of [-1.02, 1.02]) g.add(box(0.04, 0.24, 0.6, M.paint, x, 0.24, 2.48));
  // Rear wing.
  g.add(box(1.35, 0.06, 0.42, M.stripe, 0, 1.12, -1.95));
  g.add(box(1.35, 0.05, 0.22, M.paint, 0, 0.98, -2.0));
  for (const x of [-0.69, 0.69]) g.add(box(0.04, 0.6, 0.62, M.paint, x, 0.92, -1.95));
  g.add(box(0.08, 0.45, 0.25, M.trim, 0, 0.75, -1.85));
  // Rain light.
  g.add(box(0.2, 0.08, 0.04, M.tail, 0, 0.42, -2.0));
  // Suspension arms.
  for (const [x, z, y] of [[1, 1.55, 0.4], [-1, 1.55, 0.4], [1, -1.35, 0.42], [-1, -1.35, 0.42]]) {
    g.add(tube([x * 0.35, y, z + 0.12], [x * 0.7, y, z], 0.025, M.trim));
    g.add(tube([x * 0.35, y + 0.1, z - 0.12], [x * 0.7, y + 0.05, z], 0.025, M.trim));
  }
  return {
    group: g,
    wheels: [
      { x: 0.86, z: 1.55, r: 0.36, w: 0.36, front: true },
      { x: -0.86, z: 1.55, r: 0.36, w: 0.36, front: true },
      { x: 0.86, z: -1.35, r: 0.4, w: 0.46, front: false },
      { x: -0.86, z: -1.35, r: 0.4, w: 0.46, front: false },
    ],
    exhaust: [[0, 0.62, -2.0]],
    door: null,
    sticker: { x: 0.717, y: 0.4, z: -0.45, size: 0.34 },
    noseNumber: { y: 0.55, z: 1.4 },
    sideStripe: null,
    spoiler: null,
    length: 5.0,
    width: 2.1,
  };
}

const BODY_BUILDERS = { street: streetBody, muscle: muscleBody, buggy: buggyBody, formula: formulaBody };

export class CarModel {
  constructor(cfg, { shadows = true, glowIntensity = 1 } = {}) {
    const S = shared();
    this.cfg = { ...cfg };
    this.root = new THREE.Group();
    this.chassis = new THREE.Group();
    this.root.add(this.chassis);
    this.ownMaterials = [];

    const paint = paintMaterial(cfg.color, cfg.finish);
    const stripe = paintMaterial(cfg.accent, cfg.finish === 'chrome' ? 'metallic' : cfg.finish);
    stripe.polygonOffset = true;
    stripe.polygonOffsetFactor = -2;
    stripe.polygonOffsetUnits = -2;
    const tail = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1020, emissiveIntensity: 0.7 });
    const rim = new THREE.MeshStandardMaterial({ color: cfg.rimColor, metalness: 0.9, roughness: 0.22 });
    const cage = new THREE.MeshStandardMaterial({ color: cfg.accent, metalness: 0.5, roughness: 0.35 });
    this.ownMaterials.push(paint, stripe, tail, rim, cage);
    this.tailMat = tail;
    const M = { paint, stripe, tail, rim, cage, glass: S.glass, trim: S.trim, metal: S.metal, head: S.head };

    const def = (BODY_BUILDERS[cfg.body] || streetBody)(M, cfg);
    this.def = def;
    this.length = def.length;
    this.width = def.width;
    this.chassis.add(def.group);

    // Spoiler.
    if (def.spoiler && cfg.spoiler !== 'none') {
      const sp = def.spoiler;
      if (cfg.spoiler === 'lip') {
        const lip = box(sp.w * 0.92, 0.07, 0.24, paint, 0, sp.y + 0.05, sp.z - 0.05);
        lip.rotation.x = 0.35;
        this.chassis.add(lip);
      } else {
        const wing = box(sp.w + 0.1, 0.06, 0.42, stripe, 0, sp.y + 0.42, sp.z - 0.1);
        wing.rotation.x = 0.12;
        this.chassis.add(wing);
        for (const x of [-sp.w * 0.32, sp.w * 0.32]) this.chassis.add(box(0.06, 0.42, 0.18, S.trim, x, sp.y + 0.2, sp.z - 0.05));
        for (const x of [-(sp.w + 0.1) / 2, (sp.w + 0.1) / 2]) this.chassis.add(box(0.04, 0.2, 0.5, paint, x, sp.y + 0.42, sp.z - 0.1));
      }
    }

    // Side stripe & race numbers.
    if (def.sideStripe && cfg.stripes === 'side') {
      const ss = def.sideStripe;
      for (const side of [-1, 1]) {
        const st = box(0.012, 0.11, ss.z1 - ss.z0 + 0.6, stripe, side * ss.x, ss.y, (ss.z0 + ss.z1) / 2 + 0.1);
        this.chassis.add(st);
      }
    }
    if (cfg.number != null) {
      const tex = numberTexture(cfg.number);
      const nm = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3,
      });
      this.ownMaterials.push(nm);
      this.numberTex = tex;
      if (def.door) {
        for (const side of [-1, 1]) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), nm);
          p.position.set(side * (def.door.x + 0.006), def.door.y, def.door.z);
          p.rotation.y = side * Math.PI / 2;
          this.chassis.add(p);
        }
      } else if (def.noseNumber) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), nm);
        p.position.set(0, def.noseNumber.y + 0.07, def.noseNumber.z);
        p.rotation.x = -Math.PI / 2 + 0.16;
        this.chassis.add(p);
      }
    }

    // Sticker on both sides and on top.
    const stex = cfg.sticker && cfg.sticker !== 'none' ? stickerTexture(cfg.sticker) : null;
    if (stex) {
      const sm = new THREE.MeshStandardMaterial({ map: stex, transparent: true, alphaTest: 0.05, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -4 });
      this.ownMaterials.push(sm);
      const st = def.sticker;
      if (st) {
        for (const side of [-1, 1]) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(st.size, st.size), sm);
          p.position.set(side * st.x, st.y, st.z);
          p.rotation.y = (side * Math.PI) / 2;
          this.chassis.add(p);
        }
      }
      const top = def.stickerTop;
      if (top) {
        // On the roof, the right way up for the chase camera behind the car.
        const p = new THREE.Mesh(new THREE.PlaneGeometry(top.size, top.size), sm);
        p.rotation.set(-Math.PI / 2, 0, Math.PI);
        p.position.set(0, top.y, top.z);
        this.chassis.add(p);
      }
    }

    // Wheels. Tyre parts change the size and add a coloured sidewall stripe.
    const style = cfg.wheels || 'classic';
    const tyre = partItem('tyres', cfg.tyres).id;
    const ringColor = { sport: '#ffd23f', slicks: '#e3242b', rally: '#f5f5f5' }[tyre];
    const ringMat = ringColor ? new THREE.MeshStandardMaterial({ color: ringColor, roughness: 0.55 }) : null;
    if (ringMat) this.ownMaterials.push(ringMat);
    this.wheels = def.wheels.map((w) => {
      let r = style === 'offroad' ? w.r * 1.12 : w.r;
      if (tyre === 'rally') r *= 1.05;
      const width = tyre === 'slicks' ? w.w * 1.2 : w.w;
      const wg = wheelGeometry(style, +r.toFixed(3), +width.toFixed(3));
      const pivot = new THREE.Group();
      pivot.position.set(w.x, r, w.z);
      const spin = new THREE.Group();
      pivot.add(spin);
      spin.add(new THREE.Mesh(wg.tyre, S.tyre));
      spin.add(new THREE.Mesh(wg.barrel, S.barrel));
      spin.add(new THREE.Mesh(wg.spokes, rim));
      if (ringMat) {
        const ring = new THREE.TorusGeometry(r * 0.84, r * 0.035, 6, 40).rotateY(Math.PI / 2);
        for (const side of [-1, 1]) {
          const m = new THREE.Mesh(ring, ringMat);
          m.position.x = side * (width / 2 + 0.004);
          spin.add(m);
        }
      }
      this.root.add(pivot);
      return { pivot, spin, front: w.front, r, baseY: r };
    });
    // Lift body if the tyres got bigger.
    if (style === 'offroad') this.chassis.position.y = 0.06;

    // Exhaust pipes (exhaust part) + nitro flames (nitro part).
    const xt = partItem('exhaust', cfg.exhaust).tier;
    const nt = partItem('nitro', cfg.nitro).tier;
    const [cCore, cMid, cOuter] = NITRO_COLORS[nt] || NITRO_COLORS[0];
    this.nitroColors = [cCore, cMid, cOuter].map((c) => new THREE.Color(c));
    this.flameScale = 1 + 0.3 * nt;
    // One set of uniforms per car, shared by all its flames.
    this.flameU = { uTime: { value: Math.random() * 10 }, uK: { value: 0 }, uBurst: { value: 0 }, uFire: { value: 0 }, uLen: { value: 1 }, uSeed: { value: Math.random() * 50 } };
    const flameMat = (layer) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { ...this.flameU, uLayer: { value: layer }, uCore: { value: new THREE.Color(cCore) }, uMid: { value: new THREE.Color(cMid) }, uOuter: { value: new THREE.Color(cOuter) } },
        vertexShader: FLAME_VERT,
        fragmentShader: FLAME_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      this.ownMaterials.push(m);
      return m;
    };
    const coreMat = flameMat(0);
    const outerMat = flameMat(1);
    const wispMat = flameMat(2);
    this.glowMat = new THREE.SpriteMaterial({ map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: cMid, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.ringMat = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,255,255,0)', 'rgba(255,255,255,0.9)'), color: cMid, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.holeMat = new THREE.MeshBasicMaterial({ color: 0x15161a });
    this.ownMaterials.push(this.glowMat, this.ringMat, this.holeMat);
    this.nitroFx = { k: 0, target: false, was: false, burst: 0, fire: 0, pops: [] };
    const pipes = [];
    for (const [x, y, z] of def.exhaust) {
      if (xt === 2) pipes.push([x - 0.09, y, z], [x + 0.09, y, z]);
      else pipes.push([x, y, z]);
    }
    const pr = [0.06, 0.085, 0.07][xt];
    const plen = [0.25, 0.36, 0.32][xt];
    this.flames = [];
    for (const [x, y, z] of pipes) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr + 0.01, plen, 12), xt ? S.metal : S.barrel);
      pipe.rotation.x = Math.PI / 2;
      const zc = z + 0.06 - (plen - 0.25) / 2;
      pipe.position.set(x, y, zc);
      this.chassis.add(pipe);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(pr * 0.72, 12), this.holeMat);
      hole.rotation.y = Math.PI;
      hole.position.set(x, y, zc - plen / 2 - 0.002);
      this.chassis.add(hole);
      const fl = new THREE.Group();
      const wisp = new THREE.Mesh(flameGeometry(), wispMat);
      wisp.scale.set(pr * 4.6, pr * 4.6, 2.5);
      const outer = new THREE.Mesh(flameGeometry(), outerMat);
      outer.scale.set(pr * 3.0, pr * 3.0, 1.9);
      const core = new THREE.Mesh(flameGeometry(), coreMat);
      core.scale.set(pr * 1.25, pr * 1.25, 1.05);
      const glow = new THREE.Sprite(this.glowMat);
      glow.scale.setScalar(0.6);
      glow.position.z = -0.12;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.16, 24), this.ringMat);
      ring.position.z = -0.12;
      for (const m of [wisp, outer, core, ring]) m.renderOrder = 7;
      glow.renderOrder = 7;
      fl.add(wisp, outer, core, glow, ring);
      fl.userData = { outer, core, glow, ring };
      fl.position.set(x, y, zc - plen / 2 + 0.02);
      fl.visible = false;
      this.chassis.add(fl);
      this.flames.push(fl);
    }

    this.addEngineParts(def, M, cfg, nt);

    // Fake contact shadow (keeps cars grounded even with shadows off).
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(def.width * 1.35, def.length * 1.2), S.shadow);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.025;
    blob.renderOrder = 1;
    this.root.add(blob);

    if (cfg.underglow) {
      const ug = new THREE.MeshBasicMaterial({
        color: cfg.underglow,
        map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
        transparent: true,
        opacity: 0.9 * glowIntensity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.ownMaterials.push(ug);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(def.width * 2.0, def.length * 1.45), ug);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.04;
      glow.renderOrder = 2;
      this.root.add(glow);
      const strip = new THREE.MeshBasicMaterial({ color: cfg.underglow });
      this.ownMaterials.push(strip);
      this.chassis.add(box(def.width * 0.7, 0.03, def.length * 0.7, strip, 0, 0.2, 0));
    }

    this.root.traverse((o) => {
      if (o.isMesh && !o.material.transparent) {
        o.castShadow = shadows;
        o.receiveShadow = false;
      }
    });

    this.roll = 0;
    this.pitch = 0;
    this.bounceT = Math.random() * 10;
  }

  // Visible engine, turbo and nitro parts.
  addEngineParts(def, M, cfg, nt) {
    const e = partItem('engine', cfg.engine).tier;
    const t = partItem('turbo', cfg.turbo).tier;
    if (def.hood) {
      const h = def.hood;
      const g = new THREE.Group();
      g.position.set(0, h.y, h.z);
      g.rotation.x = h.tilt;
      if (e === 1) {
        g.add(box(0.8, 0.06, 1.1, M.paint, 0, 0.01, 0)); // power bulge
      } else if (e === 2) {
        g.add(box(0.64, 0.16, 0.9, M.trim, 0, 0.07, -0.05)); // hood scoop
        g.add(box(0.5, 0.09, 0.03, M.metal, 0, 0.09, 0.41));
      } else if (e === 3) {
        g.add(box(0.58, 0.22, 0.62, M.metal, 0, 0.1, -0.08)); // supercharger blower
        g.add(box(0.5, 0.12, 0.36, M.stripe, 0, 0.27, 0.0)); // scoop on top
        for (const x of [-0.14, 0.14]) {
          const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 12), M.metal);
          stack.position.set(x, 0.3, -0.28);
          g.add(stack);
        }
      }
      if (t >= 2) for (const x of [-0.58, 0.58]) g.add(box(0.2, 0.03, 0.55, M.trim, x, 0.0, 0.05)); // hood vents
      this.chassis.add(g);
    }
    if (def.front && t >= 1) {
      // Intercooler behind the front bumper.
      const f = def.front;
      const ic = box(f.w * (t >= 2 ? 1 : 0.7), 0.1, 0.05, M.metal, 0, f.y, f.z);
      this.chassis.add(ic);
      for (let i = -1; i <= 1; i++) this.chassis.add(box(f.w * (t >= 2 ? 1 : 0.7) + 0.01, 0.012, 0.055, M.trim, 0, f.y + i * 0.03, f.z));
    }
    if (def.engineTop) {
      const p = def.engineTop;
      if (e >= 1) for (const x of [-0.3, 0.3]) this.chassis.add(box(0.12, 0.12, 0.6, M.metal, x, p.y - 0.25, p.z));
      if (e >= 2) this.chassis.add(box(0.5, 0.2, 0.5, M.metal, 0, p.y + 0.1, p.z));
      if (e >= 3) {
        for (const x of [-0.13, 0.13]) {
          const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 12), M.metal);
          stack.position.set(x, p.y + 0.31, p.z);
          this.chassis.add(stack);
        }
      }
      if (t >= 1) {
        const snail = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 16), M.metal);
        snail.rotation.z = Math.PI / 2;
        snail.position.set(0.52, p.y - 0.25, p.z + 0.15);
        this.chassis.add(snail);
      }
      if (nt >= 1) {
        // Nitro bottles behind the seat.
        const bottleMat = new THREE.MeshStandardMaterial({ color: nt === 1 ? '#2f6bff' : '#8a3bff', metalness: 0.6, roughness: 0.3 });
        this.ownMaterials.push(bottleMat);
        for (const x of nt === 1 ? [-0.18, 0.18] : [-0.24, 0, 0.24]) {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12), bottleMat);
          b.position.set(x, 1.3, -0.72);
          this.chassis.add(b);
        }
      }
    }
  }

  setBrake(on) {
    this.tailMat.emissiveIntensity = on ? 3.2 : 0.7;
  }

  setNitro(on) {
    this.nitroFx.target = on;
  }

  // Nitro fire: fast ignition with a burst and shock ring, a flickering
  // flame while boosting, then two orange backfire pops when it stops.
  updateNitro(dt) {
    const n = this.nitroFx;
    if (n.target && !n.was) n.burst = 1;
    if (!n.target && n.was && n.k > 0.5) n.pops = [0.1, 0.32];
    n.was = n.target;
    n.k += ((n.target ? 1 : 0) - n.k) * (1 - Math.exp(-(n.target ? 16 : 10) * dt));
    n.burst = Math.max(0, n.burst - dt * 3.5);
    n.fire = Math.max(0, n.fire - dt * 9);
    for (let i = n.pops.length - 1; i >= 0; i--) {
      n.pops[i] -= dt;
      if (n.pops[i] <= 0) {
        n.fire = 1;
        n.pops.splice(i, 1);
      }
    }
    const k = Math.max(n.k, n.fire * 0.7);
    const U = this.flameU;
    U.uTime.value += dt;
    U.uK.value = k;
    U.uBurst.value = n.burst;
    U.uFire.value = n.fire > n.k ? n.fire : 0;
    const flick = 0.9 + 0.12 * Math.sin(U.uTime.value * 31) + 0.08 * Math.sin(U.uTime.value * 53);
    U.uLen.value = this.flameScale * (n.fire > n.k ? 0.55 : 1) * (1 + 0.7 * n.burst) * flick;
    const on = k > 0.01;
    this.glowMat.opacity = Math.min(1, k * 0.55 + n.burst * 0.45);
    this.ringMat.opacity = n.burst > 0 ? n.burst * n.burst * 0.9 : 0;
    this.holeMat.color.copy(this.nitroColors[1]).multiplyScalar(k * 1.4).addScalar(0.02);
    for (const f of this.flames) {
      f.visible = on;
      if (!on) continue;
      const { glow, ring } = f.userData;
      glow.scale.setScalar((0.32 + 0.22 * k + n.burst * 0.6) * this.flameScale * flick);
      ring.visible = n.burst > 0.02;
      ring.scale.setScalar(1 + (1 - n.burst) * 7);
    }
  }

  // speed: m/s along heading, steer: wheel angle (rad), yawRate & accel for body motion.
  animate(dt, speed, steer, yawRate = 0, accel = 0, offroad = false) {
    this.updateNitro(dt);
    for (const w of this.wheels) {
      w.spin.rotation.x += (speed / w.r) * dt;
      if (w.front) w.pivot.rotation.y = steer;
    }
    const targetRoll = Math.max(-0.07, Math.min(0.07, yawRate * speed * 0.0042));
    const targetPitch = Math.max(-0.05, Math.min(0.05, -accel * 0.0035));
    const k = 1 - Math.exp(-8 * dt);
    this.roll += (targetRoll - this.roll) * k;
    this.pitch += (targetPitch - this.pitch) * k;
    this.chassis.rotation.z = this.roll;
    this.chassis.rotation.x = this.pitch;
    this.bounceT += dt * (8 + Math.abs(speed) * 0.4);
    const bump = offroad ? 0.03 * Math.min(1, Math.abs(speed) / 15) : 0.004 * Math.min(1, Math.abs(speed) / 20);
    const baseY = this.cfg.wheels === 'offroad' ? 0.06 : 0;
    this.chassis.position.y = baseY + Math.sin(this.bounceT) * bump;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) {
        const g = o.geometry;
        let isShared = g === flameGeoCache;
        for (const v of wheelGeoCache.values()) if (v.tyre === g || v.barrel === g || v.spokes === g) isShared = true;
        if (!isShared) g.dispose();
      }
    });
    for (const m of this.ownMaterials) m.dispose();
    if (this.numberTex) this.numberTex.dispose();
    this.root.removeFromParent();
  }
}
