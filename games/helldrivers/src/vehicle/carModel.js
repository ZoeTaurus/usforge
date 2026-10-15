// The car's 3D model, built from simple shapes (no art files).
// Forward is +Z. The origin is the center of the physics box.
//
//   root          follows the physics body
//   ├─ body       leans in turns / dips when braking (visual wobble)
//   │   └─ turret → yaw → pitch → barrels, muzzle
//   └─ wheels     stay planted on the ground
import * as THREE from 'three';

export const CAR_DIMENSIONS = {
  halfWidth: 0.95,
  halfHeight: 0.45,
  halfLength: 2.1,
  wheelRadius: 0.45,
};

const COLORS = {
  paint: 0x3a66d0,   // patriotic blue
  stripe: 0xf2f0ea,  // white
  accent: 0xc8202a,  // red
  glass: 0x0d1015,
  metal: 0x5a5d63,
  dark: 0x1a1a1c,
  tire: 0x161616,
  headlight: 0xfff2b0,
  taillight: 0xff2010,
};

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, metalness: 0.1, ...extra });

// A box whose top face is shrunk/shifted, for wedge-y low-poly shapes.
function taperedBox(w, h, l, topScaleX = 1, topScaleZ = 1, topShiftZ = 0) {
  const g = new THREE.BoxGeometry(w, h, l);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * topScaleX);
      p.setZ(i, p.getZ(i) * topScaleZ + topShiftZ);
    }
  }
  g.computeVertexNormals();
  return g;
}

function add(parent, geometry, material, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  parent.add(m);
  return m;
}

export function createCarModel() {
  const M = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, mat(v)]));
  M.glass.roughness = 0.2;
  M.metal.metalness = 0.6;
  M.headlight = mat(COLORS.headlight, { emissive: COLORS.headlight, emissiveIntensity: 1.5 });
  M.taillight = mat(COLORS.taillight, { emissive: COLORS.taillight, emissiveIntensity: 1.2 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // --- Chassis ---
  add(body, taperedBox(1.9, 0.5, 4.2, 0.98, 0.97), M.paint, 0, 0.15, 0);
  add(body, taperedBox(1.8, 0.16, 1.4, 0.95, 0.9, -0.05), M.paint, 0, 0.48, 1.35);          // hood
  add(body, new THREE.BoxGeometry(0.5, 0.18, 0.5), M.dark, 0, 0.6, 1.3);                   // hood scoop
  add(body, taperedBox(1.7, 0.5, 2.0, 0.85, 0.6, -0.15), M.glass, 0, 0.65, -0.3);          // cabin glass
  add(body, new THREE.BoxGeometry(1.42, 0.08, 1.15), M.paint, 0, 0.94, -0.42);             // roof
  add(body, taperedBox(1.8, 0.14, 0.9, 0.95, 0.8, 0.05), M.paint, 0, 0.47, -1.7);          // trunk
  add(body, new THREE.BoxGeometry(1.9, 0.08, 0.3), M.dark, 0, 0.62, -2.0);                 // spoiler wing
  add(body, new THREE.BoxGeometry(0.08, 0.2, 0.2), M.dark, 0.7, 0.5, -2.0);
  add(body, new THREE.BoxGeometry(0.08, 0.2, 0.2), M.dark, -0.7, 0.5, -2.0);

  // Racing stripes (white with a red pinstripe)
  for (const x of [-0.22, 0.22]) {
    add(body, new THREE.BoxGeometry(0.22, 0.02, 1.38), M.stripe, x, 0.57, 1.35, false);
    add(body, new THREE.BoxGeometry(0.22, 0.02, 1.12), M.stripe, x, 0.99, -0.42, false);
    add(body, new THREE.BoxGeometry(0.22, 0.02, 0.88), M.stripe, x, 0.55, -1.7, false);
  }
  add(body, new THREE.BoxGeometry(1.92, 0.07, 3.6), M.accent, 0, 0.0, 0, false);           // side pinstripe

  // Fenders over each wheel
  for (const sx of [-1, 1]) for (const z of [1.35, -1.35]) {
    add(body, taperedBox(0.25, 0.32, 1.25, 1, 0.8), M.paint, sx * 0.98, 0.32, z);
  }

  // Front ram bumper with spikes (for running over demons later)
  add(body, new THREE.BoxGeometry(2.1, 0.32, 0.3), M.metal, 0, 0.0, 2.2);
  const spikeGeo = new THREE.ConeGeometry(0.11, 0.5, 4);
  spikeGeo.rotateX(Math.PI / 2);
  for (const x of [-0.8, -0.27, 0.27, 0.8]) add(body, spikeGeo, M.metal, x, 0.0, 2.55);
  add(body, new THREE.BoxGeometry(1.9, 0.25, 0.2), M.dark, 0, 0.0, -2.15);                 // rear bumper

  // Lights
  for (const x of [-0.65, 0.65]) {
    add(body, new THREE.BoxGeometry(0.34, 0.14, 0.06), M.headlight, x, 0.28, 2.1, false);
    add(body, new THREE.BoxGeometry(0.38, 0.12, 0.06), M.taillight, x, 0.3, -2.11, false);
  }

  // Exhaust pipes
  const pipe = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6);
  pipe.rotateX(Math.PI / 2);
  for (const x of [-0.45, 0.45]) add(body, pipe, M.metal, x, -0.12, -2.2);

  // --- Turret on the roof ---
  const turret = new THREE.Group();
  turret.position.set(0, 0.98, -0.42);
  body.add(turret);
  add(turret, new THREE.CylinderGeometry(0.5, 0.58, 0.16, 8), M.dark, 0, 0.08, 0);
  const yaw = new THREE.Group();
  yaw.position.y = 0.16;
  turret.add(yaw);
  add(yaw, taperedBox(0.75, 0.35, 0.9, 0.8, 0.8), M.accent, 0, 0.2, 0);
  const pitch = new THREE.Group();
  pitch.position.set(0, 0.24, 0.25);
  yaw.add(pitch);
  const barrels = new THREE.Group();
  pitch.add(barrels);
  const barrelGeo = new THREE.CylinderGeometry(0.06, 0.07, 1.4, 6);
  barrelGeo.rotateX(Math.PI / 2);
  for (const x of [-0.13, 0.13]) add(barrels, barrelGeo, M.metal, x, 0, 0.7);
  add(barrels, new THREE.BoxGeometry(0.42, 0.12, 0.18), M.dark, 0, 0, 1.25);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 1.45);
  barrels.add(muzzle);

  // Muzzle flash (hidden until firing)
  const flash = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.9 })
  );
  flash.scale.set(1, 1, 1.8);
  flash.visible = false;
  muzzle.add(flash);

  // --- Wheels ---
  const tireGeo = new THREE.CylinderGeometry(CAR_DIMENSIONS.wheelRadius, CAR_DIMENSIONS.wheelRadius, 0.38, 8);
  tireGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 5);
  hubGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z, front] of [[0.95, 1.35, true], [-0.95, 1.35, true], [0.95, -1.35, false], [-0.95, -1.35, false]]) {
    const steer = new THREE.Group();
    steer.position.set(x, 0, z);
    root.add(steer);
    const spin = new THREE.Group();
    steer.add(spin);
    add(spin, tireGeo, M.tire, 0, 0, 0);
    add(spin, hubGeo, M.metal, 0, 0, 0, false);
    wheels.push({ steer, spin, front, x, z });
  }

  return { root, body, wheels, turret: { yaw, pitch, barrels, muzzle, flash } };
}
