'use strict';
// Retro sound effects, ambient ocean/rain and a generative chiptune soundtrack, all synthesized with WebAudio.
const Sound = {
  ctx: null, master: null, sfx: null, musicBus: null, nbuf: null,
  sfxOn: true, musicOn: true,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.55; this.musicBus.connect(this.master);
    this.buildNoise();
    this.startAmbient();
    Music.start();
  },

  buildNoise() {
    const c = this.ctx, len = c.sampleRate * 2;
    this.nbuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.nbuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  setSfx(on) { this.sfxOn = on; if (this.sfx) this.sfx.gain.value = on ? 1 : 0; if (this.amb) this.amb.bus.gain.value = on ? 1 : 0; },
  setMusic(on) { this.musicOn = on; if (this.musicBus) this.musicBus.gain.value = on ? 0.55 : 0; },

  tone(f, dur = 0.1, type = 'square', vol = 0.06, slide = 0, delay = 0, bus = null) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || this.sfx);
    o.start(t); o.stop(t + dur + 0.03);
  },

  noise(dur, vol, freq = 1000, delay = 0, bus = null, type = 'bandpass') {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.nbuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus || this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.03);
  },

  // Looping ocean waves + rain, volumes driven by the game each frame.
  startAmbient() {
    const c = this.ctx;
    const bus = c.createGain(); bus.connect(this.master);
    const mk = (type, freq, q) => {
      const s = c.createBufferSource(); s.buffer = this.nbuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(f).connect(g).connect(bus); s.start();
      return g;
    };
    this.amb = { bus, sea: mk('lowpass', 420, 0.7), rain: mk('highpass', 2200, 0.5), wind: mk('bandpass', 700, 0.4) };
  },
  setAmbient(sea, rain, t) {
    if (!this.amb) return;
    const now = this.ctx.currentTime;
    const swell = 0.55 + 0.45 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1);
    this.amb.sea.gain.setTargetAtTime(sea * 0.11 * swell, now, 0.3);
    this.amb.rain.gain.setTargetAtTime(rain * 0.07, now, 0.5);
    this.amb.wind.gain.setTargetAtTime(rain * 0.04 + 0.006, now, 0.8);
  },

  chop()   { this.noise(0.09, 0.4, 700); this.tone(150 + Math.random() * 30, 0.07, 'square', 0.05, -60); },
  mine()   { this.noise(0.06, 0.35, 2600); this.tone(900 + Math.random() * 200, 0.05, 'square', 0.03, -300); },
  pick()   { this.tone(660, 0.07); this.tone(990, 0.09, 'square', 0.05, 0, 0.06); },
  eat()    { this.tone(300, 0.06, 'triangle', 0.1); this.tone(420, 0.06, 'triangle', 0.1, 0, 0.07); },
  hurt()   { this.tone(240, 0.22, 'sawtooth', 0.08, -170); this.noise(0.1, 0.2, 400); },
  hit()    { this.tone(150, 0.08, 'square', 0.08, -70); this.noise(0.05, 0.25, 2200); },
  swing()  { this.noise(0.07, 0.13, 3200); },
  step(sand) { this.noise(0.04, sand ? 0.05 : 0.035, sand ? 1800 : 900); },
  splash() { this.noise(0.35, 0.3, 500); this.noise(0.2, 0.15, 1400, 0.05); },
  blip()   { this.tone(880, 0.025, 'square', 0.022); },
  click()  { this.tone(1200, 0.03, 'square', 0.03); },
  deny()   { this.tone(180, 0.1, 'square', 0.05); this.tone(140, 0.12, 'square', 0.05, 0, 0.09); },
  meow()   { this.tone(700, 0.25, 'triangle', 0.07, 350); this.tone(1050, 0.2, 'triangle', 0.04, -300, 0.12); },
  bang()   { this.tone(520, 0.08, 'square', 0.05); this.tone(780, 0.1, 'square', 0.05, 0, 0.07); },
  craft()  { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'square', 0.05, 0, i * 0.08)); },
  treasure() { [659, 784, 988, 1318, 1568].forEach((f, i) => this.tone(f, 0.18, 'square', 0.05, 0, i * 0.07)); },
  checkpoint() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.08, 0, i * 0.1)); },
  win() {
    const m = [523, 659, 784, 1046, 784, 1046, 1318];
    m.forEach((f, i) => this.tone(f, 0.25, 'square', 0.05, 0, i * 0.14));
    m.forEach((f, i) => this.tone(f / 2, 0.25, 'triangle', 0.08, 0, i * 0.14));
  },
};

// Generative soundtrack: chord progressions + a random-walk melody that repeats in
// 4-bar phrases and mutates every 16 bars, so it never loops the exact same way.
const Music = {
  track: 'island', timer: null, next: 0, step: 0, bar: 0, phrase: 0, lastNote: 0,
  TRACKS: {
    island: { root: 57, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 2], bpm: 96, density: 0.6, lead: 'triangle', drums: false },
    jungle: { root: 52, scale: [0, 3, 5, 7, 10], prog: [0, 3, 0, 4], bpm: 104, density: 0.55, lead: 'square', drums: true },
    sea:    { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 5, 3, 4], bpm: 78, density: 0.4, lead: 'triangle', drums: false },
    great:  { root: 55, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], bpm: 100, density: 0.55, lead: 'triangle', drums: true },
    town:   { root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 0], bpm: 116, density: 0.7, lead: 'square', drums: true },
    swamp:  { root: 48, scale: [0, 1, 5, 7, 8], prog: [0, 3, 0, 4], bpm: 72, density: 0.4, lead: 'triangle', drums: true },
    frost:  { root: 62, scale: [0, 2, 3, 7, 9], prog: [0, 3, 4, 2], bpm: 70, density: 0.35, lead: 'sine', drums: false },
    ember:  { root: 45, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 1, 0, 5], bpm: 110, density: 0.5, lead: 'square', drums: true },
    boss:   { root: 50, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 4, 0], bpm: 144, density: 0.75, lead: 'square', drums: true },
    night:  { root: 45, scale: [0, 3, 5, 7, 10], prog: [0, 5, 3, 4], bpm: 64, density: 0.3, lead: 'triangle', drums: false },
  },
  start() {
    if (this.timer || !Sound.ctx) return;
    this.next = Sound.ctx.currentTime + 0.2;
    this.timer = setInterval(() => this.tick(), 60);
  },
  setTrack(name) {
    if (name === this.track) return;
    this.track = name; this.bar = 0; this.step = 0;
  },
  freq(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  tick() {
    const c = Sound.ctx; if (!c) return;
    const tr = this.TRACKS[this.track];
    const spb = 60 / tr.bpm / 2; // eighth notes
    while (this.next < c.currentTime + 0.25) {
      this.playStep(tr, this.next, spb);
      this.next += spb;
      this.step++;
      if (this.step % 8 === 0) { this.bar++; if (this.bar % 16 === 0) this.phrase++; }
    }
  },
  playStep(tr, t, spb) {
    const s = this.step % 8;
    const rnd = RNG.mulberry32((this.bar % 4) * 131 + s * 17 + this.phrase * 7919 + tr.root);
    const chordDeg = tr.prog[this.bar % tr.prog.length];
    const scale = tr.scale, n = scale.length;
    const note = (deg, oct) => tr.root + scale[((deg % n) + n) % n] + 12 * (Math.floor(deg / n) + oct);
    const bus = Sound.musicBus;
    const delay = Math.max(0, t - Sound.ctx.currentTime);
    // bass on beats
    if (s === 0 || s === 4) Sound.tone(this.freq(note(chordDeg, -1)), spb * 3.2, 'triangle', 0.09, 0, delay, bus);
    // soft chord stab on bar start
    if (s === 0) for (const k of [0, 2]) Sound.tone(this.freq(note(chordDeg + k, 0)), spb * 6, 'sine', 0.025, 0, delay, bus);
    // melody
    if (rnd() < tr.density) {
      let deg;
      if (s % 4 === 0) deg = chordDeg + [0, 2, 4][rnd() * 3 | 0];
      else deg = this.lastNote + [-2, -1, 1, 2][rnd() * 4 | 0];
      deg = Math.max(chordDeg - 2, Math.min(chordDeg + n + 2, deg));
      this.lastNote = deg;
      Sound.tone(this.freq(note(deg, 1)), spb * (rnd() < 0.3 ? 2.2 : 1.1), tr.lead, tr.lead === 'square' ? 0.02 : 0.035, 0, delay, bus);
    }
    // light percussion
    if (tr.drums) {
      if (s % 2 === 1) Sound.noise(0.03, 0.03, 7000, delay, bus, 'highpass');
      if (s === 0 || s === 4) Sound.tone(110, 0.08, 'sine', 0.08, -60, delay, bus);
    }
  },
};
