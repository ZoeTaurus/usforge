'use strict';
// ============================================================ sound: music, effects and the employees' voices

// subtitles for every recorded line (ids match tools/gen_voices.py)
const LINE_TEXT = Object.assign({
  s_over: "The store is closed.",
  why_here: "Why are you here?",
  why_still: "Why are you still here?",
  bell_rang: "We closed a long time ago.",
  went_home: "Everyone else went home.",
  late: "You missed closing time.",
  no_running: "No running in the store.",
  detention: "Staff only.",
  come_back: "Come back to the showroom.",
  homework: "Put that back on the shelf.",
  hall_pass: "Can I see your receipt?",
  sit_down: "Have a seat.",
  cant_leave: "You can't leave.",
  no_way_out: "There is no exit.",
  stay_after: "Stay a while.",
  know_here: "I know you're in here.",
  come_out: "Come out, come out.",
  let_me_in: "Let me in.",
  open_door: "Open the door.",
  found_you: "Found you.",
  where_go: "Where did you go?",
  quiet: "Quiet.",
  raise_hand: "Can I help you?",
  roll_call: "Are you finding everything okay?",
  w_see: "I can see you.",
  w_behind: "Behind you.",
  w_stay: "Stay.",
  w_shh: "Shhhh.",
  w_dont_run: "Don't run.",
  w_forever: "Stay forever.",
  pa_morning: "Good morning, shoppers. Welcome to the store.",
  pa_running: "Please follow the arrows on the floor.",
  pa_lunch: "Our restaurant is now open. Today's special is meatballs.",
  pa_wonderful: "Have a wonderful day. Have a wonderful day. Have a wonderful day.",
  pa_final_bell: "The store will close shortly. Please make your way to the checkouts.",
  pa_over: "Attention, shoppers. The store is now closed. Please remain in the building.",
  pa_escort: "There is a customer on the shop floor. Staff, please escort the customer to the back room.",
  pa_locked: "The doors are locked, for your safety.",
  pa_lights: "Lights out. Lights out.",
  pa_nowhere: "Do not look for the exit. There is no exit.",
  pa_principal: "The manager would like to see you now."
}, (window.VOICE_DATA && window.VOICE_DATA.lines) || {});

let AC = null, master, sfxBus, voiceBus, musicBus, musicLP, verbBig, verbSmall, wob, noiseBuf, humGain, buzzGain, buzzFilter;
const VOX = { buf: new Map(), meta: new Map(), loading: false, count: 0 };
const live = [];                 // sounds that follow something around
let subtitles = [];
let musicLevel = 0, musicStep = 0, musicNext = 0, duskAmt = 0, musicBoost = 0;

const now = () => AC ? AC.currentTime : 0;
function gainNode(v, to) { const g = AC.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
function makeIR(sec, decay, dark) {
  const n = Math.floor(AC.sampleRate * sec), buf = AC.createBuffer(2, n, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / AC.sampleRate; lp += (Math.random() * 2 - 1 - lp) * (1 - dark * Math.min(1, t / sec + .3)); d[i] = lp * Math.exp(-t * 6.9 / decay); }
  }
  return buf;
}
function initAudio() {
  if (AC) { if (AC.state !== 'running') AC.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  AC = new Ctx();
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.connect(AC.destination);
  master = gainNode(.9, comp);
  sfxBus = gainNode(1, master); voiceBus = gainNode(1.15, master);
  verbBig = AC.createConvolver(); verbBig.buffer = makeIR(3.4, 3.0, .55); verbBig.connect(gainNode(.5, master));
  verbSmall = AC.createConvolver(); verbSmall.buffer = makeIR(1.0, .8, .3); verbSmall.connect(gainNode(.35, master));
  musicLP = AC.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 1400;
  musicBus = gainNode(0, musicLP); musicLP.connect(gainNode(.55, master)); musicLP.connect(gainNode(.6, verbBig));
  const lfo = AC.createOscillator(); lfo.frequency.value = .33; wob = gainNode(10); lfo.connect(wob); lfo.start();
  noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  // the hum of the lights during the day (it stops at night, which is worse)
  humGain = gainNode(0, sfxBus);
  for (const [f, v] of [[120, .5], [240, .25], [360, .1]]) { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(gainNode(v, humGain)); o.start(); }
  // a broken light buzzing somewhere close
  buzzGain = gainNode(0, sfxBus); buzzFilter = AC.createBiquadFilter(); buzzFilter.type = 'bandpass'; buzzFilter.frequency.value = 1800; buzzFilter.Q.value = 1.5; buzzFilter.connect(buzzGain);
  const bz = AC.createOscillator(); bz.type = 'sawtooth'; bz.frequency.value = 100; bz.connect(buzzFilter); bz.start();
  musicNext = AC.currentTime + .1;
  setInterval(musicTick, 25);
  loadVoices();
}
function loadVoices() {
  const D = window.VOICE_DATA;
  if (!D || VOX.loading || !AC) return;
  VOX.loading = true;
  for (const [name, c] of Object.entries(D.clips)) {
    const bin = atob(c.b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    let settled = false;
    const ok = b => { if (settled) return; settled = true; VOX.buf.set(name, b); VOX.meta.set(name, c); VOX.count++; };
    const no = () => { settled = true; };
    try { const pr = AC.decodeAudioData(u.buffer, ok, no); if (pr && pr.then) pr.then(ok, no); } catch (e) { no(); }
  }
}

// ---------------------------------------------------------------- placing a sound in the store
function spatial(x, y) {
  const dx = x - player.x, dy = y - (player.y - 10);
  return { d: Math.hypot(dx, dy) / T, pan: clamp(dx / (7 * T), -1, 1), occl: !clearLine(player.x, player.y - 10, x, y + 8, opaque) };
}
function place3d(h, instant) {
  let g = h.vol, cut = 14000, wet = .1, pan = 0;
  if (h.x !== undefined && player) {
    const s = spatial(h.x, h.y), f = clamp(1 - s.d / h.range, 0, 1);
    g *= Math.pow(f, 1.3); if (s.occl) g *= .5;
    cut = s.occl ? 500 + 1500 * f : 1800 + 11000 * f * f;
    wet = (h.wet || .12) + .55 * (1 - f); pan = s.pan;
  }
  const t = AC.currentTime, set = (p, v) => instant ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, .05);
  set(h.g.gain, g); set(h.lp.frequency, cut); set(h.send.gain, wet); if (h.p) set(h.p.pan, pan);
}
function at(x, y, vol, o = {}) {
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass';
  const g = AC.createGain(), send = AC.createGain(), p = AC.createStereoPanner ? AC.createStereoPanner() : null;
  lp.connect(g);
  const out = o.bus || sfxBus;
  if (p) { g.connect(p); p.connect(out); p.connect(send); } else { g.connect(out); g.connect(send); }
  send.connect(verbBig);
  const h = { input: lp, lp, g, p, send, x, y, vol, range: o.range || 16, wet: o.wet, follow: o.follow, end: AC.currentTime + (o.dur || 2) };
  place3d(h, true);
  if (h.follow) live.push(h);
  return h;
}
const flat = (vol, bus) => ({ input: gainNode(vol, bus || sfxBus) });
function updateLive() {
  if (!AC) return;
  for (let i = live.length - 1; i >= 0; i--) {
    const h = live[i];
    if (AC.currentTime > h.end) { live.splice(i, 1); continue; }
    if (h.follow) { h.x = h.follow.x; h.y = h.follow.y - 30; }
    place3d(h);
  }
}

// ---------------------------------------------------------------- building blocks
function tone(dest, type, f, t0, dur, vol, f2, attack = .005) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(.0001, t0 + attack + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + attack + dur + .05);
  return o;
}
function hiss(dest, t0, dur, vol, ftype, freq, q = 1, attack = .003, f2) {
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = ftype; f.frequency.setValueAtTime(freq, t0); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t0 + dur); f.Q.value = q;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(.0001, t0 + attack + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t0, Math.random() * 1.5); s.stop(t0 + attack + dur + .05);
}
const ok = () => AC && player;

// ---------------------------------------------------------------- the player's sounds
function sStep(tile, running) {
  if (!ok()) return;
  const t0 = now(), v = running ? .11 : .065, d = flat(1);
  const k = tile - FLOOR0;
  if (tile === HALL || k === RT.CLASS || k === RT.SCIENCE || k === RT.NURSE || k === RT.COMMONS) { hiss(d.input, t0, .04, v, 'bandpass', 2600, 1.2); tone(d.input, 'sine', 140, t0, .05, v * .8, 90); }
  else if (k === RT.LIB || k === RT.MUSIC || k === RT.LOUNGE) hiss(d.input, t0, .07, v * .9, 'lowpass', 500);
  else if (k === RT.GYM || k === RT.OFFICE) { hiss(d.input, t0, .05, v, 'bandpass', 700, 2); tone(d.input, 'sine', 190, t0, .09, v * 1.1, 120); if (running && Math.random() < .25) tone(d.input, 'sine', rand(2400, 3200), t0 + .02, .05, .015); }
  else if (k === RT.BATH || k === RT.CAFE) { hiss(d.input, t0, .03, v * 1.1, 'bandpass', 3800, 2); tone(d.input, 'sine', 160, t0, .04, v * .6, 100); }
  else hiss(d.input, t0, .06, v, 'highpass', 1800);
}
const MAT_SOUND = {
  wood: (d, t0, v) => { tone(d, 'sine', 130, t0, .18, v, 70); hiss(d, t0, .12, v * .8, 'lowpass', 900); },
  metal: (d, t0, v) => { for (const [f, a] of [[340, 1], [767, .6], [1231, .4], [1870, .25]]) tone(d, 'sine', f * rand(.97, 1.03), t0, .5 * a + .1, v * .35 * a); hiss(d, t0, .08, v * .6, 'bandpass', 3000); },
  plastic: (d, t0, v) => { tone(d, 'sine', 320, t0, .07, v * .8, 240); hiss(d, t0, .05, v * .6, 'bandpass', 1600); },
  soft: (d, t0, v) => { hiss(d, t0, .16, v, 'lowpass', 320); tone(d, 'sine', 80, t0, .14, v * .7, 50); },
  box: (d, t0, v) => { hiss(d, t0, .1, v, 'bandpass', 700, 1.4); hiss(d, t0 + .03, .08, v * .5, 'bandpass', 1500, 2); },
  bone: (d, t0, v) => { for (let i = 0; i < 6; i++) tone(d, 'triangle', rand(900, 1500), t0 + i * .035, .04, v * .5); }
};
function sPick(mat) { if (!ok()) return; const t0 = now(), d = flat(1).input; MAT_SOUND[mat](d, t0, .22); tone(d, 'square', 520, t0 + .02, .05, .03); tone(d, 'square', 780, t0 + .07, .06, .03); }
function sPlace(mat) { if (!ok()) return; const t0 = now(), d = flat(1).input; MAT_SOUND[mat](d, t0, .45); tone(d, 'sine', 70, t0, .2, .25, 40); }
function sBang(mat, x, y) { if (!ok()) return; const h = at(x, y, 1, { range: 18 }), t0 = now(); MAT_SOUND[mat](h.input, t0, .9); hiss(h.input, t0, .2, .5, 'lowpass', 500); tone(h.input, 'sine', 60, t0, .25, .5, 35); }
function sBreak(mat, x, y) {
  if (!ok()) return; const h = at(x, y, 1, { range: 20, dur: 2 }), t0 = now();
  hiss(h.input, t0, .55, .7, 'lowpass', mat === 'metal' ? 4000 : 1800);
  for (let i = 0; i < 7; i++) MAT_SOUND[mat](h.input, t0 + rand(0, .45), rand(.2, .5));
}
function sDoor(closed, x, y) {
  if (!ok()) return; const h = at(x, y, 1, { range: 18 }), t0 = now();
  if (closed) { tone(h.input, 'sine', 90, t0, .25, .6, 45); hiss(h.input, t0, .1, .5, 'lowpass', 700); hiss(h.input, t0 + .12, .03, .35, 'bandpass', 3200, 3); }
  else { hiss(h.input, t0, .03, .3, 'bandpass', 3200, 3); creak(h.input, t0 + .05, .55, .14); }
}
function creak(dest, t0, dur, vol) {
  const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(rand(150, 190), t0); o.frequency.linearRampToValueAtTime(rand(220, 300), t0 + dur);
  f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 9;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .08);
  for (let i = 1; i < 8; i++) g.gain.setValueAtTime(vol * rand(.3, 1), t0 + dur * i / 8);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(f); f.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + .05);
}
function sRattle(t) { if (!ok()) return; const h = at(t.x, t.y - 20, 1, { range: 16 }), t0 = now(); for (let i = 0; i < 3; i++) { hiss(h.input, t0 + i * .07 + rand(0, .02), .025, .5, 'bandpass', rand(2600, 3600), 4); tone(h.input, 'square', rand(1800, 2200), t0 + i * .07, .02, .05); } }
function sSwing() { if (!ok()) return; hiss(flat(1).input, now(), .14, .16, 'bandpass', 900, 2, .02, 2600); }
function sHit() { if (!ok()) return; const d = flat(1).input, t0 = now(); hiss(d, t0, .08, .35, 'lowpass', 1400); tone(d, 'sine', 170, t0, .12, .4, 60); tone(d, 'square', 900, t0, .03, .06); }
function sHurt() { if (!ok()) return; const d = flat(1).input, t0 = now(); tone(d, 'sawtooth', 240, t0, .3, .22, 70); hiss(d, t0, .25, .25, 'lowpass', 900); tone(d, 'sine', 55, t0, .5, .5, 30); }
function sHeart(fast) { if (!ok()) return; const d = flat(1).input, t0 = now(), v = fast ? .55 : .4; tone(d, 'sine', 58, t0, .13, v, 38); tone(d, 'sine', 52, t0 + .17, .15, v * .8, 36); }
function sEat(bandage) { if (!ok()) return; const d = flat(1).input, t0 = now(); if (bandage) { hiss(d, t0, .4, .2, 'highpass', 3000, 1, .1); } else for (let i = 0; i < 4; i++) hiss(d, t0 + i * .11, .06, .25, 'bandpass', rand(1500, 2600), 1.5); }
function sPickup() { if (!ok()) return; const d = flat(1).input, t0 = now(); tone(d, 'triangle', 880, t0, .08, .1); tone(d, 'triangle', 1320, t0 + .08, .12, .1); }
function sClick() { if (!ok()) return; const d = flat(1).input, t0 = now(); hiss(d, t0, .015, .3, 'bandpass', 3500, 3); tone(d, 'square', 1200, t0, .01, .05); }
function sBeep() { if (!ok()) return; const d = flat(1).input, t0 = now(); tone(d, 'square', 1760, t0, .05, .03); tone(d, 'square', 1760, t0 + .12, .05, .03); }
function sDeny() { if (!ok()) return; tone(flat(1).input, 'square', 180, now(), .09, .06, 150); }
function sTeacherStep(t, d, loud) {
  if (!ok()) return;
  const h = at(t.x, t.y, loud * (t.state === 'hunt' ? 1.1 : .8), { range: 15, dur: .5 }), t0 = now();
  if (t.sp.heels) { hiss(h.input, t0, .025, .5, 'bandpass', 3400, 3); tone(h.input, 'sine', 1900, t0, .03, .12); }
  else if (t.kind === 'principal') { hiss(h.input, t0, .1, .7, 'lowpass', 300); tone(h.input, 'sine', 55, t0, .18, .7, 35); }
  else { hiss(h.input, t0, .06, .5, 'lowpass', 600); tone(h.input, 'sine', 85, t0, .09, .45, 55); }
}
function sVanish(t) {
  if (!ok()) return; const h = at(t.x, t.y - 20, 1, { range: 16 }), t0 = now();
  for (let i = 0; i < 12; i++) tone(h.input, 'square', rand(80, 1400), t0 + i * .045, .04, .08);
  hiss(h.input, t0, .8, .25, 'highpass', 2500, 1, .05);
  tone(h.input, 'sawtooth', 300, t0, .9, .12, 40);
}
// when one of them sees you: a sting and a shriek
function sSting(t) {
  if (!ok()) return; const t0 = now(), d = flat(.9).input;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t0); lp.frequency.exponentialRampToValueAtTime(5000, t0 + .25); lp.frequency.exponentialRampToValueAtTime(800, t0 + 1.8); lp.connect(d); lp.connect(verbBig);
  for (const f of [207.65, 220, 233.08, 246.94, 415.3]) { const o = tone(lp, 'sawtooth', f, t0, 1.8, .06, null, .02); o.detune.value = rand(-15, 15); }
  hiss(lp, t0, .5, .25, 'bandpass', 2500, 1, .01, 6000);
  // the shriek: a throat made of two filters
  const h = at(t.x, t.y - 30, 1, { range: 24, dur: 1.5 });
  const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t0); o.frequency.exponentialRampToValueAtTime(260, t0 + .9);
  const vib = AC.createOscillator(); vib.frequency.value = 23; const vg = gainNode(30); vib.connect(vg); vg.connect(o.frequency); vib.start(t0); vib.stop(t0 + 1);
  const ws = AC.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 4); } ws.curve = curve;
  const env = AC.createGain(); env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(.35, t0 + .04); env.gain.exponentialRampToValueAtTime(.001, t0 + .95);
  for (const [f, q] of [[900, 6], [1400, 8], [2600, 10]]) { const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; o.connect(bp); bp.connect(ws); }
  ws.connect(env); env.connect(h.input); o.start(t0); o.stop(t0 + 1);
}
// the security guard's whistle: a shrill trill that carries down every hall
function sWhistle(t) {
  if (!ok()) return; const h = at(t.x, t.y - 30, 1.2, { range: 26, dur: 1.2 }), t0 = now();
  const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = 2650;
  const tr = AC.createOscillator(); tr.frequency.value = 28; const tg = gainNode(160); tr.connect(tg); tg.connect(o.frequency);
  const g = AC.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.35, t0 + .02); g.gain.setValueAtTime(.35, t0 + .55); g.gain.exponentialRampToValueAtTime(.001, t0 + .75);
  o.connect(g); g.connect(h.input); hiss(h.input, t0, .7, .08, 'bandpass', 3000, 2);
  o.start(t0); tr.start(t0); o.stop(t0 + .8); tr.stop(t0 + .8);
}
// what you hear when one of them gets you
function sJumpscare() {
  if (!AC) return; const t0 = now(), d = gainNode(1.4, master);
  const ws = AC.createWaveShaper(), curve = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; curve[i] = Math.tanh(x * 8); } ws.curve = curve; ws.connect(d); ws.connect(gainNode(.6, verbBig));
  const env = AC.createGain(); env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(.9, t0 + .015); env.gain.setValueAtTime(.9, t0 + .9); env.gain.exponentialRampToValueAtTime(.001, t0 + 1.7); env.connect(ws);
  for (const [f, q] of [[850, 5], [1350, 7], [2700, 9], [3900, 9]]) {
    const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rand(560, 640), t0); o.frequency.exponentialRampToValueAtTime(180, t0 + 1.6);
    const vib = AC.createOscillator(); vib.frequency.value = rand(17, 25); const vg = gainNode(55); vib.connect(vg); vg.connect(o.frequency);
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; o.connect(bp); bp.connect(env);
    o.start(t0); vib.start(t0); o.stop(t0 + 1.8); vib.stop(t0 + 1.8);
  }
  hiss(d, t0, 1.3, .55, 'highpass', 900, 1, .005);
  for (const f of [233, 247, 262, 277]) tone(d, 'sawtooth', f * 2, t0, 1.5, .08, f * .9, .01);
  tone(d, 'sine', 60, t0, 1.2, .9, 25, .005);
}
function sBell(creepy) {
  if (!ok()) return; const t0 = now(), dur = creepy ? 4 : 2.6, out = flat(.5).input;
  const amp = AC.createGain(); amp.gain.value = 0; amp.connect(out); amp.connect(verbBig);
  const lfo = AC.createOscillator(); lfo.type = 'square'; lfo.frequency.setValueAtTime(22, t0); if (creepy) lfo.frequency.linearRampToValueAtTime(7, t0 + dur);
  const lg = gainNode(.5); lfo.connect(lg); lg.connect(amp.gain);
  const env = AC.createGain(); env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(1, t0 + .02); env.gain.setValueAtTime(1, t0 + dur - .3); env.gain.linearRampToValueAtTime(0, t0 + dur); env.connect(amp);
  for (const [f, v] of [[950, .3], [2610, .15], [5150, .07]]) {
    const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t0); if (creepy) o.frequency.exponentialRampToValueAtTime(f * .55, t0 + dur);
    o.connect(gainNode(v, env)); o.start(t0); o.stop(t0 + dur + .05);
  }
  lfo.start(t0); lfo.stop(t0 + dur + .05);
}
function sChime(night) {
  if (!ok()) return; const t0 = now(), d = flat(.5).input;
  const notes = night ? [79, 75, 72] : [79, 76, 72];
  notes.forEach((m, i) => { const f = 440 * Math.pow(2, (m - 69) / 12) * (night ? .985 : 1), tt = t0 + i * (night ? .7 : .5); tone(d, 'sine', f, tt, 1.6, .18, null, .01); tone(d, 'sine', f * 2.01, tt, .8, .04, null, .01); tone(verbBig, 'sine', f, tt, 1.6, .08, null, .01); });
}

// ---------------------------------------------------------------- the voices
function showSub(text, who, kind, delay, dur) {
  const t = performance.now() / 1000 + delay;
  subtitles.push({ text, who, kind, start: t, end: t + Math.max(1.6, dur) });
  if (subtitles.length > 4) subtitles.shift();
}
function creepDrone(dest, t0, vol) {
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.connect(dest);
  for (const f of [43, 44.4, 64.8]) { const o = tone(lp, 'sawtooth', f, t0, 2.4, vol * .1, f * .82, .5); o.detune.value = rand(-20, 20); }
}
function speakLine(id, t) {
  const text = LINE_TEXT[id] || id;
  const kind = id.startsWith('pa_') ? 'pa' : id.startsWith('w_') ? 'whisper' : 'speak';
  const voice = t ? t.sp.voice : 'slt';
  const name = kind === 'pa' ? 'pa/' + id : kind === 'whisper' ? `whisper/${voice === 'bdl' ? 'bdl' : 'clb'}/${id}` : `speak/${voice}/${id}`;
  const buf = AC && VOX.buf.get(name);
  if (t) { t.say = text; }
  if (buf) {
    const meta = VOX.meta.get(name), rate = t ? t.sp.rate : 1, dur = buf.duration / rate, t0 = now() + .02;
    const src = AC.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    if (src.detune && kind !== 'pa') wob.connect(src.detune);
    let h;
    if (t) {
      h = at(t.x, t.y - 30, kind === 'whisper' ? 1.5 : 1.25, { bus: voiceBus, range: kind === 'whisper' ? 7 : 18, follow: t, dur: dur + 1, wet: kind === 'whisper' ? .02 : .1 });
      if (kind === 'speak') {
        // the line echoes down the hall a moment later
        const dl = AC.createDelay(1); dl.delayTime.value = .31; const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
        src.connect(dl); dl.connect(hp); hp.connect(gainNode(.16, h.g));
        creepDrone(h.input, t0, 1);
      }
      t.sayT = dur + .6;
    } else {
      h = { input: gainNode(1.1, voiceBus) }; h.input.connect(gainNode(.3, verbBig));
      duckMusic(dur + 1);
    }
    src.connect(h.input); src.start(t0);
    src.onended = () => { try { wob.disconnect(src.detune); } catch (e) { /* already gone */ } };
    showSub(text, t, kind, (meta.on || 0) / rate * .9, dur - (meta.on || 0) / rate);
    return dur;
  }
  // no recordings: fall back to the browser's own voice, as low and slow as it will go
  if ('speechSynthesis' in window) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = kind === 'pa' ? .6 : 0; u.rate = kind === 'pa' ? .85 : .58; u.volume = t ? clamp(1 - Math.hypot(t.x - player.x, t.y - player.y) / (16 * T), .15, 1) : 1;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* no voice available */ }
  }
  if (AC && t && kind === 'speak') creepDrone(at(t.x, t.y - 30, 1, { range: 16, follow: t, dur: 3 }).input, now(), 1);
  showSub(text, t, kind, 0, 2.6);
  if (t) t.sayT = 2.8;
  return 2.6;
}
// announcements wait their turn: one chime, one message, then the next
const paQueue = [], PA_DAY_IDS = ['pa_morning', 'pa_running', 'pa_lunch', 'pa_wonderful', 'pa_final_bell'];
let paBusy = 0;
function paAnnounce(id) { if (paQueue.length < 3 && !paQueue.includes(id)) paQueue.push(id); }
function updatePA(dt) {
  paBusy -= dt;
  if (paBusy > 0 || !paQueue.length || state !== 'play') return;
  const id = paQueue.shift(), night = isNight(), meta = VOX.meta.get('pa/' + id), lead = night ? 2.3 : 1.7;
  if (PA_DAY_IDS.includes(id) === night) return;   // a morning message never plays after dark, and the reverse
  paBusy = lead + (meta ? meta.len : 4) + 1.5;
  if (!AC) { showSub(LINE_TEXT[id], null, 'pa', 0, 4); return; }
  sChime(night);
  setTimeout(() => { if (state === 'play') { speakLine(id, null); voiceFreeAt = Math.max(voiceFreeAt, performance.now() / 1000 + 4); } }, lead * 1000);
}
let duckUntil = 0;
function duckMusic(sec) { duckUntil = performance.now() / 1000 + sec; }
// an employee humming the store jingle, slowly and out of tune
function humTune(t) {
  if (!ok()) return false;
  const nowS = performance.now() / 1000;
  if (nowS < voiceFreeAt) return false;
  const notes = [], start = randi(0, 12) * 2;
  for (let i = 0; i < 8; i++) { const ev = MELODY_FLAT[(start + i) % MELODY_FLAT.length]; notes.push(ev); }
  const step = rand(.5, .65), dur = notes.length * step + 1, base = t.sp.voice === 'bdl' ? -12 : 0;
  const h = at(t.x, t.y - 30, 1.1, { bus: voiceBus, range: 15, follow: t, dur });
  const o = AC.createOscillator(); o.type = 'sawtooth';
  const vib = AC.createOscillator(); vib.frequency.value = 5.2; const vg = gainNode(8); vib.connect(vg); vg.connect(o.detune);
  const env = AC.createGain(); env.gain.value = 0;
  for (const [f, q, v] of [[260, 4, 1], [2400, 6, .12]]) { const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; o.connect(bp); bp.connect(gainNode(v, env)); }
  env.connect(h.input);
  const t0 = now() + .05;
  notes.forEach((m, i) => {
    const tt = t0 + i * step, f = 440 * Math.pow(2, (m + base - 12 - 69) / 12);
    o.frequency.setTargetAtTime(f, tt, .04); o.detune.setValueAtTime(rand(-55, 15), tt);
    env.gain.setTargetAtTime(.5, tt, .05); env.gain.setTargetAtTime(.18, tt + step * .7, .08);
  });
  env.gain.setTargetAtTime(0, t0 + notes.length * step, .2);
  o.start(t0); vib.start(t0); o.stop(t0 + dur); vib.stop(t0 + dur);
  t.say = '(humming)'; t.sayT = dur;
  showSub('(humming the store jingle)', t, 'hum', 0, dur - .5);
  voiceFreeAt = nowS + dur + 1;
  return true;
}

// ---------------------------------------------------------------- the music, faint, from somewhere far away
const CHORDS = [[48, 0], [45, 1], [41, 0], [43, 0], [48, 0], [45, 1], [38, 1], [43, 0], [41, 0], [43, 0], [40, 1], [45, 1], [41, 0], [43, 0], [48, 0], [48, 0]];
const MELODY = [
  [[0, 76, 3], [3, 74, 1], [4, 72, 2], [6, 67, 2]], [[0, 69, 3], [3, 72, 1], [4, 76, 4]], [[0, 77, 3], [3, 76, 1], [4, 74, 2], [6, 72, 2]], [[0, 74, 6]],
  [[0, 76, 3], [3, 74, 1], [4, 72, 2], [6, 76, 2]], [[0, 81, 3], [3, 79, 1], [4, 76, 4]], [[0, 77, 2], [2, 76, 2], [4, 74, 2], [6, 77, 2]], [[0, 79, 6]],
  [[0, 81, 2], [2, 79, 2], [4, 77, 2], [6, 81, 2]], [[0, 79, 4], [4, 74, 4]], [[0, 76, 2], [2, 79, 2], [4, 83, 2], [6, 79, 2]], [[0, 81, 6]],
  [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2]], [[0, 79, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2]], [[0, 76, 4], [4, 67, 2], [6, 72, 2]], [[0, 72, 6]]
];
const MELODY_FLAT = MELODY.flat().map(e => e[1]);
const mhz = m => 440 * Math.pow(2, (m - 69) / 12);
function mnote(type, m, t0, dur, vol, detune) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = mhz(m); o.detune.value = detune + rand(-5, 5);
  wob.connect(o.detune);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g); g.connect(musicBus); o.start(t0); o.stop(t0 + dur + .05);
  o.onended = () => { try { wob.disconnect(o.detune); } catch (e) { /* gone */ } };
}
function musicTick() {
  if (!AC) return;
  const playing = state === 'play' && musicLevel > .01;
  const tempo = 1 - .5 * duskAmt, stepLen = 60 / 78 / 2 / tempo, det = -700 * duskAmt * duskAmt;
  if (!playing) { musicNext = AC.currentTime + .05; return; }
  while (musicNext < AC.currentTime + .15) {
    const t0 = musicNext, s = musicStep % 128, bar = s >> 3, st = s & 7, [root, minor] = CHORDS[bar];
    for (const [ms, m, len] of MELODY[bar]) if (ms === st) { mnote('sine', m, t0, 1.4 * len / 4 + .5, .2, det); mnote('sine', m + 12, t0, .6, .045, det + 4); }
    if (st === 0 || st === 4) {
      mnote('triangle', root - 12, t0, .9, .26, det);
      for (const iv of [0, minor ? 3 : 4, 7]) mnote('triangle', root + 12 + iv, t0 + iv * .004, 1.5, .055, det);
    }
    if (st === 2 || st === 6) { const g = AC.createGain(); g.connect(musicBus); hiss(g, t0, .04, .02, 'highpass', 7000); }
    musicStep++; musicNext += stepLen;
  }
}
function setMusic(level, sec = 2) { musicLevel = level; if (AC) musicBus.gain.setTargetAtTime(level * .22, now(), sec / 3); }

// ---------------------------------------------------------------- the store at night
function nightAmbient() {
  if (!ok()) return;
  const a = Math.random() * Math.PI * 2, d = rand(6, 13) * T, x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
  const h = at(x, y, 1, { range: 16, dur: 6 }), t0 = now(), r = Math.random();
  if (r < .25) for (let i = 0; i < 7; i++) { hiss(h.input, t0 + i * .55, .06, .5, 'lowpass', 500); tone(h.input, 'sine', 80, t0 + i * .55, .08, .4, 55); }
  else if (r < .42) { hiss(h.input, t0, .3, .8, 'lowpass', 900); MAT_SOUND.metal(h.input, t0, .8); }
  else if (r < .56) creak(h.input, t0, 1.6, .2);
  else if (r < .7) hiss(h.input, t0, 2.4, .12, 'bandpass', 1900, 5, .8);
  else if (r < .8) { const o = tone(h.input, 'sine', 950, t0, 3, .12, 520); o.detune.value = -40; }
  else if (r < .92) musicBox(h.input, t0);
  else { for (let i = 0; i < 5; i++) tone(h.input, 'triangle', rand(200, 700), t0 + i * .9, 1.4, .08); }
}
function musicBox(dest, t0) {
  const start = randi(0, 20);
  for (let i = 0; i < 9; i++) {
    const m = MELODY_FLAT[(start + i) % MELODY_FLAT.length], o = tone(dest, 'sine', mhz(m), t0 + i * .75, 1.4, .18, null, .01);
    o.detune.value = -90 + rand(-35, 35);
    tone(verbBig, 'sine', mhz(m + 12), t0 + i * .75, .7, .03, null, .01);
  }
}
// the title screen: a low drone, air moving somewhere, and a music box that keeps starting over
let titleNodes = null, titleTimer = null;
function titleAmbience(on) {
  if (!AC) return;
  if (on && !titleNodes) {
    const g = gainNode(0, master); g.gain.setTargetAtTime(.55, now(), 1.5);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 230; lp.connect(g);
    const oscs = [55, 55.6, 82.2, 41.1].map(f => { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(gainNode(.05, lp)); o.start(); return o; });
    const n = AC.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = .7; n.connect(bp); bp.connect(gainNode(.035, g)); n.start();
    titleNodes = { g, oscs, n };
    musicBox(gainNode(.55, master), now() + 1.5);
    titleTimer = setInterval(() => { if (state === 'title' && titleNodes) musicBox(gainNode(.55, master), now()); }, 12000);
  } else if (!on && titleNodes) {
    const tn = titleNodes; titleNodes = null; clearInterval(titleTimer);
    tn.g.gain.setTargetAtTime(0, now(), .25);
    setTimeout(() => { tn.oscs.forEach(o => o.stop()); tn.n.stop(); }, 1500);
  }
}
// called every frame: the light hum, the buzzing of broken lights, the music
function updateAmbience(dt, nearestBuzz, musicRoomDist) {
  if (!AC) return;
  const t0 = now(), day = !isNight() && state === 'play';
  humGain.gain.setTargetAtTime(day ? .011 * (1 - duskAmt) : 0, t0, .3);
  buzzGain.gain.setTargetAtTime(state === 'play' && nearestBuzz < 5 * T ? .02 * (1 - nearestBuzz / (5 * T)) * (Math.random() < .3 ? .2 : 1) : 0, t0, .03);
  const boost = clamp(1 - musicRoomDist / (14 * T), 0, 1);
  musicLP.frequency.setTargetAtTime((1400 + 3600 * boost) * (1 - .8 * duskAmt), t0, .4);
  const duck = performance.now() / 1000 < duckUntil ? .3 : 1;
  if (musicLevel > 0) musicBus.gain.setTargetAtTime(musicLevel * (.22 + .3 * boost) * (1 - .3 * duskAmt) * duck, t0, .25);
  updateLive();
}
