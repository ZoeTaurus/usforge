'use strict';
/* The nest seen in cross-section: tunnels, chambers, the queen and her brood. */

const NEST_W = 1000, NEST_H = 720, SURFACE = 110;
const NEST_NODES = {
  E: [500, 70], A: [500, 190], A2: [330, 215], A3: [670, 215],
  barracks: [215, 250], infirmary: [790, 240], special: [500, 310],
  C: [500, 410], N1: [380, 440], G1: [630, 425],
  nursery: [250, 455], granary: [760, 445], royal: [500, 600],
};
const NEST_EDGES = [['E', 'A'], ['A', 'A2'], ['A2', 'barracks'], ['A', 'A3'], ['A3', 'infirmary'], ['A', 'special'], ['special', 'C'], ['C', 'N1'], ['N1', 'nursery'], ['C', 'G1'], ['G1', 'granary'], ['C', 'royal']];
const NEST_ROOMS = {
  special: { rx: 108, ry: 46 }, barracks: { rx: 100, ry: 44 }, infirmary: { rx: 96, ry: 42 },
  nursery: { rx: 124, ry: 54 }, granary: { rx: 124, ry: 56 }, royal: { rx: 134, ry: 60 },
};

class NestView {
  constructor(game) {
    this.game = game;
    this.bg = null; this.bgKey = '';
    this.agents = [];
    this.hover = null;
    this.selected = 'royal';
    this.adj = {};
    for (const [a, b] of NEST_EDGES) { (this.adj[a] ||= []).push(b); (this.adj[b] ||= []).push(a); }
  }

  roomKey(k) { return k === 'special' ? this.game.home.special : k; }
  roomOpen(k) { return this.game.home.chambers[this.roomKey(k)] > 0; }

  layout() {
    const g = this.game;
    const side = g.vw > 760 ? 310 : 0, bottom = side ? 0 : g.vh * 0.42;
    const top = side ? 0 : 150;
    const s = Math.min((g.vw - side - 20) / NEST_W, (g.vh - bottom - top - 20) / NEST_H);
    const ox = (g.vw - side - NEST_W * s) / 2, oy = top + (g.vh - bottom - top - NEST_H * s) / 2;
    return { s, ox, oy };
  }

  toNest(px, py) {
    const { s, ox, oy } = this.layout();
    return [(px - ox) / s, (py - oy) / s];
  }

  hit(px, py) {
    const [x, y] = this.toNest(px, py);
    for (const k in NEST_ROOMS) {
      const [cx, cy] = NEST_NODES[k], r = NEST_ROOMS[k];
      if (((x - cx) / r.rx) ** 2 + ((y - cy) / r.ry) ** 2 < 1.15) return k;
    }
    return null;
  }

  spawnAgents() {
    const n = clamp(Math.round(this.game.counts.home / 2), 6, 28);
    while (this.agents.length < n) {
      const open = NEST_EDGES.filter(([a, b]) => (!NEST_ROOMS[a] || this.roomOpen(a)) && (!NEST_ROOMS[b] || this.roomOpen(b)));
      const e = pick(open);
      this.agents.push({ from: e[0], to: e[1], t: Math.random(), speed: rand(40, 70), wait: 0, id: UID++, carry: Math.random() < 0.3 ? pick(['egg', 'crumb']) : null, gait: 0, a: 0, x: 0, y: 0 });
    }
    this.agents.length = n;
  }

  update(dt) {
    this.spawnAgents();
    for (const ag of this.agents) {
      const a = NEST_NODES[ag.from], b = NEST_NODES[ag.to];
      if (ag.wait > 0) {
        ag.wait -= dt;
        ag.gait += dt * 2;
        ag.a += Math.sin(this.game.time * 2 + ag.id) * dt;
        continue;
      }
      const len = dist(a[0], a[1], b[0], b[1]);
      ag.t += (ag.speed * dt) / len;
      ag.gait += ag.speed * dt * 0.3;
      if (ag.t >= 1) {
        const opts = this.adj[ag.to].filter((n) => n !== ag.from && (!NEST_ROOMS[n] || this.roomOpen(n)));
        const next = opts.length ? pick(opts) : ag.from;
        if (NEST_ROOMS[ag.to]) ag.wait = rand(1, 3.5);
        ag.from = ag.to; ag.to = next; ag.t = 0;
        if (NEST_ROOMS[ag.from] && Math.random() < 0.4) ag.carry = ag.from === 'granary' ? 'crumb' : ag.from === 'nursery' || ag.from === 'royal' ? 'egg' : null;
      }
      const p0 = NEST_NODES[ag.from], p1 = NEST_NODES[ag.to];
      ag.x = lerp(p0[0], p1[0], ag.t); ag.y = lerp(p0[1], p1[1], ag.t);
      ag.a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    }
  }

  buildBg(s) {
    const g = this.game;
    const key = `${s.toFixed(4)}:${g.home.species}`;
    if (this.bg && this.bgKey === key) return;
    this.bgKey = key;
    const c = document.createElement('canvas');
    c.width = Math.ceil(NEST_W * s * g.dpr); c.height = Math.ceil(NEST_H * s * g.dpr);
    const x = c.getContext('2d');
    x.scale(s * g.dpr, s * g.dpr);
    const R = mulberry32(42);
    const soil = x.createLinearGradient(0, SURFACE, 0, NEST_H);
    soil.addColorStop(0, '#5a4128'); soil.addColorStop(0.25, '#6e4c2c'); soil.addColorStop(0.6, '#7a5634'); soil.addColorStop(1, '#4a3420');
    x.fillStyle = soil; x.fillRect(0, SURFACE, NEST_W, NEST_H - SURFACE);
    for (let i = 0; i < 6; i++) {
      x.fillStyle = `rgba(${i % 2 ? '40,25,12' : '150,110,70'},0.08)`;
      x.beginPath(); x.moveTo(0, SURFACE + 60 + i * 95);
      for (let k = 0; k <= 10; k++) x.lineTo(k * 100, SURFACE + 60 + i * 95 + Math.sin(k * 0.9 + i) * 18);
      x.lineTo(NEST_W, NEST_H); x.lineTo(0, NEST_H); x.closePath(); x.fill();
    }
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = R() < 0.5 ? 'rgba(30,18,8,0.3)' : 'rgba(190,150,100,0.18)';
      x.beginPath(); x.arc(R() * NEST_W, SURFACE + R() * (NEST_H - SURFACE), 0.6 + R() * 1.6, 0, TAU); x.fill();
    }
    for (let i = 0; i < 26; i++) {
      const px = R() * NEST_W, py = SURFACE + 40 + R() * (NEST_H - SURFACE - 40), pr = 4 + R() * 14;
      const gr = x.createRadialGradient(px - pr * 0.3, py - pr * 0.4, 1, px, py, pr);
      gr.addColorStop(0, '#b8aa96'); gr.addColorStop(1, '#5a5048');
      x.fillStyle = gr; x.beginPath(); x.ellipse(px, py, pr * 1.2, pr, R() * 3, 0, TAU); x.fill();
    }
    x.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let px = R() * NEST_W, py = SURFACE, a = Math.PI / 2 + (R() - 0.5) * 0.6, w = 6 + R() * 5;
      for (let k = 0; k < 14 && w > 0.5; k++) {
        const nx = px + Math.cos(a) * 18, ny = py + Math.sin(a) * 18;
        x.strokeStyle = '#3a2614'; x.lineWidth = w;
        x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
        x.strokeStyle = 'rgba(200,160,110,0.25)'; x.lineWidth = w * 0.3;
        x.beginPath(); x.moveTo(px - 1, py); x.lineTo(nx - 1, ny); x.stroke();
        px = nx; py = ny; a += (R() - 0.5) * 0.6; w *= 0.86;
      }
    }
    this.bg = c;
  }

  render(ctx) {
    const g = this.game, t = g.time, home = g.home;
    const { s, ox, oy } = this.layout();
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(0, 0, g.vw, g.vh);
    this.buildBg(s);
    ctx.drawImage(this.bg, ox, oy, NEST_W * s, NEST_H * s);
    ctx.setTransform(g.dpr * s, 0, 0, g.dpr * s, g.dpr * ox, g.dpr * oy);
    // sky and surface
    const dark = g.darkness();
    const sky = ctx.createLinearGradient(0, 0, 0, SURFACE);
    sky.addColorStop(0, dark > 0.3 ? '#0e1430' : '#8ec4e0');
    sky.addColorStop(1, dark > 0.3 ? '#2a3050' : '#cfe6d8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, NEST_W, SURFACE);
    if (g.weather.k > 0.05) {
      ctx.strokeStyle = `rgba(200,220,240,${0.4 * g.weather.k})`; ctx.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const rx = (i * 97 + t * 400) % NEST_W, ry = (i * 53 + t * 700) % SURFACE;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 12); ctx.stroke();
      }
    }
    ctx.fillStyle = '#4e6e2a';
    ctx.beginPath(); ctx.moveTo(0, SURFACE);
    for (let k = 0; k <= 100; k++) ctx.lineTo(k * 10, SURFACE - 4 - ((k * 37) % 11) - Math.sin(k + t * 1.5) * 1.5);
    ctx.lineTo(NEST_W, SURFACE + 6); ctx.lineTo(0, SURFACE + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath(); ctx.ellipse(500, SURFACE + 2, 90, 26, 0, Math.PI, TAU); ctx.fill();
    // tunnels
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [[30, '#24170c'], [24, '#3a2716'], [16, '#2c1d10']]) {
      ctx.strokeStyle = pass[1]; ctx.lineWidth = pass[0];
      for (const [a, b] of NEST_EDGES) {
        const open = (!NEST_ROOMS[a] || this.roomOpen(a)) && (!NEST_ROOMS[b] || this.roomOpen(b));
        ctx.setLineDash(open ? [] : [4, 10]);
        ctx.globalAlpha = open ? 1 : 0.35;
        ctx.beginPath(); ctx.moveTo(...NEST_NODES[a]); ctx.lineTo(...NEST_NODES[b]); ctx.stroke();
      }
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // rooms
    for (const k in NEST_ROOMS) this.drawRoom(ctx, k, t);
    // workers walking the tunnels
    for (const ag of this.agents) {
      const e = { x: ag.x, y: ag.y, a: ag.a, size: 1.5 * home.sp.shape.size, sp: home.species, role: 'worker', gait: ag.gait, hurtT: 0, greetT: ag.wait > 0 ? 1 : 0, biteT: 0, id: ag.id, carry: null };
      drawAnt(ctx, e, t);
      if (ag.carry) {
        const hx = ag.x + Math.cos(ag.a) * 16, hy = ag.y + Math.sin(ag.a) * 16;
        if (ag.carry === 'egg') this.egg(ctx, hx, hy, 1);
        else { ctx.fillStyle = '#e6c88a'; ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, TAU); ctx.fill(); }
      }
    }
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  }

  egg(ctx, x, y, k) {
    const gr = ctx.createRadialGradient(x - 1 * k, y - 1 * k, 0.3, x, y, 4 * k);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d8d0b8');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, 3.4 * k, 2.3 * k, 0.3, 0, TAU); ctx.fill();
  }

  larva(ctx, x, y, k) {
    ctx.strokeStyle = '#f2ead6'; ctx.lineWidth = 5 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, 4.5 * k, 0.4, Math.PI * 1.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,140,110,0.5)'; ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const a = 0.5 + i * 0.75;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 2.2 * k, y + Math.sin(a) * 2.2 * k); ctx.lineTo(x + Math.cos(a) * 6.8 * k, y + Math.sin(a) * 6.8 * k); ctx.stroke();
    }
    ctx.fillStyle = '#c8a878'; ctx.beginPath(); ctx.arc(x + Math.cos(0.4) * 4.5 * k, y + Math.sin(0.4) * 4.5 * k, 1.8 * k, 0, TAU); ctx.fill();
  }

  pupa(ctx, x, y, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const gr = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, 10);
    gr.addColorStop(0, '#f0dcb0'); gr.addColorStop(1, '#a8885a');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, 10, 5.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(110,80,40,0.35)'; ctx.lineWidth = 0.6;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 3, -5); ctx.quadraticCurveTo(k * 3 + 1, 0, k * 3, 5); ctx.stroke(); }
    ctx.restore();
  }

  drawRoom(ctx, k, t) {
    const g = this.game, home = g.home;
    const key = this.roomKey(k), [x, y] = NEST_NODES[k], r = NEST_ROOMS[k];
    const lvl = home.chambers[key], open = lvl > 0;
    const hot = this.hover === k || this.selected === k;
    if (!open) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = hot ? 'rgba(255,214,120,0.9)' : 'rgba(240,220,180,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, r.rx, r.ry, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(240,220,180,0.8)';
      ctx.font = '700 15px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`Dig ${CHAMBERS[key].name.toLowerCase()}`, x, y - 2);
      ctx.font = '400 13px "Atkinson Hyperlegible", sans-serif';
      ctx.fillText(`${home.upgradeCost(key)} food`, x, y + 16);
      return;
    }
    ctx.fillStyle = 'rgba(15,8,2,0.5)';
    ctx.beginPath(); ctx.ellipse(x, y + 4, r.rx + 6, r.ry + 6, 0, 0, TAU); ctx.fill();
    const gr = ctx.createRadialGradient(x, y - r.ry * 0.3, 4, x, y, r.rx);
    gr.addColorStop(0, '#4a3220'); gr.addColorStop(0.7, '#2e1e10'); gr.addColorStop(1, '#1e1208');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, r.rx, r.ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = hot ? 'rgba(255,214,120,0.85)' : 'rgba(200,160,110,0.35)'; ctx.lineWidth = hot ? 2.5 : 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, r.rx, r.ry, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y, r.rx - 2, r.ry - 2, 0, 0, TAU); ctx.clip();
    const floor = y + r.ry * 0.55;
    const sp = home.species;
    switch (key) {
      case 'royal': {
        const breathe = 1 + Math.sin(t * 2) * 0.02;
        drawAnt(ctx, { x: x + 10, y: floor - 18, a: Math.PI + 0.1, size: 3.1 * breathe * home.sp.shape.size, sp, queen: true, role: 'worker', gait: 0.3, hurtT: 0, greetT: 1, biteT: 0, id: 1 }, t);
        const eggs = home.brood.filter((b) => b.stage === 'egg').length + 3;
        for (let i = 0; i < eggs; i++) this.egg(ctx, x - 70 + (i % 6) * 8, floor - 4 - Math.floor(i / 6) * 5, 1.2);
        for (let i = 0; i < 2; i++) {
          const a = t * 0.6 + i * Math.PI;
          drawAnt(ctx, { x: x + 10 + Math.cos(a) * 70, y: floor - 16 + Math.sin(a) * 10, a: a + Math.PI / 2, size: 1.4 * home.sp.shape.size, sp, role: 'worker', gait: t * 8, hurtT: 0, greetT: 1, biteT: 0, id: 5 + i }, t);
        }
        break;
      }
      case 'nursery': {
        const list = home.brood;
        list.forEach((b, i) => {
          const bx = x - r.rx + 26 + (i % 7) * 30, by = floor - 6 - Math.floor(i / 7) * 22;
          if (b.stage === 'egg') this.egg(ctx, bx, by, 1.4);
          else if (b.stage === 'larva') this.larva(ctx, bx, by, 0.9 + (b.t - 5) / 14);
          else this.pupa(ctx, bx, by, 0.2);
          ctx.fillStyle = b.role === 'soldier' ? 'rgba(255,140,100,0.85)' : 'rgba(0,0,0,0)';
          ctx.beginPath(); ctx.arc(bx, by - 9, 2, 0, TAU); ctx.fill();
        });
        if (!list.length) {
          ctx.fillStyle = 'rgba(240,220,180,0.55)'; ctx.font = '400 13px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('No brood. The queen needs food to lay.', x, y + 4);
        }
        break;
      }
      case 'granary': {
        const n = Math.round((home.food / Math.max(1, home.foodCap)) * 90);
        const R = mulberry32(7);
        for (let i = 0; i < n; i++) {
          const px = x + (R() - 0.5) * r.rx * 1.6 * (1 - i / 140), py = floor - 4 - (i / 90) * r.ry * 0.9 * R();
          const kind = R();
          if (kind < 0.4) { ctx.fillStyle = '#e2c486'; ctx.beginPath(); ctx.arc(px, py, 3.2, 0, TAU); ctx.fill(); }
          else if (kind < 0.75) { ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.ellipse(px, py, 4, 2, R() * 3, 0, TAU); ctx.fill(); }
          else { radialFill(ctx, px, py, 3, [[0, '#fff0b0'], [0.5, '#ffc444'], [1, '#b8700a']]); }
        }
        break;
      }
      case 'barracks': {
        const n = Math.min(8, g.counts.homeSoldiers);
        for (let i = 0; i < n; i++) {
          drawAnt(ctx, { x: x - 70 + i * 20, y: floor - 12 - (i % 2) * 8, a: -Math.PI / 2 + (i % 3 - 1) * 0.3, size: 1.3 * 1.3 * home.sp.shape.size, sp, role: 'soldier', gait: 1, hurtT: 0, greetT: 0, biteT: 0, id: 20 + i }, t);
        }
        break;
      }
      case 'infirmary': {
        radialFill(ctx, x, y, r.rx * 0.8, [[0, `rgba(180,255,170,${0.2 + 0.08 * Math.sin(t * 2)})`], [1, 'rgba(180,255,170,0)']]);
        drawAnt(ctx, { x, y: floor - 14, a: 0.1, size: 1.5 * home.sp.shape.size, sp, role: 'worker', gait: 0.5, hurtT: 0, greetT: 1, biteT: 0, id: 30 }, t);
        break;
      }
      case 'fungus': {
        const R = mulberry32(9);
        const n = 30 + lvl * 25;
        for (let i = 0; i < n; i++) {
          const px = x + (R() - 0.5) * r.rx * 1.5, py = floor - R() * r.ry * (0.5 + lvl * 0.25);
          radialFill(ctx, px, py, 6 + R() * 8, [[0, '#f4f0e6'], [0.7, '#c8c0b0'], [1, 'rgba(160,150,140,0)']]);
        }
        const leaves = Math.min(30, Math.ceil(home.leaves));
        for (let i = 0; i < leaves; i++) {
          ctx.fillStyle = i % 2 ? '#6aa040' : '#4e8a30';
          ctx.beginPath(); ctx.ellipse(x - r.rx + 20 + (i % 10) * 9, floor - 4 - Math.floor(i / 10) * 6, 4, 2.4, i, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'honeypot': {
        for (let i = 0; i < lvl * 4; i++) {
          const px = x - r.rx * 0.7 + i * (r.rx * 1.4 / Math.max(1, lvl * 4 - 1)), py = y - r.ry + 18;
          drawAnt(ctx, { x: px, y: py - 6, a: -Math.PI / 2, size: 1.1, sp, role: 'worker', gait: 1, hurtT: 0, greetT: 0, biteT: 0, id: 40 + i }, t);
          radialFill(ctx, px, py + 14, 11, [[0, '#ffe9a0'], [0.45, '#f0a828'], [1, '#8a5008']]);
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(px - 3, py + 10, 2.4, 0, TAU); ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(250,236,200,0.9)';
    ctx.font = '800 15px Sniglet, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(CHAMBERS[key].name, x, y - r.ry - 10);
    for (let i = 0; i < CHAMBERS[key].max; i++) {
      ctx.fillStyle = i < lvl ? '#f4b740' : 'rgba(250,236,200,0.25)';
      ctx.beginPath(); ctx.arc(x - (CHAMBERS[key].max - 1) * 6 + i * 12, y - r.ry + 2, 3.5, 0, TAU); ctx.fill();
    }
  }
}
