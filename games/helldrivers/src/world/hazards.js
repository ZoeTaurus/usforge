// LAVA. Three kinds, all read from the region file:
//  - rivers: winding strips of lava, with cooled-crust bridges to cross on
//  - the moat: a ring of lava around an island boss arena
//  - pools: temporary puddles (the Magma Colossus spits lava bombs)
// lavaAt(x, z) answers "is this spot lava?" so the car knows when to burn.
import * as THREE from 'three';
import { makeRandom } from '../core/random.js';

const STEP = 8;  // meters between points along a river
const GRID = 50; // lookup grid cell size (m)

export class Hazards {
  constructor(scene, region) {
    this.scene = scene;
    this.segs = [];     // river pieces: { ax, az, bx, bz, hw (half width) }
    this.grid = new Map();
    this.bridges = [];  // { x, z, tx, tz, along, across } (t = river direction)
    this.rings = [];    // { x, z, inner, outer }
    this.pools = [];
    this.time = 0;
    const lava = new THREE.Color(region.palette.lava);
    this.lavaMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 });
    this.crustMat = new THREE.MeshStandardMaterial({ color: 0x120c0a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
    this.hot = lava.clone().lerp(new THREE.Color(0xffd040), 0.6); // bright middle of the flow
    this.edge = lava.clone().multiplyScalar(0.75);                 // darker edges
    const rand = makeRandom(region.id.length * 31337);

    for (const r of region.hazards?.lavaRivers || []) this.#addRiver(r, rand);
    const a = region.boss?.arena;
    if (a?.style === 'island') this.#addRing(a.x, a.z, a.radius + 5, a.radius + 5 + (a.moat || 40));

    this.poolGeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
    this.poolMat = new THREE.MeshBasicMaterial({ color: this.hot, transparent: true, opacity: 0.95, depthWrite: false });
  }

  get hasLava() { return this.segs.length > 0 || this.rings.length > 0 || this.pools.length > 0; }

  // Is (x, z) lava? margin > 0 = "lava or close to it" (used to keep
  // scenery off the rivers and bridges).
  lavaAt(x, z, margin = 0) {
    for (const p of this.pools) if ((x - p.x) ** 2 + (z - p.z) ** 2 < (p.r * p.scale + margin) ** 2) return true;
    if (margin === 0) {
      for (const b of this.bridges) {
        const dx = x - b.x, dz = z - b.z;
        if (Math.abs(dx * b.tx + dz * b.tz) < b.along && Math.abs(dx * b.tz - dz * b.tx) < b.across) return false;
      }
    }
    for (const g of this.rings) {
      const d = Math.hypot(x - g.x, z - g.z);
      if (d > g.inner - margin && d < g.outer + margin) return true;
    }
    const cell = this.grid.get(cellKey(x, z));
    if (cell) for (const s of cell) if (distToSeg(x, z, s) < s.hw + margin) return true;
    return false;
  }

  // A temporary pool of lava (x, z, radius m, lasts `time` s).
  addPool(x, z, r, time) {
    const mesh = new THREE.Mesh(this.poolGeo, this.poolMat);
    mesh.position.set(x, 0.1, z);
    mesh.scale.set(r * 0.2, 1, r * 0.2);
    this.scene.add(mesh);
    this.pools.push({ x, z, r, life: time, maxLife: time, mesh, scale: 0.2 });
  }

  clearPools() {
    for (const p of this.pools) this.scene.remove(p.mesh);
    this.pools = [];
  }

  // Glow pulse, pools spreading/cooling, and sparks rising off nearby lava.
  update(dt, nearPos, sparks) {
    this.time += dt;
    const k = 0.9 + Math.sin(this.time * 2.2) * 0.1;
    this.lavaMat.color.setScalar(k);
    for (const p of [...this.pools]) {
      p.life -= dt;
      const age = p.maxLife - p.life;
      p.scale = Math.min(1, 0.2 + age * 2) * Math.min(1, p.life / 2); // spreads fast, shrinks at the end
      p.mesh.scale.set(p.r * p.scale, 1, p.r * p.scale);
      if (p.life <= 0) { this.scene.remove(p.mesh); this.pools.splice(this.pools.indexOf(p), 1); }
    }
    if (!sparks || !this.hasLava) return;
    for (let n = 0; n < 6; n++) {
      const x = nearPos.x + (Math.random() - 0.5) * 90, z = nearPos.z + (Math.random() - 0.5) * 90;
      if (!this.lavaAt(x, z)) continue;
      sparks.spawn(new THREE.Vector3(x, 0.2, z), new THREE.Vector3((Math.random() - 0.5) * 1.5, 2 + Math.random() * 3, (Math.random() - 0.5) * 1.5), 0.1 + Math.random() * 0.12, 0.9);
    }
  }

  // ---------------------------------------------------------------- building
  #addRiver(r, rand) {
    // Walk along the river's points, adding a lazy side-to-side wiggle.
    const pts = [];
    let total = 0;
    const phase = rand() * 10;
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, az] = r.points[i], [bx, bz] = r.points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.max(1, Math.round(len / STEP));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        pts.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, s: total + len * t });
      }
      total += len;
    }
    const last = r.points[r.points.length - 1];
    pts.push({ x: last[0], z: last[1], s: total });
    const amp = r.width * 0.9 + 6;
    for (const p of pts) {
      const fade = Math.min(1, p.s / 80, (total - p.s) / 80);
      p.wob = Math.sin(p.s / 160 * Math.PI * 2 + phase) * amp * fade + Math.sin(p.s / 47 + phase * 2) * 3 * fade;
      p.hw = (r.width / 2) * (1 + 0.2 * Math.sin(p.s / 37 + phase));
    }
    // Directions and the final (wiggled) center line.
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      pts[i].tx = (b.x - a.x) / l; pts[i].tz = (b.z - a.z) / l;
    }
    for (const p of pts) { p.cx = p.x - p.tz * p.wob; p.cz = p.z + p.tx * p.wob; }
    for (let i = 0; i < pts.length; i++) { // re-measure the direction on the wiggled line
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const l = Math.hypot(b.cx - a.cx, b.cz - a.cz) || 1;
      pts[i].tx = (b.cx - a.cx) / l; pts[i].tz = (b.cz - a.cz) / l;
    }

    // Collision pieces for lavaAt()
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const seg = { ax: a.cx, az: a.cz, bx: b.cx, bz: b.cz, hw: Math.max(a.hw, b.hw) };
      this.segs.push(seg);
      const minX = Math.min(a.cx, b.cx) - seg.hw, maxX = Math.max(a.cx, b.cx) + seg.hw;
      const minZ = Math.min(a.cz, b.cz) - seg.hw, maxZ = Math.max(a.cz, b.cz) + seg.hw;
      for (let gx = Math.floor(minX / GRID); gx <= Math.floor(maxX / GRID); gx++) {
        for (let gz = Math.floor(minZ / GRID); gz <= Math.floor(maxZ / GRID); gz++) {
          const k = `${gx},${gz}`;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(seg);
        }
      }
    }

    // Visible river: dark crust banks + a glowing ribbon (bright down the middle).
    this.scene.add(this.#ribbon(pts, 2.5, 0.04, this.crustMat, false));
    this.scene.add(this.#ribbon(pts, 0, 0.07, this.lavaMat, true));

    // Cooled-crust bridges
    for (const f of r.bridges || []) {
      const s = f * total;
      const p = pts.reduce((best, q) => (Math.abs(q.s - s) < Math.abs(best.s - s) ? q : best));
      const b = { x: p.cx, z: p.cz, tx: p.tx, tz: p.tz, along: 7, across: p.hw + 6 };
      this.bridges.push(b);
      this.#bridgeModel(b, rand);
    }
  }

  #ribbon(pts, extra, y, material, glow) {
    const pos = [], col = [];
    const c = new THREE.Color();
    // 3 lanes across: left edge, middle, right edge
    const rows = pts.map((p) => {
      const hw = p.hw + extra;
      return [
        [p.cx + p.tz * hw, p.cz - p.tx * hw, this.edge],
        [p.cx, p.cz, this.hot],
        [p.cx - p.tz * hw, p.cz + p.tx * hw, this.edge],
      ];
    });
    const push = (v) => { pos.push(v[0], y, v[1]); c.copy(v[2]); col.push(c.r, c.g, c.b); };
    for (let i = 0; i < rows.length - 1; i++) {
      for (let l = 0; l < 2; l++) {
        const a = rows[i][l], b = rows[i][l + 1], d = rows[i + 1][l], e = rows[i + 1][l + 1];
        push(a); push(b); push(d); // (counter-clockwise seen from above)
        push(b); push(e); push(d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (glow) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = !glow;
    return mesh;
  }

  #addRing(x, z, inner, outer) {
    this.rings.push({ x, z, inner, outer });
    const crust = new THREE.Mesh(new THREE.RingGeometry(inner - 3, outer + 3, 72).rotateX(-Math.PI / 2), this.crustMat);
    crust.position.set(x, 0.045, z);
    crust.receiveShadow = true;
    this.scene.add(crust);
    const geo = new THREE.RingGeometry(inner, outer, 72, 2).rotateX(-Math.PI / 2);
    const col = [], c = new THREE.Color(), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const d = Math.hypot(p.getX(i), p.getZ(i));
      const t = 1 - Math.abs((d - inner) / (outer - inner) - 0.5) * 2; // 1 in the middle of the moat
      c.copy(this.edge).lerp(this.hot, t);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const lava = new THREE.Mesh(geo, this.lavaMat);
    lava.position.set(x, 0.075, z);
    this.scene.add(lava);
  }

  #bridgeModel(b, rand) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    g.rotation.y = Math.atan2(b.tx, b.tz); // local z = along the river
    const slab = new THREE.Mesh(new THREE.BoxGeometry(b.across * 2, 0.24, b.along * 2),
      new THREE.MeshStandardMaterial({ color: 0x2c2624, flatShading: true, roughness: 1 }));
    slab.position.y = 0.04;
    slab.receiveShadow = true;
    g.add(slab);
    // A few cracks still glowing, and lumps along the edges.
    const glow = new THREE.MeshBasicMaterial({ color: this.edge });
    for (let n = 0; n < 4; n++) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(b.across * (0.4 + rand() * 0.8), 0.02, 0.15), glow);
      crack.position.set((rand() - 0.5) * b.across * 0.6, 0.17, (rand() - 0.5) * b.along * 1.6);
      crack.rotation.y = (rand() - 0.5) * 0.6;
      g.add(crack);
    }
    const lumpMat = new THREE.MeshStandardMaterial({ color: 0x1c1816, flatShading: true });
    for (let n = 0; n < 10; n++) {
      const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 + rand() * 0.5, 0), lumpMat);
      lump.position.set((rand() - 0.5) * b.across * 2, 0.15, (n % 2 ? 1 : -1) * b.along);
      lump.scale.y = 0.5;
      g.add(lump);
    }
    this.scene.add(g);
  }
}

const cellKey = (x, z) => `${Math.floor(x / GRID)},${Math.floor(z / GRID)}`;

function distToSeg(x, z, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
  return Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t));
}
