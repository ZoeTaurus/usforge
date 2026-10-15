// Builds the ground and scatters scenery, all from the region data file.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRandom } from '../core/random.js';

export function createGround(scene, physics, region) {
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
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
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
  for (const prop of region.props) {
    const builder = PROP_BUILDERS[prop.type];
    if (!builder) { console.warn('Unknown prop type', prop.type); continue; }
    placeProps(scene, physics, prop, builder(p), half, region.clearRadiusAtStart, rand);
  }

  return { size, half };
}

// Each prop type: a shape, a material, how to sit on the ground, and its crash shape.
const PROP_BUILDERS = {
  rock: (p) => ({
    geometry: new THREE.IcosahedronGeometry(1, 0),
    material: new THREE.MeshStandardMaterial({ color: p.rock, flatShading: true, roughness: 0.95 }),
    shadows: true,
    place: (m, s, rand) => {
      m.scale.set(s * rand.range(0.8, 1.4), s * rand.range(0.5, 0.9), s * rand.range(0.8, 1.4));
      m.position.y = m.scale.y * 0.35;
      m.rotation.set(rand() * 3, rand() * 6, rand() * 3);
    },
    collider: (RAPIER, m) => RAPIER.ColliderDesc.ball(Math.min(m.scale.x, m.scale.z) * 0.85),
    colorJitter: 0.25,
  }),

  boneSpike: (p) => {
    const g = new THREE.ConeGeometry(0.45, 4, 5);
    g.translate(0, 2, 0);
    return {
      geometry: g,
      material: new THREE.MeshStandardMaterial({ color: p.bone, flatShading: true, roughness: 0.8 }),
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
      material: new THREE.MeshStandardMaterial({ color: p.deadTree, flatShading: true, roughness: 1 }),
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

  pebble: (p) => ({
    geometry: new THREE.IcosahedronGeometry(1, 0),
    material: new THREE.MeshStandardMaterial({ color: p.rock, flatShading: true }),
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
function placeProps(scene, physics, prop, b, half, clearRadius, rand) {
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
    } while (x * x + z * z < clearRadius * clearRadius);

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
