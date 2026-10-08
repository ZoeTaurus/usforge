'use strict';
// ---------------------------------------------------------------------------
// Fighter: physics, input handling, the state machine, moves and reactions.
// World coordinates: x grows right, y is height above the floor (up = +).
// ---------------------------------------------------------------------------

const BUFFER = 6;
const DIR_MASK = BTN.UP | BTN.DOWN | BTN.LEFT | BTN.RIGHT;
const NEUTRAL_STATES = { idle: 1, walk: 1, crouch: 1, guard: 1, cguard: 1 };
const NO_HURT_STATES = { down: 1, getup: 1, held: 1, seq: 1, ko: 1, win: 1, lose: 1, intro: 1 };

class Fighter {
  constructor(battle, side, charId, palIdx, ctrl) {
    this.battle = battle;
    this.side = side;
    this.C = CHARS[charId];
    this.charId = charId;
    this.palIdx = palIdx;
    this.pal = this.C.palettes[palIdx % this.C.palettes.length];
    this.ctrl = ctrl;
    this.S = this.C.stats;
    this.maxHp = this.S.hp;
    this.meter = 0;
    this.wins = 0;
    this.inMask = 0;
    this.prevMask = 0;
    this.inputEnabled = false;
    this.stats = { maxCombo: 0, dmg: 0 };
    this.pose = this.C.poses.stance;
    this.resetRound(battle ? battle.W / 2 : 0, 1);
  }

  get opp() {
    return this.battle.fighters[1 - this.side];
  }

  resetRound(x, facing) {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.hp = this.maxHp;
    this.redHp = this.maxHp;
    this.redDelay = 0;
    this.state = 'idle';
    this.sf = 0;
    this.move = null;
    this.moveId = null;
    this.mf = 0;
    this.hitLog = {};
    this.hitCount = {};
    this.moveContact = false;
    this.hitstun = 0;
    this.blockstun = 0;
    this.hitstop = 0;
    this.inv = 0;
    this.throwInv = 0;
    this.combo = null;
    this.juggle = 0;
    this.kd = false;
    this.isKO = false;
    this.bounced = false;
    this.airJumpsLeft = 0;
    this.airAttacks = 0;
    this.chainCount = 0;
    this.buf = { L: -99, H: -99, S: -99, SUP: -99, THR: -99, UP: -99 };
    this.bufDir = { L: 0, H: 0, S: 0 }; // stick direction when each attack button was pressed
    this.tap = null;
    this.dashReq = null;
    this.walkDist = 0;
    this.airF = 0;
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.armorFlash = 0;
    this.afterimages = [];
    this.trail = 0;
    this.trailColor = null;
    this.seq = null;
    this.heldBy = null;
    this.seqPose = null;
    this.blinkT = 120 + Math.random() * 120;
    this.idleT = 0;
    this.cos = {};
    this.anim = null;
    this.animF = 0;
    this.blendT = 0;
    this.blendFrom = null;
    this.data = {}; // per-character scratch (pets, charges...)
    this.setAnim('idle', 0);
    if (this.C.onReset) this.C.onReset(this);
    this.computePose();
  }

  // ---- input --------------------------------------------------------------
  readInput() {
    let m = 0;
    if (this.inputEnabled && this.ctrl) m = this.ctrl.get(this) | 0;
    this.prevMask = this.inMask;
    this.inMask = m;
    const pressed = m & ~this.prevMask;
    const fr = this.battle.frame;
    if (pressed & BTN.LIGHT) {
      this.buf.L = fr;
      this.bufDir.L = m & DIR_MASK;
    }
    if (pressed & BTN.HEAVY) {
      this.buf.H = fr;
      this.bufDir.H = m & DIR_MASK;
    }
    if (pressed & BTN.SPECIAL) {
      this.buf.S = fr;
      this.bufDir.S = m & DIR_MASK;
    }
    if (pressed & BTN.SUPER) this.buf.SUP = fr;
    if (pressed & BTN.THROW) this.buf.THR = fr;
    if (pressed & BTN.UP) this.buf.UP = fr;
    const lr = pressed & (BTN.LEFT | BTN.RIGHT);
    if (lr && !(m & BTN.DOWN)) {
      const d = lr & BTN.LEFT ? -1 : 1;
      if (this.tap && this.tap.d === d && fr - this.tap.f <= 12) {
        this.dashReq = { d, f: fr };
        this.tap = null;
      } else this.tap = { d, f: fr };
    }
  }
  held(b) {
    return (this.inMask & b) !== 0;
  }
  // a move's hide:[a,b] window makes the fighter invisible (teleports)
  get hidden() {
    const m = this.state === 'attack' && this.move;
    return !!(m && m.hide && this.mf >= m.hide[0] && this.mf <= m.hide[1]);
  }
  get dirX() {
    const l = this.held(BTN.LEFT), r = this.held(BTN.RIGHT);
    return l === r ? 0 : r ? 1 : -1;
  }
  get fwd() {
    return this.dirX === this.facing;
  }
  get back() {
    return this.dirX === -this.facing;
  }
  get down() {
    return this.held(BTN.DOWN) && !this.held(BTN.UP);
  }
  get up() {
    return this.held(BTN.UP) && !this.held(BTN.DOWN);
  }
  holdingAway(srcX) {
    const d = this.dirX;
    if (d === 0) return false;
    if (Math.abs(srcX - this.x) < 1) return d === -this.facing;
    return srcX > this.x ? d < 0 : d > 0;
  }
  recent(k, w = BUFFER) {
    return this.battle.frame - this.buf[k] <= w;
  }
  throwPressedSince(fr) {
    const B = this.buf;
    if (B.THR >= fr) return true;
    return B.L >= fr && B.H >= fr && Math.abs(B.L - B.H) <= 4;
  }

  // ---- animation ------------------------------------------------------------
  setAnim(a, blend = 4) {
    const A = typeof a === 'string' ? this.C.anims[a] : a;
    if (!A) return;
    this.blendFrom = this.pose;
    this.blendDur = this.blendT = blend;
    this.anim = A;
    this.animF = 0;
  }

  setStateAnim(st, anim, blend = 4) {
    if (this.state !== st) {
      this.state = st;
      this.sf = 0;
      this.setAnim(anim || st, blend);
    }
  }

  procPose(kind) {
    const C = this.C, P = C.poses;
    switch (kind) {
      case 'idle': {
        const t = 0.5 - 0.5 * Math.cos((TAU * this.animF) / C.idlePeriod);
        return Rig.lerp(C, P.stance, P.stance2, t);
      }
      case 'walk': {
        const W = C.walk;
        const base = P.walkBase || P.stance;
        const p = (((this.walkDist / (W.A * 4)) % 1) + 1) % 1;
        const o = Object.assign({}, base);
        const f0 = base.lf ? base.lf[0] : 18, b0 = base.lb ? base.lb[0] : -22;
        const foot = (ph) => {
          ph = ((ph % 1) + 1) % 1;
          if (ph < 0.5) return [W.A - (ph / 0.5) * W.A * 2, 0];
          const s = (ph - 0.5) / 0.5;
          return [-W.A + s * W.A * 2, Math.sin(s * Math.PI) * W.H];
        };
        const a = foot(p), b = foot(p + 0.5);
        o.lf = [f0 + a[0], a[1]];
        o.lb = [b0 + b[0], b[1]];
        o.d = (base.d || 0) + W.bob * (0.5 + 0.5 * Math.cos(p * TAU * 2));
        o.t = (base.t || 0) + W.sway * Math.sin(p * TAU * 2);
        o.fs = (base.fs || 0) + (W.arm || 6) * Math.sin(p * TAU);
        o.bs = (base.bs || 0) - (W.arm || 6) * Math.sin(p * TAU);
        if (C.walkMod) C.walkMod(this, o, p);
        return o;
      }
      case 'air': {
        const S = this.S;
        const t = U.clamp((S.jumpV * 0.55 - this.vy) / (S.jumpV * 1.1), 0, 1);
        let o = Rig.lerp(C, P.jump, P.fall, U.ease.inout(t));
        if (this.flipJump) {
          const total = (2 * S.jumpV) / S.grav;
          const k = U.clamp(this.airF / (total * 0.8), 0, 1);
          const tk = Math.sin(k * Math.PI);
          o = Rig.lerp(C, o, P.tuck, tk);
          o.r = U.ease.inout(k) * 360 * this.flipJump;
        }
        return o;
      }
      case 'airRecover': {
        const k = U.clamp(this.sf / 16, 0, 1);
        const o = Rig.lerp(C, P.tuck, P.fall, U.ease.inout(k));
        o.r = -360 * U.ease.out(k);
        return o;
      }
      case 'airhit': {
        const t = U.clamp((6 - this.vy) / 14, 0, 1);
        const o = Rig.lerp(C, P.hurtAir, P.launch, t);
        if (this.kd || this.isKO) o.r = (this.spinR || 0) + (-70 * U.clamp((2 - this.vy) / 12, 0, 1));
        return o;
      }
    }
    return P.stance;
  }

  computePose() {
    const C = this.C;
    let P;
    if (this.state === 'held' && this.seqPose) P = this.seqPose;
    else {
      const A = this.anim;
      let af = this.animF;
      if (this.state === 'attack' && this.move && A === this.move.anim) af = this.mf;
      else if (this.state === 'seq' && this.seq && A === this.seq.anim) af = this.seqF;
      if (!A) P = C.poses.stance;
      else if (A.proc) P = this.procPose(A.proc);
      else P = Anim.sample(C, A, af);
    }
    if (this.blendT > 0 && this.blendFrom) {
      const t = 1 - this.blendT / this.blendDur;
      P = Rig.lerp(C, this.blendFrom, P, U.ease.inout(t));
    }
    this.pose = P;
    const airAnim = (this.anim && this.anim.air) || this.state === 'air' || this.state === 'airhit' ||
      (this.state === 'attack' && this.move && this.move.air) || (this.state === 'held' && this.seqAir);
    this.J = Rig.solve(C, P, !airAnim);
    // facial expression
    let face = P.face;
    if (this.isKO && (this.state === 'ko' || this.state === 'airhit')) face = 'ko';
    else if (!face) {
      switch (this.state) {
        case 'hit': case 'airhit': case 'held': face = 'hurt'; break;
        case 'attack': case 'seq': face = 'angry'; break;
        case 'block': case 'guard': case 'cguard': face = 'block'; break;
        case 'win': face = 'happy'; break;
        case 'lose': face = 'sad'; break;
        case 'down': case 'getup': face = 'hurt'; break;
        default: face = 'normal';
      }
    }
    this.face = face;
    this.blinking = this.blinkT < 7 && (face === 'normal' || face === 'block');
    if (C.post) C.post(this);
  }

  // Advance animation-time things (only when not frozen)
  tickAnim() {
    this.animF++;
    this.t = (this.t || 0) + 1;
    if (this.blendT > 0) this.blendT--;
    this.blinkT--;
    if (this.blinkT < 0) this.blinkT = 150 + Math.random() * 150;
    if (this.trail > 0) {
      this.trail--;
      if (this.t % 2 === 0 && this.J) {
        this.afterimages.push({ x: this.x, y: this.y, facing: this.facing, J: this.J, life: 12, max: 12 });
      }
    }
    for (const a of this.afterimages) a.life--;
    this.afterimages = this.afterimages.filter((a) => a.life > 0);
  }

  // visual timers that run every frame, even during hitstop
  fxTick() {
    if (this.flash > 0) this.flash--;
    if (this.armorFlash > 0) this.armorFlash--;
  }

  // ---- main update -----------------------------------------------------------
  update() {
    if (this.hitstop > 0) {
      this.hitstop--;
      // the input buffer is frozen during hitstop so presses made in the freeze still count
      const B = this.buf, fr = this.battle.frame;
      for (const k in B) if (fr - B[k] <= BUFFER) B[k]++;
      return;
    }
    this.sf++;
    this.tickAnim();
    if (this.inv > 0) this.inv--;
    if (this.throwInv > 0) this.throwInv--;
    if (this.state in NEUTRAL_STATES) this.idleT++;
    else this.idleT = 0;

    switch (this.state) {
      case 'idle': case 'walk': case 'crouch': case 'guard': case 'cguard': this.stNeutral(); break;
      case 'jsquat': this.stJumpSquat(); break;
      case 'air': this.stAir(); break;
      case 'land': this.stLand(); break;
      case 'dash': this.stDash(); break;
      case 'bdash': break; // airborne hop; ends on landing
      case 'attack': this.stAttack(); break;
      case 'recover': if (this.sf >= this.recoverF) this.toNeutral(true); break;
      case 'block': this.stBlock(); break;
      case 'hit': this.stHit(); break;
      case 'airhit': this.stAirHit(); break;
      case 'down': if (this.sf >= (this.S.downTime || 32)) this.startGetup(); break;
      case 'getup': if (this.sf >= 22) { this.throwInv = 8; this.toNeutral(true); } break;
      case 'seq': this.stSeq(); break;
      case 'held': break;
      case 'tech': if (this.sf >= 16) this.toNeutral(true); break;
      default: break;
    }
    if (this.state === 'walk') this.walkDist += this.vx * this.facing;
    this.physics();
    if (this.C.update) this.C.update(this);
  }

  toNeutral(act) {
    if (this.combo) {
      this.battle.onComboEnd(this);
      this.combo = null;
    }
    this.juggle = 0;
    this.kd = false;
    this.move = null;
    this.moveId = null;
    this.vx = 0;
    const st = this.down ? 'crouch' : 'idle';
    this.state = st;
    this.sf = 0;
    this.setAnim(st, 4);
    if (act && this.inputEnabled) this.stNeutral();
  }

  stNeutral() {
    if (this.y > 0) {
      this.state = 'air';
      this.setAnim(this.C.anims.air || { proc: 'air', air: true }, 3);
      return;
    }
    if (this.tryAttack(false)) return;
    const fr = this.battle.frame;
    if (this.up) {
      this.startJump();
      return;
    }
    if (this.dashReq && fr - this.dashReq.f <= 8) {
      const d = this.dashReq.d;
      this.dashReq = null;
      if (d === this.facing) this.startDash();
      else this.startBackdash();
      return;
    }
    if (this.down) {
      const g = this.back && this.threatened();
      this.setStateAnim(g ? 'cguard' : 'crouch', null, 4);
      this.vx = 0;
      return;
    }
    if (this.fwd) {
      this.setStateAnim('walk', null, 5);
      this.vx = this.S.walkF * this.facing;
    } else if (this.back) {
      if (this.threatened()) {
        this.setStateAnim('guard', null, 3);
        this.vx = 0;
      } else {
        this.setStateAnim('walk', null, 5);
        this.vx = -this.S.walkB * this.facing;
      }
    } else {
      this.setStateAnim('idle', null, 6);
      this.vx = 0;
    }
  }

  threatened() {
    const o = this.opp;
    if (o.state === 'attack' && o.move && o.move.hits.length && Math.abs(o.x - this.x) < 360) {
      if (o.mf <= o.move.lastActive) return true;
    }
    for (const p of this.battle.projs) {
      if (p.owner !== this && p.active && p.hit && Math.abs(p.x - this.x) < 330) {
        if (p.vx === 0 || Math.sign(p.vx) === Math.sign(this.x - p.x)) return true;
      }
    }
    return false;
  }

  startJump() {
    this.state = 'jsquat';
    this.sf = 0;
    this.jumpDir = this.dirX;
    this.vx = 0;
    this.setAnim('jsquat', 2);
  }
  stJumpSquat() {
    if (this.dirX !== 0) this.jumpDir = this.dirX;
    if (this.sf >= (this.S.jsq || 4)) this.launchJump(this.jumpDir, 1);
  }
  launchJump(dir, mult) {
    const S = this.S;
    this.vy = S.jumpV * mult;
    this.vx = dir * S.jumpVx;
    this.y = Math.max(this.y, 0.01);
    this.state = 'air';
    this.sf = 0;
    this.airF = 0;
    this.airAttacks = 0;
    this.jumpFrame = this.battle.frame;
    if (mult === 1) this.airJumpsLeft = S.airJumps || 0;
    this.flipJump = S.flip && dir !== 0 ? (dir === this.facing ? 1 : -1) : 0;
    this.setAnim(this.C.anims.air || { proc: 'air', air: true }, 2);
    Sound.sfx('jump', { pitch: this.S.voicePitch || 1 });
    FX.dust(this.x, 0, 4, 0);
  }

  stAir() {
    this.airF++;
    if (this.airAttacks < (this.S.airAttacks || 1) && this.tryAttack(false)) return;
    if (this.airJumpsLeft > 0 && this.recent('UP', 3) && this.buf.UP > this.jumpFrame + 4 && this.vy < this.S.jumpV * 0.6) {
      this.airJumpsLeft--;
      this.buf.UP = -99;
      this.launchJump(this.dirX, this.S.airJumpMult || 0.85);
      FX.ring(this.x, -this.y + 6, 30, '#ffffff');
    }
  }

  stLand() {
    if (this.sf >= this.landLag) this.toNeutral(true);
  }

  startDash() {
    const D = this.S.dash;
    this.state = 'dash';
    this.sf = 0;
    this.setAnim(this.C.anims.dash, 2);
    if (D.hop) {
      this.vy = D.hop;
      this.y = 0.01;
    }
    Sound.sfx('dash');
    FX.dust(this.x - this.facing * 20, 0, 5, -this.facing);
    this.trail = D.trail ? D.f : 0;
  }
  stDash() {
    const D = this.S.dash;
    const t = this.sf / D.f;
    this.vx = this.facing * D.v * (1 - t * t * 0.85);
    if (this.sf >= (D.cancel || 7) && this.y <= 0 && this.tryAttack(false)) return;
    if (this.sf >= D.f && this.y <= 0) {
      this.toNeutral(true);
    }
  }

  startBackdash() {
    const B = this.S.bdash;
    this.state = 'bdash';
    this.sf = 0;
    this.vx = -this.facing * B.v;
    this.vy = B.vy;
    this.y = 0.01;
    this.inv = B.inv || 0;
    this.setAnim(this.C.anims.bdash, 2);
    Sound.sfx('dash', { pitch: 0.9 });
  }

  stBlock() {
    this.blockstun--;
    const crouch = this.down;
    const want = crouch ? 'cguard' : 'guard';
    if (this.anim !== this.C.anims[want]) this.setAnim(want, 2);
    if (this.blockstun <= 0) this.toNeutral(true);
  }

  stHit() {
    this.hitstun--;
    if (this.hitstun <= 0) this.toNeutral(true);
  }

  stAirHit() {
    if (!this.kd && !this.isKO) {
      this.hitstun--;
      if (this.hitstun <= 0) {
        // recover in the air with a flip
        this.state = 'air';
        this.sf = 0;
        this.airF = 99;
        this.airAttacks = 1;
        this.airJumpsLeft = 0;
        this.flipJump = 0;
        this.inv = 8;
        this.setAnim({ proc: 'airRecover', air: true }, 2);
        if (this.combo) {
          this.battle.onComboEnd(this);
          this.combo = null;
        }
        this.juggle = 0;
      }
    } else if (this.vy < 0) this.spinR = (this.spinR || 0) * 0.9;
  }

  startGetup() {
    this.state = 'getup';
    this.sf = 0;
    this.inv = 24;
    this.setAnim('getup', 3);
  }

  // ---- attacks ---------------------------------------------------------------
  // Direction for a buffered button: as held when it was pressed (so a
  // cancel buffered during hitstop keeps its direction), else as held now.
  dirFor(btn) {
    const d = this.bufDir[btn];
    return d && this.recent(btn) ? d : this.inMask & DIR_MASK;
  }

  variant(btn, air) {
    const mv = this.C.moves;
    const d = this.dirFor(btn);
    const l = (d & BTN.LEFT) !== 0, r = (d & BTN.RIGHT) !== 0;
    const dx = l === r ? 0 : r ? 1 : -1;
    const down = (d & BTN.DOWN) !== 0 && (d & BTN.UP) === 0;
    const fwd = dx === this.facing, back = dx === -this.facing;
    if (air) {
      if (down && mv['j2' + btn]) return 'j2' + btn;
      if (fwd && mv['j6' + btn]) return 'j6' + btn;
      if (back && mv['j4' + btn]) return 'j4' + btn;
      return 'j' + btn;
    }
    if (down) return mv['2' + btn] ? '2' + btn : '5' + btn;
    if (fwd && mv['6' + btn]) return '6' + btn;
    if (back && mv['4' + btn]) return '4' + btn;
    return '5' + btn;
  }

  tryAttack(cancel) {
    const B = this.buf;
    const rec = (k) => this.recent(k);
    const air = this.y > 0;
    const cands = [];
    if (this.meter >= 100 && (rec('SUP') || (rec('H') && rec('S') && Math.abs(B.H - B.S) <= 3))) {
      cands.push([air ? 'jSUP' : 'SUP', ['SUP', 'H', 'S']]);
    }
    if (!air && (rec('THR') || (rec('L') && rec('H') && Math.abs(B.L - B.H) <= 3))) cands.push(['THROW', ['THR', 'L', 'H']]);
    if (rec('S')) cands.push([this.variant('S', air), ['S']]);
    if (rec('H')) cands.push([this.variant('H', air), ['H']]);
    if (rec('L')) cands.push([this.variant('L', air), ['L']]);
    for (const [id, consume] of cands) {
      const m = this.C.moves[id];
      if (!m) continue;
      if (m.air !== air) continue;
      if (cancel && !this.canCancelInto(m, id)) continue;
      if (m.cond && !m.cond(this)) continue;
      if (this.startMove(id)) {
        for (const k of consume) B[k] = -99;
        return true;
      }
    }
    return false;
  }

  canCancelInto(m, id) {
    const cur = this.move;
    if (!cur) return false;
    if (cur.cancelTo && cur.cancelTo.includes(id) && (this.moveContact || cur.cancelWhiff)) {
      if (!cur.cancelFrom || this.mf >= cur.cancelFrom) return true;
    }
    if (!this.moveContact) return false;
    if (m.type === 'super') return !!cur.superCancel;
    if (m.type === 'special') return !!cur.special;
    if (m.type === 'normal') {
      if (!cur.chain.includes(id)) return false;
      if (m.btn === 'L' && cur.btn === 'L' && this.chainCount >= 2) return false;
      return true;
    }
    return false;
  }

  startMove(id) {
    const m = this.C.moves[id];
    if (!m) return false;
    if (m.type === 'super') {
      if (this.meter < 100) return false;
      this.meter -= 100;
    }
    const wasAttack = this.state === 'attack';
    if (wasAttack && this.move && this.move.btn === 'L' && m.btn === 'L') this.chainCount++;
    else if (!wasAttack) this.chainCount = 0;
    if (m.air && !wasAttack) this.airAttacks++;
    this.state = 'attack';
    this.sf = 0;
    this.move = m;
    this.moveId = id;
    this.mf = 0;
    this.hitLog = {};
    this.hitCount = {};
    this.moveContact = false;
    this.moveHit = false;
    this.md = {};
    this.armorLeft = m.armor ? m.armor[2] || 1 : 0;
    if (!m.air && !m.keepVel) this.vx = 0;
    this.setAnim(m.anim, m.blend !== undefined ? m.blend : 2);
    if (m.type === 'super') this.battle.superFlash(this, m);
    if (m.onStart) m.onStart(this);
    this.moveFrame();
    return true;
  }

  moveFrame() {
    const m = this.move, mf = this.mf;
    if (m.vel) {
      for (let i = 0; i < m.vel.length; i++) {
        const v = m.vel[i];
        if (v[0] === mf) {
          if (v[1] !== null && v[1] !== undefined) this.vx = v[1] * this.facing;
          if (v[2] !== null && v[2] !== undefined) {
            this.vy = v[2];
            if (v[2] > 0 && this.y <= 0) this.y = 0.01;
          }
        }
      }
    }
    if (m.ev && m.ev[mf]) m.ev[mf](this);
    if (mf === m.firstActive && m.whiff) Sound.sfx(m.whiff, { pitch: this.S.swingPitch || 1 });
    if (m.throw && mf === m.throwAt) Combat.tryThrow(this);
    if (m.tick) m.tick(this, mf);
    if (m.trail && mf === m.trail[0]) this.trail = m.trail[1] - m.trail[0];
  }

  stAttack() {
    const m = this.move;
    this.mf++;
    if (this.mf >= m.frames) {
      this.endMove();
      return;
    }
    this.moveFrame();
    if (this.state !== 'attack' || this.move !== m) return;
    if ((this.moveContact || (m.cancelTo && m.cancelWhiff)) && this.tryAttack(true)) return;
    if (this.y <= 0 && this.vy <= 0 && !m.keepVel) {
      const fr = m.fric !== undefined ? m.fric : 0.8;
      this.vx *= fr;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
    }
  }

  endMove() {
    const m = this.move;
    if (m && m.onEnd) m.onEnd(this);
    this.move = null;
    this.moveId = null;
    if (this.state !== 'attack') return;
    if (this.y > 0) {
      this.state = 'air';
      this.sf = 0;
      this.airF = 60;
      this.flipJump = 0;
      this.setAnim(this.C.anims.air || { proc: 'air', air: true }, 4);
    } else this.toNeutral(true);
  }

  // ---- sequences (throws, command grabs, cinematic supers) --------------------
  startSeq(seq, vic) {
    this.state = 'seq';
    this.sf = 0;
    this.seq = seq;
    this.seqF = 0;
    this.seqVic = vic;
    this.seqStart = this.battle.frame;
    this.seqX = this.x;
    this.seqY = this.y;
    this.seqFacing = this.facing; // offsets stay in this frame even if an ev flips facing
    this.vx = this.vy = 0;
    this.trail = 0;
    if (seq.anim) this.setAnim(seq.anim, 1);
    vic.state = 'held';
    vic.sf = 0;
    vic.heldBy = this;
    vic.move = null;
    vic.moveId = null;
    vic.vx = vic.vy = 0;
    vic.hitstun = 0;
    vic.blendFrom = vic.pose;
    vic.blendT = vic.blendDur = 2;
    if (seq.onStart) seq.onStart(this, vic);
    this.applySeqFrame();
  }

  stSeq() {
    this.seqF++;
    const s = this.seq, v = this.seqVic;
    if (s.tech && this.seqF <= 8 && v.throwPressedSince(this.seqStart - 4)) {
      Combat.tech(this, v);
      return;
    }
    this.applySeqFrame();
    if (this.state === 'seq' && this.seqF >= s.len) this.endSeq();
  }

  applySeqFrame() {
    const s = this.seq, v = this.seqVic, f = this.seqF;
    // attacker's own motion
    if (s.self) {
      const o = Fighter.sampleOffsets(s.self, f);
      this.x = this.seqX + o[0] * this.seqFacing;
      this.y = Math.max(0, this.seqY + o[1]);
    }
    // victim placement + pose
    const k = Fighter.sampleVic(v.C, s.vic, f);
    v.x = this.x + this.seqFacing * k.dx;
    v.y = Math.max(0, this.y + k.dy);
    v.facing = s.vicSame ? this.seqFacing : -this.seqFacing;
    v.seqPose = k.pose;
    v.seqAir = v.y > 0 || k.air;
    if (s.hits && s.hits[f]) Combat.seqHit(this, v, s.hits[f]);
    if (s.ev && s.ev[f]) s.ev[f](this, v);
  }

  static sampleOffsets(list, f) {
    if (f <= list[0][0]) return [list[0][1], list[0][2]];
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      if (f < b[0]) {
        const t = U.ease[b[3] || 'inout']((f - a[0]) / (b[0] - a[0]));
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      }
    }
    const l = list[list.length - 1];
    return [l[1], l[2]];
  }

  // victim keyframes: [frame, poseName, dx, dy, r, ease]
  static sampleVic(VC, list, f) {
    const pose = (n, r) => {
      const p = Anim.pose(VC, n);
      if (!r) return p;
      const o = Object.assign({}, p);
      o.r = (p.r || 0) + r;
      return o;
    };
    if (f <= list[0][0]) return { pose: pose(list[0][1], list[0][4]), dx: list[0][2], dy: list[0][3] };
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      if (f < b[0]) {
        const t = U.ease[b[5] || 'inout']((f - a[0]) / (b[0] - a[0]));
        const pa = pose(a[1], a[4]), pb = pose(b[1], b[4]);
        return { pose: Rig.lerp(VC, pa, pb, t), dx: a[2] + (b[2] - a[2]) * t, dy: a[3] + (b[3] - a[3]) * t };
      }
    }
    const l = list[list.length - 1];
    return { pose: pose(l[1], l[4]), dx: l[2], dy: l[3] };
  }

  endSeq() {
    const s = this.seq, v = this.seqVic;
    const rel = s.release || { vx: 6, vy: 8 };
    this.seq = null;
    this.seqVic = null;
    v.heldBy = null;
    v.seqPose = null;
    if (v.state === 'held') {
      v.state = 'airhit';
      v.sf = 0;
      v.kd = rel.kd !== false;
      v.vx = this.seqFacing * rel.vx;
      v.vy = rel.vy;
      v.y = Math.max(v.y, 0.5);
      v.hitstun = 40;
      v.bounced = false;
      v.juggle = Math.max(v.juggle, rel.juggle || 4);
      v.spinR = rel.spin || 0;
      v.setAnim({ proc: 'airhit', air: true }, 2);
    }
    if (s.onEnd) s.onEnd(this, v);
    if (this.y > 0) {
      this.state = 'air';
      this.sf = 0;
      this.airF = 60;
      this.airAttacks = 1;
      this.flipJump = 0;
      this.setAnim(this.C.anims.air || { proc: 'air', air: true }, 3);
    } else {
      this.state = 'recover';
      this.sf = 0;
      this.recoverF = s.recover || 14;
      this.setAnim(s.recoverAnim || { keys: [[0, s.endPose || 'stance'], [this.recoverF, 'stance']] }, 3);
    }
  }

  // ---- reactions (called by Combat) ---------------------------------------
  takeHit(att, h, info) {
    if (this.state === 'attack' && this.move && this.move.onInterrupt) this.move.onInterrupt(this);
    if (this.state === 'seq' && this.seqVic) {
      const v = this.seqVic;
      this.seq = null;
      this.seqVic = null;
      v.heldBy = null;
      v.seqPose = null;
      v.toNeutral(false);
    }
    this.move = null;
    this.moveId = null;
    this.hp -= info.dmg;
    this.redDelay = 40;
    this.flash = 3;
    this.flashColor = '#ffffff';
    this.trail = 0;
    let kd = !!(h.kd);
    if (this.hp <= 0) {
      this.hp = 0;
      if (this.battle.training) this.hp = 1;
      else {
        this.isKO = true;
        kd = true;
      }
    }
    const dir = info.dir;
    const airborne = this.y > 0 || this.state === 'airhit' || this.state === 'air' || this.state === 'bdash';
    if (!airborne && !h.launch && !kd) {
      const wasCrouch = this.state === 'crouch' || this.state === 'cguard' || (this.down && this.state in NEUTRAL_STATES);
      this.state = 'hit';
      this.sf = 0;
      this.hitstun = info.hs;
      this.vx = dir * h.kb[0];
      const neckY = this.J.neck[1] - this.y;
      const highHit = info.point && info.point[1] < neckY + 8;
      let pose = wasCrouch ? 'churt' : highHit || h.level === 'high' ? 'hurt' : 'hurt2';
      if (h.hurtPose) pose = h.hurtPose;
      const hold = Math.max(2, info.hs - 7);
      this.setAnim({ keys: [[0, Anim.pose(this.C, pose)], [hold, Anim.pose(this.C, pose)], [info.hs + 2, Anim.pose(this.C, wasCrouch ? 'crouch' : 'stance')]] }, 1);
      this.crouchHit = wasCrouch;
    } else {
      const wasAir = this.y > 0;
      this.state = 'airhit';
      this.sf = 0;
      this.hitstun = info.hs;
      this.kd = kd || (this.kd && wasAir);
      const kbx = h.kb[0], kby = h.kb[1] || 0;
      const decay = Math.max(0.45, 1 - 0.07 * this.juggle);
      this.vx = dir * (kbx * (wasAir ? 0.75 : 0.85) + 0.5);
      this.vy = (kby > 0 ? kby : wasAir ? 5.5 : 7) * (wasAir ? decay : 1);
      if (this.isKO) {
        this.vy = Math.max(this.vy, 10);
        this.vx = dir * Math.max(Math.abs(this.vx), 6);
      }
      if (this.y <= 0) this.y = 0.5;
      this.juggle++;
      this.bounced = false;
      this.spinR = h.spin || 0;
      this.setAnim({ proc: 'airhit', air: true }, 1);
    }
  }

  takeBlock(att, h, info) {
    if (this.state !== 'block') {
      this.state = 'block';
      this.sf = 0;
    }
    this.blockstun = h.bs;
    this.vx = info.dir * h.kb[0] * 1.15;
    if (h.chip) {
      this.hp = Math.max(1, this.hp - h.chip);
      this.redDelay = 30;
    }
    const want = this.down ? 'cguard' : 'guard';
    this.setAnim(want, 1);
    this.flash = 2;
    this.flashColor = '#bfe6ff';
  }

  addMeter(v) {
    if (this.battle.training && this.battle.trainingOpts && this.battle.trainingOpts.meter) {
      this.meter = 100;
      return;
    }
    const before = this.meter;
    this.meter = U.clamp(this.meter + v, 0, 100);
    if (before < 100 && this.meter >= 100) {
      Sound.sfx('meterFull');
      this.battle.meterFlash[this.side] = 40;
    }
  }

  // ---- physics -------------------------------------------------------------
  physics() {
    if (this.state === 'held') return;
    if (this.state === 'seq' && this.seq && this.seq.self) return;
    const airborne = this.y > 0 || this.vy > 0;
    if (airborne) {
      let g = this.S.grav;
      if (this.state === 'attack' && this.move) {
        const m = this.move;
        if (m.grav !== undefined && (!m.gravAt || (this.mf >= m.gravAt[0] && this.mf <= m.gravAt[1]))) g = m.grav;
      }
      if (this.state === 'airhit') g = this.S.grav * (1.05 + this.juggle * 0.05) * (this.S.hitGrav || 1);
      if (this.state === 'bdash') g = this.S.grav * 1.15;
      this.vy -= g;
      const maxFall = this.S.maxFall || 22;
      if (this.vy < -maxFall) this.vy = -maxFall;
      this.x += this.vx;
      this.y += this.vy;
      if (this.y <= 0) {
        const vyLand = this.vy;
        this.y = 0;
        this.vy = 0;
        this.onLand(vyLand);
      }
    } else {
      this.x += this.vx;
      if (this.state === 'hit' || this.state === 'block' || this.state === 'tech' || this.state === 'recover' || this.state === 'land') {
        this.vx *= 0.86;
        if (Math.abs(this.vx) < 0.05) this.vx = 0;
      }
    }
  }

  onLand(vy) {
    switch (this.state) {
      case 'air':
      case 'bdash': {
        this.landLag = this.state === 'bdash' ? (this.S.bdash.lag || 6) : this.S.landLag !== undefined ? this.S.landLag : 3;
        this.state = 'land';
        this.sf = 0;
        this.vx = 0;
        this.setAnim('land', 1);
        Sound.sfx('land', { vol: 0.6 });
        FX.dust(this.x, 0, 3, 0);
        this.faceOpp();
        break;
      }
      case 'dash':
        break;
      case 'attack': {
        const m = this.move;
        if (m.air || m.landEnd) {
          const lag = m.landLag !== undefined ? m.landLag : 4;
          if (m.onLand) m.onLand(this);
          if (this.state !== 'attack') break;
          this.move = null;
          this.moveId = null;
          this.state = 'land';
          this.sf = 0;
          this.landLag = lag;
          this.vx = 0;
          this.setAnim('land', 1);
          FX.dust(this.x, 0, 4, 0);
          Sound.sfx('land', { vol: 0.6 });
          this.faceOpp();
        } else if (m.onLand) m.onLand(this);
        break;
      }
      case 'airhit': {
        if (this.kd || this.isKO) {
          if (!this.bounced && vy < -7) {
            this.bounced = true;
            this.vy = Math.min(6.5, -vy * 0.38);
            this.y = 0.5;
            this.vx *= 0.55;
            FX.dust(this.x, 0, 8, 0, 1.4);
            Sound.sfx('thud');
            this.battle.shake(4);
          } else {
            this.state = this.isKO ? 'ko' : 'down';
            this.sf = 0;
            this.vx = 0;
            this.setAnim(this.isKO ? 'ko' : 'down', 3);
            FX.dust(this.x, 0, 6, 0, 1.2);
            Sound.sfx('thud', { vol: 0.7 });
            if (this.isKO) this.battle.onKOLanded(this);
          }
        } else {
          // landed while still in hitstun: finish it standing
          this.state = 'hit';
          this.sf = 0;
          this.hitstun = Math.max(4, Math.min(this.hitstun, 12));
          this.vx *= 0.5;
          this.setAnim({ keys: [[0, Anim.pose(this.C, 'hurt2')], [this.hitstun, Anim.pose(this.C, 'stance')]] }, 2);
        }
        break;
      }
      case 'seq':
        break;
      default:
        break;
    }
  }

  faceOpp() {
    const o = this.opp;
    if (Math.abs(o.x - this.x) < 2) return;
    this.facing = o.x > this.x ? 1 : -1;
  }

  // push box
  pushH() {
    if (this.state === 'crouch' || this.state === 'cguard' || this.crouching) return this.S.height * 0.62;
    if (this.state === 'down' || this.state === 'ko') return 40;
    return this.S.height * (this.y > 0 ? 0.75 : 0.95);
  }
  get crouching() {
    return (this.state === 'hit' && this.crouchHit) || (this.state === 'block' && this.down) || (this.state === 'attack' && this.move && this.move.id[0] === '2');
  }

  // Hurt capsules in world space [x1,y1,x2,y2,r] with y measured downward from the floor
  hurtWorld() {
    if (this.inv > 0 || this.state in NO_HURT_STATES) return [];
    const caps = Rig.hurtCapsules(this.C, this.J);
    const out = [];
    for (const c of caps) {
      out.push([this.x + c[0] * this.facing, c[1] - this.y, this.x + c[2] * this.facing, c[3] - this.y, c[4]]);
    }
    return out;
  }

  // world position of a local joint
  jointWorld(name) {
    const p = this.J[name];
    return [this.x + p[0] * this.facing, p[1] - this.y];
  }
}
