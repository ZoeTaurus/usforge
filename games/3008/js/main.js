'use strict';
// ============================================================ the game: state, input, the day and the night

let state = 'title', clock = 40, dayNum = 1, shake = 0, hurtFlash = 0, toastMsg = '', toastT = 0, banner = null;
let lightsFlicker = 0, nearestHostile = 1e9, hintT = 0, touchMode = false;
let ambientT = 20, paT = 50, heartT = 0, saveT = 20, buzzT = 0, buzzDist = 1e9, musicT = 0, musicDist = 1e9, dayEvents = {};
const keys = {};
const mouse = { sx: 0, sy: 0, tx: 0, ty: 0, active: 0 };
const input = { x: 0, y: 0, run: false, aim: null };
const SAVE_KEY = 'endless-store-save-v2', BEST_KEY = 'endless-school-best';

function isNight() { return clock >= DAY_LEN; }
function toast(m, t = 2) { toastMsg = m; toastT = t; }
function keyName(a) { return touchMode ? '' : a === 'grab' ? '[E]' : '[Q]'; }
function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

// ---------------------------------------------------------------- starting, saving, losing
function newGame(saved) {
  if (saved) { SEED = saved.seed; loadWorld(saved.world); } else { SEED = (Math.random() * 1e9) | 0; resetWorld(); }
  teachers = []; particles = []; subtitles = []; live.length = 0; jump = null;
  stats = saved ? saved.stats : { placed: 0, sent: 0, dist: 0, nights: 0 };
  clock = saved ? saved.clock : 8; dayNum = saved ? saved.day : 1;
  player = newPlayer(1 * T + 16, 8 * T + 20);
  if (saved) Object.assign(player, saved.player, { vx: 0, vy: 0, iframes: 1 });
  principalOut = false; nightClock = isNight() ? clock - DAY_LEN : 0; spawnTimer = 3; voiceFreeAt = 0; stingCD = 0;
  shake = hurtFlash = lightsFlicker = 0; cam.lx = cam.ly = 0; paQueue.length = 0; paBusy = 0;
  dayEvents = { lunch: clock > DAY_LEN * .42, run: clock > DAY_LEN * .66, bell: clock > DAY_LEN - DUSK + 2 };
  banner = { text: isNight() ? 'NIGHT ' + dayNum : 'DAY ' + dayNum, sub: saved ? 'WELCOME BACK' : 'THE STORE HAS NO EXIT', t: 3.5, col: '#ffffff' };
  hintT = saved ? 0 : 16;
  if (!saved) toast('Explore. Grab furniture. Build a base before closing time.', 6);
}
function saveGame() {
  if (state !== 'play' && state !== 'paused') return;
  const p = player;
  const data = { v: 2, seed: SEED, day: dayNum, clock, stats, world: serializeWorld(),
    player: { x: p.x, y: p.y, hp: p.hp, stam: p.stam, battery: p.battery, flash: p.flash, inv: p.inv, order: p.order, sel: p.sel, snacks: p.snacks, ang: p.ang } };
  store(SAVE_KEY, JSON.stringify(data));
}
function readSave() { const s = load(SAVE_KEY); if (!s) return null; try { const d = JSON.parse(s); return d && d.v === 2 ? d : null; } catch (e) { return null; } }
function best() { return +(load(BEST_KEY) || 0); }
function saveBest(n) { if (n > best()) store(BEST_KEY, String(n)); }
function die(src) {
  state = 'dead'; setMusic(0, .2); saveBest(stats.nights); store(SAVE_KEY, null);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  // it lunges at the screen
  jump = { t0: performance.now() / 1000, sp: src && src.sp ? src.sp : CAST.principal };
  sJumpscare(); shake = 0; hurtFlash = 0;
  if (src && src.sp) setTimeout(() => speakLine(pick(['detention', 's_over', 'stay_after', 'sit_down']), src), 2000);
  const n = stats.nights;
  const pl = (k, one, many) => k + ' ' + (k === 1 ? one : many), walked = Math.round(stats.dist);
  document.getElementById('deadText').textContent =
    `You survived ${pl(n, 'night', 'nights')}, walked ${pl(walked, 'tile', 'tiles')} of walkway and placed ${pl(stats.placed, 'piece', 'pieces')} of furniture. You never stood a chance.`;
  setTimeout(() => { if (state === 'dead') { show('dead'); refreshTitle(); document.getElementById('againBtn').focus(); } }, 2400);
}

// ---------------------------------------------------------------- closing time
function onNightfall() {
  banner = { text: 'STORE CLOSED', sub: 'THE EMPLOYEES ARE COMING', t: 5, col: '#e03030', creepy: true };
  lightsFlicker = 2.8; setMusic(0, .6); sBell(true); shake = .3;
  // some of the staff stay behind for the night shift; the rest are simply gone
  const staff = teachers.filter(t => !t.dying).sort(() => Math.random() - .5), cap = Math.min(1 + dayNum, 5);
  staff.forEach((t, i) => {
    if (i >= cap) { t.dying = .9; return; }
    Object.assign(t, { hostile: true, state: 'roam', target: null, speakCD: rand(4, 10), alpha: 1, stareT: 0, wake: rand(1.2, 3.5) });
  });
  nightClock = 0; spawnTimer = 2; principalOut = false; paT = rand(40, 60); ambientT = rand(9, 15);
  setTimeout(() => {
    if (state !== 'play' || !isNight()) return;
    const near = teachers.filter(t => t.hostile && !t.dying).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
    if (near && Math.hypot(near.x - player.x, near.y - player.y) < 16 * T) teacherSay(near, ['s_over'], true); else paAnnounce('pa_over');
  }, 3800);
  saveGame();
}
function onDawn() {
  dayNum++; stats.nights++;
  banner = { text: 'DAY ' + dayNum, sub: 'YOU SURVIVED THE NIGHT', t: 4.5, col: '#ffffff' };
  lightsFlicker = 1.8; sBell(false); setMusic(1, 4);
  for (const t of teachers) if (t.hostile && !t.dying) t.dying = .9;
  player.hp = Math.min(10, player.hp + 2);
  dayEvents = {}; principalOut = false;
  setTimeout(() => { if (state === 'play') paAnnounce('pa_morning'); }, 3500);
  repopulateStaff(); saveBest(stats.nights); saveGame();
}
function repopulateStaff() {
  const pcx = Math.floor(player.x / T / B), pcy = Math.floor(player.y / T / B);
  for (let cy = pcy - 2; cy <= pcy + 2; cy++) for (let cx = pcx - 2; cx <= pcx + 2; cx++) {
    const c = cell(cx, cy);
    if (!c.gen || Math.random() > .35) continue;
    for (let i = 0; i < 6; i++) { const x = cx * B + randi(4, 12), y = cy * B + randi(4, 12); if (!solid(x, y)) { spawnStaff(x, y, pick(['stand', 'wander', 'wander'])); break; } }
  }
}

// ---------------------------------------------------------------- one step of the world
function update(dt) {
  if (state !== 'play') return;
  const wasNight = isNight();
  clock += dt;
  if (!wasNight && isNight()) onNightfall();
  if (clock >= DAY_LEN + NIGHT_LEN) { clock -= DAY_LEN + NIGHT_LEN; onDawn(); }
  duskAmt = isNight() ? 0 : clamp((clock - (DAY_LEN - DUSK)) / DUSK, 0, 1);
  shake = Math.max(0, shake - dt); hurtFlash = Math.max(0, hurtFlash - dt); lightsFlicker = Math.max(0, lightsFlicker - dt);
  toastT -= dt; hintT -= dt; mouse.active -= dt;
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  // the store day has its own announcements
  if (!isNight()) {
    if (!dayEvents.lunch && clock > DAY_LEN * .42) { dayEvents.lunch = true; paAnnounce('pa_lunch'); }
    if (!dayEvents.run && clock > DAY_LEN * .66) { dayEvents.run = true; paAnnounce(Math.random() < .5 ? 'pa_running' : 'pa_wonderful'); }
    if (!dayEvents.bell && clock > DAY_LEN - DUSK + 2) { dayEvents.bell = true; paAnnounce('pa_final_bell'); toast('The lights are dimming. Get somewhere safe.', 3.5); }
  }
  // build the store around you as you walk
  const pcx = Math.floor(player.x / T / B), pcy = Math.floor(player.y / T / B);
  for (let cy = pcy - 2; cy <= pcy + 2; cy++) for (let cx = pcx - 2; cx <= pcx + 2; cx++) genRoom(cx, cy);
  for (let cy = pcy - 1; cy <= pcy + 1; cy++) for (let cx = pcx - 1; cx <= pcx + 1; cx++) cell(cx, cy).seen = true;
  // input → player
  input.x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x;
  input.y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + stick.y;
  input.run = !!(keys.ShiftLeft || keys.ShiftRight || stick.run);
  input.aim = mouse.active > 0 && !touchMode ? Math.atan2(cam.y + mouse.sy - (player.y - 12), cam.x + mouse.sx - player.x) : null;
  updatePlayer(dt);
  nearestHostile = updateTeachers(dt);
  updateParticles(dt);
  if (isNight() && nearestHostile < 6.5 * T) { heartT -= dt; if (heartT <= 0) { heartT = nearestHostile < 3 * T ? .42 : .82; sHeart(nearestHostile < 3 * T); } }
  if (isNight()) {
    ambientT -= dt; if (ambientT <= 0) { ambientT = rand(13, 26); nightAmbient(); }
    paT -= dt; if (paT <= 0) { paT = rand(45, 75); paAnnounce(pick(['pa_escort', 'pa_locked', 'pa_lights', 'pa_nowhere', 'pa_over'])); }
  }
  // how far the nearest broken light is (it buzzes) and the music room (the music is louder there)
  buzzT -= dt;
  if (buzzT <= 0) {
    buzzT = .4; buzzDist = 1e9;
    const tx = Math.floor(player.x / T), ty = Math.floor(player.y / T);
    for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 6; x <= tx + 6; x++) { const f = fixtureAt(x, y); if (f && f.broken && !isWall(x, y)) buzzDist = Math.min(buzzDist, Math.hypot(x * T + 16 - player.x, y * T + 16 - player.y)); }
  }
  musicT -= dt; if (musicT <= 0) { musicT = 1; musicDist = nearestRoom(player.x, player.y, RT.MUSIC, 2); }
  updateAmbience(dt, buzzDist, musicDist);
  updatePA(dt);
  saveT -= dt; if (saveT <= 0) { saveT = 20; saveGame(); }
}

// ---------------------------------------------------------------- the title screen: an empty store drifting by
// the title screen: a dark hallway at night. Something stands at the end of it, and every time the lights
// flicker it is a little closer.
let stalker = null, stalkT = 0, whisperT = 0;
const STALKERS = ['teacher', 'teacher', 'substitute', 'monitor', 'lunch', 'coach', 'librarian', 'principal'];
const WHISPERS = ['WHY ARE YOU HERE?', 'EVERYONE ELSE WENT HOME.', 'THERE IS NO EXIT.', 'WE CLOSED A LONG TIME AGO.', 'FOLLOW THE ARROWS.', 'I CAN SEE YOU.', 'THE STORE IS CLOSED.', 'STAY.'];
function newStalker() {
  stalker = makeTeacher(1, Math.floor(player.y / T) - 9, { kind: pick(STALKERS), hostile: true });
  stalker.x = player.x; stalker.alpha = 1; stalker.dir = 0; stalker.state = 'title';
  teachers = [stalker];
}
function setupAttract() {
  SEED = 3008; resetWorld(); teachers = []; particles = []; stats = { placed: 0, sent: 0, dist: 0, nights: 0 };
  clock = DAY_LEN + 60; dayNum = 1; jump = null; lightsFlicker = 0;
  player = newPlayer(1 * T + 16, 6 * T + 20); player.ang = -Math.PI / 2; player.flash = false;
  for (let cy = -2; cy <= 1; cy++) for (let cx = -2; cx <= 2; cx++) genRoom(cx, cy);
  newStalker(); stalkT = 3;
}
function attract(dt) {
  lightsFlicker = Math.max(0, lightsFlicker - dt);
  stalkT -= dt;
  if (stalkT <= 0) {
    stalkT = rand(2.6, 4.4); lightsFlicker = rand(.35, .7);
    if (stalker.y > player.y - 2.5 * T) newStalker();
    else { stalker.y += T * 1.5; stalker.x = player.x + randi(-6, 6); if (AC) sTeacherStep(stalker, Math.hypot(stalker.y - player.y, 0), 1.6); }
  }
  stalker.frame = Math.random() < .03 ? 5 : 0;
  nearestHostile = Math.abs(stalker.y - player.y);
  whisperT -= dt;
  if (whisperT <= 0) {
    whisperT = rand(3.5, 6);
    const w = document.getElementById('whisper');
    w.style.opacity = 0;
    setTimeout(() => { w.textContent = pick(WHISPERS); w.style.opacity = 1; }, 600);
  }
}

// ---------------------------------------------------------------- input
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0, run: false };
const ACTIONS = { KeyE: () => interact(), KeyQ: () => place(), KeyF: () => toggleFlash(), KeyC: () => eat(),
  KeyM: () => { mmOn = !mmOn; }, Tab: () => cycle(1) };
function cycle(d) { const n = player.order.filter(k => player.inv[k] > 0).length; if (n) { selectedType(); player.sel = (player.sel + d + n) % n; } }
addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play' || state === 'paused') { e.preventDefault(); setPaused(state === 'play'); } return; }
  if (state !== 'play') return;
  touchMode = false;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (!keys[e.code] && ACTIONS[e.code]) ACTIONS[e.code]();
  if (!keys[e.code] && /^Digit[1-9]$/.test(e.code)) { selectedType(); const i = +e.code.slice(5) - 1; if (i < player.order.length) player.sel = i; }
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveGame(); if (state === 'play') setPaused(true); } });
function toCanvas(e) { const r = cvs.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
cvs.addEventListener('mousemove', e => { [mouse.sx, mouse.sy] = toCanvas(e); mouse.active = 2.5; touchMode = false; });
cvs.addEventListener('mousedown', e => {
  if (state !== 'play' || touchMode) return;
  [mouse.sx, mouse.sy] = toCanvas(e); mouse.active = 2.5; updateMouseTile();
  if (e.button === 0) place(); else if (e.button === 2) interact();
});
cvs.addEventListener('contextmenu', e => e.preventDefault());
cvs.addEventListener('wheel', e => { if (state !== 'play') return; e.preventDefault(); cycle(e.deltaY > 0 ? 1 : -1); }, { passive: false });
function updateMouseTile() { mouse.tx = Math.floor((cam.x + mouse.sx) / T); mouse.ty = Math.floor((cam.y + mouse.sy) / T); }
// touch: a floating stick on the left half, taps on the right half pick a tile
const stickEl = document.getElementById('stick'), knobEl = document.getElementById('knob');
cvs.addEventListener('touchstart', e => {
  if (!touchMode || !touchRect) { touchMode = true; document.getElementById('touch').classList.add('on'); requestAnimationFrame(measureTouch); }
  for (const tch of e.changedTouches) {
    if (tch.clientX < innerWidth * .45 && stick.id === null) {
      stick.id = tch.identifier; stick.ox = tch.clientX; stick.oy = tch.clientY;
      stickEl.style.left = (tch.clientX - 48) + 'px'; stickEl.style.top = (tch.clientY - 48) + 'px'; stickEl.hidden = false; knobEl.style.transform = 'translate(0,0)';
    } else if (state === 'play') { [mouse.sx, mouse.sy] = toCanvas(tch); mouse.active = 4; updateMouseTile(); }
  }
  e.preventDefault();
}, { passive: false });
cvs.addEventListener('touchmove', e => {
  for (const tch of e.changedTouches) if (tch.identifier === stick.id) {
    let dx = tch.clientX - stick.ox, dy = tch.clientY - stick.oy; const l = Math.hypot(dx, dy), m = 42;
    if (l > m) { dx = dx / l * m; dy = dy / l * m; }
    stick.x = dx / m; stick.y = dy / m; stick.run = l > m * 1.6;
    knobEl.style.transform = `translate(${dx}px,${dy}px)`;
  }
  e.preventDefault();
}, { passive: false });
const endStick = e => { for (const tch of e.changedTouches) if (tch.identifier === stick.id) { stick.id = null; stick.x = stick.y = 0; stick.run = false; stickEl.hidden = true; } };
cvs.addEventListener('touchend', endStick); cvs.addEventListener('touchcancel', endStick);
document.querySelectorAll('#touch [data-a]').forEach(b => b.addEventListener('pointerdown', e => {
  e.preventDefault(); if (state !== 'play') return;
  ({ grab: interact, place, light: toggleFlash, eat, next: () => cycle(1) })[b.dataset.a]();
}));
document.querySelectorAll('#touch [data-run]').forEach(b => {
  b.addEventListener('pointerdown', e => { e.preventDefault(); stick.run = true; b.classList.add('down'); });
  const off = e => { e.preventDefault(); stick.run = false; b.classList.remove('down'); };
  b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});

// ---------------------------------------------------------------- screens
function show(id) { for (const p of ['gate', 'title', 'dead', 'paused']) document.getElementById(p).hidden = p !== id; }
function refreshTitle() {
  const s = readSave(), b = best();
  const cont = document.getElementById('continueBtn');
  cont.hidden = !s;
  if (s) cont.textContent = `CONTINUE: ${s.clock >= DAY_LEN ? 'NIGHT' : 'DAY'} ${s.day}`;
  document.getElementById('best').textContent = b ? `BEST: ${b} ${b === 1 ? 'NIGHT' : 'NIGHTS'}` : '';
}
function startGame(cont) {
  initAudio(); titleAmbience(false);
  if ('speechSynthesis' in window) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* ignore */ } }
  newGame(cont ? readSave() : null);
  state = 'play'; show(null);
  setMusic(isNight() ? 0 : 1, 2);
  if (!cont && clock < 20) setTimeout(() => { if (state === 'play') paAnnounce('pa_morning'); }, 2500);
  cvs.focus();
}
function setPaused(p) {
  if (state === 'play' && p) { state = 'paused'; saveGame(); show('paused'); if (AC) AC.suspend(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  else if (state === 'paused' && !p) { state = 'play'; show(null); if (AC) AC.resume(); cvs.focus(); last = performance.now(); }
}
document.getElementById('startBtn').onclick = () => { store(SAVE_KEY, null); startGame(false); };
document.getElementById('continueBtn').onclick = () => startGame(true);
document.getElementById('againBtn').onclick = () => startGame(false);
document.getElementById('menuBtn').onclick = () => { setupAttract(); state = 'title'; show('title'); refreshTitle(); titleAmbience(true); };
document.getElementById('gateBtn').onclick = () => {
  initAudio(); titleAmbience(true); show('title'); refreshTitle();
  setTimeout(() => { if (state === 'title' && stalker) speakLine('w_behind', { x: player.x - 20, y: player.y + 30, sp: stalker.sp, kind: stalker.kind }); }, 2500);
  document.getElementById(readSave() ? 'continueBtn' : 'startBtn').focus();
};
document.getElementById('howBtn').onclick = () => {
  const how = document.getElementById('how'), btn = document.getElementById('howBtn');
  how.hidden = !how.hidden; btn.setAttribute('aria-expanded', String(!how.hidden));
};
document.getElementById('resumeBtn').onclick = () => setPaused(false);
document.getElementById('quitBtn').onclick = () => { saveGame(); if (AC) AC.resume(); setMusic(0, .3); setupAttract(); state = 'title'; show('title'); refreshTitle(); titleAmbience(true); };
let listenIdx = 0;
document.getElementById('listenBtn').onclick = () => {
  initAudio();
  const ids = ['s_over', 'why_here', 'know_here', 'come_out', 'w_behind', 'let_me_in', 'roll_call', 'cant_leave'];
  const id = ids[listenIdx % ids.length], sp = CAST.teachers[(listenIdx * 3) % CAST.teachers.length];
  listenIdx++;
  const fake = { x: player.x + 40, y: player.y + 8, sp, kind: 'teacher' };
  const go = () => { speakLine(id, fake); document.getElementById('listenText').textContent = '"' + LINE_TEXT[id] + '"'; };
  if (VOX.count || !window.VOICE_DATA) go(); else setTimeout(go, 600);
};

// ---------------------------------------------------------------- the screen
// every game pixel becomes a whole number of device pixels, and the view fills the window
let PXS = 1;
function resize() {
  const dpr = window.devicePixelRatio || 1, dw = Math.round(innerWidth * dpr), dh = Math.round(innerHeight * dpr);
  let s = Math.max(1, Math.round(Math.min(dw / 640, dh / 360)));
  while (Math.ceil(dw / s) * Math.ceil(dh / s) > 340000) s++;
  W = Math.max(240, Math.ceil(dw / s)); H = Math.max(200, Math.ceil(dh / s));
  cvs.width = W; cvs.height = H; PXS = s / dpr;
  cvs.style.width = (W * PXS) + 'px'; cvs.style.height = (H * PXS) + 'px';
  setupView();
  requestAnimationFrame(measureTouch);
}
// where the touch buttons sit, in game pixels, so the HUD can stay out from under them
let touchRect = null;
function measureTouch() {
  const box = document.getElementById('touch'), el = box.querySelector('.acts');
  if (!box.classList.contains('on')) { touchRect = null; return; }
  const r = el.getBoundingClientRect(), c = cvs.getBoundingClientRect();
  touchRect = { x: (r.left - c.left) / PXS, y: (r.top - c.top) / PXS };
}
addEventListener('resize', resize);

let last = performance.now();
function frame(nowMs) {
  const dt = Math.min(.05, (nowMs - last) / 1000); last = nowMs;
  if (state === 'title') attract(dt); else update(dt);
  updateMouseTile();
  for (const f of furn.values()) if (f.shake > 0) f.shake -= dt;
  if (state !== 'play' && AC) updateLive();
  render(dt);
  requestAnimationFrame(frame);
}
function boot() {
  touchMode = matchMedia('(pointer: coarse)').matches;
  if (touchMode) document.getElementById('touch').classList.add('on');
  resize(); setupAttract(); refreshTitle(); show('gate'); document.getElementById('gateBtn').focus();
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();
window.__store = { get state() { return state; }, get clock() { return clock; }, set clock(v) { clock = v; }, get player() { return player; }, get teachers() { return teachers; }, get furn() { return furn; }, get W() { return W; }, get H() { return H; } };
