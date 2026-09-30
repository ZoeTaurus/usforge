'use strict';
// Everything you hear is synthesized with WebAudio: no sound files.
const Sfx = {
  ctx: null,
  muted: U.store.get('dm-muted', false),
  vol: 0.7,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : this.vol;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(c.destination);
    this.bus = c.createGain();
    this.bus.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.connect(this.master);
    this.applySettings();

    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    this.wind = this.loopNoise('bandpass', 700, 0.7);
    this.rumble = this.loopNoise('lowpass', 130, 1);
    this.music = { on: false, step: 0, next: 0 };
  },

  loopNoise(type, f, q) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(this.bus);
    s.start();
    return { f: fl, g };
  },

  applySettings() {
    if (!this.ctx) return;
    const st = Save.data.settings, t = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(st.sfx ? 1 : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(st.music ? 0.3 : 0, t, 0.05);
  },

  toggleMute() {
    this.muted = !this.muted;
    U.store.set('dm-muted', this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.05);
    return this.muted;
  },

  ambience(speedFrac, rumble) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.wind.g.gain.setTargetAtTime(0.02 + speedFrac * 0.2, t, 0.15);
    this.wind.f.frequency.setTargetAtTime(350 + speedFrac * 1900, t, 0.15);
    this.rumble.g.gain.setTargetAtTime(rumble * 0.9, t, 0.25);
  },

  tone(f, dur, type = 'square', vol = 0.2, f2 = null, delay = 0, lp = 0, dest = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) {
      const fl = c.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = lp;
      o.connect(fl); node = fl;
    }
    node.connect(g);
    g.connect(dest || this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  noise(dur, vol, freq, type = 'lowpass', delay = 0, freq2 = null, dest = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(freq, t);
    if (freq2) fl.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.bus);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  },

  jump(kind) {
    const big = kind === 'megaramp' || kind === 'ufo';
    this.tone(big ? 160 : 240, big ? 0.6 : 0.3, 'square', 0.1, big ? 900 : 640);
    this.noise(0.35, 0.25, 1200, 'bandpass', 0, 3200);
  },
  land() { this.noise(0.2, 0.55, 600, 'lowpass', 0, 150); this.tone(110, 0.16, 'sine', 0.35, 45); },
  crash() {
    this.noise(0.8, 0.9, 2200, 'lowpass', 0, 120);
    this.tone(200, 0.5, 'sawtooth', 0.22, 40);
    this.tone(95, 0.45, 'square', 0.18, 30, 0.06);
  },
  coin() { this.tone(1318, 0.07, 'square', 0.08); this.tone(1976, 0.16, 'square', 0.08, null, 0.06); },
  trick(n) {
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
    const count = Math.min(notes.length, 2 + n);
    for (let i = 0; i < count; i++) this.tone(notes[i], 0.14, 'square', 0.08, null, i * 0.055);
  },
  close() { this.tone(900, 0.12, 'triangle', 0.14, 1600); this.noise(0.2, 0.2, 3000, 'highpass'); },
  boost() { this.tone(140, 0.7, 'sawtooth', 0.16, 1100); this.noise(0.6, 0.3, 2500, 'highpass'); },
  warn() {
    for (let i = 0; i < 3; i++) {
      this.tone(880, 0.14, 'square', 0.1, null, i * 0.3);
      this.tone(620, 0.14, 'square', 0.1, null, i * 0.3 + 0.15);
    }
  },
  level() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.16, null, i * 0.08)); },
  smash() { this.noise(0.3, 0.5, 900, 'bandpass'); this.tone(420, 0.14, 'square', 0.08, 160); },
  squeak() { this.tone(1100, 0.12, 'square', 0.08, 1700); this.tone(1400, 0.1, 'square', 0.06, 900, 0.1); },
  moo() { this.tone(150, 0.9, 'sawtooth', 0.16, 105, 0, 500); },
  roar() { this.noise(1.1, 0.5, 400, 'lowpass', 0, 120); this.tone(95, 1.0, 'sawtooth', 0.2, 55, 0, 380); },
  ufo() { this.tone(300, 1.3, 'sine', 0.18, 1500); this.tone(305, 1.3, 'triangle', 0.1, 1520, 0.05); },
  boom(vol = 1) { this.noise(1.3, 0.9 * vol, 900, 'lowpass', 0, 50); this.tone(70, 0.9, 'sine', 0.5 * vol, 25); },
  plonk() {
    [110, 131, 165, 196, 247, 98].forEach((f, i) => this.tone(f, 1.4, 'triangle', 0.1, null, i * 0.01));
    this.noise(0.4, 0.5, 700);
  },
  sonic() { this.noise(0.1, 1, 5000, 'highpass'); this.boom(1); },
  beep(hi) { this.tone(hi ? 880 : 440, hi ? 0.45 : 0.18, 'square', 0.12); },
  honk() { this.tone(330, 0.35, 'square', 0.14, null, 0, 1200); this.tone(415, 0.35, 'square', 0.12, null, 0, 1200); this.tone(330, 0.5, 'square', 0.14, null, 0.45, 1200); },
  shield() { this.tone(500, 0.4, 'sine', 0.2, 1500); this.tone(750, 0.4, 'triangle', 0.1, 2200, 0.05); },
  shieldPop() { this.noise(0.3, 0.6, 3000, 'bandpass'); this.tone(1200, 0.25, 'sine', 0.2, 200); },
  magnet() { for (let i = 0; i < 6; i++) this.tone(600 + i * 150, 0.08, 'square', 0.06, null, i * 0.04); },
  rocket() { this.noise(1.5, 0.6, 400, 'lowpass', 0, 3000); this.tone(90, 1.2, 'sawtooth', 0.2, 400); },
  gate() { this.tone(1046, 0.1, 'triangle', 0.14); this.tone(1568, 0.18, 'triangle', 0.12, null, 0.07); },
  perfect() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.14, null, i * 0.045)); },
  record() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'square', 0.1, null, i * 0.1)); },
  hype() {
    // quick stadium air horn
    for (const f of [466, 587, 698]) this.tone(f, 0.28, 'sawtooth', 0.07, f * 0.97, 0, 2400);
    this.noise(0.5, 0.18, 1800, 'bandpass', 0.05);
  },
  whoosh() { this.noise(0.5, 0.4, 600, 'bandpass', 0, 4000); },
  caught() { this.noise(2.4, 1, 900, 'lowpass', 0, 60); this.tone(60, 2, 'sawtooth', 0.25, 25, 0, 300); },

  // A tiny chiptune loop (Am F C G). Tempo and layers climb with madness.
  updateMusic(level, on) {
    if (!this.ctx) return;
    const m = this.music, c = this.ctx;
    if (!on) { m.on = false; return; }
    if (!m.on) { m.on = true; m.next = c.currentTime + 0.05; m.step = 0; }
    const tempo = 128 + Math.min(48, (level - 1) * 4);
    const st = 60 / tempo / 4;
    while (m.next < c.currentTime + 0.12) {
      this.step(m.step, m.next - c.currentTime, level, st);
      m.next += st;
      m.step++;
    }
  },
  step(s, d, level, st) {
    const mf = n => 440 * Math.pow(2, (n - 69) / 12);
    const bar = Math.floor(s / 16) % 4, i = s % 16;
    const roots = [45, 41, 48, 43];
    const third = bar === 0 ? 3 : 4;
    const r = roots[bar];
    const mb = this.musicBus;
    if (i % 2 === 0) this.tone(mf(r - 12 + (i % 4 === 2 ? 12 : 0)), st * 1.7, 'sawtooth', 0.16, null, d, 650, mb);
    if (i % 4 === 0) this.tone(150, 0.14, 'sine', 0.5, 40, d, 0, mb);
    if (i === 4 || i === 12) this.noise(0.12, 0.22, 1400, 'highpass', d, null, mb);
    if (i % 2 === 1 || level >= 5) this.noise(0.035, i % 2 ? 0.09 : 0.05, 7000, 'highpass', d, null, mb);
    if (level >= 2) {
      const arp = [0, third, 7, 12, 7, third, 12, 7][i % 8];
      this.tone(mf(r + 24 + arp), st * 0.9, 'square', 0.035, null, d, 0, mb);
    }
    if (level >= 6 && i % 8 === 0) this.tone(mf(r + 36 + (i === 8 ? 7 : 0)), st * 3, 'triangle', 0.05, null, d, 0, mb);
  },
};

// Announcer using the browser's speech engine. Each style picks its own voice,
// pitch and catchphrases; `hype` (0–1) scales how worked up it gets.
// Natural styles keep pitch close to 1: pushing a speech voice far off its
// natural pitch is what makes it sound tinny. Excitement comes from the words.
const VOICE_STYLES = {
  hype: {
    label: 'Hype', natural: true,
    prefer: ['Ava', 'Zoe', 'Evan', 'Nathan', 'Allison', 'Susan', 'Aria', 'Jenny', 'Guy', 'Google US English', 'Samantha', 'Karen', 'Moira', 'Tessa'],
    pitch: 1.08, rate: 1.12, hypePitch: 0.14, hypeRate: 0.12,
    shouts: ['Oh my goodness!', 'Look at that!', 'Unbelievable!', 'Oh, yeah!', 'Wow!', 'No way!', "Let's go!", 'Incredible!', 'Are you kidding me?', 'Huge!', 'What a run!'],
  },
  posh: {
    label: 'Posh', natural: true,
    prefer: ['Daniel', 'Oliver', 'Arthur', 'Serena', 'Kate', 'Google UK English Male', 'Ryan', 'Sonia', 'George', 'Libby'],
    pitch: 1.0, rate: 1.02, hypePitch: 0.12, hypeRate: 0.08,
    shouts: ['Good heavens!', 'Oh, splendid!', 'I say!', 'Jolly good!', 'Most irregular!', 'Crikey!', 'Marvellous!', 'Goodness me!'],
  },
  grandpa: {
    label: 'Grandpa',
    prefer: ['Grandpa (English (US))', 'Grandpa', 'Fred', 'Ralph'],
    pitch: 1.0, rate: 0.98, hypePitch: 0.1, hypeRate: 0.08,
    shouts: ['Oh, my stars!', 'Whippersnapper!', 'Back in my day, we sledded uphill!', 'Holy mackerel!', 'Well, I never!', "Somebody get my pills!"],
  },
  robot: {
    label: 'Robot',
    prefer: ['Zarvox', 'Trinoids', 'Ralph', 'Fred', 'Microsoft David'],
    pitch: 0.8, rate: 1.08, hypePitch: 0.2, hypeRate: 0.12,
    shouts: ['Beep boop!', 'Excitement detected!', 'Does not compute!', 'Maximum velocity!', 'Error. Too rad!'],
  },
  gremlin: {
    label: 'Gremlin',
    prefer: ['Junior', 'Kathy', 'Princess', 'Samantha'],
    pitch: 1.85, rate: 1.4, hypePitch: 0.15, hypeRate: 0.2,
    shouts: ['He he he he!', 'Whee!', 'Yippee!', 'Again! Again!', 'Hoo hoo!', 'Zoom zoom!'],
  },
};
const VOICE_ORDER = ['hype', 'posh', 'grandpa', 'robot', 'gremlin'];

// How an announcer would actually say trick numbers.
const SPOKEN_NUMBERS = { 360: 'three-sixty', 720: 'seven-twenty', 1080: 'ten-eighty', 1440: 'fourteen-forty', 1800: 'eighteen-hundred', 2160: 'twenty-one-sixty' };
function speakable(text) {
  return text
    .replace(/\b(360|720|1080|1440|1800|2160)\b/g, n => SPOKEN_NUMBERS[n])
    .replace(/km\/h/gi, 'kilometres an hour')
    .replace(/\+/g, ', ')
    .replace(/×\s*(\d+)/g, 'times $1');
}

const Voice = {
  last: 0,
  voices: [],
  init() {
    try {
      if (!('speechSynthesis' in window)) return;
      const load = () => {
        this.voices = speechSynthesis.getVoices() || [];
        this.cache = {};
        if (typeof UI !== 'undefined' && UI.el) UI.syncSettings();
      };
      load();
      speechSynthesis.addEventListener('voiceschanged', load);
    } catch (e) { /* speech not available */ }
  },
  style() { return VOICE_STYLES[Save.data.settings.voiceStyle] || VOICE_STYLES.hype; },
  cycle() {
    const st = Save.data.settings;
    st.voiceStyle = VOICE_ORDER[(VOICE_ORDER.indexOf(st.voiceStyle) + 1) % VOICE_ORDER.length];
    Save.write();
    this.say('Ready to sled!', 0.9, true);
  },
  // Score every English voice: named favourites first, and for natural styles,
  // big bonuses for high-quality voices (macOS Premium/Enhanced, Edge "Natural").
  voiceScore(v, style) {
    const n = v.name;
    let s = 0;
    const i = style.prefer.findIndex(p => n.includes(p));
    if (i >= 0) s += 100 - i * 4;
    if (style.natural) {
      if (/premium/i.test(n)) s += 70;
      else if (/enhanced/i.test(n)) s += 50;
      if (/natural|neural|online/i.test(n)) s += 60;
      if (/^Google/.test(n)) s += 20;
      if (/Eddy|Flo|Reed|Rocko|Sandy|Shelley|Grandma|Grandpa|Albert|Bad News|Good News|Bahh|Bells|Boing|Bubbles|Cellos|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Ralph|Fred|Kathy/.test(n)) s -= 200;
    }
    return s;
  },
  pickVoice(style) {
    this.cache = this.cache || {};
    if (style.label in this.cache) return this.cache[style.label];
    const en = this.voices.filter(v => /^en/i.test(v.lang));
    let best = null, bestScore = -Infinity;
    for (const v of en) {
      const sc = this.voiceScore(v, style);
      if (sc > bestScore) { best = v; bestScore = sc; }
    }
    if (bestScore <= 0) best = en.find(v => v.default) || best;
    return (this.cache[style.label] = best || null);
  },
  // True when the browser only has the older built-in voices.
  basicOnly() {
    return this.voices.length > 0 && !this.voices.some(v => /^en/i.test(v.lang) && /premium|enhanced|natural|neural|online|^Google/i.test(v.name));
  },
  // Browsers only allow speech after the player has clicked or pressed a key,
  // so the first gesture speaks a silent line to unlock the engine.
  unlock() {
    if (this.unlocked || !('speechSynthesis' in window)) return;
    this.unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (e) { /* speech not available */ }
  },

  // Everything below works around two Chromium bugs: a cancel() immediately
  // followed by speak() also cancels the new line, and the engine can get stuck
  // reporting `speaking` forever. So: cancel, wait a beat, then speak, and reset
  // the engine if a line never starts.
  say(text, hype = 0.6, force = false) {
    try {
      if (!Save.data.settings.voice || Sfx.muted || !Save.data.settings.sfx) return;
      if (!('speechSynthesis' in window)) return;
      const now = performance.now();
      if (!force && now - this.last < 2000) return;
      this.last = now;
      const s = this.style();
      const pitch = s.pitch + s.hypePitch * hype + U.rand(-0.06, 0.06);
      const rate = s.rate + s.hypeRate * hype;
      const lines = [];
      // A shout-out first, pitched up, then the call itself; each sentence climbs a little.
      if (hype >= 0.7 && Math.random() < 0.3 + hype * 0.5) lines.push([U.pick(s.shouts), pitch + 0.2, rate + 0.1]);
      text = speakable(text);
      (text.match(/[^.!?]+[.!?]*/g) || [text]).forEach((part, i) => lines.push([part.trim(), pitch + i * 0.05, rate]));
      if (hype >= 0.85) Sfx.hype();

      clearTimeout(this.timer);
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
        this.timer = setTimeout(() => this.speak(lines, s), 180);
      } else this.speak(lines, s);
    } catch (e) { /* speech not available */ }
  },

  speak(lines, s) {
    try {
      speechSynthesis.resume();
      const voice = this.pickVoice(s);
      this.started = false;
      // Hold references so the browser doesn't garbage-collect utterances mid-sentence.
      this.live = lines.map(([text, pitch, rate]) => {
        const u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.pitch = U.clamp(pitch, 0.1, 2);
        u.rate = U.clamp(rate, 0.5, 2);
        u.volume = 1;
        u.onstart = () => { this.started = true; this.error = ''; };
        u.onerror = e => { if (e.error !== 'canceled' && e.error !== 'interrupted') this.error = e.error; };
        speechSynthesis.speak(u);
        return u;
      });
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => {
        if (!this.started) speechSynthesis.cancel(); // engine is wedged; clear it for next time
      }, 3000);
    } catch (e) { /* speech not available */ }
  },
};

addEventListener('pointerdown', () => Voice.unlock(), { capture: true });
addEventListener('keydown', () => Voice.unlock(), { capture: true });
