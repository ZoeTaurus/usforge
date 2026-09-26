'use strict';
// ============================================================
//  World: day/night palette, sky, sea and ambient life
//  (clouds, seagulls, warm breeze, drifting petals)
// ============================================================

const NIGHT = { top: '#0b0d26', mid: '#171a42', bot: '#2a3062', sea: '#16224c', seaD: '#0a1230', cloud: '#3a3f6a', cloudS: '#2a2e52', tint: '#0b0d30', tintA: 0.5, bird: '#9aa0c8' };
const SKY_KEYS = [
  [0.0, NIGHT],
  [0.15, NIGHT],
  [0.21, { top: '#40407a', mid: '#b8729a', bot: '#f6b58c', sea: '#5a6a9e', seaD: '#23305e', cloud: '#f7c6c0', cloudS: '#c48ea6', tint: '#7a4a6a', tintA: 0.15, bird: '#3a2a45' }],
  [0.28, { top: '#3f8fdc', mid: '#72b8ec', bot: '#bfe6f7', sea: '#3a8fd0', seaD: '#1d4f8c', cloud: '#ffffff', cloudS: '#cfe3f2', tint: '#000000', tintA: 0, bird: '#ffffff' }],
  [0.62, { top: '#3f8fdc', mid: '#72b8ec', bot: '#bfe6f7', sea: '#3a8fd0', seaD: '#1d4f8c', cloud: '#ffffff', cloudS: '#cfe3f2', tint: '#000000', tintA: 0, bird: '#ffffff' }],
  [0.72, { top: '#3b2f6b', mid: '#d0668a', bot: '#ffb45e', sea: '#7a5a9a', seaD: '#2e2a5e', cloud: '#ffb38a', cloudS: '#c46a8a', tint: '#ff7a3a', tintA: 0.12, bird: '#3a2a45' }],
  [0.8, { top: '#1c1a45', mid: '#5a3a72', bot: '#b85a6a', sea: '#3a3a70', seaD: '#161a40', cloud: '#6a4a7a', cloudS: '#4a3560', tint: '#1a1540', tintA: 0.3, bird: '#2a2040' }],
  [0.86, NIGHT],
  [1.0, NIGHT],
];
function timeOfDay(t) {
  t = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= t) i++;
  const [t0, a] = SKY_KEYS[i], [t1, b] = SKY_KEYS[i + 1];
  const k = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const o = {};
  for (const key in a) o[key] = typeof a[key] === 'number' ? lerp(a[key], b[key], k) : mix(a[key], b[key], k);
  o.night = nightAmount(t);
  return o;
}
function nightAmount(t) {
  t = ((t % 1) + 1) % 1;
  if (t < 0.15 || t > 0.86) return 1;
  if (t < 0.24) return 1 - (t - 0.15) / 0.09;
  if (t > 0.76) return (t - 0.76) / 0.1;
  return 0;
}
const isNight = t => nightAmount(t) > 0.6;
function sunPos(t, hy) {
  const p = (t - 0.17) / 0.65;
  if (p < 0 || p > 1) return null;
  return { x: 20 + p * 280, y: hy + 6 - Math.sin(p * Math.PI) * 78, col: mix('#fff4c2', '#ff8a3a', 1 - Math.pow(Math.sin(p * Math.PI), 0.6)) };
}
function moonPos(t, hy) {
  const p = (((t - 0.82 + 1) % 1)) / 0.36;
  if (p < 0 || p > 1) return null;
  return { x: 30 + p * 260, y: hy + 6 - Math.sin(p * Math.PI) * 70 };
}

const STARS = Array.from({ length: 70 }, (_, i) => ({ x: Math.floor(hash(i, 1) * W), y: Math.floor(hash(i, 2) * 80), b: hash(i, 3) }));

const _sky = { c: makeCanvas(W, 120), key: '' };
function drawSky(T, hy, dayT) {
  const key = Math.round(dayT * 500) + '|' + hy;
  if (_sky.key !== key) {
    _sky.key = key;
    const x = _sky.c.getContext('2d');
    withTarget(x, () => {
      const bands = 12, bh = hy / bands;
      let prev = null;
      for (let b = 0; b < bands; b++) {
        const k = b / (bands - 1);
        const col = k < 0.55 ? mix(T.top, T.mid, k / 0.55) : mix(T.mid, T.bot, (k - 0.55) / 0.45);
        const y0 = Math.floor(b * bh), y1 = Math.floor((b + 1) * bh);
        R(0, y0, W, y1 - y0 + 1, col);
        if (prev) { G.fillStyle = prev; for (let xx = 0; xx < W; xx += 2) G.fillRect(xx + (y0 & 1), y0, 1, 1); }
        prev = col;
      }
    });
  }
  G.drawImage(_sky.c, 0, 0);
  if (T.night > 0) {
    const tm = Game.time;
    for (const s of STARS) {
      if (s.y > hy - 6) continue;
      G.globalAlpha = T.night * (0.5 + 0.5 * Math.sin(tm * (1 + s.b * 2) + s.b * 20)) * (0.5 + s.b * 0.5);
      P(s.x, s.y, s.b > 0.85 ? '#ffe9b0' : '#ffffff');
    }
    G.globalAlpha = 1;
  }
}
function drawSunMoon(dayT, hy, over) {
  const s = over || sunPos(dayT, hy);
  if (s) {
    glow(s.x, s.y, 20, s.col, 0.1);
    pcircle(s.x, s.y, 10, s.col);
    pcircle(s.x - 2, s.y - 2, 6, lighten(s.col, 0.35));
  }
  const m = over ? null : moonPos(dayT, hy);
  if (m) {
    glow(m.x, m.y, 14, '#c8d0ff', 0.08);
    pcircle(m.x, m.y, 6, '#f4f1de');
    P(m.x - 2, m.y - 1, '#d8d4bd'); R(m.x + 1, m.y + 1, 2, 2, '#d8d4bd'); P(m.x - 1, m.y + 3, '#d8d4bd');
  }
  return { sun: s, moon: m };
}
function drawFarSea(y0, y1, T, t, lights) {
  for (let y = y0; y < y1; y++) {
    const k = (y - y0) / (y1 - y0);
    R(0, y, W, 1, mix(mix(T.bot, T.sea, 0.55), T.sea, Math.min(1, k * 1.6)));
  }
  G.fillStyle = rgba('#ffffff', 0.16);
  for (let i = 0; i < 44; i++) {
    const yy = y0 + 1 + ((i * 7) % Math.max(1, y1 - y0 - 1));
    const xx = ((i * 53 + t * (5 + (i % 3) * 3)) % (W + 20)) - 10;
    G.fillRect(Math.round(xx), yy, 2 + (i % 4) * 2, 1);
  }
  const drawRefl = (x, col, a) => {
    G.fillStyle = col;
    for (let y = y0 + 1; y < y1; y += 2) {
      const k = (y - y0) / (y1 - y0);
      const hw = (2 + k * 10) * (0.6 + 0.4 * Math.sin(t * 2.5 + y * 1.7));
      G.globalAlpha = a * (1 - k * 0.5);
      G.fillRect(Math.round(x - hw), y, Math.round(hw * 2), 1);
    }
    G.globalAlpha = 1;
  };
  if (lights.sun) drawRefl(lights.sun.x, lights.sun.col, 0.55);
  if (lights.moon) drawRefl(lights.moon.x, '#e8ecff', 0.35);
}

// ---------- ambient life ----------
class Ambient {
  constructor(nBirds = 5, w = W, h = H) {
    this.t = 0;
    this.w = w; this.h = h; this.k = h / H;
    this.clouds = [];
    for (let i = 0; i < 5; i++) this.clouds.push(makeCloud(rand(0, w), rand(10, 52) * this.k, rand(24, 50) * this.k));
    this.birds = [];
    for (let i = 0; i < nBirds; i++) this.birds.push(this.newBird(true));
    this.wind = [];
    this.petals = [];
  }
  newBird(init) {
    const d = Math.random() < 0.7 ? -1 : 1;
    const k = this.k, small = k < 1;
    return { x: init ? rand(0, this.w) : d < 0 ? this.w + 12 : -12, y: rand(12, 62) * k, vx: d * rand(10, 20) * k, ph: rand(0, 6), fs: rand(6, 9), s: small ? (Math.random() < 0.5 ? 2 : 3) : Math.random() < 0.4 ? 2 : 3 + (Math.random() < 0.3 ? 1 : 0), bob: rand(0, 6), glide: rand(0, 3) };
  }
  update(dt) {
    this.t += dt;
    const k = this.k;
    for (const c of this.clouds) { c.x += c.vx * dt * k; if (c.x < -c.w) { c.x = this.w + c.w; c.y = rand(10, 52) * k; } }
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.x += b.vx * dt;
      b.y += Math.sin(this.t * 0.8 + b.bob) * 4 * k * dt;
      b.glide -= dt;
      if (b.glide < -2) b.glide = rand(1, 3);
      if (b.glide < 0) b.ph += b.fs * dt; else b.ph = lerp(b.ph, Math.PI * 0.15 + Math.floor(b.ph / (Math.PI * 2)) * Math.PI * 2, dt * 4);
      if (b.x < -20 || b.x > this.w + 20) this.birds[i] = this.newBird(false);
    }
    if (Math.random() < dt * 3.5) this.wind.push({ x: this.w + rand(0, 30) * k, y: rand(15, 172) * k, len: Math.round(randi(5, 14) * k), vx: -rand(55, 95) * k, ph: rand(0, 6), life: rand(2.5, 5), max: 0 });
    for (const w of this.wind) { w.x += w.vx * dt; w.life -= dt; w.ph += dt * 3; }
    this.wind = this.wind.filter(w => w.life > 0 && w.x > -20);
    if (Math.random() < dt * 1.6) this.petals.push({ x: this.w + 4, y: rand(40, 170) * k, vx: -rand(18, 38) * k, vy: rand(-4, 4) * k, c: choice(['#ffb3c7', '#ffd28a', '#fff0c8', '#ffc9a8']), ph: rand(0, 6) });
    for (const p of this.petals) { p.x += p.vx * dt; p.ph += dt * 4; p.y += (p.vy + Math.sin(p.ph) * 10 * k) * dt; }
    this.petals = this.petals.filter(p => p.x > -5);
  }
  drawClouds(T) { for (const c of this.clouds) drawCloud(c, T.cloud, T.cloudS); }
  drawBirds(col) { for (const b of this.birds) drawBird(b.x, b.y, b.ph, b.s, col); }
  drawBreeze() {
    for (const w of this.wind) {
      G.globalAlpha = 0.22 * clamp(w.life, 0, 1);
      for (let i = 0; i < w.len; i++) P(w.x + i, w.y + Math.round(Math.sin((w.x + i) * 0.08 + w.ph) * 1.2), '#fff6e0');
    }
    G.globalAlpha = 1;
    for (const p of this.petals) P(p.x, p.y, p.c);
  }
}

// campfire sparks + smoke, shared by menu and beach
function fireParticles(parts, x, y, dt) {
  if (Math.random() < dt * 8) parts.add({ x: x + rand(-2, 2), y: y - 8, vx: -rand(8, 20), vy: -rand(18, 34), life: rand(0.7, 1.4), c: choice(['#ffd54a', '#ffa726', '#ff7b1c']), drag: 0.5 });
  if (Math.random() < dt * 3) parts.add({ type: 'puff', x: x - 2 + rand(-1, 1), y: y - 16, vx: -rand(8, 14), vy: -rand(6, 12), life: rand(1.8, 2.6), c: '#8a8090', s: 1, grow: 1.3, a: 0.35 });
}

// ---------- weather ----------
const WEATHER = {
  clear: { name: 'CLEAR SKIES', tip: 'A LOVELY DAY FOR FISHING.', cloud: 0, bite: 1, big: 1, rare: 1 },
  cloudy: { name: 'CLOUDY', tip: 'FISH ARE A LITTLE HUNGRIER.', cloud: 0.5, bite: 1.15, big: 1, rare: 1 },
  rain: { name: 'RAIN', tip: 'FISH BITE MUCH FASTER IN THE RAIN!', cloud: 0.8, bite: 1.5, big: 1.2, rare: 1, precip: 'rain' },
  storm: { name: 'THUNDERSTORM', tip: 'HUGE SHADOWS LOVE STORMS...', cloud: 1, bite: 1.3, big: 2.5, rare: 1.2, precip: 'rain', storm: true },
  fog: { name: 'FOG', tip: 'RARE FISH COME OUT IN THE FOG.', cloud: 0.3, bite: 1, big: 1.3, rare: 2.2, fog: true },
  snow: { name: 'SNOW', tip: 'QUIET SNOW. RARE FISH STIR.', cloud: 0.6, bite: 1.2, big: 1.2, rare: 1.5, precip: 'snow' },
  blizzard: { name: 'BLIZZARD', tip: 'SOMETHING BIG STIRS UNDER THE ICE...', cloud: 1, bite: 1.2, big: 2.5, rare: 1.4, precip: 'snow', storm: true },
  ash: { name: 'ASHFALL', tip: 'WARM ASH. FISH GET FEISTY.', cloud: 0.7, bite: 1.4, big: 1.3, rare: 1.3, precip: 'ash' },
  eruption: { name: 'ERUPTION!', tip: 'THE VOLCANO RUMBLES. BEASTS AWAKE!', cloud: 1, bite: 1.3, big: 2.5, rare: 1.4, precip: 'ash', storm: true },
};
const WEATHER_BY_SPOT = {
  pier: [['clear', 40], ['cloudy', 20], ['rain', 18], ['storm', 10], ['fog', 12]],
  wreck: [['fog', 35], ['cloudy', 20], ['rain', 20], ['storm', 15], ['clear', 10]],
  ice: [['snow', 35], ['clear', 25], ['cloudy', 15], ['blizzard', 12], ['fog', 13]],
  volcano: [['ash', 35], ['clear', 25], ['cloudy', 15], ['eruption', 15], ['fog', 10]],
};
function pickWeather(spot, not) {
  const list = WEATHER_BY_SPOT[spot].filter(w => w[0] !== not);
  let r = Math.random() * list.reduce((a, w) => a + w[1], 0);
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list[0][0];
}
class WeatherFx {
  constructor() { this.drops = []; this.bolt = null; this.boltT = rand(3, 7); }
  update(dt, kind, onThunder) {
    const w = WEATHER[kind];
    if (w.precip) {
      const rate = w.precip === 'rain' ? (w.storm ? 260 : 150) : w.storm ? 200 : 60;
      let n = rate * dt;
      while (n > 0) {
        if (Math.random() < n) {
          const d = { x: rand(-20, W + 40), y: -4, k: w.precip, ph: rand(0, 6) };
          if (d.k === 'rain') { d.vx = w.storm ? -70 : -30; d.vy = rand(220, 280); }
          else if (d.k === 'snow') { d.vx = w.storm ? -90 : -12; d.vy = rand(18, 32) * (w.storm ? 2 : 1); }
          else { d.vx = -15; d.vy = rand(14, 26); d.c = Math.random() < 0.2 ? '#ff9a3a' : '#8a8088'; }
          this.drops.push(d);
        }
        n--;
      }
    }
    for (const d of this.drops) { d.x += d.vx * dt; d.y += d.vy * dt; d.ph += dt * 3; if (d.k !== 'rain') d.x += Math.sin(d.ph) * 0.3; }
    this.drops = this.drops.filter(d => d.y < H && d.x > -30);
    if (w.storm) {
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = rand(4, 9);
        const x = rand(40, 280), pts = [[x, 0]];
        let px = x, py = 0;
        while (py < 80) { px += rand(-8, 8); py += rand(6, 12); pts.push([px, py]); }
        this.bolt = { pts, t: 0.18 };
        if (onThunder) onThunder();
      }
    }
    if (this.bolt) { this.bolt.t -= dt; if (this.bolt.t <= 0) this.bolt = null; }
  }
  draw(kind, t) {
    const w = WEATHER[kind];
    if (w.fog) {
      G.globalAlpha = 0.22; R(0, 40, W, H - 40, '#dfe8ee');
      for (let i = 0; i < 6; i++) {
        const y = 70 + i * 18 + Math.sin(t * 0.3 + i) * 4;
        G.globalAlpha = 0.14;
        R(0, y, W, 14, '#e8eef4');
        R(((t * (6 + i * 2)) % (W + 80)) - 80 + i * 20, y - 3, 80, 20, '#f4f8fc');
      }
      G.globalAlpha = 1;
    }
    for (const d of this.drops) {
      if (d.k === 'rain') { G.globalAlpha = 0.5; pline(d.x, d.y, d.x - d.vx * 0.015, d.y - 4, '#cfe4ff'); }
      else if (d.k === 'snow') { G.globalAlpha = 0.9; P(d.x, d.y, '#ffffff'); }
      else { G.globalAlpha = 0.8; P(d.x, d.y, d.c); }
    }
    G.globalAlpha = 1;
    if (this.bolt) {
      for (let i = 0; i < this.bolt.pts.length - 1; i++) { const [a, b] = [this.bolt.pts[i], this.bolt.pts[i + 1]]; pline(a[0], a[1], b[0], b[1], '#ffffff'); pline(a[0] + 1, a[1], b[0] + 1, b[1], '#c8d8ff'); }
    }
  }
}
