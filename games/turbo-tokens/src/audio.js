// Synthesised sound effects (Web Audio API) — no audio files required.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engine = null;
  }

  // Must be called from a user gesture (click / key press).
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    const comp = this.ctx.createDynamicsCompressor();
    // Lowpass filter that makes everything sound muffled underwater.
    this.muffle = this.ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.master.connect(this.muffle);
    this.muffle.connect(comp);
    comp.connect(this.ctx.destination);
    // Shared white-noise buffer.
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  setMuffled(on) {
    if (!this.ctx) return;
    this.muffle.frequency.setTargetAtTime(on ? 700 : 20000, this.ctx.currentTime, 0.12);
  }

  tone(freq, dur, { type = 'sine', vol = 0.2, delay = 0, slide = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, freq = 800, q = 1, type = 'lowpass', delay = 0, sweep = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  click() {
    this.tone(1400, 0.05, { type: 'triangle', vol: 0.08 });
  }
  hover() {
    this.tone(900, 0.03, { type: 'sine', vol: 0.03 });
  }
  coin(delay = 0) {
    this.tone(988, 0.08, { type: 'square', vol: 0.06, delay });
    this.tone(1319, 0.25, { type: 'square', vol: 0.06, delay: delay + 0.08 });
  }
  buy() {
    this.coin();
    this.tone(1760, 0.3, { type: 'triangle', vol: 0.08, delay: 0.2 });
  }
  error() {
    this.tone(180, 0.18, { type: 'sawtooth', vol: 0.08 });
    this.tone(140, 0.22, { type: 'sawtooth', vol: 0.08, delay: 0.1 });
  }
  beep(go = false) {
    this.tone(go ? 1046 : 523, go ? 0.6 : 0.22, { type: 'square', vol: 0.09 });
  }
  crash(intensity = 1) {
    const v = Math.min(0.6, 0.12 + intensity * 0.05);
    this.noise(0.35, { vol: v, freq: 500, type: 'lowpass' });
    this.tone(70, 0.25, { type: 'sine', vol: v * 0.8, slide: 0.5 });
  }
  whoosh() {
    this.noise(0.6, { vol: 0.25, freq: 300, q: 2, type: 'bandpass', sweep: 8 });
  }
  // A held note with a flat sustain (horns), softened by a lowpass filter.
  held(freq, dur, { type = 'sawtooth', vol = 0.1, delay = 0, slide = 0, cutoff = 2200, vibrato = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    if (vibrato) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = freq * vibrato;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + Math.max(0.03, dur - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Car horns from the Style shop. `vol` scales the loudness (rivals honk quieter).
  horn(kind = 'classic', vol = 1) {
    const v = 0.08 * vol;
    const chord = (notes, dur, opts = {}) => notes.forEach((n) => this.held(n, dur, { vol: v, ...opts }));
    switch (kind) {
      case 'truck':
        chord([155, 185, 233], 0.9, { cutoff: 1200, vibrato: 0.006 });
        break;
      case 'clown':
        for (const d of [0, 0.32]) this.held(560, 0.24, { type: 'square', vol: v * 0.8, delay: d, slide: 0.72, cutoff: 1800 });
        break;
      case 'duck':
        for (const d of [0, 0.26]) {
          this.held(820, 0.16, { type: 'sawtooth', vol: v, delay: d, slide: 0.55, cutoff: 1400 });
          this.held(1240, 0.12, { type: 'square', vol: v * 0.4, delay: d, slide: 0.6, cutoff: 2600 });
        }
        break;
      case 'airhorn':
        for (const d of [0, 0.5]) chord([440, 554, 659], 0.42, { delay: d, cutoff: 3200 });
        break;
      case 'train':
        for (const d of [0, 0.55]) chord([587, 740, 880], 0.45, { type: 'triangle', delay: d, cutoff: 3000, vibrato: 0.004 });
        this.noise(0.25, { vol: 0.12 * vol, freq: 900, type: 'bandpass', q: 1.5 });
        this.noise(0.25, { vol: 0.12 * vol, freq: 900, type: 'bandpass', q: 1.5, delay: 0.3 });
        break;
      case 'tune': {
        // La Cucaracha: G G G C E, G G G C E.
        const notes = [392, 392, 392, 523, 659, 0, 392, 392, 392, 523, 659];
        notes.forEach((n, i) => n && this.held(n, 0.13, { type: 'square', vol: v * 0.8, delay: i * 0.15, cutoff: 2600 }));
        break;
      }
      default:
        chord([415, 523], 0.38, { type: 'square', cutoff: 1600 });
    }
  }

  // Steady hiss of rain while racing in the rain.
  startRain() {
    if (!this.ctx || this.rainLoop) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1100;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.06, c.currentTime, 0.6);
    src.connect(hp).connect(lp).connect(g).connect(this.master);
    src.start();
    this.rainLoop = { src, g };
  }

  stopRain() {
    const r = this.rainLoop;
    if (!r) return;
    this.rainLoop = null;
    r.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    setTimeout(() => r.src.stop(), 900);
  }

  thunder(delay = 1.5) {
    this.noise(1.9, { vol: 0.55, freq: 150, type: 'lowpass', delay, sweep: 0.5 });
    this.noise(0.5, { vol: 0.25, freq: 900, type: 'lowpass', delay });
  }

  // Nitro kicks in: a deep FWOOMP.
  nitroIgnite() {
    this.noise(0.55, { vol: 0.45, freq: 260, q: 0.8, type: 'lowpass', sweep: 7 });
    this.tone(95, 0.3, { type: 'sine', vol: 0.22, slide: 0.45 });
  }

  // Two sharp pops as the nitro runs out (matching the orange backfire flames).
  backfire() {
    for (const d of [0.1, 0.32]) {
      this.noise(0.09, { vol: 0.5, freq: 1300, q: 1.2, type: 'bandpass', delay: d });
      this.tone(130, 0.08, { type: 'square', vol: 0.12, delay: d, slide: 0.6 });
    }
  }

  // Diving into (or bursting out of) the water.
  splash(enter = true) {
    this.noise(0.8, { vol: 0.4, freq: 2600, q: 0.7, type: 'bandpass', sweep: 0.2 });
    this.tone(enter ? 520 : 260, 0.3, { type: 'sine', vol: 0.12, slide: enter ? 0.45 : 2.4 });
  }
  pop() {
    this.tone(900, 0.09, { type: 'sine', vol: 0.12, slide: 2.2 });
  }
  fanfare(win) {
    const notes = win ? [523, 659, 784, 1046] : [392, 440, 523];
    notes.forEach((n, i) => this.tone(n, 0.35, { type: 'triangle', vol: 0.1, delay: i * 0.14 }));
  }

  startEngine() {
    if (!this.ctx || this.engine) return;
    const c = this.ctx;
    const out = c.createGain();
    out.gain.value = 0;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 3;
    const o1 = c.createOscillator();
    o1.type = 'sawtooth';
    const o2 = c.createOscillator();
    o2.type = 'square';
    const o3 = c.createOscillator();
    o3.type = 'sawtooth';
    const g2 = c.createGain();
    g2.gain.value = 0.5;
    const g3 = c.createGain();
    g3.gain.value = 0.25;
    o1.connect(filter);
    o2.connect(g2).connect(filter);
    o3.connect(g3).connect(filter);
    filter.connect(out);
    out.connect(this.master);
    // Tyre squeal.
    const sq = c.createBufferSource();
    sq.buffer = this.noiseBuf;
    sq.loop = true;
    const sqf = c.createBiquadFilter();
    sqf.type = 'bandpass';
    sqf.frequency.value = 1500;
    sqf.Q.value = 6;
    const sqg = c.createGain();
    sqg.gain.value = 0;
    sq.connect(sqf).connect(sqg).connect(this.master);
    // Wind / boost hiss.
    const wn = c.createBufferSource();
    wn.buffer = this.noiseBuf;
    wn.loop = true;
    const wnf = c.createBiquadFilter();
    wnf.type = 'bandpass';
    wnf.frequency.value = 900;
    wnf.Q.value = 0.7;
    const wng = c.createGain();
    wng.gain.value = 0;
    wn.connect(wnf).connect(wng).connect(this.master);
    [o1, o2, o3, sq, wn].forEach((n) => n.start());
    this.engine = { out, filter, o1, o2, o3, sqg, sqf, wng, wnf, rpm: 0.2, nodes: [o1, o2, o3, sq, wn] };
  }

  // ratio: speed / maxSpeed, throttle 0..1, slip 0..1, boost bool.
  updateEngine(ratio, throttle, slip, boost, offroad) {
    const e = this.engine;
    if (!e) return;
    const gears = [0, 0.16, 0.32, 0.5, 0.68, 0.86, 1.4];
    const r = Math.max(0, Math.abs(ratio));
    let gi = 0;
    while (gi < gears.length - 2 && r > gears[gi + 1]) gi++;
    const t = (r - gears[gi]) / (gears[gi + 1] - gears[gi]);
    let target = 0.22 + 0.78 * Math.min(1, t);
    if (gi === 0) target = 0.2 + 0.8 * Math.min(1, t) * (0.6 + 0.4 * throttle);
    if (throttle && r < 0.02) target = 0.45; // revving at standstill
    e.rpm += (target - e.rpm) * 0.18;
    const f = 42 + e.rpm * 150;
    const now = this.ctx.currentTime;
    e.o1.frequency.setTargetAtTime(f, now, 0.02);
    e.o2.frequency.setTargetAtTime(f * 0.5, now, 0.02);
    e.o3.frequency.setTargetAtTime(f * 2.02, now, 0.02);
    e.filter.frequency.setTargetAtTime(350 + e.rpm * (throttle ? 2600 : 1200), now, 0.04);
    e.out.gain.setTargetAtTime(0.07 + throttle * 0.07 + e.rpm * 0.05, now, 0.05);
    e.sqg.gain.setTargetAtTime(offroad ? 0 : Math.min(0.14, slip * 0.16), now, 0.05);
    e.sqf.frequency.setTargetAtTime(1300 + slip * 500, now, 0.05);
    e.wng.gain.setTargetAtTime((boost ? 0.12 : 0) + r * 0.03 + (offroad ? r * 0.12 : 0), now, 0.08);
    e.wnf.frequency.setTargetAtTime(offroad ? 300 : boost ? 1800 : 900, now, 0.1);
  }

  stopEngine() {
    const e = this.engine;
    if (!e) return;
    this.engine = null;
    const now = this.ctx.currentTime;
    e.out.gain.setTargetAtTime(0, now, 0.1);
    e.sqg.gain.setTargetAtTime(0, now, 0.05);
    e.wng.gain.setTargetAtTime(0, now, 0.1);
    setTimeout(() => e.nodes.forEach((n) => n.stop()), 600);
  }
}

export const audio = new AudioEngine();
