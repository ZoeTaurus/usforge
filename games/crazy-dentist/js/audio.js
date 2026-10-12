'use strict';
// ============================================================
//  CRAZY DENTIST — chiptune synth: music sequencer + SFX
//  Everything is generated with WebAudio, no sound files.
// ============================================================

const SND = (() => {
  let ac = null, master, mus, fx, noiseBuf;
  const waves = {};
  let song = null, songName = null, wanted = null, step = 0, nextT = 0, timer = null;
  const last = {};

  function pulse(d) {
    const n = 40, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * d) / (Math.PI * k);
      im[k] = (1 - Math.cos(2 * Math.PI * k * d)) / (Math.PI * k);
    }
    return ac.createPeriodicWave(re, im);
  }

  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }
    master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
    mus = ac.createGain(); mus.gain.value = settings.music ? 0.42 : 0; mus.connect(master);
    fx = ac.createGain(); fx.gain.value = settings.sfx ? 0.75 : 0; fx.connect(master);
    waves.p25 = pulse(0.25); waves.p12 = pulse(0.125); waves.p50 = pulse(0.5);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    timer = setInterval(sched, 25);
    return true;
  }

  function unlock() {
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume();
    if (wanted && wanted !== songName) start(wanted);
  }

  function tone(wave, f, t, dur, vol, dest, f2) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (waves[wave]) o.setPeriodicWave(waves[wave]); else o.type = wave;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(t, dur, vol, dest, freq, type = 'lowpass', f2) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = type; f.frequency.setValueAtTime(freq, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const NI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function nf(n) {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    if (!m) return 440;
    const midi = 12 * (+m[3] + 1) + NI[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---- song notation: one token per 16th step. NOTE, '-' hold, '.' rest
  function parse(str) {
    const toks = str.trim().split(/\s+/), at = {};
    let lastEv = null;
    toks.forEach((tk, i) => {
      if (tk === '-') { if (lastEv && lastEv.end === i) { lastEv.len++; lastEv.end++; } }
      else if (tk !== '.') { lastEv = { f: nf(tk), len: 1, end: i + 1 }; at[i] = lastEv; }
      else lastEv = null;
    });
    return { at, n: toks.length };
  }
  const rep = (s, n) => Array(n).fill(s).join(' ');
  const oct = (a, b) => rep(`${a} . ${b} .`, 4);
  const bossa = (r, f) => `${r} . . ${f} ${r} . . . ${r} . . ${f} ${r} . ${f} .`;

  const SONGS = {
    title: {
      bpm: 132,
      lead: `
        E5 - . G5 - . C6 - - . B5 . A5 - G5 -
        A5 - . F5 - . A5 - - . G5 . F5 - E5 -
        D5 - . F5 - . B5 - - . A5 . G5 - F5 -
        E5 - G5 - C6 - - - - - - . . . . .
        E5 - . G5 - . C6 - - . D6 . E6 - D6 -
        C6 - . A5 - . F5 - - . A5 . C6 - A5 -
        G5 - . E5 - . G5 - B5 - D6 - B5 - G5 -
        C6 - - - G5 - E5 - C5 - - - . . . .`,
      bass: [oct('C3', 'C4'), oct('F2', 'F3'), oct('G2', 'G3'), 'C3 . C4 . C3 . C4 . E3 . E4 . G3 . G4 .',
        oct('C3', 'C4'), 'F2 . F3 . F2 . F3 . A2 . A3 . F2 . F3 .', 'G2 . G3 . G2 . G3 . B2 . B3 . G2 . G3 .', 'C3 . G3 . C4 . G3 . C3 . . . C3 . . .'].join(' '),
      arp: [rep('C5 E5 G5 E5', 4), rep('C5 F5 A5 F5', 4), rep('D5 G5 B5 G5', 4), rep('C5 E5 G5 E5', 4),
        rep('C5 E5 G5 E5', 4), rep('C5 F5 A5 F5', 4), rep('D5 G5 B5 G5', 4), rep('E5 G5 C6 G5', 4)].join(' '),
      kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    },
    clinic: {
      bpm: 112,
      lead: `
        A5 - - . G5 . F5 - - . C5 - - - . .
        D5 - - . E5 . F5 - - . A5 - - - . .
        G5 - - . F5 . E5 - - . C5 - - - . .
        E5 - F5 - G5 - A5 - G5 - - - . . . .
        A5 - - . C6 . A5 - - . F5 - - - . .
        A#5 - - . A5 . G5 - - . D5 - - - . .
        G5 - - . A5 . A#5 - - . G5 - E5 - . .
        F5 - - - - - - - . . . . . . . .`,
      bass: [bossa('F2', 'C3'), bossa('D2', 'A2'), bossa('C2', 'G2'), bossa('C2', 'G2'),
        bossa('F2', 'C3'), bossa('A#1', 'F2'), bossa('C2', 'G2'), bossa('F2', 'C3')].join(' '),
      arp: [rep('. A4 C5 .', 4), rep('. A4 D5 .', 4), rep('. G4 C5 .', 4), rep('. G4 A#4 .', 4),
        rep('. A4 C5 .', 4), rep('. A#4 D5 .', 4), rep('. G4 C5 .', 4), rep('. A4 C5 .', 4)].join(' '),
      kick: 'x.....x.x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    },
    treat: {
      bpm: 146,
      lead: `
        A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .
        F4 . A4 . C5 . F5 . E5 . C5 . A4 . C5 .
        G4 . B4 . D5 . G5 . F5 . D5 . B4 . D5 .
        E4 . G#4 . B4 . E5 . G#5 - - . B5 - - .`,
      bass: [oct('A2', 'A3'), oct('F2', 'F3'), oct('G2', 'G3'), oct('E2', 'E3')].join(' '),
      arp: '',
      kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
    },
  };
  for (const k in SONGS) {
    const s = SONGS[k];
    s.L = parse(s.lead); s.B = parse(s.bass); s.A = s.arp ? parse(s.arp) : null;
    s.len = s.L.n;
  }

  function start(name) {
    song = SONGS[name]; songName = name; step = 0;
    nextT = ac.currentTime + 0.06;
  }
  function playSong(name) {
    wanted = name;
    if (!ac || songName === name) return;
    start(name);
  }
  function stopMusic() { song = null; songName = null; wanted = null; }

  function sched() {
    if (!ac || !song || ac.state !== 'running') return;
    const spb = 60 / song.bpm / 4;
    if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.02;
    while (nextT < ac.currentTime + 0.12) {
      const s = step % song.len, t = nextT;
      let e = song.L.at[s]; if (e) tone('p25', e.f, t, e.len * spb * 0.95, 0.12, mus);
      e = song.B.at[s]; if (e) tone('triangle', e.f, t, e.len * spb * 0.9, 0.32, mus);
      if (song.A) { e = song.A.at[s]; if (e) tone('p12', e.f, t, spb * 0.8, 0.045, mus); }
      const b = s % 16;
      if (song.kick[b] === 'x') tone('sine', 150, t, 0.13, 0.7, mus, 40);
      if (song.snare[b] === 'x') { noise(t, 0.1, 0.28, mus, 1500, 'highpass'); tone('triangle', 190, t, 0.05, 0.15, mus, 120); }
      if (song.hat[b] === 'x') noise(t, 0.03, 0.09, mus, 7000, 'highpass');
      nextT += spb; step++;
    }
  }

  function jingle(notes, dur, wave = 'p25', vol = 0.14) {
    const t0 = ac.currentTime;
    notes.forEach((n, i) => { if (n) tone(wave, nf(n), t0 + i * dur, dur * 1.1, vol, fx); });
  }

  const S = {
    click: (t) => tone('p50', 880, t, 0.05, 0.1, fx, 1200),
    blip: (t) => tone('p25', 660, t, 0.04, 0.08, fx),
    pop: (t) => { tone('p25', 300, t, 0.14, 0.2, fx, 1500); noise(t, 0.07, 0.25, fx, 3000, 'highpass'); },
    snap: (t) => { noise(t, 0.16, 0.45, fx, 2500, 'highpass'); tone('square', 170, t, 0.16, 0.18, fx, 50); },
    ouch: (t) => tone('p25', 760, t, 0.26, 0.14, fx, 220),
    buzz: (t) => { tone('sawtooth', 70, t, 0.25, 0.16, fx); tone('square', 74, t, 0.25, 0.09, fx); },
    scrub: (t) => noise(t, 0.06, 0.13, fx, 3500, 'bandpass'),
    squirt: (t) => noise(t, 0.07, 0.14, fx, 900, 'lowpass'),
    coin: (t) => { tone('p25', 988, t, 0.07, 0.13, fx); tone('p25', 1319, t + 0.07, 0.28, 0.13, fx); },
    chomp: (t) => { noise(t, 0.3, 0.55, fx, 900, 'lowpass', 90); tone('sine', 240, t, 0.3, 0.55, fx, 40); },
    inject: (t) => tone('sine', 1400, t, 0.12, 0.14, fx, 500),
    numb: (t) => [523, 659, 784, 1047].forEach((f, i) => tone('sine', f, t + i * 0.06, 0.2, 0.1, fx)),
    ding: (t) => { tone('sine', 1319, t, 0.35, 0.18, fx); tone('sine', 1047, t + 0.22, 0.5, 0.18, fx); },
    creak: (t) => tone('p12', rand(140, 210), t, 0.05, 0.11, fx, rand(90, 130)),
    sparkle: (t) => { tone('p12', 2093, t, 0.06, 0.07, fx); tone('p12', 2637, t + 0.05, 0.1, 0.07, fx); },
    clink: (t) => { tone('triangle', 2400, t, 0.08, 0.14, fx); tone('triangle', 3200, t + 0.02, 0.06, 0.07, fx); },
    uv: (t) => tone('triangle', 1600, t, 0.5, 0.07, fx, 1750),
    hmph: (t) => { tone('p25', 330, t, 0.12, 0.13, fx); tone('p25', 247, t + 0.13, 0.25, 0.13, fx); },
    wrong: (t) => tone('square', 150, t, 0.18, 0.11, fx, 100),
    tick: (t) => tone('p50', 1200, t, 0.03, 0.05, fx),
    whoosh: (t) => noise(t, 0.25, 0.18, fx, 400, 'bandpass', 3000),
    thud: (t) => { tone('sine', 120, t, 0.2, 0.5, fx, 50); noise(t, 0.08, 0.2, fx, 500); },
    buy: (t) => [784, 988, 1175, 1568].forEach((f, i) => tone('p25', f, t + i * 0.05, 0.1, 0.1, fx)),
    boom: (t) => { noise(t, 1.1, 0.8, fx, 1400, 'lowpass', 50); tone('sine', 120, t, 0.9, 0.7, fx, 28); tone('square', 70, t, 0.35, 0.22, fx, 30); },
    bonk: (t) => { tone('triangle', 720, t, 0.13, 0.4, fx, 240); tone('sine', 1450, t + 0.01, 0.08, 0.15, fx, 900); [0.3, 0.45, 0.6].forEach((d) => tone('sine', 2600, t + d, 0.07, 0.06, fx, 3300)); },
    chainsaw: (t) => { for (let i = 0; i < 9; i++) tone('sawtooth', 92 + (i % 2) * 28, t + i * 0.1, 0.11, 0.17, fx); noise(t, 0.95, 0.13, fx, 2200, 'bandpass'); },
    kachunk: (t) => { noise(t, 0.05, 0.45, fx, 3000, 'highpass'); tone('square', 130, t, 0.09, 0.25, fx, 55); },
    zap: (t) => { tone('square', 1900, t, 0.7, 0.09, fx, 180); tone('sawtooth', 950, t, 0.7, 0.08, fx, 90); },
    thunk: (t) => { tone('sine', 95, t, 0.3, 0.7, fx, 38); noise(t, 0.14, 0.4, fx, 700); },
    fuse: (t) => noise(t, 0.75, 0.13, fx, 6000, 'highpass'),
    slurp: (t) => noise(t, 0.9, 0.28, fx, 300, 'bandpass', 2600),
    cannon: (t) => { tone('sine', 150, t, 0.22, 0.5, fx, 50); noise(t, 0.3, 0.3, fx, 900, 'lowpass'); },
    good: () => jingle(['C5', 'E5', 'G5', 'C6'], 0.07),
    great: () => jingle(['C5', 'E5', 'G5', 'C6', null, 'G5', 'C6', 'E6'], 0.07),
    bad: () => jingle(['G4', 'F#4', 'F4', 'E4'], 0.16, 'p50', 0.1),
    fanfare: () => jingle(['G4', 'C5', 'E5', 'G5', null, 'E5', 'G5', null, 'C6', 'C6', 'C6'], 0.09),
    victory: () => jingle(['C5', 'C5', 'C5', 'C5', 'G#4', null, 'A#4', null, 'C5', null, 'A#4', 'C5', 'C5', 'C5'], 0.11),
    start: () => jingle(['C5', 'G5', 'C6', 'E6', 'G6'], 0.06, 'p12', 0.12),
  };
  const RATE = { scrub: 0.06, squirt: 0.07, creak: 0.07, tick: 0.05, sparkle: 0.08, blip: 0.03 };

  function sfx(name) {
    if (!ac || !settings.sfx || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (RATE[name] && last[name] && now - last[name] < RATE[name]) return;
    last[name] = now;
    S[name](now);
  }

  // looping drill sound
  let drill = null;
  function drillOn(load) {
    if (!ac || !settings.sfx) return;
    if (!drill) {
      const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = 440; o2.frequency.value = 447;
      f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 1.5; g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(fx); o.start(); o2.start();
      drill = { o, o2, g };
    }
    const t = ac.currentTime;
    drill.g.gain.setTargetAtTime(0.07, t, 0.02);
    drill.o.frequency.setTargetAtTime(load ? 300 : 440, t, 0.04);
    drill.o2.frequency.setTargetAtTime(load ? 306 : 447, t, 0.04);
  }
  function drillOff() { if (drill) drill.g.gain.setTargetAtTime(0, ac.currentTime, 0.03); }

  function setMusic(on) { settings.music = on; saveSettings(); if (mus) mus.gain.setTargetAtTime(on ? 0.42 : 0, ac.currentTime, 0.05); }
  function setSfx(on) { settings.sfx = on; saveSettings(); if (fx) fx.gain.setTargetAtTime(on ? 0.75 : 0, ac.currentTime, 0.05); if (!on) drillOff(); }

  return { unlock, sfx, playSong, stopMusic, drillOn, drillOff, setMusic, setSfx, ready: () => !!ac };
})();

['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, () => SND.unlock(), { passive: true }));
