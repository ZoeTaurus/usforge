'use strict';
// Atmosphere & juice: particles, screen shake, day/night lighting, weather, clouds and ambient wildlife.
const FX = {
  DAY_LEN: 300,           // seconds per full day
  tod: 0.3,               // time of day, 0..1 (0.25 sunrise, 0.5 noon, 0.75 sunset)
  day: 1,
  darkness: 0, dusk: 0,
  rain: 0, rainTarget: 0, weatherT: 140,
  wind: 0.5,
  shakeAmt: 0, shakeT: 0,
  particles: [], floaters: [], drops: [], items: [], prints: [], shakeOn: true, miniCache: {},
  gulls: [], butterflies: [], fireflies: [], fishSpots: [],
  clouds: [],

  init() {
    const r = RNG.mulberry32(5);
    for (let i = 0; i < 5; i++) this.clouds.push({ x: r() * 900, y: r() * 600, s: 0.8 + r() * 0.8 });
    for (let i = 0; i < 110; i++) this.drops.push({ x: Math.random(), y: Math.random(), l: 4 + Math.random() * 5 });
    this.lc = document.createElement('canvas');
    this.lctx = this.lc.getContext('2d');
  },

  resize(w, h) { this.lc.width = w; this.lc.height = h; },

  isNight() { return this.darkness > 0.3; },
  clock() {
    const h = Math.floor(((this.tod * 24) + 24) % 24), m = Math.floor((this.tod * 24 * 60) % 60);
    return `${String(h).padStart(2, '0')}:${String(m - m % 10).padStart(2, '0')}`;
  },

  shake(amt, dur) { if (!this.shakeOn) return; this.shakeAmt = Math.max(this.shakeAmt, amt); this.shakeT = Math.max(this.shakeT, dur); },
  shakeOffset() {
    if (this.shakeT <= 0) return [0, 0];
    return [Math.round((Math.random() * 2 - 1) * this.shakeAmt), Math.round((Math.random() * 2 - 1) * this.shakeAmt)];
  },

  burst(x, y, col, n, speed = 50) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 15 + Math.random() * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, g: 140, life: 0.35 + Math.random() * 0.35, col, size: Math.random() < 0.3 ? 2 : 1 });
    }
  },
  dust(x, y, col = '#d8c89a') {
    this.particles.push({ x: x + (Math.random() * 6 - 3), y, vx: (Math.random() - 0.5) * 12, vy: -8, g: 0, life: 0.35, col, size: 2 });
  },
  floater(x, y, text, col) { this.floaters.push({ x, y, text, col, life: 1.2 }); },

  // Loot pops out, bounces, then gets pulled into the player.
  drop(x, y, item, n) {
    const pieces = Math.min(n, 4);
    let left = n;
    for (let i = 0; i < pieces; i++) {
      const v = i === pieces - 1 ? left : Math.floor(n / pieces);
      left -= v;
      const a = Math.random() * Math.PI * 2, s = 18 + Math.random() * 26;
      this.items.push({ x, y, z: 4, vz: 70 + Math.random() * 50, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, item, n: v, t: -i * 0.05 });
    }
  },
  updateItems(dt, p) {
    for (const d of this.items) {
      d.t += dt;
      if (d.t < 0.5) {
        d.x += d.vx * dt; d.y += d.vy * dt;
        d.vz -= 280 * dt; d.z += d.vz * dt;
        if (d.z < 0) { d.z = 0; d.vz *= -0.45; d.vx *= 0.6; d.vy *= 0.6; }
      } else {
        const dx = p.x - d.x, dy = p.y + 2 - d.y, dist = Math.hypot(dx, dy) || 1;
        const sp = Math.min(dist, (90 + (d.t - 0.5) * 600) * dt);
        d.x += dx / dist * sp; d.y += dy / dist * sp; d.z *= 0.85;
        if (dist < 8 || p.mode !== 'walk' || dist > 260) { d.done = true; Game.collect(d.item, d.n); }
      }
    }
    this.items = this.items.filter(d => !d.done);
  },
  mini(item) {
    if (this.miniCache[item]) return this.miniCache[item];
    const src = Sprites.items[item];
    const c = document.createElement('canvas'); c.width = 10; c.height = 10;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (src) g.drawImage(src, 0, 0, 16, 16, 0, 0, 10, 10);
    return (this.miniCache[item] = c);
  },
  drawItems(c, camX, camY, time) {
    for (const d of this.items) {
      const x = Math.round(d.x - camX), y = Math.round(d.y - camY);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x - 3, y + 3, 6, 2);
      c.drawImage(this.mini(d.item), x - 5, Math.round(y - 5 - d.z - (d.t > 0.5 ? 0 : Math.sin(time * 8) * 0)));
    }
  },

  // footprints in soft ground
  print(x, y, side) { this.prints.push({ x: x + side * 2, y, life: 7 }); if (this.prints.length > 80) this.prints.shift(); },
  drawPrints(c, camX, camY) {
    for (const f of this.prints) {
      c.fillStyle = `rgba(40,30,20,${0.22 * Math.min(1, f.life / 3)})`;
      c.fillRect(Math.round(f.x - camX), Math.round(f.y - camY), 2, 1);
    }
  },

  // ---------------- update ----------------
  update(dt, cam, vw, vh, player) {
    // time of day
    this.tod += dt / this.DAY_LEN;
    if (this.tod >= 1) { this.tod -= 1; this.day++; }
    const sun = Math.cos((this.tod - 0.5) * Math.PI * 2); // 1 noon, -1 midnight
    this.darkness = Math.max(0, Math.min(0.78, (0.2 - sun) * 0.95)) + this.rain * 0.12;
    this.dusk = Math.max(0, 1 - Math.abs(sun - 0.05) * 5);

    // weather
    this.weatherT -= dt;
    if (this.weatherT <= 0) {
      if (this.rainTarget > 0) { this.rainTarget = 0; this.weatherT = 150 + Math.random() * 200; }
      else { this.rainTarget = 0.6 + Math.random() * 0.4; this.weatherT = 45 + Math.random() * 50; }
    }
    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * 0.3);
    this.wind = 0.5 + this.rain * 1.5;

    this.shakeT -= dt;
    if (this.shakeT <= 0) this.shakeAmt = 0;

    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.floaters) { f.life -= dt; f.y -= 16 * dt; }
    for (const f of this.prints) f.life -= dt;
    this.prints = this.prints.filter(f => f.life > 0);
    if (Game.player) this.updateItems(dt, Game.player);
    this.floaters = this.floaters.filter(f => f.life > 0);

    for (const c of this.clouds) { c.x += (4 + this.wind * 4) * dt; c.y += 1.5 * dt; }

    this.updateCritters(dt, cam, vw, vh, player);
  },

  updateCritters(dt, cam, vw, vh, p) {
    const inView = (x, y, m = 40) => x > cam.x - m && x < cam.x + vw + m && y > cam.y - m && y < cam.y + vh + m;

    // seagulls glide over coasts and sea
    if (this.gulls.length < 3 && Math.random() < dt * 0.25 && this.rain < 0.5) {
      const fromLeft = Math.random() < 0.5;
      this.gulls.push({ x: fromLeft ? cam.x - 20 : cam.x + vw + 20, y: cam.y + Math.random() * vh, vx: (fromLeft ? 1 : -1) * (22 + Math.random() * 14), vy: (Math.random() - 0.5) * 8, f: Math.random() * 2, h: 18 + Math.random() * 14 });
    }
    for (const g of this.gulls) { g.x += g.vx * dt; g.y += g.vy * dt + Math.sin(g.f) * 3 * dt; g.f += dt * 4; }
    this.gulls = this.gulls.filter(g => inView(g.x, g.y, 80));

    // butterflies near flowers in daytime
    if (this.darkness < 0.3 && this.rain < 0.3 && this.butterflies.length < 5 && Math.random() < dt * 2) {
      const tx = Math.floor((cam.x + Math.random() * vw) / 16), ty = Math.floor((cam.y + Math.random() * vh) / 16);
      if (World.get(tx, ty) === T.FLOWERS) this.butterflies.push({ x: tx * 16 + 8, y: ty * 16 + 4, t: 0, life: 12 + Math.random() * 10, c: Math.random() * 4 | 0, vx: 0, vy: 0 });
    }
    for (const b of this.butterflies) {
      b.t += dt; b.life -= dt;
      b.vx += (Math.random() - 0.5) * 120 * dt; b.vy += (Math.random() - 0.5) * 120 * dt;
      b.vx *= 0.96; b.vy *= 0.96;
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    this.butterflies = this.butterflies.filter(b => b.life > 0 && inView(b.x, b.y, 60));

    // fireflies at night, on land
    if (this.darkness > 0.4 && this.fireflies.length < 18 && Math.random() < dt * 6) {
      const x = cam.x + Math.random() * vw, y = cam.y + Math.random() * vh;
      const t = World.get(Math.floor(x / 16), Math.floor(y / 16));
      if (TILE[t].walk || TILE[t].tall) this.fireflies.push({ x, y, ph: Math.random() * 6, life: 6 + Math.random() * 6 });
    }
    for (const f of this.fireflies) { f.life -= dt; f.ph += dt; f.x += Math.sin(f.ph * 1.3) * 6 * dt; f.y += Math.cos(f.ph * 0.9) * 5 * dt; }
    this.fireflies = this.fireflies.filter(f => f.life > 0 && (this.darkness > 0.3) && inView(f.x, f.y, 20));

    // sparkling fish spots appear near the boat
    if (p.mode === 'sail' && this.fishSpots.length < 3 && Math.random() < dt * 0.5) {
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (TILE[World.get(Math.floor(x / 16), Math.floor(y / 16))].sea) this.fishSpots.push({ x, y, life: 14, jumpT: Math.random() * 2, jump: -1 });
    }
    for (const s of this.fishSpots) {
      s.life -= dt; s.jumpT -= dt;
      if (s.jump >= 0) { s.jump += dt * 1.6; if (s.jump >= 1) s.jump = -1; }
      else if (s.jumpT <= 0) { s.jump = 0; s.jumpT = 1.5 + Math.random() * 2.5; }
    }
    this.fishSpots = this.fishSpots.filter(s => s.life > 0 && Math.hypot(s.x - p.x, s.y - p.y) < 320);
  },

  // ---------------- drawing ----------------
  drawCritters(c, camX, camY, time) {
    for (const s of this.fishSpots) {
      const x = Math.round(s.x - camX), y = Math.round(s.y - camY);
      c.fillStyle = 'rgba(235,248,255,0.8)';
      const k = Math.floor(time * 6 + s.x) % 4;
      c.fillRect(x - 4 + k, y, 2, 1); c.fillRect(x + 3 - k, y + 2, 2, 1); c.fillRect(x, y - 2 + (k % 2), 1, 1);
      if (s.jump >= 0) {
        const jx = x - 8 + s.jump * 16, jy = y - Math.sin(s.jump * Math.PI) * 10 - 3;
        c.drawImage(Sprites.fx.fish, Math.round(jx), Math.round(jy));
      }
    }
    for (const b of this.butterflies) {
      c.drawImage(Sprites.fx.butterfly[b.c][Math.floor(b.t * 10) % 2], Math.round(b.x - 2 - camX), Math.round(b.y - 2 - camY - 6));
    }
  },

  drawSky(c, camX, camY, vw, vh, time) {
    // gull shadows then gulls
    for (const g of this.gulls) {
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(Math.round(g.x - camX - 3), Math.round(g.y - camY + g.h), 7, 2);
    }
    for (const g of this.gulls) {
      const img = Sprites.fx.gull[Math.floor(g.f) % 2];
      c.drawImage(img, Math.round(g.x - camX - 6), Math.round(g.y - camY - 3));
    }
    // cloud shadows (a repeating field locked to world coordinates)
    const SW = 900, SH = 600;
    c.globalAlpha = 0.09 + this.rain * 0.05;
    for (const cl of this.clouds) {
      const x = ((cl.x - camX) % SW + SW) % SW - 200, y = ((cl.y - camY) % SH + SH) % SH - 120;
      c.drawImage(Sprites.fx.cloud, Math.round(x), Math.round(y), Math.round(160 * cl.s), Math.round(90 * cl.s));
    }
    c.globalAlpha = 1;
  },

  drawWeather(c, vw, vh, dt) {
    if (Game.curIsland === 7 && Game.player.mode === 'walk') {
      // snowfall on Frostpeak
      c.fillStyle = 'rgba(200,220,255,0.12)'; c.fillRect(0, 0, vw, vh);
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (const d of this.drops) {
        d.y += dt * 0.12 * (0.6 + d.l * 0.08); d.x += dt * 0.03 * Math.sin(d.y * 12 + d.l);
        if (d.y > 1) { d.y -= 1; d.x = Math.random(); }
        c.fillRect(Math.round(mod(d.x, 1) * vw), Math.round(d.y * vh), d.l > 7 ? 2 : 1, d.l > 7 ? 2 : 1);
      }
      return;
    }
    if (this.rain < 0.05) return;
    c.fillStyle = `rgba(40,55,80,${this.rain * 0.18})`;
    c.fillRect(0, 0, vw, vh);
    c.fillStyle = `rgba(190,210,240,${0.35 + this.rain * 0.3})`;
    const n = Math.floor(this.drops.length * this.rain);
    const slant = this.wind * 0.35;
    for (let i = 0; i < n; i++) {
      const d = this.drops[i];
      d.y += dt * (1.6 + d.l * 0.05);
      d.x += dt * slant * 0.25;
      if (d.y > 1) { d.y -= 1; d.x = Math.random(); if (Math.random() < 0.5) this.splashes = (this.splashes || []).concat([{ x: Math.random() * vw, y: Math.random() * vh, t: 0.2 }]); }
      if (d.x > 1) d.x -= 1;
      const x = Math.round(d.x * vw), y = Math.round(d.y * vh);
      for (let k = 0; k < d.l; k++) c.fillRect(x + Math.round(k * slant * 0.5), y + k, 1, 1);
    }
    if (this.splashes) {
      c.fillStyle = 'rgba(210,225,250,0.6)';
      for (const s of this.splashes) { s.t -= dt; c.fillRect(Math.round(s.x) - 1, Math.round(s.y), 1, 1); c.fillRect(Math.round(s.x) + 1, Math.round(s.y), 1, 1); }
      this.splashes = this.splashes.filter(s => s.t > 0).slice(-60);
    }
  },

  // Darkness with holes cut out around light sources, plus a warm glow.
  drawLighting(c, vw, vh, lights, time) {
    if (this.dusk > 0.02) {
      c.fillStyle = `rgba(255,120,50,${this.dusk * 0.12})`;
      c.fillRect(0, 0, vw, vh);
    }
    const dark = this.darkness;
    if (dark < 0.03) return;
    const g = this.lctx;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, vw, vh);
    g.fillStyle = `rgba(8,12,38,${dark})`;
    g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const r = l.r * (l.flicker ? 0.94 + Math.sin(time * 11 + l.x) * 0.04 + Math.random() * 0.03 : 1);
      const grd = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.45, 'rgba(0,0,0,0.75)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(l.x - r, l.y - r, r * 2, r * 2);
    }
    c.drawImage(this.lc, 0, 0);
    c.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.warm) continue;
      const r = l.r * 0.7;
      const grd = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      grd.addColorStop(0, `rgba(255,150,60,${0.28 * dark})`);
      grd.addColorStop(1, 'rgba(255,150,60,0)');
      c.fillStyle = grd;
      c.fillRect(l.x - r, l.y - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = 'source-over';
  },

  drawGlow(c, camX, camY, time) {
    if (this.darkness < 0.3) return;
    for (const f of this.fireflies) {
      const a = (Math.sin(f.ph * 3) * 0.5 + 0.5) * Math.min(1, f.life);
      c.fillStyle = `rgba(220,255,120,${a})`;
      c.fillRect(Math.round(f.x - camX), Math.round(f.y - camY), 1, 1);
      c.fillStyle = `rgba(220,255,120,${a * 0.25})`;
      c.fillRect(Math.round(f.x - camX) - 1, Math.round(f.y - camY) - 1, 3, 3);
    }
  },

  drawParticles(c, camX, camY) {
    for (const p of this.particles) {
      c.globalAlpha = Math.min(1, p.life * 3);
      c.fillStyle = p.col;
      c.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
    }
    c.globalAlpha = 1;
  },

  drawFloaters(c, camX, camY) {
    for (const f of this.floaters) {
      c.globalAlpha = Math.min(1, f.life * 2);
      PixelFont.draw(c, f.text, Math.round(f.x - camX - PixelFont.width(f.text) / 2), Math.round(f.y - camY - 2), f.col);
    }
    c.globalAlpha = 1;
  },
};

// A tiny 3x5 pixel font for in-world labels, so they stay crisp at native resolution.
const PixelFont = (() => {
  const G = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', '[': '110100100100110', ']': '011001001001011', '+': '000010111010000', '-': '000000111000000',
    '!': '010010010000010', '.': '000000000000010', '/': '001001010100100', "'": '010010000000000', ' ': '000000000000000',
    '?': '110001010000010', ':': '000010000010000',
  };
  return {
    width(text) { return text.length * 4 - 1; },
    draw(c, text, x, y, col, shadow = '#000') {
      text = String(text).toUpperCase();
      const pass = (ox, oy, colr) => {
        c.fillStyle = colr;
        for (let i = 0; i < text.length; i++) {
          const g = G[text[i]] || G[' '];
          for (let k = 0; k < 15; k++) if (g[k] === '1') c.fillRect(x + i * 4 + (k % 3) + ox, y + Math.floor(k / 3) + oy, 1, 1);
        }
      };
      if (shadow) pass(1, 1, shadow);
      pass(0, 0, col);
    },
  };
})();
