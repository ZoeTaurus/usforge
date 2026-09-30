'use strict';
// The sky gets weirder as madness rises. Two levels per theme, then it loops the late ones.
const THEMES = [
  { name: 'Bluebird Day', skyTop: '#1f6fd6', skyBot: '#a9dcff', fog: '#d8efff', mtnFar: '#8fb6de', mtnNear: '#5f8fc2',
    mtnSnow: '#f4fbff', snowA: '#ffffff', snowB: '#edf5fd', offA: '#dbe9f6', offB: '#cfe0f1', bank: '#a9c6e3',
    line: '#d3e3f3', sun: '#fff3b0', sunOn: 1 },
  { name: 'Golden Hour', skyTop: '#f0643a', skyBot: '#ffd99a', fog: '#ffe6c4', mtnFar: '#d99488', mtnNear: '#9d5f76',
    mtnSnow: '#ffe4cf', snowA: '#fff5ea', snowB: '#ffead6', offA: '#f5d8c4', offB: '#eccab5', bank: '#d9a791',
    line: '#f0d6c2', sun: '#fff1a8', sunOn: 1 },
  { name: 'Sunset Rush', skyTop: '#3b1f7a', skyBot: '#ff6f91', fog: '#f4a3bd', mtnFar: '#83489b', mtnNear: '#542a70',
    mtnSnow: '#ffc2dc', snowA: '#ffe8f2', snowB: '#f8d7e8', offA: '#e7bdd8', offB: '#dbaecd', bank: '#bf8cb8',
    line: '#edcadf', sun: '#ffc46b', sunOn: 1 },
  { name: 'Aurora Night', skyTop: '#030822', skyBot: '#1a2c63', fog: '#22366b', mtnFar: '#1b2b58', mtnNear: '#0e1a3b',
    mtnSnow: '#8ea6de', snowA: '#c3d4ff', snowB: '#b2c4f1', offA: '#93a8d8', offB: '#879cce', bank: '#6c82bb',
    line: '#a6b9e6', sun: '#f2f5ff', stars: 1, aurora: 1, moon: 1 },
  { name: 'Disco Glacier', skyTop: '#ff1f7a', skyBot: '#25d9ff', fog: '#b99cff', mtnFar: '#7a3cff', mtnNear: '#4a1fb0',
    mtnSnow: '#7ff7ff', snowA: '#e9fbff', snowB: '#d2f2ff', offA: '#c4b6ff', offB: '#b3a3f7', bank: '#8f7cf0',
    line: '#b5e9ff', sun: '#fff27a', disco: 1, sunOn: 1 },
  { name: 'Cosmic Slope', skyTop: '#000000', skyBot: '#28084a', fog: '#34145c', mtnFar: '#3a1a66', mtnNear: '#1c0b39',
    mtnSnow: '#dba0ff', snowA: '#efdfff', snowB: '#dfcbff', offA: '#c3abee', offB: '#b39be3', bank: '#9179d2',
    line: '#d0bbf2', sun: '#ffffff', stars: 1, planet: 1 },
];

const THEME_COLORS = ['skyTop', 'skyBot', 'fog', 'mtnFar', 'mtnNear', 'mtnSnow', 'snowA', 'snowB', 'offA', 'offB', 'bank', 'line', 'sun'];
const THEME_FLAGS = ['stars', 'aurora', 'moon', 'disco', 'planet', 'sunOn'];

const Theme = {
  pal: null, from: 0, to: 0, t: 1,
  init() {
    for (const th of THEMES) {
      th.c = {};
      for (const k of THEME_COLORS) th.c[k] = U.hex(th[k]);
    }
    this.set(0, true);
    this.update(0);
  },
  indexFor(level) {
    const i = (level - 1) >> 1;
    return i < THEMES.length ? i : 3 + ((i - 3) % (THEMES.length - 3));
  },
  set(i, instant) {
    if (i === this.to && !instant) return false;
    this.from = instant ? i : this.to;
    this.to = i;
    this.t = instant ? 1 : 0;
    return true;
  },
  update(dt) {
    this.t = Math.min(1, this.t + dt / 3);
    const a = THEMES[this.from], b = THEMES[this.to];
    const e = this.t * this.t * (3 - 2 * this.t);
    const p = this.pal || (this.pal = {});
    for (const k of THEME_COLORS) p[k] = U.mix(a.c[k], b.c[k], e);
    for (const f of THEME_FLAGS) p[f] = (a[f] || 0) * (1 - e) + (b[f] || 0) * e;
    p.name = b.name;
  },
};
