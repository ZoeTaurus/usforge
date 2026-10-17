// Builds the ground and scatters scenery, all from the region data file.
import * as THREE from 'three';
import { litMaterial } from '../core/graphics.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRandom } from '../core/random.js';

export function createGround(scene, physics, region, hazards = null) {
  const { RAPIER, world } = physics;
  const p = region.palette;
  const size = region.terrain.size;
  const rand = makeRandom(region.id.length * 9973);

  // ---- Visible ground: flat-shaded triangles with patchy ash colors ----
  const segs = Math.round(size / region.terrain.patchSize);
  const geo = new THREE.PlaneGeometry(size, size, segs, segs).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  // Tiny height wobble so the flat shading catches the light (visual only).
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, (Math.sin(x * 0.37 + z * 0.11) + Math.cos(z * 0.29 - x * 0.07)) * 0.04);
  }
  const palette = [new THREE.Color(p.groundA), new THREE.Color(p.groundB), new THREE.Color(p.groundC)];
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let tri = 0; tri < pos.count / 3; tri++) {
    c.copy(palette[Math.floor(rand() * palette.length)]).multiplyScalar(0.9 + rand() * 0.2);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (tri * 3 + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, litMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Physics ground: one big flat slab ----
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(size / 2, 1, size / 2).setFriction(0.8), groundBody);

  // ---- Invisible walls at the edge of the region ----
  const half = size / 2 - 30;
  const walls = [
    [0, half + 5, half + 10, 5], [0, -half - 5, half + 10, 5],
    [half + 5, 0, 5, half + 10], [-half - 5, 0, 5, half + 10],
  ];
  for (const [x, z, hx, hz] of walls) {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 10, z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 20, hz), b);
  }

  // ---- Scenery ----
  // Keep the start, the boss arena and the lava free of random scenery.
  const arena = region.boss?.arena;
  const keepClear = (x, z) => x * x + z * z < region.clearRadiusAtStart ** 2 ||
    (arena && (x - arena.x) ** 2 + (z - arena.z) ** 2 < (arena.radius + 15) ** 2) ||
    (hazards && hazards.lavaAt(x, z, 4));
  for (const prop of region.props) {
    const builder = PROP_BUILDERS[prop.type];
    if (!builder) { console.warn('Unknown prop type', prop.type); continue; }
    placeProps(scene, physics, prop, builder(p), half, keepClear, rand);
  }
  if (arena?.style === 'island') createIsland(scene, physics, arena, p, rand);
  else if (arena) createArena(scene, physics, arena, p, rand);

  return { size, half };
}

const ROCK_GEO = new THREE.IcosahedronGeometry(1, 0);

// Each prop type: a shape, a material, how to sit on the ground, and its crash shape.
const PROP_BUILDERS = {
  rock: (p) => ({
    geometry: ROCK_GEO,
    material: litMaterial({ color: p.rock, flatShading: true, roughness: 0.95 }),
    shadows: true,
    place: (m, s, rand) => {
      m.scale.set(s * rand.range(0.8, 1.4), s * rand.range(0.5, 0.9), s * rand.range(0.8, 1.4));
      m.position.y = m.scale.y * 0.35;
      m.rotation.set(rand() * 3, rand() * 6, rand() * 3);
    },
    // Collision shape = the rock's exact shape (a ball used to stick out
    // above flat rocks, leaving cars perched on invisible bumps).
    collider: (RAPIER, m) => {
      const pos = ROCK_GEO.attributes.position;
      const pts = new Float32Array(pos.count * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).multiply(m.scale).applyQuaternion(m.quaternion);
        pts.set([v.x, v.y, v.z], i * 3);
      }
      return RAPIER.ColliderDesc.convexHull(pts);
    },
    colorJitter: 0.25,
  }),

  boneSpike: (p) => {
    const g = new THREE.ConeGeometry(0.45, 4, 5);
    g.translate(0, 2, 0);
    return {
      geometry: g,
      material: litMaterial({ color: p.bone, flatShading: true, roughness: 0.8 }),
      shadows: true,
      place: (m, s, rand) => {
        m.scale.setScalar(s);
        m.rotation.set(rand.range(-0.25, 0.25), rand() * 6, rand.range(-0.25, 0.25));
      },
      collider: (RAPIER, m) => RAPIER.ColliderDesc.cylinder(2 * m.scale.y, 0.45 * m.scale.x).setTranslation(0, 2 * m.scale.y, 0),
      colorJitter: 0.15,
    };
  },

  deadTree: (p) => {
    const trunk = new THREE.CylinderGeometry(0.18, 0.35, 5, 5);
    trunk.translate(0, 2.5, 0);
    const b1 = new THREE.CylinderGeometry(0.06, 0.14, 2.4, 4);
    b1.rotateZ(0.9); b1.translate(0.8, 3.6, 0);
    const b2 = new THREE.CylinderGeometry(0.05, 0.12, 2, 4);
    b2.rotateZ(-1.0); b2.rotateY(1.2); b2.translate(-0.3, 4.1, -0.6);
    const b3 = new THREE.CylinderGeometry(0.04, 0.1, 1.6, 4);
    b3.rotateX(0.8); b3.translate(0, 2.8, 0.6);
    return {
      geometry: mergeGeometries([trunk, b1, b2, b3]),
      material: litMaterial({ color: p.deadTree, flatShading: true, roughness: 1 }),
      shadows: true,
      place: (m, s, rand) => {
        m.scale.setScalar(s);
        m.rotation.set(rand.range(-0.1, 0.1), rand() * 6, rand.range(-0.1, 0.1));
      },
      collider: (RAPIER, m) => RAPIER.ColliderDesc.cylinder(2.5 * m.scale.y, 0.3 * m.scale.x).setTranslation(0, 2.5 * m.scale.y, 0),
      colorJitter: 0.2,
    };
  },

  lavaPool: (p) => {
    const g = new THREE.CircleGeometry(1, 7);
    g.rotateX(-Math.PI / 2);
    return {
      geometry: g,
      material: new THREE.MeshBasicMaterial({ color: p.lava }),
      shadows: false,
      place: (m, s, rand) => {
        m.scale.set(s * rand.range(0.6, 1.4), 1, s * rand.range(0.6, 1.4));
        m.position.y = 0.06;
        m.rotation.y = rand() * 6;
      },
      collider: null,
      colorJitter: 0.2,
    };
  },

  // Hexagonal basalt columns, standing in clumps.
  basaltColumn: (p) => {
    const parts = [];
    for (const [x, z, h] of [[0, 0, 4], [0.9, 0.3, 3], [-0.6, 0.8, 2.4], [0.2, -0.9, 3.4], [-0.8, -0.4, 1.6]]) {
      const c = new THREE.CylinderGeometry(0.5, 0.55, h, 6);
      c.translate(x, h / 2, z);
      parts.push(c);
    }
    return {
      geometry: mergeGeometries(parts),
      material: litMaterial({ color: p.rock, flatShading: true, roughness: 0.85 }),
      shadows: true,
      place: (m, s, rand) => { m.scale.set(s, s * rand.range(0.8, 1.5), s); m.rotation.y = rand() * 6; },
      collider: (RAPIER, m) => RAPIER.ColliderDesc.cylinder(2 * m.scale.y, 1.2 * m.scale.x).setTranslation(0, 2 * m.scale.y, 0),
      colorJitter: 0.3,
    };
  },

  // Glassy black obsidian shards jutting out of the ground.
  obsidian: (p) => {
    const parts = [];
    for (const [x, z, h, rx, rz] of [[0, 0, 3.2, 0.1, -0.2], [0.6, 0.2, 2, 0.3, 0.4], [-0.5, -0.3, 1.6, -0.4, -0.3]]) {
      const c = new THREE.ConeGeometry(0.45, h, 4);
      c.translate(0, h / 2, 0); c.rotateX(rx); c.rotateZ(rz); c.translate(x, 0, z);
      parts.push(c);
    }
    return {
      geometry: mergeGeometries(parts),
      material: litMaterial({ color: p.obsidian ?? 0x15121c, flatShading: true, roughness: 0.15, metalness: 0.6 }),
      shadows: true,
      place: (m, s, rand) => { m.scale.setScalar(s); m.rotation.y = rand() * 6; },
      collider: (RAPIER, m) => RAPIER.ColliderDesc.cylinder(1.4 * m.scale.y, 0.55 * m.scale.x).setTranslation(0, 1.4 * m.scale.y, 0),
      colorJitter: 0.4,
    };
  },

  pebble: (p) => ({
    geometry: new THREE.IcosahedronGeometry(1, 0),
    material: litMaterial({ color: p.rock, flatShading: true }),
    shadows: false,
    place: (m, s, rand) => {
      m.scale.set(s, s * 0.6, s);
      m.position.y = s * 0.2;
      m.rotation.set(rand() * 3, rand() * 6, 0);
    },
    collider: null,
    colorJitter: 0.35,
  }),
};

// Uses one "instanced" mesh per prop type: hundreds of copies drawn in a
// single go, which keeps the game fast.
function placeProps(scene, physics, prop, b, half, keepClear, rand) {
  const { RAPIER, world } = physics;
  const mesh = new THREE.InstancedMesh(b.geometry, b.material, prop.count);
  mesh.castShadow = b.shadows;
  mesh.receiveShadow = b.shadows;
  const dummy = new THREE.Object3D();
  const base = new THREE.Color(b.material.color);
  const col = new THREE.Color();
  const fixedBody = prop.solid ? world.createRigidBody(RAPIER.RigidBodyDesc.fixed()) : null;

  for (let i = 0; i < prop.count; i++) {
    let x, z;
    do {
      x = rand.range(-half, half);
      z = rand.range(-half, half);
    } while (keepClear(x, z));

    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    b.place(dummy, rand.range(prop.minScale, prop.maxScale), rand);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, col.copy(base).multiplyScalar(1 - b.colorJitter / 2 + rand() * b.colorJitter));

    if (fixedBody && b.collider) {
      const desc = b.collider(RAPIER, dummy);
      const t = desc.translation;
      desc.setTranslation(x + t.x, dummy.position.y + t.y, z + t.z).setRestitution(0.2).setFriction(0.5);
      world.createCollider(desc, fixedBody);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
}

// The boss arena: a scorched circle ringed by giant bone spikes (with four
// gaps to drive in through), glowing cracks, and a ribcage throne.
function createArena(scene, physics, arena, p, rand) {
  const { RAPIER, world } = physics;
  const { x: ax, z: az, radius: R } = arena;
  const group = new THREE.Group();
  group.position.set(ax, 0, az);
  scene.add(group);

  // Scorched floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 6, 40).rotateX(-Math.PI / 2),
    litMaterial({ color: 0x2a2220, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
  floor.position.y = 0.05;
  floor.receiveShadow = true;
  group.add(floor);

  // Glowing cracks radiating from the middle
  const lava = new THREE.MeshBasicMaterial({ color: p.lava });
  for (let n = 0; n < 14; n++) {
    const a = (n / 14) * Math.PI * 2 + rand() * 0.2;
    const len = R * (0.5 + rand() * 0.5);
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.5 + rand() * 0.6, 0.05, len), lava);
    crack.position.set(Math.sin(a) * len / 2, 0.08, Math.cos(a) * len / 2);
    crack.rotation.y = a;
    group.add(crack);
  }

  // Ring of giant bone spikes, with four gaps to get in
  const boneMat = litMaterial({ color: p.bone, flatShading: true, roughness: 0.8 });
  const spikeGeo = new THREE.ConeGeometry(1.4, 14, 6).translate(0, 7, 0);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(ax, 0, az));
  const count = 36;
  for (let n = 0; n < count; n++) {
    if (n % 9 === 0 || n % 9 === 1) continue; // gaps
    const a = (n / count) * Math.PI * 2;
    const s = 0.8 + rand() * 0.5;
    const m = new THREE.Mesh(spikeGeo, boneMat);
    m.position.set(Math.sin(a) * (R + 4), 0, Math.cos(a) * (R + 4));
    m.scale.set(s, s * (0.8 + rand() * 0.5), s);
    m.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); // lean outward
    m.castShadow = true;
    group.add(m);
    world.createCollider(RAPIER.ColliderDesc.cylinder(5, 1.3 * s).setTranslation(m.position.x, 5, m.position.z), body);
  }

  // Ribcage "throne" behind the boss (on the far side, seen from the start)
  const away = Math.atan2(ax, az); // direction pointing away from the start
  for (let n = 0; n < 6; n++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(6, 0.5, 5, 12, Math.PI), boneMat);
    const d = 16 + n * 2.2;
    rib.position.set(Math.sin(away) * d, 0, Math.cos(away) * d);
    rib.rotation.y = away;
    rib.castShadow = true;
    group.add(rib);
  }
}

// Island arena (Lava Rivers): a basalt island in a lake of lava, ringed by
// basalt columns, with a smoking volcano behind the boss. The lava moat
// itself is drawn by the hazards system.
function createIsland(scene, physics, arena, p, rand) {
  const { RAPIER, world } = physics;
  const { x: ax, z: az, radius: R } = arena;
  const group = new THREE.Group();
  group.position.set(ax, 0, az);
  scene.add(group);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 6, 40).rotateX(-Math.PI / 2),
    litMaterial({ color: 0x1c1818, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
  floor.position.y = 0.05;
  floor.receiveShadow = true;
  group.add(floor);

  const lava = new THREE.MeshBasicMaterial({ color: p.lava });
  for (let n = 0; n < 18; n++) {
    const a = (n / 18) * Math.PI * 2 + rand() * 0.2;
    const len = R * (0.4 + rand() * 0.6);
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.4 + rand() * 0.6, 0.05, len), lava);
    crack.position.set(Math.sin(a) * len / 2, 0.08, Math.cos(a) * len / 2);
    crack.rotation.y = a;
    group.add(crack);
  }

  // Basalt columns around the shore (gaps to drive through)
  const colMat = litMaterial({ color: p.rock, flatShading: true, roughness: 0.85 });
  const colGeo = new THREE.CylinderGeometry(1.1, 1.3, 1, 6).translate(0, 0.5, 0);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(ax, 0, az));
  const count = 40;
  for (let n = 0; n < count; n++) {
    if (n % 10 < 3) continue; // gaps
    const a = (n / count) * Math.PI * 2;
    const h = 4 + rand() * 9;
    const m = new THREE.Mesh(colGeo, colMat);
    m.position.set(Math.sin(a) * (R + 1), 0, Math.cos(a) * (R + 1));
    m.scale.set(1, h, 1);
    m.castShadow = true;
    group.add(m);
    world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, 1.2).setTranslation(m.position.x, h / 2, m.position.z), body);
  }

  // A volcano behind the boss (far side from the start), glowing at the top.
  const away = Math.atan2(ax, az);
  const vx = Math.sin(away) * (R - 14), vz = Math.cos(away) * (R - 14);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(3, 13, 16, 9),
    litMaterial({ color: 0x1a1414, flatShading: true, roughness: 1 }));
  cone.position.set(vx, 8, vz);
  cone.castShadow = true;
  group.add(cone);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 9), new THREE.MeshBasicMaterial({ color: 0xffb030 }));
  top.position.set(vx, 16.05, vz);
  group.add(top);
  world.createCollider(RAPIER.ColliderDesc.cylinder(8, 11).setTranslation(vx, 8, vz), body);
}
