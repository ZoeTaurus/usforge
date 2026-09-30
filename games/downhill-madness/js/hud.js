'use strict';
const INK = '#101a3a';

const HUD = {
  pops: [],
  bannerMsg: null,

  reset() { this.pops.length = 0; this.bannerMsg = null; },

  pop(text, color = '#ffffff', size = 1, sub = '') {
    this.pops.unshift({ text, color, size, sub, t: 0, life: 1.8 });
    if (this.pops.length > 4) this.pops.length = 4;
  },

  banner(text, color = '#ff3b30', life = 2.4) { this.bannerMsg = { text, color, t: 0, life }; },

  update(dt) {
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter(p => p.t < p.life);
    if (this.bannerMsg) {
      this.bannerMsg.t += dt;
      if (this.bannerMsg.t > this.bannerMsg.life) this.bannerMsg = null;
    }
  },

  text(c, str, x, y, size, fill, opt = {}) {
    c.font = `${size}px ${opt.font || '"Luckiest Guy", Impact, sans-serif'}`;
    c.textAlign = opt.align || 'center';
    c.lineJoin = 'round';
    if (opt.stroke !== false) {
      c.lineWidth = size * (opt.sw || 0.2);
      c.strokeStyle = opt.stroke || INK;
      c.strokeText(str, x, y);
    }
    c.fillStyle = fill;
    c.fillText(str, x, y);
  },

  label(c, str, x, y, size, fill, align = 'left') {
    this.text(c, str, x, y, size, fill, { font: 'Bungee, "Arial Black", sans-serif', align, sw: 0.28 });
  },

  roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  },

  draw(c, G) {
    const W = Render.W, H = Render.H;
    const u = Math.min(W, H * 1.7) / 100;
    const top = u * 1.2 + 8 * Render.dpr;

    if (G.state === 'play' || G.state === 'caught' || G.state === 'paused') {
      const P = G.player;
      // score + combo
      this.label(c, 'SCORE', u * 2, top + u * 1.4, u * 1.3, '#dff3ff');
      this.text(c, U.fmt(G.score), u * 2, top + u * 5, u * 3.6, '#ffffff', { align: 'left' });
      this.label(c, `${U.fmt(G.dist)} m`, u * 2, top + u * 7.2, u * 1.4, '#dff3ff');
      if (G.combo > 1) {
        const pulse = 1 + Math.sin(G.time * 10) * 0.04;
        this.text(c, `×${G.combo} COMBO`, u * 2, top + u * 10.2, u * 2.5 * pulse, '#ffd23f', { align: 'left' });
        c.fillStyle = 'rgba(16,26,58,0.6)';
        c.fillRect(u * 2, top + u * 11, u * 14, u * 0.6);
        c.fillStyle = '#ffd23f';
        c.fillRect(u * 2, top + u * 11, u * 14 * U.clamp(G.comboT / 5, 0, 1), u * 0.6);
      }

      // speed + madness
      const kmh = Math.round(P.speed * CFG.KMH);
      const heat = U.clamp((kmh - 80) / 260, 0, 1);
      const spCol = `hsl(${50 - heat * 50},100%,${70 - heat * 12}%)`;
      this.text(c, String(kmh), W - u * 7.4, top + u * 5, u * 4.4, spCol, { align: 'right' });
      this.label(c, 'KM/H', W - u * 2, top + u * 5, u * 1.3, '#dff3ff', 'right');
      const lvlTxt = `MADNESS ${G.level} · ${levelName(G.level).toUpperCase()}`;
      c.font = `${u * 1.25}px Bungee, sans-serif`;
      const lw = c.measureText(lvlTxt).width + u * 2;
      const lx = W - u * 2 - lw, ly = top + u * 6.6;
      c.fillStyle = `hsl(${(G.level * 47) % 360},85%,55%)`;
      this.roundRect(c, lx, ly, lw, u * 2.4, u * 1.2); c.fill();
      c.lineWidth = u * 0.3; c.strokeStyle = INK; c.stroke();
      this.text(c, lvlTxt, lx + lw / 2, ly + u * 1.7, u * 1.25, '#ffffff', { font: 'Bungee, sans-serif', sw: 0.3 });
      const prog = (G.dist % CFG.LEVEL_METERS) / CFG.LEVEL_METERS;
      c.fillStyle = 'rgba(16,26,58,0.6)'; c.fillRect(lx, ly + u * 2.8, lw, u * 0.45);
      c.fillStyle = '#ffffff'; c.fillRect(lx, ly + u * 2.8, lw * prog, u * 0.45);

      this.drawAvalancheMeter(c, G, u, top);
      this.drawPowers(c, G, u, top + u * 14.5);

      // live trick readout
      if (P.airborne && P.crash <= 0) {
        const f = Math.floor(Math.abs(P.flip) / TAU + 0.2), s = Math.floor(Math.abs(P.spin) / TAU + 0.2);
        const bits = [];
        if (f) bits.push(`${f}× ${P.flip < 0 ? 'BACKFLIP' : 'FRONTFLIP'}`);
        if (s) bits.push(`${s * 360}`);
        if (P.grab) bits.push('SUPERMAN');
        const str = bits.length ? bits.join(' + ') : `AIR ${P.airTime.toFixed(1)}s`;
        this.text(c, str, W / 2, H * 0.965, u * 2.2, bits.length ? '#7dfcff' : '#ffffff');
      }
    }

    // countdown
    if (G.state === 'play' && G.intro > 0) {
      const n = Math.ceil(G.intro);
      const f = G.intro - Math.floor(G.intro);
      this.text(c, String(n), W / 2, H * 0.42, u * (9 + f * 4), '#ffd23f', { sw: 0.14 });
      this.label(c, '↑ TUCK   ·   SPACE HOP   ·   ARROWS IN THE AIR = FLIPS', W / 2, H * 0.52, u * 1.3, '#ffffff', 'center');
    }

    // banner
    const b = this.bannerMsg;
    if (b && (G.state === 'play' || G.state === 'caught')) {
      const show = Math.floor(b.t * 6) % 2 === 0 || b.t > 0.8;
      if (show) {
        const y = H * 0.2;
        c.font = `${u * 2.6}px "Luckiest Guy", Impact, sans-serif`;
        const bw = c.measureText(b.text).width + u * 6;
        c.save();
        c.translate(W / 2, y);
        c.rotate(-0.03);
        c.fillStyle = b.color;
        c.fillRect(-bw / 2, -u * 2.4, bw, u * 3.6);
        c.fillStyle = INK;
        for (let i = -bw / 2; i < bw / 2; i += u * 3) c.fillRect(i, -u * 2.4, u * 1.5, u * 0.5);
        for (let i = -bw / 2 + u * 1.5; i < bw / 2; i += u * 3) c.fillRect(i, u * 0.7, u * 1.5, u * 0.5);
        this.text(c, b.text, 0, u * 0.3, u * 2.6, '#ffffff', { sw: 0.22 });
        c.restore();
      }
    }

    // pops
    let y = H * 0.3;
    for (const p of this.pops) {
      const inT = Math.min(1, p.t / 0.18);
      const sc = inT < 1 ? 0.4 + inT * 0.8 : 1.2 - Math.min(0.2, (p.t - 0.18) * 1.5);
      const alpha = Math.min(1, (p.life - p.t) / 0.35);
      c.globalAlpha = alpha;
      const size = u * 3.2 * p.size * sc;
      c.save();
      c.translate(W / 2, y);
      c.rotate(Math.sin(p.t * 8 + p.text.length) * 0.03);
      this.text(c, p.text, 0, 0, size, p.color, { sw: 0.18 });
      if (p.sub) this.label(c, p.sub, 0, size * 0.62, u * 1.3, '#ffffff', 'center');
      c.restore();
      y += u * 3.2 * p.size + (p.sub ? u * 2 : u * 0.8);
      c.globalAlpha = 1;
    }
  },

  drawPowers(c, G, u, y) {
    const pw = G.player.pw;
    let x = u * 4.2;
    for (const k of ['shield', 'magnet', 'rocket', 'double']) {
      const v = pw[k];
      if (v <= 0) continue;
      const r = u * 2.1;
      const blink = v < 2 && Math.floor(G.time * 8) % 2;
      c.save();
      c.translate(x, y);
      if (blink) c.globalAlpha = 0.4;
      drawPowerIcon(c, k, r);
      c.strokeStyle = '#ffffff'; c.lineWidth = u * 0.45;
      c.beginPath(); c.arc(0, 0, r * 1.18, -Math.PI / 2, -Math.PI / 2 + TAU * (v / POWERS[k].dur)); c.stroke();
      c.restore();
      x += u * 5.4;
    }
  },

  drawAvalancheMeter(c, G, u, top) {
    const W = Render.W;
    const mw = Math.min(u * 32, W * 0.34), mh = u * 1.5, mx = W / 2 - mw / 2, my = top + u * 0.6;
    const gapM = Math.max(0, G.gap / CFG.METER);
    const frac = U.clamp(gapM / CFG.AVA_MAX_M, 0, 1);
    const danger = gapM < 50;
    c.fillStyle = 'rgba(16,26,58,0.6)';
    this.roundRect(c, mx, my, mw, mh, mh / 2); c.fill();
    const g = c.createLinearGradient(mx, 0, mx + mw * frac, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, danger ? '#ff3b30' : '#9fd3ff');
    c.fillStyle = g;
    this.roundRect(c, mx, my, Math.max(mh, mw * frac), mh, mh / 2); c.fill();
    const px = mx + mw * frac;
    Art.circ(c, px, my + mh / 2, mh * 0.95, '#ff5a1f');
    c.lineWidth = u * 0.3; c.strokeStyle = INK;
    c.beginPath(); c.arc(px, my + mh / 2, mh * 0.95, 0, TAU); c.stroke();
    const flash = danger && Math.floor(G.time * 6) % 2 === 0;
    this.label(c, `AVALANCHE  ${Math.floor(gapM)} m BEHIND`, W / 2, my + mh + u * 2.1, u * 1.2, flash ? '#ff3b30' : '#ffffff', 'center');
    if (G.surge > 0) this.label(c, 'SURGING!', W / 2, my + mh + u * 3.8, u * 1.2, '#ffd23f', 'center');
  },
};
