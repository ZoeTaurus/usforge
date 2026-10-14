// Bubble Reef: everything that makes the underwater map. Caustic light,
// the sea surface seen from below, sunbeams, coral reef, kelp, floating
// track-marker stones, sea life, a shipwreck, ruins and the island.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js/+esm';
import { radialTexture, waterNormalTexture } from './textures.js';
import { smoothstep } from './utils.js';

// ---------------------------------------------------------------------------
// Caustics: shimmering light patterns projected onto anything underwater.
// ---------------------------------------------------------------------------
const CAUSTIC_GLSL = /* glsl */ `
  varying vec3 vWPos;
  uniform float uTime;
  uniform float uWater;
  uniform float uCaustic;
  float causticFn(vec2 p, float t) {
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 8.0);
  }
`;
const CAUSTIC_APPLY = /* glsl */ `
  {
    float uwDepth = uWater - vWPos.y;
    if (uwDepth > 0.0 && uCaustic > 0.0) {
      float cc = causticFn(mod(vWPos.xz * 0.11, 6.28318) - 250.0, uTime * 0.55 + 23.0);
      float fade = smoothstep(0.0, 1.5, uwDepth) * (0.3 + 0.7 * exp(-uwDepth * 0.025));
      gl_FragColor.rgb += vec3(0.5, 0.92, 1.0) * min(cc, 1.4) * 0.3 * uCaustic * fade;
      // Deep water soaks up red light first, so deep things turn blue.
      float deep = smoothstep(16.0, 50.0, uwDepth);
      gl_FragColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.86, 1.0), deep * UW_DEEP);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.03, 0.3, 0.46), deep * 0.42 * UW_DEEP);
    }
  }
`;
// Instanced things bob up and down (floating stones) or sway (kelp).
const BOB_GLSL = /* glsl */ `
  #ifdef USE_INSTANCING
    transformed.y += sin(uTime * 0.7 + instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.07) * 0.35 / max(0.4, length(instanceMatrix[1].xyz));
  #endif
`;
const SWAY_GLSL = /* glsl */ `
  #ifdef USE_INSTANCING
    float swPh = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2;
  #else
    float swPh = 0.0;
  #endif
  transformed.x += sin(uTime * 1.1 + swPh + position.y * 0.35) * 0.06 * position.y;
  transformed.z += cos(uTime * 0.8 + swPh + position.y * 0.3) * 0.04 * position.y;
`;

export function makeCaustics(hi, level) {
  const uniforms = { uTime: { value: 0 }, uWater: { value: level }, uCaustic: { value: hi ? 1 : 0.7 } };
  function patch(mat, { bob = false, sway = false, caustic = true, glow = 0, deep = 1 } = {}) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uWater = uniforms.uWater;
      shader.uniforms.uCaustic = uniforms.uCaustic;
      shader.vertexShader =
        'varying vec3 vWPos;\nuniform float uTime;\n' +
        shader.vertexShader
          .replace('#include <begin_vertex>', `#include <begin_vertex>\n${bob ? BOB_GLSL : ''}${sway ? SWAY_GLSL : ''}`)
          .replace(
            '#include <project_vertex>',
            `#include <project_vertex>
            {
              vec4 cw = vec4(transformed, 1.0);
              #ifdef USE_INSTANCING
                cw = instanceMatrix * cw;
              #endif
              vWPos = (modelMatrix * cw).xyz;
            }`,
          );
      shader.fragmentShader =
        `#define UW_DEEP ${deep.toFixed(2)}\n` +
        CAUSTIC_GLSL +
        shader.fragmentShader
          .replace('#include <fog_fragment>', `${caustic ? CAUSTIC_APPLY : ''}\n#include <fog_fragment>`)
          // Coral glows softly in its own colour so it stays bright in deep water.
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${glow ? `#ifdef USE_COLOR\n totalEmissiveRadiance += vColor.rgb * ${glow.toFixed(3)};\n#endif` : ''}`);
    };
    mat.customProgramCacheKey = () => `uw-${bob}-${sway}-${caustic}-${glow}-${deep}`;
    return mat;
  }
  return {
    uniforms,
    patch,
    tick(dt) {
      uniforms.uTime.value += dt;
    },
  };
}

// ---------------------------------------------------------------------------
// The shimmering soap-bubble shield around each car.
// ---------------------------------------------------------------------------
const BUBBLE_VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vV;
  #include <fog_pars_vertex>
  void main() {
    vec3 p = position;
    p += normal * sin(uTime * 3.1 + position.y * 4.0 + position.z * 1.7) * 0.03;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const BUBBLE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform vec3 uTint;
  uniform float uTintAmt;
  varying vec3 vN;
  varying vec3 vV;
  #include <fog_pars_fragment>
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    float f = 1.0 - abs(dot(n, vV));
    float rim = pow(f, 2.2);
    // Soap-film rainbow that drifts over the surface.
    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (f * 1.3 + n.y * 0.25 + uTime * 0.06 + vec3(0.0, 0.33, 0.67)));
    // A coloured bubble keeps a little shimmer of rainbow.
    irid = mix(irid, uTint * (0.75 + 0.5 * f), uTintAmt);
    vec3 col = mix(vec3(0.8, 0.97, 1.0), irid, 0.6) * (0.25 + rim * 1.25);
    // Two little window glints.
    vec3 r = reflect(-vV, n);
    float glint = pow(max(dot(r, normalize(vec3(0.4, 0.8, 0.45))), 0.0), 90.0) * 1.6;
    glint += pow(max(dot(r, normalize(vec3(-0.5, 0.6, 0.3))), 0.0), 220.0) * 0.8;
    float a = (0.05 + rim * 0.62 + glint) * uFade;
    gl_FragColor = vec4(col + glint, a);
    #include <fog_fragment>
  }
`;

function makeBubbleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFade: { value: 1 }, uTint: { value: new THREE.Color() }, uTintAmt: { value: 0 } }]),
    vertexShader: BUBBLE_VERT,
    fragmentShader: BUBBLE_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
}

// A bubble sized to the car. Its material's uTime must be shared by the caller.
// `tint` (a colour) makes a coloured bubble instead of a rainbow one.
export function carBubble(model, time, tint = null) {
  const mat = makeBubbleMaterial();
  mat.uniforms.uTime = time;
  if (tint) {
    mat.uniforms.uTint.value.set(tint);
    mat.uniforms.uTintAmt.value = 0.85;
  }
  const geo = new THREE.SphereGeometry(1, 32, 18);
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(model.width * 1.12, 1.85, model.length * 0.8);
  m.position.y = 0.8;
  m.renderOrder = 4;
  m.userData.base = m.scale.clone();
  return m;
}

// ---------------------------------------------------------------------------
// Geometry helpers (vertex coloured, merged).
// ---------------------------------------------------------------------------
function col(geo, color, mul = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color).multiplyScalar(mul);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
function merge(parts) {
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

const CORAL_COLORS = ['#ff6f91', '#ff9671', '#ffc75f', '#f9f871', '#d65db1', '#9b6bff', '#00c9a7', '#4ffbdf', '#ff5e78', '#ffb4a2', '#ff8a3d', '#7ee8fa'];

const GEO = {
  brain() {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const ridge = 1 + 0.07 * Math.sin(x * 9 + Math.sin(z * 7) * 2) * Math.cos(z * 8 + y * 3);
      p.setXYZ(i, x * ridge, Math.max(-0.1, y * 0.62 * ridge), z * ridge);
    }
    return merge([col(g, '#ffffff')]);
  },
  branch() {
    const parts = [];
    const grow = (base, dir, len, r, depth) => {
      const end = base.clone().addScaledVector(dir, len);
      const g = new THREE.CylinderGeometry(r * 0.7, r, len, 5, 1, true);
      g.translate(0, len / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      g.applyQuaternion(q);
      g.translate(base.x, base.y, base.z);
      parts.push(col(g, '#ffffff'));
      if (depth === 0) {
        parts.push(col(new THREE.IcosahedronGeometry(r * 1.1, 0).translate(end.x, end.y, end.z), '#ffffff'));
        return;
      }
      const n = depth === 2 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + depth;
        const nd = new THREE.Vector3(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55).add(dir.clone().multiplyScalar(0.4)).normalize();
        grow(end, nd, len * 0.72, r * 0.7, depth - 1);
      }
    };
    grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.9, 0.16, 2);
    return merge(parts);
  },
  fan() {
    const fan = new THREE.CircleGeometry(1.3, 18, 0, Math.PI).translate(0, 0.25, 0);
    const p = fan.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3) * 0.08);
    return merge([col(fan, '#ffffff'), col(new THREE.CylinderGeometry(0.06, 0.09, 0.4, 5).translate(0, 0.15, 0), '#ffffff', 0.7)]);
  },
  tube() {
    const parts = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const r = k === 0 ? 0 : 0.32;
      const h = 0.7 + ((k * 37) % 10) / 10;
      parts.push(col(new THREE.CylinderGeometry(0.13, 0.17, h, 6, 1, true).translate(Math.cos(a) * r, h / 2, Math.sin(a) * r), '#ffffff'));
      parts.push(col(new THREE.TorusGeometry(0.13, 0.03, 3, 6).rotateX(Math.PI / 2).translate(Math.cos(a) * r, h, Math.sin(a) * r), '#ffffff', 1.2));
    }
    return merge(parts);
  },
  anemone() {
    const parts = [col(new THREE.SphereGeometry(0.45, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', 0.8)];
    for (let k = 0; k < 16; k++) {
      const a = k * 2.4;
      const rr = 0.12 + (k % 5) * 0.06;
      const t = new THREE.ConeGeometry(0.06, 0.7, 3, 1, true).translate(0, 0.35, 0).rotateZ(Math.cos(a) * 0.5).rotateX(Math.sin(a) * 0.5).translate(Math.cos(a) * rr, 0.3, Math.sin(a) * rr);
      parts.push(col(t, '#ffffff'));
    }
    return merge(parts);
  },
  kelp() {
    const parts = [];
    for (let k = 0; k < 3; k++) {
      const strip = new THREE.PlaneGeometry(0.7, 13, 1, 10).translate(0, 6.5, 0).rotateY((k / 3) * Math.PI);
      const p = strip.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        p.setX(i, p.getX(i) + Math.sin(y * 0.5 + k) * 0.35);
      }
      parts.push(col(strip, k % 2 ? '#5f8f2a' : '#7a9a32'));
    }
    return merge(parts);
  },
  seagrass() {
    const parts = [];
    for (let k = 0; k < 5; k++) {
      const h = 1.2 + (k % 3) * 0.5;
      parts.push(col(new THREE.PlaneGeometry(0.12, h, 1, 3).translate(0, h / 2, 0).rotateY(k * 1.3).translate((k - 2) * 0.12, 0, (k % 2) * 0.1), '#4f9a3a'));
    }
    return merge(parts);
  },
  rock() {
    return merge([col(new THREE.DodecahedronGeometry(1, 1).scale(1.3, 0.8, 1.1), '#ffffff')]);
  },
  // Floating marker stone: green algae on top, pink coral crust on the sides, dark below.
  floatStone() {
    const g = new THREE.DodecahedronGeometry(1, 1).scale(1.25, 0.75, 1.05);
    g.computeVertexNormals();
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const c = new Float32Array(p.count * 3);
    const top = new THREE.Color('#6fcf7a');
    const side = new THREE.Color('#c98fb6');
    const bottom = new THREE.Color('#3a4a63');
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
      const spot = Math.sin(p.getX(i) * 7.1 + p.getZ(i) * 5.3) * 0.5 + 0.5;
      if (ny > 0.55) tmp.copy(top).lerp(new THREE.Color('#b6f07a'), spot * 0.5);
      else if (ny > -0.35) tmp.copy(side).lerp(new THREE.Color('#ff9f8a'), spot * 0.6).lerp(bottom, smoothstep(0.2, -0.35, ny));
      else tmp.copy(bottom);
      for (let k = 0; k < 3; k++) c.set([tmp.r, tmp.g, tmp.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.deleteAttribute('uv');
    return g;
  },
  // Flat table coral on a short stalk.
  table() {
    const top = new THREE.CylinderGeometry(1.4, 1.1, 0.18, 14, 1).translate(0, 0.9, 0);
    const p = top.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const r = Math.hypot(p.getX(i), p.getZ(i));
      p.setY(i, p.getY(i) + Math.sin(a * 5) * 0.06 * r + r * 0.08);
    }
    return merge([col(top, '#ffffff'), col(new THREE.CylinderGeometry(0.18, 0.3, 0.9, 6).translate(0, 0.45, 0), '#ffffff', 0.75)]);
  },
  // Tall rock spire crusted with patches of coral colour.
  spire() {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const y = (k / 12) * 18;
      pts.push(new THREE.Vector2(k === 12 ? 0.4 : (3.4 - y * 0.13) * (1 + 0.16 * Math.sin(y * 1.4)), y));
    }
    const g = new THREE.LatheGeometry(pts, 11).toNonIndexed();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const w = 1 + 0.14 * Math.sin(x * 2.3 + y * 0.9) * Math.cos(z * 2.1 - y * 0.7);
      p.setXYZ(i, x * w, y, z * w);
    }
    g.computeVertexNormals();
    return crustPaint(g);
  },
  // Barrel sponge: a wide open tube.
  sponge() {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const y = (k / 6) * 2.4;
      pts.push(new THREE.Vector2(0.55 + Math.sin((k / 6) * Math.PI * 0.8) * 0.45, y));
    }
    pts.push(new THREE.Vector2(0.7, 2.4), new THREE.Vector2(0.6, 0.3));
    return merge([col(new THREE.LatheGeometry(pts, 10), '#ffffff')]);
  },
  // Spiky sea urchin.
  urchin() {
    const parts = [col(new THREE.IcosahedronGeometry(0.35, 1), '#ffffff')];
    const ico = new THREE.IcosahedronGeometry(1, 1);
    const p = ico.attributes.position;
    const seen = new Set();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const key = v.toArray().map((n) => n.toFixed(2)).join();
      if (seen.has(key) || v.y < -0.3) continue;
      seen.add(key);
      const spike = new THREE.ConeGeometry(0.04, 0.7, 3, 1, true).translate(0, 0.35 + 0.3, 0);
      spike.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, v));
      parts.push(col(spike, '#ffffff', 0.8));
    }
    return merge(parts).translate(0, 0.25, 0);
  },

  starfish() {
    const s = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
      const r = k % 2 ? 0.16 : 0.45;
      if (k === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return merge([col(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 }).rotateX(-Math.PI / 2).translate(0, 0.05, 0), '#ffffff')]);
  },
  fish() {
    const body = new THREE.OctahedronGeometry(0.5, 1).scale(0.22, 0.5, 1.0);
    const tail = new THREE.ConeGeometry(0.28, 0.45, 4).rotateX(Math.PI / 2).scale(0.25, 1, 1).translate(0, 0, -0.62);
    const fin = new THREE.ConeGeometry(0.12, 0.3, 3).translate(0, 0.32, -0.05);
    const eye1 = new THREE.SphereGeometry(0.05, 4, 3).translate(0.1, 0.06, 0.32);
    const eye2 = new THREE.SphereGeometry(0.05, 4, 3).translate(-0.1, 0.06, 0.32);
    return merge([col(body, '#ffffff'), col(tail, '#ffffff', 0.85), col(fin, '#ffffff', 0.9), col(eye1, '#111111'), col(eye2, '#111111')]);
  },
};

// Rock coloured with big soft patches of coral crust (not single triangles).
function crustPaint(g) {
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  const rockCols = ['#6f7f96', '#7d7590', '#6f8a88'].map((h) => new THREE.Color(h));
  const crust = ['#ff7aa8', '#ff9f5a', '#a07aff', '#3fd6c0', '#ffd166', '#ff5e78'].map((h) => new THREE.Color(h));
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const patch = Math.sin(x * 0.42 + y * 0.38) * Math.cos(z * 0.47 - y * 0.26 + x * 0.15 + 1);
    const band = Math.floor(Math.abs(x * 0.21 + y * 0.17 + z * 0.19 + 40));
    const cc = patch > 0.22 ? crust[band % crust.length] : rockCols[band % 3];
    for (let k = 0; k < 3; k++) c.set([cc.r, cc.g, cc.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

function place(geo, mat, list, { cast = false } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  const o = new THREE.Object3D();
  list.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
    o.scale.setScalar(t.s || 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (t.color) m.setColorAt(i, t.color);
  });
  m.count = list.length;
  m.castShadow = cast;
  m.receiveShadow = false;
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return m;
}

function gradientTexture(stops, w = 4, h = 256, horizontal = false) {
  const c = document.createElement('canvas');
  c.width = horizontal ? h : w;
  c.height = horizontal ? w : h;
  const ctx = c.getContext('2d');
  const g = horizontal ? ctx.createLinearGradient(0, 0, h, 0) : ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, s] of stops) g.addColorStop(o, s);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Light shaft: soft on the sides, bright near the surface, fading downward.
function rayTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(64, 256);
  for (let y = 0; y < 256; y++) {
    const v = y / 255;
    const fall = Math.pow(1 - v, 1.6) * smoothstep(0, 0.06, v);
    for (let x = 0; x < 64; x++) {
      const u = Math.abs(x / 63 - 0.5) * 2;
      const side = Math.pow(Math.max(0, 1 - u), 1.8);
      const a = fall * side;
      const i = (y * 64 + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// Build the whole underwater world.
// ---------------------------------------------------------------------------
export function buildUnderwater(ctx) {
  const { scene, path, T, def, hi, rand, df, heightAt, caustics, updaters, disposables, sky, skyMat, hemi, sun, size, cx, cz, PROPS } = ctx;
  const uw = T.underwater;
  const level = uw.level;
  const wall = path.wallDist;
  const hw = path.halfWidth;
  const N = path.count;
  const q = hi ? 1 : 0.45;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const coralColor = () => new THREE.Color(pick(CORAL_COLORS));
  const track = { obj: new THREE.Group() };
  scene.add(track.obj);

  const mat = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true, side: THREE.DoubleSide }));
  const bobMat = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true }), { bob: true });
  const swayMat = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), { sway: true });
  const glowBob = caustics.patch(new THREE.MeshBasicMaterial({ vertexColors: true }), { bob: true, caustic: false });
  const coralMat = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true, side: THREE.DoubleSide }), { glow: 0.28, deep: 0.45 });
  const coralSmooth = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), { glow: 0.28, deep: 0.45 });
  const anemoneMat = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }), { sway: true, glow: 0.5, deep: 0.4 });
  const bobCoral = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true, side: THREE.DoubleSide }), { bob: true, glow: 0.22 });
  const bobAnemone = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }), { bob: true, glow: 0.45 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  disposables.push(mat, bobMat, swayMat, glowBob, glow, coralMat, coralSmooth, anemoneMat, bobCoral, bobAnemone);
  // Instanced meshes are split into map cells so the parts behind the camera
  // or lost in the blue fog are skipped when drawing.
  const CELL = 250;
  const chunks = [];
  const add = (geo, m, list, opts) => {
    if (!list.length) return;
    disposables.push(geo);
    const cells = new Map();
    for (const t of list) {
      const key = `${Math.floor(t.x / CELL)},${Math.floor(t.z / CELL)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(t);
    }
    for (const items of cells.values()) {
      const im = place(geo, m, items, opts);
      im.computeBoundingSphere();
      scene.add(im);
      chunks.push(im);
    }
  };

  // Random spot on the sea floor (bias: closer to the road is likelier).
  const B = size / 2 - 60;
  function seabedSpots(count, minD, maxD, bias = 200) {
    const out = [];
    let tries = 0;
    while (out.length < count && tries < count * 30) {
      tries++;
      const x = cx + (rand() * 2 - 1) * B;
      const z = cz + (rand() * 2 - 1) * B;
      const d = df.at(x, z);
      if (d < minD || d > maxD) continue;
      if (rand() > Math.exp(-(d - minD) / bias)) continue;
      const y = heightAt(x, z);
      if (y > level - 2.5) continue;
      out.push({ x, y, z });
    }
    return out;
  }

  // --- Sea surface: ocean from above, bright ripples from below ---------------
  const wn = waterNormalTexture();
  wn.repeat.set(size / 90, size / 90);
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 1.6, size * 1.6).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#14a3c8', transparent: true, opacity: 0.84, roughness: 0.06, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.32, 0.32) }),
  );
  top.position.set(cx, level, cz);
  scene.add(top);
  // From below, the surface is a bright, moving net of light that fades into the blue far away.
  const underMat = new THREE.MeshBasicMaterial({ color: T.night ? '#0a2238' : T.wet ? '#3a8fb0' : '#4fb8dc', transparent: true, opacity: 0.94, depthWrite: false });
  const surfLight = T.night ? 0.22 : T.wet ? 0.55 : 1;
  underMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = caustics.uniforms.uTime;
    shader.uniforms.uSurf = { value: surfLight };
    shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'uniform float uSurf;\n' + CAUSTIC_GLSL + shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `{
        float sc = causticFn(mod(vWPos.xz * 0.045, 6.28318) - 250.0, uTime * 0.35 + 7.0);
        float sc2 = causticFn(mod(vWPos.xz * 0.11 + 1.7, 6.28318) - 250.0, uTime * 0.5 + 3.0);
        gl_FragColor.rgb += vec3(0.7, 0.95, 1.0) * (min(sc, 1.5) * 0.75 + min(sc2, 1.5) * 0.3) * uSurf;
      }
      #include <fog_fragment>`,
    );
  };
  underMat.customProgramCacheKey = () => 'uw-surface';
  const under = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.6, size * 1.6).rotateX(Math.PI / 2), underMat);
  under.position.set(cx, level - 0.03, cz);
  scene.add(under);
  disposables.push(top.geometry, top.material, under.geometry, underMat);

  // Sun glow through the surface (only seen from below).
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture('rgba(255,252,230,1)', 'rgba(170,240,255,0)'), color: new THREE.Color(1.5, 1.5, 1.35),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  sunGlow.scale.set(120, 120, 1);
  scene.add(sunGlow);
  const sunDir = new THREE.Vector3(...T.sky.sun).normalize();

  // --- Sunbeams (god rays) ------------------------------------------------------
  const rayTex = rayTexture();
  const rays = [];
  const rayCount = hi ? 40 : 16;
  for (let k = 0; k < rayCount; k++) {
    const m = new THREE.MeshBasicMaterial({
      map: rayTex, color: '#c9f6ff', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const h = level - uw.floor + 10;
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(5 + rand() * 12, h).translate(0, -h / 2, 0), m);
    ray.userData = { phase: rand() * 10, base: 0.12 + rand() * 0.14, init: true };
    ray.rotation.order = 'YXZ';
    rays.push(ray);
    scene.add(ray);
    disposables.push(ray.geometry, m);
  }
  disposables.push(rayTex);

  // --- Drifting plankton ----------------------------------------------------------
  const motes = (() => {
    const n = hi ? 2200 : 900;
    const box = 90;
    const base = new Float32Array(n * 3);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) base[i] = rand() * box;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#dff8ff', size: 0.12, map: radialTexture(), transparent: true, opacity: 0.75, depthWrite: false }));
    pts.frustumCulled = false;
    scene.add(pts);
    disposables.push(g, pts.material);
    let t = 0;
    return {
      pts,
      update(dt, cam) {
        t += dt;
        const ox = cam.position.x - box / 2;
        const oy = cam.position.y - box / 2;
        const oz = cam.position.z - box / 2;
        const mod = (v) => ((v % box) + box) % box;
        for (let i = 0; i < n; i++) {
          pos[i * 3] = ox + mod(base[i * 3] + Math.sin(t * 0.2 + i) * 1.5 - ox);
          pos[i * 3 + 1] = Math.min(level - 0.3, oy + mod(base[i * 3 + 1] + t * 0.35 - oy));
          pos[i * 3 + 2] = oz + mod(base[i * 3 + 2] + Math.cos(t * 0.17 + i) * 1.5 - oz);
        }
        g.attributes.position.needsUpdate = true;
      },
    };
  })();

  // --- Bubble columns rising from vents on the sea floor --------------------------
  const vents = seabedSpots(hi ? 28 : 12, 0, 120, 50);
  const bubbles = (() => {
    const per = 34;
    const n = vents.length * per;
    const pos = new Float32Array(Math.max(1, n) * 3);
    const seed = new Float32Array(Math.max(1, n));
    for (let i = 0; i < n; i++) seed[i] = rand();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#f2fdff', size: 0.45, map: radialTexture('rgba(255,255,255,0.15)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false }));
    const ring = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.45, map: ringTexture(), transparent: true, depthWrite: false }));
    pts.frustumCulled = false;
    ring.frustumCulled = false;
    scene.add(pts, ring);
    disposables.push(g, pts.material, ring.material);
    let t = 0;
    return (dt) => {
      t += dt;
      vents.forEach((v, k) => {
        const h = level - v.y;
        for (let j = 0; j < per; j++) {
          const i = k * per + j;
          const u = (seed[i] + t * (0.05 + seed[i] * 0.04)) % 1;
          pos[i * 3] = v.x + Math.sin(u * 20 + seed[i] * 9) * (0.3 + u * 0.8);
          pos[i * 3 + 1] = v.y + u * h;
          pos[i * 3 + 2] = v.z + Math.cos(u * 17 + seed[i] * 7) * (0.3 + u * 0.8);
        }
      });
      g.attributes.position.needsUpdate = true;
    };
  })();

  // --- Coral reef on the sea floor --------------------------------------------------
  const colored = (list, cols = null) => list.map((p) => ({ ...p, ry: rand() * 6.3, color: cols ? new THREE.Color(pick(cols)) : coralColor() }));
  // Reef patches: rock mounds covered in tightly packed, colourful coral.
  const reef = { brain: [], branch: [], fan: [], tube: [], anemone: [], table: [], rock: [] };
  const PATCH_PALETTES = [
    ['#ff6f91', '#ffc75f', '#ff9671', '#f9f871'],
    ['#9b6bff', '#d65db1', '#4ffbdf', '#7ee8fa'],
    ['#ff5e78', '#ffb4a2', '#ff8a3d', '#ffd166'],
    ['#00c9a7', '#7ee8fa', '#c3f584', '#f9f871'],
    ['#ff6fb5', '#b18cff', '#ffc75f', '#00c9a7'],
  ];
  for (const c of seabedSpots(Math.round(190 * q), 0, 260, 80)) {
    const pal = pick(PATCH_PALETTES);
    const R = 7 + rand() * 10;
    reef.rock.push({ x: c.x, y: c.y - 1, z: c.z, s: R * 0.45, ry: rand() * 6, color: new THREE.Color(pick(['#7a8090', '#857a8f', '#6a7f80'])) });
    const n = Math.round((16 + rand() * 16) * (hi ? 1 : 0.7));
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * R;
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      const mound = Math.max(0, 1 - r / (R * 0.75)) * R * 0.28;
      const y = Math.max(heightAt(x, z), c.y + mound - 0.4);
      if (y > level - 3) continue;
      const type = pick(['brain', 'brain', 'branch', 'branch', 'branch', 'fan', 'tube', 'tube', 'anemone', 'anemone', 'table']);
      const big = type === 'fan' ? 1.4 : type === 'table' ? 0.9 : 1;
      reef[type].push({ x, y, z, s: (1.1 + rand() * 2) * big, ry: rand() * 6.3, color: new THREE.Color(pick(pal)) });
    }
  }
  // Tall coral spires rising towards the road.
  const spires = seabedSpots(Math.round(46 * q), wall + 14, 260, 90)
    .map((p) => ({ ...p, ry: rand() * 6.3, s: Math.min(0.9 + rand() * 0.8, (level - 4 - p.y) / 18) }))
    .filter((p) => p.s > 0.6);
  for (const sp of spires) {
    const topY = sp.y + 17.6 * sp.s;
    for (let k = 0; k < 4; k++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * 1.2 * sp.s;
      reef[pick(['branch', 'tube', 'anemone', 'brain'])].push({ x: sp.x + Math.cos(a) * r, y: topY - rand() * 1.2, z: sp.z + Math.sin(a) * r, s: 1 + rand() * 1.2, ry: rand() * 6.3, color: coralColor() });
    }
    for (let k = 0; k < 6; k++) {
      const yy = sp.y + rand() * 14 * sp.s;
      const a = rand() * Math.PI * 2;
      const r = (3.3 - ((yy - sp.y) / sp.s) * 0.13) * sp.s;
      reef.fan.push({ x: sp.x + Math.cos(a) * r, y: yy, z: sp.z + Math.sin(a) * r, s: 0.7 + rand() * 0.8, ry: a + Math.PI / 2, rz: (rand() - 0.5) * 0.6, color: coralColor() });
    }
  }
  add(GEO.spire(), coralMat, spires, { cast: hi });
  add(GEO.rock(), mat, reef.rock);
  add(GEO.table(), coralMat, reef.table);
  add(GEO.brain(), coralSmooth, colored(seabedSpots(Math.round(200 * q), 0, 500, 140)).map((p) => ({ ...p, s: 0.8 + rand() * 2.2 })).concat(reef.brain));
  add(GEO.branch(), coralMat, colored(seabedSpots(Math.round(220 * q), 0, 500, 140)).map((p) => ({ ...p, s: 1.2 + rand() * 2.4 })).concat(reef.branch));
  add(GEO.fan(), coralMat, colored(seabedSpots(Math.round(140 * q), 0, 500, 140), ['#ff5e78', '#d65db1', '#9b6bff', '#ff8a3d', '#ffc75f']).map((p) => ({ ...p, s: 1 + rand() * 2 })).concat(reef.fan));
  add(GEO.tube(), coralMat, colored(seabedSpots(Math.round(140 * q), 0, 500, 140), ['#ffc75f', '#ff9671', '#f9f871', '#ff8a3d', '#9b6bff']).map((p) => ({ ...p, s: 1 + rand() * 1.8 })).concat(reef.tube));
  add(GEO.anemone(), anemoneMat, colored(seabedSpots(Math.round(120 * q), 0, 400, 120), ['#ff6fb5', '#b18cff', '#7ee8fa', '#ffb4a2']).map((p) => ({ ...p, s: 1 + rand() * 1.6 })).concat(reef.anemone));
  add(GEO.rock(), mat, colored(seabedSpots(Math.round(300 * q), 0, 900, 260), ['#7a7f8c', '#8a7f78', '#6f7a86', '#9a8f86']).map((p) => ({ ...p, s: 1 + rand() * 4, rx: rand(), rz: rand() })));
  add(GEO.starfish(), mat, colored(seabedSpots(Math.round(180 * q), 0, 300, 100), ['#ff6a3d', '#ff3e6c', '#ffb02e', '#c94bff']).map((p) => ({ ...p, y: p.y + 0.05, s: 1 + rand() * 1.5 })));
  add(GEO.seagrass(), swayMat, colored(seabedSpots(Math.round(1400 * q), 0, 500, 120), ['#3f8a2c', '#5aa83a', '#2f7a3a']).map((p) => ({ ...p, s: 0.8 + rand() * 1.2 })));
  // Kelp forests: clusters of tall swaying kelp.
  const kelp = [];
  for (const c of seabedSpots(hi ? 22 : 10, wall + 8, 400, 120)) {
    const n = 8 + Math.floor(rand() * 14);
    for (let k = 0; k < n; k++) {
      const x = c.x + (rand() - 0.5) * 22;
      const z = c.z + (rand() - 0.5) * 22;
      if (df.at(x, z) < wall + 4) continue;
      kelp.push({ x, y: heightAt(x, z), z, ry: rand() * 6.3, s: 0.8 + rand() * 0.9, color: new THREE.Color(pick(['#ffffff', '#e8f0c0', '#d0e0a0'])) });
    }
  }
  add(GEO.kelp(), swayMat, kelp);

  // --- Floating stones with coral marking the track edges ----------------------------
  // There is no road underwater, so the stones are the track: a row on each side at
  // car height, a lower row below them, and every so often a big stone with a coral garden.
  {
    const stones = [];
    const tops = { brain: [], branch: [], tube: [], anemone: [], fan: [] };
    const pearls = [];
    const islandRocks = [];
    const every = Math.round(10 / path.step);
    const stoneTint = ['#ffffff', '#ffe6f2', '#e6fff0', '#e8eeff', '#fff4dc'];
    const pearlCols = ['#7ffbff', '#ff8fd8', '#fff27a', '#9dff8a'];
    const coralOn = (x, y, z, s, type = pick(['brain', 'branch', 'branch', 'tube', 'anemone'])) =>
      tops[type].push({ x, y, z, s: s * (type === 'branch' ? 0.75 : type === 'fan' ? 0.6 : 0.55), ry: rand() * 6, color: coralColor() });
    let k = 0;
    for (let i = 0; i < N; i += every) {
      k++;
      for (const side of [1, -1]) {
        const ground = path.py[i];
        const nx = path.nx[i] * side;
        const nz = path.nz[i] * side;
        const garden = (k + (side > 0 ? 0 : 2)) % 5 === 0;
        const off = wall + (garden ? 2.2 : 0.9) + rand() * 0.6;
        const x = path.px[i] + nx * off;
        const z = path.pz[i] + nz * off;
        const s = garden ? 1.7 + rand() * 0.6 : 0.9 + rand() * 0.9;
        if (ground > level - 1.5) {
          islandRocks.push({ x, y: ground + 0.3 * s, z, s: s * 0.9, ry: rand() * 6, color: new THREE.Color(pick(['#9a8f86', '#8a7f78', '#a89880'])) });
          continue;
        }
        const y = ground + 0.6 + rand() * 1.0;
        stones.push({ x, y, z, s, ry: rand() * 6, rx: (rand() - 0.5) * 0.3, color: new THREE.Color(pick(stoneTint)) });
        if (garden) {
          for (let c = 0; c < 4; c++) {
            const a = rand() * Math.PI * 2;
            const r = rand() * s * 0.7;
            coralOn(x + Math.cos(a) * r, y + 0.5 * s, z + Math.sin(a) * r, 0.9 + rand() * 0.6, pick(['brain', 'branch', 'fan', 'tube', 'anemone']));
          }
        } else {
          coralOn(x, y + 0.55 * s, z, s);
        }
        if (k % 2 === 0 || garden) {
          const c = new THREE.Color(pick(pearlCols)).multiplyScalar(2.2);
          pearls.push({ x: x - nx * 0.2, y: y + 0.9 * s, z: z - nz * 0.2, s: 0.16 + rand() * 0.08, color: c });
        }
        // The lower row, a few metres down.
        if (k % 2 === 1 && ground < level - 6) {
          const lo = wall + 1.5 + rand() * 2;
          const ls = 0.7 + rand() * 0.6;
          const ly = ground - 2.8 - rand() * 1.5;
          stones.push({ x: path.px[i] + nx * lo, y: ly, z: path.pz[i] + nz * lo, s: ls, ry: rand() * 6, rx: (rand() - 0.5) * 0.4, color: new THREE.Color(pick(stoneTint)) });
          if (rand() < 0.6) coralOn(path.px[i] + nx * lo, ly + 0.5 * ls, path.pz[i] + nz * lo, ls);
        }
      }
    }
    add(GEO.floatStone(), bobMat, stones);
    add(GEO.brain(), bobCoral, tops.brain);
    add(GEO.branch(), bobCoral, tops.branch);
    add(GEO.tube(), bobCoral, tops.tube);
    add(GEO.fan(), bobCoral, tops.fan);
    add(GEO.anemone(), bobAnemone, tops.anemone);
    add(merge([col(new THREE.SphereGeometry(1, 10, 8), '#ffffff')]), glowBob, pearls);
    add(GEO.rock(), mat, islandRocks, { cast: hi });
  }

  // --- Shipwreck, ruins and treasure --------------------------------------------------
  const spotNear = (along, side, dist) => {
    const i = path.indexAt(along);
    const x = path.px[i] + path.nx[i] * side * dist;
    const z = path.pz[i] + path.nz[i] * side * dist;
    return { x, z, y: heightAt(x, z), heading: Math.atan2(path.tx[i], path.tz[i]) };
  };
  const L = path.length;
  {
    // Sunken pirate ship lying on its side below the road.
    const p = spotNear(L * 0.18, 1, wall + 26);
    const hull = new THREE.Shape();
    hull.moveTo(-15, 2);
    hull.lineTo(15, 2);
    hull.quadraticCurveTo(14, -1, 9, -3.2);
    hull.lineTo(-11, -3.2);
    hull.quadraticCurveTo(-15, -1.5, -15, 2);
    const wood = '#5d4632';
    const parts = [
      col(new THREE.ExtrudeGeometry(hull, { depth: 7, bevelEnabled: false }).translate(0, 0, -3.5).rotateY(Math.PI / 2), wood),
      col(new THREE.BoxGeometry(6.6, 0.3, 28).translate(0, 2, 0), '#6e5640'),
      col(new THREE.BoxGeometry(6, 3, 6).translate(0, 3.5, -10), '#4f3b2a'),
      col(new THREE.CylinderGeometry(0.35, 0.45, 16, 8).translate(0, 10, 2), '#4a3826'),
      col(new THREE.CylinderGeometry(0.3, 0.4, 7, 8).rotateZ(1.2).translate(4, 3, 8), '#4a3826'),
      col(new THREE.BoxGeometry(0.15, 7, 9).translate(0, 12, 2), '#d8ccb0'),
    ];
    for (let k = 0; k < 4; k++) parts.push(col(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 10).rotateZ(Math.PI / 2).translate(-4 - k * 1.3, -0.4, 6 + (k % 2) * 1.5), '#6a4a2a'));
    const ship = new THREE.Mesh(merge(parts), mat);
    ship.position.set(p.x, p.y + 1.5, p.z);
    ship.rotation.set(0.08, p.heading + 0.6, 0.5);
    ship.castShadow = hi;
    scene.add(ship);
    disposables.push(ship.geometry);
    // Its anchor, half sunk in the sand, with a chain running back to the ship.
    const ap = spotNear(L * 0.18 - 26, 1, wall + 12);
    const iron = '#4a4038';
    const aparts = [
      col(new THREE.CylinderGeometry(0.22, 0.22, 4.4, 8).translate(0, 2.2, 0), iron),
      col(new THREE.TorusGeometry(0.45, 0.12, 6, 14).translate(0, 4.8, 0), iron),
      col(new THREE.BoxGeometry(2.4, 0.25, 0.25).translate(0, 3.6, 0), iron),
      col(new THREE.TorusGeometry(1.6, 0.2, 6, 18, Math.PI).rotateZ(Math.PI).translate(0, 1.6, 0), iron),
      col(new THREE.ConeGeometry(0.45, 0.9, 4).rotateZ(0.9).translate(-1.7, 1.75, 0), iron),
      col(new THREE.ConeGeometry(0.45, 0.9, 4).rotateZ(-0.9).translate(1.7, 1.75, 0), iron),
    ];
    const anchor = new THREE.Mesh(merge(aparts), mat);
    anchor.position.set(ap.x, ap.y - 0.3, ap.z);
    anchor.rotation.set(1.25, rand() * 6, 0.2);
    scene.add(anchor);
    disposables.push(anchor.geometry);
    const links = [];
    const shipPos = new THREE.Vector3(p.x, p.y + 1, p.z);
    const anchorPos = new THREE.Vector3(ap.x, ap.y + 0.2, ap.z);
    const dir = shipPos.clone().sub(anchorPos);
    const n = Math.min(60, Math.floor(dir.length() / 0.75));
    for (let k = 0; k < n; k++) {
      const u = k / n;
      const x = anchorPos.x + dir.x * u;
      const z = anchorPos.z + dir.z * u;
      links.push({ x, y: Math.max(heightAt(x, z) + 0.15, anchorPos.y + dir.y * u - Math.sin(u * Math.PI) * 2), z, ry: Math.atan2(dir.x, dir.z) + Math.PI / 2, rx: k % 2 ? Math.PI / 2 : 0, s: 1, color: new THREE.Color('#5a4a3a') });
    }
    add(merge([col(new THREE.TorusGeometry(0.3, 0.08, 5, 10).scale(1.4, 1, 1), '#ffffff')]), mat, links);
  }
  {
    // Ancient ruins: columns (some fallen) on a stone platform.
    const p = spotNear(L * 0.72, -1, wall + 22);
    const stone = '#d6caa8';
    const parts = [col(new THREE.CylinderGeometry(16, 17, 1.6, 10).translate(0, 0.8, 0), '#bfb393')];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const x = Math.cos(a) * 12;
      const z = Math.sin(a) * 12;
      const h = k % 3 === 1 ? 4 : 10;
      parts.push(col(new THREE.CylinderGeometry(0.9, 1.0, h, 12).translate(x, 1.6 + h / 2, z), stone));
      if (h > 5) parts.push(col(new THREE.BoxGeometry(2.6, 0.8, 2.6).translate(x, 1.6 + h + 0.4, z), stone));
    }
    parts.push(col(new THREE.CylinderGeometry(0.9, 1.0, 9, 12).rotateZ(Math.PI / 2).translate(3, 2.6, -4), stone));
    parts.push(col(new THREE.BoxGeometry(14, 1.2, 2.4).translate(0, 13.2, 0), stone));
    parts.push(col(new THREE.CylinderGeometry(0.9, 1.0, 11, 12).translate(-6, 7.1, 0), stone));
    parts.push(col(new THREE.CylinderGeometry(0.9, 1.0, 11, 12).translate(6, 7.1, 0), stone));
    const ruins = new THREE.Mesh(merge(parts), mat);
    ruins.position.set(p.x, p.y - 0.4, p.z);
    ruins.rotation.y = p.heading;
    ruins.castShadow = hi;
    scene.add(ruins);
    disposables.push(ruins.geometry);
  }
  {
    // Treasure chest + giant clam with a glowing pearl, right under the start.
    const p = spotNear(L - 60, 1, 12);
    const chest = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 1, roughness: 0.25, emissive: '#ffb000', emissiveIntensity: 0.5 });
    const woodM = new THREE.MeshStandardMaterial({ color: '#6a4424', roughness: 0.7 });
    caustics.patch(woodM);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 2), woodM);
    base.position.y = 0.9;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), woodM);
    lid.position.set(0, 1.8, -1);
    lid.rotation.x = -1.1;
    const coins = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.5, 0.7), gold);
    coins.position.y = 1.75;
    chest.add(base, lid, coins);
    for (let k = 0; k < 14; k++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), gold);
      c.position.set((rand() - 0.5) * 6, 0.05, (rand() - 0.5) * 5);
      c.rotation.set(rand() * 0.4, rand() * 6, rand() * 0.4);
      chest.add(c);
    }
    const shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,220,120,0.9)', 'rgba(255,200,80,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    shine.scale.set(9, 9, 1);
    shine.position.y = 2.2;
    chest.add(shine);
    chest.position.set(p.x, p.y, p.z);
    chest.rotation.y = rand() * 6;
    scene.add(chest);
    const clamP = spotNear(L - 110, -1, 16);
    const shellM = caustics.patch(new THREE.MeshStandardMaterial({ color: '#c9a0dc', roughness: 0.4, side: THREE.DoubleSide }));
    const clam = new THREE.Group();
    const lower = new THREE.Mesh(new THREE.SphereGeometry(2.4, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.55, 0.85), shellM);
    const upper = new THREE.Mesh(new THREE.SphereGeometry(2.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 0.85), shellM);
    upper.position.set(0, 0.2, -1.6);
    upper.rotation.x = -0.9;
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#bff4ff', emissiveIntensity: 1.6, roughness: 0.1, metalness: 0.3 }));
    pearl.position.y = 0.5;
    clam.add(lower, upper, pearl);
    clam.position.set(clamP.x, clamP.y + 1.2, clamP.z);
    scene.add(clam);
    disposables.push(gold, woodM, shellM, shine.material);
  }

  // --- The island: a boardwalk, palms, a beach hut and a lighthouse --------------------
  const isl = def.island;
  if (isl) {
    // Wooden boardwalk where the road runs over the island.
    const c0 = path.indexAt(path.islandAlong);
    let a = c0;
    let b = c0;
    // It starts a little under the surface, like a jetty running into the sea.
    while (b - a < N && path.py[path.wrapIndex(a - 1)] > level - 1.6) a--;
    while (b - a < N && path.py[path.wrapIndex(b + 1)] > level - 1.6) b++;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let k = a; k <= b; k++) {
      const i = path.wrapIndex(k);
      const y = path.py[i] + 0.05;
      const v = ((k - a) * path.step) / 8;
      pos.push(path.px[i] + path.nx[i] * (hw + 0.4), y, path.pz[i] + path.nz[i] * (hw + 0.4));
      pos.push(path.px[i] - path.nx[i] * (hw + 0.4), y, path.pz[i] - path.nz[i] * (hw + 0.4));
      uv.push(0, v, 1, v);
      if (k > a) {
        const n = (k - a) * 2;
        idx.push(n - 2, n - 1, n, n - 1, n + 1, n);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const tex = boardwalkTexture();
    const walk = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    walk.receiveShadow = hi;
    scene.add(walk);
    disposables.push(g, walk.material, tex);

    const land = [];
    let tries = 0;
    while (land.length < 70 && tries < 3000) {
      tries++;
      const x = isl.x + (rand() * 2 - 1) * 130;
      const z = isl.z + (rand() * 2 - 1) * 60;
      const y = heightAt(x, z);
      if (y < level + 0.6 || df.at(x, z) < hw + 4) continue;
      land.push({ x, y: y - 0.2, z, ry: rand() * 6, s: 0.8 + rand() * 0.6 });
    }
    const palmGeo = PROPS.palm();
    add(palmGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }), land.slice(0, 34), { cast: hi });
    add(PROPS.umbrella(), mat, land.slice(34, 44).map((p) => ({ ...p, s: 1, color: new THREE.Color(pick(['#ff3ea5', '#ffd23f', '#22c4e0', '#ff6a13'])) })));
    add(PROPS.cabin('#d8b56a', '#f2e6cc'), mat, land.slice(44, 46).map((p) => ({ ...p, s: 0.9 })), { cast: hi });
    // Lighthouse on the far side of the island.
    const lp = land.find((p) => df.at(p.x, p.z) > 26) || land[0];
    if (lp) {
      const g = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.4 - k * 0.22, 2.6 - k * 0.22, 3, 16), new THREE.MeshStandardMaterial({ color: k % 2 ? '#d8232a' : '#f5f5f5', roughness: 0.6 }));
        ring.position.y = 1.5 + k * 3;
        ring.castShadow = hi;
        g.add(ring);
      }
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.4) }));
      lamp.position.y = 19.5;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2, 12), new THREE.MeshStandardMaterial({ color: '#2b2e36' }));
      roof.position.y = 21.5;
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(4, 40, 16, 1, true).rotateZ(Math.PI / 2).translate(20, 0, 0),
        new THREE.MeshBasicMaterial({ map: gradientTexture([[0, 'rgba(255,250,200,0.5)'], [1, 'rgba(255,250,200,0)']], 4, 128, true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      beam.position.y = 19.5;
      g.add(lamp, roof, beam);
      g.position.set(lp.x, lp.y, lp.z);
      scene.add(g);
      updaters.push((dt) => (beam.rotation.y += dt * 0.8));
    }
  }

  // --- Sea life ---------------------------------------------------------------------------
  // Fish schools circling near the road.
  const fishGeo = GEO.fish();
  const schools = [];
  const schoolCols = [['#ff7a1a', '#ffffff'], ['#ff7a1a', '#ffffff'], ['#ffb347', '#ff8a1a'], ['#ffe14d', '#3fa9ff'], ['#4fc3ff', '#2f6bff'], ['#ff6f91', '#ffd1dc'], ['#d8f6ff', '#9fd8ff'], ['#7cff8a', '#ffe14d'], ['#ff5e78', '#ffffff'], ['#b18cff', '#7ee8fa']];
  const nSchools = hi ? 32 : 14;
  const perSchool = hi ? 38 : 24;
  for (let k = 0; k < nSchools; k++) {
    const i = Math.floor(rand() * N);
    const side = rand() < 0.5 ? 1 : -1;
    const off = side * (wall + 8 + rand() * 40);
    schools.push({
      cx: path.px[i] + path.nx[i] * off,
      cz: path.pz[i] + path.nz[i] * off,
      cy: Math.min(level - 6, path.py[i] + 1 + rand() * 9),
      r: 12 + rand() * 30,
      w: (0.12 + rand() * 0.15) * (rand() < 0.5 ? 1 : -1),
      a: rand() * 6.3,
      cols: pick(schoolCols),
      fish: Array.from({ length: perSchool }, () => ({
        ox: (rand() - 0.5) * 9, oy: (rand() - 0.5) * 4, oz: (rand() - 0.5) * 9, ph: rand() * 6.3, s: 0.6 + rand() * 0.6,
      })),
    });
  }
  const fishMat = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.2 }));
  const fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, nSchools * perSchool);
  {
    let n = 0;
    for (const sc of schools) for (const f of sc.fish) fishMesh.setColorAt(n++, new THREE.Color(sc.cols[n % 2]));
    fishMesh.instanceColor.needsUpdate = true;
  }
  fishMesh.frustumCulled = false;
  scene.add(fishMesh);
  disposables.push(fishGeo, fishMat);

  // Glowing jellyfish.
  const jellies = [];
  const jellyCols = ['#ff7ad9', '#b48cff', '#7ff3ff', '#ffb0e8'];
  for (let k = 0; k < (hi ? 18 : 8); k++) {
    const i = Math.floor(rand() * N);
    const side = rand() < 0.5 ? 1 : -1;
    const off = side * (wall + 4 + rand() * 30);
    const c = new THREE.Color(pick(jellyCols));
    const g = new THREE.Group();
    const bellM = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.5), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), bellM);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.4) }));
    core.position.y = 0.3;
    const tentM = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.3), transparent: true, opacity: 0.5, depthWrite: false });
    const tparts = [];
    for (let t = 0; t < 9; t++) {
      const a = (t / 9) * Math.PI * 2;
      tparts.push(new THREE.CylinderGeometry(0.025, 0.01, 2.6 + (t % 3), 4).translate(Math.cos(a) * 0.6, -1.3 - (t % 3) / 2, Math.sin(a) * 0.6));
    }
    const tent = new THREE.Mesh(mergeGeometries(tparts), tentM);
    g.add(bell, core, tent);
    g.position.set(path.px[i] + path.nx[i] * off, Math.min(level - 4, path.py[i] + 3 + rand() * 12), path.pz[i] + path.nz[i] * off);
    g.userData = { ph: rand() * 6.3, y0: g.position.y, s: 0.8 + rand() * 0.9 };
    g.scale.setScalar(g.userData.s);
    scene.add(g);
    jellies.push(g);
    disposables.push(bellM, tentM, tent.geometry);
  }

  // A whale gliding high above the road.
  const whale = (() => {
    const g = new THREE.Group();
    const body = new THREE.SphereGeometry(1, 28, 18);
    const p = body.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const top = new THREE.Color('#2c4a66');
    const belly = new THREE.Color('#b9cfd8');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const z = p.getZ(i);
      p.setXYZ(i, p.getX(i) * 3.4 * (1 - Math.max(0, -z) * 0.35), y * 3.0 * (1 - Math.max(0, -z) * 0.3), z * 14);
      const c = top.clone().lerp(belly, smoothstep(0.1, -0.6, y));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    body.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    body.computeVertexNormals();
    const wm = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    g.add(new THREE.Mesh(body, wm));
    const finGeo = new THREE.SphereGeometry(1, 10, 6).scale(4, 0.25, 1.4);
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ color: '#2c4a66', roughness: 0.6 }));
      fin.position.set(s * 4.5, -1.4, 4);
      fin.rotation.set(0, s * 0.5, s * -0.4);
      g.add(fin);
    }
    const tail = new THREE.Group();
    tail.position.z = -13;
    const fluke = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6).scale(5, 0.3, 1.8), new THREE.MeshStandardMaterial({ color: '#2c4a66', roughness: 0.6 }));
    fluke.position.z = -1.5;
    tail.add(fluke);
    g.add(tail);
    scene.add(g);
    disposables.push(body, wm, finGeo);
    return { g, tail };
  })();

  // Manta rays and sea turtles swimming in lazy circles.
  const swimmers = [];
  const mantaGeo = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 2.2);
    shape.quadraticCurveTo(2.2, 0.8, 4.4, -0.6);
    shape.quadraticCurveTo(2, -0.3, 0.4, -1.4);
    shape.lineTo(-0.4, -1.4);
    shape.quadraticCurveTo(-2, -0.3, -4.4, -0.6);
    shape.quadraticCurveTo(-2.2, 0.8, 0, 2.2);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.15, 0);
    return merge([col(g, '#2a3440'), col(new THREE.CylinderGeometry(0.04, 0.02, 4.5, 4).rotateX(Math.PI / 2).translate(0, 0.1, -3.4), '#2a3440')]);
  })();
  const turtleGeo = merge([
    col(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.1, 0.5, 1.4), '#5f7a3a'),
    col(new THREE.SphereGeometry(1, 12, 6).scale(1.05, 0.2, 1.35), '#d9c690'),
    col(new THREE.SphereGeometry(0.35, 10, 8).translate(0, 0.1, 1.55), '#8fa060'),
    col(new THREE.BoxGeometry(1.6, 0.08, 0.5).translate(1.1, 0, 0.6).rotateY(-0.3), '#8fa060'),
    col(new THREE.BoxGeometry(1.6, 0.08, 0.5).translate(-1.1, 0, 0.6).rotateY(0.3), '#8fa060'),
    col(new THREE.BoxGeometry(0.8, 0.08, 0.4).translate(0.7, 0, -1.1), '#8fa060'),
    col(new THREE.BoxGeometry(0.8, 0.08, 0.4).translate(-0.7, 0, -1.1), '#8fa060'),
  ]);
  const swimMat = caustics.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
  disposables.push(mantaGeo, turtleGeo, swimMat);
  for (let k = 0; k < (hi ? 8 : 4); k++) {
    const manta = k < (hi ? 4 : 2);
    const m = new THREE.Mesh(manta ? mantaGeo : turtleGeo, swimMat);
    m.scale.setScalar(manta ? 1.1 + rand() * 0.6 : 0.8 + rand() * 0.4);
    const i = Math.floor(rand() * N);
    const off = (rand() < 0.5 ? 1 : -1) * (wall + 10 + rand() * 40);
    swimmers.push({ m, manta, cx: path.px[i] + path.nx[i] * off, cz: path.pz[i] + path.nz[i] * off, cy: Math.min(level - 5, path.py[i] - 4 + rand() * 12), r: 18 + rand() * 30, w: (0.1 + rand() * 0.08) * (rand() < 0.5 ? 1 : -1), a: rand() * 6.3 });
    scene.add(m);
  }

  // --- Coral arches the cars race under -------------------------------------------------------
  {
    const W = wall + 5.5;
    const archCorals = { branch: [], fan: [], tube: [], anemone: [] };
    for (const f of [0.06, 0.25, 0.4, 0.8, 0.93]) {
      const i = path.indexAt(L * f);
      if (path.py[i] > 0.5) continue;
      const nx = path.nx[i];
      const nz = path.nz[i];
      const at = (lat, y) => new THREE.Vector3(path.px[i] + nx * lat, path.py[i] + y, path.pz[i] + nz * lat);
      const foot = (side) => Math.min(-3, heightAt(path.px[i] + nx * W * side, path.pz[i] + nz * W * side) - path.py[i]);
      const fl = foot(-1);
      const fr = foot(1);
      const curve = new THREE.CatmullRomCurve3([
        at(-W, fl - 1.5), at(-W, fl * 0.5), at(-W, 0), at(-W * 0.96, 6), at(-W * 0.72, 11.6), at(0, 14),
        at(W * 0.72, 11.6), at(W * 0.96, 6), at(W, 0), at(W, fr * 0.5), at(W, fr - 1.5),
      ]);
      const geo = new THREE.TubeGeometry(curve, hi ? 90 : 60, 2.3, hi ? 10 : 7, false).toNonIndexed();
      const p = geo.attributes.position;
      for (let v = 0; v < p.count; v++) {
        const x = p.getX(v);
        const y = p.getY(v);
        const z = p.getZ(v);
        const w = Math.sin(x * 0.9 + y * 0.7) * Math.cos(z * 0.8 - y * 0.5) * 0.5;
        p.setXYZ(v, x + w, y + w * 0.6, z - w);
      }
      geo.computeVertexNormals();
      crustPaint(geo);
      const arch = new THREE.Mesh(geo, coralMat);
      arch.castShadow = hi;
      scene.add(arch);
      disposables.push(geo);
      // Coral growing on top and fans on the sides.
      for (let k = 0; k < 16; k++) {
        const u = 0.22 + (k / 15) * 0.56;
        const c = curve.getPoint(u);
        const type = k % 4 === 0 ? 'fan' : pick(['branch', 'branch', 'tube', 'anemone']);
        archCorals[type].push({ x: c.x + (rand() - 0.5), y: c.y + 2, z: c.z + (rand() - 0.5), s: 1 + rand() * 0.8, ry: rand() * 6.3, color: coralColor() });
      }
    }
    add(GEO.branch(), coralMat, archCorals.branch);
    add(GEO.tube(), coralMat, archCorals.tube);
    add(GEO.fan(), coralMat, archCorals.fan);
    add(GEO.anemone(), anemoneMat, archCorals.anemone);
  }

  // --- Giant rock pinnacles that fade into the blue -------------------------------------------
  add(
    GEO.spire(),
    coralMat,
    seabedSpots(Math.round(34 * q) + 6, 70, 230, 120)
      .map((p) => ({ ...p, ry: rand() * 6.3, s: Math.min(1.8 + rand() * 1.3, (level - 3 - p.y) / 18) }))
      .filter((p) => p.s > 1.2),
  );

  // --- Barrel sponges and sea urchins -------------------------------------------------------
  add(GEO.sponge(), coralMat, colored(seabedSpots(Math.round(170 * q), 0, 300, 90), ['#ff8a3d', '#c45bff', '#ffc75f', '#ff5e78', '#7ee8fa']).map((p) => ({ ...p, s: 0.8 + rand() * 1.4 })));
  add(GEO.urchin(), mat, colored(seabedSpots(Math.round(240 * q), 0, 240, 80), ['#2a1a3a', '#4a1a5a', '#22223a', '#7a2a6a']).map((p) => ({ ...p, s: 0.8 + rand() * 0.8 })));

  // --- Sharks, a yellow submarine and dolphins -------------------------------------------------
  const anim = [];
  const fishBody = (len, girth, top, belly, beak = 0) => {
    const g = new THREE.SphereGeometry(1, 20, 12);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const ct = new THREE.Color(top);
    const cb = new THREE.Color(belly);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const z = p.getZ(i);
      const taper = (1 - Math.max(0, -z) * 0.65) * (1 - Math.max(0, z) * Math.max(0, z) * 0.35);
      p.setXYZ(i, p.getX(i) * girth * taper, y * girth * 1.15 * taper, z * len + (z > 0.85 ? beak * (z - 0.85) * 6 : 0));
      const c = ct.clone().lerp(cb, smoothstep(0.05, -0.5, y));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.deleteAttribute('uv');
    return g.toNonIndexed();
  };
  const finShape = (w, h, back) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(-back, h);
    sh.lineTo(-w, 0);
    sh.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }).translate(0, 0, -0.04).rotateY(-Math.PI / 2);
  };
  const swimmer = (len, girth, top, belly, beak) => {
    const g = new THREE.Group();
    const parts = [
      fishBody(len, girth, top, belly, beak),
      col(finShape(len * 0.45, girth * 1.6, len * 0.35).translate(0, girth * 0.9, len * 0.15), top),
      col(finShape(len * 0.35, girth * 1.3, len * 0.25).rotateZ(2.1).translate(girth * 0.6, -girth * 0.5, len * 0.2), top),
      col(finShape(len * 0.35, girth * 1.3, len * 0.25).rotateZ(-2.1).translate(-girth * 0.6, -girth * 0.5, len * 0.2), top),
    ];
    const body = new THREE.Mesh(merge(parts), swimMat);
    const tail = new THREE.Group();
    tail.position.z = -len * 0.92;
    const fluke = new THREE.Mesh(merge([
      col(finShape(len * 0.3, girth * 1.7, len * 0.32).rotateZ(0.5), top),
      col(finShape(len * 0.3, girth * 1.4, len * 0.3).rotateZ(Math.PI - 0.5), top),
    ]), swimMat);
    tail.add(fluke);
    g.add(body, tail);
    disposables.push(body.geometry, fluke.geometry);
    return { g, tail };
  };
  // Two sharks patrolling under the track.
  for (let k = 0; k < (hi ? 3 : 2); k++) {
    const sh = swimmer(3.4, 0.62, '#5d7088', '#e8eef2', 0);
    sh.g.name = 'shark';
    const i = path.indexAt(L * [0.12, 0.33, 0.78][k]);
    const c = { x: path.px[i] + path.nx[i] * 25, z: path.pz[i] + path.nz[i] * 25, y: path.py[i] - 6 - rand() * 3, r: 34 + rand() * 20, w: (0.16 + rand() * 0.05) * (k % 2 ? -1 : 1), a: rand() * 6.3 };
    scene.add(sh.g);
    anim.push((t) => {
      const a = c.a + c.w * t;
      sh.g.position.set(c.x + Math.cos(a) * c.r, c.y + Math.sin(t * 0.4 + k) * 1.2, c.z + Math.sin(a) * c.r);
      sh.g.rotation.y = Math.atan2(-Math.sin(a) * c.w, Math.cos(a) * c.w) + Math.sin(t * 3 + k) * 0.06;
      sh.tail.rotation.y = Math.sin(t * 3 + k) * 0.45;
    });
  }
  // Dolphins leaping out of the sea around the island.
  if (isl) {
    for (let k = 0; k < (hi ? 5 : 3); k++) {
      const d = swimmer(1.4, 0.36, '#6f8fa8', '#e6eef2', 0.25);
      d.g.scale.setScalar(1.3);
      d.g.name = 'dolphin';
      scene.add(d.g);
      const a0 = (k / 5) * Math.PI * 2;
      const w = 0.075;
      const off = k * 1.3;
      anim.push((t) => {
        const a = a0 + w * t;
        const j = ((t + off) % 5.5) / 5.5;
        const u = Math.min(1, j / 0.3);
        const jump = j < 0.3 ? Math.sin(u * Math.PI) : 0;
        d.g.position.set(isl.x + Math.cos(a) * 190, level - 2 + jump * 6.5, isl.z + Math.sin(a) * 112);
        d.g.rotation.order = 'YXZ';
        d.g.rotation.y = Math.atan2(-Math.sin(a) * 190, Math.cos(a) * 112);
        d.g.rotation.x = j < 0.3 ? -Math.cos(u * Math.PI) * 0.9 : 0;
        d.tail.rotation.x = Math.sin(t * 6 + k) * 0.35;
        d.tail.rotation.y = 0;
      });
    }
  }
  // A yellow submarine on patrol, with glowing portholes and a headlight.
  {
    const g = new THREE.Group();
    const yellow = caustics.patch(new THREE.MeshStandardMaterial({ color: '#ffcc1a', emissive: '#6a4a00', roughness: 0.35, metalness: 0.2 }));
    const dark = new THREE.MeshStandardMaterial({ color: '#333a44', roughness: 0.5, metalness: 0.6 });
    const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 2.0), toneMapped: false });
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.7, 6.5, 8, 18).rotateX(Math.PI / 2), yellow);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.6, 14), yellow);
    tower.position.set(0, 1.9, 0.8);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 6), dark);
    scope.position.set(0, 3.3, 1.1);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.6), dark);
    lens.position.set(0, 4.15, 1.3);
    g.add(hull, tower, scope, lens);
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const port = new THREE.Mesh(new THREE.CircleGeometry(0.32, 14), glass);
        port.position.set(sx * 1.71, 0.25, 2.2 - k * 1.5);
        port.rotation.y = sx * Math.PI / 2;
        g.add(port);
      }
      const fin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.9), yellow);
      fin.position.set(sx * 1.9, 0, -3.6);
      g.add(fin);
    }
    const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2, 1), yellow);
    rudder.position.set(0, 0, -4.6);
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), glass);
    lamp.position.set(0, 0, 5.02);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(4, 22, 20, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 16),
      new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,255,220,0.35)', 'rgba(255,255,220,0)'), color: '#fff6c8', transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    const prop = new THREE.Group();
    prop.position.z = -5.05;
    for (let k = 0; k < 3; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.08), dark);
      blade.position.y = 0.6;
      const arm = new THREE.Group();
      arm.rotation.z = (k / 3) * Math.PI * 2;
      arm.add(blade);
      prop.add(arm);
    }
    g.add(rudder, lamp, beam, prop);
    g.name = 'submarine';
    g.traverse((o) => {
      if (o.isMesh) disposables.push(o.geometry);
    });
    disposables.push(yellow, dark, glass, beam.material);
    scene.add(g);
    const i = path.indexAt(L * 0.7);
    const c = { x: path.px[i] - path.nx[i] * 30, z: path.pz[i] - path.nz[i] * 30, y: path.py[i] - 6.5 };
    anim.push((t, dt) => {
      const a = t * 0.045;
      g.position.set(c.x + Math.cos(a) * 70, c.y + Math.sin(t * 0.3) * 0.8, c.z + Math.sin(a) * 50);
      g.rotation.y = Math.atan2(-Math.sin(a) * 70, Math.cos(a) * 50);
      g.rotation.z = Math.sin(t * 0.5) * 0.04;
      prop.rotation.z += dt * 6;
    });
  }

  // --- Glowing sea sparkles drifting around the camera ----------------------------------------
  const sparkles = (() => {
    const n = hi ? 420 : 180;
    const box = 70;
    const base = new Float32Array(n * 3);
    const pos = new Float32Array(n * 3);
    const cols = new Float32Array(n * 3);
    const palette = ['#7ffbff', '#ff8fd8', '#fff27a', '#9dff8a', '#b48cff'].map((h) => new THREE.Color(h));
    for (let i = 0; i < n; i++) {
      base.set([rand() * box, rand() * box, rand() * box], i * 3);
      const c = palette[i % palette.length];
      cols.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.32, map: radialTexture(), vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    scene.add(pts);
    disposables.push(g, pts.material);
    const mod = (v) => ((v % box) + box) % box;
    return {
      pts,
      update(t, cam) {
        const ox = cam.position.x - box / 2;
        const oy = cam.position.y - box / 2;
        const oz = cam.position.z - box / 2;
        for (let i = 0; i < n; i++) {
          pos[i * 3] = ox + mod(base[i * 3] + Math.sin(t * 0.3 + i) * 2 - ox);
          pos[i * 3 + 1] = Math.min(level - 0.5, oy + mod(base[i * 3 + 1] + t * 0.6 + Math.sin(t + i * 1.7) * 0.5 - oy));
          pos[i * 3 + 2] = oz + mod(base[i * 3 + 2] + Math.cos(t * 0.25 + i) * 2 - oz);
        }
        g.attributes.position.needsUpdate = true;
      },
    };
  })();
  {
    let t = 0;
    updaters.push((dt, cam) => {
      t += dt;
      for (const f of anim) f(t, dt);
      sparkles.pts.visible = cam.position.y < level;
      if (sparkles.pts.visible) sparkles.update(t, cam);
    });
  }

  // --- Above / below water switching ---------------------------------------------------------
  const above = {
    fog: new THREE.Color(T.fog.color), near: T.fog.near, far: T.fog.far,
    top: new THREE.Color(T.sky.top), horizon: new THREE.Color(T.sky.horizon), bottom: new THREE.Color(T.sky.bottom), sunColor: new THREE.Color(T.sky.sunColor),
    hemiSky: new THREE.Color(T.hemi.sky), hemiGround: new THREE.Color(T.hemi.ground), hemiI: T.hemi.intensity, sunI: T.sunLight.intensity, sunC: new THREE.Color(T.sunLight.color),
    envI: scene.environmentIntensity,
  };
  // At night the sea is deep navy and the glowing reef does the lighting.
  const below = T.night
    ? {
      fog: new THREE.Color('#03182b'), near: 4, far: hi ? 150 : 120, envI: 0.12,
      top: new THREE.Color('#0b3456'), horizon: new THREE.Color('#03182b'), bottom: new THREE.Color('#010812'), sunColor: new THREE.Color('#000000'),
      hemiSky: new THREE.Color('#2a5a90'), hemiGround: new THREE.Color('#020e1a'), hemiI: 0.32, sunI: 0.18, sunC: new THREE.Color('#9fc4ff'),
    }
    : {
      fog: new THREE.Color(T.wet ? '#0a5478' : '#0b6491'), near: 6, far: hi ? 210 : 170, envI: 0.3,
      top: new THREE.Color('#4cc8ee'), horizon: new THREE.Color('#0b6491'), bottom: new THREE.Color('#032a44'), sunColor: new THREE.Color('#000000'),
      hemiSky: new THREE.Color('#8fe0f5'), hemiGround: new THREE.Color('#0b3550'), hemiI: T.wet ? 0.8 : 0.95, sunI: T.wet ? 0.8 : 1.45, sunC: new THREE.Color('#c8f2ff'),
    };
  if (T.night) {
    caustics.uniforms.uCaustic.value *= 0.3;
    sunGlow.material.color.setRGB(0.45, 0.6, 0.85);
    for (const r of rays) r.userData.base *= 0.35;
  } else if (T.wet) {
    caustics.uniforms.uCaustic.value *= 0.6;
    for (const r of rays) r.userData.base *= 0.5;
  }
  const clouds = scene.getObjectByName('clouds');
  let isUnder = null;
  const state = { under: false };
  function applyEnv(u) {
    const e = u ? below : above;
    scene.fog.color.copy(e.fog);
    scene.fog.near = e.near;
    scene.fog.far = e.far;
    scene.background.copy(e.fog);
    skyMat.uniforms.top.value.copy(e.top);
    skyMat.uniforms.horizon.value.copy(e.horizon);
    skyMat.uniforms.bottom.value.copy(e.bottom);
    skyMat.uniforms.sunColor.value.copy(e.sunColor);
    hemi.color.copy(e.hemiSky);
    hemi.groundColor.copy(e.hemiGround);
    hemi.intensity = e.hemiI;
    sun.intensity = e.sunI;
    sun.color.copy(e.sunC);
    scene.environmentIntensity = e.envI;
    sunGlow.visible = u;
    if (clouds) clouds.visible = !u;
    motes.pts.visible = u;
    for (const r of rays) r.visible = u;
  }

  let t = 0;
  const m4 = new THREE.Matrix4();
  const qn = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const vpos = new THREE.Vector3();
  const vsc = new THREE.Vector3();
  updaters.push((dt, cam) => {
    t += dt;
    const u = cam.position.y < level;
    if (u !== isUnder) {
      isUnder = u;
      state.under = u;
      applyEnv(u);
    }
    // Underwater, anything past the fog is invisible anyway.
    for (const c of chunks) {
      const bs = c.boundingSphere;
      c.visible = !u || cam.position.distanceTo(bs.center) - bs.radius < below.far;
    }
    wn.offset.x += dt * 0.012;
    wn.offset.y += dt * 0.007;
    bubbles(dt);
    if (u) {
      motes.update(dt, cam);
      // The sun shimmers through the surface straight up the sun's direction.
      const d = Math.max(4, (level - 0.6 - cam.position.y) / sunDir.y);
      sunGlow.position.copy(cam.position).addScaledVector(sunDir, d);
      sunGlow.scale.setScalar(d * 0.7);
      // Sunbeams: keep them around the camera and facing it.
      for (const r of rays) {
        const dx = r.position.x - cam.position.x;
        const dz = r.position.z - cam.position.z;
        if (r.userData.init || dx * dx + dz * dz > 190 * 190) {
          r.userData.init = false;
          const a = rand() * Math.PI * 2;
          const d = 20 + rand() * 160;
          r.position.set(cam.position.x + Math.cos(a) * d, level, cam.position.z + Math.sin(a) * d);
        }
        r.rotation.y = Math.atan2(cam.position.x - r.position.x, cam.position.z - r.position.z);
        r.rotation.z = 0.18;
        r.material.opacity = r.userData.base * (0.55 + 0.45 * Math.sin(t * 0.5 + r.userData.phase));
      }
    }
    // Fish.
    let n = 0;
    for (const sc of schools) {
      const a = sc.a + sc.w * t;
      const ccx = sc.cx + Math.cos(a) * sc.r;
      const ccz = sc.cz + Math.sin(a) * sc.r;
      const yaw = Math.atan2(-Math.sin(a) * sc.w, Math.cos(a) * sc.w);
      for (const f of sc.fish) {
        const wob = Math.sin(t * 2 + f.ph);
        vpos.set(ccx + f.ox + wob * 0.6, sc.cy + f.oy + Math.sin(t * 0.7 + f.ph) * 0.8, ccz + f.oz + Math.cos(t * 1.7 + f.ph) * 0.6);
        eul.set(0, yaw + Math.sin(t * 9 + f.ph) * 0.18, 0);
        qn.setFromEuler(eul);
        vsc.setScalar(f.s);
        m4.compose(vpos, qn, vsc);
        fishMesh.setMatrixAt(n++, m4);
      }
    }
    fishMesh.instanceMatrix.needsUpdate = true;
    // Jellyfish pulse and drift.
    for (const j of jellies) {
      const ph = t * 1.6 + j.userData.ph;
      const s = j.userData.s;
      j.scale.set(s * (1 + Math.sin(ph) * 0.12), s * (1 - Math.sin(ph) * 0.1), s * (1 + Math.sin(ph) * 0.12));
      j.position.y = j.userData.y0 + Math.sin(t * 0.4 + j.userData.ph) * 2.5;
      j.rotation.y += dt * 0.2;
    }
    // Whale on a long, slow loop above the road.
    {
      const a = t * 0.022;
      const R = 330;
      whale.g.position.set(cx + Math.cos(a) * R, level - 9 + Math.sin(t * 0.2) * 1.5, cz + Math.sin(a) * R * 0.75);
      whale.g.rotation.y = Math.atan2(-Math.sin(a) * R, Math.cos(a) * R * 0.75);
      whale.g.rotation.z = Math.sin(t * 0.3) * 0.05;
      whale.tail.rotation.x = Math.sin(t * 1.3) * 0.35;
    }
    for (const s of swimmers) {
      const a = s.a + s.w * t;
      s.m.position.set(s.cx + Math.cos(a) * s.r, s.cy + Math.sin(t * 0.5 + s.a) * 1.2, s.cz + Math.sin(a) * s.r);
      s.m.rotation.y = Math.atan2(-Math.sin(a) * s.w, Math.cos(a) * s.w);
      s.m.rotation.z = s.manta ? Math.sin(t * 1.6 + s.a) * 0.25 : Math.sin(t * 2 + s.a) * 0.08;
    }
  });
  return state;
}

// Planks running across the road, with a painted centre line.
function boardwalkTexture() {
  const W = 256;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const woods = ['#b7834f', '#a8743f', '#c28f5a', '#9c6a3a', '#b98552'];
  let k = 0;
  for (let y = 0; y < H; y += 32) {
    ctx.fillStyle = woods[(k * 3 + (k >> 1)) % woods.length];
    ctx.fillRect(0, y, W, 32);
    // Grain.
    ctx.strokeStyle = 'rgba(70,40,15,0.18)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 4; g++) {
      ctx.beginPath();
      const gy = y + 5 + g * 7;
      ctx.moveTo(0, gy);
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, gy + Math.sin(x * 0.05 + k + g) * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,22,8,0.75)';
    ctx.fillRect(0, y, W, 3);
    ctx.fillStyle = 'rgba(30,20,10,0.6)';
    for (const x of [10, W / 2 - 40, W / 2 + 40, W - 10]) {
      ctx.beginPath();
      ctx.arc(x, y + 16, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    k++;
  }
  // Darker edge beams.
  ctx.fillStyle = '#6b4526';
  ctx.fillRect(0, 0, 12, H);
  ctx.fillRect(W - 12, 0, 12, H);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(W / 2 - 4, 40, 8, 180);
  ctx.fillRect(W / 2 - 4, 296, 8, 180);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(22, 22, 5, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
