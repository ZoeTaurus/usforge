'use strict';
// ============================================================ the player, the staff, and what they do

const PW = 8, PH = 5;                 // half extents of the feet box everyone collides with
const WALK = 3.3 * T, RUN = 5.3 * T;
const REACH = 2.4 * T;
const CARRY = 24;                     // how much furniture weight you can carry

let player, teachers, particles, stats;
let voiceFreeAt = 0, lastLine = '', spawnTimer = 0, principalOut = false, nightClock = 0, stingCD = 0;

function newPlayer(x, y) {
  return { x, y, vx: 0, vy: 0, ang: 0, dir: 0, walk: 0, moving: false, running: false, tired: false,
    hp: 10, stam: 1, battery: 1, flash: true, inv: {}, order: [], sel: 0,
    snacks: { apple: 0, milk: 0, chips: 0, bandage: 0 },
    swing: 0, swingCD: 0, iframes: 0, regen: 0, stepT: 0, noiseT: 0, lowBeep: 0 };
}

// ---------------------------------------------------------------- moving a box through the tile grid
function boxFree(x, y, hw, hh) {
  const x0 = Math.floor((x - hw) / T), x1 = Math.floor((x + hw - .01) / T), y0 = Math.floor((y - hh) / T), y1 = Math.floor((y + hh - .01) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return false;
  return true;
}
// moves along each axis separately and slides around corners it only clips by a few pixels
function moveBox(e, dx, dy, hw = PW, hh = PH) {
  let moved = false;
  if (dx) {
    if (boxFree(e.x + dx, e.y, hw, hh)) { e.x += dx; moved = true; }
    else if (!dy) for (let o = 1; o <= 7; o++) {
      if (boxFree(e.x + dx, e.y - o, hw, hh) && boxFree(e.x, e.y - o, hw, hh)) { e.y -= Math.min(o, Math.abs(dx)); moved = true; break; }
      if (boxFree(e.x + dx, e.y + o, hw, hh) && boxFree(e.x, e.y + o, hw, hh)) { e.y += Math.min(o, Math.abs(dx)); moved = true; break; }
    }
  }
  if (dy) {
    if (boxFree(e.x, e.y + dy, hw, hh)) { e.y += dy; moved = true; }
    else if (!dx) for (let o = 1; o <= 7; o++) {
      if (boxFree(e.x - o, e.y + dy, hw, hh) && boxFree(e.x - o, e.y, hw, hh)) { e.x -= Math.min(o, Math.abs(dy)); moved = true; break; }
      if (boxFree(e.x + o, e.y + dy, hw, hh) && boxFree(e.x + o, e.y, hw, hh)) { e.x += Math.min(o, Math.abs(dy)); moved = true; break; }
    }
  }
  return moved;
}
const dirOf = a => { const d = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return d < Math.PI / 4 || d >= Math.PI * 7 / 4 ? 2 : d < Math.PI * 3 / 4 ? 0 : d < Math.PI * 5 / 4 ? 3 : 1; };

// ---------------------------------------------------------------- line of sight through the tile grid
function clearLine(x0, y0, x1, y1, blocked) {
  let tx = Math.floor(x0 / T), ty = Math.floor(y0 / T);
  const ex = Math.floor(x1 / T), ey = Math.floor(y1 / T), dx = x1 - x0, dy = y1 - y0;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const ddx = dx ? Math.abs(T / dx) : Infinity, ddy = dy ? Math.abs(T / dy) : Infinity;
  let mx = dx ? ((dx > 0 ? (tx + 1) * T - x0 : x0 - tx * T) / Math.abs(dx)) : Infinity;
  let my = dy ? ((dy > 0 ? (ty + 1) * T - y0 : y0 - ty * T) / Math.abs(dy)) : Infinity;
  for (let n = 0; n < 300 && (tx !== ex || ty !== ey); n++) {
    if (mx < my) { mx += ddx; tx += sx; } else { my += ddy; ty += sy; }
    if (tx === ex && ty === ey) break;
    if (blocked(tx, ty)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- path finding (A* over a window of the store)
const AS_MAX = 5200;
const asG = new Float32Array(AS_MAX), asCame = new Int32Array(AS_MAX), asCost = new Float32Array(AS_MAX), asClosed = new Uint8Array(AS_MAX);
const hpN = new Int32Array(AS_MAX * 4), hpF = new Float32Array(AS_MAX * 4);
function tileCost(x, y) {
  if (tileAt(x, y) === WALL) return -1;
  const k = K(x, y), f = furn.get(k);
  if (f) return 4 + f.hp * .8;
  const d = doors.get(k);
  if (d && d.closed) return 3;
  return 1;
}
function astar(sx, sy, gx, gy) {
  const pad = 9, minX = Math.min(sx, gx) - pad, minY = Math.min(sy, gy) - pad;
  const w = Math.abs(sx - gx) + pad * 2 + 1, h = Math.abs(sy - gy) + pad * 2 + 1, N = w * h;
  if (N > AS_MAX) return null;
  asG.fill(Infinity, 0, N); asCame.fill(-1, 0, N); asCost.fill(0, 0, N); asClosed.fill(0, 0, N);
  let size = 0;
  const push = (i, f) => { let j = size++; hpN[j] = i; hpF[j] = f; while (j > 0) { const p = (j - 1) >> 1; if (hpF[p] <= hpF[j]) break; [hpN[p], hpN[j]] = [hpN[j], hpN[p]]; [hpF[p], hpF[j]] = [hpF[j], hpF[p]]; j = p; } };
  const pop = () => {
    const top = hpN[0]; size--; hpN[0] = hpN[size]; hpF[0] = hpF[size];
    let j = 0;
    for (;;) { const l = j * 2 + 1, r = l + 1; let m = j; if (l < size && hpF[l] < hpF[m]) m = l; if (r < size && hpF[r] < hpF[m]) m = r; if (m === j) break; [hpN[m], hpN[j]] = [hpN[j], hpN[m]]; [hpF[m], hpF[j]] = [hpF[j], hpF[m]]; j = m; }
    return top;
  };
  const si = (sy - minY) * w + (sx - minX), gi = (gy - minY) * w + (gx - minX);
  asG[si] = 0; push(si, Math.abs(sx - gx) + Math.abs(sy - gy));
  while (size > 0 && size < AS_MAX * 4 - 4) {
    const i = pop();
    if (asClosed[i]) continue;
    asClosed[i] = 1;
    if (i === gi) break;
    const x = i % w, y = (i / w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (asClosed[ni]) continue;
      let c = asCost[ni];
      if (c === 0) { c = ni === gi ? 1 : tileCost(nx + minX, ny + minY); asCost[ni] = c; }
      if (c < 0) continue;
      const ng = asG[i] + c;
      if (ng < asG[ni]) { asG[ni] = ng; asCame[ni] = i; push(ni, ng + Math.abs(nx + minX - gx) + Math.abs(ny + minY - gy)); }
    }
  }
  if (asCame[gi] === -1 && gi !== si) return null;
  const path = [];
  for (let i = gi; i !== si && i !== -1; i = asCame[i]) path.push([(i % w) + minX, ((i / w) | 0) + minY]);
  path.push([sx, sy]);
  return path.reverse();
}

// ---------------------------------------------------------------- particles
function puff(x, y, n, cols, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(opts.smin || 10, opts.smax || 50);
    particles.push({ x: x + rand(-6, 6), y: y + rand(-4, 4), vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 0), life: rand(.3, opts.life || .7), max: opts.life || .7,
      col: pick(cols), size: opts.size || 1, grav: opts.grav || 0, z: opts.z || 0 });
  }
}
function updateParticles(dt) {
  for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= .96; p.vy *= .96; }
  particles = particles.filter(p => p.life > 0);
  if (particles.length > 600) particles.splice(0, particles.length - 600);
}

// ---------------------------------------------------------------- staff
// what each kind of staff is like after dark
const KINDS = {
  teacher: { name: 'EMPLOYEE', hp: 4, speed: 1, sight: 1, dmg: 1, smash: 1, bangRate: .9, door: 1.3 },
  janitor: { name: 'CLEANER', hp: 4, speed: 1, sight: 1, dmg: 1, smash: 2, bangRate: .9, door: .5 },
  principal: { name: 'THE MANAGER', hp: 12, speed: .8, sight: 1, dmg: 2, smash: 3, bangRate: .55, door: .6, spread: 3 },
  substitute: { name: 'THE NEW HIRE', hp: 2, speed: 1.4, sight: .8, dmg: 1, smash: 1, bangRate: .7, door: .8, lines: ['roll_call', 'raise_hand', 'homework', 'late', 'sit_down'] },
  monitor: { name: 'SECURITY', hp: 5, speed: .75, sight: 1.3, dark: true, dmg: 1, smash: 1, bangRate: 1, door: 1.3, whistle: true, lines: ['hall_pass', 'no_running', 'late', 'detention'] },
  lunch: { name: 'THE COOK', hp: 6, speed: .82, sight: .9, dmg: 2, smash: 2, bangRate: .6, door: 1, lines: ['detention', 'sit_down', 'let_me_in', 'stay_after', 'come_back'] },
  coach: { name: 'THE STOCKER', hp: 5, speed: 1, sight: 1.1, dmg: 1, smash: 1, bangRate: .8, door: 1, charge: true, lines: ['no_running', 'late', 'come_back', 's_over'] },
  librarian: { name: 'THE GREETER', hp: 3, speed: 1.7, sight: 1.2, dmg: 1, smash: 1, bangRate: .9, door: 1.3, stalker: true, silent: true }
};
const kindOf = t => KINDS[t.kind] || KINDS.teacher;
// who comes out at night: more kinds of staff join the night shift as the days go by
function pickKind() {
  const pool = ['teacher', 'teacher', 'teacher', 'monitor', 'substitute'];
  if (dayNum >= 2) pool.push('lunch', 'coach', 'teacher');
  if (dayNum >= 3) pool.push('librarian', 'substitute', 'coach');
  if (dayNum >= 4) pool.push('librarian', 'monitor', 'lunch');
  return pick(pool);
}
function makeTeacher(tx, ty, o) {
  const kind = o.kind || 'teacher';
  const v = o.v !== undefined ? o.v : (Math.random() * CAST.teachers.length) | 0;
  const sp = kind === 'principal' ? CAST.principal : kind === 'janitor' ? CAST.janitor : CAST.kinds[kind] || CAST.teachers[v];
  const spr = kind === 'principal' ? PRINCIPAL_SPR : kind === 'janitor' ? JANITOR_SPR : KIND_SPR[kind] || TEACHER_SPR[v];
  return { chargeT: 0, chargeCD: rand(1, 3), whistleCD: 0, watched: false,
    kind, v, sp, spr, x: tx * T + 16, y: ty * T + 22, dir: o.dir || 0, walk: 0, moving: false,
    hp: (KINDS[kind] || KINDS.teacher).hp, hostile: !!o.hostile, state: o.hostile ? 'roam' : 'idle', act: o.act || 'stand', actT: rand(1, 4), frame: 0,
    target: null, path: null, pi: 1, repath: Math.random() * .5, roamT: 0, stun: 0, kx: 0, ky: 0, atk: 0, atkAnim: 0, bang: 0, doorT: 0,
    speakCD: rand(3, 9), humCD: rand(8, 20), whisperCD: rand(5, 12), alpha: o.hostile ? 0 : 1, dying: 0,
    stepT: 0, lastSeen: null, lostT: 0, lookT: 0, stuckT: 0, px: 0, py: 0, sayT: 0, say: '', voice: null, stareT: 0
  };
}
function spawnStaff(tx, ty, act) {
  if (teachers.length > 40) return;
  if (act === 'janitor') { if (!solid(tx, ty)) teachers.push(makeTeacher(tx, ty, { kind: 'janitor', act: 'wander' })); return; }
  // the restaurant has its cook, the warehouse its stocker, the bookcases their greeter
  const room = local(tx, ty).c.type;
  const kind = room === RT.CAFE ? 'lunch' : room === RT.STORE ? 'coach' : room === RT.LIB ? 'librarian' : Math.random() < .08 ? 'monitor' : Math.random() < .06 ? 'substitute' : 'teacher';
  teachers.push(makeTeacher(tx, ty, { kind, act, dir: act === 'board' ? 1 : 0 }));
}
function findSpawn(minD, maxD) {
  const px = Math.floor(player.x / T), py = Math.floor(player.y / T);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, d = rand(minD, maxD);
    const x = Math.round(px + Math.cos(a) * d), y = Math.round(py + Math.sin(a) * d);
    if (Math.abs(x - px) * T < W / 2 + T && Math.abs(y - py) * T < H / 2 + T * 2) continue;
    if (solid(x, y) || doors.has(K(x, y))) continue;
    if (clearLine(player.x, player.y - 8, x * T + 16, y * T + 16, blocksSight)) continue;
    return [x, y];
  }
  return null;
}
const L_SPOT = ['found_you', 's_over', 'why_here', 'found_you', 's_over'];
const L_HUNT = ['s_over', 'why_here', 'why_still', 'sit_down', 'detention', 'come_back', 'cant_leave', 'stay_after', 'hall_pass', 'late', 'homework', 'raise_hand', 'quiet', 'no_way_out', 's_over', 'why_here'];
const L_ROAM = ['know_here', 'come_out', 'why_still', 'went_home', 'bell_rang', 'roll_call', 'no_way_out', 'why_here', 's_over'];
const L_LOST = ['where_go', 'come_out', 'know_here'];
const L_BANG = ['let_me_in', 'open_door', 'let_me_in', 'know_here'];
const L_WHISPER = ['w_see', 'w_behind', 'w_stay', 'w_shh', 'w_forever'];
function teacherSay(t, ids, force) {
  const now = performance.now() / 1000;
  if (!force && now < voiceFreeAt) return false;
  let id = pick(ids);
  if (id === lastLine && ids.length > 1) id = pick(ids);
  lastLine = id;
  const dur = speakLine(id, t);
  voiceFreeAt = now + dur + rand(.8, 2.2);
  return true;
}

function updateStaff(t, dt) {
  const d = Math.hypot(player.x - t.x, player.y - t.y);
  // they never react to you... except to turn and watch if you stand right beside them
  if (d < 1.8 * T && !player.moving) t.stareT += dt; else t.stareT = Math.max(0, t.stareT - dt);
  if (t.stareT > 2.2) { t.dir = dirOf(Math.atan2(player.y - t.y, player.x - t.x)); t.moving = false; t.frame = 0; return; }
  t.actT -= dt;
  if (t.act === 'board') { t.dir = 1; t.moving = false; t.frame = t.actT % 1.4 < .7 ? 6 : 7; if (t.actT < -6) t.actT = rand(2, 5); return; }
  if (t.act === 'stand') { t.moving = false; t.frame = 0; if (t.actT <= 0) { t.actT = rand(3, 8); if (Math.random() < .3) t.dir = randi(0, 3); } return; }
  // wander
  if (t.actT <= 0) { t.actT = rand(1.5, 4.5); const a = Math.random() < .35 ? null : randi(0, 3); t.wdir = a; if (a !== null) t.dir = a; }
  if (t.wdir !== null && t.wdir !== undefined && t.actT > 1) {
    const v = [[0, 1], [0, -1], [1, 0], [-1, 0]][t.wdir], sp = (t.kind === 'janitor' ? .9 : .7) * T * dt;
    t.moving = moveBox(t, v[0] * sp, v[1] * sp);
    if (!t.moving) t.actT = 0;
    if (t.kind === 'janitor' && Math.floor(t.y / T) % B > 2 && Math.floor(t.x / T) % B > 2 && Math.random() < .02) t.actT = 0;
  } else t.moving = false;
  if (t.moving) { t.walk += dt * 5; t.stepT -= dt; if (t.stepT <= 0 && d < 9 * T) { t.stepT = .55; sTeacherStep(t, d, .4); } }
  t.frame = t.moving ? 1 + (Math.floor(t.walk) % 4) : 0;
}

function huntSpeed(t) { return Math.min(2.25 + dayNum * .14, 3.35) * T * kindOf(t).speed; }
function updateHostile(t, dt) {
  const dx = player.x - t.x, dy = player.y - t.y, d = Math.hypot(dx, dy);
  if (t.wake > 0) {   // the moment a member of staff turns: it stops, turns its head toward you and shakes
    t.wake -= dt; t.moving = false; t.frame = Math.random() < .15 ? 5 : 0; t.dir = dirOf(Math.atan2(dy, dx));
    return;
  }
  const KD = kindOf(t);
  // ---- perception
  const lit = player.flash && player.battery > 0;
  let range = (lit ? 11 : 5.5) * T * KD.sight;
  if (KD.dark) range = Math.max(range, 12 * T);   // security doesn't need your light to see you
  const inBeam = lit && d < 9 * T && Math.abs(angDiff(Math.atan2(t.y - player.y, t.x - player.x), player.ang)) < .45;
  if (inBeam) range = Math.max(range, 9 * T);
  const sees = d < 1.4 * T || (d < range && clearLine(t.x, t.y - 8, player.x, player.y - 8, blocksSight));
  if (sees) {
    t.lastSeen = { x: player.x, y: player.y }; t.lostT = 0;
    if (t.state !== 'hunt') {
      t.state = 'hunt'; t.repath = 0;
      if (stingCD <= 0 && d < 12 * T) { stingCD = 9; sSting(t); }
      if (KD.whistle && t.whistleCD <= 0) {
        // the whistle brings everyone who can hear it
        t.whistleCD = 12; sWhistle(t);
        for (const o of teachers) if (o !== t && o.hostile && !o.dying && o.state !== 'hunt' && Math.hypot(o.x - t.x, o.y - t.y) < 22 * T) { o.state = 'search'; o.target = { x: player.x, y: player.y }; o.repath = 0; }
      }
      if (!KD.silent) teacherSay(t, L_SPOT);
    }
  } else if (t.state === 'hunt') {
    t.lostT += dt;
    if (t.lostT > 2.6) { t.state = 'search'; t.target = t.lastSeen; t.repath = 0; if (!KD.silent && d < 14 * T && Math.random() < .5) teacherSay(t, L_LOST); }
  }
  t.whistleCD -= dt;
  // ---- the greeter only moves while you aren't looking at her
  if (KD.stalker) {
    t.watched = d < 13 * T && Math.abs(angDiff(Math.atan2(t.y - player.y, t.x - player.x), player.ang)) < 1.05 && clearLine(player.x, player.y - 8, t.x, t.y - 8, blocksSight);
    if (t.watched) { t.moving = false; t.frame = 0; t.speakCD = Math.max(t.speakCD, 1); return; }
  }
  // ---- where to go
  let goal = null, speed = 1.35 * T;
  if (t.state === 'hunt') {
    goal = { x: player.x, y: player.y }; speed = huntSpeed(t);
    if (KD.charge) {
      // the stocker sprints at you in bursts, then stops to catch his breath
      t.chargeCD -= dt;
      if (t.chargeT > 0) { t.chargeT -= dt; speed *= 2.3; if (t.chargeT <= 0) t.chargeCD = rand(1.8, 2.8); }
      else if (t.chargeCD <= 0 && d < 9 * T && clearLine(t.x, t.y - 8, player.x, player.y - 8, blocksSight)) { t.chargeT = 1.3; sWhistle(t); }
      else speed *= .55;
    }
  }
  else if (t.state === 'search') {
    goal = t.target; speed = huntSpeed(t) * .85;
    if (!goal || Math.hypot(goal.x - t.x, goal.y - t.y) < .6 * T) { t.state = 'look'; t.lookT = rand(2, 4); }
  } else if (t.state === 'look') {
    t.lookT -= dt; t.moving = false; t.frame = 0;
    if (Math.floor(t.lookT * 1.4) !== Math.floor((t.lookT + dt) * 1.4)) t.dir = randi(0, 3);
    if (t.lookT <= 0) { t.state = 'roam'; t.roamT = 0; }
  }
  if (t.state === 'roam') {
    t.roamT -= dt;
    if (!t.target || t.roamT <= 0 || Math.hypot(t.target.x - t.x, t.target.y - t.y) < .7 * T) {
      // the store always tells them roughly where you are
      const spread = KD.spread || 7;
      for (let i = 0; i < 10; i++) {
        const tx = Math.floor(player.x / T) + randi(-spread, spread), ty = Math.floor(player.y / T) + randi(-spread, spread);
        if (!solid(tx, ty)) { t.target = { x: tx * T + 16, y: ty * T + 20 }; break; }
      }
      t.roamT = rand(6, 12); t.repath = 0;
    }
    goal = t.target;
  }
  // ---- follow the path, smashing whatever is in the way
  t.moving = false;
  if (goal && t.state !== 'look') {
    t.repath -= dt;
    const gx = Math.floor(goal.x / T), gy = Math.floor(goal.y / T), tx = Math.floor(t.x / T), ty = Math.floor(t.y / T);
    if (t.repath <= 0) { t.repath = t.state === 'hunt' ? rand(.35, .55) : rand(1, 1.6); t.path = astar(tx, ty, gx, gy); t.pi = 1; }
    let mx = goal.x, my = goal.y, block = null;
    if (t.path && t.pi < t.path.length && !(t.state === 'hunt' && d < .9 * T)) {
      const [nx, ny] = t.path[t.pi];
      mx = nx * T + 16; my = ny * T + 18;
      const k = K(nx, ny);
      if (furn.has(k)) block = { kind: 'furn', x: nx, y: ny };
      else if (doors.has(k) && doors.get(k).closed) block = { kind: 'door', x: nx, y: ny };
      if (!block && Math.abs(t.x - mx) < 4 && Math.abs(t.y - my) < 4) t.pi++;
    }
    const vx = mx - t.x, vy = my - t.y, vl = Math.hypot(vx, vy) || 1;
    if (vl > 2 && !(block && vl < .95 * T)) {
      t.moving = moveBox(t, vx / vl * speed * dt, vy / vl * speed * dt);
      t.dir = dirOf(Math.atan2(vy, vx));
    }
    if (block && vl < 1.15 * T) {
      t.dir = dirOf(Math.atan2(vy, vx));
      if (block.kind === 'door') {
        t.doorT += dt;
        if (Math.floor(t.doorT * 4) !== Math.floor((t.doorT - dt) * 4)) sRattle(t);
        if (t.doorT > KD.door) {
          const door = doors.get(K(block.x, block.y)); door.closed = false; noteDoor(door); t.doorT = 0; sDoor(false, door.x * T + 16, door.y * T + 16);
        }
        if (!KD.silent && Math.random() < dt * .25) teacherSay(t, ['open_door', 'let_me_in']);
      } else {
        t.bang -= dt;
        if (t.bang <= 0) {
          const k = K(block.x, block.y), f = furn.get(k);
          t.bang = KD.bangRate; t.atkAnim = .25;
          if (f) {
            f.hp -= KD.smash; f.shake = .3; f.hit = performance.now() / 1000;
            const m = FURN[f.type].mat;
            sBang(m, block.x * T + 16, block.y * T + 16);
            puff(block.x * T + 16, block.y * T + 18, 5, m === 'metal' ? ['#c3ccd4', '#8d99a5'] : ['#c8956a', '#8a5a2e', '#e0b07a'], { smax: 70, grav: 160, up: 40 });
            if (f.hp <= 0) {
              setFurn(block.x, block.y, null); sBreak(m, block.x * T + 16, block.y * T + 16);
              puff(block.x * T + 16, block.y * T + 16, 18, m === 'metal' ? ['#c3ccd4', '#8d99a5', '#5b6570'] : ['#c8956a', '#8a5a2e', '#e0b07a', '#5e3b1c'], { smax: 110, grav: 220, up: 60, life: .9 });
            } else noteFurn(block.x, block.y);
          }
          if (!KD.silent && Math.random() < .2) teacherSay(t, L_BANG);
        }
      }
    } else t.doorT = 0;
  }
  // ---- stuck? shuffle sideways
  if (t.moving && Math.hypot(t.x - t.px, t.y - t.py) < speed * dt * .2) t.stuckT += dt; else t.stuckT = 0;
  t.px = t.x; t.py = t.y;
  if (t.stuckT > .8) { moveBox(t, rand(-8, 8), rand(-8, 8)); t.stuckT = 0; t.repath = 0; }
  // ---- attack
  t.atk -= dt; t.atkAnim -= dt;
  if (d < .62 * T && t.atk <= 0) { t.atk = KD.dmg > 1 ? 1.2 : .95; t.atkAnim = .3; hurtPlayer(KD.dmg, t); }
  // ---- footsteps in the dark
  if (t.moving) { t.walk += dt * (t.state === 'hunt' ? 7 : 4); t.stepT -= dt; if (t.stepT <= 0 && d < 15 * T && !KD.stalker) { t.stepT = t.state === 'hunt' ? .36 : .62; sTeacherStep(t, d, 1); } }
  t.frame = t.atkAnim > 0 ? 5 : t.moving ? 1 + (Math.floor(t.walk) % 4) : 0;
  // ---- talking
  t.speakCD -= dt; t.humCD -= dt; t.whisperCD -= dt;
  const behind = Math.abs(angDiff(Math.atan2(t.y - player.y, t.x - player.x), player.ang)) > 1.9;
  if (d < 2.6 * T && behind && t.whisperCD <= 0) { if (teacherSay(t, L_WHISPER.concat(player.running ? ['w_dont_run'] : []), false)) t.whisperCD = rand(14, 24); }
  else if (KD.silent) { if (t.speakCD <= 0 && d < 6 * T) { teacherSay(t, ['w_shh', 'w_see', 'w_stay']); t.speakCD = rand(10, 16); } }
  else if (t.speakCD <= 0 && d < 14 * T && KD.lines && Math.random() < .55) { t.speakCD = teacherSay(t, KD.lines) ? rand(7, 13) : rand(1, 3); }
  else if (t.speakCD <= 0 && d < 14 * T) {
    let said = false;
    if (t.state === 'hunt') said = teacherSay(t, player.running && Math.random() < .35 ? ['no_running'] : L_HUNT);
    else if (t.state === 'roam' && t.humCD <= 0 && Math.random() < .4) { said = humTune(t); t.humCD = rand(25, 40); }
    else if (t.state !== 'hunt') said = teacherSay(t, L_ROAM);
    t.speakCD = said ? rand(7, 13) : rand(1, 3);
  }
  // ---- left too far behind: the store moves them closer
  if (d > 30 * T) { const s = findSpawn(14, 20); if (s) { t.x = s[0] * T + 16; t.y = s[1] * T + 22; t.path = null; t.state = 'roam'; t.target = null; } }
}

function updateTeachers(dt) {
  const night = isNight();
  stingCD -= dt;
  let nearest = 1e9;
  for (const t of teachers) {
    if (t.dying > 0) { t.dying -= dt; t.alpha = Math.max(0, t.dying / .9); if (Math.random() < .5) puff(t.x, t.y - rand(4, 40), 1, ['#ffffff', '#000000', '#7a7a7a'], { smax: 30, up: 30, life: .5 }); continue; }
    t.alpha = Math.min(1, t.alpha + dt * 1.2);
    if (t.kx || t.ky) { moveBox(t, t.kx * dt, t.ky * dt); t.kx *= .86; t.ky *= .86; if (Math.abs(t.kx) + Math.abs(t.ky) < 4) t.kx = t.ky = 0; }
    if (t.sayT > 0) t.sayT -= dt;
    if (t.stun > 0) { t.stun -= dt; t.frame = 0; continue; }
    if (t.hostile) { updateHostile(t, dt); nearest = Math.min(nearest, Math.hypot(player.x - t.x, player.y - t.y)); }
    else updateStaff(t, dt);
  }
  // don't let them stand inside each other
  for (let i = 0; i < teachers.length; i++) for (let j = i + 1; j < teachers.length; j++) {
    const a = teachers[i], b = teachers[j], dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy);
    if (dd > 0 && dd < 14) { const p = (14 - dd) / 2; moveBox(a, -dx / dd * p, -dy / dd * p); moveBox(b, dx / dd * p, dy / dd * p); }
  }
  teachers = teachers.filter(t => !(t.dying && t.dying <= 0) && Math.hypot(player.x - t.x, player.y - t.y) < (t.hostile ? 60 : 44) * T);
  // the night shift
  if (night) {
    nightClock += dt;
    const target = Math.min(2 + dayNum * 2, 14), live = teachers.filter(t => t.hostile && !t.dying && t.kind !== 'principal').length;
    spawnTimer -= dt;
    if (nightClock > 4 && live < target && spawnTimer <= 0) {
      spawnTimer = rand(3, 6);
      const s = findSpawn(13, 20);
      if (s) teachers.push(makeTeacher(s[0], s[1], { kind: pickKind(), hostile: true }));
    }
    if (dayNum >= 3 && !principalOut && nightClock > 14) {
      const s = findSpawn(16, 22);
      if (s) { principalOut = true; teachers.push(makeTeacher(s[0], s[1], { kind: 'principal', hostile: true })); paAnnounce('pa_principal'); }
    }
  }
  return nearest;
}

// ---------------------------------------------------------------- the player
function hurtPlayer(dmg, src) {
  if (player.iframes > 0 || state !== 'play') return;
  player.hp -= dmg; player.iframes = .75; shake = .4; hurtFlash = .45;
  const a = Math.atan2(player.y - src.y, player.x - src.x);
  player.vx += Math.cos(a) * 260; player.vy += Math.sin(a) * 260;
  sHurt(); puff(player.x, player.y - 12, 8, ['#8a0a0a', '#c81c1c', '#5a0606'], { smax: 60, grav: 200, up: 30 });
  if (player.hp <= 0) die(src);
}
// the nearest tile in the direction you're facing that your own body isn't standing in
function facingTile() {
  const c = Math.cos(player.ang), s = Math.sin(player.ang);
  let tx = 0, ty = 0;
  for (let d = 12; d <= 48; d += 3) {
    tx = Math.floor((player.x + c * d) / T); ty = Math.floor((player.y - 2 + s * d) / T);
    const overlaps = player.x + PW > tx * T && player.x - PW < tx * T + T && player.y + PH > ty * T && player.y - PH < ty * T + T;
    if (!overlaps) break;
  }
  return [tx, ty];
}
function targetTile() {
  if (mouse.active > 0) {
    const d = Math.hypot(mouse.tx * T + 16 - player.x, mouse.ty * T + 16 - (player.y - 6));
    if (d <= REACH) return [mouse.tx, mouse.ty];
  }
  return facingTile();
}
const carried = () => Object.keys(player.inv).reduce((s, k) => s + player.inv[k] * FURN[k].wt, 0);
function selectedType() { player.order = player.order.filter(k => player.inv[k] > 0); if (!player.order.length) return null; player.sel = clamp(player.sel, 0, player.order.length - 1); return player.order[player.sel]; }
function interact() {
  const [x, y] = targetTile(), k = K(x, y), f = furn.get(k);
  if (f) {
    const wt = FURN[f.type].wt;
    if (carried() + wt > CARRY) { toast(`Too heavy. You're carrying ${carried()}/${CARRY}.`, 2); sDeny(); return; }
    setFurn(x, y, null);
    player.inv[f.type] = (player.inv[f.type] || 0) + 1;
    if (!player.order.includes(f.type)) player.order.push(f.type);
    player.sel = player.order.indexOf(f.type);
    sPick(FURN[f.type].mat); puff(x * T + 16, y * T + 24, 8, ['#d8d0b8', '#b8b09a', '#efe9da'], { smax: 40, up: 20 });
    emitNoise(x * T + 16, y * T + 16, 4);
    toast('+1 ' + FURN[f.type].name, 1.3);
    return;
  }
  const d = doors.get(k);
  if (d) {
    if (!d.closed) {
      const occupied = teachers.some(t => !t.dying && Math.floor(t.x / T) === x && Math.floor(t.y / T) === y) || (Math.floor(player.x / T) === x && Math.floor(player.y / T) === y);
      if (occupied) { toast('Something is in the doorway.', 1.4); return; }
    }
    d.closed = !d.closed; noteDoor(d); sDoor(d.closed, x * T + 16, y * T + 16);
    emitNoise(x * T + 16, y * T + 16, d.closed ? 7 : 4);
    return;
  }
  if (pickups.has(k)) { collect(k); return; }
  toast('Nothing to grab there.', 1.1);
}
function place() {
  const type = selectedType();
  if (!type) { toast('Carry something first: face furniture and press E.', 2.2); sDeny(); return; }
  const [x, y] = targetTile();
  if (tileAt(x, y) === WALL || furn.has(K(x, y))) { toast("Can't place it there.", 1.1); sDeny(); return; }
  if (doors.has(K(x, y)) && doors.get(K(x, y)).closed) { toast('Open the door first.', 1.2); sDeny(); return; }
  const over = e => Math.abs(e.x - (x * T + 16)) < 16 + PW && Math.abs(e.y - (y * T + 16)) < 16 + PH;
  if (over(player) || teachers.some(t => !t.dying && over(t))) { toast('Something is in the way.', 1.1); sDeny(); return; }
  setFurn(x, y, mkFurn(type, randi(0, 7), true));
  player.inv[type]--; stats.placed++;
  sPlace(FURN[type].mat); puff(x * T + 16, y * T + 28, 10, ['#d8d0b8', '#b8b09a', '#efe9da'], { smax: 50, up: 10 });
  emitNoise(x * T + 16, y * T + 16, 6);
  selectedType();
}
function eat() {
  const order = player.hp <= 4 ? ['bandage', 'chips', 'apple', 'milk'] : ['apple', 'milk', 'chips', 'bandage'];
  const k = order.find(s => player.snacks[s] > 0);
  if (!k) { toast('Nothing to eat. Look in restaurants, staff rooms and first aid.', 2.2); sDeny(); return; }
  if (player.hp >= 10) { toast("You're not hurt.", 1.1); return; }
  player.snacks[k]--; player.hp = Math.min(10, player.hp + PICKUPS[k].heal); sEat(k === 'bandage');
  toast((k === 'bandage' ? 'Patched up' : 'Ate the ' + PICKUPS[k].name.toLowerCase()) + ': +' + PICKUPS[k].heal / 2 + ' hearts', 1.6);
  emitNoise(player.x, player.y, 2);
}
function toggleFlash() {
  if (player.battery <= 0) { toast('The battery is dead. Find a new one.', 1.8); sDeny(); return; }
  player.flash = !player.flash; sClick();
}
function collect(k) {
  const p = pickups.get(k); if (!p) return;
  pickups.delete(k); notePickup(p.x, p.y);
  if (p.type === 'battery') { player.battery = Math.min(1, player.battery + .55); toast('Fresh battery: flashlight ' + Math.round(player.battery * 100) + '%', 1.8); sClick(); }
  else { player.snacks[p.type]++; toast('+1 ' + PICKUPS[p.type].name + '  (C to eat)', 1.6); }
  sPickup();
}
function emitNoise(x, y, radiusTiles) {
  for (const t of teachers) {
    if (!t.hostile || t.dying || t.state === 'hunt') continue;
    if (Math.hypot(t.x - x, t.y - y) < radiusTiles * T) { t.state = 'search'; t.target = { x, y }; t.repath = 0; }
  }
}

function updatePlayer(dt) {
  const p = player;
  let ix = input.x, iy = input.y;
  const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }
  const moving = il > .12;
  if (p.stam < .05) p.tired = true; else if (p.stam > .3) p.tired = false;
  p.running = input.run && moving && !p.tired;
  p.stam = clamp(p.stam + (p.running ? -dt / 3.6 : dt / 5), 0, 1);
  const load = carried() / CARRY;
  const top = (p.running ? RUN : WALK) * (1 - .28 * load);
  const k = Math.min(1, dt * 16);
  p.vx += (ix * top - p.vx) * k; p.vy += (iy * top - p.vy) * k;
  const sp = Math.hypot(p.vx, p.vy);
  p.moving = sp > 12;
  if (sp > 1) moveBox(p, p.vx * dt, p.vy * dt);
  if (input.aim !== null) p.ang = input.aim; else if (moving) p.ang = Math.atan2(iy, ix);
  p.dir = dirOf(p.ang);
  if (p.moving) {
    p.walk += dt * (p.running ? 11 : 7.5) * Math.min(1, sp / WALK);
    stats.dist += sp * dt / T;
    p.stepT -= dt;
    if (p.stepT <= 0) { p.stepT = p.running ? .28 : .42; sStep(tileAt(Math.floor(p.x / T), Math.floor(p.y / T)), p.running); }
    p.noiseT -= dt;
    if (p.noiseT <= 0) { p.noiseT = .3; emitNoise(p.x, p.y, p.running ? 8.5 : 2.5); }
  }
  p.swing = Math.max(0, p.swing - dt); p.swingCD = Math.max(0, p.swingCD - dt); p.iframes = Math.max(0, p.iframes - dt);
  // flashlight battery only drains at night
  if (isNight() && p.flash && p.battery > 0) {
    p.battery = Math.max(0, p.battery - dt / 320);
    if (p.battery <= 0) { p.flash = false; toast('Your flashlight died.', 2.5); sClick(); }
    else if (p.battery < .15) { p.lowBeep -= dt; if (p.lowBeep <= 0) { p.lowBeep = 6; sBeep(); } }
  }
  if (!isNight()) { p.regen += dt; if (p.regen > 9) { p.regen = 0; if (p.hp < 10) p.hp++; } }
  // walk over snacks and batteries to pick them up
  const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
  for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) {
    const kk = K(xx, yy);
    if (pickups.has(kk) && Math.hypot(xx * T + 16 - p.x, yy * T + 18 - p.y) < 16) collect(kk);
  }
}
