'use strict';
// The endless mountain: segments are generated on demand and dropped once behind the camera.
const SIGNS = ['YETI XING', 'NO BRAKES', 'GOOD LUCK', 'TURN BACK', 'WHEEE', 'THIS IS FINE', 'DOOM AHEAD',
  'PHYSICS: OFF', 'SPEED LIMIT ∞', 'HOSPITAL ↓', 'NICE FLIP', 'NOT A DRILL', 'COWS ABOVE'];

class Track {
  constructor() {
    this.segs = [];
    this.base = 0;
    this.curveScale = 1;
    this.g = { curve: 0, target: 0, remain: 60, y: 0, ph1: U.rand(0, 99), ph2: U.rand(0, 99) };
  }

  get(i) {
    if (i < this.base) i = this.base;
    while (i >= this.base + this.segs.length) this.gen();
    return this.segs[i - this.base];
  }

  gen() {
    const g = this.g, i = this.base + this.segs.length;
    if (g.remain-- <= 0) {
      g.remain = U.randInt(40, 110);
      g.target = U.chance(0.3) ? 0 : U.rand(-1, 1) * U.rand(1.5, 4.2) * this.curveScale;
    }
    g.curve += (g.target - g.curve) * 0.035;
    // Always downhill on average, with rolling hills on top.
    const slope = -CFG.SEG_LEN * 0.14 + Math.sin(i * 0.019 + g.ph1) * 42 + Math.sin(i * 0.047 + g.ph2) * 22;
    const seg = {
      i, curve: g.curve, y1: g.y, y2: g.y + slope, band: (i >> 2) & 1,
      deco: [], list: [], p1: {}, p2: {}, clip: 0, fog: 0,
    };
    g.y += slope;
    this.decorate(seg);
    this.segs.push(seg);
  }

  decorate(seg) {
    for (const side of [-1, 1]) {
      if (U.chance(0.55)) seg.deco.push({ k: 'tree', x: side * U.rand(1.22, 1.7), v: U.randInt(0, 2), s: U.rand(0.8, 1.25) });
      if (U.chance(0.45)) seg.deco.push({ k: 'tree', x: side * U.rand(1.8, 4.4), v: U.randInt(0, 2), s: U.rand(0.9, 1.5) });
    }
    if (seg.i % 12 === 0) {
      seg.deco.push({ k: 'pole', x: -1.07 });
      seg.deco.push({ k: 'pole', x: 1.07 });
    }
    if (seg.i > 40 && U.chance(0.01)) {
      seg.deco.push({ k: 'sign', x: U.pick([-1, 1]) * U.rand(1.15, 1.3), text: U.pick(SIGNS) });
    }
  }

  trim(i) {
    const n = i - this.base - 20;
    if (n > 300) {
      this.segs.splice(0, n);
      this.base += n;
    }
  }

  groundY(z) {
    const f = z / CFG.SEG_LEN, s = this.get(Math.floor(f));
    return s.y1 + (s.y2 - s.y1) * (f - s.i);
  }

  grade(z) {
    const s = this.get(Math.floor(z / CFG.SEG_LEN));
    return (s.y2 - s.y1) / CFG.SEG_LEN;
  }
}
