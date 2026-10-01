/*
 * PARASITE — shared audio
 *
 * Everything is synthesized with WebAudio: a low drone, a heartbeat, and a
 * handful of wet little effects. Nothing plays until start() is called from a
 * user gesture. The on/off choice is remembered across pages.
 */
window.ParasiteAudio = (() => {
  "use strict";

  const PREF_KEY = "parasite.sound";
  const VOLUME = 0.32;

  let ac = null, master = null, drone = null, beatTimer = null;
  let enabled = true;
  try { enabled = localStorage.getItem(PREF_KEY) !== "off"; } catch (e) { /* storage unavailable */ }

  const running = () => ac && ac.state === "running";

  function start() {
    if (ac || !enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);
    master.gain.linearRampToValueAtTime(VOLUME, ac.currentTime + 4);

    drone = ac.createBiquadFilter();
    drone.type = "lowpass";
    drone.frequency.value = 220;
    drone.Q.value = 6;
    drone.connect(master);

    for (const [type, f, g] of [["sawtooth", 55, 0.18], ["sawtooth", 55.35, 0.18], ["sine", 27.5, 0.6], ["triangle", 82.4, 0.05]]) {
      const o = ac.createOscillator();
      const gn = ac.createGain();
      o.type = type; o.frequency.value = f; gn.gain.value = g;
      o.connect(gn).connect(drone);
      o.start();
    }
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(drone.frequency);
    lfo.start();

    beatTimer = setInterval(heartbeat, 1300);
  }

  function thump(at, freq, vol) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, at + 0.18);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + 0.3);
  }

  function heartbeat() {
    if (!running()) return;
    const t = ac.currentTime + 0.05;
    thump(t, 62, 0.55);
    thump(t + 0.22, 52, 0.38);
  }

  function noise(len, { from, to, q = 4, vol = 0.5, type = "bandpass", decay = 2 }) {
    const t = ac.currentTime;
    const buf = ac.createBuffer(1, Math.max(1, ac.sampleRate * len), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, decay);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + len);
    const g = ac.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  function tone(type, f0, f1, len, vol, delay = 0) {
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  const sfx = {
    squelch() {
      if (!running()) return;
      noise(0.5, { from: 900, to: 140, vol: 0.5 });
      thump(ac.currentTime, 90, 0.35);
    },
    tick() {
      if (!running()) return;
      tone("sine", 1400, 700, 0.08, 0.04);
    },
    hop() {
      if (!running()) return;
      tone("sine", 320, 520, 0.09, 0.05);
    },
    jump() {
      if (!running()) return;
      noise(0.12, { from: 2400, to: 900, vol: 0.12, q: 2 });
    },
    land() {
      if (!running()) return;
      noise(0.08, { from: 500, to: 200, vol: 0.12, q: 1, type: "lowpass" });
    },
    hit() {
      if (!running()) return;
      noise(0.25, { from: 1800, to: 300, vol: 0.35, q: 1.5 });
      tone("square", 140, 70, 0.18, 0.06);
    },
    shard() {
      if (!running()) return;
      [0, 0.09, 0.2].forEach((d, i) => tone("sine", [660, 990, 1320][i], [660, 990, 1320][i] * 0.998, 1.4, 0.08, d));
    },
    spray() {
      if (!running()) return;
      noise(1.2, { from: 3500, to: 2500, vol: 0.08, q: 0.7, decay: 0.6 });
    },
    drip() {
      if (!running()) return;
      tone("sine", 1800, 600, 0.07, 0.05);
    },
    death() {
      if (!running()) return;
      noise(1.4, { from: 1200, to: 60, vol: 0.5, q: 2, decay: 1.2 });
      tone("sawtooth", 110, 30, 1.6, 0.08);
    },
    flap() {
      if (!running()) return;
      noise(0.16, { from: 700, to: 250, vol: 0.18, q: 0.9, type: "lowpass", decay: 1.5 });
    },
    hiss() {
      if (!running()) return;
      noise(0.9, { from: 5000, to: 3200, vol: 0.12, q: 1.2, decay: 0.8 });
      tone("sawtooth", 180, 120, 0.5, 0.03);
    },
    snap() {
      if (!running()) return;
      noise(0.08, { from: 4000, to: 1500, vol: 0.5, q: 2, decay: 3 });
      tone("square", 900, 200, 0.06, 0.08);
    },
    zip() {
      if (!running()) return;
      tone("sine", 1200, 260, 0.22, 0.05);
      noise(0.2, { from: 3000, to: 1200, vol: 0.06, q: 3 });
    },
    rush() {
      if (!running()) return;
      noise(3.5, { from: 120, to: 900, vol: 0.45, q: 0.8, type: "lowpass", decay: 0.4 });
      tone("sawtooth", 40, 70, 3.5, 0.06);
    },
    chime() {
      if (!running()) return;
      tone("triangle", 440, 440, 2.2, 0.06);
      tone("triangle", 554, 554, 2.2, 0.05, 0.25);
      tone("triangle", 659, 659, 2.4, 0.05, 0.5);
    },
  };

  // Low-pass the drone harder or softer — used to make the world feel close
  // and muffled (inside a host) or raw and exposed (out in the open).
  function muffle(amount) {
    if (!ac || !drone) return;
    drone.frequency.setTargetAtTime(lerpF(380, 140, amount), ac.currentTime, 0.6);
  }
  const lerpF = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem(PREF_KEY, enabled ? "on" : "off"); } catch (e) { /* ignore */ }
    if (enabled) {
      if (!ac) start();
      else { ac.resume(); master.gain.linearRampToValueAtTime(VOLUME, ac.currentTime + 1); }
    } else if (ac) {
      master.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
      setTimeout(() => !enabled && ac.suspend(), 450);
    }
    return enabled;
  }

  function fadeTo(v, secs) {
    if (ac && enabled) master.gain.linearRampToValueAtTime(v, ac.currentTime + secs);
  }

  return {
    start, toggle, fadeTo, muffle,
    ...sfx,
    VOLUME,
    get enabled() { return enabled; },
  };
})();
