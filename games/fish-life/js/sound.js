'use strict';
/* =====================================================================
   FISH LIFE  -  sound.js
   Chiptune sound effects and music, synthesised live with WebAudio.
   Pulse / triangle / noise channels, just like an old game console.
   ===================================================================== */

const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteFreq(tok) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(tok);
  if (!m) return null;
  const midi = 12 * (parseInt(m[3], 10) + 1) + NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Song format: space separated steps, '|' is ignored (bar lines),
// '-' holds the previous note, '.' is a rest, drums use k/s/h.
const SONGS = {
  title: {
    bpm: 84, div: 2,
    ch: [
      { wave: 'triangle', vol: 0.11, notes: 'A3 E4 G4 C5 G4 E4 C4 E4 | F3 C4 E4 A4 E4 C4 A3 C4 | C4 G4 B4 E5 B4 G4 E4 G4 | G3 D4 E4 B4 E4 D4 B3 D4' },
      { wave: 'triangle', vol: 0.2, notes: 'A2 - - - - - E2 - | F2 - - - - - C3 - | C2 - - - - - G2 - | G2 - - - D2 - B1 -' },
      { wave: 'p25', vol: 0.05, notes: 'E5 - - - D5 - C5 - | C5 - - - A4 - - - | G4 - - - C5 - E5 - | D5 - - - - - - - | E5 - - - G5 - E5 - | F5 - E5 - C5 - - - | E5 - D5 - C5 - G4 - | B4 - - - - - . .' },
    ],
  },
  sea: {
    bpm: 132, div: 2,
    ch: [
      { wave: 'triangle', vol: 0.2, notes: 'E2 E3 E2 E3 E2 E3 E2 E3 | C2 C3 C2 C3 C2 C3 C2 C3 | G1 G2 G1 G2 G1 G2 G1 G2 | D2 D3 D2 D3 D2 D3 F#2 A2' },
      { wave: 'p25', vol: 0.055, notes: 'B4 - E5 - G5 - F#5 E5 | E5 - D5 - C5 - B4 - | D5 - G4 - B4 - D5 - | F#5 - - - A5 - F#5 - | G5 - F#5 - E5 - B4 - | C5 - E5 - G5 - E5 - | D5 - B4 - G4 - B4 - | A4 - - - F#4 - - -' },
      { wave: 'p12', vol: 0.03, notes: '. E4 . E4 . E4 . E4 | . E4 . E4 . E4 . E4 | . D4 . D4 . D4 . D4 | . F#4 . F#4 . F#4 . F#4' },
      { drums: true, vol: 0.5, notes: 'k . h . s . h . | k . h k s . h . | k . h . s . h . | k . h k s . s s' },
    ],
  },
  danger: {
    bpm: 150, div: 2,
    ch: [
      { wave: 'p50', vol: 0.08, notes: 'E2 . E2 . E2 F2 E2 . | E2 . E2 . E2 F2 G2 F2' },
      { wave: 'p12', vol: 0.035, notes: 'B5 - - - C6 - - - | B5 - - - A#5 - - -' },
      { drums: true, vol: 0.5, notes: 'k . h . k . h . | k . h . k k s .' },
    ],
  },
  shop: {
    bpm: 112, div: 2,
    ch: [
      { wave: 'triangle', vol: 0.18, notes: 'C2 . G2 . C3 . G2 . | A1 . E2 . A2 . E2 . | F1 . C2 . F2 . C2 . | G1 . D2 . G2 . B1 .' },
      { wave: 'p25', vol: 0.05, notes: 'E5 . G5 . E5 D5 C5 . | A4 . C5 . E5 . D5 . | C5 . A4 . F4 . A4 C5 | B4 . D5 . G5 - - . | E5 . G5 . C6 . G5 . | A5 . G5 . E5 . C5 . | F5 . E5 . D5 . C5 . | D5 - - - B4 - . .' },
      { drums: true, vol: 0.35, notes: 'k . h . s . h . | k . h . s . h h' },
    ],
  },
  bowl: {
    bpm: 100, div: 2,
    ch: [
      { wave: 'triangle', vol: 0.17, notes: 'F2 . C3 . F2 . C3 . | D2 . A2 . D2 . A2 . | A#1 . F2 . A#1 . F2 . | C2 . G2 . C2 . G2 .' },
      { wave: 'p12', vol: 0.03, notes: 'F4 A4 C5 A4 F4 A4 C5 A4 | D4 F4 A4 F4 D4 F4 A4 F4 | A#3 D4 F4 D4 A#3 D4 F4 D4 | C4 E4 G4 E4 C4 E4 G4 E4' },
      { wave: 'p25', vol: 0.05, notes: 'C5 - A4 - F4 - A4 - | D5 - - - A4 - - - | A#4 - D5 - F5 - D5 - | C5 - - - E5 - G5 - | A5 - G5 - F5 - C5 - | D5 - F5 - A5 - - - | G5 - F5 - D5 - A#4 - | C5 - - - - - . .' },
      { drums: true, vol: 0.25, notes: '. . h . . . h . | . . h . . . h h' },
    ],
  },
  night: {
    bpm: 70, div: 2,
    ch: [
      { wave: 'triangle', vol: 0.12, notes: 'F4 A4 C5 A4 F4 A4 C5 A4 | E4 G4 C5 G4 E4 G4 C5 G4' },
      { wave: 'triangle', vol: 0.14, notes: 'F2 - - - - - - - | C2 - - - - - - -' },
    ],
  },
  ending: {
    bpm: 112, div: 2,
    ch: [
      { wave: 'triangle', vol: 0.2, notes: 'C2 . C3 . C2 . C3 . | F1 . F2 . F1 . F2 . | G1 . G2 . G1 . G2 . | C2 . C3 . G1 . C2 .' },
      { wave: 'p25', vol: 0.06, notes: 'G4 - C5 - E5 - G5 - | A5 - - - F5 - A5 - | G5 - - - D5 - B4 - | C5 - - - C5 - . . | E5 - E5 - F5 - G5 - | A5 - C6 - A5 - F5 - | G5 - F5 - E5 - D5 - | C5 - - - - - - .' },
      { wave: 'p12', vol: 0.03, notes: 'E4 - G4 - E4 - G4 - | F4 - A4 - F4 - A4 - | D4 - G4 - D4 - B3 - | E4 - G4 - E4 - . .' },
      { drums: true, vol: 0.45, notes: 'k . s . k k s . | k . s . k k s s' },
    ],
  },
};

function parseSong(song) {
  return {
    bpm: song.bpm,
    div: song.div,
    ch: song.ch.map(c => {
      const toks = c.notes.split(/\s+/).filter(t => t && t !== '|');
      const steps = toks.map((t, i) => {
        if (c.drums) return { drum: t === '.' ? null : t };
        const f = noteFreq(t);
        if (!f) return { f: null };
        let len = 1;
        while (toks[(i + len) % toks.length] === '-' && len < toks.length) len++;
        return { f, len };
      });
      return Object.assign({}, c, { steps });
    }),
  };
}

const Sound = {
  ac: null,
  master: null,
  sfxBus: null,
  musBus: null,
  muted: false,
  song: null,
  songName: null,
  step: 0,
  nextT: 0,
  waves: {},
  toastT: 0,
  lastUpdate: 0,

  unlock() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ac = new AC(); } catch (e) { return; }
      const ac = this.ac;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      comp.connect(ac.destination);
      this.master = ac.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(comp);
      this.sfxBus = ac.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.master);
      this.musBus = ac.createGain();
      this.musBus.gain.value = 0.5;
      this.musBus.connect(this.master);
      const len = ac.sampleRate * 2;
      this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      for (const [name, duty] of [['p50', 0.5], ['p25', 0.25], ['p12', 0.125]]) {
        const n = 48, re = new Float32Array(n), im = new Float32Array(n);
        for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
        this.waves[name] = ac.createPeriodicWave(re, im);
      }
      if (this.pendingSong) { const s = this.pendingSong; this.pendingSong = null; this.play(s); }
    }
    if (this.ac.state === 'suspended') this.ac.resume();
  },
  get ready() { return !!this.ac && this.ac.state === 'running'; },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ac.currentTime, 0.02);
    Save.setOptions(Object.assign(Save.options(), { muted: m }));
  },
  toggleMute() {
    this.setMuted(!this.muted);
    this.toastT = 1.4;
  },

  osc(wave) {
    const o = this.ac.createOscillator();
    if (this.waves[wave]) o.setPeriodicWave(this.waves[wave]);
    else o.type = wave;
    return o;
  },
  // One-shot tone. slide = frequency multiplier reached at the end.
  tone(f, dur, opt = {}) {
    if (!this.ac) return;
    const ac = this.ac, t = ac.currentTime + (opt.delay || 0) + 0.005;
    const o = this.osc(opt.type || 'p50'), g = ac.createGain();
    o.frequency.setValueAtTime(f, t);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * opt.slide), t + dur);
    if (opt.vib) {
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = opt.vib;
      lg.gain.value = f * 0.03;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    const v = opt.vol ?? 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (opt.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(opt.bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur, opt = {}) {
    if (!this.ac) return;
    const ac = this.ac, t = ac.currentTime + (opt.delay || 0) + 0.005;
    const src = ac.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = ac.createBiquadFilter();
    flt.type = opt.filter || 'bandpass';
    flt.frequency.setValueAtTime(opt.freq || 1000, t);
    if (opt.slide) flt.frequency.exponentialRampToValueAtTime(Math.max(20, (opt.freq || 1000) * opt.slide), t + dur);
    flt.Q.value = opt.q || 1;
    const g = ac.createGain(), v = opt.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (opt.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(opt.bus || this.sfxBus);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.03);
  },
  talk(f, type) {
    if (!this.ac) return;
    this.tone(f * (0.9 + Math.random() * 0.25), 0.045, { type: type === 'triangle' ? 'triangle' : 'p25', vol: 0.07 });
  },

  sfx(name) {
    if (!this.ac) return;
    const T = (f, d, o) => this.tone(f, d, o), N = (d, o) => this.noise(d, o);
    switch (name) {
      case 'eat': T(480 + Math.random() * 120, 0.08, { type: 'p25', vol: 0.12, slide: 2.2 }); break;
      case 'eatbig': T(300, 0.08, { type: 'p25', vol: 0.13, slide: 1.8 }); T(620, 0.12, { type: 'p25', vol: 0.12, slide: 1.6, delay: 0.07 }); break;
      case 'toobig': T(260, 0.1, { type: 'p50', vol: 0.08, slide: 0.8 }); break;
      case 'hurt': T(240, 0.3, { type: 'sawtooth', vol: 0.12, slide: 0.3 }); N(0.2, { vol: 0.2, freq: 900 }); break;
      case 'chomp': N(0.12, { vol: 0.3, freq: 400 }); T(140, 0.14, { type: 'p50', vol: 0.12, slide: 0.5 }); break;
      case 'grow': [523, 659, 784, 1047, 1319].forEach((f, i) => T(f, 0.14, { type: 'p25', vol: 0.11, delay: i * 0.07 })); break;
      case 'dash': N(0.2, { vol: 0.14, freq: 500, slide: 5, q: 2 }); break;
      case 'move': T(660, 0.04, { type: 'p25', vol: 0.07 }); break;
      case 'ok': T(880, 0.06, { type: 'p25', vol: 0.09 }); T(1320, 0.09, { type: 'p25', vol: 0.09, delay: 0.05 }); break;
      case 'back': T(520, 0.09, { type: 'p25', vol: 0.08, slide: 0.6 }); break;
      case 'no': T(150, 0.18, { type: 'p50', vol: 0.09 }); break;
      case 'splash': N(0.45, { vol: 0.28, freq: 2200, slide: 0.15, filter: 'lowpass' }); break;
      case 'plop': T(300, 0.12, { type: 'sine', vol: 0.18, slide: 3 }); N(0.12, { vol: 0.08, freq: 1500 }); break;
      case 'bubble': T(500 + Math.random() * 400, 0.06, { type: 'sine', vol: 0.07, slide: 2.4 }); break;
      case 'idea': [1047, 1319, 1568, 2093].forEach((f, i) => T(f, 0.1, { type: 'triangle', vol: 0.1, delay: i * 0.045 })); break;
      case 'gold': [1047, 1319, 1568, 2093, 2637].forEach((f, i) => T(f, 0.16, { type: 'p25', vol: 0.08, delay: i * 0.06 })); break;
      case 'buy': T(988, 0.08, { type: 'p25', vol: 0.11 }); T(1319, 0.35, { type: 'p25', vol: 0.11, delay: 0.08 }); break;
      case 'upgrade': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => T(f, 0.12, { type: 'p25', vol: 0.09, delay: i * 0.06 })); break;
      case 'meow': T(520, 0.4, { type: 'sawtooth', vol: 0.05, slide: 1.5, vib: 7 }); break;
      case 'hiss': N(0.55, { vol: 0.14, freq: 5000, filter: 'highpass' }); break;
      case 'zap': for (let i = 0; i < 6; i++) T(i % 2 ? 900 : 1500, 0.04, { type: 'p50', vol: 0.06, delay: i * 0.035 }); break;
      case 'pinch': T(900, 0.05, { type: 'p50', vol: 0.08 }); T(700, 0.06, { type: 'p50', vol: 0.08, delay: 0.06 }); break;
      case 'rumble': N(2.6, { vol: 0.35, freq: 140, filter: 'lowpass', attack: 0.4 }); T(55, 2.6, { type: 'sine', vol: 0.18, attack: 0.4 }); break;
      case 'sting': T(110, 0.8, { type: 'sawtooth', vol: 0.1 }); T(116.5, 0.8, { type: 'sawtooth', vol: 0.1 }); break;
      case 'caught': [392, 370, 349, 330, 311].forEach((f, i) => T(f, 0.25, { type: 'p50', vol: 0.09, delay: i * 0.16 })); break;
      case 'shake': for (let i = 0; i < 3; i++) N(0.07, { vol: 0.12, freq: 3500, delay: i * 0.09 }); break;
      case 'tick': T(1800, 0.02, { type: 'p50', vol: 0.04 }); break;
      case 'gull': T(1500, 0.18, { type: 'sawtooth', vol: 0.04, slide: 0.7, vib: 18 }); T(1400, 0.2, { type: 'sawtooth', vol: 0.04, slide: 0.7, vib: 18, delay: 0.2 }); break;
      case 'shark': T(82, 0.5, { type: 'sawtooth', vol: 0.12 }); T(87, 0.5, { type: 'sawtooth', vol: 0.12, delay: 0.55 }); break;
      case 'chapter': [392, 523, 659, 784].forEach((f, i) => T(f, 0.3, { type: 'triangle', vol: 0.15, delay: i * 0.1 })); break;
      case 'thunder': N(1.6, { vol: 0.4, freq: 300, filter: 'lowpass', slide: 0.3 }); break;
      case 'knock': T(160, 0.06, { type: 'sine', vol: 0.25 }); T(160, 0.06, { type: 'sine', vol: 0.25, delay: 0.18 }); break;
      case 'stomp': N(0.3, { vol: 0.4, freq: 120, filter: 'lowpass' }); T(60, 0.3, { type: 'sine', vol: 0.3, slide: 0.5 }); break;
      case 'cheer': for (let i = 0; i < 10; i++) T(600 + Math.random() * 900, 0.15, { type: 'p25', vol: 0.03, delay: Math.random() * 0.6 }); N(0.8, { vol: 0.08, freq: 2500 }); break;
      case 'fanfare': [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => T(f, i === 7 ? 0.6 : 0.14, { type: 'p25', vol: 0.1, delay: [0, 0.12, 0.24, 0.36, 0.6, 0.84, 0.96, 1.2][i] })); break;
      case 'type': T(1200 + Math.random() * 300, 0.02, { type: 'p50', vol: 0.03 }); break;
      case 'snore': T(90, 0.8, { type: 'triangle', vol: 0.1, slide: 1.3, attack: 0.3 }); break;
      default: break;
    }
  },

  // ---------------------------------------------------------- music
  play(name) {
    if (name === this.songName) return;
    if (!this.ac) { this.pendingSong = name; this.songName = null; return; }
    this.songName = name;
    this.song = name ? parseSong(SONGS[name]) : null;
    this.step = 0;
    this.nextT = this.ac.currentTime + 0.08;
  },
  voice(ch, f, t, dur) {
    const ac = this.ac;
    const o = this.osc(ch.wave), g = ac.createGain(), v = ch.vol;
    o.frequency.setValueAtTime(f, t);
    const end = t + dur * 0.92;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.008);
    if (dur > 0.2) {
      g.gain.linearRampToValueAtTime(v * 0.6, t + 0.09);
      g.gain.setValueAtTime(v * 0.6, end - 0.04);
    }
    g.gain.linearRampToValueAtTime(0.0001, end);
    o.connect(g); g.connect(this.musBus);
    o.start(t); o.stop(end + 0.02);
  },
  drum(kind, t, vol) {
    const ac = this.ac;
    if (kind === 'k') {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.6 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g); g.connect(this.musBus);
      o.start(t); o.stop(t + 0.16);
    } else {
      const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = this.noiseBuf;
      flt.type = kind === 'h' ? 'highpass' : 'bandpass';
      flt.frequency.value = kind === 'h' ? 7000 : 1800;
      const d = kind === 'h' ? 0.035 : 0.12;
      g.gain.setValueAtTime((kind === 'h' ? 0.12 : 0.3) * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(flt); flt.connect(g); g.connect(this.musBus);
      src.start(t, Math.random() * 1.5); src.stop(t + d + 0.02);
    }
  },
  update(dt = 1 / 60) {
    if (this.toastT > 0) this.toastT -= dt;
    if (!this.ac || !this.song || this.ac.state !== 'running') return;
    const s = this.song, stepDur = 60 / s.bpm / s.div;
    const now = this.ac.currentTime;
    if (this.nextT < now - 0.2) this.nextT = now + 0.05;
    while (this.nextT < now + 0.15) {
      for (const ch of s.ch) {
        const st = ch.steps[this.step % ch.steps.length];
        if (ch.drums) { if (st.drum) this.drum(st.drum, this.nextT, ch.vol); } else if (st.f) this.voice(ch, st.f, this.nextT, st.len * stepDur);
      }
      this.nextT += stepDur;
      this.step++;
    }
  },
};
Sound.muted = !!Save.options().muted;
