'use strict';
// Pseudo-3D renderer: the camera sits behind the sled looking down the mountain.
const Render = {
  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.cc = {};
    this.bgX = 0;
    this.segs = [];
    this.mtns = [this.makeRange(18, 0.16, 0.28, 6, 0.1, 0.55), this.makeRange(14, 0.1, 0.21, 5, 0.25, 0.25), this.makeRange(10, 0.04, 0.12, 4, 0.55, 0.05)];
    this.clouds = Array.from({ length: 8 }, (_, i) => ({
      x: i / 8 + Math.random() * 0.08, y: U.rand(0.03, 0.2), s: U.rand(0.6, 1.3), v: U.rand(0.5, 1.5),
      puffs: Array.from({ length: U.randInt(4, 7) }, (_, j) => ({ dx: (j - 3) * U.rand(0.25, 0.4), dy: U.rand(-0.35, 0.1), r: U.rand(0.35, 0.65) })),
    }));
    this.viewShift = 0;
    this.balloons = [
      { x: 0.12, y: 0.13, s: 1.1, p: 0, cols: ['#e63946', '#ffd23f'] },
      { x: 0.55, y: 0.07, s: 0.7, p: 2, cols: ['#3d6fd6', '#ffffff'] },
      { x: 0.86, y: 0.2, s: 0.9, p: 4, cols: ['#2a9d8f', '#ff9f1c'] },
    ];
    this.stars = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random() * 0.42, r: Math.random() * 1.6 + 0.4, p: Math.random() * TAU }));
    this.flakes = Array.from({ length: 160 }, () => this.newFlake(true));
    this.playerScreen = { x: 0, y: 0, gy: 0, k: 1 };
    this.playerShift = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  },

  makeRange(n, hMin, hMax, period, par, haze) {
    const peaks = [];
    for (let i = 0; i < n; i++) peaks.push({ x: (i + Math.random() * 0.6) / n, h: U.rand(hMin, hMax), w: U.rand(0.18, 0.34) });
    return { peaks, period, par, haze, near: par > 0.4 };
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.dpr = dpr;
    this.W = this.cv.width = Math.round(innerWidth * dpr);
    this.H = this.cv.height = Math.round(innerHeight * dpr);
    this.F = this.H * CFG.FOCAL;
    this.HZ = this.H * CFG.HORIZON;
    this.k = this.F / CFG.PD;
  },

  newFlake(init) {
    return { x: U.rand(-7000, 7000), y: U.rand(-900, 2600), z: init ? U.rand(200, 9000) : U.rand(7000, 9000) };
  },

  // Zone-tinted piste edge colour, fogged like everything else.
  zcol(zi, rgb, f) {
    const q = (f * 20) | 0, key = 'z' + zi + '_' + q;
    return this.cc[key] || (this.cc[key] = U.rgb(U.mix(rgb, this.pal.fog, q / 20)));
  },

  // Palette colour, optionally lit (sh > 0) or shaded (sh < 0), then fogged.
  col(name, f, sh = 0) {
    const q = (f * 20) | 0, h = Math.round(sh * 6), key = name + q + '_' + h;
    let v = this.cc[key];
    if (!v) {
      let c = this.pal[name];
      if (h > 0) c = U.mix(c, [255, 255, 255], h / 12);
      else if (h < 0) c = U.mix(c, U.mix(this.pal.bank, [40, 60, 110], 0.35), -h / 9);
      v = this.cc[key] = U.rgb(U.mix(c, this.pal.fog, q / 20));
    }
    return v;
  },

  // World → screen for effects (particles at a coin, explosions...).
  toScreen(G, x, y, z) {
    const cz = z - G.cam.z;
    if (cz < 50) return null;
    const s = this.F / cz;
    const seg = G.track.get(Math.floor(z / CFG.SEG_LEN));
    const t = z / CFG.SEG_LEN - seg.i;
    const shift = U.lerp(seg.p1.shift || 0, seg.p2.shift || 0, t);
    const gy = U.lerp(seg.y1, seg.y2, t);
    return { x: this.W / 2 + (shift + x * CFG.ROAD_W - G.cam.x) * s, y: this.HZ + (G.cam.y - gy - y) * s, s };
  },

  draw(G) {
    const c = this.ctx, W = this.W, H = this.H;
    this.pal = Theme.pal;
    this.cc = {};
    this.t = G.time;
    const wantShift = G.state === 'title' && UI.current === 'title' && W / this.dpr >= 1100 ? W * 0.17 : 0;
    this.viewShift += (wantShift - this.viewShift) * 0.08;
    c.save();
    if (this.viewShift > 0.5) c.translate(this.viewShift, 0);
    if (G.shake > 0 && Save.data.settings.shake) {
      const m = Math.min(1, G.shake) * H * 0.018;
      c.translate(U.rand(-m, m), U.rand(-m, m));
    }
    if (G.roll) {
      c.translate(W / 2, H * 0.75);
      c.rotate(G.roll);
      c.translate(-W / 2, -H * 0.75);
    }
    this.drawSky(c, G.time);
    this.drawMountains(c);
    this.drawTerrain(c, G);
    this.drawFlakes(c, G.player.speed);
    if (G.blizzI > 0.01) this.drawBlizzard(c, G);
    this.drawSpeedLines(c, G);
    if (G.player.spooked > 0) {
      c.fillStyle = `rgba(120,40,180,${0.22 * Math.min(1, G.player.spooked)})`;
      c.fillRect(-W * 0.25, -H * 0.25, W * 1.5, H * 1.5);
    }
    if (G.caveI > 0.01) {
      c.fillStyle = `rgba(10,30,80,${0.32 * G.caveI})`;
      c.fillRect(-W * 0.25, -H * 0.25, W * 1.5, H * 1.5);
    }
    c.restore();
    c.save();
    if (this.viewShift > 0.5) c.translate(this.viewShift, 0);
    Particles.draw(c);
    c.restore();
    this.drawVignette(c);
    this.drawAvalanche(c, G);
    if (G.player.pw && G.player.pw.rocket > 0 && G.state === 'play') {
      const vg = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      vg.addColorStop(0, 'rgba(255,122,31,0)');
      vg.addColorStop(1, `rgba(255,90,31,${0.35 + 0.1 * Math.sin(G.time * 20)})`);
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
    }
    if (G.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${Math.min(1, G.flash)})`;
      c.fillRect(0, 0, W, H);
    }
    HUD.draw(c, G);
  },

  drawSky(c, t) {
    const W = this.W, H = this.H, HZ = this.HZ, p = this.pal;
    const g = c.createLinearGradient(0, 0, 0, HZ + H * 0.18);
    g.addColorStop(0, U.rgb(p.skyTop));
    g.addColorStop(1, U.rgb(p.skyBot));
    c.fillStyle = g;
    c.fillRect(-W * 0.25, -H * 0.25, W * 1.5, H * 1.5);

    if (p.stars > 0.01) {
      for (const s of this.stars) {
        c.globalAlpha = p.stars * (0.55 + 0.45 * Math.sin(t * 2 + s.p));
        c.fillStyle = '#fff';
        c.fillRect(s.x * W, s.y * H, s.r * this.dpr, s.r * this.dpr);
      }
      c.globalAlpha = 1;
    }
    if (p.aurora > 0.01) {
      for (let b = 0; b < 3; b++) {
        c.globalAlpha = p.aurora * 0.28;
        c.fillStyle = ['#4dffb0', '#46d3ff', '#b36bff'][b];
        c.beginPath();
        const y0 = H * (0.08 + b * 0.06);
        c.moveTo(0, y0);
        for (let x = 0; x <= W; x += W / 24) c.lineTo(x, y0 + Math.sin(x / W * 7 + t * 0.7 + b * 2) * H * 0.04);
        for (let x = W; x >= 0; x -= W / 24) c.lineTo(x, y0 + H * 0.07 + Math.sin(x / W * 5 + t * 0.9 + b) * H * 0.05);
        c.closePath(); c.fill();
      }
      c.globalAlpha = 1;
    }
    if (p.disco > 0.01) {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI / 2 + Math.sin(t * 0.9 + i * 1.3) * 0.9;
        c.globalAlpha = p.disco * 0.16;
        c.fillStyle = `hsl(${(t * 90 + i * 51) % 360},100%,65%)`;
        c.beginPath();
        c.moveTo(W / 2, -H * 0.05);
        c.lineTo(W / 2 + Math.cos(a - 0.06) * H * 2, -H * 0.05 + Math.sin(a - 0.06) * H * 2);
        c.lineTo(W / 2 + Math.cos(a + 0.06) * H * 2, -H * 0.05 + Math.sin(a + 0.06) * H * 2);
        c.closePath(); c.fill();
      }
      c.globalAlpha = 1;
    }
    const sx = W * 0.74, sy = HZ - H * 0.2, sr = H * 0.055;
    const glow = Math.max(p.sunOn || 0, p.moon || 0);
    if ((p.sunOn || 0) > 0.01) {
      c.save();
      c.translate(sx, sy);
      c.rotate(t * 0.05);
      c.globalAlpha = 0.07 * p.sunOn;
      c.fillStyle = U.rgb(p.sun);
      for (let i = 0; i < 12; i++) {
        c.rotate(TAU / 12);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(H * 0.9, -H * 0.05); c.lineTo(H * 0.9, H * 0.05); c.closePath(); c.fill();
      }
      c.restore();
      c.globalAlpha = 1;
    }
    if (glow > 0.01) {
      const rg = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 3.2);
      rg.addColorStop(0, U.rgb(p.sun, 0.55 * glow));
      rg.addColorStop(1, U.rgb(p.sun, 0));
      c.fillStyle = rg;
      c.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
      c.globalAlpha = glow;
      Art.circ(c, sx, sy, sr, U.rgb(p.sun));
      if (p.moon > 0.01) {
        c.globalAlpha = p.moon;
        Art.circ(c, sx + sr * 0.4, sy - sr * 0.2, sr * 0.85, U.rgb(p.skyTop));
      }
      c.globalAlpha = 1;
    }
    this.drawClouds(c, t, p);
    this.drawBalloons(c, t);
    if (p.planet > 0.01) {
      const px = W * 0.22, py = HZ - H * 0.19, pr = H * 0.1;
      c.globalAlpha = p.planet;
      const pg = c.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
      pg.addColorStop(0, '#ffb86b'); pg.addColorStop(1, '#b0306a');
      c.fillStyle = pg;
      c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,220,180,0.8)'; c.lineWidth = pr * 0.08;
      c.beginPath(); c.ellipse(px, py, pr * 1.8, pr * 0.42, -0.35, 0, TAU); c.stroke();
      c.globalAlpha = 1;
    }
  },

  drawClouds(c, t, p) {
    const W = this.W, H = this.H;
    const night = Math.max(p.stars || 0, p.aurora || 0);
    const body = U.rgb(U.mix([255, 255, 255], p.skyBot, 0.25 + night * 0.5));
    const shade = U.rgb(U.mix(U.mix([255, 255, 255], p.skyBot, 0.25 + night * 0.5), p.skyTop, 0.22));
    c.globalAlpha = 0.85 - night * 0.55;
    for (const cl of this.clouds) {
      const span = W * 1.6;
      const x = ((((cl.x * span + t * 12 * cl.v * this.dpr + this.bgX * H * 0.08) % span) + span) % span) - W * 0.3;
      const y = cl.y * H, r = H * 0.06 * cl.s;
      for (const pf of cl.puffs) Art.circ(c, x + pf.dx * r * 2, y + pf.dy * r + r * 0.25, pf.r * r * 1.05, shade);
      for (const pf of cl.puffs) Art.circ(c, x + pf.dx * r * 2, y + pf.dy * r, pf.r * r, body);
    }
    c.globalAlpha = 1;
  },

  // Whiteout: thick snow haze over the distance plus sideways streaks.
  drawBlizzard(c, G) {
    const W = this.W, H = this.H, I = G.blizzI;
    const g = c.createLinearGradient(0, this.HZ - H * 0.2, 0, H * 0.8);
    g.addColorStop(0, `rgba(236,244,255,${0.95 * I})`);
    g.addColorStop(0.55, `rgba(236,244,255,${0.75 * I})`);
    g.addColorStop(1, `rgba(236,244,255,${0.12 * I})`);
    c.fillStyle = g;
    c.fillRect(-W * 0.25, this.HZ - H * 0.2, W * 1.5, H);
    c.strokeStyle = `rgba(255,255,255,${0.7 * I})`;
    c.lineWidth = Math.max(1, H * 0.003);
    c.beginPath();
    for (let i = 0; i < 90 * I; i++) {
      const x = Math.random() * W * 1.2 - W * 0.1, y = Math.random() * H, l = H * U.rand(0.03, 0.08);
      c.moveTo(x, y); c.lineTo(x - l, y + l * 0.35);
    }
    c.stroke();
  },

  // Hot-air balloons drifting across the sky.
  drawBalloons(c, t) {
    const W = this.W, H = this.H;
    for (const b of this.balloons) {
      const x = ((((b.x + t * 0.004 + this.bgX * 0.03) % 1.3) + 1.3) % 1.3 - 0.15) * W;
      const y = (b.y + Math.sin(t * 0.5 + b.p) * 0.012) * H, r = H * 0.04 * b.s;
      c.save();
      c.beginPath(); c.ellipse(x, y, r, r * 1.15, 0, 0, TAU); c.clip();
      for (let i = 0; i < 6; i++) { c.fillStyle = b.cols[i % 2]; c.fillRect(x - r + (i * r) / 3, y - r * 1.2, r / 3 + 1, r * 2.4); }
      c.restore();
      c.strokeStyle = 'rgba(16,26,58,0.6)'; c.lineWidth = Math.max(1, r * 0.04);
      c.beginPath(); c.moveTo(x - r * 0.6, y + r * 0.8); c.lineTo(x - r * 0.2, y + r * 1.5); c.moveTo(x + r * 0.6, y + r * 0.8); c.lineTo(x + r * 0.2, y + r * 1.5); c.stroke();
      c.fillStyle = '#8a5a2e'; c.fillRect(x - r * 0.25, y + r * 1.5, r * 0.5, r * 0.35);
    }
  },

  drawVignette(c) {
    const W = this.W, H = this.H;
    if (!this.vig || this.vig.w !== W || this.vig.h !== H) {
      const g = c.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.45, W / 2, H * 0.55, Math.hypot(W, H) * 0.62);
      g.addColorStop(0, 'rgba(10,16,40,0)');
      g.addColorStop(1, 'rgba(10,16,40,0.32)');
      this.vig = { w: W, h: H, g };
    }
    c.fillStyle = this.vig.g;
    c.fillRect(0, 0, W, H);
  },

  drawMountains(c) {
    const W = this.W, H = this.H, p = this.pal, base = this.HZ + H * 0.2;
    for (const L of this.mtns) {
      const period = L.period * H;
      const off = (((this.bgX * L.par * H) % period) + period) % period;
      const body = U.rgb(U.mix(L.near ? p.mtnNear : p.mtnFar, p.fog, L.haze));
      const snow = U.rgb(U.mix(p.mtnSnow, p.fog, L.haze));
      for (const pk of L.peaks) {
        const hw = pk.w * H;
        let x = pk.x * period - off;
        while (x > -hw) x -= period;
        for (; x < W + hw; x += period) {
          if (x < -hw) continue;
          const top = this.HZ - pk.h * H - (L.near ? 0 : L.haze > 0.4 ? H * 0.07 : H * 0.03);
          const hgt = base - top;
          Art.poly(c, [x - hw, base, x, top, x + hw, base], body);
          c.globalAlpha = 0.14;
          Art.poly(c, [x, top, x + hw, base, x + hw * 0.15, base], '#000');
          c.globalAlpha = 1;
          Art.poly(c, [x, top, x + hw * 0.3, top + hgt * 0.3, x + hw * 0.1, top + hgt * 0.24,
            x - hw * 0.08, top + hgt * 0.33, x - hw * 0.3, top + hgt * 0.3], snow);
        }
      }
    }
    const g = c.createLinearGradient(0, this.HZ - H * 0.06, 0, base);
    g.addColorStop(0, U.rgb(p.fog, 0));
    g.addColorStop(1, U.rgb(p.fog, 1));
    c.fillStyle = g;
    c.fillRect(-W * 0.25, this.HZ - H * 0.06, W * 1.5, base - this.HZ + H * 0.06);
    c.fillStyle = U.rgb(p.fog);
    c.fillRect(-W * 0.25, base - 1, W * 1.5, H);
  },

  proj(p, cz, wy, shift, cam) {
    const s = cz > 1 ? this.F / cz : this.F;
    p.cz = cz; p.s = s; p.shift = shift;
    p.sx = this.W / 2 + (shift - cam.x) * s;
    p.sy = this.HZ + (cam.y - wy) * s;
    p.w = CFG.ROAD_W * s;
  },

  trap(c, x1, y1, w1, x2, y2, w2, col) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x1 - w1, y1 + 0.5); c.lineTo(x2 - w2, y2 - 0.5);
    c.lineTo(x2 + w2, y2 - 0.5); c.lineTo(x1 + w1, y1 + 0.5);
    c.closePath(); c.fill();
  },

  drawTerrain(c, G) {
    const T = G.track, cam = G.cam, SL = CFG.SEG_LEN, DD = CFG.DRAW_DIST;
    const baseI = Math.floor(cam.z / SL);
    const base = T.get(baseI);
    const pct = cam.z / SL - baseI;
    let x = 0, dx = -base.curve * pct, maxy = this.H;
    const segs = this.segs;

    for (let n = 0; n < DD; n++) {
      const s = T.get(baseI + n);
      segs[n] = s;
      s.list.length = 0;
      const z1 = s.i * SL - cam.z;
      s.fog = Math.min(1, 1 - Math.exp(-Math.pow((n / DD) * 1.4, 2.6)));
      this.proj(s.p1, z1, s.y1, x, cam);
      this.proj(s.p2, z1 + SL, s.y2, x + dx, cam);
      x += dx; dx += s.curve;
      s.clip = maxy;
      if (z1 + SL <= 1 || s.p2.sy >= s.p1.sy || s.p2.sy >= maxy) continue;
      this.drawSeg(c, s, n);
      maxy = s.p2.sy;
    }

    for (const e of G.entities) {
      const len = e.len || ET[e.type].len || 0;
      let n = Math.floor((e.z + len) / SL) - baseI;
      if (len && n >= DD && Math.floor(e.z / SL) - baseI < DD) n = DD - 1;
      if (n >= 0 && n < DD) segs[n].list.push(e);
    }

    const P = G.player, pn = Math.floor(P.z / SL) - baseI;
    const ps = segs[pn];
    if (ps) this.playerShift = U.lerp(ps.p1.shift, ps.p2.shift, P.z / SL - ps.i);
    let drawnP = !G.showPlayer;
    for (let n = DD - 1; n >= 0; n--) {
      const s = segs[n];
      for (const d of s.deco) this.drawDeco(c, s, d);
      if (s.list.length) {
        s.list.sort((a, b) => b.z - a.z);
        for (const e of s.list) {
          if (n === pn && !drawnP && e.z < P.z) { this.drawPlayer(c, G); drawnP = true; }
          this.drawEntity(c, s, e, G);
        }
      }
      if (n === pn && !drawnP) { this.drawPlayer(c, G); drawnP = true; }
    }
  },

  drawSeg(c, s, n) {
    const p1 = s.p1, p2 = s.p2, f = s.fog;
    // Light the slope: steep drops fall into shade, rises catch the light.
    const sh = U.clamp(((s.y2 - s.y1) / CFG.SEG_LEN + 0.14) * 3.2, -1, 1);
    const top = Math.floor(p2.sy);
    c.fillStyle = this.col(s.band ? 'offA' : 'offB', f, sh);
    c.fillRect(-this.W * 0.25, top, this.W * 1.5, Math.ceil(p1.sy) - top + 1);
    const zb = ZONES[s.zone || 0].bank;
    this.trap(c, p1.sx, p1.sy, p1.w * 1.12, p2.sx, p2.sy, p2.w * 1.12, zb ? this.zcol(s.zone, zb, f) : this.col('bank', f, sh));
    this.trap(c, p1.sx, p1.sy, p1.w, p2.sx, p2.sy, p2.w, this.col(s.band ? 'snowA' : 'snowB', f, sh));
    if (n < 70) {
      // Glints: fixed spots in the snow that twinkle as you pass.
      for (let j = 0; j < 2; j++) {
        const hsh = Math.sin(s.i * 12.9898 + j * 78.233) * 43758.5453;
        const fr = hsh - Math.floor(hsh);
        const tw = Math.sin(this.t * 6 + fr * 40);
        if (tw < 0.55) continue;
        const gx = p1.sx + (fr * 2.6 - 1.3) * p1.w, gy = (p1.sy + p2.sy) / 2;
        const r = Math.max(1, p1.s * 45) * (tw - 0.5) * 2;
        c.fillStyle = 'rgba(255,255,255,0.95)';
        c.fillRect(gx - r, gy - r * 0.18, r * 2, r * 0.36);
        c.fillRect(gx - r * 0.18, gy - r, r * 0.36, r * 2);
      }
    }
    if (s.band) {
      const lc = this.col('line', f);
      for (const l of [-0.62, -0.2, 0.2, 0.62]) {
        this.trap(c, p1.sx + p1.w * l, p1.sy, p1.w * 0.012, p2.sx + p2.w * l, p2.sy, p2.w * 0.012, lc);
      }
    }
  },

  withClip(c, s, bottom, fn) {
    if (bottom > s.clip) {
      c.save();
      c.beginPath(); c.rect(-40, -40, this.W + 80, s.clip + 40); c.clip();
      fn();
      c.restore();
    } else fn();
  },

  drawDeco(c, s, d) {
    const p = s.p1;
    if (p.cz < 80) return;
    const sc = p.s, sx = p.sx + d.x * p.w, sy = p.sy;
    c.globalAlpha = 1 - s.fog * 0.85;
    if (d.k === 'tree') {
      const set = (Art.zoneSprites && Art.zoneSprites[d.set]) || Art.zoneSprites.pine;
      const sp = set[d.v % set.length];
      const h = sp.h * d.s * sc;
      if (h < 2) { c.globalAlpha = 1; return; }
      const w = (h * sp.w) / sp.h;
      if (sx + w < 0 || sx - w > this.W) { c.globalAlpha = 1; return; }
      this.withClip(c, s, sy, () => {
        if (h > 14) {
          c.fillStyle = 'rgba(40,60,110,0.16)';
          c.beginPath(); c.ellipse(sx - w * 0.2, sy, w * 0.42, w * 0.09, 0, 0, TAU); c.fill();
        }
        c.drawImage(sp.cv, sx - w / 2, sy - h, w, h);
      });
    } else {
      if (sc * 400 < 3 || sx < -500 * sc || sx > this.W + 500 * sc) { c.globalAlpha = 1; return; }
      this.withClip(c, s, sy, () => {
        c.save(); c.translate(sx, sy); c.scale(sc, sc);
        DecoArt[d.k](c, d);
        c.restore();
      });
    }
    c.globalAlpha = 1;
  },

  drawEntity(c, s, e, G) {
    const def = ET[e.type];
    if (def.flat) { this.drawFlat(c, s, e, G, def); return; }
    const cz = e.z - G.cam.z;
    if (cz < 80) return;
    const sc = this.F / cz;
    const t = e.z / CFG.SEG_LEN - s.i;
    const shift = U.lerp(s.p1.shift, s.p2.shift, t);
    const gy = U.lerp(s.y1, s.y2, t);
    const sx = this.W / 2 + (shift + e.x * CFG.ROAD_W - G.cam.x) * sc;
    const sy = this.HZ + (G.cam.y - gy) * sc;
    const reach = 700 * sc;
    if (sx < -reach || sx > this.W + reach) return;
    c.globalAlpha = 1 - s.fog * 0.85;

    this.withClip(c, s, sy, () => {
      if (e.type === 'meteor') {
        const pulse = 0.5 + 0.5 * Math.sin(G.time * 12);
        const tx = this.W / 2 + (shift + e.tx * CFG.ROAD_W - G.cam.x) * sc;
        c.strokeStyle = `rgba(255,60,40,${0.5 + pulse * 0.5})`;
        c.lineWidth = Math.max(1, 26 * sc);
        c.beginPath(); c.ellipse(tx, sy, 280 * sc, 70 * sc, 0, 0, TAU); c.stroke();
      } else if (e.y > 10 && def.shadow !== false) {
        const r = Math.max(0.35, 1 - e.y / 5000);
        c.fillStyle = 'rgba(20,30,70,0.22)';
        c.beginPath(); c.ellipse(sx, sy, (def.w + 60) * sc * r, 40 * sc * r, 0, 0, TAU); c.fill();
      }
      c.save();
      c.translate(sx, sy - e.y * sc);
      c.scale(sc, sc);
      if (e.knock) { c.translate(0, -def.h / 2); c.rotate(e.rot); c.translate(0, def.h / 2); }
      def.draw(c, e, G.time);
      c.restore();
    });
    c.globalAlpha = 1;
  },

  // Flat things painted onto the snow (boost pads, crevasses).
  // Flat things on the snow (boost pads, crevasses, rails). Points nearer than
  // the camera's near plane are pulled forward to it, so long objects that
  // start behind you still draw in the right place.
  drawFlat(c, s, e, G, def) {
    const T = G.track, SL = CFG.SEG_LEN;
    const near = G.cam.z + 120 - e.z; // smallest dz still in front of the camera
    const shiftAt = z => {
      const sg = T.get(Math.floor(z / SL));
      return U.lerp(sg.p1.shift || 0, sg.p2.shift || 0, z / SL - sg.i);
    };
    const gp = (dx, dz) => {
      dz = Math.max(dz, near);
      const z = e.z + dz, sc = this.F / (z - G.cam.z);
      return [this.W / 2 + (shiftAt(z) + e.x * CFG.ROAD_W + dx - G.cam.x) * sc, this.HZ + (G.cam.y - T.groundY(z)) * sc, sc];
    };
    // Screen-y below which a world point at e.z+dz is hidden by a nearer hill.
    const clipAt = dz => {
      const n = Math.floor((e.z + Math.max(dz, near)) / SL) - Math.floor(G.cam.z / SL);
      const sg = this.segs[U.clamp(n, 0, CFG.DRAW_DIST - 1)];
      return sg ? sg.clip : this.H;
    };
    const len = e.len || def.len || 0;
    if (e.z + len - G.cam.z < 120) return;
    const R = { near, clipAt, W: this.W };
    const W = this.W;
    c.globalAlpha = 1 - s.fog * 0.85;
    if (def.selfClip) def.drawFlat(c, gp, e, G.time, R); // rails clip themselves slice by slice
    else if (len <= 0) {
      // Short things: hide whatever is behind a nearer hill.
      c.save();
      c.beginPath(); c.rect(-W, -W, W * 3, W + clipAt(0)); c.clip();
      def.drawFlat(c, gp, e, G.time, R);
      c.restore();
    } else {
      // Long things: draw once per band along their length, each band clipped
      // to its own stretch of ground and to the hills in front of it.
      const groundY = dz => gp(0, dz)[1];
      const STEP = 400, start = Math.max(-200, near);
      for (let z1 = len + 200; z1 > start; z1 -= STEP) {
        const z0 = Math.max(start, z1 - STEP);
        const yTop = Math.min(groundY(z1), groundY(z0)) - 0.5;
        const yBot = Math.min(Math.max(groundY(z1), groundY(z0)) + 0.5, clipAt(z0));
        if (yBot <= yTop) continue;
        c.save();
        c.beginPath(); c.rect(-W, yTop, W * 3, yBot - yTop); c.clip();
        def.drawFlat(c, gp, e, G.time, R);
        c.restore();
      }
    }
    c.globalAlpha = 1;
  },

  drawPlayer(c, G) {
    const P = G.player, k = this.k;
    const gy = G.track.groundY(P.z);
    const sx = this.W / 2 + (this.playerShift + P.x * CFG.ROAD_W - G.cam.x) * k;
    const sy = this.HZ + (G.cam.y - gy) * k;
    this.playerScreen = { x: sx, gy: sy, y: sy - P.air * k, k };
    P.draw(c, sx, sy, k, G);
    P.drawPet(c, sx, sy, k, G);
  },

  updateFlakes(dt, speed) {
    for (const f of this.flakes) {
      f.z -= (speed + 400) * dt;
      f.y -= 140 * dt;
      f.x += Math.sin(f.z * 0.001) * 50 * dt;
      if (f.z < 150 || f.y < -1000) Object.assign(f, this.newFlake(false));
    }
  },

  drawFlakes(c, speed) {
    const streak = U.clamp(speed / 9000, 0, 1.4) * 0.06;
    const zf = G.zone ? G.zone.flake : null; // sprinkles in Candy Land, ash in the Haunted Woods...
    c.strokeStyle = zf && zf !== 'candy' ? zf : 'rgba(255,255,255,0.85)';
    c.lineCap = 'round';
    let fi = 0;
    for (const f of this.flakes) {
      if (zf === 'candy') c.strokeStyle = `hsl(${(fi++ * 47) % 360},90%,65%)`;
      const s = this.F / f.z;
      const x = this.W / 2 + f.x * s, y = this.HZ + (800 - f.y) * s;
      const z2 = f.z + (speed + 400) * streak, s2 = this.F / z2;
      c.lineWidth = Math.max(1, 14 * s);
      c.beginPath();
      c.moveTo(this.W / 2 + f.x * s2, this.HZ + (800 - f.y) * s2);
      c.lineTo(x + 0.1, y);
      c.stroke();
    }
  },

  drawSpeedLines(c, G) {
    const kmh = G.player.speed * CFG.KMH;
    const inten = U.clamp((kmh - 130) / 220, 0, 1);
    if (inten <= 0) return;
    const W = this.W, H = this.H, R = Math.hypot(W, H) * 0.5, n = Math.floor(10 + inten * 40);
    c.strokeStyle = `rgba(255,255,255,${0.12 + inten * 0.3})`;
    c.lineWidth = H * 0.003;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, r0 = R * U.rand(0.55, 0.85), r1 = r0 + R * U.rand(0.15, 0.4) * inten;
      c.moveTo(W / 2 + Math.cos(a) * r0, this.HZ + Math.sin(a) * r0);
      c.lineTo(W / 2 + Math.cos(a) * r1, this.HZ + Math.sin(a) * r1);
    }
    c.stroke();
  },

  drawAvalanche(c, G) {
    if (!G.showAvalanche) return;
    const W = this.W, H = this.H, t = G.time;
    const gapM = G.gap / CFG.METER;
    let a = U.clamp(1 - gapM / 110, 0, 1);
    if (G.state === 'caught' || G.state === 'over') a = 1 + Math.min(1.2, G.caughtT * 0.7);
    if (a <= 0) return;
    const top = H - a * H * 0.5;
    const g = c.createLinearGradient(0, top - H * 0.12, 0, H);
    g.addColorStop(0, 'rgba(240,246,255,0)');
    g.addColorStop(0.3, 'rgba(236,243,252,0.95)');
    g.addColorStop(1, '#c9d7ea');
    c.fillStyle = g;
    c.fillRect(0, top - H * 0.12, W, H - top + H * 0.12);
    for (let i = 0; i < 16; i++) {
      const x = (i / 15) * W, r = H * (0.09 + 0.05 * Math.sin(t * 3 + i * 1.7)) * (0.6 + a * 0.6);
      Art.ell(c, x, top + Math.sin(t * 4 + i * 2.3) * H * 0.02, r, r * 0.85, i % 2 ? '#f4f8ff' : '#e2ebf7');
    }
    for (let i = 0; i < 10; i++) {
      const x = ((i + 0.5) / 10) * W, r = H * (0.07 + 0.03 * Math.sin(t * 5 + i));
      Art.ell(c, x, top + H * 0.14 + Math.sin(t * 3 + i) * H * 0.02, r, r * 0.8, '#cbd8ea');
    }
    for (let i = 0; i < 4; i++) {
      const x = ((i * 0.27 + t * 0.13) % 1) * W, y = top + H * 0.06 + Math.sin(t * 5 + i) * H * 0.04;
      c.save(); c.translate(x, y); c.rotate(t * 3 + i);
      c.drawImage(Art.trees[i % 3], -H * 0.03, -H * 0.06, H * 0.06, H * 0.12);
      c.restore();
    }
    if (G.level >= 4 && a > 0.25 && a < 1.2) {
      // The avalanche has noticed you.
      const fx = W / 2 + Math.sin(t * 1.3) * W * 0.08, fy = top + H * 0.09, fs = H * 0.05 * (0.7 + a);
      c.globalAlpha = Math.min(1, (a - 0.25) * 3);
      for (const sd of [-1, 1]) {
        Art.ell(c, fx + sd * fs * 1.6, fy, fs * 0.8, fs * 0.55, '#ffffff');
        Art.circ(c, fx + sd * fs * 1.45, fy + fs * 0.1, fs * 0.28, '#101a3a');
        Art.line(c, [fx + sd * fs * 2.4, fy - fs * 0.9, fx + sd * fs * 0.8, fy - fs * 0.45], '#7d93b8', fs * 0.25);
      }
      Art.ell(c, fx, fy + fs * 1.4, fs * 1.4, fs * (0.4 + 0.3 * Math.abs(Math.sin(t * 6))), '#5a6f92');
      c.globalAlpha = 1;
    }
    if (a > 0.55) {
      c.fillStyle = `rgba(255,255,255,${Math.min(1, (a - 0.55) * 0.9)})`;
      c.fillRect(0, 0, W, H);
    }
  },
};
