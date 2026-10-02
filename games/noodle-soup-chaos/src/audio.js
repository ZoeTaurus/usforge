'use strict';
// Tiny WebAudio chiptune engine: sound effects plus a step-sequenced music loop.
const SND = { ac: null, master: null, music: null, muted: false, song: null, step: 0, nextT: 0, noiseBuf: null };

function audioInit() {
  if (SND.ac) { if (SND.ac.state === 'suspended') SND.ac.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    SND.ac = new AC();
    SND.master = SND.ac.createGain(); SND.master.gain.value = SND.muted ? 0 : 0.55;
    SND.master.connect(SND.ac.destination);
    SND.music = SND.ac.createGain(); SND.music.gain.value = 0.5; SND.music.connect(SND.master);
    const len = SND.ac.sampleRate * 0.5;
    SND.noiseBuf = SND.ac.createBuffer(1, len, SND.ac.sampleRate);
    const d = SND.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    SND.nextT = SND.ac.currentTime + 0.05;
  } catch (e) { SND.ac = null; }
}

function toggleMute() {
  SND.muted = !SND.muted;
  if (SND.master) SND.master.gain.value = SND.muted ? 0 : 0.55;
}

const midi = n => 440 * Math.pow(2, (n - 69) / 12);

function tone(freq, dur, type = 'square', vol = 0.1, slideTo = null, when = 0, dest = null, abs = false) {
  if (!SND.ac) return;
  const a = SND.ac, t = abs ? when : a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || SND.master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseHit(dur, vol = 0.1, freq = 1000, when = 0, dest = null, abs = false) {
  if (!SND.ac) return;
  const a = SND.ac, t = abs ? when : a.currentTime + when;
  const s = a.createBufferSource(); s.buffer = SND.noiseBuf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || SND.master);
  s.start(t); s.stop(t + dur + 0.02);
}

const sfx = {
  click() { tone(520, 0.04, 'square', 0.06); },
  add() { tone(330, 0.07, 'square', 0.08, 520); },
  coin() { tone(988, 0.05, 'square', 0.09); tone(1319, 0.12, 'square', 0.09, null, 0.05); },
  catch() { tone(440, 0.08, 'triangle', 0.18, 880); },
  pour() { noiseHit(0.18, 0.12, 1800); },
  ding() { tone(1047, 0.15, 'triangle', 0.15); tone(1568, 0.25, 'triangle', 0.1, null, 0.08); },
  burn() { noiseHit(0.5, 0.16, 500); tone(200, 0.3, 'sawtooth', 0.05, 80); },
  good() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, 'square', 0.08, null, i * 0.06)); },
  bad() { tone(330, 0.3, 'sawtooth', 0.08, 140); },
  angry() { tone(170, 0.35, 'sawtooth', 0.1, 90); tone(160, 0.35, 'square', 0.05, 80, 0.05); },
  hire() { [523, 659, 784, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.13, 'square', 0.09, null, i * 0.08)); },
  event() { [880, 660, 880, 1100].forEach((f, i) => tone(f, 0.09, 'square', 0.08, null, i * 0.1)); },
  splat() { noiseHit(0.22, 0.18, 700); },
  error() { tone(140, 0.12, 'square', 0.08); },
  magic() { for (let i = 0; i < 7; i++) tone(1200 + i * 180, 0.07, 'triangle', 0.06, null, i * 0.04); },
  bell() { tone(1319, 0.3, 'triangle', 0.07); tone(1760, 0.3, 'triangle', 0.04, null, 0.05); },
  trash() { noiseHit(0.14, 0.12, 1200); tone(220, 0.08, 'square', 0.05, 110); },
  flash() { noiseHit(0.1, 0.25, 5000); tone(2000, 0.08, 'square', 0.05, 800); },
  start() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.12, 'square', 0.1, null, i * 0.07)); },
};

// ---------- music ----------
// 0 = rest. Lead and bass are 8th-note steps.
function bassLine(roots, pat) { const out = []; for (const r of roots) for (const p of pat) out.push(p === null ? 0 : r + p); return out; }
const SONGS = {
  title: {
    bpm: 96, type: 'square', vol: 0.045, drums: 1,
    lead: [76,0,79,0, 81,0,79,76, 74,0,76,0, 72,0,69,0,
           72,0,74,0, 76,0,79,0, 76,74,72,0, 74,0,0,0,
           76,0,79,0, 81,0,84,0, 81,79,76,0, 79,0,76,0,
           74,0,72,0, 69,0,72,74, 69,0,0,0, 0,0,0,0],
    bass: bassLine([45,41,48,43,45,41,43,45], [0,null,7,null,12,null,7,null]),
  },
  game: {
    bpm: 140, type: 'square', vol: 0.04, drums: 2,
    lead: [69,0,72,76, 0,76,74,72, 74,0,72,69, 67,0,69,0,
           69,0,72,76, 0,79,81,79, 76,0,74,76, 72,0,0,0,
           81,0,79,76, 79,0,76,74, 76,0,74,72, 74,0,76,0,
           72,74,76,79, 81,0,79,0, 76,74,72,74, 69,0,0,0],
    bass: bassLine([45,45,41,43,41,43,45,45], [0,null,12,null,0,0,12,null]),
  },
  end: {
    bpm: 84, type: 'triangle', vol: 0.09, drums: 1,
    lead: [76,0,79,0, 81,0,79,76, 74,0,76,0, 72,0,69,0,
           74,0,72,0, 69,0,72,74, 76,0,0,0, 0,0,0,0],
    bass: bassLine([45,41,48,43], [0,null,7,null,12,null,7,null]),
  },
};

function playMusic(name) {
  if (SND.song === name) return;
  SND.song = name; SND.step = 0;
  if (SND.ac) SND.nextT = SND.ac.currentTime + 0.08;
}

function musicTick() {
  if (!SND.ac || !SND.song || SND.muted) { if (SND.ac) SND.nextT = SND.ac.currentTime + 0.05; return; }
  const s = SONGS[SND.song]; const st = 60 / s.bpm / 2;
  if (SND.nextT < SND.ac.currentTime) SND.nextT = SND.ac.currentTime + 0.02;
  while (SND.nextT < SND.ac.currentTime + 0.15) {
    const i = SND.step % s.lead.length, t = SND.nextT;
    const n = s.lead[i];
    if (n) tone(midi(n), st * 0.95, s.type, s.vol, null, t, SND.music, true);
    const b = s.bass[SND.step % s.bass.length];
    if (b) tone(midi(b), st * 1.7, 'triangle', 0.13, null, t, SND.music, true);
    if (s.drums) {
      if (i % 4 === 0) tone(130, 0.12, 'sine', 0.22, 45, t, SND.music, true);
      if (s.drums > 1 && i % 2 === 1) noiseHit(0.04, 0.05, 7000, t, SND.music, true);
      if (s.drums === 1 && i % 4 === 2) noiseHit(0.05, 0.035, 6000, t, SND.music, true);
    }
    SND.nextT += st; SND.step++;
  }
}
setInterval(musicTick, 30);
