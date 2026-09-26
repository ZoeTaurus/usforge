// Tiny WebAudio synth for 8-bit sound effects. Audio starts on the first button press.
(() => {
  const V = window.VAX;
  let ac = null, master = null, sfxBus = null, musicBus = null;
  // muted = the quick mute (M key / HUD button); sfxOn and music.on are the per-channel switches in Settings
  V.audio = { muted: false, sfxOn: true, vol: { master: .8, music: .6, sfx: .8 } };

  V.audio.init = () => {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.connect(master);
        musicBus = ac.createGain(); musicBus.connect(master);
        V.audio.apply();
      } catch (e) {}
    }
    ac?.resume?.();
    music.start();
  };
  // push volume/mute settings into the mixer (safe to call before audio has started)
  V.audio.apply = () => {
    if (!ac) return;
    const v = V.audio.vol, t = ac.currentTime;
    master.gain.setTargetAtTime(V.audio.muted ? 0 : v.master * 1.25, t, .02);
    sfxBus.gain.setTargetAtTime(V.audio.sfxOn ? v.sfx * 1.25 : 0, t, .02);
    musicBus.gain.setTargetAtTime(music.on ? v.music * 1.6 : 0, t, .02);
  };
  // a short blip so the viewer hears the level they just picked
  V.audio.preview = bus => {
    if (!ac) V.audio.init();
    if (bus === 'music') return;
    sfx(880, 1320, .08, 'square', .04);
  };

  function sfx(f1, f2, dur, type = 'square', vol = .04) {
    if (V.audio.muted || !V.audio.sfxOn || !ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(f2, 20), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(sfxBus); o.start(t); o.stop(t + dur + .02);
  }
  const later = (ms, fn) => setTimeout(fn, ms);

  V.SND = {
    shoot:  () => sfx(900, 500, .05, 'square', .012),
    hit:    () => sfx(300, 180, .04, 'square', .02),
    pop:    () => sfx(520, 90, .12, 'triangle', .06),
    hurt:   () => sfx(220, 50, .3, 'sawtooth', .06),
    block:  () => sfx(1200, 300, .2, 'triangle', .06),
    pick:   () => { sfx(660, 990, .08, 'square', .03); later(70, () => sfx(990, 1320, .1, 'square', .03)); },
    nova:   () => { sfx(80, 30, .6, 'sawtooth', .08); sfx(1400, 200, .5, 'square', .03); },
    boss:   () => sfx(90, 40, .8, 'sawtooth', .07),
    thump:  () => { sfx(70, 38, .14, 'sine', .14); later(120, () => sfx(60, 34, .12, 'sine', .1)); },   // lub-dub
    drone:  s => sfx(45, 110, s, 'sawtooth', .025),
    charge: () => sfx(200, 700, .35, 'square', .025),
    spit:   () => sfx(180, 120, .1, 'square', .02),
    snipe:  () => sfx(1800, 300, .12, 'sawtooth', .03),
    bossShot: () => sfx(120, 60, .25, 'sawtooth', .04),
    spores: () => sfx(400, 200, .1, 'triangle', .03),
    wave:   () => { sfx(440, 440, .08, 'square', .03); later(90, () => sfx(660, 660, .12, 'square', .03)); },
    clear:  () => [523, 659, 784, 1047].forEach((f, i) => later(i * 80, () => sfx(f, f, .12, 'square', .03))),
    upgrade:() => { sfx(784, 1568, .15, 'triangle', .05); later(120, () => sfx(1047, 2093, .2, 'triangle', .04)); },
    combo:  () => sfx(1320, 1760, .06, 'square', .02),
    dash:   () => sfx(300, 1200, .12, 'triangle', .04),
    coin:   () => sfx(1500, 2100, .05, 'square', .012),
    buy:    () => { sfx(880, 880, .06, 'square', .03); later(60, () => sfx(1320, 1320, .1, 'square', .03)); },
    nope:   () => sfx(200, 150, .12, 'square', .03),
    boom:   () => sfx(400, 60, .12, 'sawtooth', .025),
    fever:  () => sfx(90, 70, .1, 'sawtooth', .015),
    blink:  () => { sfx(1600, 400, .08, 'triangle', .03); later(60, () => sfx(400, 1600, .08, 'triangle', .03)); },
    reveal: () => sfx(160, 520, .18, 'sawtooth', .04),
    shell:  () => sfx(700, 150, .22, 'square', .04),
  };

  // ---------- music: a tiny multi-track step sequencer ----------
  // Each track: tempo, four chord bars ([bass root, chord tones…] as MIDI), which 16th-steps get bass/kick/hats,
  // how the arpeggio moves, and an optional 8th-note lead melody (null = rest). The game picks a track by situation.
  const music = V.music = { on: true, intense: false, timer: 0, step: 0, next: 0, cur: null };
  const _ = null;
  const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14], FOUR = [0, 4, 8, 12], OFF = [2, 6, 10, 14];
  V.TRACKS = {
    home:    { bpm: 92,  bars: [[48, 60, 64, 67, 71], [45, 57, 60, 64, 67], [41, 57, 60, 64, 65], [43, 55, 59, 62, 65]], bassW: 'triangle', bass: [0, 8], arpW: 'triangle', arpRate: 2, arp: 'updown', vol: .8 },
    blood:   { bpm: 128, bars: [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 59, 62]], bassW: 'square', bass: [0, 4, 6, 8, 12, 14], arpW: 'triangle', arpRate: 2, arp: 'up', hats: OFF },
    lymph:   { bpm: 116, bars: [[38, 57, 60, 65], [43, 59, 62, 65], [38, 57, 62, 65], [36, 55, 60, 64]], bassW: 'square', bass: [0, 3, 6, 10, 12], arpW: 'triangle', arpRate: 2, arp: 'updown', hats: OFF, kick: [0, 8] },
    lungs:   { bpm: 104, bars: [[40, 56, 59, 64], [37, 56, 61, 64], [45, 57, 61, 64], [47, 59, 63, 66]], bassW: 'triangle', bass: [0, 8], arpW: 'square', arpRate: 4, arp: 'up', echo: true, hats: [4, 12], hatVol: .006, vol: .85 },
    gut:     { bpm: 122, bars: [[43, 58, 62, 67], [46, 58, 62, 65], [48, 60, 63, 67], [50, 57, 60, 66]], bassW: 'square', bass: [0, 2, 5, 7, 10, 12, 15], bassJump: true, arpW: 'triangle', arpRate: 2, arp: 'skip', hats: EIGHTHS, hatVol: .007, kick: [0, 6, 8, 14] },
    marrow:  { bpm: 136, bars: [[40, 55, 59, 64], [36, 55, 60, 64], [43, 55, 59, 62], [38, 54, 57, 62]], bassW: 'square', bass: EIGHTHS, arpW: 'triangle', arpRate: 2, arp: 'up', hats: OFF, kick: FOUR },
    brain:   { bpm: 96,  bars: [[42, 57, 61, 66], [38, 57, 62, 66], [47, 59, 62, 66], [37, 56, 61, 65]], bassW: 'triangle', bass: [0], arpW: 'sine', arpRate: 3, arp: 'up', echo: true, vol: .9 },
    boss:    { bpm: 150, bars: [[36, 60, 63, 67], [32, 60, 63, 68], [34, 58, 62, 65], [31, 59, 62, 67]], bassW: 'sawtooth', bass: EIGHTHS, arpW: 'square', arpRate: 1, arp: 'up', hats: [1, 3, 5, 7, 9, 11, 13, 15], kick: FOUR,
      lead: [72, _, 75, _, 79, 77, 75, 74,  72, _, 75, _, 80, 79, 77, 75,  74, _, 77, _, 82, 80, 79, 77,  79, 77, 75, 74, 71, 74, 75, 74] },
    final:   { bpm: 160, bars: [[38, 62, 65, 69], [34, 62, 65, 70], [43, 62, 67, 70], [45, 61, 64, 69]], bassW: 'sawtooth', bass: EIGHTHS, arpW: 'square', arpRate: 1, arp: 'updown', hats: [1, 3, 5, 7, 9, 11, 13, 15], kick: [0, 4, 8, 10, 12],
      lead: [74, _, 77, _, 81, _, 79, 77,  77, _, 74, _, 70, 72, 74, _,  79, _, 77, _, 74, _, 72, 70,  69, _, 73, _, 76, _, 81, _] },
    victory: { bpm: 120, bars: [[48, 60, 64, 67], [41, 60, 65, 69], [43, 62, 67, 71], [48, 64, 67, 72]], bassW: 'square', bass: FOUR, arpW: 'triangle', arpRate: 2, arp: 'up', hats: OFF,
      lead: [72, _, 72, 76, 79, _, 76, _,  77, _, 81, _, 79, 77, 76, 74,  74, _, 79, _, 83, _, 81, 79,  84, _, _, _, 79, _, 84, _] },
  };
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  let noise = null;
  function note(freq, t, dur, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + dur + .02);
  }
  function hat(t, vol) {
    if (!noise) { noise = ac.createBuffer(1, ac.sampleRate * .05, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 6000;
    src.buffer = noise; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .04);
    src.connect(f).connect(g).connect(musicBus); src.start(t);
  }
  function kick(t, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .14);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + .16);
  }
  // which track fits right now (the Soundtrack setting can pin one)
  music.pick = () => {
    const sel = V.ui?.track || 'auto';
    if (sel !== 'auto' && V.TRACKS[sel]) return sel;
    const G = V.G, S = G?.S;
    if (!G || G.mode === 'title' || !S) return 'home';
    if (G.mode === 'victory' || (S.won && !S.victoryDone)) return 'victory';
    const b = S.intro || S.enemies.find(e => e.boss);
    if (b) return V.BOSS_ORDER.slice(-5).includes(b.type) ? 'final' : 'boss';
    return V.TRACKS[V.cos?.current?.id] ? V.cos.current.id : 'blood';
  };
  function tick() {
    if (!ac) return;
    const id = music.pick();
    if (id !== music.cur) { music.cur = id; music.step = 0; }   // switch tracks from the top of a bar
    const T = V.TRACKS[id], spb = 60 / T.bpm / 4, v = T.vol || 1;   // seconds per 16th
    if (music.next < ac.currentTime - .2) music.next = ac.currentTime + .05; // skip ahead after a background tab, no catch-up burst
    while (music.next < ac.currentTime + .12) {
      const t = music.next, st = music.step % 16, bi = Math.floor(music.step / 16) % 4, bar = T.bars[bi], tones = bar.slice(1);
      if (music.on && !V.audio.muted) {
        if (T.kick?.includes(st)) kick(t, .09 * v);
        if (T.bass.includes(st)) note(hz(bar[0] + (T.bassJump && st % 2 ? 12 : 0)), t, spb * 1.8, T.bassW, .03 * v);
        if (st % T.arpRate === 0) {
          const k = Math.floor(st / T.arpRate), n = tones.length;
          const idx = T.arp === 'updown' ? [...Array(n).keys(), ...Array.from({ length: n - 2 }, (_, i) => n - 2 - i)][k % (2 * n - 2)] : T.arp === 'skip' ? [0, 2, 1, 2][k % 4] % n : k % n;
          const f = hz(tones[idx] + 12), vol = (T.arpRate === 1 ? .014 : .017) * v;
          note(f, t, spb * T.arpRate * .9, T.arpW, vol);
          if (T.echo) note(f, t + spb * 3, spb * 2, T.arpW, vol * .35);   // a soft echo for the airy tracks
        }
        if (T.hats?.includes(st)) hat(t, (T.hatVol || .011) * v);
        if (T.lead && st % 2 === 0) { const m = T.lead[(bi * 8 + st / 2) % T.lead.length]; if (m) note(hz(m), t, spb * 1.9, 'square', .018 * v); }
      }
      music.step++; music.next += spb;
    }
  }
  music.start = () => {
    if (!ac || music.timer) return;
    music.next = ac.currentTime + .05;
    music.timer = setInterval(tick, 25);
  };
  music.setIntense = on => { music.intense = !!on; };   // (tracks now switch by situation; kept for callers)
})();
