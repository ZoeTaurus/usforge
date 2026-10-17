// 3D shapes for the other demons. Like the imp, each is built from simple
// painted pieces merged into ONE shape, with legs/arms/head/tail tagged so
// the demon shader can animate them. All face +Z with feet at y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { piece, limb, glow, PART } from './demonShader.js';

const merged = (parts) => { const g = mergeGeometries(parts); g.computeVertexNormals(); return g; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone = (r, h, s = 4) => new THREE.ConeGeometry(r, h, s);
const ico = (r) => new THREE.IcosahedronGeometry(r, 0);

// HELLHOUND: low, lean, black-red, glowing eyes, spiky back. Gallops.
export const HOUND_GORE = [0x2a0e0c, 0x5a1410, 0x9a0a0a, 0xffa020];
export function createHoundGeometry() {
  const BODY = 0x2a0e0c, RED = 0x7a1a12, EYE = glow(0xffb020), BONE = 0xd8cfb8, MOUTH = glow(0xff4010, 0.6);
  const leg = (part, x, z, front) => limb(part, [x, 0.78, z], [
    piece(box(0.16, 0.36, 0.2), BODY, x, 0.6, z + (front ? 0.02 : -0.04)),    // thigh
    piece(box(0.1, 0.36, 0.11), RED, x, 0.27, z + (front ? 0.06 : -0.08)),    // shin
    piece(box(0.14, 0.07, 0.2), BODY, x, 0.04, z + (front ? 0.1 : -0.02)),    // paw
    piece(cone(0.025, 0.08, 3), BONE, x, 0.04, z + (front ? 0.22 : 0.1), Math.PI / 2),
  ]);
  return merged([
    // Body: deep chest, thin waist, spiky back
    piece(box(0.55, 0.5, 0.6), BODY, 0, 0.82, 0.35),
    piece(box(0.42, 0.38, 0.75), BODY, 0, 0.8, -0.3),
    piece(box(0.4, 0.06, 1.2), RED, 0, 1.05, 0.0),                              // red mane stripe
    ...[-0.5, -0.2, 0.1, 0.4].map((z) => piece(cone(0.06, 0.32), RED, 0, 1.18, z, -0.4)),
    ...[-0.25, 0.0, 0.25].map((z) => piece(box(0.46, 0.04, 0.05), RED, 0, 0.7, z)), // ribs showing
    // Legs: back (PART.leg*), front (PART.arm*)
    ...leg(PART.legL, 0.2, -0.5, false), ...leg(PART.legR, -0.2, -0.5, false),
    ...leg(PART.armL, 0.22, 0.45, true), ...leg(PART.armR, -0.22, 0.45, true),
    // Head on a neck: long snout, open jaw with fangs, ears
    ...limb(PART.head, [0, 0.98, 0.6], [
      piece(box(0.26, 0.26, 0.3), BODY, 0, 1.0, 0.72, 0.3),                     // neck
      piece(box(0.42, 0.36, 0.42), BODY, 0, 1.1, 0.95),
      piece(box(0.28, 0.16, 0.42), RED, 0, 1.06, 1.3),                          // snout
      piece(box(0.24, 0.07, 0.36), BODY, 0, 0.92, 1.26, -0.25),                 // lower jaw (open)
      piece(box(0.2, 0.03, 0.3), MOUTH, 0, 0.98, 1.26),
      ...[0.08, -0.08].map((x) => piece(cone(0.035, 0.14), BONE, x, 0.96, 1.46, Math.PI)),
      ...[0.08, -0.08].map((x) => piece(cone(0.03, 0.1), BONE, x, 0.96, 1.4)),
      piece(box(0.09, 0.06, 0.04), EYE, 0.13, 1.2, 1.16),
      piece(box(0.09, 0.06, 0.04), EYE, -0.13, 1.2, 1.16),
      piece(cone(0.07, 0.3), BODY, 0.15, 1.38, 0.88, -0.3),
      piece(cone(0.07, 0.3), BODY, -0.15, 1.38, 0.88, -0.3),
    ]),
    // Tail
    ...limb(PART.tail, [0, 0.92, -0.65], [
      piece(cone(0.07, 0.5), RED, 0, 0.95, -0.9, -1.9),
      piece(cone(0.05, 0.35), RED, 0, 0.98, -1.2, -1.6),
    ]),
  ]);
}

// PINCUSHION: a squat ball of grey-purple flesh bristling with bone spikes
// that twitch and stab outward.
export const SPIKER_GORE = [0x4a3448, 0x6a4a60, 0xe0d6bc, 0x9a0a0a];
export function createSpikerGeometry() {
  const FLESH = 0x5a3a52, DARK = 0x3a2436, BONE = 0xe8dcc0, EYE = glow(0x80ff40), MOUTH = glow(0x80ff40, 0.4);
  const spikes = [];
  for (let n = 0; n < 22; n++) {
    const a = n * 2.399, y = 1 - (n / 21) * 1.7;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const dir = new THREE.Vector3(Math.cos(a) * r, y * 0.8, Math.sin(a) * r).normalize();
    const g = cone(0.07 + (n % 3) * 0.015, 0.5 + (n % 4) * 0.1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    spikes.push(piece(g, BONE, dir.x * 0.85, 0.9 + dir.y * 0.85, dir.z * 0.85));
  }
  return merged([
    piece(ico(0.78), FLESH, 0, 0.9, 0),
    piece(ico(0.5), DARK, 0, 0.75, -0.25),
    piece(box(0.13, 0.09, 0.04), EYE, 0.2, 1.08, 0.72),
    piece(box(0.13, 0.09, 0.04), EYE, -0.2, 1.08, 0.72),
    piece(box(0.09, 0.07, 0.04), EYE, 0, 1.24, 0.66),                            // third eye
    piece(box(0.36, 0.08, 0.05), MOUTH, 0, 0.82, 0.74),
    ...limb(PART.spikes, [0, 0.9, 0], spikes),
    ...limb(PART.legL, [0.32, 0.38, 0], [piece(box(0.2, 0.38, 0.22), DARK, 0.32, 0.2, 0), piece(box(0.24, 0.07, 0.3), DARK, 0.32, 0.03, 0.06)]),
    ...limb(PART.legR, [-0.32, 0.38, 0], [piece(box(0.2, 0.38, 0.22), DARK, -0.32, 0.2, 0), piece(box(0.24, 0.07, 0.3), DARK, -0.32, 0.03, 0.06)]),
    ...limb(PART.armL, [0.6, 0.9, 0.3], [piece(box(0.1, 0.3, 0.1), FLESH, 0.65, 0.76, 0.35), piece(cone(0.04, 0.16, 3), BONE, 0.65, 0.58, 0.38, Math.PI)]),
    ...limb(PART.armR, [-0.6, 0.9, 0.3], [piece(box(0.1, 0.3, 0.1), FLESH, -0.65, 0.76, 0.35), piece(cone(0.04, 0.16, 3), BONE, -0.65, 0.58, 0.38, Math.PI)]),
  ]);
}

// CINDER SPITTER: tall and thin, long neck, glowing fire sac on its belly.
export const SPITTER_GORE = [0x6a2a10, 0xff7a20, 0xffc040, 0x3a1a10];
export function createSpitterGeometry() {
  const SKIN = 0x5a2410, DARK = 0x2a1008, GLOW = glow(0xff8a20), HOT = glow(0xffc040), EYE = glow(0xffee60);
  return merged([
    // Legs: backward-bent like a bird's
    ...[1, -1].flatMap((s) => limb(s > 0 ? PART.legL : PART.legR, [s * 0.16, 0.95, 0], [
      piece(box(0.13, 0.5, 0.15), DARK, s * 0.16, 0.72, 0.06, 0.3),
      piece(box(0.1, 0.5, 0.1), SKIN, s * 0.16, 0.3, -0.02, -0.25),
      piece(box(0.16, 0.06, 0.24), DARK, s * 0.16, 0.03, 0.04),
    ])),
    // Body with the glowing fire sac
    piece(box(0.5, 0.6, 0.42), SKIN, 0, 1.2, 0),
    piece(ico(0.3), GLOW, 0, 1.08, 0.2),
    piece(ico(0.16), HOT, 0, 1.08, 0.36),
    ...[-0.12, 0, 0.12].map((x) => piece(cone(0.04, 0.2), DARK, x, 1.55, -0.2, -0.6)),
    // Thin arms
    ...[1, -1].flatMap((s) => limb(s > 0 ? PART.armL : PART.armR, [s * 0.3, 1.42, 0.05], [
      piece(box(0.08, 0.42, 0.08), SKIN, s * 0.33, 1.2, 0.08),
      piece(box(0.06, 0.3, 0.06), DARK, s * 0.34, 0.9, 0.12),
      piece(cone(0.025, 0.12, 3), DARK, s * 0.34, 0.72, 0.14, Math.PI),
    ])),
    // Long neck + head (lunges forward to spit)
    ...limb(PART.head, [0, 1.45, 0.08], [
      piece(box(0.15, 0.6, 0.15), SKIN, 0, 1.72, 0.2, 0.4),
      piece(box(0.32, 0.26, 0.44), SKIN, 0, 2.06, 0.42),
      piece(box(0.22, 0.12, 0.14), GLOW, 0, 1.97, 0.64),                       // glowing mouth
      piece(box(0.07, 0.06, 0.04), EYE, 0.1, 2.15, 0.63),
      piece(box(0.07, 0.06, 0.04), EYE, -0.1, 2.15, 0.63),
      piece(cone(0.05, 0.3), DARK, 0.1, 2.28, 0.3, -0.7),
      piece(cone(0.05, 0.3), DARK, -0.1, 2.28, 0.3, -0.7),
    ]),
  ]);
}

// ASH BRUTE: 2.8 m of grey muscle with glowing lava cracks and huge fists.
export const BRUTE_GORE = [0x55504c, 0x3a3634, 0xff6a20, 0x9a0a0a];
export function createBruteGeometry(colors = {}, extra = {}) {
  const { ASH, DARK, LAVA, HORN, EYE } = { ASH: 0x5a5450, DARK: 0x3a3432, LAVA: 0xff6a20, HORN: 0x1a1414, EYE: 0xffd040, ...colors };
  const lava = glow(LAVA), eye = glow(EYE);
  return merged([
    // Legs (thick, bowed)
    ...[1, -1].flatMap((s) => limb(s > 0 ? PART.legL : PART.legR, [s * 0.42, 1.05, 0], [
      piece(box(0.5, 0.55, 0.55), DARK, s * 0.44, 0.78, 0),
      piece(box(0.42, 0.5, 0.45), ASH, s * 0.46, 0.3, 0.02),
      piece(box(0.5, 0.12, 0.62), DARK, s * 0.46, 0.06, 0.08),
    ])),
    // Torso: hunched, with lava cracks
    piece(box(1.5, 1.2, 0.95), ASH, 0, 1.65, 0),
    piece(box(1.1, 0.5, 0.8), ASH, 0, 2.2, -0.1),                                // hunch
    piece(box(1.2, 0.08, 0.97), lava, 0, 1.5, 0),
    piece(box(0.08, 0.9, 0.97), lava, 0.2, 1.75, 0),
    piece(box(0.5, 0.08, 0.97), lava, -0.35, 1.95, 0),
    ...[-0.35, 0, 0.35].map((x) => piece(cone(0.1, 0.4), HORN, x, 2.5, -0.35, -0.6)),  // back spikes
    ...(extra.body || []),
    // Head (low between the shoulders)
    ...limb(PART.head, [0, 2.2, 0.15], [
      piece(box(0.7, 0.55, 0.6), ASH, 0, 2.45, 0.25),
      piece(box(0.6, 0.15, 0.3), DARK, 0, 2.3, 0.48),                            // jaw
      ...[0.18, -0.18].map((x) => piece(cone(0.06, 0.2), 0xe0d6bc, x, 2.45, 0.6)),     // tusks
      piece(box(0.13, 0.08, 0.04), eye, 0.16, 2.52, 0.56), piece(box(0.13, 0.08, 0.04), eye, -0.16, 2.52, 0.56),
      piece(cone(0.12, 0.6), HORN, 0.35, 2.85, 0.15, 0, 0, -0.7), piece(cone(0.12, 0.6), HORN, -0.35, 2.85, 0.15, 0, 0, 0.7),
      ...(extra.head || []),
    ]),
    // Arms: huge, hanging down to the knees, with fists
    ...[1, -1].flatMap((s) => limb(s > 0 ? PART.armL : PART.armR, [s * 0.88, 2.05, 0.05], [
      piece(ico(0.36), DARK, s * 0.9, 2.05, 0.05),                              // shoulder
      piece(box(0.42, 0.7, 0.45), ASH, s * 0.98, 1.65, 0.1),
      piece(box(0.36, 0.6, 0.4), ASH, s * 1.0, 1.15, 0.2),
      piece(box(0.6, 0.55, 0.6), DARK, s * 1.0, 0.75, 0.3),                     // fist
      ...(extra.fist ? extra.fist(s) : []),
    ])),
  ]);
}

// MAGMA BRUTE (Lava Rivers): basalt brute with molten fists and a little
// volcano smoking on each shoulder.
export const MAGMA_BRUTE_GORE = [0x221e1e, 0x120f0f, 0xff7a10, 0xffd040];
export function createMagmaBruteGeometry() {
  const LAVA = glow(0xff7a10), HOT = glow(0xffc030), ROCK = 0x1c1818;
  return createBruteGeometry({ ASH: 0x262222, DARK: 0x141111, LAVA: 0xff7a10, HORN: 0x2a1418, EYE: 0xfff070 }, {
    fist: (s) => [piece(box(0.62, 0.2, 0.62), HOT, s * 1.0, 0.55, 0.3)],
    body: [
      piece(cone(0.35, 0.6, 6), ROCK, 0.6, 2.55, -0.25), piece(cone(0.35, 0.6, 6), ROCK, -0.6, 2.55, -0.25),
      piece(box(0.14, 0.08, 0.14), HOT, 0.6, 2.85, -0.25), piece(box(0.14, 0.08, 0.14), HOT, -0.6, 2.85, -0.25),
      piece(box(0.08, 0.08, 0.97), LAVA, -0.4, 1.9, 0), piece(box(1.0, 0.08, 0.97), LAVA, 0.1, 2.05, 0),
    ],
  });
}
