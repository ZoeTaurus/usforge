'use strict';
// ---------------------------------------------------------------------------
// Sound: a small Web Audio synthesizer + tracker-style sequencer for the
// music, and procedurally synthesized sound effects. No audio files.
//
// Song notation (see js/music.js): each track is a string of tokens, one
// 16th-note step per token unless a length is given:
//   C5  F#4  Bb3   note          C5:4   note lasting 4 steps
//   C4+E4+G4       chord         @Am7   chord symbol (voiced around the track octave)
//   .  .:4         rest          -      hold the previous note one more step
//   C5!  C5?       accent / soft (...)x4  repeat a group
// Drum tracks are compact strings: x hit, X accent, g ghost, . rest.
// ---------------------------------------------------------------------------

const Sound = (() => {
  const S = { ready: false, current: null };
  let ctx = null, master, comp, musicBus, sfxBus, musicVol, sfxVol, duckGain, reverb, revIn, sfxRev, delay, delIn, delFb;
  let noiseBuf = null, pulse25 = null, pulse12 = null, distCurve = null;
  let mVol = 7, sVol = 8, pending = null;
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---- setup ------------------------------------------------------------------
  S.init = function () {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch (e) {
      return;
    }
    S.ctx = ctx;
    build(ctx);
    S.ready = true;
    S.setVolumes(mVol, sVol);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (pending) {
      const p = pending;
      pending = null;
      S.playSong(p.id, p.opts);
    }
  };

  function build(c) {
    master = c.createGain();
    master.gain.value = 0.9;
    comp = c.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.22;
    comp.connect(master);
    master.connect(c.destination);
    musicVol = c.createGain();
    duckGain = c.createGain();
    musicBus = c.createGain();
    musicBus.connect(duckGain);
    duckGain.connect(musicVol);
    musicVol.connect(comp);
    sfxVol = c.createGain();
    sfxBus = c.createGain();
    sfxBus.connect(sfxVol);
    sfxVol.connect(comp);
    // reverb
    reverb = c.createConvolver();
    reverb.buffer = impulse(c, 2.2, 3);
    revIn = c.createGain();
    revIn.connect(reverb);
    const revOut = c.createGain();
    revOut.gain.value = 0.32;
    reverb.connect(revOut);
    revOut.connect(musicBus);
    sfxRev = c.createGain();
    sfxRev.gain.value = 1;
    const sfxRevConv = c.createConvolver();
    sfxRevConv.buffer = impulse(c, 1.6, 3.5);
    sfxRev.connect(sfxRevConv);
    const sfxRevOut = c.createGain();
    sfxRevOut.gain.value = 0.35;
    sfxRevConv.connect(sfxRevOut);
    sfxRevOut.connect(sfxBus);
    // tempo-synced delay
    delIn = c.createGain();
    delay = c.createDelay(2);
    delay.delayTime.value = 0.36;
    delFb = c.createGain();
    delFb.gain.value = 0.32;
    const delFilt = c.createBiquadFilter();
    delFilt.type = 'lowpass';
    delFilt.frequency.value = 2600;
    delIn.connect(delay);
    delay.connect(delFilt);
    delFilt.connect(delFb);
    delFb.connect(delay);
    const delOut = c.createGain();
    delOut.gain.value = 0.38;
    delFilt.connect(delOut);
    delOut.connect(musicBus);
    // shared buffers / waves
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    pulse25 = pulseWave(c, 0.25);
    pulse12 = pulseWave(c, 0.125);
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      distCurve[i] = ((1 + 8) * x) / (1 + 8 * Math.abs(x));
    }
  }

  function impulse(c, secs, decay) {
    const len = Math.floor(c.sampleRate * secs);
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < c.sampleRate * 0.008 ? 0 : 1);
      }
    }
    return b;
  }

  function pulseWave(c, duty) {
    const n = 48;
    const re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return c.createPeriodicWave(re, im);
  }

  S.setVolumes = function (m, s) {
    mVol = m;
    sVol = s;
    if (!ctx) return;
    const now = ctx.currentTime;
    musicVol.gain.setTargetAtTime(Math.pow(m / 10, 1.6) * 0.62, now, 0.05);
    sfxVol.gain.setTargetAtTime(Math.pow(s / 10, 1.4) * 0.9, now, 0.05);
  };

  S.duck = function (on) {
    if (!ctx) return;
    duckGain.gain.setTargetAtTime(on ? 0.35 : 1, ctx.currentTime, 0.12);
  };

  // ---- voice helpers ----------------------------------------------------------
  function osc(type, f, t) {
    const o = ctx.createOscillator();
    if (type === 'pulse25') o.setPeriodicWave(pulse25);
    else if (type === 'pulse12') o.setPeriodicWave(pulse12);
    else o.type = type;
    o.frequency.setValueAtTime(f, t);
    return o;
  }
  function gain(v) {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  }
  function filt(type, f, q = 0.7) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }
  function noise(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const off = Math.random() * 1.5;
    s.start(t, off);
    s.stop(t + dur + 0.05);
    return s;
  }
  function cleanup(src, nodes) {
    src.onended = () => {
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch (e) {
          /* already gone */
        }
      }
    };
  }
  // ADSR: returns the time the voice can stop
  function adsr(p, t, a, d, s, r, dur, peak) {
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setTargetAtTime(peak * s, t + a, d / 3);
    const off = t + Math.max(dur, a + 0.005);
    p.setTargetAtTime(0.0001, off, r / 3);
    return off + r * 1.6;
  }
  // percussive exponential decay
  function perc(p, t, peak, tau, a = 0.002) {
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setTargetAtTime(0.0001, t + a, tau);
    return t + a + tau * 6;
  }

  // ---- instruments (melodic): (out, t, midi, dur, vel, opt) -------------------------
  const INST = {
    lead(out, t, m, dur, v) {
      const f = hz(m);
      const o1 = osc('pulse25', f, t), o2 = osc('square', f * 1.004, t);
      const g2 = gain(0.35), lp = filt('lowpass', 3600, 0.8), g = gain(0);
      const lfo = osc('sine', 5.6, t), lg = gain(0);
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.22);
      lfo.connect(lg);
      lg.connect(o1.frequency);
      lg.connect(o2.frequency);
      o1.connect(lp);
      o2.connect(g2);
      g2.connect(lp);
      lp.connect(g);
      g.connect(out);
      const end = adsr(g.gain, t, 0.006, 0.14, 0.62, 0.09, dur, 0.2 * v);
      for (const o of [o1, o2, lfo]) {
        o.start(t);
        o.stop(end);
      }
      cleanup(o1, [o1, o2, lfo, lg, g2, lp, g]);
    },
    saw(out, t, m, dur, v) {
      const f = hz(m);
      const o1 = osc('sawtooth', f * 0.996, t), o2 = osc('sawtooth', f * 1.004, t);
      const lp = filt('lowpass', 2200, 2), g = gain(0);
      lp.frequency.setValueAtTime(5200, t);
      lp.frequency.setTargetAtTime(2200, t, 0.08);
      const lfo = osc('sine', 5.2, t), lg = gain(0);
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.25);
      lfo.connect(lg);
      lg.connect(o1.frequency);
      lg.connect(o2.frequency);
      o1.connect(lp);
      o2.connect(lp);
      lp.connect(g);
      g.connect(out);
      const end = adsr(g.gain, t, 0.008, 0.2, 0.7, 0.12, dur, 0.13 * v);
      for (const o of [o1, o2, lfo]) {
        o.start(t);
        o.stop(end);
      }
      cleanup(o1, [o1, o2, lfo, lg, lp, g]);
    },
    chip(out, t, m, dur, v) {
      const o = osc('pulse12', hz(m), t), g = gain(0);
      o.connect(g);
      g.connect(out);
      const end = adsr(g.gain, t, 0.002, 0.08, 0.55, 0.04, dur * 0.85, 0.2 * v);
      o.start(t);
      o.stop(end);
      cleanup(o, [o, g]);
    },
    pluck(out, t, m, dur, v) {
      const f = hz(m);
      const o1 = osc('triangle', f, t), o2 = osc('square', f * 2, t), g2 = gain(0.12);
      const lp = filt('lowpass', 3200, 1), g = gain(0);
      lp.frequency.setValueAtTime(4200, t);
      lp.frequency.setTargetAtTime(1200, t, 0.1);
      o1.connect(lp);
      o2.connect(g2);
      g2.connect(lp);
      lp.connect(g);
      g.connect(out);
      const end = perc(g.gain, t, 0.3 * v, 0.12);
      o1.start(t);
      o2.start(t);
      o1.stop(end);
      o2.stop(end);
      cleanup(o1, [o1, o2, g2, lp, g]);
    },
    koto(out, t, m, dur, v) {
      const f = hz(m);
      const o1 = osc('triangle', f * 1.012, t), o2 = osc('sine', f * 2, t), g2 = gain(0.3);
      o1.frequency.setTargetAtTime(f, t, 0.02);
      const lp = filt('lowpass', 3800, 2), g = gain(0);
      o1.connect(lp);
      o2.connect(g2);
      g2.connect(lp);
      lp.connect(g);
      g.connect(out);
      const end = perc(g.gain, t, 0.32 * v, 0.2, 0.001);
      o1.start(t);
      o2.start(t);
      o1.stop(end);
      o2.stop(end);
      cleanup(o1, [o1, o2, g2, lp, g]);
    },
    bell(out, t, m, dur, v) {
      const f = hz(m);
      const car = osc('sine', f, t), mod = osc('sine', f * 3.5, t), mg = gain(0), g = gain(0);
      mg.gain.setValueAtTime(f * 2.2, t);
      mg.gain.setTargetAtTime(0, t, 0.25);
      mod.connect(mg);
      mg.connect(car.frequency);
      car.connect(g);
      g.connect(out);
      const end = perc(g.gain, t, 0.22 * v, 0.35, 0.002);
      car.start(t);
      mod.start(t);
      car.stop(end);
      mod.stop(end);
      cleanup(car, [car, mod, mg, g]);
    },
    piano(out, t, m, dur, v) {
      const f = hz(m);
      const o1 = osc('triangle', f, t), o2 = osc('sine', f * 2, t), o3 = osc('sine', f * 3, t);
      const g2 = gain(0.35), g3 = gain(0.12), lp = filt('lowpass', 2800, 0.7), g = gain(0);
      o1.connect(lp);
      o2.connect(g2);
      g2.connect(lp);
      o3.connect(g3);
      g3.connect(lp);
      lp.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.26 * v, t + 0.004);
      g.gain.setTargetAtTime(0.09 * v, t + 0.004, 0.25);
      const off = t + Math.max(dur, 0.08);
      g.gain.setTargetAtTime(0.0001, off, 0.08);
      const end = off + 0.4;
      for (const o of [o1, o2, o3]) {
        o.start(t);
        o.stop(end);
      }
      cleanup(o1, [o1, o2, o3, g2, g3, lp, g]);
    },
    organ(out, t, m, dur, v) {
      const f = hz(m);
      const g = gain(0), lp = filt('lowpass', 3000, 0.5);
      const parts = [[1, 0.5], [2, 0.32], [3, 0.16], [4, 0.1]];
      const os = [], gs = [];
      const lfo = osc('sine', 6, t), lg = gain(f * 0.003);
      lfo.connect(lg);
      for (const [k, a] of parts) {
        const o = osc('sine', f * k, t), og = gain(a);
        lg.connect(o.frequency);
        o.connect(og);
        og.connect(lp);
        os.push(o);
        gs.push(og);
      }
      lp.connect(g);
      g.connect(out);
      const end = adsr(g.gain, t, 0.008, 0.1, 0.85, 0.07, dur, 0.22 * v);
      for (const o of os.concat([lfo])) {
        o.start(t);
        o.stop(end);
      }
      cleanup(os[0], os.concat(gs, [lfo, lg, lp, g]));
    },
    flute(out, t, m, dur, v) {
      const f = hz(m);
      const o = osc('sine', f, t), o2 = osc('triangle', f, t), g2 = gain(0.25), g = gain(0);
      const lfo = osc('sine', 5, t), lg = gain(0);
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.009, t + 0.3);
      lfo.connect(lg);
      lg.connect(o.frequency);
      lg.connect(o2.frequency);
      const n = noise(t, dur + 0.3), bp = filt('bandpass', f * 2, 2), ng = gain(0.05);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(g);
      o.connect(g);
      o2.connect(g2);
      g2.connect(g);
      g.connect(out);
      const end = adsr(g.gain, t, 0.05, 0.2, 0.8, 0.1, dur, 0.26 * v);
      for (const x of [o, o2, lfo]) {
        x.start(t);
        x.stop(end);
      }
      cleanup(o, [o, o2, g2, lfo, lg, n, bp, ng, g]);
    },
    bass(out, t, m, dur, v) {
      const f = hz(m);
      const o1 = osc('sawtooth', f, t), o2 = osc('square', f * 0.5, t), g2 = gain(0.5);
      const lp = filt('lowpass', 500, 6), g = gain(0);
      lp.frequency.setValueAtTime(1600, t);
      lp.frequency.setTargetAtTime(380, t, 0.08);
      o1.connect(lp);
      o2.connect(g2);
      g2.connect(lp);
      lp.connect(g);
      g.connect(out);
      const end = adsr(g.gain, t, 0.004, 0.12, 0.75, 0.05, dur * 0.92, 0.36 * v);
      o1.start(t);
      o2.start(t);
      o1.stop(end);
      o2.stop(end);
      cleanup(o1, [o1, o2, g2, lp, g]);
    },
    slap(out, t, m, dur, v) {
      const f = hz(m);
      const o = osc('square', f, t), lp = filt('lowpass', 500, 8), g = gain(0);
      lp.frequency.setValueAtTime(3400, t);
      lp.frequency.setTargetAtTime(520, t, 0.05);
      o.connect(lp);
      lp.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.38 * v, t + 0.003);
      g.gain.setTargetAtTime(0.16 * v, t + 0.003, 0.08);
      const off = t + Math.max(0.05, dur * 0.9);
      g.gain.setTargetAtTime(0.0001, off, 0.03);
      o.start(t);
      o.stop(off + 0.2);
      cleanup(o, [o, lp, g]);
    },
    sub(out, t, m, dur, v) {
      const f = hz(m);
      const o = osc('sine', f, t), o2 = osc('sawtooth', f, t), g2 = gain(0.18), lp = filt('lowpass', 900, 1), g = gain(0);
      o.connect(g);
      o2.connect(g2);
      g2.connect(lp);
      lp.connect(g);
      g.connect(out);
      const end = adsr(g.gain, t, 0.003, 0.1, 0.8, 0.04, dur * 0.85, 0.4 * v);
      o.start(t);
      o2.start(t);
      o.stop(end);
      o2.stop(end);
      cleanup(o, [o, o2, g2, lp, g]);
    },
    pad(out, t, m, dur, v) {
      const f = hz(m);
      const g = gain(0), lp = filt('lowpass', 1500, 0.4);
      const os = [-9, 0, 9].map((c) => osc('sawtooth', f * Math.pow(2, c / 1200), t));
      for (const o of os) o.connect(lp);
      lp.connect(g);
      g.connect(out);
      const end = adsr(g.gain, t, 0.3, 0.5, 0.8, 0.5, dur, 0.06 * v);
      for (const o of os) {
        o.start(t);
        o.stop(end);
      }
      cleanup(os[0], os.concat([lp, g]));
    },
    brass(out, t, m, dur, v) {
      const f = hz(m);
      const o1 = osc('sawtooth', f * 0.997, t), o2 = osc('sawtooth', f * 1.003, t);
      const lp = filt('lowpass', 1800, 1.5), g = gain(0);
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.linearRampToValueAtTime(3000, t + 0.05);
      lp.frequency.setTargetAtTime(1700, t + 0.05, 0.15);
      o1.connect(lp);
      o2.connect(lp);
      lp.connect(g);
      g.connect(out);
      const end = adsr(g.gain, t, 0.02, 0.2, 0.75, 0.1, dur, 0.13 * v);
      o1.start(t);
      o2.start(t);
      o1.stop(end);
      o2.stop(end);
      cleanup(o1, [o1, o2, lp, g]);
    },
    arp(out, t, m, dur, v) {
      const o = osc('square', hz(m), t), lp = filt('lowpass', 2400, 3), g = gain(0);
      lp.frequency.setValueAtTime(4000, t);
      lp.frequency.setTargetAtTime(1200, t, 0.06);
      o.connect(lp);
      lp.connect(g);
      g.connect(out);
      const end = perc(g.gain, t, 0.12 * v, 0.07);
      o.start(t);
      o.stop(end);
      cleanup(o, [o, lp, g]);
    },
    // ---- drums ---------------------------------------------------------------
    kick(out, t, m, dur, v) {
      const o = osc('sine', 160, t), g = gain(0);
      o.frequency.setValueAtTime(165, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
      o.connect(g);
      g.connect(out);
      const end = perc(g.gain, t, 0.95 * v, 0.07, 0.001);
      o.start(t);
      o.stop(end);
      const n = noise(t, 0.02), hp = filt('highpass', 1800), ng = gain(0);
      perc(ng.gain, t, 0.25 * v, 0.004, 0.0005);
      n.connect(hp);
      hp.connect(ng);
      ng.connect(out);
      cleanup(o, [o, g]);
      cleanup(n, [n, hp, ng]);
    },
    snare(out, t, m, dur, v) {
      const n = noise(t, 0.3), hp = filt('highpass', 900), bp = filt('bandpass', 2300, 0.7), g = gain(0);
      n.connect(hp);
      hp.connect(bp);
      bp.connect(g);
      g.connect(out);
      perc(g.gain, t, 0.6 * v, 0.055, 0.001);
      const o = osc('triangle', 190, t), og = gain(0);
      o.frequency.setTargetAtTime(160, t, 0.04);
      o.connect(og);
      og.connect(out);
      const end = perc(og.gain, t, 0.35 * v, 0.03, 0.001);
      o.start(t);
      o.stop(end);
      cleanup(n, [n, hp, bp, g]);
      cleanup(o, [o, og]);
    },
    clap(out, t, m, dur, v) {
      const n = noise(t, 0.3), bp = filt('bandpass', 1300, 1.1), g = gain(0);
      n.connect(bp);
      bp.connect(g);
      g.connect(out);
      const p = g.gain;
      p.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) {
        p.linearRampToValueAtTime(0.5 * v, t + i * 0.011 + 0.001);
        p.linearRampToValueAtTime(0.08 * v, t + i * 0.011 + 0.009);
      }
      p.linearRampToValueAtTime(0.42 * v, t + 0.035);
      p.setTargetAtTime(0.0001, t + 0.036, 0.045);
      cleanup(n, [n, bp, g]);
    },
    hat(out, t, m, dur, v) {
      const n = noise(t, 0.08), hp = filt('highpass', 7400), g = gain(0);
      n.connect(hp);
      hp.connect(g);
      g.connect(out);
      perc(g.gain, t, 0.22 * v, 0.012, 0.0005);
      cleanup(n, [n, hp, g]);
    },
    ohat(out, t, m, dur, v) {
      const n = noise(t, 0.4), hp = filt('highpass', 6600), g = gain(0);
      n.connect(hp);
      hp.connect(g);
      g.connect(out);
      perc(g.gain, t, 0.2 * v, 0.07, 0.001);
      cleanup(n, [n, hp, g]);
    },
    crash(out, t, m, dur, v) {
      const n = noise(t, 1.8), hp = filt('highpass', 3800), g = gain(0);
      n.connect(hp);
      hp.connect(g);
      g.connect(out);
      perc(g.gain, t, 0.24 * v, 0.38, 0.001);
      cleanup(n, [n, hp, g]);
    },
    shaker(out, t, m, dur, v) {
      const n = noise(t, 0.08), bp = filt('bandpass', 6200, 1.2), g = gain(0);
      n.connect(bp);
      bp.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16 * v, t + 0.012);
      g.gain.setTargetAtTime(0.0001, t + 0.014, 0.014);
      cleanup(n, [n, bp, g]);
    },
    tom(out, t, m, dur, v, opt) {
      const p = (opt && opt.pitch) || 140;
      const o = osc('sine', p, t), g = gain(0);
      o.frequency.exponentialRampToValueAtTime(p * 0.6, t + 0.2);
      o.connect(g);
      g.connect(out);
      const end = perc(g.gain, t, 0.6 * v, 0.07, 0.001);
      o.start(t);
      o.stop(end);
      cleanup(o, [o, g]);
    },
    taiko(out, t, m, dur, v) {
      const o = osc('sine', 98, t), g = gain(0);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.25);
      o.connect(g);
      g.connect(out);
      const end = perc(g.gain, t, 0.85 * v, 0.12, 0.001);
      o.start(t);
      o.stop(end);
      const n = noise(t, 0.1), lp = filt('lowpass', 600), ng = gain(0);
      perc(ng.gain, t, 0.35 * v, 0.02, 0.001);
      n.connect(lp);
      lp.connect(ng);
      ng.connect(out);
      cleanup(o, [o, g]);
      cleanup(n, [n, lp, ng]);
    },
    wood(out, t, m, dur, v, opt) {
      const p = (opt && opt.pitch) || 1100;
      const o = osc('sine', p, t), g = gain(0);
      o.frequency.setTargetAtTime(p * 0.85, t, 0.02);
      o.connect(g);
      g.connect(out);
      const end = perc(g.gain, t, 0.3 * v, 0.018, 0.0005);
      o.start(t);
      o.stop(end);
      cleanup(o, [o, g]);
    },
    rim(out, t, m, dur, v) {
      const o = osc('square', 1700, t), bp = filt('bandpass', 2000, 2), g = gain(0);
      o.connect(bp);
      bp.connect(g);
      g.connect(out);
      const end = perc(g.gain, t, 0.22 * v, 0.008, 0.0005);
      o.start(t);
      o.stop(end);
      cleanup(o, [o, bp, g]);
    },
  };
  const DRUMS = new Set(['kick', 'snare', 'clap', 'hat', 'ohat', 'crash', 'shaker', 'tom', 'taiko', 'wood', 'rim']);

  // ---- notation parsing ----------------------------------------------------
  const CHORD_IV = {
    '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim: [0, 3, 6], dim7: [0, 3, 6, 9],
    m7b5: [0, 3, 6, 10], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], add9: [0, 4, 7, 14],
    madd9: [0, 3, 7, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], 5: [0, 7],
  };
  function noteMidi(tok) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
    if (!m) return null;
    let n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 12 * (+m[3] + 1) + n;
  }
  function chordRoot(sym) {
    const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
    if (!m) return null;
    return { root: NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), q: m[3] };
  }
  // voice a chord symbol near a centre note
  function chordNotes(sym, center) {
    const c = chordRoot(sym);
    if (!c) return [];
    const iv = CHORD_IV[c.q] || CHORD_IV[''];
    const lo = center - 5;
    const out = [];
    for (const i of iv) {
      let n = 12 * 4 + c.root + i;
      while (n < lo) n += 12;
      while (n > lo + 15) n -= 12;
      if (!out.includes(n)) out.push(n);
    }
    return out.sort((a, b) => a - b);
  }
  function expand(str) {
    let prev;
    do {
      prev = str;
      str = str.replace(/\(([^()]*)\)x(\d+)/g, (_, body, n) => (' ' + body + ' ').repeat(+n));
    } while (str !== prev);
    return str;
  }
  function parseMelodic(str, center) {
    const toks = expand(str).replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
    const ev = [];
    let step = 0, last = null;
    for (const tk of toks) {
      let [body, lenS] = tk.split(':');
      const len = lenS ? parseFloat(lenS) : 1;
      let vel = 0.8;
      if (body.endsWith('!')) {
        vel = 1;
        body = body.slice(0, -1);
      } else if (body.endsWith('?')) {
        vel = 0.5;
        body = body.slice(0, -1);
      }
      if (body === '.') {
        step += len;
        last = null;
        continue;
      }
      if (body === '-') {
        if (last) last.len += len;
        step += len;
        continue;
      }
      let notes;
      if (body[0] === '@') notes = chordNotes(body.slice(1), center);
      else notes = body.split('+').map(noteMidi).filter((n) => n !== null);
      last = { s: step, notes, len, v: vel };
      ev.push(last);
      step += len;
    }
    return { ev, len: step };
  }
  function parseDrum(str) {
    const s = expand(str).replace(/[\s|]/g, '');
    const ev = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const v = ch === 'X' ? 1 : ch === 'x' ? 0.78 : ch === 'g' ? 0.38 : ch === 'o' ? 0.6 : 0;
      if (v > 0) ev.push({ s: i, notes: [0], len: 1, v });
    }
    return { ev, len: s.length };
  }
  // chord list "C G Am:8 F:8" -> [{sym, s, len}]
  function parseChords(str) {
    const out = [];
    let s = 0;
    for (const tk of expand(str).replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean)) {
      const [sym, l] = tk.split(':');
      const len = l ? +l : 16;
      if (sym !== '.') out.push({ sym, s, len });
      s += len;
    }
    return out;
  }
  const BASS_STYLES = {
    root8: [[0, 2, 'R'], [2, 2, 'R'], [4, 2, 'R'], [6, 2, 'R'], [8, 2, 'R'], [10, 2, 'R'], [12, 2, 'R'], [14, 2, 'R']],
    octave8: [[0, 2, 'R'], [2, 2, 'O'], [4, 2, 'R'], [6, 2, 'O'], [8, 2, 'R'], [10, 2, 'O'], [12, 2, 'R'], [14, 2, 'O']],
    disco: [[0, 1, 'R'], [2, 2, 'O'], [4, 1, 'R'], [6, 2, 'O'], [8, 1, 'R'], [10, 2, 'O'], [12, 1, 'R'], [14, 2, 'O']],
    funk: [[0, 2, 'R'], [3, 1, 'R'], [6, 1, 'O'], [7, 1, 'R'], [10, 2, '5'], [12, 1, '7'], [14, 2, 'O']],
    rock: [[0, 3, 'R'], [3, 1, 'R'], [4, 2, 'R'], [6, 2, '5'], [8, 3, 'R'], [11, 1, 'R'], [12, 2, '5'], [14, 2, 'O']],
    walk: [[0, 4, 'R'], [4, 4, '3'], [8, 4, '5'], [12, 4, 'A']],
    synth: Array.from({ length: 16 }, (_, i) => [i, 1, i % 4 === 2 ? 'O' : 'R']),
    half: [[0, 8, 'R'], [8, 8, '5']],
    bounce: [[0, 3, 'R'], [4, 2, '5'], [6, 2, 'O'], [8, 3, 'R'], [12, 2, '5'], [14, 2, 'O']],
    pedal: [[0, 4, 'R'], [6, 2, 'R'], [8, 4, 'R'], [14, 2, 'R']],
  };
  function genBass(chords, style, oct) {
    const tpl = BASS_STYLES[style] || BASS_STYLES.root8;
    const ev = [];
    chords.forEach((c, ci) => {
      const cr = chordRoot(c.sym);
      if (!cr) return;
      const iv = CHORD_IV[cr.q] || CHORD_IV[''];
      const root = 12 * (oct + 1) + cr.root;
      const next = chords[ci + 1] ? chordRoot(chords[ci + 1].sym) : cr;
      for (let rep = 0; rep < c.len; rep += 16) {
        for (const [st, len, deg] of tpl) {
          if (rep + st >= c.len) continue;
          let n = root;
          if (deg === 'O') n = root + 12;
          else if (deg === '5') n = root + 7;
          else if (deg === '3') n = root + iv[1];
          else if (deg === '7') n = root + (iv[3] !== undefined ? iv[3] : 10);
          else if (deg === 'A') n = 12 * (oct + 1) + next.root - 1;
          ev.push({ s: c.s + rep + st, notes: [n], len: Math.min(len, c.len - rep - st), v: st % 4 === 0 ? 0.9 : 0.72 });
        }
      }
    });
    return ev;
  }
  function genPad(chords, center) {
    return chords.map((c) => ({ s: c.s, notes: chordNotes(c.sym, center), len: c.len, v: 0.8 }));
  }
  const COMP_STYLES = {
    offbeat: [[2, 2], [6, 2], [10, 2], [14, 2]],
    charleston: [[0, 3], [6, 2], [8, 3], [14, 2]],
    stab: [[0, 2], [3, 1], [6, 2], [10, 2], [12, 1], [14, 2]],
    half: [[0, 8], [8, 8]],
    pulse: [[0, 2], [4, 2], [8, 2], [12, 2]],
    swing: [[0, 3], [5, 2], [10, 3], [13, 2]],
    chug8: [[0, 1], [2, 1], [4, 1], [6, 1], [8, 1], [10, 1], [12, 1], [14, 1]],
  };
  function genComp(chords, center, style) {
    const tpl = COMP_STYLES[style] || COMP_STYLES.offbeat;
    const ev = [];
    for (const c of chords) {
      const notes = chordNotes(c.sym, center);
      for (let rep = 0; rep < c.len; rep += 16) {
        for (const [st, len] of tpl) if (rep + st < c.len) ev.push({ s: c.s + rep + st, notes, len, v: st % 4 === 0 ? 0.85 : 0.7 });
      }
    }
    return ev;
  }
  function genArp(chords, center, mode, rate, span) {
    const ev = [];
    for (const c of chords) {
      const base = chordNotes(c.sym, center);
      let notes = base.slice();
      for (let k = 1; k < span; k++) notes = notes.concat(base.map((n) => n + 12 * k));
      let seq = notes;
      if (mode === 'down') seq = notes.slice().reverse();
      else if (mode === 'updown') seq = notes.concat(notes.slice(1, -1).reverse());
      let i = 0;
      for (let st = 0; st < c.len; st += rate) {
        const n = mode === 'random' ? notes[Math.floor(U.hash(c.s + st) * notes.length)] : seq[i++ % seq.length];
        ev.push({ s: c.s + st, notes: [n], len: rate, v: st % 4 === 0 ? 0.85 : 0.65 });
      }
    }
    return ev;
  }

  // compile a song once (events grouped by step for every pattern)
  function compile(song) {
    if (song.__c) return song.__c;
    const pats = {};
    for (const pn in song.patterns) {
      const P = song.patterns[pn];
      const len = (P.bars || 4) * 16;
      const chords = P.chords ? parseChords(P.chords) : [];
      const byStep = Array.from({ length: len }, () => []);
      for (const tn in song.tracks) {
        const T = song.tracks[tn];
        const val = P[tn];
        if (!val) continue;
        let ev;
        const center = T.center || 60;
        if (DRUMS.has(T.inst)) ev = parseDrum(val).ev;
        else if (val === 'chords') {
          if (T.arp) ev = genArp(chords, center, T.arp, T.rate || 1, T.span || 2);
          else if (T.comp) ev = genComp(chords, center, T.comp);
          else ev = genPad(chords, center);
        } else if (val.startsWith('gen:')) ev = genBass(chords, val.slice(4), T.oct || 2);
        else ev = parseMelodic(val, center).ev;
        for (const e of ev) {
          const st = Math.floor(e.s);
          if (st >= 0 && st < len) byStep[st].push({ tn, e, frac: e.s - st });
        }
      }
      pats[pn] = { len, byStep };
    }
    song.__c = pats;
    return pats;
  }

  // ---- sequencer ---------------------------------------------------------------
  let seq = null; // active song player
  let timer = null;

  function startScheduler() {
    if (timer) return;
    timer = setInterval(tick, 25);
  }

  function makePlayer(id, song, loop) {
    const out = gain(0);
    out.connect(musicBus);
    const now = ctx.currentTime;
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(song.vol || 1, now + 0.25);
    const rev = gain(1), del = gain(1);
    rev.connect(revIn);
    del.connect(delIn);
    const chans = {};
    for (const tn in song.tracks) {
      const T = song.tracks[tn];
      const g = gain(T.vol !== undefined ? T.vol : 0.5);
      let node = g;
      if (ctx.createStereoPanner && T.pan) {
        const p = ctx.createStereoPanner();
        p.pan.value = T.pan;
        g.connect(p);
        node = p;
      }
      node.connect(out);
      if (T.rev) {
        const s = gain(T.rev);
        g.connect(s);
        s.connect(rev);
      }
      if (T.del) {
        const s = gain(T.del);
        g.connect(s);
        s.connect(del);
      }
      chans[tn] = g;
    }
    const spb = 60 / song.bpm / 4;
    delay.delayTime.setTargetAtTime(spb * 3, now, 0.05);
    return { id, song, pats: compile(song), out, rev, del, chans, loop, order: 0, step: 0, next: now + 0.08, spb, done: false };
  }

  function tick() {
    if (!ctx || !seq) return;
    const horizon = ctx.currentTime + 0.14;
    const p = seq;
    while (!p.done && p.next < horizon) {
      const song = p.song;
      const pn = song.order[p.order];
      const pat = p.pats[pn];
      if (!pat) {
        p.done = true;
        break;
      }
      const evs = pat.byStep[p.step];
      for (const { tn, e, frac } of evs) {
        const T = song.tracks[tn];
        let t = p.next + frac * p.spb;
        const sw8 = T.swing8 !== undefined ? T.swing8 : song.swing8 || 0;
        const sw16 = song.swing16 || 0;
        if (sw8 && p.step % 4 === 2) t += sw8 * 2 * p.spb;
        if (sw16 && p.step % 2 === 1) t += sw16 * p.spb;
        const dur = e.len * p.spb;
        const fn = INST[T.inst];
        if (!fn) continue;
        const v = e.v * (T.velMul || 1);
        for (const n of e.notes) {
          try {
            fn(p.chans[tn], t, n + (T.transpose || 0), dur, v, T);
          } catch (err) {
            /* never let a voice error stop the music */
          }
        }
      }
      p.next += p.spb;
      p.step++;
      if (p.step >= pat.len) {
        p.step = 0;
        p.order++;
        if (p.order >= song.order.length) {
          if (p.loop) p.order = song.loop || 0;
          else p.done = true;
        }
      }
    }
    if (p.done && !p.ended) {
      p.ended = true;
      const end = p.next + 2.5;
      setTimeout(() => {
        if (seq === p) {
          seq = null;
          S.current = null;
        }
        disposePlayer(p, 0);
      }, Math.max(0, (end - ctx.currentTime) * 1000));
    }
  }

  function disposePlayer(p, fade) {
    if (!p || p.disposed) return;
    p.disposed = true;
    const now = ctx.currentTime;
    p.out.gain.cancelScheduledValues(now);
    p.out.gain.setValueAtTime(p.out.gain.value, now);
    p.out.gain.linearRampToValueAtTime(0, now + fade + 0.01);
    p.rev.gain.setTargetAtTime(0, now, fade / 3 + 0.01);
    p.del.gain.setTargetAtTime(0, now, fade / 3 + 0.01);
    p.done = true;
    setTimeout(() => {
      try {
        p.out.disconnect();
        p.rev.disconnect();
        p.del.disconnect();
        for (const k in p.chans) p.chans[k].disconnect();
      } catch (e) {
        /* ignore */
      }
    }, (fade + 3) * 1000);
  }

  S.playSong = function (id, opts = {}) {
    if (!ctx) {
      pending = { id, opts };
      S.current = id;
      return;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const song = typeof SONGS !== 'undefined' ? SONGS[id] : null;
    if (!song) return;
    if (seq && seq.id === id && !seq.done) return;
    if (seq) disposePlayer(seq, 0.4);
    const loop = opts.loop !== undefined ? opts.loop : !song.once;
    seq = makePlayer(id, song, loop);
    S.current = id;
    startScheduler();
  };

  S.stopSong = function (fade = 0.5) {
    pending = null;
    if (seq) disposePlayer(seq, fade);
    seq = null;
    S.current = null;
  };

  // ---- sound effects --------------------------------------------------------------
  const lastPlayed = {};
  function sweep(type, f0, f1, t, dur, vol, out, opts = {}) {
    const o = osc(type, f0, t), g = gain(0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + (opts.sweep || dur));
    let node = o;
    if (opts.lp) {
      const lp = filt('lowpass', opts.lp, opts.q || 1);
      o.connect(lp);
      node = lp;
    }
    node.connect(g);
    g.connect(out);
    const end = opts.hold ? adsr(g.gain, t, opts.a || 0.005, dur * 0.4, 0.7, dur * 0.4, dur * 0.6, vol) : perc(g.gain, t, vol, dur / 4, opts.a || 0.002);
    o.start(t);
    o.stop(end);
    cleanup(o, node === o ? [o, g] : [o, node, g]);
    return o;
  }
  function nz(t, dur, vol, out, type, f0, f1, q = 1, a = 0.002) {
    const n = noise(t, dur * 1.5), f = filt(type, f0, q), g = gain(0);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    n.connect(f);
    f.connect(g);
    g.connect(out);
    perc(g.gain, t, vol, dur / 4, a);
    cleanup(n, [n, f, g]);
  }
  function crunch(t, out, vol) {
    const o = osc('square', 85, t), ws = ctx.createWaveShaper(), g = gain(0);
    ws.curve = distCurve;
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    o.connect(ws);
    ws.connect(g);
    g.connect(out);
    const end = perc(g.gain, t, vol, 0.03);
    o.start(t);
    o.stop(end);
    cleanup(o, [o, ws, g]);
  }
  function bellNote(t, f, vol, out, tau = 0.3) {
    const car = osc('sine', f, t), mod = osc('sine', f * 3.5, t), mg = gain(f * 1.5), g = gain(0);
    mg.gain.setTargetAtTime(0, t, tau * 0.5);
    mod.connect(mg);
    mg.connect(car.frequency);
    car.connect(g);
    g.connect(out);
    const end = perc(g.gain, t, vol, tau);
    car.start(t);
    mod.start(t);
    car.stop(end);
    mod.stop(end);
    cleanup(car, [car, mod, mg, g]);
  }

  const SFX = {
    hitL(t, o, k) {
      nz(t, 0.07, 0.5, o, 'bandpass', 2600 * k, 1100 * k, 1.2);
      sweep('sine', 320 * k, 110, t, 0.08, 0.55, o);
    },
    hitM(t, o, k) {
      nz(t, 0.1, 0.55, o, 'bandpass', 2000 * k, 700, 1);
      sweep('sine', 240 * k, 70, t, 0.12, 0.7, o);
      crunch(t, o, 0.12);
    },
    hitH(t, o, k) {
      nz(t, 0.16, 0.65, o, 'lowpass', 3600 * k, 450, 0.8);
      sweep('sine', 180 * k, 42, t, 0.24, 0.9, o);
      crunch(t, o, 0.22);
      nz(t + 0.01, 0.3, 0.12, sfxRev, 'lowpass', 1800, 600);
    },
    hitX(t, o, k) {
      sweep('sine', 150 * k, 32, t, 0.5, 1, o, { sweep: 0.35 });
      nz(t, 0.45, 0.7, o, 'lowpass', 5000, 300, 0.7);
      crunch(t, o, 0.3);
      sweep('triangle', 1760, 880, t, 0.6, 0.12, sfxRev);
      nz(t, 0.8, 0.3, sfxRev, 'highpass', 3000, 1500);
    },
    block(t, o, k) {
      nz(t, 0.05, 0.4, o, 'highpass', 2400 * k, 1800);
      sweep('square', 980 * k, 760, t, 0.06, 0.12, o, { lp: 3000 });
      sweep('sine', 200, 120, t, 0.06, 0.4, o);
    },
    whiffL(t, o, k) {
      nz(t, 0.09, 0.22, o, 'bandpass', 700 * k, 2600 * k, 1.5, 0.02);
    },
    whiffH(t, o, k) {
      nz(t, 0.17, 0.3, o, 'bandpass', 380 * k, 1700 * k, 1.4, 0.04);
    },
    clash(t, o) {
      sweep('square', 1250, 1180, t, 0.25, 0.08, o, { lp: 5000 });
      sweep('square', 1870, 1820, t, 0.25, 0.06, o, { lp: 5000 });
      nz(t, 0.12, 0.3, o, 'highpass', 3000, 2000);
    },
    armor(t, o) {
      for (const f of [523, 787, 1247, 1661]) sweep('square', f, f * 0.98, t, 0.32, 0.05, o, { lp: 4000 });
      nz(t, 0.05, 0.35, o, 'bandpass', 3000, 2000);
      sweep('sine', 160, 80, t, 0.12, 0.5, o);
    },
    grab(t, o) {
      nz(t, 0.13, 0.4, o, 'lowpass', 1200, 400);
      sweep('sine', 140, 70, t, 0.14, 0.5, o);
    },
    tech(t, o) {
      bellNote(t, 1760, 0.22, o, 0.12);
      bellNote(t + 0.04, 2637, 0.16, o, 0.1);
      nz(t, 0.08, 0.3, o, 'highpass', 4000, 3000);
    },
    thud(t, o) {
      sweep('sine', 100, 38, t, 0.2, 0.75, o);
      nz(t, 0.14, 0.35, o, 'lowpass', 500, 200);
    },
    counter(t, o) {
      sweep('square', 400, 1300, t, 0.14, 0.1, o, { lp: 3000, sweep: 0.1 });
      bellNote(t + 0.08, 1568, 0.18, o, 0.15);
    },
    jump(t, o, k) {
      sweep('triangle', 260 * k, 640 * k, t, 0.12, 0.28, o, { sweep: 0.08 });
    },
    land(t, o) {
      sweep('sine', 130, 60, t, 0.07, 0.35, o);
      nz(t, 0.06, 0.12, o, 'lowpass', 900, 300);
    },
    dash(t, o) {
      nz(t, 0.14, 0.3, o, 'bandpass', 500, 2200, 1.2, 0.02);
    },
    whoosh(t, o) {
      nz(t, 0.35, 0.28, o, 'bandpass', 300, 2000, 1.3, 0.08);
    },
    round(t, o) {
      for (const [f, a] of [[110, 0.5], [165, 0.25], [247, 0.16], [331, 0.1]]) sweep('sine', f, f * 0.985, t, 1.6, a, o);
      nz(t, 0.08, 0.4, o, 'lowpass', 2000, 800);
      nz(t, 1.2, 0.1, sfxRev, 'highpass', 3000, 2000);
    },
    fight(t, o) {
      for (const f of [523, 659, 784, 1047]) sweep('sawtooth', f, f, t, 0.5, 0.06, o, { lp: 3500, hold: true });
      nz(t, 0.9, 0.3, o, 'highpass', 4000, 3000);
      sweep('sine', 130, 50, t, 0.3, 0.7, o);
    },
    ko(t, o) {
      sweep('sine', 90, 28, t, 1.0, 1, o, { sweep: 0.8 });
      nz(t, 0.8, 0.7, o, 'lowpass', 3000, 150, 0.7);
      crunch(t, o, 0.35);
      nz(t, 1.6, 0.35, sfxRev, 'bandpass', 1200, 300, 0.8);
      sweep('triangle', 880, 440, t + 0.05, 1.2, 0.1, sfxRev);
    },
    perfect(t, o) {
      [1047, 1319, 1568, 2093, 2637].forEach((f, i) => bellNote(t + i * 0.07, f, 0.16, o, 0.3));
    },
    tick(t, o) {
      sweep('square', 1500, 1400, t, 0.03, 0.08, o, { lp: 4000 });
    },
    super(t, o) {
      sweep('sawtooth', 180, 1500, t, 0.7, 0.12, o, { lp: 2500, sweep: 0.6, hold: true });
      nz(t, 0.6, 0.25, o, 'bandpass', 400, 4000, 1.5, 0.3);
      [1319, 1568, 2093].forEach((f, i) => bellNote(t + 0.35 + i * 0.06, f, 0.14, sfxRev, 0.25));
    },
    meterFull(t, o) {
      bellNote(t, 1319, 0.18, o, 0.25);
      bellNote(t + 0.08, 1976, 0.16, o, 0.3);
    },
    menuMove(t, o) {
      sweep('triangle', 880, 880, t, 0.05, 0.16, o);
    },
    menuOk(t, o) {
      sweep('square', 660, 660, t, 0.06, 0.07, o, { lp: 3000 });
      sweep('square', 990, 990, t + 0.06, 0.08, 0.07, o, { lp: 3000 });
    },
    menuBack(t, o) {
      sweep('triangle', 600, 380, t, 0.1, 0.18, o);
    },
    select(t, o) {
      for (const f of [523, 659, 784]) sweep('sawtooth', f, f, t, 0.25, 0.05, o, { lp: 3000 });
      bellNote(t + 0.05, 1568, 0.18, o, 0.3);
      sweep('sine', 160, 60, t, 0.15, 0.5, o);
    },
    start(t, o) {
      [523, 659, 784, 1047, 1319].forEach((f, i) => bellNote(t + i * 0.055, f, 0.15, o, 0.25));
      nz(t, 0.6, 0.18, o, 'highpass', 5000, 3000);
    },
    skate(t, o) {
      nz(t, 0.35, 0.25, o, 'lowpass', 400, 250, 0.8, 0.03);
      sweep('square', 300, 280, t, 0.03, 0.06, o, { lp: 2000 });
      sweep('square', 300, 280, t + 0.09, 0.03, 0.05, o, { lp: 2000 });
    },
    puff(t, o) {
      nz(t, 0.18, 0.35, o, 'lowpass', 1400, 400, 0.7, 0.02);
      sweep('sine', 500, 900, t, 0.08, 0.15, o);
    },
    pop(t, o, k) {
      sweep('sine', 500 * k, 1500 * k, t, 0.05, 0.35, o, { sweep: 0.04 });
    },
    boing(t, o) {
      const x = sweep('sine', 260, 640, t, 0.3, 0.32, o, { sweep: 0.25 });
      const l = osc('sine', 18, t), lg = gain(40);
      l.connect(lg);
      lg.connect(x.frequency);
      l.start(t);
      l.stop(t + 0.35);
      cleanup(l, [l, lg]);
    },
    candy(t, o) {
      [2093, 2637, 3136].forEach((f, i) => bellNote(t + i * 0.04, f, 0.11, o, 0.18));
    },
    heart(t, o) {
      sweep('sine', 700, 1500, t, 0.14, 0.25, o, { sweep: 0.12 });
    },
    laser(t, o) {
      sweep('square', 1900, 180, t, 0.16, 0.12, o, { lp: 5000, sweep: 0.14 });
      sweep('sawtooth', 2400, 300, t, 0.12, 0.05, o, { sweep: 0.12 });
    },
    zap(t, o) {
      for (let i = 0; i < 4; i++) nz(t + i * 0.035, 0.03, 0.3, o, 'bandpass', 3000 + Math.random() * 2000, 1500);
      sweep('sawtooth', 70, 60, t, 0.2, 0.1, o, { lp: 1200 });
    },
    charge(t, o) {
      sweep('sine', 200, 900, t, 0.5, 0.22, o, { sweep: 0.5, hold: true });
      sweep('square', 400, 1800, t, 0.5, 0.04, o, { sweep: 0.5, lp: 2000, hold: true });
    },
    rocket(t, o) {
      nz(t, 0.4, 0.4, o, 'lowpass', 600, 1500, 1, 0.05);
      sweep('sawtooth', 120, 260, t, 0.35, 0.08, o, { lp: 900 });
    },
    beam(t, o) {
      for (const f of [220, 330, 440]) sweep('sawtooth', f, f * 1.02, t, 1.3, 0.05, o, { lp: 2500, hold: true });
      nz(t, 1.2, 0.3, o, 'bandpass', 1200, 900, 1, 0.05);
      sweep('sine', 100, 40, t, 0.4, 0.6, o);
    },
    shuriken(t, o) {
      nz(t, 0.1, 0.25, o, 'highpass', 5000, 7000);
      sweep('sine', 3200, 2600, t, 0.12, 0.12, o);
    },
    teleport(t, o) {
      const x = sweep('sine', 1400, 180, t, 0.28, 0.25, o, { sweep: 0.26 });
      const l = osc('sine', 30, t), lg = gain(120);
      l.connect(lg);
      lg.connect(x.frequency);
      l.start(t);
      l.stop(t + 0.3);
      cleanup(l, [l, lg]);
      nz(t, 0.2, 0.25, o, 'lowpass', 1200, 300);
    },
    slash(t, o) {
      nz(t, 0.11, 0.4, o, 'bandpass', 3800, 1200, 1.4, 0.005);
      sweep('sine', 2400, 1800, t, 0.08, 0.08, o);
    },
    stomp(t, o) {
      sweep('sine', 80, 28, t, 0.45, 1, o, { sweep: 0.3 });
      nz(t, 0.45, 0.5, o, 'lowpass', 400, 120, 0.8);
      crunch(t, o, 0.2);
    },
    slam(t, o) {
      sweep('sine', 110, 30, t, 0.5, 1, o, { sweep: 0.35 });
      nz(t, 0.4, 0.6, o, 'lowpass', 2400, 200, 0.7);
      crunch(t, o, 0.3);
    },
    cane(t, o) {
      sweep('sine', 950, 520, t, 0.06, 0.4, o, { sweep: 0.04 });
      nz(t, 0.04, 0.25, o, 'bandpass', 1400, 1100, 3);
    },
    sip(t, o) {
      const n = noise(t, 0.5), f = filt('bandpass', 700, 4), g = gain(0);
      f.frequency.exponentialRampToValueAtTime(2200, t + 0.45);
      n.connect(f);
      f.connect(g);
      g.connect(o);
      g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < 6; i++) {
        g.gain.linearRampToValueAtTime(0.25, t + i * 0.07 + 0.03);
        g.gain.linearRampToValueAtTime(0.05, t + i * 0.07 + 0.065);
      }
      g.gain.setTargetAtTime(0.0001, t + 0.45, 0.03);
      cleanup(n, [n, f, g]);
    },
    heal(t, o) {
      [880, 1109, 1319, 1760].forEach((f, i) => bellNote(t + i * 0.06, f, 0.13, o, 0.3));
    },
    yarn(t, o) {
      nz(t, 0.3, 0.2, o, 'lowpass', 600, 300, 0.8, 0.04);
    },
    gong(t, o) {
      for (const [f, a] of [[82, 0.5], [131, 0.3], [197, 0.2], [283, 0.12], [409, 0.06]]) sweep('sine', f, f * 0.99, t, 2.2, a, o);
      nz(t, 1.5, 0.12, sfxRev, 'bandpass', 600, 400);
    },
    cheer(t, o) {
      const n = noise(t, 1.0), f = filt('bandpass', 1100, 0.6), g = gain(0);
      n.connect(f);
      f.connect(g);
      g.connect(o);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.15);
      for (let i = 0; i < 10; i++) g.gain.linearRampToValueAtTime(0.18 + Math.random() * 0.14, t + 0.2 + i * 0.07);
      g.gain.setTargetAtTime(0.0001, t + 0.9, 0.15);
      cleanup(n, [n, f, g]);
    },
    bell(t, o, k) {
      bellNote(t, 1320 * k, 0.2, o, 0.35);
    },
  };

  S.sfx = function (name, opts) {
    if (!ctx || !sVol) return;
    const fn = SFX[name];
    if (!fn) return;
    const now = ctx.currentTime;
    // limit how often the same sound can retrigger
    if (lastPlayed[name] && now - lastPlayed[name] < 0.025) return;
    lastPlayed[name] = now;
    const vol = opts && opts.vol !== undefined ? opts.vol : 1;
    const k = opts && opts.pitch ? opts.pitch : 1;
    let out = sfxBus;
    let g = null;
    if (vol !== 1 || (opts && opts.pan)) {
      g = gain(vol);
      let node = g;
      if (opts && opts.pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = opts.pan;
        g.connect(p);
        node = p;
      }
      node.connect(sfxBus);
      out = g;
      setTimeout(() => {
        try {
          g.disconnect();
        } catch (e) {
          /* ignore */
        }
      }, 3000);
    }
    try {
      fn(now + 0.005, out, k);
    } catch (e) {
      /* ignore */
    }
  };

  // ---- offline rendering (tests) ----------------------------------------------------
  S.renderOffline = async function (id, seconds = 20) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const sr = 44100;
    const oc = new OAC(2, sr * seconds, sr);
    const saved = { ctx, seq, mVol, sVol, master, comp, musicBus, sfxBus, musicVol, sfxVol, duckGain, reverb, revIn, sfxRev, delay, delIn, delFb, noiseBuf, pulse25, pulse12, distCurve };
    ctx = oc;
    build(oc);
    musicVol.gain.value = 0.62;
    sfxVol.gain.value = 0.9;
    seq = null;
    const song = SONGS[id];
    if (id.startsWith('sfx:')) {
      const names = id.slice(4).split(',');
      names.forEach((n, i) => SFX[n] && SFX[n](0.05 + i * 0.7, sfxBus, 1));
    } else {
      // schedule the whole render window up-front
      seq = makePlayer(id, song, true);
      seq.next = 0.05;
      tickOffline(seq, seconds);
    }
    const buf = await oc.startRendering();
    // restore
    ({ ctx, seq, mVol, sVol, master, comp, musicBus, sfxBus, musicVol, sfxVol, duckGain, reverb, revIn, sfxRev, delay, delIn, delFb, noiseBuf, pulse25, pulse12, distCurve } = saved);
    let peak = 0, sum = 0, nan = 0;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const v = d[i];
        if (v !== v) nan++;
        const a = Math.abs(v);
        if (a > peak) peak = a;
        sum += v * v;
      }
    }
    return { id, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / (buf.length * 2)).toFixed(4), nan, seconds };
  };
  function tickOffline(p, horizon) {
    const song = p.song;
    while (!p.done && p.next < horizon) {
      const pn = song.order[p.order];
      const pat = p.pats[pn];
      for (const { tn, e, frac } of pat.byStep[p.step]) {
        const T = song.tracks[tn];
        let t = p.next + frac * p.spb;
        const sw8 = T.swing8 !== undefined ? T.swing8 : song.swing8 || 0;
        if (sw8 && p.step % 4 === 2) t += sw8 * 2 * p.spb;
        if (song.swing16 && p.step % 2 === 1) t += song.swing16 * p.spb;
        const fn = INST[T.inst];
        for (const n of e.notes) fn(p.chans[tn], t, n + (T.transpose || 0), e.len * p.spb, e.v * (T.velMul || 1), T);
      }
      p.next += p.spb;
      p.step++;
      if (p.step >= pat.len) {
        p.step = 0;
        p.order++;
        if (p.order >= song.order.length) {
          if (p.loop && !song.once) p.order = song.loop || 0;
          else p.done = true;
        }
      }
    }
  }

  // Validate every song's track lengths (dev aid): returns a list of problems.
  S.validate = function () {
    const probs = [];
    for (const id in SONGS) {
      const song = SONGS[id];
      for (const pn in song.patterns) {
        const P = song.patterns[pn];
        const len = (P.bars || 4) * 16;
        for (const tn in song.tracks) {
          const v = P[tn];
          if (!v || v === 'chords' || v.startsWith('gen:')) continue;
          const T = song.tracks[tn];
          const n = DRUMS.has(T.inst) ? parseDrum(v).len : parseMelodic(v, 60).len;
          if (n !== len) probs.push(`${id}.${pn}.${tn}: ${n} steps, expected ${len}`);
        }
        if (P.chords) {
          const cl = parseChords(P.chords).reduce((a, c) => Math.max(a, c.s + c.len), 0);
          if (cl !== len) probs.push(`${id}.${pn}.chords: ${cl} steps, expected ${len}`);
        }
      }
      for (const pn of song.order) if (!song.patterns[pn]) probs.push(`${id}: missing pattern ${pn}`);
    }
    return probs;
  };

  return S;
})();
