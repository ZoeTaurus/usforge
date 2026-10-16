// 3D shapes for the Ash Plains demons (besides the imp). Each is built from
// simple painted pieces and merged into ONE shape so many copies can be
// drawn at once. All face +Z with their feet at y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { piece } from './impModel.js';

const merged = (parts) => { const g = mergeGeometries(parts); g.computeVertexNormals(); return g; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone = (r, h, s = 4) => new THREE.ConeGeometry(r, h, s);

// HELLHOUND: low, long, black-red, glowing eyes, spiky back. ~1 m tall.
export const HOUND_GORE = [0x2a0e0c, 0x5a1410, 0x9a0a0a, 0xffa020];
export function createHoundGeometry() {
  const BODY = 0x2a0e0c, RED = 0x7a1a12, EYE = 0xffb020, BONE = 0xd8cfb8;
  return merged([
    piece(box(0.5, 0.45, 1.3), BODY, 0, 0.75, 0),                 // body
    piece(box(0.45, 0.4, 0.55), BODY, 0, 0.95, 0.75, 0.25),        // head
    piece(box(0.3, 0.18, 0.4), RED, 0, 0.82, 1.05),                // snout
    piece(cone(0.04, 0.16), BONE, 0.08, 0.72, 1.18, Math.PI),      // fangs
    piece(cone(0.04, 0.16), BONE, -0.08, 0.72, 1.18, Math.PI),
    piece(box(0.08, 0.06, 0.04), EYE, 0.13, 1.05, 1.0),
    piece(box(0.08, 0.06, 0.04), EYE, -0.13, 1.05, 1.0),
    piece(cone(0.06, 0.25), BODY, 0.15, 1.25, 0.65),               // ears
    piece(cone(0.06, 0.25), BODY, -0.15, 1.25, 0.65),
    ...[-0.4, -0.1, 0.2].map((z) => piece(cone(0.07, 0.3), RED, 0, 1.1, z)), // back spikes
    ...[[0.18, 0.45], [-0.18, 0.45], [0.18, -0.45], [-0.18, -0.45]].map(([x, z]) => piece(box(0.12, 0.6, 0.14), BODY, x, 0.3, z)),
    piece(cone(0.06, 0.6), RED, 0, 0.85, -0.85, -1.9),             // tail
  ]);
}

// PINCUSHION: a squat ball of grey-purple flesh bristling with bone spikes.
export const SPIKER_GORE = [0x4a3448, 0x6a4a60, 0xe0d6bc, 0x9a0a0a];
export function createSpikerGeometry() {
  const FLESH = 0x5a3a52, BONE = 0xe8dcc0, EYE = 0x80ff40;
  const parts = [
    piece(new THREE.IcosahedronGeometry(0.75, 0), FLESH, 0, 0.85, 0),
    piece(box(0.12, 0.08, 0.04), EYE, 0.18, 1.0, 0.68),
    piece(box(0.12, 0.08, 0.04), EYE, -0.18, 1.0, 0.68),
    piece(box(0.18, 0.4, 0.2), FLESH, 0.3, 0.2, 0), piece(box(0.18, 0.4, 0.2), FLESH, -0.3, 0.2, 0),
  ];
  // Spikes pointing out in every direction (front ones are the nasty ones)
  for (let n = 0; n < 16; n++) {
    const a = n * 2.399, y = 1 - (n / 15) * 1.6;       // spread around a sphere
    const r = Math.sqrt(1 - y * y);
    const dir = new THREE.Vector3(Math.cos(a) * r, y * 0.8, Math.sin(a) * r).normalize();
    const g = cone(0.08, 0.6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    parts.push(piece(g, BONE, dir.x * 0.85, 0.85 + dir.y * 0.85, dir.z * 0.85));
  }
  return merged(parts);
}

// CINDER SPITTER: tall and thin, long neck, glowing fire sac on its belly.
export const SPITTER_GORE = [0x6a2a10, 0xff7a20, 0xffc040, 0x3a1a10];
export function createSpitterGeometry() {
  const SKIN = 0x5a2410, GLOW = 0xff8a20, DARK = 0x2a1008, EYE = 0xffee60;
  return merged([
    piece(box(0.14, 0.9, 0.16), DARK, 0.15, 0.45, 0), piece(box(0.14, 0.9, 0.16), DARK, -0.15, 0.45, 0), // legs
    piece(box(0.5, 0.6, 0.4), SKIN, 0, 1.15, 0),                   // body
    piece(new THREE.IcosahedronGeometry(0.28, 0), GLOW, 0, 1.05, 0.22), // fire sac
    piece(box(0.16, 0.7, 0.16), SKIN, 0, 1.75, 0.15, 0.4),         // neck
    piece(box(0.32, 0.26, 0.42), SKIN, 0, 2.1, 0.4),               // head
    piece(box(0.22, 0.12, 0.12), GLOW, 0, 2.02, 0.62),             // glowing mouth
    piece(box(0.06, 0.06, 0.04), EYE, 0.1, 2.2, 0.6), piece(box(0.06, 0.06, 0.04), EYE, -0.1, 2.2, 0.6),
    piece(box(0.08, 0.5, 0.08), SKIN, 0.32, 1.2, 0.1, 0.3), piece(box(0.08, 0.5, 0.08), SKIN, -0.32, 1.2, 0.1, 0.3), // thin arms
  ]);
}

// ASH BRUTE: 2.8 m of grey muscle with glowing lava cracks and huge fists.
export const BRUTE_GORE = [0x55504c, 0x3a3634, 0xff6a20, 0x9a0a0a];
export function createBruteGeometry(colors = {}, extra = []) {
  const { ASH, DARK, LAVA, HORN, EYE } = { ASH: 0x5a5450, DARK: 0x3a3432, LAVA: 0xff6a20, HORN: 0x1a1414, EYE: 0xffd040, ...colors };
  return merged([
    piece(box(0.45, 1.0, 0.5), DARK, 0.4, 0.5, 0), piece(box(0.45, 1.0, 0.5), DARK, -0.4, 0.5, 0), // legs
    piece(box(1.5, 1.2, 0.95), ASH, 0, 1.65, 0),                    // torso
    piece(box(1.2, 0.08, 0.97), LAVA, 0, 1.5, 0), piece(box(0.08, 0.9, 0.97), LAVA, 0.2, 1.75, 0), // lava cracks
    piece(box(0.7, 0.55, 0.6), ASH, 0, 2.45, 0.2),                  // head (hunched forward)
    piece(box(0.12, 0.07, 0.04), EYE, 0.16, 2.5, 0.52), piece(box(0.12, 0.07, 0.04), EYE, -0.16, 2.5, 0.52),
    piece(cone(0.12, 0.6), HORN, 0.35, 2.85, 0.15, 0, 0, -0.7), piece(cone(0.12, 0.6), HORN, -0.35, 2.85, 0.15, 0, 0, 0.7),
    piece(box(0.4, 1.1, 0.45), ASH, 0.95, 1.55, 0.2, -0.3), piece(box(0.4, 1.1, 0.45), ASH, -0.95, 1.55, 0.2, -0.3), // arms
    piece(box(0.6, 0.55, 0.6), DARK, 0.95, 0.95, 0.45), piece(box(0.6, 0.55, 0.6), DARK, -0.95, 0.95, 0.45),        // fists
    ...extra,
  ]);
}

// MAGMA BRUTE (Lava Rivers): a basalt brute with molten fists and a
// little volcano smoking on each shoulder.
export const MAGMA_BRUTE_GORE = [0x221e1e, 0x120f0f, 0xff7a10, 0xffd040];
export function createMagmaBruteGeometry() {
  const LAVA = 0xff7a10, HOT = 0xffc030, ROCK = 0x1c1818;
  return createBruteGeometry({ ASH: 0x262222, DARK: 0x141111, LAVA, HORN: 0x2a1418, EYE: 0xfff070 }, [
    piece(box(0.62, 0.2, 0.62), HOT, 0.95, 0.75, 0.45), piece(box(0.62, 0.2, 0.62), HOT, -0.95, 0.75, 0.45), // molten fists
    piece(cone(0.35, 0.6, 6), ROCK, 0.6, 2.5, -0.2), piece(cone(0.35, 0.6, 6), ROCK, -0.6, 2.5, -0.2),       // shoulder volcanoes
    piece(box(0.14, 0.08, 0.14), HOT, 0.6, 2.8, -0.2), piece(box(0.14, 0.08, 0.14), HOT, -0.6, 2.8, -0.2),
    piece(box(0.08, 0.08, 0.97), LAVA, -0.4, 1.9, 0), piece(box(1.0, 0.08, 0.97), LAVA, 0.1, 2.05, 0),        // more cracks
  ]);
}
