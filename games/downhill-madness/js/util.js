'use strict';
// UsForge leaderboard: report a finished run's score to the page hosting the game.
// Does nothing when the game is opened on its own.
function sendScoreToUsForge(score) {
  if (window.parent === window) return;
  try {
    window.parent.postMessage({ usforge: 'score', score: Math.round(score), unit: 'points' }, '*');
  } catch (e) {}
}

const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  chance: p => Math.random() < p,
  sign: v => (v < 0 ? -1 : 1),
  approach(v, t, d) { return v < t ? Math.min(v + d, t) : Math.max(v - d, t); },
  nearestTurn: a => Math.round(a / TAU) * TAU,
  hex(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  },
  mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },
  rgb(c, a) {
    return a === undefined
      ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
      : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  },
  weighted(items) {
    let tot = 0;
    for (const it of items) tot += it.w;
    let r = Math.random() * tot;
    for (const it of items) { r -= it.w; if (r <= 0) return it; }
    return items[items.length - 1];
  },
  fmt: n => Math.floor(n).toLocaleString('en-US'),
  store: {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  },
};
