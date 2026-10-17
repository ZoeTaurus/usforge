// The car's 3D model, built from simple shapes (no art files).
// Forward is +Z. The origin is the center of the physics box.
//
//   root          follows the physics body
//   ├─ body       leans in turns / dips when braking (visual wobble)
//   │   ├─ sections: cabin (+ roof turret), nose, tail, doorL, doorR, bumper
//   │   └─ parts you bolted on
//   └─ wheels     stay planted on the ground
import * as THREE from 'three';
import { litMaterial } from '../core/graphics.js';

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
  litMaterial({ color, flatShading: true, roughness: 0.6, metalness: 0.1, ...extra });

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

// Materials are shared by every copy of the car's pieces.
let _M = null;
function materials() {
  if (_M) return _M;
  const M = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, mat(v)]));
  M.glass.roughness = 0.2;
  M.metal.metalness = 0.6;
  M.headlight = mat(COLORS.headlight, { emissive: COLORS.headlight, emissiveIntensity: 1.5 });
  M.taillight = mat(COLORS.taillight, { emissive: COLORS.taillight, emissiveIntensity: 1.2 });
  return (_M = M);
}

// The light materials (brake lights brighten when braking).
export function carLightMaterials() { const M = materials(); return { head: M.headlight, tail: M.taillight }; }

// Adds one body section's shapes to group g, in the car's own coordinates.
// Used for the car itself, and for loose pieces you bolt on elsewhere.
function buildSection(id, g, tier = 0) {
  const M = materials();
  buildBaseSection(id, g, M);
  if (tier >= 1) addArmor(id, g, M, tier);
}

// Bolted-on armor for the upgraded chassis tiers (1 = Armored Car, 2 =
// Half-Track, 3 = HELL TANK). It belongs to the section, so it breaks off
// with it.
function addArmor(id, g, M, tier) {
  const thick = tier >= 3 ? 0.12 : 0.07;
  if (id === 'doorL' || id === 'doorR') {
    const sx = id === 'doorL' ? 1 : -1;
    add(g, new THREE.BoxGeometry(thick, 0.42, 1.8), M.metal, sx * (0.97 + thick / 2), 0.17, 0);
    for (const z of [-0.6, 0, 0.6]) add(g, new THREE.BoxGeometry(0.03, 0.05, 0.05), M.dark, sx * (1.0 + thick), 0.3, z, false); // rivets
  } else if (id === 'nose') {
    add(g, new THREE.BoxGeometry(1.6, thick, 1.2), M.metal, 0, 0.6, 1.35);              // hood plate
    add(g, new THREE.BoxGeometry(1.5, 0.3, 0.08), M.dark, 0, 0.25, 2.14);              // grille
    for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) add(g, new THREE.BoxGeometry(0.04, 0.3, 0.1), M.metal, x, 0.25, 2.17, false);
  } else if (id === 'tail') {
    add(g, new THREE.BoxGeometry(1.7, thick, 0.8), M.metal, 0, 0.58, -1.7);
  } else if (id === 'cabin') {
    for (const x of [-0.45, -0.15, 0.15, 0.45]) add(g, new THREE.BoxGeometry(0.05, 0.42, 0.05), M.dark, x, 0.66, 0.68, false); // window bars
    add(g, new THREE.BoxGeometry(1.3, 0.06, 0.06), M.dark, 0, 0.66, 0.68, false);
    if (tier >= 3) { // slanted tank hull plates
      for (const sx of [-1, 1]) {
        const plate = add(g, new THREE.BoxGeometry(0.1, 0.55, 2.0), M.metal, sx * 0.8, 0.68, -0.3);
        plate.rotation.z = sx * 0.35;
      }
    }
  } else if (id === 'bumper' && tier >= 2) {
    add(g, new THREE.BoxGeometry(2.2, 0.45, 0.12), M.metal, 0, 0.05, 2.38); // ram plate
  }
}

function buildBaseSection(id, g, M) {
  if (id === 'cabin') {
    // Cabin: middle of the chassis, glass, roof
    add(g, new THREE.BoxGeometry(1.5, 0.5, 2.0), M.paint, 0, 0.15, 0);
    add(g, taperedBox(1.7, 0.5, 2.0, 0.85, 0.6, -0.15), M.glass, 0, 0.65, -0.3);
    add(g, new THREE.BoxGeometry(1.42, 0.08, 1.15), M.paint, 0, 0.94, -0.42);
    for (const x of [-0.22, 0.22]) add(g, new THREE.BoxGeometry(0.22, 0.02, 1.12), M.stripe, x, 0.99, -0.42, false);
  } else if (id === 'doorL' || id === 'doorR') {
    // Side panel with the red pinstripe
    const sx = id === 'doorL' ? 1 : -1;
    add(g, new THREE.BoxGeometry(0.2, 0.48, 2.0), M.paint, sx * 0.85, 0.15, 0);
    add(g, new THREE.BoxGeometry(0.04, 0.07, 2.0), M.accent, sx * 0.96, 0.0, 0, false);
    add(g, new THREE.BoxGeometry(0.04, 0.05, 0.22), M.dark, sx * 0.96, 0.25, -0.2, false); // handle
  } else if (id === 'nose') {
    // Nose: front of the chassis, hood, scoop, headlights, front fenders
    add(g, taperedBox(1.9, 0.5, 1.1, 0.98, 0.95, 0.0), M.paint, 0, 0.15, 1.55);
    add(g, taperedBox(1.8, 0.16, 1.4, 0.95, 0.9, -0.05), M.paint, 0, 0.48, 1.35);
    add(g, new THREE.BoxGeometry(0.5, 0.18, 0.5), M.dark, 0, 0.6, 1.3);
    for (const x of [-0.22, 0.22]) add(g, new THREE.BoxGeometry(0.22, 0.02, 1.38), M.stripe, x, 0.57, 1.35, false);
    for (const x of [-0.65, 0.65]) add(g, new THREE.BoxGeometry(0.34, 0.14, 0.06), M.headlight, x, 0.28, 2.1, false);
    for (const sx of [-1, 1]) add(g, taperedBox(0.25, 0.32, 1.25, 1, 0.8), M.paint, sx * 0.98, 0.32, 1.35);
  } else if (id === 'tail') {
    // Tail: back of the chassis, trunk, spoiler, taillights, exhausts, rear fenders
    add(g, taperedBox(1.9, 0.5, 1.0, 0.98, 0.95, 0.0), M.paint, 0, 0.15, -1.6);
    add(g, taperedBox(1.8, 0.14, 0.9, 0.95, 0.8, 0.05), M.paint, 0, 0.47, -1.7);
    for (const x of [-0.22, 0.22]) add(g, new THREE.BoxGeometry(0.22, 0.02, 0.88), M.stripe, x, 0.55, -1.7, false);
    add(g, new THREE.BoxGeometry(1.9, 0.08, 0.3), M.dark, 0, 0.62, -2.0);                 // spoiler wing
    add(g, new THREE.BoxGeometry(0.08, 0.2, 0.2), M.dark, 0.7, 0.5, -2.0);
    add(g, new THREE.BoxGeometry(0.08, 0.2, 0.2), M.dark, -0.7, 0.5, -2.0);
    add(g, new THREE.BoxGeometry(1.9, 0.25, 0.2), M.dark, 0, 0.0, -2.15);                 // rear bumper
    for (const x of [-0.65, 0.65]) add(g, new THREE.BoxGeometry(0.38, 0.12, 0.06), M.taillight, x, 0.3, -2.11, false);
    const pipe = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6);
    pipe.rotateX(Math.PI / 2);
    for (const x of [-0.45, 0.45]) add(g, pipe, M.metal, x, -0.12, -2.2);
    for (const sx of [-1, 1]) add(g, taperedBox(0.25, 0.32, 1.25, 1, 0.8), M.paint, sx * 0.98, 0.32, -1.35);
  } else if (id === 'bumper') {
    // Front ram bumper with spikes
    add(g, new THREE.BoxGeometry(2.1, 0.32, 0.3), M.metal, 0, 0.0, 2.2);
    const spikeGeo = new THREE.ConeGeometry(0.11, 0.5, 4);
    spikeGeo.rotateX(Math.PI / 2);
    for (const x of [-0.8, -0.27, 0.27, 0.8]) add(g, spikeGeo, M.metal, x, 0.0, 2.55);
  }
}

// A loose copy of a body section (e.g. a nose you picked up as scrap).
export function createSectionModel(id) {
  const g = new THREE.Group();
  buildSection(id, g);
  return g;
}

export function createCarModel() {
  const M = materials();

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // --- Body sections: each one can be damaged and break off on its own ---
  //   cabin  = where you sit (the core: lose it and you're wrecked)
  //   nose, tail, doorL (x>0), doorR (x<0), bumper (front ram bumper)
  const sections = {};
  for (const id of ['cabin', 'nose', 'tail', 'doorL', 'doorR', 'bumper']) {
    sections[id] = new THREE.Group();
    sections[id].name = id;
    buildSection(id, sections[id]);
    body.add(sections[id]);
  }
  const cabin = sections.cabin;

  // --- Turret on the roof ---
  const turret = new THREE.Group();
  turret.position.set(0, 0.98, -0.42);
  cabin.add(turret); // the roof gun belongs to the cabin
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

  // --- Treads (for the Half-Track and the HELL TANK) ---
  // A tread unit: a dark belt with road wheels showing on the outside.
  const treads = [];
  const makeTread = (x, z, length) => {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    add(t, new THREE.BoxGeometry(0.46, 0.8, length), M.tire, 0, -0.02, 0);
    add(t, new THREE.BoxGeometry(0.5, 0.08, length + 0.1), M.metal, 0, 0.4, 0); // top guard
    const rollers = [];
    const n = Math.max(2, Math.round(length / 0.55));
    for (let k = 0; k < n; k++) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 7).rotateZ(Math.PI / 2), M.metal);
      r.position.set(Math.sign(x) * 0.25, -0.05, -length / 2 + 0.3 + k * ((length - 0.6) / (n - 1)));
      t.add(r);
      rollers.push(r);
    }
    t.visible = false;
    root.add(t);
    const unit = { group: t, rollers };
    treads.push(unit);
    return unit;
  };
  const rearTreads = [makeTread(1.0, -1.25, 1.7), makeTread(-1.0, -1.25, 1.7)];
  const fullTreads = [makeTread(1.0, 0, 4.1), makeTread(-1.0, 0, 4.1)];

  const model = { root, body, sections, wheels, treads, turret: { group: turret, yaw, pitch, barrels, muzzle, flash } };

  // Change the look to a chassis tier: 0 car, 1 armored, 2 half-track, 3 tank.
  model.setTier = (tier) => {
    for (const [id, g] of Object.entries(sections)) {
      for (const child of [...g.children]) if (child !== turret) g.remove(child);
      buildSection(id, g, tier);
    }
    for (const w of wheels) w.steer.visible = tier < 2 || (tier === 2 && w.front);
    for (const t of rearTreads) t.group.visible = tier === 2;
    for (const t of fullTreads) t.group.visible = tier >= 3;
    // The tank's roof gun is a big cannon turret.
    turret.scale.setScalar(tier >= 3 ? 1.35 : 1);
    barrels.scale.set(tier >= 3 ? 1.6 : 1, tier >= 3 ? 1.6 : 1, tier >= 3 ? 1.4 : 1);
  };
  return model;
}
