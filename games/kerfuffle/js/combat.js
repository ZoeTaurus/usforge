'use strict';
// ---------------------------------------------------------------------------
// Combat: hit detection (limb capsules vs skeleton hurt capsules), blocking,
// armor, throws, techs, combos and projectiles.
// Collision space: x = world x, y = screen-like height (negative = up).
// ---------------------------------------------------------------------------

const JUGGLE_MAX = 7;
const _tmp2 = [0, 0];

class Projectile {
  constructor(battle, owner, o) {
    this.x = 0;
    this.y = 0; // world height (up = +)
    this.vx = 0;
    this.vy = 0;
    this.r = 14;
    this.life = 120;
    this.age = 0;
    this.hits = 1;
    this.strength = 1;
    this.grav = 0;
    this.rehit = 0;
    this.hitDelay = 0;
    this.lastHit = -999;
    this.active = true;
    this.hitstop = 0;
    this.facing = owner.facing;
    Object.assign(this, o);
    this.battle = battle;
    this.owner = owner;
  }
  update() {
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    this.age++;
    if (this.tick) this.tick(this);
    if (!this.active) return;
    this.vy -= this.grav;
    this.x += this.vx;
    this.y += this.vy;
    if (this.floor !== undefined && this.y < this.floor) {
      this.y = this.floor;
      if (this.onFloor) this.onFloor(this);
      else this.vy = 0;
    }
    if (this.age >= this.life) this.kill('expire');
    if (this.x < -150 || this.x > this.battle.W + 150) this.kill('offscreen');
  }
  kill(reason) {
    if (!this.active) return;
    this.active = false;
    if (this.onEnd) this.onEnd(this, reason);
  }
  // collision capsule in collision space
  cap() {
    if (this.capFn) return this.capFn(this);
    return [this.x, -this.y, this.x, -this.y, this.r];
  }
}

const Combat = {
  step(b) {
    const [A, B] = b.fighters;
    const results = [];
    Combat.checkFighter(A, B, results);
    Combat.checkFighter(B, A, results);
    for (const r of results) Combat.apply(b, r);
    Combat.projectiles(b);
  },

  hitCap(f, h) {
    let seg;
    if (h.limb) seg = Rig.limbSeg(f.J, h.limb);
    else if (h.cap) seg = h.cap;
    else if (h.circ) seg = [h.circ[0], h.circ[1], h.circ[0], h.circ[1]];
    else seg = Rig.limbSeg(f.J, 'handF');
    let [x1, y1, x2, y2] = seg;
    if (h.ext) {
      const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
      x2 += (dx / d) * h.ext;
      y2 += (dy / d) * h.ext;
    }
    return [f.x + x1 * f.facing, y1 - f.y, f.x + x2 * f.facing, y2 - f.y, h.r];
  },

  overlapAny(cap, hurts, out) {
    for (const c of hurts) {
      const d2 = U.segSegDist2(cap[0], cap[1], cap[2], cap[3], c[0], c[1], c[2], c[3], out);
      const rr = cap[4] + c[4];
      if (d2 <= rr * rr) return true;
    }
    return false;
  },

  checkFighter(att, vic, results) {
    if (att.state !== 'attack' || !att.move || att.hitstop > 0) return;
    const m = att.move;
    for (let i = 0; i < m.hits.length; i++) {
      const h = m.hits[i];
      if (att.mf < h.at[0] || att.mf > h.at[1]) continue;
      const last = att.hitLog[i];
      if (last !== undefined && !(h.rehit && att.mf - last >= h.rehit)) continue;
      if (h.maxHits && (att.hitCount[i] || 0) >= h.maxHits) continue;
      if (!Combat.canBeHit(vic, h, att)) continue;
      const cap = Combat.hitCap(att, h);
      const hurts = vic.hurtWorld();
      if (Combat.overlapAny(cap, hurts, _tmp2)) {
        results.push({ att, vic, h, i, point: [_tmp2[0], _tmp2[1]], src: att });
        return; // one hit per frame per attacker
      }
    }
  },

  canBeHit(vic, h, src) {
    if (vic.inv > 0 || vic.isKO) return false;
    if (vic.state in NO_HURT_STATES) return false;
    if (vic.state === 'airhit' && vic.juggle >= JUGGLE_MAX) return false;
    if (h.groundOnly && vic.y > 0) return false;
    if (h.airOnly && vic.y <= 0) return false;
    if (vic.state === 'attack' && vic.move) {
      const vm = vic.move, f = vic.mf;
      if (vm.inv && f >= vm.inv[0] && f <= vm.inv[1]) return false;
      const srcAir = src instanceof Projectile ? src.y > 40 : src.y > 0;
      if (vm.airInv && srcAir && f >= vm.airInv[0] && f <= vm.airInv[1]) return false;
      if (vm.projInv && src instanceof Projectile && f >= vm.projInv[0] && f <= vm.projInv[1]) return false;
      if (vm.lowInv && h.level === 'low' && f >= vm.lowInv[0] && f <= vm.lowInv[1]) return false;
    }
    if (vic.state === 'dash' && vic.S.dash.projInv && src instanceof Projectile) return false;
    return true;
  },

  isBlocking(vic, h, srcX) {
    if (h.unblockable) return false;
    const st = vic.state;
    if (!(st in NEUTRAL_STATES) && st !== 'block') return false;
    if (vic.y > 0) return false;
    if (!vic.holdingAway(srcX) && st !== 'block') return false;
    const crouch = vic.down;
    if (h.level === 'low' && !crouch) return false;
    if (h.level === 'high' && crouch) return false;
    return true;
  },

  armored(vic, h) {
    if (vic.state !== 'attack' || !vic.move || !vic.move.armor) return false;
    const a = vic.move.armor;
    if (vic.mf < a[0] || vic.mf > a[1] || vic.armorLeft <= 0) return false;
    if (h.armorBreak || h.super) return false;
    return true;
  },

  apply(b, r) {
    const { att, vic, h, src } = r;
    if (src === att) {
      att.hitLog[r.i] = att.mf;
      att.hitCount[r.i] = (att.hitCount[r.i] || 0) + 1;
    }
    if (vic.state === 'held' || vic.isKO) return;
    const srcX = src === att ? att.x : src.x;
    const dir = src === att ? att.facing : src.vx !== 0 ? Math.sign(src.vx) : src.facing;
    // counter stances (e.g. a parry): the defender's move decides what happens
    // (onCounter may return false to let a hit through, e.g. supers)
    if (vic.state === 'attack' && vic.move && vic.move.counter && !h.unblockable) {
      const c = vic.move.counter;
      if (vic.mf >= c[0] && vic.mf <= c[1] && vic.move.onCounter && vic.move.onCounter(vic, att, h, src, r.point) !== false) {
        if (src === att) att.moveContact = true;
        return;
      }
    }
    if (Combat.isBlocking(vic, h, srcX)) return Combat.block(b, att, vic, h, r.point, dir, src);
    if (Combat.armored(vic, h)) return Combat.armorHit(b, att, vic, h, r.point, dir, src);
    if (h.seq && src === att && att.move && att.move.seqHit) {
      att.moveContact = true;
      const sq = att.move.seqHit;
      if (h.dmg) Combat.seqHit(att, vic, { dmg: h.dmg, sfx: h.sfx, spark: 'H' });
      att.startSeq(sq, vic);
      return;
    }
    Combat.hit(b, att, vic, h, r.point, dir, src);
  },

  hit(b, att, vic, h, point, dir, src) {
    const counter = vic.state === 'attack' && vic.move && vic.mf < vic.move.firstActive && vic.move.type !== 'super';
    if (!vic.combo) vic.combo = { hits: 0, dmg: 0 };
    const n = vic.combo.hits;
    let scale = n <= 1 ? 1 : Math.max(0.3, 1 - 0.1 * (n - 1));
    if (h.minScale) scale = Math.max(scale, h.minScale);
    const dmg = Math.max(1, Math.round(h.dmg * scale * (counter ? 1.2 : 1)));
    vic.combo.hits++;
    vic.combo.dmg += dmg;
    const hs = Math.round(h.hs * Math.max(0.55, 1 - 0.035 * n)) + (counter ? 6 : 0);
    att.addMeter(h.meter !== undefined ? h.meter : dmg * 0.11 + 1.5);
    vic.addMeter(dmg * 0.07);
    const stop = h.stop + (counter ? 3 : 0);
    vic.hitstop = stop;
    if (src === att) {
      att.hitstop = stop;
      att.moveContact = true;
      att.moveHit = true;
    } else if (src.hitStopOwner) {
      att.hitstop = Math.round(stop * 0.5);
    }
    vic.takeHit(att, h, { dmg, hs, counter, dir, point });
    att.stats.dmg += dmg;
    // corner pushback goes to the attacker
    if (src === att && !h.launch && !h.kd && vic.y <= 0 && b.atWall(vic, dir)) att.vx = -dir * h.kb[0] * 0.85;
    FX.hitSpark(point[0], point[1], h.spark, dir, counter, att.C.sparkColor);
    Sound.sfx(h.sfx, { vol: counter ? 1.1 : 1 });
    if (h.sfx2) Sound.sfx(h.sfx2);
    if (stop >= 10 || counter) b.shake(Math.min(14, stop * 0.6 + (counter ? 4 : 0)));
    if (counter) FX.word(point[0], point[1] - 40, 'COUNTER!', '#ff4d6d', 0.9);
    else if ((h.spark === 'H' || h.spark === 'S') && Math.random() < 0.3 && att.C.words) {
      FX.word(point[0] + dir * 30, point[1] - 50, U.choose(att.C.words), att.C.wordColor || '#ffd23f', 0.85);
    }
    if (h.onHit) h.onHit(att, vic, src);
    if (src === att && att.move && att.move.onHit) att.move.onHit(att, vic, h);
    if (src !== att && src.onHit) src.onHit(src, vic);
    b.onComboHit(att, vic);
    if (vic.hp <= 0 && !b.training) b.onKO(vic, att);
  },

  block(b, att, vic, h, point, dir, src) {
    vic.takeBlock(att, h, { dir });
    const stop = Math.max(4, Math.round(h.stop * 0.8));
    vic.hitstop = stop;
    if (src === att) {
      att.hitstop = stop;
      att.moveContact = true;
    }
    att.addMeter(1.5 + h.dmg * 0.025);
    vic.addMeter(1 + h.dmg * 0.02);
    if (src === att && b.atWall(vic, dir)) att.vx = -dir * h.kb[0] * 0.95;
    FX.blockSpark(point[0], point[1], dir);
    Sound.sfx('block');
    if (src !== att && src.onBlock) src.onBlock(src, vic);
    if (h.onBlock) h.onBlock(att, vic, src);
  },

  armorHit(b, att, vic, h, point, dir, src) {
    vic.armorLeft--;
    const dmg = Math.round(h.dmg * 0.65);
    vic.hp -= dmg;
    vic.redDelay = 40;
    vic.armorFlash = 10;
    vic.hitstop = 7;
    if (src === att) {
      att.hitstop = 7;
      att.moveContact = true;
    }
    att.addMeter(dmg * 0.08);
    vic.addMeter(dmg * 0.1);
    FX.hitSpark(point[0], point[1], 'L', dir, false, '#ff9a5c');
    FX.ring(point[0], point[1], 40, '#ff6b4a');
    Sound.sfx('armor');
    if (vic.hp <= 0) {
      vic.hp = 1;
      Combat.hit(b, att, vic, h, point, dir, src);
    }
  },

  seqHit(att, vic, e) {
    const b = att.battle;
    if (!vic.combo) vic.combo = { hits: 0, dmg: 0 };
    const n = vic.combo.hits;
    const minS = e.minScale !== undefined ? e.minScale : att.move && att.move.type === 'super' ? 0.7 : 0.5;
    const scale = e.noScale ? 1 : Math.max(minS, 1 - 0.1 * Math.max(0, n - 1));
    const dmg = Math.max(1, Math.round(e.dmg * scale));
    vic.hp -= dmg;
    vic.combo.hits++;
    vic.combo.dmg += dmg;
    vic.redDelay = 40;
    vic.flash = 3;
    vic.flashColor = '#ffffff';
    att.stats.dmg += dmg;
    att.addMeter(e.meter !== undefined ? e.meter : dmg * 0.04);
    vic.addMeter(dmg * 0.06);
    let p;
    if (e.at) p = [att.x + e.at[0] * att.facing, e.at[1] - att.y];
    else {
      const nk = vic.jointWorld('neck'), hp = vic.jointWorld('hip');
      p = [(nk[0] + hp[0]) / 2, (nk[1] + hp[1]) / 2];
    }
    FX.hitSpark(p[0], p[1], e.spark || 'H', att.facing, false, att.C.sparkColor);
    Sound.sfx(e.sfx || 'hitH');
    if (e.shake) b.shake(e.shake);
    if (e.stop) {
      att.hitstop = e.stop;
      vic.hitstop = e.stop;
    }
    if (e.word) FX.word(p[0], p[1] - 50, e.word, e.wordColor || att.C.wordColor || '#ffd23f', 1);
    b.onComboHit(att, vic);
    if (vic.hp <= 0) {
      if (b.training) vic.hp = 1;
      else {
        vic.hp = 0;
        vic.isKO = true;
        b.onKO(vic, att);
      }
    }
  },

  tryThrow(att) {
    const vic = att.opp, m = att.move;
    const range = m.range !== undefined ? m.range : att.S.throwRange || 50;
    const dx = (vic.x - att.x) * att.facing;
    const reach = range + vic.S.width * 0.5 + att.S.width * 0.5;
    if (dx < -12 || dx > reach) return false;
    if (vic.y > 6 && !m.airOk) return false;
    if (vic.state === 'air' || vic.state === 'bdash') {
      if (!m.airOk) return false;
    }
    const bad = { hit: 1, block: 1, airhit: 1, down: 1, getup: 1, held: 1, seq: 1, ko: 1, tech: 1, intro: 1, win: 1, lose: 1 };
    if (vic.state in bad) return false;
    if (vic.throwInv > 0 || vic.inv > 0 || vic.isKO) return false;
    if (vic.state === 'attack' && vic.move) {
      const vm = vic.move, f = vic.mf;
      if (vm.inv && f >= vm.inv[0] && f <= vm.inv[1]) return false;
      if (vm.throwInv && f >= vm.throwInv[0] && f <= vm.throwInv[1]) return false;
      // simultaneous normal throws clash into a tech
      if (vm.throw && !vm.cmdGrab && !m.cmdGrab && f <= vm.throwAt + 1) {
        Combat.tech(att, vic);
        return true;
      }
    }
    if (vic.state === 'dash' && vic.y > 0) return false;
    att.moveContact = true;
    Sound.sfx('grab');
    att.startSeq(m.seq, vic);
    return true;
  },

  tech(att, vic) {
    const b = att.battle;
    if (att.state === 'seq') {
      att.seq = null;
      att.seqVic = null;
    }
    vic.heldBy = null;
    vic.seqPose = null;
    for (const f of [att, vic]) {
      f.move = null;
      f.moveId = null;
      f.y = 0;
      f.vy = 0;
      f.faceOpp();
      f.state = 'tech';
      f.sf = 0;
      f.vx = -f.facing * 7.5;
      f.throwInv = 14;
      f.setAnim('tech', 2);
    }
    const mx = (att.x + vic.x) / 2;
    FX.techSpark(mx, -110);
    Sound.sfx('tech');
    FX.word(mx, -190, 'TECH!', '#7fe3ff', 0.9);
  },

  // ---- projectiles --------------------------------------------------------
  projectiles(b) {
    const ps = b.projs;
    // clashes
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p.active || !p.hit || p.noClash) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const q = ps[j];
        if (!q.active || !q.hit || q.noClash || q.owner === p.owner) continue;
        const a = p.cap(), c = q.cap();
        const d2 = U.segSegDist2(a[0], a[1], a[2], a[3], c[0], c[1], c[2], c[3], _tmp2);
        const rr = a[4] + c[4];
        if (d2 <= rr * rr) {
          const sp = p.strength, sq = q.strength;
          p.strength -= sq;
          q.strength -= sp;
          FX.hitSpark(_tmp2[0], _tmp2[1], 'L', 1, false, '#ffffff');
          FX.ring(_tmp2[0], _tmp2[1], 36, '#ffffff');
          Sound.sfx('clash');
          if (p.strength <= 0) p.kill('clash');
          if (q.strength <= 0) q.kill('clash');
        }
      }
    }
    // hits
    for (const p of ps) {
      if (!p.active || !p.hit) continue;
      if (p.age < p.hitDelay) continue;
      if (p.hitsLeft !== undefined && p.hitsLeft <= 0) continue;
      if (b.frame - p.lastHit < (p.rehit || 12)) continue;
      const vic = p.target || p.owner.opp;
      if (!Combat.canBeHit(vic, p.hit, p)) continue;
      if (vic.state === 'held' || vic.state === 'seq') continue;
      const cap = p.cap();
      const hurts = vic.hurtWorld();
      if (Combat.overlapAny(cap, hurts, _tmp2)) {
        p.lastHit = b.frame;
        Combat.apply(b, { att: p.owner, vic, h: p.hit, point: [_tmp2[0], _tmp2[1]], src: p });
        p.hits--;
        if (p.hits <= 0) p.kill('hit');
        else p.hitstop = 4;
      }
    }
    b.projs = ps.filter((p) => p.active);
  },
};
