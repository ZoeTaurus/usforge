'use strict';
// ---------------------------------------------------------------------------
// Character definition framework: generic poses/animations every character
// inherits, animation sampling, and defineChar() which normalizes a character.
// ---------------------------------------------------------------------------

const CHARS = {};
const CHAR_ORDER = [];

// Poses shared by every character (they override the ones that need flavor).
const GENERIC_POSES = {
  stance: { t: 6, hd: -4, fs: 35, fe: 105, bs: 15, be: 120, lf: [20, 0], lb: [-24, 0], d: 8 },
  stance2: { $: 'stance', d: 11, t: 8, fe: 110, be: 124 },
  crouch: { t: 16, hd: -8, fs: 45, fe: 100, bs: 25, be: 115, lf: [24, 0], lb: [-24, 0], d: 36 },
  crouch2: { $: 'crouch', d: 38, t: 18 },
  squat: { t: 18, hd: -10, fs: 25, fe: 80, bs: 5, be: 90, lf: [22, 0], lb: [-22, 0], d: 26 },
  jump: { t: 2, hd: -8, fs: 70, fe: 80, bs: 40, be: 100, fh: 60, fk: 90, bh: 15, bk: 70 },
  fall: { t: 4, hd: 0, fs: 80, fe: 50, bs: 50, be: 60, fh: 30, fk: 40, bh: -5, bk: 30 },
  tuck: { t: 20, hd: 10, fs: 80, fe: 100, bs: 60, be: 100, fh: 100, fk: 140, bh: 85, bk: 135 },
  dash1: { t: 22, hd: -14, fs: -30, fe: 60, bs: 50, be: 70, lf: [40, 0], lb: [-34, 8], d: 14 },
  dash2: { t: 16, hd: -10, fs: 10, fe: 80, bs: -20, be: 60, lf: [10, 6], lb: [-24, 0], d: 10 },
  bdash: { t: -14, hd: 8, fs: 20, fe: 100, bs: 0, be: 100, fh: 40, fk: 60, bh: -10, bk: 30 },
  block: { t: -6, hd: 10, fs: 70, fe: 120, bs: 55, be: 125, lf: [16, 0], lb: [-30, 0], d: 12, face: 'block' },
  cblock: { t: 8, hd: 8, fs: 75, fe: 115, bs: 60, be: 120, lf: [22, 0], lb: [-26, 0], d: 38, face: 'block' },
  hurt: { t: -20, hd: 16, fs: -10, fe: 40, bs: -40, be: 30, lf: [16, 0], lb: [-34, 0], d: 10, face: 'hurt' },
  hurt2: { t: 32, hd: 14, fs: 30, fe: 40, bs: 10, be: 40, lf: [14, 0], lb: [-30, 0], d: 16, face: 'hurt' },
  churt: { t: -8, hd: 16, fs: 10, fe: 60, bs: -10, be: 50, lf: [22, 0], lb: [-26, 0], d: 38, face: 'hurt' },
  hurtAir: { t: -30, hd: 20, fs: -70, fe: 30, bs: -100, be: 20, fh: 40, fk: 50, bh: -10, bk: 40, face: 'hurt' },
  launch: { t: -40, hd: 24, fs: -110, fe: 20, bs: -140, be: 10, fh: 20, fk: 30, bh: -20, bk: 20, face: 'hurt' },
  fallen: { r: -88, t: 0, hd: 8, fs: 150, fe: 15, bs: 120, be: 30, fh: 8, fk: 15, bh: 22, bk: 40, face: 'hurt' },
  sit: { r: -12, t: -24, hd: 12, fs: 25, fe: 30, bs: -35, be: 20, fh: 95, fk: 40, bh: 80, bk: 70, face: 'hurt' },
  grabbed: { t: -12, hd: 18, fs: 60, fe: 40, bs: 40, be: 50, lf: [10, 4], lb: [-22, 0], d: 6, face: 'hurt' },
  lose: { t: 30, hd: 28, fs: 0, fe: 8, bs: -5, be: 8, lf: [12, 0], lb: [-12, 0], d: 6, face: 'sad' },
  win: { t: -4, hd: -10, fs: 165, fe: 10, bs: 20, be: 120, lf: [18, 0], lb: [-18, 0], d: 0, face: 'happy' },
  win2: { $: 'win', fs: 150, fe: 30, d: 6 },
  tech: { t: -16, hd: 6, fs: 30, fe: 60, bs: 10, be: 50, lf: [20, 0], lb: [-30, 0], d: 14 },
  throwWhiff: { t: 20, hd: -6, fs: 85, fe: 10, bs: 70, be: 20, lf: [30, 0], lb: [-26, 0], d: 14, hand: 'open', handB: 'open' },
  throwReach: { t: 16, hd: -6, fs: 80, fe: 20, bs: 65, be: 25, lf: [28, 0], lb: [-26, 0], d: 12, hand: 'open', handB: 'open' },
};

const GENERIC_ANIMS = {
  idle: { proc: 'idle' },
  walk: { proc: 'walk' },
  crouch: { keys: [[0, 'crouch'], [36, 'crouch2'], [72, 'crouch']], loop: true },
  jsquat: { keys: [[0, 'squat']] },
  land: { keys: [[0, 'squat'], [6, 'stance']] },
  dash: { keys: [[0, 'dash1'], [6, 'dash2'], [12, 'dash1'], [18, 'stance']] },
  bdash: { keys: [[0, 'bdash'], [16, 'bdash'], [20, 'squat']], air: true },
  guard: { keys: [[0, 'block']] },
  cguard: { keys: [[0, 'cblock']] },
  down: { keys: [[0, 'fallen']] },
  getup: { keys: [[0, 'fallen'], [8, 'sit'], [15, 'squat'], [22, 'stance']] },
  ko: { keys: [[0, 'fallen']] },
  lose: { keys: [[0, 'stance'], [24, 'lose']] },
  win: { keys: [[0, 'stance'], [12, 'win'], [40, 'win2'], [70, 'win']], loop: false },
  intro: { keys: [[0, 'stance'], [60, 'stance']] },
  tech: { keys: [[0, 'tech'], [16, 'stance']] },
  throwWhiff: { keys: [[0, 'stance'], [4, 'throwReach'], [10, 'throwWhiff'], [24, 'stance']] },
};

const Anim = {
  // Resolve a pose reference (name / inline object with optional $ base).
  pose(C, ref) {
    if (typeof ref === 'string') {
      const p = C.poses[ref];
      if (!p) throw new Error(`${C.id}: unknown pose '${ref}'`);
      return p;
    }
    if (ref && ref.$ && !ref.__resolved) return Anim.inherit(C, ref);
    return ref;
  },
  inherit(C, p) {
    if (!p.$) return p;
    const base = Anim.pose(C, p.$);
    const o = Object.assign({}, base, p);
    delete o.$;
    o.__resolved = true;
    return o;
  },
  // Normalize an animation definition (resolve poses in keys)
  build(C, A) {
    if (!A || A.__built) return A;
    if (A.keys) {
      A.keys = A.keys.map((k) => [k[0], Anim.pose(C, k[1]), k[2]]);
      A.len = A.keys[A.keys.length - 1][0];
    }
    A.__built = true;
    return A;
  },
  sample(C, A, f) {
    const keys = A.keys;
    if (!keys || keys.length === 0) return C.poses.stance;
    if (A.loop && A.len > 0) f = f % A.len;
    if (f <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const k1 = keys[i + 1];
      if (f < k1[0]) {
        const k0 = keys[i];
        const span = k1[0] - k0[0];
        const t = span > 0 ? (f - k0[0]) / span : 1;
        const ez = U.ease[k1[2] || A.ease || 'inout'] || U.ease.inout;
        return Rig.lerp(C, k0[1], k1[1], ez(t));
      }
    }
    return keys[keys.length - 1][1];
  },
};

// Fill in default hit properties (also used for projectile hits).
function normHit(h, btn = 'S', type = 'special', air = false) {
  if (h.__norm) return h;
  h.__norm = true;
  h.level = h.level || (air ? 'high' : 'mid');
  if (h.dmg === undefined) h.dmg = 40;
  if (h.r === undefined) h.r = 12;
  if (h.hs === undefined) h.hs = btn === 'L' ? 14 : 20;
  if (h.bs === undefined) h.bs = btn === 'L' ? 10 : 15;
  if (h.stop === undefined) h.stop = btn === 'L' ? 6 : type === 'super' ? 12 : 9;
  if (h.kb === undefined) h.kb = btn === 'L' ? [3, 0] : [6, 0];
  if (h.chip === undefined) h.chip = type === 'normal' ? 0 : Math.round(h.dmg * 0.15);
  if (h.spark === undefined) h.spark = btn === 'L' ? 'L' : 'H';
  if (h.sfx === undefined) h.sfx = btn === 'L' ? 'hitL' : 'hitH';
  if (type === 'super') h.super = true;
  return h;
}

// Default move properties by button
function moveDefaults(id, m) {
  const btn = id.replace(/^j[0-9]?|^[0-9]/, '');
  m.id = id;
  m.btn = btn;
  if (!m.type) {
    if (btn === 'L' || btn === 'H') m.type = 'normal';
    else if (btn === 'S') m.type = 'special';
    else if (btn === 'SUP') m.type = 'super';
    else if (btn === 'THROW') m.type = 'throw';
    else m.type = 'special';
  }
  m.air = m.air !== undefined ? m.air : id.startsWith('j');
  m.hits = m.hits || [];
  let first = 999;
  for (const h of m.hits) {
    if (h.at[0] < first) first = h.at[0];
    normHit(h, btn, m.type, m.air);
  }
  if (m.throw && m.throwAt === undefined) m.throwAt = 3;
  m.firstActive = m.throw ? m.throwAt : first;
  m.lastActive = m.hits.reduce((a, h) => Math.max(a, h.at[1]), m.throw ? m.throwAt : -1);
  if (m.chain === undefined) {
    if (m.type === 'normal' && btn === 'L') m.chain = m.air ? ['jL', 'jH'] : ['5L', '2L', '5H', '2H', '6L'];
    else if (m.type === 'normal' && m.air) m.chain = [];
    else m.chain = [];
  }
  if (m.special === undefined) m.special = m.type === 'normal';
  if (m.superCancel === undefined) m.superCancel = m.type === 'normal' || m.type === 'special';
  if (m.whiff === undefined) m.whiff = btn === 'L' ? 'whiffL' : 'whiffH';
  return m;
}

// ---- house style ---------------------------------------------------------------
// Flat fighters: one hue per costume, thin lines, small heads and lean limbs.
// Only the drawing changes; hurtboxes keep each body's original measurements.
const LOOK = { lw: 2.4, head: 0.72, arm: 0.8, leg: 0.84, torso: 0.88, hand: 0.9 };

function lum(hex) {
  const c = U.rgb(hex);
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
}

// Shade `base` to a lightness `d` above (or below) its own.
function shadeTo(base, d) {
  const L0 = lum(base);
  if (d >= 0) return U.mix(base, '#ffffff', U.clamp(d / Math.max(0.05, 1 - L0), 0, 0.9));
  return U.mix(base, '#000000', U.clamp(-d / Math.max(0.05, L0), 0, 0.85));
}

// Recolor a costume into one hue family. Every slot keeps (a compressed copy
// of) its lightness but takes the main hue; accent slots take the accent hue
// and `set` slots are given outright.
function monoPalette(src, spec, keys = {}) {
  const out = {};
  const range = spec.range || keys.range || 0.5;
  const accentKeys = keys.accent || [], keep = keys.keep || [];
  // lightness differences are measured from the costume's main (and accent) slot
  const mref = keys.main ? lum(src[keys.main]) : 0.5, aref = keys.accentMain ? lum(src[keys.accentMain]) : 0.6;
  for (const k in src) {
    const c = src[k];
    if (typeof c !== 'string' || c[0] !== '#' || keep.includes(k)) {
      out[k] = c;
      continue;
    }
    const acc = spec.accent && accentKeys.includes(k);
    const base = acc ? spec.accent : spec.main;
    out[k] = shadeTo(base, (lum(c) - (acc ? aref : mref)) * (acc ? 0.6 : range));
  }
  Object.assign(out, spec.set || {});
  out.ink = spec.ink || U.mix(spec.main, '#0c0614', 0.86);
  return out;
}

function defineChar(def) {
  const b = def.body;
  b.shoulderOfs = b.shoulderOfs || 0;
  b.hipOfs = b.hipOfs || 0;
  def.legScale = (b.thigh + b.shin) / 72;
  const lk = (def.look = Object.assign({}, LOOK, def.look || {}));
  def.hurtBody = { headR: b.headR, armR: b.armR.slice(), legR: b.legR.slice() };
  b.armR = b.armR.map((r) => r * lk.arm);
  b.legR = b.legR.map((r) => r * lk.leg);
  b.handR *= lk.hand;
  def.headScale = lk.head;
  def.lw = lk.lw;
  def.poseDef = Object.assign({}, POSE_DEF, def.poseDefaults || {});
  def.handDef = def.handDef || 'fist';
  def.armCols = def.armCols || ['skin', 'skin', 'skin'];
  def.legCols = def.legCols || ['pants', 'pants', 'shoe'];
  def.draw = def.draw || {};

  // poses: generic + own, with $ inheritance
  const own = def.poses || {};
  def.poses = Object.assign({}, GENERIC_POSES, own);
  for (const k in def.poses) def.poses[k] = Object.assign({}, def.poses[k]);
  const resolving = new Set();
  const resolve = (k) => {
    const p = def.poses[k];
    if (!p.$) return p;
    if (resolving.has(k)) throw new Error(def.id + ': pose cycle ' + k);
    resolving.add(k);
    const baseName = p.$;
    const base = resolve(baseName);
    const o = Object.assign({}, base, p);
    delete o.$;
    def.poses[k] = o;
    resolving.delete(k);
    return o;
  };
  for (const k in def.poses) resolve(k);

  // animations
  const anims = Object.assign({}, GENERIC_ANIMS, def.anims || {});
  def.anims = {};
  for (const k in anims) def.anims[k] = Anim.build(def, JSON.parse(JSON.stringify(anims[k])));

  // moves
  for (const id in def.moves) {
    const m = def.moves[id];
    moveDefaults(id, m);
    if (m.anim) m.anim = Anim.build(def, m.anim);
    if (!m.frames) m.frames = m.anim ? m.anim.len : 20;
    if (m.seq && m.seq.anim) m.seq.anim = Anim.build(def, m.seq.anim);
    if (m.seq && m.seq.vic) m.seq.vic = m.seq.vic.map((k) => k.slice());
    if (m.seqHit && m.seqHit.anim) m.seqHit.anim = Anim.build(def, m.seqHit.anim);
  }

  if (def.mono) def.palettes = def.palettes.map((p, i) => (def.mono[i] ? monoPalette(p, def.mono[i], def.monoKeys) : p));
  if (def.mono && def.mono[0]) def.color = def.mono[0].main;
  def.palettes = def.palettes.map((p) => makePalette(p));
  def.walk = Object.assign({ A: 9, H: 9, bob: 3, sway: 2 }, def.walk || {});
  def.idlePeriod = def.idlePeriod || 70;
  CHARS[def.id] = def;
  CHAR_ORDER.push(def.id);
  return def;
}
