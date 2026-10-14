// Trackside details shared by every map: tyre walls, sponsor banners,
// waving flags, a pit garage building, a TV helicopter and grass tufts.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js/+esm';
import { adTexture, flagTexture, pitTexture } from './textures.js';

function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

function placeInstances(geo, mat, list, { cast = false } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  const o = new THREE.Object3D();
  list.forEach((t, i) => {
    o.position.set(t.x, t.y || 0, t.z);
    o.rotation.set(0, t.ry || 0, 0);
    o.scale.setScalar(t.s || 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (t.color) m.setColorAt(i, t.color);
  });
  m.count = list.length;
  m.castShadow = cast;
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return m;
}

export function addTrackDetails({ scene, path, T, hi, rand, df, heightAt, standSide, propMat, updaters, disposables }) {
  const wall = path.wallDist;
  const L = path.length;
  const N = path.count;
  const step = path.step;
  const ry = (fx, fz) => Math.atan2(fx, fz);
  const straight = (i, span = 10, lim = 1 / 500) => {
    for (let k = -span; k <= span; k++) if (Math.abs(path.curv[path.wrapIndex(i + k)]) > lim) return false;
    return true;
  };

  // --- Tyre walls in front of the barrier on the outside of tight corners ------
  {
    const parts = [];
    const ringCols = ['#e3242b', '#f5f5f5'];
    for (let k = 0; k < 3; k++) {
      parts.push(colored(new THREE.CylinderGeometry(0.42, 0.42, 0.29, 12).translate(0, 0.15 + k * 0.3, 0), '#18181a'));
    }
    parts.push(colored(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 12).translate(0, 0.88, 0), ringCols[0]));
    const geoA = mergeGeometries(parts);
    const geoB = mergeGeometries([...parts.slice(0, 3), colored(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 12).translate(0, 0.88, 0), ringCols[1])]);
    const listA = [];
    const listB = [];
    let n = 0;
    for (let i = 0; i < N; i += Math.max(1, Math.round(0.9 / step))) {
      const k = path.curv[i];
      if (Math.abs(k) < 1 / 130) continue;
      const side = k > 0 ? -1 : 1;
      const off = side * (wall - 0.46);
      (n++ % 2 ? listA : listB).push({ x: path.px[i] + path.nx[i] * off, z: path.pz[i] + path.nz[i] * off, ry: rand() * 6 });
    }
    if (listA.length) scene.add(placeInstances(geoA, propMat, listA, { cast: hi }));
    if (listB.length) scene.add(placeInstances(geoB, propMat, listB, { cast: hi }));
    disposables.push(geoA, geoB);
  }

  // --- Sponsor banners along the straights -------------------------------------
  {
    const geo = new THREE.PlaneGeometry(7, 0.72);
    const lists = [[], [], [], [], []];
    let n = 0;
    const gap = Math.round(24 / step);
    for (let i = 0; i < N; i += gap) {
      if (!straight(i)) continue;
      const side = n % 2 ? 1 : -1;
      const off = side * (wall - 0.03);
      const fx = -side * path.nx[i];
      const fz = -side * path.nz[i];
      lists[n % 5].push({ x: path.px[i] + path.nx[i] * off, y: 0.55, z: path.pz[i] + path.nz[i] * off, ry: ry(fx, fz) });
      n++;
    }
    lists.forEach((list, i) => {
      if (!list.length) return;
      const tex = adTexture(i);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: T.night ? 0xffffff : 0x000000, emissiveMap: T.night ? tex : null, emissiveIntensity: 0.55 });
      scene.add(placeInstances(geo, mat, list));
      disposables.push(mat);
    });
    disposables.push(geo);
  }

  // --- Waving flags along the start straight --------------------------------------
  {
    const flags = [];
    const poleMat = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.8, roughness: 0.3 });
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 6, 8).translate(0, 3, 0);
    for (let k = -4; k <= 4; k++) {
      if (k === 0) continue;
      const i = path.indexAt((k * 22 + L) % L);
      for (const side of [1, -1]) {
        const off = side * (wall + 1.2);
        const x = path.px[i] + path.nx[i] * off;
        const z = path.pz[i] + path.nz[i] * off;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 0, z);
        scene.add(pole);
        const geo = new THREE.PlaneGeometry(1.7, 1.05, 10, 1).translate(0.85, 0, 0);
        const mat = new THREE.MeshStandardMaterial({ map: flagTexture(Math.abs(k) + (side > 0 ? 1 : 0)), side: THREE.DoubleSide, roughness: 0.8 });
        const flag = new THREE.Mesh(geo, mat);
        flag.position.set(x, 5.4, z);
        flag.rotation.y = Math.atan2(path.tx[i], path.tz[i]) + Math.PI / 2;
        scene.add(flag);
        flags.push({ geo, base: geo.attributes.position.array.slice(), phase: rand() * 6 });
        disposables.push(geo, mat);
      }
    }
    disposables.push(poleMat, poleGeo);
    let t = 0;
    updaters.push((dt) => {
      t += dt;
      for (const f of flags) {
        const p = f.geo.attributes.position;
        for (let v = 0; v < p.count; v++) {
          const x = f.base[v * 3];
          p.array[v * 3 + 2] = Math.sin(t * 7 + x * 3 + f.phase) * 0.14 * x;
        }
        p.needsUpdate = true;
      }
    });
  }

  // --- Pit garage building beside the main straight ------------------------------
  {
    const side = -standSide;
    const i = path.indexAt(40);
    const len = 72;
    const depth = 12;
    const h = 6;
    const off = side * (wall + 6 + depth / 2);
    const cx = path.px[i] + path.nx[i] * off;
    const cz = path.pz[i] + path.nz[i] * off;
    const heading = Math.atan2(path.tx[i], path.tz[i]);
    let fits = true;
    for (const a of [-len / 2, 0, len / 2]) {
      for (const b of [-depth / 2, depth / 2]) {
        const x = cx + path.tx[i] * a + path.nx[i] * side * b;
        const z = cz + path.tz[i] * a + path.nz[i] * side * b;
        if (df.at(x, z) < wall + 4) fits = false;
      }
    }
    if (fits) {
      const g = new THREE.Group();
      const wallMat = new THREE.MeshStandardMaterial({ color: '#d9dde4', roughness: 0.7 });
      const tex = pitTexture().clone();
      tex.repeat.set(len / 32, 1);
      tex.needsUpdate = true;
      const frontMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(len, h, depth), [wallMat, wallMat, wallMat, wallMat, frontMat, wallMat]);
      body.position.y = h / 2;
      body.castShadow = hi;
      body.receiveShadow = hi;
      g.add(body);
      const roofMat = new THREE.MeshStandardMaterial({ color: '#2b2e36', roughness: 0.5, metalness: 0.4 });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 0.5, depth + 4), roofMat);
      roof.position.set(0, h + 0.25, 1.5);
      roof.castShadow = hi;
      g.add(roof);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(len - 4, 2.4, 0.2),
        new THREE.MeshStandardMaterial({ color: '#0e1a2a', metalness: 0.6, roughness: 0.1, emissive: T.night ? '#3a6aa8' : '#000000', emissiveIntensity: 0.6 }),
      );
      glass.position.set(0, h + 1.9, depth / 2 - 1.15);
      g.add(glass);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(len - 3, 3, depth - 1.2), wallMat);
      upper.position.set(0, h + 1.9, -0.6);
      g.add(upper);
      // Local +Z of the building faces the track.
      g.position.set(cx, 0, cz);
      g.rotation.y = heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      scene.add(g);
      disposables.push(wallMat, frontMat, roofMat, tex);
    }
  }

  // --- TV helicopter following the action ------------------------------------------
  {
    const heli = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.4, metalness: 0.2 });
    const stripe = new THREE.MeshStandardMaterial({ color: '#d8232a', roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 0.3, metalness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({ color: '#10243a', metalness: 0.7, roughness: 0.1 });
    const cab = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), body);
    cab.scale.set(1.2, 1.1, 2.0);
    heli.add(cab);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    canopy.scale.set(1.05, 0.9, 1.3);
    canopy.rotation.x = Math.PI / 2.4;
    canopy.position.set(0, 0.15, 1.0);
    heli.add(canopy);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 4.2, 10), stripe);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.3, -3.6);
    heli.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.7), stripe);
    fin.position.set(0, 0.9, -5.5);
    heli.add(fin);
    for (const x of [-0.8, 0.8]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.4), dark);
      skid.position.set(x, -1.45, 0);
      heli.add(skid);
      for (const z of [-0.8, 0.8]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), dark);
        strut.position.set(x * 0.85, -1.15, z);
        heli.add(strut);
      }
    }
    const rotor = new THREE.Group();
    for (let k = 0; k < 2; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 0.35), dark);
      blade.rotation.y = (k * Math.PI) / 2;
      rotor.add(blade);
    }
    rotor.position.y = 1.25;
    heli.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.2), dark);
    tailRotor.position.set(0.25, 0.9, -5.6);
    heli.add(tailRotor);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2020' }));
    light.position.set(0, -1.0, 0);
    heli.add(light);
    heli.traverse((o) => {
      if (o.isMesh) o.castShadow = hi;
    });
    heli.position.set(path.px[0], 40, path.pz[0]);
    scene.add(heli);
    disposables.push(body, stripe, dark, glass);
    let t = 0;
    const vel = new THREE.Vector3();
    const target = new THREE.Vector3();
    updaters.push((dt, cam, focus) => {
      t += dt;
      rotor.rotation.y += dt * 28;
      tailRotor.rotation.x += dt * 40;
      light.visible = Math.floor(t * 1.5) % 2 === 0;
      if (!focus) return;
      // Circle above and beside the player.
      const a = t * 0.12;
      target.set(focus.x + Math.cos(a) * 45, 34 + Math.sin(t * 0.3) * 4, focus.z + Math.sin(a) * 45);
      vel.subVectors(target, heli.position).multiplyScalar(Math.min(1, dt * 0.6));
      heli.position.add(vel);
      const yaw = Math.atan2(focus.x - heli.position.x, focus.z - heli.position.z);
      heli.rotation.y += Math.atan2(Math.sin(yaw - heli.rotation.y), Math.cos(yaw - heli.rotation.y)) * Math.min(1, dt * 1.5);
      heli.rotation.x = 0.12;
    });
  }

  // --- Grass tufts and flowers near the track (green maps) ------------------------
  if (T.ground === 'grass' || T.ground === 'autumn') {
    const blade = new THREE.PlaneGeometry(0.5, 0.55).translate(0, 0.27, 0);
    const tuftGeo = mergeGeometries([
      colored(blade.clone(), '#ffffff'),
      colored(blade.clone().rotateY(Math.PI / 3), '#ffffff'),
      colored(blade.clone().rotateY((2 * Math.PI) / 3), '#ffffff'),
    ]);
    const tuftMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
    const tufts = [];
    const flowers = [];
    const flowerCols = T.ground === 'grass' ? ['#ffffff', '#ffd23f', '#ff6fb5', '#b18cff'] : ['#ff8a1a', '#d9531e', '#e8c040'];
    const greens = T.ground === 'grass' ? ['#4f8a2c', '#5f9a35', '#6aa83a'] : ['#8a8a32', '#9a7a2a', '#7a6a2a'];
    const count = hi ? 2600 : 1100;
    let tries = 0;
    while (tufts.length + flowers.length < count && tries < count * 20) {
      tries++;
      const i = Math.floor(rand() * N);
      const side = rand() < 0.5 ? 1 : -1;
      const off = side * (wall + 1 + Math.pow(rand(), 1.5) * 45);
      const x = path.px[i] + path.nx[i] * off + (rand() - 0.5) * 3;
      const z = path.pz[i] + path.nz[i] * off + (rand() - 0.5) * 3;
      if (df.at(x, z) < wall + 0.8) continue;
      const item = { x, y: heightAt(x, z), z, ry: rand() * 6, s: 0.7 + rand() * 0.9 };
      if (rand() < 0.22) flowers.push({ ...item, s: 0.5 + rand() * 0.5, color: new THREE.Color(flowerCols[Math.floor(rand() * flowerCols.length)]) });
      else tufts.push({ ...item, color: new THREE.Color(greens[Math.floor(rand() * greens.length)]) });
    }
    if (tufts.length) scene.add(placeInstances(tuftGeo, tuftMat, tufts));
    const flowerGeo = mergeGeometries([
      colored(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4).translate(0, 0.2, 0), '#3f7a2a'),
      colored(new THREE.IcosahedronGeometry(0.12, 0).translate(0, 0.42, 0), '#ffffff'),
    ]);
    if (flowers.length) scene.add(placeInstances(flowerGeo, propMat, flowers));
    disposables.push(blade, tuftGeo, tuftMat, flowerGeo);
  }
}
