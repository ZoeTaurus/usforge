'use strict';
// ============================================================
//  Audio: everything is synthesized with WebAudio (no files)
// ============================================================

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const MEL_COZY = [79, 0, 0, 76, 0, 0, 74, 0, 72, 0, 0, 0, 76, 0, 0, 0, 77, 0, 76, 0, 72, 0, 0, 0, 74, 0, 0, 71, 0, 0, 74, 0];
const MEL_COZY2 = [72, 0, 74, 0, 76, 0, 0, 79, 0, 0, 76, 0, 0, 0, 0, 0, 72, 0, 0, 69, 0, 0, 72, 0, 71, 0, 0, 67, 0, 0, 0, 0];
const MEL_FIGHT = [69, 0, 72, 0, 76, 0, 74, 72, 69, 0, 0, 0, 65, 0, 67, 0, 67, 0, 71, 0, 74, 0, 72, 71, 68, 0, 71, 0, 76, 0, 0, 0];

function cozyPlay(S, i, t, sd, loop) {
  const ch = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]][i >> 3];
  const arp = [0, 1, 2, 1, 0, 2, 1, 2][i & 7];
  const bus = S.musBus;
  S.tone(mtof(ch[arp] + 12), sd * 1.6, 'triangle', 0.045, { at: t, bus, a: 0.01 });
  if ((i & 7) === 0) S.tone(mtof(ch[0] - 12), sd * 3.6, 'triangle', 0.1, { at: t, bus, a: 0.02 });
  if ((i & 7) === 4) S.tone(mtof(ch[2] - 12), sd * 3, 'triangle', 0.06, { at: t, bus, a: 0.02 });
  const mel = loop % 3 === 2 ? 0 : (loop % 3 === 0 ? MEL_COZY : MEL_COZY2)[i];
  if (mel) S.tone(mtof(mel), sd * 2.2, 'square', 0.022, { at: t, bus, a: 0.03 });
}
function fightPlay(S, i, t, sd) {
  const ch = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]][i >> 3];
  const bus = S.musBus;
  S.tone(mtof(ch[0] - 24 + (i & 1 ? 12 : 0)), sd * 0.9, 'square', 0.045, { at: t, bus });
  S.tone(mtof(ch[[0, 1, 2, 1][i & 3]] + 12), sd * 0.6, 'square', 0.016, { at: t, bus });
  if ((i & 3) === 0) S.tone(130, 0.14, 'sine', 0.22, { at: t, bus, to: 40 });
  if ((i & 3) === 2) S.noise(0.09, 0.07, 2500, { at: t, bus, type: 'highpass' });
  S.noise(0.025, 0.02, 7000, { at: t, bus, type: 'highpass' });
  const mel = MEL_FIGHT[i];
  if (mel) S.tone(mtof(mel), sd * 1.5, 'sawtooth', 0.018, { at: t, bus, a: 0.01 });
}
const TRACKS = {
  cozy: { bpm: 88, len: 32, play: cozyPlay },
  fight: { bpm: 150, len: 32, play: fightPlay },
  final: { bpm: 168, len: 32, play: fightPlay },
};

const Sound = {
  ctx: null, master: null, sfxBus: null, musBus: null, ambBus: null, muted: false, noiseBuf: null,
  track: null, trackName: null, step: 0, nextTime: 0, loop: 0, amb: null, ambKind: null,
  wantTrack: null, wantAmb: null,

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
      this.musBus = c.createGain(); this.musBus.gain.value = 0.55; this.musBus.connect(this.master);
      this.ambBus = c.createGain(); this.ambBus.gain.value = 0.8; this.ambBus.connect(this.master);
      const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
      setInterval(() => this.schedule(), 40);
      if (this.wantTrack) this.music(this.wantTrack);
      if (this.wantAmb) this.ambience(this.wantAmb);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    Toasts.add(this.muted ? 'SOUND OFF' : 'SOUND ON', '#ffffff', 1.2, 150);
  },
  tone(f, d, type = 'square', v = 0.1, o = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = o.at !== undefined ? o.at : c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + d);
    const a = o.a || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(o.bus || this.sfxBus);
    osc.start(t); osc.stop(t + d + 0.05);
  },
  noise(d, v = 0.2, f = 1000, o = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = o.at !== undefined ? o.at : c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf;
    fl.type = o.type || 'lowpass';
    fl.frequency.setValueAtTime(f, t);
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + d);
    fl.Q.value = o.q || 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(fl); fl.connect(g); g.connect(o.bus || this.sfxBus);
    src.start(t, Math.random() * 1.5); src.stop(t + d + 0.05);
  },
  arp(notes, gap, type = 'square', v = 0.06, d = 0.18) {
    notes.forEach((n, i) => this.tone(mtof(n), d, type, v, { delay: i * gap }));
  },
  play(n, arg = 0) {
    if (!this.ctx) return;
    const rp = 1 + arg * 0.12; // every rod has its own pitch
    switch (n) {
      case 'select': this.tone(660, 0.08, 'square', 0.05); this.tone(990, 0.1, 'square', 0.05, { delay: 0.05 }); break;
      case 'move': this.tone(520, 0.05, 'square', 0.035); break;
      case 'cast':
        this.noise(0.35, 0.12, 800 * rp, { to: 3000 * rp, type: 'bandpass', q: 2 });
        this.tone(300 * rp, 0.25, arg >= 3 ? 'square' : 'triangle', 0.05, { to: 600 * rp });
        if (arg >= 5) this.arp([84, 88, 91], 0.05, 'triangle', 0.03, 0.12);
        else if (arg >= 3) this.tone(1200 * rp, 0.15, 'sine', 0.03, { delay: 0.1, to: 1800 });
        break;
      case 'splash': this.noise(0.4, 0.22, 1500, { to: 300 }); this.tone(220, 0.15, 'sine', 0.08, { to: 80 }); break;
      case 'bigsplash': this.noise(1.0, 0.4, 2200, { to: 150 }); this.tone(120, 0.5, 'sine', 0.2, { to: 40 }); break;
      case 'plop': this.tone(520, 0.08, 'sine', 0.08, { to: 240 }); break;
      case 'bite': this.tone(880, 0.08, 'square', 0.07); this.tone(1320, 0.12, 'square', 0.06, { delay: 0.07 }); break;
      case 'hook': this.tone(300, 0.1, 'sawtooth', 0.08, { to: 900 }); this.noise(0.15, 0.1, 3000); break;
      case 'reel': this.tone(1400 + Math.random() * 200, 0.02, 'square', 0.02); break;
      case 'catch': this.arp([72, 76, 79, 84], 0.08); break;
      case 'rare': this.arp([72, 76, 79, 83, 84, 88], 0.07, 'square', 0.06); break;
      case 'snap': this.noise(0.2, 0.3, 4000, { type: 'highpass' }); this.tone(900, 0.2, 'sawtooth', 0.08, { to: 100 }); break;
      case 'coin': this.tone(988, 0.06, 'square', 0.05); this.tone(1319, 0.15, 'square', 0.05, { delay: 0.06 }); break;
      case 'hurt': this.tone(220, 0.25, 'sawtooth', 0.12, { to: 60 }); this.noise(0.2, 0.15, 800); break;
      case 'hit': this.tone(180, 0.08, 'square', 0.1, { to: 90 }); this.noise(0.1, 0.15, 2500); break;
      case 'throw':
        this.noise(0.12, 0.08, 2000 * rp, { to: 5000 * rp, type: 'bandpass' });
        this.tone(500 * rp, 0.08, arg >= 3 ? 'square' : 'triangle', 0.03, { to: 900 * rp });
        break;
      case 'thunder': this.noise(2.2, 0.35, 300, { to: 60, a: 0.05 }); this.tone(55, 1.6, 'sine', 0.2, { to: 30 }); break;
      case 'squawk': this.tone(900, 0.12, 'sawtooth', 0.05, { to: 600 }); this.tone(1000, 0.14, 'sawtooth', 0.05, { to: 650, delay: 0.14 }); break;
      case 'shoo': this.noise(0.15, 0.15, 3000, { type: 'bandpass' }); this.tone(1400, 0.2, 'square', 0.04, { to: 2000 }); break;
      case 'row': this.arp([72, 76, 79, 84, 88, 91, 96], 0.07, 'square', 0.06, 0.2); break;
      case 'quest': this.arp([67, 71, 74, 79], 0.1, 'triangle', 0.09, 0.3); break;
      case 'sell': [0, 1, 2, 3].forEach(i => { this.tone(988, 0.05, 'square', 0.04, { delay: i * 0.07 }); this.tone(1319, 0.08, 'square', 0.04, { delay: i * 0.07 + 0.04 }); }); break;
      case 'frenzy': this.arp([60, 67, 72, 79, 84], 0.06, 'square', 0.05, 0.15); this.noise(0.6, 0.15, 1500, { to: 400 }); break;
      case 'revive': this.arp([72, 79, 84], 0.08, 'triangle', 0.08, 0.3); break;
      case 'row2': this.noise(0.25, 0.08, 500, { to: 250 }); break;
      case 'bubble': this.tone(400 + Math.random() * 300, 0.1, 'sine', 0.08, { to: 1200 }); break;
      case 'dash': this.noise(0.2, 0.12, 600, { to: 2400, type: 'bandpass' }); break;
      case 'roar': this.tone(90, 0.9, 'sawtooth', 0.14, { to: 45 }); this.noise(0.9, 0.2, 400, { to: 100 }); break;
      case 'warn': this.tone(740, 0.1, 'square', 0.045); this.tone(740, 0.1, 'square', 0.045, { delay: 0.15 }); break;
      case 'slam': this.noise(0.5, 0.35, 600, { to: 80 }); this.tone(70, 0.4, 'sine', 0.25, { to: 30 }); break;
      case 'shoot': this.tone(500, 0.12, 'triangle', 0.05, { to: 200 }); break;
      case 'win': this.arp([67, 72, 76, 79, 84, 79, 84, 88], 0.1, 'square', 0.06, 0.25); break;
      case 'rod': this.arp([60, 64, 67, 72, 76, 79, 84], 0.09, 'triangle', 0.1, 0.4); this.arp([72, 76, 79, 84], 0.18, 'square', 0.04, 0.3); break;
      case 'lose': this.arp([67, 63, 60, 55], 0.22, 'triangle', 0.08, 0.35); break;
      case 'wake': this.tone(500, 0.12, 'triangle', 0.08, { to: 900 }); this.tone(900, 0.15, 'triangle', 0.06, { delay: 0.12 }); break;
      case 'yawn': this.tone(320, 0.6, 'triangle', 0.06, { to: 180, a: 0.15 }); break;
      case 'nope': this.tone(160, 0.15, 'square', 0.06); this.tone(120, 0.15, 'square', 0.06, { delay: 0.1 }); break;
      case 'meow': this.tone(700, 0.25, 'triangle', 0.05, { to: 500, a: 0.05 }); break;
      case 'yank': this.tone(200, 0.6, 'sawtooth', 0.1, { to: 60 }); this.noise(0.6, 0.2, 1200, { to: 200 }); break;
    }
  },
  music(name) {
    this.wantTrack = name;
    if (!this.ctx || this.trackName === name) return;
    this.trackName = name;
    this.track = TRACKS[name] || null;
    this.step = 0; this.loop = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
  },
  schedule() {
    if (!this.track || !this.ctx) return;
    const tr = this.track, sd = 60 / tr.bpm / 2;
    if (this.nextTime < this.ctx.currentTime - 0.5) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      tr.play(this, this.step, this.nextTime, sd, this.loop);
      this.step++;
      if (this.step >= tr.len) { this.step = 0; this.loop++; }
      this.nextTime += sd;
    }
  },
  ambience(kind) {
    this.wantAmb = kind;
    if (!this.ctx || this.ambKind === kind) return;
    this.ambKind = kind;
    const c = this.ctx;
    if (this.amb) {
      const a = this.amb;
      a.g.gain.setTargetAtTime(0, c.currentTime, 0.3);
      setTimeout(() => { try { a.src.stop(); a.lfo.stop(); } catch (e) { /* already stopped */ } }, 1500);
      this.amb = null;
    }
    if (!kind) return;
    const waves = kind === 'waves' || kind === 'rain';
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.loop = true;
    f.type = 'lowpass'; f.frequency.value = kind === 'rain' ? 2600 : waves ? 650 : 260;
    g.gain.value = 0;
    g.gain.setTargetAtTime(waves ? 0.08 : 0.12, c.currentTime, 0.8);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = waves ? 0.13 : 0.3;
    lg.gain.value = waves ? 0.06 : 0.03;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(this.ambBus);
    src.start(); lfo.start();
    this.amb = { src, g, lfo };
  },
};
