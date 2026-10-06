// Tiny WebAudio synth: chiptune sound effects + a day/night music loop. No audio files.
(function () {
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // Each track: step length (s), melody + bass (MIDI numbers, null = rest).
  const TRACKS = {
    // A music-box lullaby for the home screen. Sweet. Slightly out of tune with itself.
    home: {
      step: 0.38, wave: 'triangle', vol: 0.05, warble: 22, drone: true,
      melody: [76, null, 79, null, 83, null, 81, 79, 76, null, 74, null, 75, null, null, null,
        76, null, 79, null, 84, null, 83, 79, 76, null, 72, null, 71, null, null, null],
      bass: [40, null, null, null, null, null, null, null, 45, null, null, null, null, null, null, null,
        40, null, null, null, null, null, null, null, 39, null, null, null, null, null, null, null],
    },
    day: {
      step: 0.26, wave: 'triangle', vol: 0.045, warble: 8,
      // Cozy… with a couple of notes that are just slightly wrong (G#, F#).
      melody: [72, 76, 79, 76, 74, 77, 80, 77, 76, 79, 84, 79, 74, 78, 83, 78],
      bass: [48, null, null, null, 50, null, null, null, 52, null, null, null, 43, null, null, null],
    },
    evening: {
      step: 0.34, wave: 'triangle', vol: 0.05, warble: 18, drone: true,
      melody: [69, null, 72, 76, 74, null, 72, null, 71, null, 67, 71, 69, null, null, null],
      bass: [45, null, null, null, 41, null, null, null, 43, null, null, null, 40, null, null, null],
    },
    night: {
      step: 0.5, wave: 'triangle', vol: 0.04, warble: 30, drone: true,
      melody: [69, null, null, 72, null, null, 71, null, null, 64, null, null, 68, null, null, null],
      bass: [33, null, null, null, 33, null, null, null, 29, null, null, null, 32, null, null, null],
    },
  };

  HS.Audio = {
    ctx: null,
    master: null,
    music: { on: true, track: null, step: 0, next: 0, timer: null },

    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        this.ctx.resume();
        this.music.on = HS.Save.musicOn();
        this.music.timer = setInterval(() => this.schedule(), 60);
      } catch (e) {
        this.ctx = null;
      }
    },

    tone(freq, start, dur, type = 'square', vol = 0.08, absolute = false, detune = 0) {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      const t = absolute ? start : c.currentTime + start;
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    },

    slide(f1, f2, start, dur, type = 'square', vol = 0.08) {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      const t = c.currentTime + start;
      o.type = type;
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    },

    noise(start, dur, vol = 0.2, freq = 800) {
      const c = this.ctx;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      const filter = c.createBiquadFilter();
      const g = c.createGain();
      src.buffer = buf;
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      g.gain.value = vol;
      src.connect(filter).connect(g).connect(this.master);
      src.start(c.currentTime + start);
    },

    play(name) {
      if (!this.ctx) return;
      switch (name) {
        case 'chime': this.tone(988, 0, 0.1, 'square', 0.04); this.tone(1319, 0.07, 0.15, 'square', 0.04); break;
        case 'hum': [67, 69, 71, 69, 67, 64, 67].forEach((n, i) => this.tone(midi(n), i * 0.26, 0.24, 'triangle', 0.08)); break;
        case 'good': [72, 76, 79, 84].forEach((n, i) => this.tone(midi(n), i * 0.07, 0.12, 'square', 0.05)); break;
        case 'bad': [52, 48, 43].forEach((n, i) => this.tone(midi(n), i * 0.13, 0.22, 'sawtooth', 0.06)); break;
        case 'page': [79, 83, 86, 91].forEach((n, i) => this.tone(midi(n), i * 0.09, 0.3, 'triangle', 0.07)); break;
        case 'knock': [0, 0.35, 0.7].forEach(t => { this.noise(t, 0.1, 0.7, 160); this.tone(80, t, 0.12, 'sine', 0.35); }); break;
        case 'clank': this.noise(0, 0.12, 0.3, 2000); this.tone(660, 0, 0.08, 'square', 0.04); break;
        case 'scrape': this.noise(0, 0.7, 0.3, 380); break;
        case 'slide': this.noise(0, 0.35, 0.12, 3000); break;
        case 'static': this.noise(0, 0.6, 0.12, 5000); break;
        case 'ring': for (let i = 0; i < 8; i++) this.tone(i % 2 ? 1250 : 1000, i * 0.05, 0.05, 'square', 0.04); break;
        case 'click': this.noise(0, 0.03, 0.4, 1500); break;
        case 'sob': this.slide(520, 380, 0, 0.35, 'triangle', 0.06); this.slide(500, 340, 0.45, 0.4, 'triangle', 0.05); break;
        case 'beep': this.tone(1760, 0, 0.12, 'square', 0.04); this.tone(1760, 0.2, 0.12, 'square', 0.04); break;
        case 'doorbell': this.tone(midi(76), 0, 0.5, 'triangle', 0.1); this.tone(midi(72), 0.35, 0.7, 'triangle', 0.1); break;
        case 'powerdown': this.slide(400, 40, 0, 0.8, 'sawtooth', 0.07); break;
        case 'powerup': this.slide(60, 500, 0, 0.5, 'square', 0.05); break;
        case 'bong': [0, 0.9].forEach(t => { this.tone(98, t, 1.4, 'triangle', 0.2); this.tone(196, t, 1, 'sine', 0.08); }); break;
        case 'knockSoft': [0, 0.4, 0.8].forEach(t => { this.noise(t, 0.08, 0.18, 140); this.tone(70, t, 0.1, 'sine', 0.1); }); break;
        case 'knockClose': [0, 0.25, 0.5].forEach(t => { this.noise(t, 0.06, 0.9, 300); this.tone(110, t, 0.08, 'sine', 0.4); }); break;
        case 'rattle': for (let i = 0; i < 10; i++) this.noise(i * 0.045, 0.03, 0.25, 2500 + Math.random() * 800); break;
        case 'heartbeat': this.tone(55, 0, 0.12, 'sine', 0.35); this.tone(50, 0.18, 0.14, 'sine', 0.28); break;
        case 'creak': this.slide(180, 120, 0, 0.9, 'sawtooth', 0.02); this.noise(0, 0.9, 0.04, 300); break;
        case 'steps': [0, 0.42].forEach(t => { this.noise(t, 0.07, 0.35, 120); this.tone(60, t, 0.06, 'sine', 0.15); }); break;
        case 'whisper': for (let i = 0; i < 5; i++) this.noise(i * 0.22, 0.25, 0.05, 3500 + Math.random() * 1500); break;
        case 'windowtap': [0, 0.18, 0.36].forEach(t => this.noise(t, 0.03, 0.3, 4000)); break;
        case 'rumble': this.noise(0, 3.2, 0.5, 60); this.slide(45, 30, 0, 3.2, 'sine', 0.3); break;
        case 'scream':
          this.noise(0, 0.7, 0.9, 1800); this.noise(0, 0.7, 0.6, 600);
          this.slide(900, 300, 0, 0.7, 'sawtooth', 0.18); this.slide(1300, 500, 0, 0.6, 'square', 0.08);
          break;
        case 'musicbox': [76, 79, 83, 81, 79, 76, 74].forEach((n, i) => this.tone(midi(n), i * (0.3 + i * 0.06), 0.4, 'sine', 0.06)); break;
        case 'pickup': this.tone(midi(84), 0, 0.06, 'square', 0.05); this.tone(midi(88), 0.05, 0.08, 'square', 0.05); break;
      }
    },

    // ---------- music ----------
    setTrack(name) {
      if (this.music.track === name) return;
      this.music.track = name;
      this.music.step = 0;
      if (this.ctx) this.music.next = this.ctx.currentTime + 0.1;
    },

    // Stop the music for a while, for no reason at all.
    silence(sec) {
      if (this.ctx) this.music.silentUntil = this.ctx.currentTime + sec;
    },

    toggleMusic() {
      this.music.on = !this.music.on;
      HS.Save.setMusic(this.music.on);
      return this.music.on;
    },

    schedule() {
      const m = this.music, c = this.ctx;
      if (!c || !m.on || !m.track) return;
      if (m.silentUntil && c.currentTime < m.silentUntil) { m.next = m.silentUntil; return; }
      const tr = TRACKS[m.track];
      if (m.next < c.currentTime) m.next = c.currentTime + 0.05;
      while (m.next < c.currentTime + 0.25) {
        const i = m.step % tr.melody.length;
        // The tape is warped: pitch drifts slowly up and down.
        const warble = Math.sin(m.next * 0.7) * (tr.warble || 0) + Math.sin(m.next * 2.3) * (tr.warble || 0) * 0.3;
        // Wrong notes: rare on Day 1, more and more common as the week goes on.
        const wrong = 0.015 + (HS.Game.day || 1) * 0.015;
        let note = tr.melody[i];
        if (note != null && Math.random() < wrong) note += Math.random() < 0.5 ? -1 : 1;
        if (note != null) this.tone(midi(note), m.next, tr.step * 0.9, tr.wave, tr.vol, true, warble);
        if (tr.bass[i] != null) this.tone(midi(tr.bass[i]), m.next, tr.step * 3.5, 'triangle', tr.vol * 1.6, true, warble * 0.5);
        // A low hum under everything, at night.
        if (tr.drone && i % 16 === 0) {
          this.tone(midi((tr.bass[0] || 40) - 12), m.next, tr.step * 16, 'sine', tr.vol * 1.1, true, warble);
          this.tone(midi((tr.bass[0] || 40) - 11), m.next, tr.step * 16, 'sine', tr.vol * 0.35, true); // a half-step rub
        }
        m.next += tr.step;
        m.step++;
      }
    },
  };
})();
