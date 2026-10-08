'use strict';
// ---------------------------------------------------------------------------
// In-battle HUD: health bars, portraits, timer, POW meter, combo counter,
// round banners and the super cut-in.
// ---------------------------------------------------------------------------

const HUD = {
  draw(ctx, b) {
    const [a, c] = b.fighters;
    HUD.healthBar(ctx, b, a, 0);
    HUD.healthBar(ctx, b, c, 1);
    HUD.timer(ctx, b);
    HUD.combo(ctx, b, 0);
    HUD.combo(ctx, b, 1);
    if (b.superInfo) HUD.cutin(ctx, b);
    if (b.banner) HUD.banner(ctx, b);
    if (b.training) HUD.trainingInfo(ctx, b);
  },

  // Angular bar: a parallelogram whose inner end leans toward the timer.
  barPts(L, x0, x1, y0, y1, k = 0.5) {
    const W = 1280, mx = (x) => (L ? x : W - x);
    const sl = (y1 - y0) * k;
    return [mx(x0 + sl), y0, mx(x1), y0, mx(x1 - sl), y1, mx(x0), y1];
  },
  path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  },
  // fill a bar from its outer end to fraction r
  barFill(ctx, L, x0, x1, y0, y1, r, col) {
    if (r <= 0) return;
    const w = (x1 - x0 + 40) * r;
    ctx.fillStyle = col;
    if (L) ctx.fillRect(x0 - 20, y0, w, y1 - y0);
    else ctx.fillRect(1280 - x0 + 20 - w, y0, w, y1 - y0);
  },

  healthBar(ctx, b, f, side) {
    const L = side === 0;
    const mx = (x) => (L ? x : 1280 - x);
    const x0 = 126, x1 = 594, y0 = 28, y1 = 58;
    // health
    ctx.save();
    HUD.path(ctx, HUD.barPts(L, x0 - 6, x1 + 7, y0 - 5, y1 + 5));
    ctx.fillStyle = INK;
    ctx.fill();
    const pts = HUD.barPts(L, x0, x1, y0, y1);
    HUD.path(ctx, pts);
    ctx.fillStyle = '#3a2a4f';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const ratio = f.hp / f.maxHp, rr = f.redHp / f.maxHp;
    HUD.barFill(ctx, L, x0, x1, y0, y1, rr, '#ff4d6d');
    const low = ratio < 0.3;
    const pulse = low ? 0.5 + 0.5 * Math.sin(b.frame * 0.25) : 0;
    HUD.barFill(ctx, L, x0, x1, y0, y1, ratio, low ? U.mix('#ff7a2e', '#ffd23f', pulse) : '#ffd23f');
    HUD.barFill(ctx, L, x0, x1, y1 - 7, y1, ratio, low ? 'rgba(170,40,20,0.35)' : '#f2a516');
    HUD.barFill(ctx, L, x0, x1, y0 + 4, y0 + 8, ratio, 'rgba(255,255,255,0.45)');
    ctx.restore();
    ctx.restore();

    // POW meter under the health bar (one super's worth)
    const m0 = 150, m1 = 470, n0 = 66, n1 = 80;
    const full = f.meter >= 100;
    HUD.path(ctx, HUD.barPts(L, m0 - 5, m1 + 5, n0 - 4, n1 + 4, 0.8));
    ctx.fillStyle = INK;
    ctx.fill();
    const mp = HUD.barPts(L, m0, m1, n0, n1, 0.8);
    HUD.path(ctx, mp);
    ctx.fillStyle = '#2a1d3d';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const glow = full ? 0.5 + 0.5 * Math.sin(b.frame * 0.3) : 0;
    HUD.barFill(ctx, L, m0, m1, n0, n1, f.meter / 100, full ? U.mix('#c45cff', '#ff8af0', glow) : '#9b5cff');
    HUD.barFill(ctx, L, m0, m1, n0 + 2, n0 + 5, f.meter / 100, 'rgba(255,255,255,0.4)');
    if (full) {
      const sx = (b.frame * 7) % 420;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(L ? m0 - 40 + sx : 1280 - m0 + 40 - sx - 16, n0, 16, n1 - n0);
    }
    ctx.restore();
    if (b.meterFlash[side] > 0) {
      ctx.save();
      ctx.globalAlpha = b.meterFlash[side] / 40;
      HUD.path(ctx, HUD.barPts(L, m0 - 8, m1 + 8, n0 - 7, n1 + 7, 0.8));
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }
    if (full) {
      const a = 0.6 + 0.4 * Math.sin(b.frame * 0.3);
      Draw.text(ctx, 'SUPER READY!', mx(m0 + 4), 100, { size: 18, align: L ? 'left' : 'right', fill: '#ff9af2', lw: 5, alpha: a });
    }

    // round hearts
    for (let i = 0; i < b.roundsToWin; i++) {
      const won = f.wins > i;
      Draw.heart(ctx, mx(498 + i * 30), 76, 24, won ? '#ff4d7d' : '#3d2c55', 3, INK);
    }

    // spiky portrait badge with the name underneath
    const px = mx(66), py = 62;
    const spin = b.frame * 0.004 * (L ? 1 : -1);
    Draw.star(ctx, px, py, 58, 47, 14, INK, 0, INK, spin);
    Draw.star(ctx, px, py, 52, 43, 14, f.C.color, 0, INK, spin);
    Draw.circle(ctx, px, py, 40, U.shade(f.C.color, 0.35), 3, INK);
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 38.5, 0, TAU);
    ctx.clip();
    Portrait.head(ctx, f.C, f.pal, px + (L ? 2 : -2), py + 8, 33, L ? 1 : -1, f.hp <= 0 ? 'ko' : f.state === 'hit' || f.state === 'airhit' ? 'hurt' : f.state === 'win' ? 'happy' : 'normal', b.frame);
    ctx.restore();
    const name = f.nameOverride || f.C.name;
    Draw.text(ctx, name, px, 134, { size: name.length > 7 ? 18 : 23, fill: f.nameOverride ? '#d9b3ff' : '#ffffff', lw: 6 });
  },

  timer(ctx, b) {
    const x = 640, y = 52;
    const t = b.timeLimit > 0 && !b.training ? Math.ceil(b.timer / 60) : '∞';
    const urgent = typeof t === 'number' && t <= 10 && b.phase === 'fight';
    const s = urgent ? 1 + 0.08 * Math.max(0, Math.sin(b.frame * 0.2)) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const dia = (r, fill) => Draw.poly(ctx, [0, -r, r, 0, 0, r, -r, 0], fill, 0);
    dia(50, '#ffffff');
    dia(45, urgent ? '#d63048' : INK);
    Draw.text(ctx, String(t), 0, 3, { size: t === '∞' ? 46 : 40, fill: '#ffffff', lw: 0 });
    ctx.restore();
  },

  meter() {
    // drawn with the health bar
  },

  combo(ctx, b, side) {
    const d = b.comboDisplay[side];
    if (!d || d.hits < 2) return;
    const L = side === 0;
    const x = L ? 70 : 1210, y = 250;
    const a = Math.min(1, d.t / 20);
    const pop = 1 + (d.pop / 10) * 0.35;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(L ? -0.08 : 0.08);
    ctx.scale(pop, pop);
    Draw.text(ctx, String(d.hits), 0, 0, { size: 76, align: L ? 'left' : 'right', fill: '#ffd23f', lw: 10, shadow: '#e8590c', sh: 5 });
    const w = Draw.measure(ctx, String(d.hits), 76);
    Draw.text(ctx, 'HITS!', L ? w + 10 : -w - 10, 12, { size: 30, align: L ? 'left' : 'right', fill: '#ffffff', lw: 7 });
    Draw.text(ctx, d.dmg + ' DMG', 0, 52, { size: 22, font: FONT_UI, align: L ? 'left' : 'right', fill: '#ffe9f0', lw: 5 });
    ctx.restore();
  },

  banner(ctx, b) {
    const bn = b.banner;
    const t = bn.t, life = bn.life;
    const fadeOut = t > life - 10 ? (life - t) / 10 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fadeOut);
    if (bn.kind === 'round') {
      const slide = U.ease.out3(Math.min(1, t / 14));
      const bandH = 120;
      ctx.save();
      ctx.translate(640, 330);
      ctx.rotate(-0.06);
      ctx.fillStyle = INK;
      ctx.fillRect(-900 + (1 - slide) * -1400, -bandH / 2 - 8, 1800, bandH + 16);
      ctx.fillStyle = '#ff5a7a';
      ctx.fillRect(-900 + (1 - slide) * 1400, -bandH / 2, 1800, bandH);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 12; i++) ctx.fillRect(-900 + ((i * 160 + t * 8) % 1800), -bandH / 2, 40, bandH);
      ctx.restore();
      const tx = 640 + (1 - slide) * 900;
      Draw.text(ctx, bn.text, tx, 322, { size: 96, fill: '#ffffff', lw: 14, extrude: 8, extrudeColor: '#9c1f45' });
    } else if (bn.kind === 'fight') {
      const s = t < 10 ? U.ease.back(t / 10) * 1.0 : 1 + (t - 10) * 0.004;
      ctx.translate(640, 330);
      ctx.scale(s * 1.0, s * 1.0);
      ctx.rotate(-0.05);
      Draw.text(ctx, bn.text, 0, 0, { size: 150, fill: '#ffd23f', lw: 16, extrude: 10, extrudeColor: '#c2410c' });
    } else {
      const s = t < 12 ? U.ease.back(t / 12) : 1;
      ctx.translate(640, 320);
      ctx.scale(s, s);
      ctx.rotate(-0.04 + Math.sin(t * 0.1) * 0.01);
      const col = bn.kind === 'perfect' ? '#ffd23f' : '#ff4d6d';
      const size = bn.text.length > 6 ? 110 : 160;
      Draw.text(ctx, bn.text, 0, 0, { size, fill: col, lw: 18, extrude: 10, extrudeColor: '#5a1030' });
    }
    ctx.restore();
  },

  cutin(ctx, b) {
    const s = b.superInfo, f = s.f, t = s.t;
    const L = f.x <= b.cam.x;
    const inT = U.ease.out3(Math.min(1, t / 9));
    const outT = t > 40 ? U.ease.in((t - 40) / 10) : 0;
    ctx.save();
    ctx.translate(0, 0);
    const cy = 300;
    const off = (1 - inT) * (L ? -1400 : 1400) + outT * (L ? 1400 : -1400);
    ctx.save();
    ctx.translate(640 + off, cy);
    ctx.rotate(L ? -0.1 : 0.1);
    ctx.fillStyle = INK;
    ctx.fillRect(-1000, -100, 2000, 200);
    ctx.fillStyle = f.C.color;
    ctx.fillRect(-1000, -90, 2000, 180);
    // speed lines
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 18; i++) {
      const ly = -85 + ((i * 47) % 170);
      const lx = ((i * 233 + t * 60 * (L ? 1 : -1)) % 2000) - 1000;
      ctx.fillRect(lx, ly, 160 + (i % 3) * 60, 4);
    }
    ctx.restore();
    // big portrait
    ctx.save();
    ctx.beginPath();
    ctx.save();
    ctx.translate(640 + off, cy);
    ctx.rotate(L ? -0.1 : 0.1);
    ctx.rect(-1000, -90, 2000, 180);
    ctx.restore();
    ctx.clip();
    const hx = L ? 360 + off : 920 + off;
    Portrait.head(ctx, f.C, f.pal, hx, cy + 30, 120, L ? 1 : -1, 'angry', b.frame);
    ctx.restore();
    const nx = L ? 720 + off * 0.6 : 560 + off * 0.6;
    Draw.text(ctx, s.name, nx, cy - 10, { size: 64, fill: '#ffffff', lw: 12, extrude: 6, extrudeColor: INK });
    Draw.text(ctx, f.C.name + ' SUPER!', nx, cy + 50, { size: 30, fill: '#ffd23f', lw: 7 });
    ctx.restore();
  },

  trainingInfo(ctx, b) {
    Draw.text(ctx, 'TRAINING', 640, 124, { size: 22, fill: '#7fe3ff', lw: 5 });
    if (b.trainingOpts) {
      Draw.text(ctx, 'Dummy: ' + b.trainingOpts.dummy.toUpperCase() + '   (Pause for options)', 640, 150, { size: 16, font: FONT_UI, fill: '#ffffff', lw: 4 });
    }
  },
};
