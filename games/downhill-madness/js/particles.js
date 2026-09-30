'use strict';
// Screen-space particles: snow spray, fire, sparkles, shockwave rings.
const Particles = {
  list: [],
  add(p) {
    if (this.list.length > 900) return null;
    p.t = 0;
    p.life = p.life || 1;
    p.vx = p.vx || 0; p.vy = p.vy || 0; p.g = p.g || 0;
    p.size = p.size || 4; p.drag = p.drag || 0; p.rot = p.rot || 0;
    this.list.push(p);
    return p;
  },
  burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + U.rand(-o.spread, o.spread) : Math.random() * TAU;
      const sp = U.rand(o.speed * 0.3, o.speed);
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g || 0, drag: o.drag || 1.5,
        life: U.rand(o.life * 0.5, o.life), size: U.rand(o.size * 0.5, o.size),
        color: Array.isArray(o.color) ? U.pick(o.color) : o.color, type: o.type || 'dot',
        spin: U.rand(-8, 8),
      });
    }
  },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy += p.g * dt;
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot += p.spin * dt;
    }
  },
  draw(c) {
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      if (p.type === 'ring') {
        c.globalAlpha = k * 0.9;
        c.strokeStyle = p.color;
        c.lineWidth = p.size * 0.25 * k + 1;
        c.beginPath();
        c.arc(p.x, p.y, p.size * (0.2 + (p.t / p.life) * p.grow), 0, TAU);
        c.stroke();
      } else if (p.type === 'fire') {
        const r = p.size * (0.3 + k * 0.9);
        c.globalAlpha = Math.min(1, k * 1.4);
        c.fillStyle = k > 0.7 ? '#fff3a8' : k > 0.45 ? '#ffb02e' : k > 0.2 ? '#ff5a1f' : '#6b2a2a';
        c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
      } else if (p.type === 'star') {
        c.globalAlpha = Math.min(1, k * 2);
        c.fillStyle = p.color;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        const r = p.size;
        c.beginPath();
        for (let j = 0; j < 10; j++) {
          const rr = j % 2 ? r * 0.45 : r, a = (j / 10) * TAU - Math.PI / 2;
          c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath(); c.fill(); c.restore();
      } else {
        c.globalAlpha = Math.min(1, k * 1.6);
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1;
  },
};
