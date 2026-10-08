'use strict';
// ---------------------------------------------------------------------------
// Particles & cartoon effects (hit sparks, dust, comic words, rings...).
// Battle FX use world coords: x = world x, y = height in screen direction
// (negative = up from the floor). Menus can create their own Particles.
// ---------------------------------------------------------------------------

class Particles {
  constructor() {
    this.list = [];
  }
  clear() {
    this.list.length = 0;
  }
  add(p) {
    p.max = p.max || p.life;
    p.age = 0;
    this.list.push(p);
    if (this.list.length > 600) this.list.shift();
    return p;
  }
  update() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.age++;
      p.life--;
      p.x += p.vx || 0;
      p.y += p.vy || 0;
      if (p.grav) p.vy += p.grav;
      if (p.drag) {
        p.vx *= p.drag;
        p.vy *= p.drag;
      }
      if (p.vr) p.rot = (p.rot || 0) + p.vr;
    }
    this.list = L.filter((p) => p.life > 0);
  }
  // ox, oy: screen position of world (0, floor)
  draw(ctx, ox, oy, layer) {
    for (const p of this.list) {
      if ((p.layer || 0) !== (layer || 0)) continue;
      const x = ox + p.x, y = oy + p.y;
      const t = p.age / p.max; // 0 -> 1
      ctx.save();
      switch (p.type) {
        case 'spark': FXDraw.spark(ctx, p, x, y, t); break;
        case 'streak': FXDraw.streak(ctx, p, x, y, t); break;
        case 'dot': {
          ctx.globalAlpha = 1 - t * t;
          Draw.circle(ctx, x, y, p.size * (1 - t * 0.5), p.color, p.lw !== undefined ? p.lw : 2.5);
          break;
        }
        case 'star': {
          ctx.globalAlpha = 1 - t * t;
          Draw.star(ctx, x, y, p.size, p.size * 0.45, 5, p.color, 2.5, INK, p.rot || 0);
          break;
        }
        case 'heart': {
          ctx.globalAlpha = 1 - t * t;
          ctx.translate(x, y);
          ctx.rotate(p.rot || 0);
          Draw.heart(ctx, 0, 0, p.size * (0.8 + 0.4 * Math.sin(p.age * 0.3)), p.color, 2.5);
          break;
        }
        case 'ring': {
          ctx.globalAlpha = (1 - t) * (p.alpha || 1);
          ctx.beginPath();
          ctx.arc(x, y, p.size * (0.3 + U.ease.out(t) * 1.0), 0, TAU);
          ctx.lineWidth = (p.lw || 6) * (1 - t) + 1;
          ctx.strokeStyle = p.color;
          ctx.stroke();
          break;
        }
        case 'dust': {
          const s = p.size * (0.5 + U.ease.out(t) * 0.8);
          ctx.globalAlpha = (1 - t) * (p.alpha || 0.85);
          Draw.circle(ctx, x, y, s, p.color || '#efe6dc', 0);
          ctx.globalAlpha *= 0.5;
          Draw.circle(ctx, x - s * 0.25, y - s * 0.25, s * 0.5, '#ffffff', 0);
          break;
        }
        case 'smoke': {
          const s = p.size * (0.6 + U.ease.out(t) * 0.7);
          ctx.globalAlpha = (1 - t) * 0.9;
          Draw.circle(ctx, x, y, s, p.color || '#4a3f63', 3, INK);
          break;
        }
        case 'word': FXDraw.word(ctx, p, x, y, t); break;
        case 'block': FXDraw.block(ctx, p, x, y, t); break;
        case 'zap': FXDraw.zap(ctx, p, x, y, t); break;
        case 'shard': {
          ctx.globalAlpha = 1 - t;
          ctx.translate(x, y);
          ctx.rotate(p.rot || 0);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        }
        case 'petal': {
          ctx.globalAlpha = Math.min(1, (1 - t) * 3);
          ctx.translate(x, y);
          ctx.rotate(p.rot || 0);
          Draw.ellipse(ctx, 0, 0, p.size, p.size * 0.55, 0, p.color, 0);
          break;
        }
        case 'custom': p.draw(ctx, p, x, y, t); break;
      }
      ctx.restore();
    }
  }
}

const FXDraw = {
  // A big jagged impact burst, stretched in the direction of the hit: long
  // uneven yellow spikes with an orange edge, a pale core and a white flash
  // on the very first frames.
  spark(ctx, p, x, y, t) {
    const grow = t < 0.15 ? 0.6 + 0.4 * U.ease.out(t / 0.15) : 1 - (t - 0.15) * 0.3;
    const s = p.size * grow;
    ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    ctx.translate(x, y);
    ctx.lineJoin = 'miter';
    const n = p.n || 11, seed = p.seed || 1, dir = p.dir === undefined ? 0 : p.dir < 0 ? Math.PI : 0;
    const jag = (R, r, sd) => {
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = (p.rot || 0) + ((i + (U.hash(sd + i * 7.3) - 0.5) * 0.6) / (n * 2)) * TAU;
        // spikes reach much further along the hit
        const along = Math.max(0, Math.cos(a - dir));
        const reach = 1 + (p.dir === undefined ? 0 : along * along * 1.1);
        const rad = i % 2 === 0 ? R * reach * (0.45 + U.hash(sd * 3 + i) * 0.75) : r * (0.7 + U.hash(sd * 5 + i) * 0.6);
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };
    const flash = p.age !== undefined ? p.age < 2 : t < 0.12;
    jag(s, s * 0.4, seed);
    ctx.fillStyle = flash ? '#ffffff' : p.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = flash ? '#ffe9a8' : p.edge || '#e8900c';
    ctx.stroke();
    if (!flash) {
      jag(s * 0.62, s * 0.26, seed + 5);
      ctx.fillStyle = p.color2 || '#fff6b8';
      ctx.fill();
      jag(s * 0.3, s * 0.12, seed + 9);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  },
  streak(ctx, p, x, y, t) {
    const a = 1 - t;
    const len = p.size * (0.4 + U.ease.out(t) * 0.8);
    const d0 = p.size * 0.3 + U.ease.out(t) * p.size * 0.9;
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    const x1 = x + c * d0, y1 = y + s * d0, x2 = x + c * (d0 + len), y2 = y + s * (d0 + len);
    if (!p.noInk) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = (p.lw || 6) + 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.lw || 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },
  word(ctx, p, x, y, t) {
    const pop = t < 0.18 ? U.ease.back(t / 0.18) : 1;
    const a = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
    ctx.globalAlpha = a;
    ctx.translate(x, y - t * 18);
    ctx.rotate(p.rot || 0);
    ctx.scale(pop * (p.scale || 1), pop * (p.scale || 1));
    Draw.text(ctx, p.text, 0, 0, { size: p.size || 44, fill: p.color, stroke: INK, lw: 9, shadow: p.shadow || U.shade(p.color, -0.45), sh: 4 });
  },
  block(ctx, p, x, y, t) {
    const a = 1 - t;
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    const s = p.size * (0.7 + U.ease.out(t) * 0.5);
    ctx.scale(p.dir || 1, 1);
    // a shield-ish hexagon
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * TAU + Math.PI / 6;
      const px = Math.cos(ang) * s * 0.55, py = Math.sin(ang) * s;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(140,210,255,0.45)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#e8f7ff';
    ctx.stroke();
  },
  zap(ctx, p, x, y, t) {
    ctx.globalAlpha = 1 - t;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const pts = [];
    const n = 6;
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    for (let i = 0; i <= n; i++) {
      const d = (i / n) * p.size;
      const j = i === 0 || i === n ? 0 : (U.hash(p.seed * 13 + i + p.age * 0.0) - 0.5) * p.size * 0.5;
      pts.push([x + c * d - s * j, y + s * d + c * j]);
    }
    for (const [w, col] of [[7, INK], [4, p.color || '#fff36b'], [1.5, '#ffffff']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.stroke();
    }
  },
};

// The battle's effect system with convenience spawners.
const FX = new Particles();
Object.assign(FX, {
  hitSpark(x, y, kind, dir, counter, accent) {
    const big = kind === 'H' || kind === 'S' || kind === 'X';
    const size = kind === 'X' ? 150 : big ? 112 : 66;
    const color = counter ? '#ff5a7a' : kind === 'S' ? accent || '#ffe23d' : '#ffe23d';
    this.add({ type: 'spark', x, y, size, dir, life: big ? 13 : 9, color, color2: counter ? '#ffd0dc' : '#fff6b8', edge: counter ? '#c2185b' : '#e8900c', rot: Math.random() * TAU, seed: Math.random() * 100, n: big ? 10 : 8 });
    const n = big ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.6;
      this.add({ type: 'streak', x, y, rot: a, size: big ? 80 : 46, life: big ? 10 : 7, color: '#fff6b8', lw: big ? 4 : 3, noInk: true });
    }
    for (let i = 0; i < (big ? 5 : 2); i++) {
      const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 2.6;
      const sp = 3 + Math.random() * 5;
      this.add({ type: Math.random() < 0.5 ? 'star' : 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, grav: 0.35, size: 5 + Math.random() * 5, life: 22 + Math.random() * 10, color: Math.random() < 0.5 ? color : '#ffffff', rot: Math.random() * TAU, vr: 0.2 });
    }
  },
  blockSpark(x, y, dir) {
    this.add({ type: 'block', x, y, size: 44, life: 12, dir });
    for (let i = 0; i < 4; i++) {
      const a = (dir > 0 ? Math.PI : 0) + (Math.random() - 0.5) * 2.2;
      this.add({ type: 'streak', x, y, rot: a, size: 24, life: 8, color: '#bfe8ff', lw: 4 });
    }
  },
  techSpark(x, y) {
    this.add({ type: 'spark', x, y, size: 60, life: 16, color: '#7fe3ff', color2: '#ffffff', rot: 0, seed: 3, n: 10 });
    this.add({ type: 'ring', x, y, size: 80, life: 18, color: '#7fe3ff', lw: 8 });
  },
  dust(x, y, n = 4, dir = 0, scale = 1) {
    for (let i = 0; i < n; i++) {
      const vx = dir !== 0 ? dir * (1 + Math.random() * 2.5) : (Math.random() - 0.5) * 5;
      this.add({ type: 'dust', x: x + (Math.random() - 0.5) * 30, y: y - 4 - Math.random() * 8, vx, vy: -0.4 - Math.random() * 1.2, drag: 0.93, size: (9 + Math.random() * 9) * scale, life: 22 + Math.random() * 14 });
    }
  },
  ring(x, y, size, color, life = 16) {
    this.add({ type: 'ring', x, y, size, life, color, lw: 6 });
  },
  word(x, y, text, color = '#ffd23f', scale = 1) {
    this.add({ type: 'word', x, y, text, color, scale, rot: (Math.random() - 0.5) * 0.35, life: 46, size: 46, layer: 1 });
  },
  smoke(x, y, n = 8, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 1 + Math.random() * 3;
      this.add({ type: 'smoke', x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, drag: 0.9, size: 14 + Math.random() * 12, life: 26 + Math.random() * 12, color });
    }
  },
  hearts(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'heart', x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 3, drag: 0.97, size: 12 + Math.random() * 8, life: 40, color: U.choose(['#ff6fa8', '#ff9cc8', '#ffffff']), rot: (Math.random() - 0.5) * 0.6 });
    }
  },
  zap(x, y, n = 3, color) {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'zap', x, y, rot: Math.random() * TAU, size: 30 + Math.random() * 30, life: 8, color, seed: Math.random() * 99 });
    }
  },
  confetti(x, y, n = 30) {
    const cols = ['#ff5a7a', '#ffd23f', '#7fe3ff', '#8cff8a', '#c58bff', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2;
      const sp = 6 + Math.random() * 9;
      this.add({ type: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 0.25, drag: 0.98, size: 8 + Math.random() * 6, life: 70 + Math.random() * 40, color: U.choose(cols), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.4, layer: 1 });
    }
  },
});
