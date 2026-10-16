// The garage (press G). The game pauses, the camera orbits your car, and
// you bolt parts onto a grid. You never leave the driver's seat: the
// mechanics just climb all over the car while you wait.
//
//   Left click   bolt on the selected part
//   Right click  remove a part (anything only held on by it falls off too)
//   Right drag   spin the camera around      Wheel  zoom
//   1-9          pick a part                 F      mirror on/off
//   R            turn a loose car piece (nose, door...) before placing it
//   Ctrl/⌘ + Z   undo the last change
//   G / Esc      back to driving
//
// Opening the garage repairs everything still attached. Pieces that fell
// off have to be picked up out in the world (E) before you can bolt them
// back on: in their proper place, or anywhere you like (a door on the
// roof? sure). You can't open it with demons close by.
//
// The SHOP lives here too: spend souls to buy parts (+ Buy), unlock new
// ones (🔒), and upgrade your chassis from car toward HELL TANK.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SETTINGS } from '../settings.js';
import { PART_TYPES } from '../vehicle/parts.js';
import { BODY_CELLS, cellCenter, CELL, sectionOfCell, SECTION_NAMES, SECTION_PIECES, isSectionPiece, pieceInfo, pieceStats } from '../vehicle/build.js';
import { makePieceModel } from '../vehicle/pieceModel.js';

const KMH = 3.6;
const PART_LIST = Object.keys(PART_TYPES);

export class Garage {
  constructor({ camera, renderer, car, audio, progress }) {
    this.progress = progress;
    this.camera = camera;
    this.car = car;
    this.audio = audio;
    this.canvas = renderer.domElement;
    this.open = false;
    this.selected = 'armor';
    this.mirror = true;
    this.rot = 0; // quarter-turns for loose car pieces
    this.history = []; // snapshots of the build before each change (for undo)
    this.hover = null; // { i, j, k, normal, partKey, reason }

    // Camera controls (right-drag to orbit, wheel to zoom)
    this.controls = new OrbitControls(camera, this.canvas);
    this.controls.enabled = false;
    this.controls.enablePan = false;
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.minDistance = 4;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.enableDamping = true;

    // Invisible boxes for every filled cell (what the mouse points at),
    // plus a faint grid outline of the car body.
    this.hitGroup = new THREE.Group();
    this.hitGroup.visible = true;
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitGeo = new THREE.BoxGeometry(CELL, CELL, CELL);
    car.model.body.add(this.hitGroup);
    this.gridLines = this.#makeBodyGrid();
    this.gridLines.visible = false;
    car.model.body.add(this.gridLines);

    // Ghost preview of the part you're about to place.
    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    car.model.body.add(this.ghost);
    this.ghostOk = new THREE.MeshBasicMaterial({ color: 0x40ff60, transparent: true, opacity: 0.45, depthWrite: false });
    this.ghostBad = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.4, depthWrite: false });
    this.removeMark = new THREE.Mesh(new THREE.BoxGeometry(CELL * 1.04, CELL * 1.04, CELL * 1.04),
      new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.35, depthWrite: false }));
    this.removeMark.visible = false;
    car.model.body.add(this.removeMark);

    // Red outlines where body sections are missing.
    this.missingGhosts = new THREE.Group();
    this.missingMat = new THREE.MeshBasicMaterial({ color: 0xff4020, wireframe: true, transparent: true, opacity: 0.35 });
    car.model.body.add(this.missingGhosts);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.#buildUI();
    this.#bindInput();
  }

  // Redraw the lists/stats (e.g. after dev-mode switches change).
  refresh() { if (this.open) { this.car.applyBuild(); this.#rebuildHitBoxes(); this.#refreshUI(); } }

  // ------------------------------------------------------------------ open/close
  toggle() { this.open ? this.close() : this.openGarage(); }

  openGarage() {
    this.open = true;
    document.body.classList.add('garage-open');
    this.ui.style.display = 'block';
    this.car.model.body.rotation.set(0, 0, 0); // stop the body wobble
    this.savedFov = this.camera.fov;
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
    const target = this.car.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    const h = this.car.heading;
    this.camera.position.copy(target).addScaledVector(h, -6.5).add(new THREE.Vector3(h.z * 4, 3.5, -h.x * 4));
    this.controls.target.copy(target);
    this.controls.enabled = true;
    this.controls.update();
    this.gridLines.visible = true;
    // The mechanics patch up everything that's still attached.
    this.car.build.repairAll();
    this.history = [];
    this.car.applyBuild();
    this.#rebuildHitBoxes();
    this.#refreshUI();
  }

  close() {
    this.open = false;
    document.body.classList.remove('garage-open');
    this.ui.style.display = 'none';
    this.controls.enabled = false;
    this.camera.fov = this.savedFov;
    this.camera.updateProjectionMatrix();
    this.gridLines.visible = false;
    this.ghost.visible = false;
    this.removeMark.visible = false;
    this.missingGhosts.visible = false;
    this.car.build.save();
    this.car.savedBuild = this.car.build.snapshot(); // you respawn with this
  }

  update() {
    if (!this.open) return;
    this.controls.update();
    for (const f of this.car.boosterFlames) f.visible = false;
  }

  // ------------------------------------------------------------------ pointing
  #pick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObjects(this.hitGroup.children, false)[0];
    this.hover = null;
    this.ghost.visible = false;
    this.removeMark.visible = false;
    if (!hit) { this.#status(''); return; }
    const { i, j, k, isPart } = hit.object.userData;
    const n = hit.face.normal; // in the box's own space = car space
    const normal = [Math.round(n.x), Math.round(n.y), Math.round(n.z)];
    const ti = i + normal[0], tj = j + normal[1], tk = k + normal[2];
    const reason = !this.car.build.has(this.selected) ? `No ${pieceInfo(this.selected).name} left in stock. Find scrap out there (E)!`
      : this.car.build.whyNot(this.selected, ti, tj, tk, this.rot);
    this.hover = { i: ti, j: tj, k: tk, normal, reason, onPart: isPart ? { i, j, k } : null };

    // Ghost of the selected part
    this.ghost.clear();
    this.ghost.add(makePieceModel({ type: this.selected, i: ti, j: tj, k: tk, normal, rot: this.rot }));
    const m = reason ? this.ghostBad : this.ghostOk;
    this.ghost.traverse((o) => { if (o.isMesh) { o.material = m; o.castShadow = false; } });
    this.ghost.visible = true;

    if (isPart) {
      // Red box around the whole part under the mouse (big pieces fill several cells)
      const rec = this.car.build.parts.get(`${i},${j},${k}`);
      const cs = rec.cells.map((cell) => cellCenter(...cell));
      const min = { x: Math.min(...cs.map((q) => q.x)), y: Math.min(...cs.map((q) => q.y)), z: Math.min(...cs.map((q) => q.z)) };
      const max = { x: Math.max(...cs.map((q) => q.x)), y: Math.max(...cs.map((q) => q.y)), z: Math.max(...cs.map((q) => q.z)) };
      this.removeMark.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
      this.removeMark.scale.set((max.x - min.x) / CELL + 1, (max.y - min.y) / CELL + 1, (max.z - min.z) / CELL + 1);
      this.removeMark.visible = true;
    }
    const name = pieceInfo(this.selected).name;
    const turnHint = isSectionPiece(this.selected) ? ' · R: turn it' : '';
    this.#status(reason ? `✖ ${reason}${turnHint}` : `Left click: bolt on ${name}${turnHint}` + (isPart ? ' · Right click: remove the part under it' : ''), !!reason);
  }

  #place() {
    const h = this.hover;
    if (!h || h.reason) { this.audio.claw(); return; }
    const b = this.car.build;
    if (!b.has(this.selected)) { this.audio.claw(); this.#status(`✖ No ${pieceInfo(this.selected).name} left in stock. Find scrap out there (E)!`, true); return; }
    this.#remember();
    b.add(this.selected, h.i, h.j, h.k, h.normal, this.rot);
    if (this.mirror && b.has(this.selected) && !isSectionPiece(this.selected)) {
      const mi = -1 - h.i; // the matching cell on the other side
      if (mi !== h.i) b.add(this.selected, mi, h.j, h.k, [-h.normal[0], h.normal[1], h.normal[2]]);
    }
    this.audio.thump();
    this.#changed();
  }

  #remove() {
    const h = this.hover;
    if (!h || !h.onPart) return;
    const b = this.car.build;
    const { i, j, k } = h.onPart;
    this.#remember();
    const [removed] = b.remove(i, j, k);
    if (this.mirror && removed && !isSectionPiece(removed.type)) {
      const twin = b.parts.get(`${-1 - i},${j},${k}`);
      if (twin && twin.type === removed.type) b.remove(-1 - i, j, k);
    }
    this.audio.hit();
    this.#changed();
  }

  // Remember the build as it is now, so the next change can be undone.
  #remember() {
    this.history.push(this.car.build.snapshot());
    if (this.history.length > 100) this.history.shift();
  }

  #undo() {
    const snap = this.history.pop();
    if (!snap) { this.#status('Nothing to undo'); return; }
    this.car.build.load(snap); // (also puts the parts stock back the way it was)
    this.audio.hit();
    this.#changed();
    this.#status(`Undone. ${this.history.length ? this.history.length + ' more step' + (this.history.length > 1 ? 's' : '') + ' to undo.' : ''}`);
  }

  #changed() {
    this.car.applyBuild();
    this.#rebuildHitBoxes();
    this.#refreshUI(); // (may switch away from a piece you just used up)
    this.#pick();
    this.car.build.save();
  }

  #rebuildHitBoxes() {
    this.hitGroup.clear();
    const addBox = (i, j, k, isPart) => {
      const m = new THREE.Mesh(this.hitGeo, this.hitMat);
      const c = cellCenter(i, j, k);
      m.position.set(c.x, c.y, c.z);
      m.userData = { i, j, k, isPart };
      this.hitGroup.add(m);
    };
    for (const s of BODY_CELLS) {
      if (this.car.build.missing.has(sectionOfCell(s))) continue; // fell off: nothing to click on
      const [i, j, k] = s.split(',').map(Number);
      addBox(i, j, k, false);
    }
    for (const kk of this.car.build.parts.keys()) { const [i, j, k] = kk.split(',').map(Number); addBox(i, j, k, true); }
    this.hitGroup.updateMatrixWorld(true);

    // Outline the missing body sections
    this.missingGhosts.clear();
    this.missingGhosts.visible = true;
    for (const id of this.car.build.missing) {
      const g = this.car.model.sections[id].clone(true);
      g.visible = true;
      g.traverse((o) => { if (o.isMesh) { o.material = this.missingMat; o.castShadow = false; } });
      this.missingGhosts.add(g);
    }
  }

  #makeBodyGrid() {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(CELL, CELL, CELL));
    const mat = new THREE.LineBasicMaterial({ color: 0x80ffa0, transparent: true, opacity: 0.18, depthWrite: false });
    const g = new THREE.Group();
    for (const s of BODY_CELLS) {
      const [i, j, k] = s.split(',').map(Number);
      const l = new THREE.LineSegments(edges, mat);
      const c = cellCenter(i, j, k);
      l.position.set(c.x, c.y, c.z);
      g.add(l);
    }
    return g;
  }

  // ------------------------------------------------------------------ input
  #bindInput() {
    let downAt = null;
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.open) return;
      this.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.#pick();
    });
    this.canvas.addEventListener('pointerdown', (e) => { if (this.open) downAt = { x: e.clientX, y: e.clientY, b: e.button }; });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!this.open || !downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6;
      if (!moved && downAt.b === 0) this.#place();
      if (!moved && downAt.b === 2) this.#remove();
      downAt = null;
    });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.#undo(); return; }
      const n = Number(e.key);
      const list = this.#palette();
      if (n >= 1 && n <= list.length) this.#select(list[n - 1]);
      if (e.code === 'KeyF') this.#toggleMirror();
      if (e.code === 'KeyR') { this.rot = (this.rot + 1) % 4; this.#pick(); }
    });
  }

  // What's in the parts list: every normal part, plus loose car pieces
  // (nose, doors...) only while you have some in stock.
  // What's in the parts list you can pick from: every unlocked part, plus
  // loose car pieces (nose, doors...) only while you have some in stock.
  #palette() {
    const b = this.car.build;
    const parts = PART_LIST.filter((t) => this.progress.isUnlocked(t));
    return [...parts, ...SECTION_PIECES.filter((t) => SETTINGS.build.unlimitedParts || (b.inventory[t] || 0) > 0)];
  }
  #lockedParts() { return PART_LIST.filter((t) => !this.progress.isUnlocked(t)); }

  #buy(type) {
    const price = SETTINGS.shop[type]?.price;
    if (price == null) return;
    if (!this.progress.spend(price)) { this.audio.claw(); this.#status(`✖ Not enough souls: ${pieceInfo(type).name} costs ${price} ✦`, true); return; }
    this.car.build.give(type);
    this.car.build.save();
    this.audio.chime();
    this.#status(`Bought a ${pieceInfo(type).name} (-${price} ✦)`);
    this.selected = type;
    this.#refreshUI();
  }

  #unlock(type) {
    const cost = SETTINGS.shop[type].unlock;
    if (!this.progress.unlock(type)) { this.audio.claw(); this.#status(`✖ Not enough souls: unlocking ${pieceInfo(type).name} costs ${cost} ✦`, true); return; }
    this.audio.wreck();
    this.#status(`Unlocked: ${pieceInfo(type).name}! Buy some with + Buy.`);
    this.selected = type;
    this.#refreshUI();
  }

  #upgradeChassis() {
    const next = this.progress.nextTier;
    if (!next) return;
    if (!this.progress.upgradeTier()) { this.audio.claw(); this.#status(`✖ Not enough souls: ${next.name} costs ${next.cost} ✦`, true); return; }
    this.car.setTier(this.progress.tier);
    this.history = []; // (a chassis upgrade can't be undone)
    this.audio.wreck();
    this.#changed();
    this.#status(`Upgraded to the ${next.name}!`);
  }

  #select(type) {
    this.selected = type;
    this.#pick();
    this.#refreshUI();
  }

  #toggleMirror() {
    this.mirror = !this.mirror;
    this.#refreshUI();
  }

  // ------------------------------------------------------------------ UI
  #buildUI() {
    const ui = document.createElement('div');
    ui.id = 'garage';
    ui.style.display = 'none';
    ui.innerHTML = `
      <div class="g-title">🔧 GARAGE <small>the game is paused · you stay in the car, the mechanics do the rest</small></div>
      <div class="g-souls"></div>
      <div class="g-parts">
        <div class="g-list"></div>
        <div class="g-row">
          <button class="g-mirror"></button>
          <button class="g-clear">🗑️ Clear all</button>
        </div>
        <div class="g-row">
          <button class="g-undo">↶ Undo (Ctrl/⌘+Z)</button>
        </div>
      </div>
      <div class="g-stats"></div>
      <div class="g-status"></div>
      <div class="g-help"><b>Left click</b> bolt on · <b>Right click</b> remove · <b>Right drag</b> spin view · <b>Wheel</b> zoom · <b>1-9</b> pick part · <b>R</b> turn piece · <b>F</b> mirror · <b>Ctrl/⌘+Z</b> undo · <b>G</b> back to driving</div>
      <button class="g-done">DRIVE! (G)</button>`;
    document.body.appendChild(ui);
    this.ui = ui;
    ui.querySelector('.g-list').addEventListener('click', (e) => {
      const buy = e.target.closest('[data-buy]');
      if (buy) { this.#buy(buy.dataset.buy); return; }
      const unl = e.target.closest('[data-unlock]');
      if (unl) { this.#unlock(unl.dataset.unlock); return; }
      const row = e.target.closest('[data-type]');
      if (row) this.#select(row.dataset.type);
    });
    ui.querySelector('.g-mirror').addEventListener('click', () => this.#toggleMirror());
    ui.querySelector('.g-clear').addEventListener('click', () => { this.#remember(); this.car.build.clear(); this.#changed(); });
    ui.querySelector('.g-undo').addEventListener('click', () => this.#undo());
    ui.querySelector('.g-done').addEventListener('click', () => this.close());
    // "Rebuild" buttons for missing body sections
    ui.querySelector('.g-stats').addEventListener('click', (e) => {
      if (e.target.closest('[data-upgrade]')) { this.#upgradeChassis(); return; }
      const id = e.target.dataset?.restore;
      if (!id) return;
      this.#remember();
      const why = this.car.build.restoreSection(id);
      if (why) this.history.pop();
      if (why) { this.audio.claw(); this.#status(`✖ ${why}`, true); return; }
      this.audio.thump();
      this.#changed();
    });
  }

  #status(text, bad = false) {
    const el = this.ui.querySelector('.g-status');
    el.textContent = text;
    el.classList.toggle('bad', bad);
  }

  #refreshUI() {
    this.ui.querySelector('.g-undo').disabled = !this.history.length;
    const list = this.#palette();
    if (!list.includes(this.selected)) this.selected = list[0];
    const unlimited = SETTINGS.build.unlimitedParts;
    const souls = Math.floor(this.progress.souls);
    this.ui.querySelector('.g-souls').innerHTML = `✦ <b>${souls}</b> souls`;
    const rows = list.map((t, idx) => {
      const info = pieceInfo(t);
      const n = this.car.build.inventory[t] || 0;
      const price = SETTINGS.shop[t]?.price;
      const cls = ['g-item', t === this.selected ? 'sel' : '', !unlimited && n <= 0 ? 'empty' : '', isSectionPiece(t) ? 'piece' : ''].join(' ');
      const buy = price != null && !unlimited ? `<button class="g-buy ${souls < price ? 'cant' : ''}" data-buy="${t}">+ Buy ${price} ✦</button>` : '';
      return `<div data-type="${t}" class="${cls}"><span class="ico">${info.icon}</span>
        <span class="nm">${idx < 9 ? idx + 1 + '. ' : ''}${info.name}<small>${info.desc}</small></span>
        <span class="kg"><b>${unlimited ? '∞' : '×' + n}</b><br>${pieceStats(t).mass} kg${buy ? '<br>' + buy : ''}</span></div>`;
    });
    // Locked parts at the bottom, with their unlock price
    for (const t of this.#lockedParts()) {
      const info = pieceInfo(t), cost = SETTINGS.shop[t].unlock;
      rows.push(`<div class="g-item locked"><span class="ico">🔒</span>
        <span class="nm">${info.name}<small>${info.desc}</small></span>
        <span class="kg"><button class="g-buy unlock ${souls < cost ? 'cant' : ''}" data-unlock="${t}">Unlock ${cost} ✦</button></span></div>`);
    }
    this.ui.querySelector('.g-list').innerHTML = rows.join('');
    this.ui.querySelector('.g-mirror').textContent = `🪞 Mirror: ${this.mirror ? 'ON' : 'OFF'} (F)`;
    this.ui.querySelector('.g-stats').innerHTML = statsHTML(this.car.build.stats()) + bodyHTML(this.car.build) + chassisHTML(this.progress);
  }
}

// ---------------------------------------------------------------- the numbers
// Estimates of how the build will drive, compared to the bare car.
function performance(st) {
  const S = SETTINGS;
  const roll = S.car.rollingResistance * S.car.gravity * (st.mass / S.steering.referenceMass);
  // Real top speed: where engine push = rolling drag
  const top = st.topSpeed * Math.sqrt(Math.max(0, 1 - (roll * st.mass) / st.enginePower));
  // 0-100 km/h: quick simulation using the same maths as the car
  let v = 0, t = 0;
  while (v < 100 / 3.6 && t < 30) {
    const r = Math.min(v / st.topSpeed, 1);
    v += (st.enginePower * (1 - r * r) / st.mass - roll) / 60;
    t += 1 / 60;
  }
  const bal = st.balance * S.build.balanceEffect;
  const turn = Math.pow(S.steering.referenceMass / st.mass, S.steering.weightTurnPenalty) * (bal > 0 ? 1 - 0.3 * bal : 1 - 0.1 * bal);
  const splat = (side) => S.ramming.splatSpeedKmh * Math.sqrt(S.steering.referenceMass / (st.mass * (1 + st.ramBonus[side])));
  return { top: top * KMH, zeroHundred: t >= 30 ? null : t, turn: turn * 100, splatFront: splat('0,1'), splatSide: splat('1,0'), splatBack: splat('0,-1') };
}

function statsHTML(st) {
  const p = performance(st);
  const stock = performance({ ...st, mass: SETTINGS.car.mass, enginePower: SETTINGS.car.enginePower, topSpeed: SETTINGS.car.topSpeed, balance: 0, ramBonus: { '0,1': 0, '1,0': 0, '0,-1': 0, '-1,0': 0 } });
  const diff = (a, b, better, unit = '', dec = 0) => {
    const d = a - b;
    if (Math.abs(d) < 0.05) return '';
    const good = better === 'up' ? d > 0 : d < 0;
    return `<em class="${good ? 'good' : 'bad'}">${d > 0 ? '+' : ''}${d.toFixed(dec)}${unit}</em>`;
  };
  const bal = st.balance;
  const balText = bal > 0.15 ? 'Nose heavy → understeer' : bal < -0.15 ? 'Tail heavy → oversteer' : 'Balanced';
  const row = (label, value, extra = '') => `<div><span>${label}</span><b>${value}</b>${extra}</div>`;
  return `
    <div class="g-sub">YOUR MONSTROSITY</div>
    ${row('Parts', `${st.count} / ${SETTINGS.build.maxParts}`)}
    ${row('Weight', `${Math.round(st.mass)} kg`, diff(st.mass, SETTINGS.car.mass, 'down', ' kg'))}
    ${row('Top speed', `${Math.round(p.top)} km/h`, diff(p.top, stock.top, 'up'))}
    ${row('0–100 km/h', p.zeroHundred ? `${p.zeroHundred.toFixed(1)} s` : 'never!', p.zeroHundred ? diff(p.zeroHundred, stock.zeroHundred, 'down', ' s', 1) : '')}
    ${row('Turning', `${Math.round(p.turn)}%`, diff(p.turn, stock.turn, 'up', '%'))}
    ${row('Guns', st.guns)}
    <div class="g-sub">SPLATS IMPS FROM</div>
    ${row('Front', `${Math.round(p.splatFront)} km/h`, diff(p.splatFront, stock.splatFront, 'down'))}
    ${row('Sides', `${Math.round(p.splatSide)} km/h`, diff(p.splatSide, stock.splatSide, 'down'))}
    ${row('Back', `${Math.round(p.splatBack)} km/h`, diff(p.splatBack, stock.splatBack, 'down'))}
    <div class="g-sub">BALANCE</div>
    <div class="g-bal"><i style="left:${50 + bal * 45}%"></i><span>tail</span><span>nose</span></div>
    <div class="g-baltext">${balText}</div>`;
}

// Body sections: OK, or missing with a "Rebuild" button.
function bodyHTML(build) {
  const rows = Object.entries(SECTION_NAMES).filter(([id]) => id !== 'cabin').map(([id, name]) => {
    if (!build.missing.has(id)) return `<div><span>${name}</span><b class="ok">OK</b></div>`;
    if (build.has(id)) return `<div><span>${name}</span><button class="g-restore" data-restore="${id}">Put it back</button></div>`;
    return `<div><span>${name}</span><b class="lost">LOST — find it (E)</b></div>`;
  });
  return `<div class="g-sub">BODY <small>(repaired when you open the garage)</small></div>${rows.join('')}`;
}

// Chassis: what you drive now, and the next step toward the HELL TANK.
const TIER_BLURB = {
  armored: 'steel plates, tougher body, more engine, 40% lava resist',
  halftrack: 'rear treads: grips hard, drifts less, much tougher, 50% lava resist',
  tank: 'full treads, spins on the spot, huge armor + a big cannon, 60% lava resist',
};
function chassisHTML(progress) {
  const now = progress.tierInfo, next = progress.nextTier;
  const souls = Math.floor(progress.souls);
  const up = next
    ? `<button class="g-upgrade ${souls < next.cost ? 'cant' : ''}" data-upgrade="1">Upgrade → ${next.name} · ${next.cost} ✦</button><div class="g-blurb">${TIER_BLURB[next.id] || ''}</div>`
    : '<div class="g-blurb">Fully upgraded. Go wreck something.</div>';
  return `<div class="g-sub">CHASSIS</div><div><span>Now</span><b>${now.name}</b></div>${up}`;
}
