// Sounds made from code (no audio files): engine, tire screech, gunshot.
// Browsers only allow sound after the player clicks, so call start() then.

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(ctx.destination);

    // Engine: two buzzy tones through a muffling filter.
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 600;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.25;
    this.engineFilter.connect(this.engineGain).connect(this.master);
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';
    const g2 = ctx.createGain();
    g2.gain.value = 0.5;
    this.osc1.connect(this.engineFilter);
    this.osc2.connect(g2).connect(this.engineFilter);
    this.osc1.start();
    this.osc2.start();

    // Shared noise source (screech and gunshots).
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    // Tire screech: looping noise through a narrow filter.
    const screech = ctx.createBufferSource();
    screech.buffer = buf;
    screech.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 6;
    this.screechGain = ctx.createGain();
    this.screechGain.gain.value = 0;
    screech.connect(bp).connect(this.screechGain).connect(this.master);
    screech.start();
    this.screechFilter = bp;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  // speedRatio 0..1, throttle -1..1, drift 0..1
  update(speedRatio, throttle, drift) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rev = 0.15 + speedRatio * 0.85 + (throttle !== 0 ? 0.12 : 0);
    // Fake gear shifts: pitch climbs, drops a bit, climbs again.
    const gear = Math.min(Math.floor(speedRatio * 4), 3);
    const inGear = speedRatio * 4 - gear;
    const f = 38 + gear * 10 + inGear * 45 + rev * 20;
    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(350 + rev * 900, t, 0.05);
    this.engineGain.gain.setTargetAtTime(0.18 + (throttle !== 0 ? 0.12 : 0), t, 0.1);
    this.screechGain.gain.setTargetAtTime(drift * 0.22, t, 0.05);
    this.screechFilter.frequency.setTargetAtTime(1500 + drift * 800, t, 0.1);
  }

  // A short burst of filtered noise with a quick fade (most effects use this).
  #burst({ freq = 1000, type = 'lowpass', q = 1, endFreq, gain = 0.5, length = 0.15, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, length + 0.05);
  }

  // A low "thud" tone.
  #thud(freq, length, gain, delay = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.4, t + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + length + 0.05);
  }

  // Demon goes SPLAT: wet crunch + thump. size 0..1
  splat(size = 1) {
    this.#thud(90 + Math.random() * 40, 0.25, 0.7 * size);
    this.#burst({ freq: 900 + Math.random() * 600, type: 'bandpass', q: 0.8, endFreq: 150, gain: 0.8 * size, length: 0.22 });
    this.#burst({ freq: 3000, type: 'highpass', gain: 0.25 * size, length: 0.06, delay: 0.02 }); // crunch
  }

  thump() { this.#thud(120, 0.15, 0.5); this.#burst({ freq: 600, gain: 0.3, length: 0.08 }); }
  hit() { this.#burst({ freq: 1800, type: 'bandpass', q: 2, gain: 0.25, length: 0.05 }); }
  claw() { this.#burst({ freq: 4200, type: 'bandpass', q: 4, endFreq: 2000, gain: 0.25, length: 0.12 }); }
  wreck() {
    this.#thud(60, 0.9, 1.0);
    this.#burst({ freq: 1200, endFreq: 80, gain: 1.0, length: 0.9 });
  }

  // Big gun: a deep boom.
  cannon() {
    this.#thud(70, 0.35, 0.9);
    this.#burst({ freq: 1400, endFreq: 120, gain: 0.7, length: 0.3 });
  }

  // Souls arriving: a soft high chime.
  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(900 + Math.random() * 300, t);
    o.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  }

  gunshot() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, 0.2);
  }
}
