// DEMON ANIMATION, done on the graphics card.
//
// Every demon type is ONE merged shape drawn many times at once (an
// instanced mesh). To still give them moving legs, swinging arms, nodding
// heads, wagging tails and flapping wings, each vertex of the shape knows
// which body part it belongs to (aPart) and where that part's joint is
// (aPivot). The vertex shader swings each part around its joint, using a
// few numbers per demon (iAnim): walk phase, how fast it moves, attack
// lunge, and hit flash. Glowing bits (eyes, lava, fire) get aGlow.
//
// All demon types share one shader program (compiled once), and the shadow
// pass uses the same animation so shadows move with the limbs.
import * as THREE from 'three';
import { GFX } from '../core/graphics.js';

// Body parts
export const PART = { body: 0, legL: 1, legR: 2, armL: 3, armR: 4, head: 5, tail: 6, wingL: 7, wingR: 8, spikes: 9 };
// Animation styles (per demon type)
export const STYLE = { waddle: 0, gallop: 1, stomp: 2, sway: 3, roll: 4 };

// Shared clock for every demon material.
export const demonTime = { value: 0 };

const VERTEX_HEAD = /* glsl */`
uniform float uTime;
uniform float uStyle;
attribute float aPart;
attribute vec3 aPivot;
attribute float aGlow;
attribute vec4 iAnim; // walk phase, moving 0..1, attack 0..1, hit flash 0..1
varying float vGlow;
varying float vFlash;
mat3 rotX(float a) { float s = sin(a), c = cos(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rotY(float a) { float s = sin(a), c = cos(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rotZ(float a) { float s = sin(a), c = cos(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
mat3 demonPose(int part) {
  float ph = iAnim.x, mv = iAnim.y, atk = iAnim.z;
  float t = uTime + float(gl_InstanceID) * 1.618;
  float idle = 1. - mv;
  float s = sin(ph);
  if (part == 0) return mat3(1.);
  if (part == 7 || part == 8) { // wings: flap (faster when running)
    float side = part == 7 ? 1. : -1.;
    return rotZ(side * (0.35 + sin(t * (5. + mv * 9.)) * (0.35 + mv * 0.25)));
  }
  if (uStyle < 0.5) { // WADDLE: imps
    if (part == 1) return rotX(s * 0.75 * mv);
    if (part == 2) return rotX(-s * 0.75 * mv);
    if (part == 3) return rotX(-s * 0.6 * mv - atk * 1.9 + sin(t * 2.1) * 0.12 * idle) * rotZ(0.15 + atk * 0.3);
    if (part == 4) return rotX(s * 0.6 * mv - atk * 1.6 + sin(t * 2.1 + 1.) * 0.12 * idle) * rotZ(-0.15 - atk * 0.3);
    if (part == 5) return rotX(sin(ph * 2.) * 0.08 * mv + atk * 0.35 + sin(t * 0.8) * 0.05) * rotZ(sin(t * 0.55) * 0.22 * idle);
    if (part == 6) return rotY(sin(t * 3.) * 0.45 + s * 0.3 * mv);
  } else if (uStyle < 1.5) { // GALLOP: hounds (arms = front legs)
    float g = ph * 1.1;
    if (part == 1) return rotX(sin(g) * 0.85 * mv);
    if (part == 2) return rotX(sin(g + 0.5) * 0.85 * mv);
    if (part == 3) return rotX(-sin(g) * 0.85 * mv - atk * 0.5);
    if (part == 4) return rotX(-sin(g + 0.5) * 0.85 * mv - atk * 0.5);
    if (part == 5) return rotX(atk * 0.55 - sin(g * 2.) * 0.1 * mv + sin(t * 1.3) * 0.05 * idle) * rotY(sin(t * 0.6) * 0.3 * idle);
    if (part == 6) return rotY(sin(t * (4. + mv * 8.)) * 0.5) * rotX(-0.3 * mv);
  } else if (uStyle < 2.5) { // STOMP: brutes
    if (part == 1) return rotX(s * 0.45 * mv);
    if (part == 2) return rotX(-s * 0.45 * mv);
    float punch = atk * atk;
    if (part == 3) return rotX(-s * 0.35 * mv - punch * 1.7 + sin(t * 1.2) * 0.06 * idle) * rotZ(0.1);
    if (part == 4) return rotX(s * 0.35 * mv - punch * 1.7 + sin(t * 1.2 + 2.) * 0.06 * idle) * rotZ(-0.1);
    if (part == 5) return rotY(sin(t * 0.4) * 0.35 * idle) * rotX(punch * 0.3);
  } else if (uStyle < 3.5) { // SWAY: spitters (long neck spits forward)
    if (part == 1) return rotX(s * 0.6 * mv);
    if (part == 2) return rotX(-s * 0.6 * mv);
    if (part == 3) return rotX(-0.3 - atk * 0.8 + sin(t * 1.7) * 0.15) * rotZ(0.3);
    if (part == 4) return rotX(-0.3 - atk * 0.8 + sin(t * 1.7 + 1.5) * 0.15) * rotZ(-0.3);
    if (part == 5) return rotX(atk * 0.9 - 0.15 + sin(t * 1.3) * 0.12) * rotY(sin(t * 0.7) * 0.35);
  } else { // ROLL: pincushions waddle on stubby legs
    if (part == 1) return rotX(s * 0.9 * mv);
    if (part == 2) return rotX(-s * 0.9 * mv);
    if (part == 3) return rotX(-s * 0.5 * mv - atk * 1.2);
    if (part == 4) return rotX(s * 0.5 * mv - atk * 1.2);
  }
  return mat3(1.);
}
vec3 demonMove(vec3 v, bool isNormal) {
  int part = int(aPart + 0.5);
  float t = uTime + float(gl_InstanceID) * 1.618;
  if (part == 9) { // spikes bristle (and stab out when attacking)
    return isNormal ? v : aPivot + (v - aPivot) * (1. + 0.07 * sin(t * 4.) + iAnim.z * 0.25);
  }
  mat3 R = demonPose(part);
  vec3 o = isNormal ? R * v : R * (v - aPivot) + aPivot;
  // breathing
  if (!isNormal) o.y *= 1. + 0.025 * sin(t * 2.3) * (1. - iAnim.y);
  return o;
}
`;

function inject(shader, uniforms, depthOnly) {
  shader.uniforms.uTime = uniforms.uTime;
  shader.uniforms.uStyle = uniforms.uStyle;
  shader.uniforms.uGlow = uniforms.uGlow;
  shader.vertexShader = VERTEX_HEAD + shader.vertexShader
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = demonMove(transformed, false);\n  vGlow = aGlow;\n  vFlash = iAnim.w;');
  if (!depthOnly) {
    shader.vertexShader = shader.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = demonMove(objectNormal, true);');
    shader.fragmentShader = 'uniform float uGlow;\nvarying float vGlow;\nvarying float vFlash;\n' + shader.fragmentShader
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vGlow * uGlow + vec3(1., 0.85, 0.7) * vFlash * 0.9;');
  }
}

// Material + matching shadow material for one demon type.
export function createDemonMaterials(style) {
  const uniforms = { uTime: demonTime, uStyle: { value: style }, uGlow: { value: GFX.glow } };
  const params = { vertexColors: true, flatShading: true };
  const material = GFX.lambert ? new THREE.MeshLambertMaterial(params) : new THREE.MeshStandardMaterial({ ...params, roughness: 0.75 });
  material.onBeforeCompile = (shader) => inject(shader, uniforms, false);
  material.customProgramCacheKey = () => 'demon-anim';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (shader) => inject(shader, uniforms, true);
  depth.customProgramCacheKey = () => 'demon-anim-depth';
  return { material, depth };
}

// ---------------------------------------------------------------- building
// Paint one piece a solid color and move it into place. `color` can be a
// number, or glow(number) for parts that shine (eyes, lava, fire).
export function piece(geometry, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
  g.translate(x, y, z);
  const shine = typeof color === 'object' ? color.glow : 0;
  const c = new THREE.Color(typeof color === 'object' ? color.color : color);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aPivot', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(shine), 1));
  g.deleteAttribute('uv');
  return g;
}

export const glow = (color, amount = 1) => ({ color, glow: amount });

// Mark pieces as one moving body part that swings around `pivot`.
export function limb(part, pivot, pieces) {
  for (const g of pieces) {
    const n = g.attributes.position.count;
    g.attributes.aPart.array.fill(part);
    for (let i = 0; i < n; i++) g.attributes.aPivot.array.set(pivot, i * 3);
  }
  return pieces;
}
