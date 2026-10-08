'use strict';
// ---------------------------------------------------------------------------
// CPU opponent. Produces an input mask every frame like a player would.
// Perception of the opponent is delayed by a reaction time; defensive
// decisions (block / anti-air / counter) are rolled once per enemy attack.
// Uses the `ai` metadata on moves and the character's `ai` profile.
// ---------------------------------------------------------------------------

const AI_LEVELS = [
  { name: 'EASY', react: 24, block: 0.22, aa: 0.15, combo: 0.3, punish: 0.15, tech: 0.05, think: [30, 55], aggro: 0.7, preBlock: 0.05, superUse: 0.3 },
  { name: 'NORMAL', react: 16, block: 0.5, aa: 0.42, combo: 0.7, punish: 0.4, tech: 0.25, think: [14, 30], aggro: 0.9, preBlock: 0.15, superUse: 0.6 },
  { name: 'HARD', react: 11, block: 0.76, aa: 0.7, combo: 0.9, punish: 0.75, tech: 0.5, think: [7, 16], aggro: 1, preBlock: 0.3, superUse: 0.85 },
  { name: 'EXPERT', react: 8, block: 0.9, aa: 0.88, combo: 1, punish: 0.92, tech: 0.75, think: [3, 9], aggro: 1.1, preBlock: 0.45, superUse: 1 },
];

const AI_BTN = { L: BTN.LIGHT, H: BTN.HEAVY, S: BTN.SPECIAL, SUP: BTN.SUPER, THROW: BTN.THROW };
// minimum frames between projectiles the CPU throws on its own, per level
const AI_PROJ_GAP = [130, 80, 45, 25];

class AIController {
  constructor(level = 1, seed) {
    this.level = U.clamp(level | 0, 0, AI_LEVELS.length - 1);
    this.L = AI_LEVELS[this.level];
    this.rand = seed !== undefined ? U.rng(seed) : Math.random;
    this.hist = [];
    this.prog = null;
    this.wait = 20;
    this.threatKey = null;
    this.threatResp = null;
    this.guardT = 0;
    this.guardLow = true;
    this.lastProj = -999;
    this.combo = null;
    this.lastMove = null;
    this.lastMoveStart = -1;
    this.pressedFor = null;
    this.aaWatch = 0;
    this.jumpPlan = null;
    this.preBlockT = 0;
  }

  r() {
    return this.rand();
  }
  chance(p) {
    return this.rand() < p;
  }

  // ---- perception -----------------------------------------------------------
  observe(f) {
    const o = f.opp;
    this.hist.push({
      state: o.state, moveId: o.moveId, move: o.move, mf: o.mf, x: o.x, y: o.y, vx: o.vx, vy: o.vy,
      frame: f.battle.frame, startFrame: o.state === 'attack' ? f.battle.frame - o.mf : -1,
    });
    if (this.hist.length > 40) this.hist.shift();
  }
  snap() {
    const i = Math.max(0, this.hist.length - 1 - this.L.react);
    return this.hist[i];
  }

  // ---- helpers ----------------------------------------------------------------
  dirMask(f, fw) {
    if (!fw) return 0;
    const right = fw * f.facing > 0;
    return right ? BTN.RIGHT : BTN.LEFT;
  }
  // input steps for a move id
  moveSteps(f, id, hold = 2) {
    let dn = false, fw = 0;
    let body = id;
    if (body[0] === 'j') body = body.slice(1);
    if (body[0] === '2') dn = true;
    else if (body[0] === '6') fw = 1;
    else if (body[0] === '4') fw = -1;
    const btnKey = body.replace(/^[0-9]/, '');
    const btn = AI_BTN[btnKey] || 0;
    return [{ n: hold, fw, dn, btn }, { n: 1, fw, dn, btn: 0 }];
  }
  run(steps) {
    this.prog = steps.map((s) => Object.assign({}, s));
  }
  progMask(f) {
    while (this.prog && this.prog.length && this.prog[0].n <= 0) this.prog.shift();
    if (!this.prog || !this.prog.length) {
      this.prog = null;
      return null;
    }
    const s = this.prog[0];
    s.n--;
    let m = this.dirMask(f, s.fw) | s.btn;
    if (s.dn) m |= BTN.DOWN;
    if (s.up) m |= BTN.UP;
    return m;
  }
  canUse(f, id) {
    const m = f.C.moves[id];
    if (!m) return false;
    if (m.cond && !m.cond(f)) return false;
    if (m.type === 'super' && f.meter < 100) return false;
    return true;
  }
  actionable(f) {
    return f.state in NEUTRAL_STATES || f.state === 'block';
  }
  profile(f) {
    return f.C.ai || {};
  }
  movesOfKind(f, kinds) {
    const out = [];
    for (const id in f.C.moves) {
      const m = f.C.moves[id];
      if (m.ai && kinds.includes(m.ai.kind) && this.canUse(f, id)) out.push(id);
    }
    return out;
  }
  slipMoves(f, dist) {
    const out = [];
    for (const id in f.C.moves) {
      const m = f.C.moves[id];
      if (!m.ai || m.air || !this.canUse(f, id)) continue;
      if ((m.projInv || m.ai.kind === 'teleport') && this.inRange(m, dist)) out.push(id);
    }
    return out;
  }
  // close the distance on a projectile thrower that is still recovering
  closeIn(f, o, dist) {
    const P = this.profile(f);
    const opts = [];
    for (const id in f.C.moves) {
      const m = f.C.moves[id];
      if (!m.ai || m.air || !this.canUse(f, id) || !this.inRange(m, dist)) continue;
      if (m.ai.kind === 'approach' || m.ai.kind === 'teleport') opts.push(id);
    }
    if (opts.length && this.chance(0.55)) {
      this.startAttack(f, opts[Math.floor(this.r() * opts.length)]);
      return;
    }
    if (this.chance((P.jumpiness || 0.3) + 0.35)) {
      this.run([{ n: 3, up: true, fw: 1, btn: 0 }]);
      this.jumpPlan = { attack: true };
      return;
    }
    this.run([{ n: 2, fw: 1, btn: 0 }, { n: 2, fw: 0, btn: 0 }, { n: 2, fw: 1, btn: 0 }, { n: 12, fw: 1, btn: 0 }]);
  }

  inRange(m, dist) {
    const r = m.ai && m.ai.range;
    if (!r) return true;
    return dist >= r[0] && dist <= r[1];
  }

  // ---- main ------------------------------------------------------------------
  get(f) {
    const b = f.battle;
    if (!b) return 0;
    this.observe(f);
    const o = f.opp;
    const snap = this.snap();
    const dist = Math.abs(o.x - f.x);
    let mask = 0;

    // being thrown: maybe tech
    if (f.state === 'held') {
      const holder = f.heldBy;
      if (holder && holder.seq && holder.seq.tech && holder.seqF >= 2 && holder.seqF <= 6 && !this.techRolled) {
        this.techRolled = true;
        if (this.chance(this.L.tech)) return BTN.THROW;
      }
      return 0;
    }
    this.techRolled = false;

    // combos: we're attacking and connected
    if (f.state === 'attack') {
      this.jumpPlan = null;
      const m = this.comboStep(f, o);
      if (m !== null) return m;
      const pm = this.progMask(f);
      return pm !== null ? pm : 0;
    }
    if (f.state === 'air') return this.airLogic(f, o, dist);
    if (!this.actionable(f) && f.state !== 'getup' && f.state !== 'down') {
      this.prog = null;
      return 0;
    }

    // wake-up decisions
    if (f.state === 'down' || f.state === 'getup') {
      this.prog = null;
      if (f.state === 'getup' && f.sf === 18 && f.meter >= 100 && this.chance(this.L.superUse * 0.3) && this.canUse(f, 'SUP')) {
        this.run(this.moveSteps(f, 'SUP', 3));
      }
      return this.progMask(f) || 0;
    }

    // defensive reactions
    const threat = this.threat(f, o, snap);
    if (threat) {
      if (threat.key !== this.threatKey) {
        this.threatKey = threat.key;
        this.threatResp = this.decideThreat(f, o, threat, dist);
        if (this.threatResp !== 'ignore') this.prog = null;
      }
      const resp = this.threatResp;
      if (resp === 'block') {
        this.guardT = 10;
        this.guardLow = threat.level !== 'high';
      } else if (resp === 'aa') {
        this.aaWatch = 26;
      } else if (resp && resp.startsWith && resp.startsWith('move:')) {
        const id = resp.slice(5);
        this.threatResp = 'done';
        if (this.canUse(f, id)) this.run(this.moveSteps(f, id));
      } else if (resp === 'jump') {
        this.threatResp = 'done';
        this.run([{ n: 3, up: true, fw: dist > 200 ? 1 : 0, btn: 0 }]);
        this.jumpPlan = { attack: this.chance(0.7) };
      } else if (resp === 'counterProj') {
        const cp = this.ctrProj, p = cp && cp.p;
        if (!p || !p.active) this.threatResp = 'done';
        else if (Math.abs(p.x - f.x) < 70 + Math.abs(p.vx) * 9) {
          this.threatResp = 'done';
          if (this.canUse(f, cp.id)) this.run(this.moveSteps(f, cp.id));
        } else return this.progMask(f) || 0;
      } else if (resp === 'backdash') {
        this.threatResp = 'done';
        this.run([{ n: 2, fw: -1, btn: 0 }, { n: 2, fw: 0, btn: 0 }, { n: 2, fw: -1, btn: 0 }]);
      }
    }
    // anti-air timing
    if (this.aaWatch > 0) {
      this.aaWatch--;
      const aa = this.pickAA(f, o);
      if (aa && o.y > 10 && o.y < 230 && dist < (f.C.moves[aa].ai.range ? f.C.moves[aa].ai.range[1] : 140) + 10 && o.vy < 6) {
        this.aaWatch = 0;
        this.run(this.moveSteps(f, aa));
      } else if (!aa) {
        this.guardT = 8;
        this.guardLow = false;
      }
    }
    if (this.guardT > 0) {
      this.guardT--;
      this.prog = null;
      mask = this.dirMask(f, -1);
      if (this.guardLow) mask |= BTN.DOWN;
      return mask;
    }

    // pre-emptive blocking when the opponent is in our face
    if (this.preBlockT > 0) {
      this.preBlockT--;
      return this.dirMask(f, -1) | (this.chance(0.7) ? BTN.DOWN : 0);
    }

    // punish recovery
    if (!this.prog && snap && snap.state === 'attack' && snap.move && snap.mf > snap.move.lastActive && o.state === 'attack' && o.move) {
      const left = o.move.frames - o.mf;
      if (left > 6 && !this.punishRolled) {
        this.punishRolled = true;
        if (this.chance(this.L.punish)) {
          const p = this.pickPunish(f, o, dist, left);
          if (p) this.startAttack(f, p);
          else if (!o.move.hits.length && dist > 150 && dist < 560 && left > 12) this.closeIn(f, o, dist);
        }
      }
    } else if (o.state !== 'attack') this.punishRolled = false;

    const pm = this.progMask(f);
    if (pm !== null) return pm;

    // neutral thinking
    if (this.wait > 0) {
      this.wait--;
      return this.idleMask(f, o, dist);
    }
    this.think(f, o, dist);
    const pm2 = this.progMask(f);
    return pm2 !== null ? pm2 : 0;
  }

  idleMask(f, o, dist) {
    // light footsie wiggle while waiting
    const P = this.profile(f);
    const pref = P.pref || [110, 220];
    if (dist > pref[1] + 40) return this.dirMask(f, 1);
    if (dist < pref[0] - 30 && (P.zoning || 0) > 0.4) return this.dirMask(f, -1);
    return 0;
  }

  threat(f, o, snap) {
    if (!snap) return null;
    // melee attack (seen with delay)
    if (snap.state === 'attack' && snap.move && snap.move.hits.length && snap.mf <= snap.move.lastActive) {
      const reach = (snap.move.ai && snap.move.ai.range ? snap.move.ai.range[1] : 150) + 50;
      const sd = Math.abs(snap.x - f.x);
      // travelling attacks (slides, rushes) are threats from further away
      if (sd < reach || (snap.move.vel && sd < reach + 220) || (snap.move.ai && snap.move.ai.kind === 'approach')) {
        let level = 'mid';
        for (const h of snap.move.hits) {
          if (h.level === 'low') level = 'low';
          else if (h.level === 'high' && level !== 'low') level = 'high';
        }
        if (snap.move.air) level = 'high';
        return { kind: 'melee', key: 'm' + snap.startFrame + snap.moveId, level, move: snap.move };
      }
    }
    // jump-in
    if (snap.y > 25 && Math.abs(snap.x - f.x) < 260 && (snap.vx * (f.x - snap.x) >= 0 || Math.abs(snap.x - f.x) < 120)) {
      return { kind: 'air', key: 'a' + this.jumpKey(o), level: 'high' };
    }
    // projectiles
    for (const p of f.battle.projs) {
      if (p.owner === f || !p.hit || !p.active) continue;
      const px = p.x - p.vx * this.L.react;
      const d = Math.abs(px - f.x);
      if (d < 300 && (p.vx === 0 ? d < 120 : Math.sign(p.vx) === Math.sign(f.x - px))) {
        return { kind: 'proj', key: p, level: p.hit.level === 'low' ? 'low' : 'mid', proj: p };
      }
    }
    return null;
  }
  jumpKey(o) {
    // identifies one jump of the opponent
    if (o.state === 'air' || (o.state === 'attack' && o.move && o.move.air)) {
      if (!this._jk || this._jkState !== 'air') {
        this._jk = (this._jk || 0) + 1;
      }
      this._jkState = 'air';
    } else this._jkState = 'ground';
    return this._jk || 0;
  }

  decideThreat(f, o, t, dist) {
    const L = this.L;
    const P = this.profile(f);
    if (t.kind === 'air') {
      if (this.pickAA(f, o) && this.chance(L.aa)) return 'aa';
      if (this.chance(L.block)) return 'block';
      return 'ignore';
    }
    if (t.kind === 'proj') {
      if ((P.zoning || 0) > 0.4 && this.chance(0.5)) {
        const pr = this.movesOfKind(f, ['proj']);
        if (pr.length && dist > 220) return 'move:' + pr[Math.floor(this.r() * pr.length)];
      }
      // counter stances can swat projectiles away (timed when it gets close)
      const ctr = this.movesOfKind(f, ['counter']);
      if (ctr.length && this.chance(0.35 + 0.12 * this.level)) {
        this.ctrProj = { id: ctr[0], p: t.proj };
        return 'counterProj';
      }
      // moves that slip through projectiles (invulnerable slides, teleports)
      const slip = this.slipMoves(f, dist);
      if (slip.length && this.chance(0.3 + 0.1 * this.level)) return 'move:' + slip[Math.floor(this.r() * slip.length)];
      // jump the projectile when its thrower is close enough to punish
      if (dist > 160 && dist < 470 && this.chance((P.jumpiness || 0.3) * 0.6 + 0.12 + 0.06 * this.level)) return 'jump';
      if (this.chance(L.block + 0.1)) return 'block';
      return 'ignore';
    }
    // melee
    const counters = this.movesOfKind(f, ['counter']);
    if (counters.length && this.chance(0.35 * L.block)) return 'move:' + counters[0];
    if (this.chance(L.block)) return 'block';
    if (dist > 140 && this.chance(0.15)) return 'backdash';
    return 'ignore';
  }

  pickAA(f, o) {
    const P = this.profile(f);
    const list = (P.antiAir || this.movesOfKind(f, ['aa'])).filter((id) => this.canUse(f, id));
    if (!list.length) return null;
    return o.y > 0 || list.length === 1 ? list[0] : U.choose(list);
  }

  pickPunish(f, o, dist, left) {
    const P = this.profile(f);
    const cands = [];
    const consider = (id) => {
      const m = f.C.moves[id];
      if (!m || !this.canUse(f, id)) return;
      if (m.firstActive > left - 2) return;
      if (!this.inRange(m, dist)) return;
      cands.push(id);
    };
    if (f.meter >= 100 && this.chance(this.L.superUse * 0.5)) consider('SUP');
    for (const id of P.punish || []) consider(id);
    for (const c of P.combos || []) consider(c[0]);
    ['5H', '2H', '5L', '2L'].forEach(consider);
    return cands.length ? cands[0] : null;
  }

  startAttack(f, id) {
    const P = this.profile(f);
    this.combo = null;
    if (this.chance(this.L.combo)) {
      const routes = (P.combos || []).filter((c) => c[0] === id);
      if (routes.length) this.combo = { route: U.choose(routes), idx: 0 };
    }
    this.run(this.moveSteps(f, id));
  }

  // During our attack: continue combo routes on contact
  comboStep(f, o) {
    // whiff-cancelable moves (teleports) can continue a planned route without contact
    const m0 = f.move;
    const freeCancel = !!(this.combo && m0 && m0.cancelTo && m0.cancelWhiff && (!m0.cancelFrom || f.mf >= m0.cancelFrom - 3));
    if (!f.moveContact && !freeCancel) return null;
    const hitConfirmed = o.state === 'hit' || o.state === 'airhit' || o.state === 'held';
    const P = this.profile(f);
    if (!this.combo && hitConfirmed && f.move && f.move.type === 'normal' && this.chance(this.L.combo * 0.6)) {
      // improvise: chain to a heavy or cancel into an ender
      const enders = (P.enders || []).filter((id) => this.canUse(f, id));
      const nextId = f.move.btn === 'L' && f.C.moves['5H'] ? '5H' : enders.length ? U.choose(enders) : null;
      if (nextId) this.combo = { route: [f.moveId, nextId], idx: 0 };
    }
    if (!this.combo) return null;
    const route = this.combo.route;
    let idx = route.indexOf(f.moveId, this.combo.idx);
    if (idx < 0) {
      this.combo = null;
      return null;
    }
    this.combo.idx = idx;
    const next = route[idx + 1];
    if (!next) {
      // end of route: super cancel if possible
      if (f.meter >= 100 && hitConfirmed && f.move.superCancel && this.chance(this.L.superUse * 0.7) && this.canUse(f, 'SUP')) {
        this.combo.route = route.concat(['SUP']);
        return this.pressFor(f, 'SUP');
      }
      return null;
    }
    if (!hitConfirmed && f.C.moves[next] && f.C.moves[next].type !== 'normal') {
      // blocked: don't throw out an unsafe special
      if (this.chance(0.7)) {
        this.combo = null;
        return null;
      }
    }
    if (!this.canUse(f, next)) {
      this.combo = null;
      return null;
    }
    return this.pressFor(f, next);
  }
  pressFor(f, id) {
    // alternate press/release so each frame is a new edge when needed
    const steps = this.moveSteps(f, id, 1);
    const s = steps[0];
    const tick = f.battle.frame & 1;
    let m = this.dirMask(f, s.fw) | (s.dn ? BTN.DOWN : 0);
    if (tick) m |= s.btn;
    return m;
  }

  airLogic(f, o, dist) {
    const pm = this.progMask(f);
    if (pm !== null && pm & BTN.UP) return pm;
    const plan = this.jumpPlan;
    if (!plan) return pm || 0;
    const above = f.y - o.y;
    const dx = (o.x - f.x) * f.facing;
    if (plan.attack && !plan.done) {
      // air special (dive kicks / body presses)
      const airS = this.movesOfKind(f, ['airS']);
      if (airS.length && f.vy < 4 && dx > 30 && dx < 260 && above > 60 && this.chance(0.5)) {
        plan.done = true;
        return BTN.SPECIAL | (f.C.moves[airS[0]].id === 'j2S' ? BTN.DOWN : 0);
      }
      if (f.vy < 2 && dx > -10 && dist < 150 && above < 170) {
        plan.done = true;
        const id = this.chance(0.7) ? 'jH' : 'jL';
        this.combo = null;
        if (this.chance(this.L.combo)) {
          const P = this.profile(f);
          const routes = (P.combos || []).filter((c) => c[0] === id);
          if (routes.length) this.combo = { route: U.choose(routes), idx: 0 };
          else if (f.C.moves['5H']) this.combo = { route: [id, '5H'], idx: 0 };
        }
        return AI_BTN[id[1]];
      }
    }
    return 0;
  }

  // ---- neutral decisions ---------------------------------------------------------
  // an enemy projectile that will reach us soon
  incoming(f) {
    for (const p of f.battle.projs) {
      if (p.owner === f || !p.hit || !p.active) continue;
      const d = Math.abs(p.x - f.x);
      const closing = p.vx === 0 ? d < 110 : Math.sign(p.vx) === Math.sign(f.x - p.x);
      if (closing && d < 90 + Math.abs(p.vx) * 22 && Math.abs(p.y - f.y) < 220) return p;
    }
    return null;
  }

  think(f, o, dist) {
    const L = this.L;
    const P = this.profile(f);
    // don't start something long with a projectile about to arrive
    const inc = this.incoming(f);
    if (inc && this.chance(0.55 + 0.12 * this.level)) {
      if (this.chance(0.75)) {
        this.guardT = 14;
        this.guardLow = inc.hit.level !== 'high';
      } else {
        this.run([{ n: 3, up: true, fw: 1, btn: 0 }]);
        this.jumpPlan = { attack: this.chance(0.6) };
      }
      this.wait = 4;
      return;
    }
    const pref = P.pref || [110, 220];
    const aggro = (P.aggression !== undefined ? P.aggression : 0.6) * L.aggro;
    const zoning = P.zoning || 0;
    const jumpy = P.jumpiness !== undefined ? P.jumpiness : 0.3;
    const opts = [];
    const add = (w, fn) => {
      if (w > 0) opts.push([w, fn]);
    };
    const closeTh = f.S.width / 2 + o.S.width / 2 + (f.S.throwRange || 50);

    // movement
    if (dist > pref[1]) {
      add(2.2 * aggro + 0.4, () => this.run([{ n: 12 + Math.floor(this.r() * 26), fw: 1, btn: 0 }]));
      if (f.S.dash) add(0.9 * aggro, () => this.run([{ n: 2, fw: 1, btn: 0 }, { n: 2, fw: 0, btn: 0 }, { n: 2, fw: 1, btn: 0 }, { n: 10, fw: 0, btn: 0 }]));
    }
    if (dist < pref[0]) {
      add(1.2 * (0.5 + zoning), () => this.run([{ n: 10 + Math.floor(this.r() * 18), fw: -1, btn: 0 }]));
      if (zoning > 0.4) add(0.6 * zoning, () => this.run([{ n: 2, fw: -1, btn: 0 }, { n: 2, fw: 0, btn: 0 }, { n: 2, fw: -1, btn: 0 }]));
    }
    add(0.5, () => this.run([{ n: 6 + Math.floor(this.r() * 14), fw: this.r() < 0.5 ? -1 : 1, btn: 0 }]));
    add(0.35, () => this.run([{ n: 10 + Math.floor(this.r() * 20), fw: -1, dn: this.chance(0.5), btn: 0 }]));
    if (dist < 150) add(L.preBlock * 1.5, () => (this.preBlockT = 12 + Math.floor(this.r() * 16)));

    // a zoner is keeping us out: dash or jump in from further away
    const oz = (o.C.ai && o.C.ai.zoning) || 0;
    if (dist > 340 && dist < 720 && oz > 0.3) {
      if (f.S.dash) add(0.5 + oz, () => this.run([{ n: 2, fw: 1, btn: 0 }, { n: 2, fw: 0, btn: 0 }, { n: 2, fw: 1, btn: 0 }, { n: 8, fw: 1, btn: 0 }]));
      add((jumpy + 0.3) * oz, () => {
        this.run([{ n: 3, up: true, fw: 1, btn: 0 }]);
        this.jumpPlan = { attack: true };
      });
    }
    // jump in
    if (dist > 140 && dist < 340) {
      add(jumpy * 1.4, () => {
        this.run([{ n: 3, up: true, fw: 1, btn: 0 }]);
        this.jumpPlan = { attack: true };
      });
    }
    // throws / command grabs
    if (dist < closeTh) {
      add(0.8 * aggro, () => this.startAttack(f, 'THROW'));
      for (const id of this.movesOfKind(f, ['grab'])) if (this.inRange(f.C.moves[id], dist)) add(1.4 * aggro, () => this.startAttack(f, id));
    }
    // attacks in range
    for (const id in f.C.moves) {
      const m = f.C.moves[id];
      if (!m.ai || m.air || id === 'THROW') continue;
      if (!this.canUse(f, id)) continue;
      const k = m.ai.kind;
      if (!this.inRange(m, dist)) continue;
      let w = m.ai.weight !== undefined ? m.ai.weight : 1;
      switch (k) {
        case 'poke': w *= 1.0 * aggro; break;
        case 'low': w *= 0.8 * aggro; break;
        case 'over': w *= 0.45 * aggro; break;
        case 'proj':
          if (f.battle.frame - this.lastProj < AI_PROJ_GAP[this.level]) w = 0;
          else w *= 0.4 + zoning * 2.2;
          break;
        case 'approach': w *= 0.5 * aggro; break;
        case 'trap': w *= 0.8; break;
        case 'teleport': w *= 0.35; break;
        case 'heal': w *= f.hp < f.maxHp * 0.85 && dist > 380 ? 1.6 : 0; break;
        case 'buff': w *= 0.4; break;
        case 'counter': w *= 0.12; break;
        case 'reversal': w *= 0.1; break;
        case 'super': w *= f.meter >= 100 ? 0.25 * L.superUse : 0; break;
        case 'aa': case 'grab': case 'air': case 'airS': w = 0; break;
        default: w *= 0.3;
      }
      // moves that are punishable on block get used more carefully by stronger CPUs
      if (m.ai.unsafe) w *= 1 - 0.17 * this.level;
      add(w, () => {
        if (k === 'proj') this.lastProj = f.battle.frame;
        this.startAttack(f, id);
      });
    }
    // pick
    let total = 0;
    for (const o2 of opts) total += o2[0];
    let x = this.r() * total;
    for (const [w, fn] of opts) {
      x -= w;
      if (x <= 0) {
        fn();
        break;
      }
    }
    const th = L.think;
    this.wait = th[0] + Math.floor(this.r() * (th[1] - th[0]));
  }
}

// Training dummy behaviours
class DummyController {
  constructor(mode = 'stand') {
    this.mode = mode;
    this.ai = new AIController(2);
  }
  get(f) {
    const o = f.opp;
    const away = o.x > f.x ? BTN.LEFT : BTN.RIGHT;
    switch (this.mode) {
      case 'crouch': return BTN.DOWN;
      case 'jump': return f.y <= 0 && f.state in NEUTRAL_STATES ? BTN.UP : 0;
      case 'block': {
        // perfect guard: read the attacker's current hit levels
        let low = true;
        if (o.state === 'attack' && o.move) {
          for (const h of o.move.hits) if (h.level === 'high') low = false;
          if (o.y > 0) low = false;
        }
        if (o.y > 0) low = false;
        return away | (low ? BTN.DOWN : 0);
      }
      case 'cpu': return this.ai.get(f);
      default: return 0;
    }
  }
}
