'use strict';
// Pseudo-3D renderer: the camera sits behind the sled looking down the mountain.
const Render = {
  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.cc = {};
    this.bgX = 0;
    this.segs = [];
    this.mtns = [this.makeRange(14, 0.1, 0.21, 5, 0.25), this.makeRange(10, 0.04, 0.12, 4, 0.55)];
    this.stars = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random() * 0.42, r: Math.random() * 1.6 + 0.4, p: Math.random() * TAU }));
    this.flakes = Array.from({ length: 160 }, () => this.newFlake(true));
    this.playerScreen = { x: 0, y: 0, gy: 0, k: 1 };
    this.playerShift = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  },

  makeRange(n, hMin, hMax, period, par) {
    const peaks = [];
    for (let i = 0; i < n; i++) peaks.push({ x: (i + Math.random() * 0.6) / n, h: U.rand(hMin, hMax), w: U.rand(0.18, 0.34) });
    return { peaks, period, par, near: par > 0.4 };
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

  col(name, f) {
    const q = (f * 20) | 0, key = name + q;
    let v = this.cc[key];
    if (!v) v = this.cc[key] = U.rgb(U.mix(this.pal[name], this.pal.fog, q / 20));
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
    c.save();
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
    this.drawSpeedLines(c, G);
    c.restore();
    Particles.draw(c);
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

  drawMountains(c) {
    const W = this.W, H = this.H, p = this.pal, base = this.HZ + H * 0.2;
    for (const L of this.mtns) {
      const period = L.period * H;
      const off = (((this.bgX * L.par * H) % period) + period) % period;
      const body = U.rgb(U.mix(L.near ? p.mtnNear : p.mtnFar, p.fog, L.near ? 0.05 : 0.25));
      const snow = U.rgb(U.mix(p.mtnSnow, p.fog, L.near ? 0.05 : 0.25));
      for (const pk of L.peaks) {
        const hw = pk.w * H;
        let x = pk.x * period - off;
        while (x > -hw) x -= period;
        for (; x < W + hw; x += period) {
          if (x < -hw) continue;
          const top = this.HZ - pk.h * H - (L.near ? 0 : H * 0.03);
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
      this.drawSeg(c, s);
      maxy = s.p2.sy;
    }

    for (const e of G.entities) {
      const len = ET[e.type].len || 0;
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

  drawSeg(c, s) {
    const p1 = s.p1, p2 = s.p2, f = s.fog;
    const top = Math.floor(p2.sy);
    c.fillStyle = this.col(s.band ? 'offA' : 'offB', f);
    c.fillRect(-this.W * 0.25, top, this.W * 1.5, Math.ceil(p1.sy) - top + 1);
    this.trap(c, p1.sx, p1.sy, p1.w * 1.12, p2.sx, p2.sy, p2.w * 1.12, this.col('bank', f));
    this.trap(c, p1.sx, p1.sy, p1.w, p2.sx, p2.sy, p2.w, this.col(s.band ? 'snowA' : 'snowB', f));
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
      const h = 1000 * d.s * sc;
      if (h < 2) { c.globalAlpha = 1; return; }
      const w = h * 0.5;
      if (sx + w < 0 || sx - w > this.W) { c.globalAlpha = 1; return; }
      this.withClip(c, s, sy, () => c.drawImage(Art.trees[d.v], sx - w / 2, sy - h, w, h));
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
  drawFlat(c, s, e, G, def) {
    const T = G.track, SL = CFG.SEG_LEN;
    const shiftAt = z => {
      const sg = T.get(Math.floor(z / SL));
      return U.lerp(sg.p1.shift || 0, sg.p2.shift || 0, z / SL - sg.i);
    };
    const gp = (dx, dz) => {
      const z = e.z + dz, cz = Math.max(40, z - G.cam.z), sc = this.F / cz;
      return [this.W / 2 + (shiftAt(z) + e.x * CFG.ROAD_W + dx - G.cam.x) * sc, this.HZ + (G.cam.y - T.groundY(z)) * sc];
    };
    if (e.z + (def.len || 0) - G.cam.z < 40) return;
    c.globalAlpha = 1 - s.fog * 0.85;
    def.drawFlat(c, gp, e, G.time);
    c.globalAlpha = 1;
  },

  drawPlayer(c, G) {
    const P = G.player, k = this.k;
    const gy = G.track.groundY(P.z);
    const sx = this.W / 2 + (this.playerShift + P.x * CFG.ROAD_W - G.cam.x) * k;
    const sy = this.HZ + (G.cam.y - gy) * k;
    this.playerScreen = { x: sx, gy: sy, y: sy - P.air * k, k };
    P.draw(c, sx, sy, k, G);
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
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineCap = 'round';
    for (const f of this.flakes) {
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
