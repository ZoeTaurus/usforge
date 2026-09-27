'use strict';
// Seeded randomness and value noise, so the world is the same every playthrough.
const RNG = {
  mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  hash2(x, y, s = 0) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },

  noise(x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = this.hash2(xi, yi, s), b = this.hash2(xi + 1, yi, s);
    const c = this.hash2(xi, yi + 1, s), d = this.hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  },

  fbm(x, y, s = 0, oct = 3) {
    let total = 0, amp = 1, sum = 0, f = 1;
    for (let i = 0; i < oct; i++) {
      total += this.noise(x * f, y * f, s + i * 17) * amp;
      sum += amp; amp *= 0.5; f *= 2;
    }
    return total / sum;
  },
};
