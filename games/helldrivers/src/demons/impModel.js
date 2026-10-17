// The imp (and its Lava Rivers cousin, the fire imp). Built from simple
// painted pieces and merged into ONE shape so 100+ imps can be drawn in a
// single go. Legs, arms, head, tail and wings are tagged as body parts so
// the demon shader can animate them (see demonShader.js).
// Faces +Z, feet at y = 0, about 1.5 m tall.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { piece, limb, glow, PART } from './demonShader.js';

export { piece };

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone = (r, h, s = 4) => new THREE.ConeGeometry(r, h, s);
const ico = (r) => new THREE.IcosahedronGeometry(r, 0);

const IMP_COLORS = { SKIN: 0xc8281c, DARK: 0x7a120c, BELLY: 0xe0603a, BONE: 0xe8dcc0, EYE: 0xffe040, CLAW: 0x1a1010, WING: 0x5a0c0a };

// A wing: a thin fan of skin between bony fingers, hinged at the shoulder blade.
function wing(side, C) {
  const s = side; // +1 = left (+x), -1 = right
  const tri = [
    0, 0, 0, s * 0.55, 0.35, -0.05, s * 0.45, -0.1, -0.12,
    0, 0, 0, s * 0.45, -0.1, -0.12, s * 0.2, -0.25, -0.1,
  ];
  const back = []; // same triangles, other way round, so the wing has two sides
  for (let i = 0; i < tri.length; i += 9) back.push(...tri.slice(i, i + 3), ...tri.slice(i + 6, i + 9), ...tri.slice(i + 3, i + 6));
  const membrane = new THREE.BufferGeometry();
  membrane.setAttribute('position', new THREE.Float32BufferAttribute([...tri, ...back], 3));
  membrane.computeVertexNormals();
  const parts = [
    piece(membrane, C.WING, s * 0.12, 1.12, -0.22),
    piece(cone(0.025, 0.6, 3), C.DARK, s * 0.38, 1.27, -0.25, 0, 0, -s * 0.95), // wing bone
  ];
  return limb(s > 0 ? PART.wingL : PART.wingR, [s * 0.12, 1.12, -0.22], parts);
}

// colors: optional repaint; extra: { head: [...], body: [...] } more pieces.
export function createImpGeometry(colors = {}, extra = {}) {
  const C = { ...IMP_COLORS, ...colors };
  const eye = glow(C.EYE);
  const parts = [
    // Body: pot belly, chest, little spine ridge
    piece(ico(0.42), C.SKIN, 0, 0.74, 0),
    piece(ico(0.3), C.BELLY, 0, 0.7, 0.16),
    piece(box(0.52, 0.3, 0.36), C.DARK, 0, 1.0, -0.02),
    ...[0.85, 1.0, 1.12].map((y) => piece(cone(0.05, 0.14), C.BONE, 0, y, -0.3, -1.2)),
    ...(extra.body || []),
    // Legs (hip joints), with clawed feet
    ...[1, -1].flatMap((s) => limb(s > 0 ? PART.legL : PART.legR, [s * 0.16, 0.46, 0], [
      piece(box(0.16, 0.24, 0.18), C.DARK, s * 0.16, 0.34, 0.02),
      piece(box(0.12, 0.24, 0.13), C.SKIN, s * 0.16, 0.14, -0.02),
      piece(box(0.17, 0.07, 0.26), C.DARK, s * 0.16, 0.035, 0.06),
      piece(cone(0.03, 0.1), C.CLAW, s * 0.12, 0.04, 0.22, Math.PI / 2),
      piece(cone(0.03, 0.1), C.CLAW, s * 0.2, 0.04, 0.22, Math.PI / 2),
    ])),
    // Arms (shoulder joints), long and wiry, with claws
    ...[1, -1].flatMap((s) => limb(s > 0 ? PART.armL : PART.armR, [s * 0.32, 1.06, 0], [
      piece(ico(0.08), C.SKIN, s * 0.32, 1.06, 0),
      piece(box(0.1, 0.34, 0.1), C.SKIN, s * 0.36, 0.88, 0.02),
      piece(box(0.09, 0.3, 0.09), C.DARK, s * 0.38, 0.62, 0.06),
      piece(box(0.12, 0.08, 0.12), C.SKIN, s * 0.38, 0.45, 0.08),
      ...[-0.04, 0.0, 0.04].map((dx) => piece(cone(0.022, 0.16, 3), C.CLAW, s * 0.38 + dx, 0.36, 0.12, 0.35)),
    ])),
    // Head (neck joint): big head, horns, pointy ears, glowing eyes, toothy grin
    ...limb(PART.head, [0, 1.14, 0.02], [
      piece(box(0.5, 0.42, 0.44), C.SKIN, 0, 1.34, 0.05),
      piece(box(0.3, 0.12, 0.12), C.DARK, 0, 1.42, 0.27),           // brow
      piece(box(0.2, 0.12, 0.12), C.SKIN, 0, 1.26, 0.3),            // snout
      piece(cone(0.07, 0.4), C.BONE, 0.18, 1.66, 0.02, 0, 0, -0.5),
      piece(cone(0.07, 0.4), C.BONE, -0.18, 1.66, 0.02, 0, 0, 0.5),
      piece(cone(0.06, 0.28, 3), C.SKIN, 0.3, 1.42, -0.02, 0, 0, -1.2),  // ears
      piece(cone(0.06, 0.28, 3), C.SKIN, -0.3, 1.42, -0.02, 0, 0, 1.2),
      piece(box(0.12, 0.07, 0.04), eye, 0.12, 1.37, 0.28),
      piece(box(0.12, 0.07, 0.04), eye, -0.12, 1.37, 0.28),
      piece(box(0.3, 0.07, 0.04), C.CLAW, 0, 1.18, 0.28),           // mouth
      ...[-0.1, -0.03, 0.04, 0.11].map((x) => piece(cone(0.02, 0.06, 3), C.BONE, x, 1.2, 0.29, Math.PI)),
      ...(extra.head || []),
    ]),
    // Tail (wags): segments ending in a spade
    ...limb(PART.tail, [0, 0.62, -0.32], [
      piece(cone(0.06, 0.45, 4), C.DARK, 0, 0.56, -0.5, -2.0),
      piece(cone(0.045, 0.4, 4), C.DARK, 0, 0.4, -0.8, -2.4),
      piece(cone(0.11, 0.18, 3), C.DARK, 0, 0.3, -1.0, -2.8),
    ]),
    // Little bat wings
    ...wing(1, C), ...wing(-1, C),
  ];
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

// Colors used for the gore chunks when an imp splats.
export const IMP_GORE_COLORS = [IMP_COLORS.SKIN, IMP_COLORS.DARK, 0x9a0a0a, IMP_COLORS.BONE];

// FIRE IMP (Lava Rivers): charred black skin, glowing cracks and a head on fire.
export const FIRE_IMP_GORE = [0x2a1210, 0xff6a10, 0xffc040, 0x1a0a08];
export function createFireImpGeometry() {
  const FIRE = glow(0xff7a10), HOT = glow(0xffd040);
  return createImpGeometry(
    { SKIN: 0x2a1410, DARK: 0x160a08, BELLY: 0x3a1a10, BONE: 0xff8a20, EYE: 0xfff070, CLAW: 0xff5010, WING: 0x2a0a06 },
    {
      head: [
        piece(cone(0.22, 0.55, 5), FIRE, 0, 1.72, 0.0),
        piece(cone(0.12, 0.4, 4), HOT, 0.12, 1.68, 0.08, 0, 0, -0.3),
        piece(cone(0.12, 0.36, 4), HOT, -0.12, 1.66, 0.06, 0, 0, 0.3),
      ],
      body: [
        piece(box(0.46, 0.05, 0.38), FIRE, 0, 0.8, 0.02),       // glowing belly cracks
        piece(box(0.05, 0.3, 0.38), FIRE, 0.1, 0.95, 0.02),
      ],
    });
}
