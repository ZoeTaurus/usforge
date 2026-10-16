// The imp's 3D shape, built from simple pieces and merged into ONE shape so
// that 100 imps can be drawn in a single go (an "instanced mesh").
// Faces +Z, feet at y = 0, about 1.4 m tall.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const RED = 0xc8281c;
const DARK = 0x7a120c;
const BONE = 0xe8dcc0;
const EYE = 0xffe040;
const CLAW = 0x1a1010;

// Paint one piece a solid color and move it into place.
export function piece(geometry, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

// colors: optional repaint ({ RED, DARK, BONE, EYE, CLAW }); extra: more pieces.
export function createImpGeometry(colors = {}, extra = []) {
  const { RED, DARK, BONE, EYE, CLAW } = { ...IMP_COLORS, ...colors };
  const parts = [
    // Pot belly + chest
    piece(new THREE.IcosahedronGeometry(0.42, 0), RED, 0, 0.72, 0),
    piece(new THREE.BoxGeometry(0.5, 0.3, 0.35), DARK, 0, 0.98, -0.02),
    // Big head
    piece(new THREE.BoxGeometry(0.5, 0.42, 0.44), RED, 0, 1.3, 0.05),
    // Horns
    piece(new THREE.ConeGeometry(0.07, 0.38, 4), BONE, 0.18, 1.62, 0.02, 0, 0, -0.5),
    piece(new THREE.ConeGeometry(0.07, 0.38, 4), BONE, -0.18, 1.62, 0.02, 0, 0, 0.5),
    // Glowing eyes + grin
    piece(new THREE.BoxGeometry(0.11, 0.07, 0.04), EYE, 0.12, 1.36, 0.28),
    piece(new THREE.BoxGeometry(0.11, 0.07, 0.04), EYE, -0.12, 1.36, 0.28),
    piece(new THREE.BoxGeometry(0.26, 0.04, 0.04), CLAW, 0, 1.2, 0.28),
    // Stubby legs
    piece(new THREE.BoxGeometry(0.14, 0.4, 0.16), DARK, 0.16, 0.2, 0),
    piece(new THREE.BoxGeometry(0.14, 0.4, 0.16), DARK, -0.16, 0.2, 0),
    // Arms reaching forward, with claws
    piece(new THREE.BoxGeometry(0.1, 0.1, 0.45), RED, 0.36, 0.95, 0.18, -0.3),
    piece(new THREE.BoxGeometry(0.1, 0.1, 0.45), RED, -0.36, 0.95, 0.18, -0.3),
    piece(new THREE.ConeGeometry(0.06, 0.18, 4), CLAW, 0.36, 1.04, 0.45, Math.PI / 2),
    piece(new THREE.ConeGeometry(0.06, 0.18, 4), CLAW, -0.36, 1.04, 0.45, Math.PI / 2),
    // Pointy tail
    piece(new THREE.ConeGeometry(0.05, 0.6, 4), DARK, 0, 0.6, -0.5, -2.0),
    piece(new THREE.ConeGeometry(0.1, 0.16, 3), DARK, 0, 0.4, -0.78, -2.6),
    ...extra,
  ];
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

const IMP_COLORS = { RED, DARK, BONE, EYE, CLAW };

// FIRE IMP (Lava Rivers): charred black skin, glowing cracks and a head on fire.
export const FIRE_IMP_GORE = [0x2a1210, 0xff6a10, 0xffc040, 0x1a0a08];
export function createFireImpGeometry() {
  const FIRE = 0xff7a10, HOT = 0xffd040;
  return createImpGeometry({ RED: 0x2a1410, DARK: 0x160a08, BONE: 0xff8a20, EYE: 0xfff070, CLAW: 0xff5010 }, [
    piece(new THREE.ConeGeometry(0.2, 0.5, 5), FIRE, 0, 1.7, 0.0),         // flaming hair
    piece(new THREE.ConeGeometry(0.12, 0.38, 4), HOT, 0.12, 1.66, 0.08, 0, 0, -0.3),
    piece(new THREE.ConeGeometry(0.12, 0.34, 4), HOT, -0.12, 1.64, 0.06, 0, 0, 0.3),
    piece(new THREE.BoxGeometry(0.44, 0.05, 0.37), FIRE, 0, 0.8, 0),       // glowing belly crack
    piece(new THREE.ConeGeometry(0.1, 0.25, 4), FIRE, 0, 0.32, -0.86, -2.6), // burning tail tip
  ]);
}

// Colors used for the gore chunks when an imp splats.
export const IMP_GORE_COLORS = [RED, DARK, 0x9a0a0a, BONE];
