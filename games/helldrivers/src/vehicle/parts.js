// The catalog of bolt-on parts. Each part fills one grid cell (0.5 m).
// Every model is built "pointing up" (+Y = away from the surface it's
// bolted to); the builder turns it to face outward from that surface.
// Weights and effects are in settings.js -> parts.
import * as THREE from 'three';
import { litMaterial } from '../core/graphics.js';

const mat = (color, extra = {}) => litMaterial({ color, flatShading: true, roughness: 0.6, metalness: 0.2, ...extra });
const M = {
  steel: mat(0x6a6e75, { metalness: 0.5 }),
  dark: mat(0x232326),
  bone: mat(0xe0d6bc),
  red: mat(0xc8202a),
  blue: mat(0x3a66d0),
  yellow: mat(0xf0c020),
  lead: mat(0x2c2e33, { metalness: 0.7, roughness: 0.4 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.85 }),
  cool: new THREE.MeshBasicMaterial({ color: 0x60d0ff }),
};

function add(group, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

export const PART_TYPES = {
  armor: {
    name: 'Armor Block',
    icon: '🛡️',
    desc: 'Tough block. Soaks up hits for what is behind it.',
    build(g) {
      add(g, new THREE.BoxGeometry(0.48, 0.48, 0.48), M.steel);
      for (const [x, z] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) {
        add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.04, 5), M.dark, x, 0.25, z); // rivets
      }
    },
  },
  spike: {
    name: 'Ram Spike',
    icon: '🔱',
    desc: '+30% ram damage on the side it points.',
    build(g) {
      add(g, new THREE.BoxGeometry(0.44, 0.1, 0.44), M.dark, 0, -0.2, 0);
      add(g, new THREE.ConeGeometry(0.16, 0.85, 5), M.bone, 0, 0.27, 0);
    },
  },
  plow: {
    name: 'Ram Plow',
    icon: '🚜',
    desc: '+70% ram damage on the side it faces. Very heavy.',
    build(g) {
      add(g, new THREE.BoxGeometry(0.5, 0.12, 0.5), M.dark, 0, -0.19, 0);
      const blade = add(g, new THREE.BoxGeometry(0.56, 0.08, 0.6), M.yellow, 0, 0.05, 0);
      blade.rotation.x = 0.55;
      for (const x of [-0.18, 0, 0.18]) add(g, new THREE.ConeGeometry(0.05, 0.2, 4), M.steel, x, 0.2, 0.27).rotation.x = 0.55;
    },
  },
  gun: {
    name: 'Machine Gun',
    icon: '🔫',
    desc: 'Another gun. Fires with your main gun.',
    isGun: true,
    build(g) {
      add(g, new THREE.CylinderGeometry(0.22, 0.25, 0.3, 7), M.dark, 0, -0.1, 0);
    },
  },
  booster: {
    name: 'Rocket Booster',
    icon: '🚀',
    desc: '+engine power and top speed. Flames!',
    build(g) {
      add(g, new THREE.CylinderGeometry(0.18, 0.2, 0.42, 7), M.red, 0, -0.04, 0);
      add(g, new THREE.CylinderGeometry(0.14, 0.2, 0.12, 7), M.dark, 0, 0.22, 0);
      const flame = add(g, new THREE.ConeGeometry(0.13, 0.6, 6), M.flame, 0, 0.58, 0);
      flame.rotation.x = Math.PI; // points away from the car
      flame.castShadow = false;
      g.userData.flame = flame;
    },
  },
  heavyArmor: {
    name: 'Heavy Armor',
    icon: '🧱',
    desc: 'Hell-forged slab. Very tough, very heavy.',
    build(g) {
      add(g, new THREE.BoxGeometry(0.5, 0.5, 0.5), M.lead);
      add(g, new THREE.BoxGeometry(0.52, 0.12, 0.52), M.red, 0, 0.12, 0);
      for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
        add(g, new THREE.ConeGeometry(0.06, 0.12, 4), M.steel, x, 0.3, z); // studs
      }
    },
  },
  saw: {
    name: 'Saw Blade',
    icon: '🪚',
    desc: '+120% ram damage on the side it faces. Spins!',
    build(g) {
      add(g, new THREE.BoxGeometry(0.3, 0.2, 0.3), M.dark, 0, -0.15, 0);
      const disc = new THREE.Group();
      disc.position.y = 0.12;
      const blade = add(disc, new THREE.CylinderGeometry(0.42, 0.42, 0.05, 10), M.steel);
      blade.rotation.x = Math.PI / 2;
      for (let n = 0; n < 10; n++) { // teeth
        const a = (n / 10) * Math.PI * 2;
        const t = add(disc, new THREE.ConeGeometry(0.06, 0.16, 3), M.steel, Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0);
        t.rotation.z = a - Math.PI / 2;
      }
      g.add(disc);
      g.userData.saw = disc;
    },
  },
  cannon: {
    name: 'Hell Cannon',
    icon: '💥',
    desc: 'Slow, heavy-hitting gun. Shells explode.',
    isGun: true,
    weapon: 'cannon',
    build(g) {
      add(g, new THREE.CylinderGeometry(0.26, 0.3, 0.3, 8), M.dark, 0, -0.1, 0);
    },
  },
  hoverFan: {
    name: 'Hover Fan',
    icon: '🌀',
    desc: 'Blows lava away from the car. Each fan: -25% lava burn & drag (4 = immune).',
    build(g) {
      add(g, new THREE.CylinderGeometry(0.24, 0.24, 0.1, 10), M.dark, 0, -0.2, 0);          // mount
      const duct = add(g, new THREE.TorusGeometry(0.22, 0.05, 5, 12), M.steel, 0, 0.05, 0);  // ring
      duct.rotation.x = Math.PI / 2;
      add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6), M.dark, 0, -0.05, 0);          // shaft
      const rotor = new THREE.Group();
      rotor.position.y = 0.06;
      for (let n = 0; n < 3; n++) {
        const blade = add(rotor, new THREE.BoxGeometry(0.36, 0.02, 0.09), M.steel);
        blade.rotation.y = (n / 3) * Math.PI * 2;
        blade.rotation.x = 0.35;
      }
      add(rotor, new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), M.cool);                    // glowing hub
      g.add(rotor);
      g.userData.fan = rotor;
    },
  },
  weight: {
    name: 'Lead Weight',
    icon: '🏋️',
    desc: '250 kg of nothing. Hits harder, handles worse.',
    build(g) {
      add(g, new THREE.BoxGeometry(0.46, 0.46, 0.46), M.lead);
      add(g, new THREE.BoxGeometry(0.47, 0.1, 0.47), M.yellow, 0, 0.1, 0);
    },
  },
};

// A small gun turret (used by the Machine Gun part). Its aiming parts stay
// lined up with the car, no matter which surface the base is bolted to.
export function createGunTurret(kind = 'gun') {
  const big = kind === 'cannon';
  const turret = new THREE.Group();
  const yaw = new THREE.Group();
  turret.add(yaw);
  add(yaw, new THREE.BoxGeometry(big ? 0.5 : 0.34, big ? 0.3 : 0.2, big ? 0.6 : 0.42), big ? M.red : M.blue, 0, 0.08, 0);
  const pitch = new THREE.Group();
  pitch.position.set(0, big ? 0.18 : 0.12, 0.1);
  yaw.add(pitch);
  const barrels = new THREE.Group();
  pitch.add(barrels);
  const len = big ? 1.2 : 0.8;
  const bg = new THREE.CylinderGeometry(big ? 0.1 : 0.045, big ? 0.12 : 0.05, len, 7);
  bg.rotateX(Math.PI / 2);
  add(barrels, bg, M.steel, 0, 0, len / 2);
  if (big) add(barrels, new THREE.CylinderGeometry(0.15, 0.15, 0.2, 7).rotateX(Math.PI / 2), M.dark, 0, 0, len); // muzzle brake
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, len + 0.1);
  barrels.add(muzzle);
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.9 }));
  flash.scale.set(1, 1, 1.8);
  flash.visible = false;
  muzzle.add(flash);
  return { group: turret, yaw, pitch, barrels, muzzle, flash };
}
