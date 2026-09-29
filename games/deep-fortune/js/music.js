'use strict';
// ============================================================
//  Adaptive chiptune soundtrack
//  A look-ahead step sequencer (16th notes) with bass, chord
//  pads, a generated melody, arpeggios and drums. The mood
//  follows the game: title, surface day / night, caves, the
//  deep abyss, danger when monsters close in, and the boss.
// ============================================================
if (settings.musicVol === undefined) settings.musicVol = .6;

const MAJ = [0,4,7], MIN = [0,3,7];
const SCALES = {
  majPent: [0,2,4,7,9], minPent: [0,3,5,7,10], minor: [0,2,3,5,7,8,10],
  dorian: [0,2,3,5,7,9,10], phrygian: [0,1,3,5,7,8,10],
};
// every mood: tempo, key (MIDI), scale, 4-chord progression, instruments, drum pattern & feel
const MOODS = {
  title:  { bpm:98,  key:60, scale:'majPent', prog:[[0,MAJ],[9,MIN],[5,MAJ],[7,MAJ]], lead:'square',   leadVol:.05,  density:.5,  bass:[0,6,8,14], arp:false, echo:.18,
            kick:[0,8], snare:[4,12], hat:[2,6,10,14] },
  day:    { bpm:108, key:62, scale:'majPent', prog:[[0,MAJ],[7,MAJ],[9,MIN],[5,MAJ]], lead:'square',   leadVol:.045, density:.55, bass:[0,3,8,11], arp:false, echo:.15,
            kick:[0,8,10], snare:[4,12], hat:[0,2,4,6,8,10,12,14] },
  night:  { bpm:76,  key:57, scale:'majPent', prog:[[0,MAJ],[5,MAJ],[9,MIN],[7,MAJ]], lead:'triangle', leadVol:.06,  density:.3,  bass:[0,8],      arp:true,  echo:.35,
            kick:[], snare:[], hat:[4,12] },
  cave:   { bpm:84,  key:57, scale:'minPent', prog:[[0,MIN],[8,MAJ],[3,MAJ],[10,MAJ]], lead:'triangle', leadVol:.055, density:.32, bass:[0,10],     arp:true,  echo:.45,
            kick:[0], snare:[], hat:[8] },
  deep:   { bpm:68,  key:52, scale:'phrygian', prog:[[0,MIN],[1,MAJ],[0,MIN],[7,MIN]], lead:'sine',    leadVol:.07,  density:.22, bass:[0],        arp:true,  echo:.55,
            kick:[0], snare:[], hat:[], drone:true },
  danger: { bpm:132, key:57, scale:'minor',   prog:[[0,MIN],[0,MIN],[8,MAJ],[10,MAJ]], lead:'square',   leadVol:.045, density:.6,  bass:[0,2,4,6,8,10,12,14], arp:false, echo:.12,
            kick:[0,4,8,12], snare:[4,12], hat:[2,6,10,14] },
  boss:   { bpm:150, key:52, scale:'phrygian', prog:[[0,MIN],[1,MAJ],[0,MIN],[10,MAJ]], lead:'sawtooth', leadVol:.035, density:.7,  bass:[0,1,3,4,6,8,9,11,12,14], arp:true, echo:.1,
            kick:[0,3,6,8,11,14], snare:[4,12], hat:[0,2,4,6,8,10,12,14] },
};
const mtof = m => 440 * Math.pow(2, (m - 69)/12);

const MUS = { bus:null, send:null, next:0, step:0, mood:'title', dangerHold:0, motif:[], motifB:[], lastIdx:4, timer:null };

function musicSetup(){
  const a = actx;
  MUS.bus = a.createGain(); MUS.bus.gain.value = 0; MUS.bus.connect(master);
  // echo: delay -> feedback -> lowpass -> bus
  MUS.send = a.createGain(); MUS.send.gain.value = .2;
  const d = a.createDelay(1), fb = a.createGain(), lp = a.createBiquadFilter();
  d.delayTime.value = .28; fb.gain.value = .38; lp.type = 'lowpass'; lp.frequency.value = 2200;
  MUS.send.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(MUS.bus);
  MUS.delay = d;
}
function startMusic(){
  if (!actx || MUS.timer) return;
  musicSetup();
  MUS.next = actx.currentTime + .1;
  MUS.timer = setInterval(musicScheduler, 25);
}

// ---------- instruments ----------
function mnote(freq, t, dur, type, vol, { attack = .005, echo = 0, slide = 0, detune = 0 } = {}){
  const a = actx, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq*slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(MUS.bus);
  if (echo){ const e = a.createGain(); e.gain.value = echo; g.connect(e); e.connect(MUS.send); }
  o.start(t); o.stop(t + dur + .05);
}
let mNoise = null;
function mhit(t, dur, vol, freq, type){
  const a = actx;
  if (!mNoise){ mNoise = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = mNoise.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2 - 1; }
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = mNoise; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(MUS.bus); s.start(t, Math.random()*.5); s.stop(t + dur + .02);
}
const kick = (t, v=.22) => mnote(140, t, .18, 'sine', v, { slide:.28 });
const snare = (t, v=.07) => { mhit(t, .12, v, 1800, 'bandpass'); mnote(190, t, .06, 'triangle', v*.6); };
const hat = (t, v=.025) => mhit(t, .035, v, 7000, 'highpass');

// ---------- melody generation ----------
function makeMotif(m){
  const out = [], sc = SCALES[m.scale];
  let idx = MUS.lastIdx;
  for (let s=0;s<16;s++){
    const strong = s % 4 === 0;
    if (Math.random() < m.density * (strong ? 1.3 : .7)){
      idx = clamp(idx + [-2,-1,-1,0,1,1,2][Math.random()*7|0], 0, sc.length*2);
      out.push({ idx, len: Math.random() < .3 ? 3 : Math.random() < .5 ? 2 : 1 });
    } else out.push(null);
  }
  MUS.lastIdx = idx;
  return out;
}
function scaleNote(m, idx){ const sc = SCALES[m.scale]; return m.key + 12 + sc[idx % sc.length] + 12*Math.floor(idx / sc.length); }

// ---------- what should be playing? ----------
function pickMood(){
  if (scene !== 'game' || !game || !P) return 'title';
  if (game.over) return MUS.mood;
  if (boss && !boss.dying) return 'boss';
  const near = enemies.some(e => e.def.dmg > 0 && Math.hypot(e.x - P.x, e.y - P.y) < 7*TS);
  if (near) MUS.dangerHold = 4;                      // stay tense for a few bars after the fight
  if (MUS.dangerHold > 0) return 'danger';
  const dep = depthOf(Math.floor((P.y + P.h)/TS));
  if (dep <= 1) return dayPhase().night ? 'night' : 'day';
  return dep < 120 ? 'cave' : 'deep';
}

// ---------- the sequencer ----------
function musicScheduler(){
  if (!actx || actx.state !== 'running' || !MUS.bus) return;
  const target = (settings.music && !muted) ? settings.musicVol * (game && game.paused && scene === 'game' ? .55 : 1) : 0;
  MUS.bus.gain.setTargetAtTime(target, actx.currentTime, .3);
  if (target === 0){ MUS.next = actx.currentTime + .1; return; }
  let m = MOODS[MUS.mood];
  while (MUS.next < actx.currentTime + .12){
    const t = MUS.next, step = MUS.step, s16 = step % 16, bar = (step / 16 | 0) % 4;
    if (s16 === 0){
      if (MUS.dangerHold > 0 && bar % 2 === 0) MUS.dangerHold--;
      const w = pickMood();                               // switch moods on the next bar line
      if (w !== MUS.mood){ MUS.mood = w; MUS.step = 0; }
      m = MOODS[MUS.mood];
      if (MUS.step % 64 === 0){
        MUS.send.gain.setTargetAtTime(m.echo, t, .5);
        MUS.delay.delayTime.setTargetAtTime(60/m.bpm*.75, t, .2);
        MUS.motif = makeMotif(m); MUS.motifB = makeMotif(m);
      }
    }
    playStep(m, MUS.step % 16, (MUS.step/16|0) % 4, t);
    MUS.next += 60/m.bpm/4;
    MUS.step = (MUS.step + 1) % 64;
  }
}
function playStep(m, s, bar, t){
  const beat = 60/m.bpm, sixteenth = beat/4;
  const [root, chord] = m.prog[bar];
  const bassRoot = m.key - 24 + root;
  // chord pad on the downbeat
  if (s === 0){
    for (const iv of chord) mnote(mtof(m.key - 12 + root + iv), t, beat*4 - .05, 'triangle', .022, { attack:.08, echo:.3 });
    if (m.drone) mnote(mtof(m.key - 24), t, beat*4, 'sawtooth', .018, { attack:.4, detune: 7 });
  }
  // bass
  if (m.bass.includes(s)){
    const up = m === MOODS.boss && s % 4 === 3 ? 12 : m === MOODS.day && s === 11 ? 7 : 0;
    mnote(mtof(bassRoot + up), t, sixteenth * (m.bass.length > 6 ? 1.6 : 3), m === MOODS.boss || m === MOODS.danger ? 'sawtooth' : 'triangle', m === MOODS.deep ? .09 : .075);
  }
  // arpeggio through the chord tones
  if (m.arp && s % 2 === 0){
    const tones = [...chord, 12, chord[1] + 12], iv = tones[(s/2) % tones.length];
    mnote(mtof(m.key + root + iv), t, sixteenth*1.8, m === MOODS.boss ? 'square' : 'sine', m === MOODS.boss ? .018 : .03, { echo:.5 });
  }
  // melody: motif A, B, A, variation of B
  const motif = bar % 2 === 0 ? MUS.motif : MUS.motifB;
  let n = motif && motif[s];
  if (n && bar === 3 && Math.random() < .3) n = { idx: n.idx + (Math.random() < .5 ? 1 : -1), len: n.len };
  if (n){
    let midi = scaleNote(m, Math.max(0, n.idx));
    if (s % 4 === 0){                                  // land strong beats on chord tones
      let best = midi, bd = 99;
      for (let o=-1;o<=1;o++) for (const iv of chord){ const c = m.key + 12 + root + iv + o*12, d = Math.abs(c - midi); if (d < bd){ bd = d; best = c; } }
      midi = best;
    }
    mnote(mtof(midi), t, sixteenth * n.len * 1.1, m.lead, m.leadVol, { echo:.6, detune: m.lead === 'square' ? 4 : 0 });
  }
  // drums
  if (m.kick.includes(s)) kick(t);
  if (m.snare.includes(s)) snare(t);
  if (m.hat.includes(s)) hat(t, s % 4 === 2 ? .03 : .02);
  if (m === MOODS.cave && s === 8 && Math.random() < .4) mnote(mtof(m.key + 24 + [0,7,12][Math.random()*3|0]), t, .6, 'sine', .02, { echo:.8 });   // water-drip bell
}
