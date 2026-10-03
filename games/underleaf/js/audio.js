'use strict';
/* Sound. Everything is synthesised live with the Web Audio API: no audio files.
   One-shot effects are built from oscillators and filtered noise; the ambience
   (birdsong, crickets, wind, rain, running water) is a set of looping noise beds
   and little scheduled phrases whose levels follow the time of day and weather. */

const SFX = {
  ctx: null, master: null, sfxBus: null, ambBus: null, noiseBuf: null,
  muted: false, vol: 0.8, beds: null, nextBird: 0, nextCricket: 0, nextCroak: 0, last: {},

  init() {
    try { this.muted = localStorage.getItem('underleaf-muted') === '1'; } catch (e) { /* ignore */ }
    const unlock = () => { this.start(); };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) this.click(); });
  },

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.gain.value = 0.9; this.ambBus.connect(this.master);
    // two seconds of white noise, reused by every noisy sound
    const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.beds = {
      wind: this.bed('lowpass', 380, 0.7),
      rain: this.bed('highpass', 1400, 0.4),
      water: this.bed('bandpass', 900, 3),
      leaves: this.bed('bandpass', 3200, 1.2),
    };
  },

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('underleaf-muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.05);
    return this.muted;
  },

  get ready() { return !!this.ctx && this.ctx.state === 'running' && !this.muted; },

  /* A looping filtered-noise bed whose level is steered by update(). */
  bed(type, freq, q) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.ambBus);
    src.start(c.currentTime, Math.random() * 1.5);
    return { g, f };
  },

  /* ---------------------------------------------------------- building blocks */

  tone(freq, dur, { type = 'sine', vol = 0.2, to = null, attack = 0.005, delay = 0, bus = null, pan = 0 } = {}) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this.route(g, bus, pan);
    o.start(t); o.stop(t + dur + 0.05);
  },

  noise(dur, { type = 'bandpass', freq = 1000, q = 1, vol = 0.2, to = null, attack = 0.003, delay = 0, bus = null, pan = 0 } = {}) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); this.route(g, bus, pan);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },

  route(node, bus, pan) {
    const out = bus || this.sfxBus;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
      node.connect(p); p.connect(out);
    } else node.connect(out);
  },

  /* Don't stack the same sound many times in one instant. */
  gate(key, gap) {
    const now = performance.now();
    if (this.last[key] && now - this.last[key] < gap * 1000) return false;
    this.last[key] = now;
    return true;
  },

  /* Volume and pan for a sound at a world position, heard from the camera. */
  at(game, x, y, range = 700) {
    const cam = game.camera, d = dist(x, y, cam.x, cam.y);
    if (d > range) return null;
    const k = 1 - d / range;
    return { v: k * k, pan: clamp((x - cam.x) / 600, -0.8, 0.8) };
  },

  /* ---------------------------------------------------------------- effects */

  bite(hit) {
    if (!this.gate('bite', 0.06)) return;
    this.noise(0.05, { type: 'highpass', freq: 2500, vol: 0.18 });
    if (hit) this.tone(260, 0.07, { type: 'triangle', vol: 0.12, to: 140 });
  },
  hurt() {
    if (!this.gate('hurt', 0.15)) return;
    this.tone(330, 0.16, { type: 'square', vol: 0.06, to: 160 });
    this.noise(0.1, { type: 'lowpass', freq: 900, vol: 0.12 });
  },
  pickup() {
    this.tone(520, 0.09, { type: 'triangle', vol: 0.12, to: 780 });
  },
  deliver() {
    this.tone(660, 0.12, { type: 'sine', vol: 0.15 });
    this.tone(990, 0.18, { type: 'sine', vol: 0.12, delay: 0.08 });
  },
  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.13, delay: i * 0.08 }));
  },
  achievement() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.35, { type: 'sine', vol: 0.11, delay: i * 0.07 }));
    this.noise(0.6, { type: 'highpass', freq: 6000, vol: 0.04, delay: 0.1 });
  },
  dash() {
    this.noise(0.18, { type: 'bandpass', freq: 600, to: 2400, q: 2, vol: 0.14 });
  },
  ability() {
    this.tone(220, 0.35, { type: 'sawtooth', vol: 0.05, to: 660 });
    this.noise(0.3, { type: 'bandpass', freq: 1200, to: 4000, q: 3, vol: 0.08 });
  },
  rally() {
    // a pheromone "call": a soft rising chirr
    for (let i = 0; i < 4; i++) this.tone(900 + i * 120, 0.05, { type: 'square', vol: 0.03, delay: i * 0.045 });
  },
  death() {
    this.tone(400, 0.8, { type: 'triangle', vol: 0.14, to: 90 });
    this.tone(300, 0.9, { type: 'sine', vol: 0.1, to: 60, delay: 0.1 });
  },
  egg() {
    this.tone(880, 0.1, { type: 'sine', vol: 0.06 });
    this.tone(1320, 0.12, { type: 'sine', vol: 0.05, delay: 0.06 });
  },
  click() {
    if (!this.gate('click', 0.04)) return;
    this.tone(1200, 0.04, { type: 'triangle', vol: 0.06, to: 900 });
  },
  season() {
    [392, 494, 587].forEach((f, i) => this.tone(f, 0.9, { type: 'sine', vol: 0.06, delay: i * 0.18 }));
  },
  nestDoor() {
    this.noise(0.35, { type: 'lowpass', freq: 500, to: 150, vol: 0.16 });
  },

  /* Sounds from the world, quieter with distance and panned left or right. */
  world(game, kind, x, y) {
    const s = this.at(game, x, y, kind === 'robin' ? 1400 : 800);
    if (!s || !this.ready) return;
    const v = s.v, pan = s.pan;
    switch (kind) {
      case 'kill':
        if (!this.gate('kill', 0.2)) return;
        this.noise(0.2, { type: 'lowpass', freq: 700, vol: 0.18 * v, pan });
        this.tone(180, 0.2, { type: 'triangle', vol: 0.1 * v, to: 90, pan });
        break;
      case 'robin':
        if (!this.gate('robin', 1)) return;
        this.birdPhrase(0.18 * v + 0.05, pan, true);
        this.noise(0.5, { type: 'bandpass', freq: 400, q: 0.8, vol: 0.2 * v, delay: 0.3, pan });
        break;
      case 'croak':
        if (!this.gate('croak', 0.5)) return;
        for (let i = 0; i < 3; i++) this.tone(110, 0.09, { type: 'sawtooth', vol: 0.09 * v, to: 85, delay: i * 0.11, pan });
        break;
      case 'buzz':
        if (!this.gate('buzz', 0.6)) return;
        this.tone(190 + Math.random() * 40, 0.6, { type: 'sawtooth', vol: 0.025 * v, attack: 0.1, pan });
        break;
      case 'splash':
        if (!this.gate('splash', 0.3)) return;
        this.noise(0.3, { type: 'bandpass', freq: 1400, to: 500, q: 1.5, vol: 0.2 * v, pan });
        break;
      case 'leap':
        this.tone(1400, 0.06, { type: 'square', vol: 0.06 * v, to: 300, pan });
        break;
      case 'squeak':
        if (!this.gate('squeak', 0.8)) return;
        for (let i = 0; i < 2; i++) this.tone(3200 + Math.random() * 600, 0.05, { type: 'sine', vol: 0.06 * v, to: 2600, delay: i * 0.09, pan });
        break;
    }
  },

  birdPhrase(vol, pan, robin) {
    const base = robin ? 2400 : 2800 + Math.random() * 1600, n = 3 + ((Math.random() * 5) | 0);
    let t = 0;
    for (let i = 0; i < n; i++) {
      const f = base * (0.8 + Math.random() * 0.5), d = 0.05 + Math.random() * 0.1;
      this.tone(f, d, { type: 'sine', vol, to: f * (0.7 + Math.random() * 0.7), delay: t, bus: this.ambBus, pan });
      t += d + 0.02 + Math.random() * 0.06;
    }
  },

  /* ---------------------------------------------------------------- ambience */

  update(dt, game) {
    if (!this.ctx || !this.beds) return;
    const c = this.ctx, now = c.currentTime;
    const play = game.mode === 'play' || game.mode === 'attract';
    const inNest = game.view === 'nest';
    const dark = game.darkness(), rain = game.weather ? game.weather.k : 0;
    const winter = game.sw ? game.sw[3] : 0;
    let nearWater = 0;
    if (play && game.world && !inNest) {
      const cam = game.camera;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        if (game.world.waterAt(cam.x + Math.cos(a) * 260, cam.y + Math.sin(a) * 260)) nearWater += 1 / 6;
      }
      if (game.world.waterAt(cam.x, cam.y)) nearWater = 1;
    }
    const out = !inNest && play ? 1 : 0;
    const set = (b, v) => b.g.gain.setTargetAtTime(v, now, 0.6);
    set(this.beds.wind, (0.035 + winter * 0.05 + rain * 0.04) * (inNest ? 0.25 : 1) * (play ? 1 : 0.5));
    set(this.beds.rain, rain * 0.11 * (inNest ? 0.3 : 1));
    set(this.beds.water, nearWater * 0.06 * out);
    set(this.beds.leaves, (0.012 + 0.012 * Math.sin(now * 0.3)) * out * (1 - winter));
    // inside the nest everything is muffled
    this.ambBus.gain.setTargetAtTime(inNest ? 0.5 : 0.9, now, 0.3);
    if (!this.ready || !out) return;

    // daytime birdsong, night-time crickets, frogs near water
    if (now > this.nextBird) {
      this.nextBird = now + 2 + Math.random() * 6;
      if (dark < 0.3 && rain < 0.4 && winter < 0.6) this.birdPhrase(0.012 + Math.random() * 0.02, Math.random() * 1.6 - 0.8, false);
    }
    if (now > this.nextCricket) {
      this.nextCricket = now + 0.6 + Math.random() * 1.2;
      if (dark > 0.25 && winter < 0.5) {
        const f = 4200 + Math.random() * 500, pan = Math.random() * 1.6 - 0.8, v = 0.01 + Math.random() * 0.012;
        for (let i = 0; i < 3; i++) this.tone(f, 0.035, { type: 'sine', vol: v * dark, delay: i * 0.055, bus: this.ambBus, pan });
      }
    }
    // insects buzzing past the camera
    if (game.critters && Math.random() < dt * 1.5) {
      const cam = game.camera;
      for (const cr of game.critters) {
        if ((cr.kind === 'wasp' || cr.kind === 'bee' || cr.kind === 'hoverfly') && dist2(cr.x, cr.y, cam.x, cam.y) < 350 * 350) { this.world(game, 'buzz', cr.x, cr.y); break; }
      }
    }
    if (now > this.nextCroak) {
      this.nextCroak = now + 3 + Math.random() * 6;
      if (nearWater > 0.15 && winter < 0.5) {
        const pan = Math.random() * 1.6 - 0.8;
        for (let i = 0; i < 2; i++) this.tone(140, 0.12, { type: 'sawtooth', vol: 0.02 * nearWater, to: 95, delay: i * 0.16, bus: this.ambBus, pan });
      }
    }
  },
};
