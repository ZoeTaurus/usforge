'use strict';
// ---------------------------------------------------------------------------
// Battle: owns both fighters, projectiles, camera, round flow and rendering.
// ---------------------------------------------------------------------------


class Battle {
  constructor(o) {
    this.o = o;
    this.W = STAGE_W;
    this.frame = 0;
    this.training = !!o.training;
    this.trainingOpts = o.trainingOpts || null;
    this.stage = STAGES[o.stage] || STAGES[STAGE_ORDER[0]];
    this.fighters = [];
    this.fighters.push(new Fighter(this, 0, o.p1.char, o.p1.pal, o.p1.ctrl));
    this.fighters.push(new Fighter(this, 1, o.p2.char, o.p2.pal, o.p2.ctrl));
    [o.p1, o.p2].forEach((p, i) => {
      const f = this.fighters[i];
      if (p.hpMult) f.maxHp = Math.round(f.maxHp * p.hpMult);
      if (p.palette) f.pal = p.palette;
      if (p.name) f.nameOverride = p.name;
    });
    this.projs = [];
    this.cam = { x: STAGE_W / 2, y: 0, shake: 0, sx: 0, sy: 0, zoom: 1, tzoom: 1 };
    this.round = 0;
    this.roundsToWin = o.roundsToWin || 2;
    this.timeLimit = o.time === undefined ? 99 : o.time;
    this.freeze = 0;
    this.slow = 0;
    this.meterFlash = [0, 0];
    this.comboDisplay = [null, null];
    this.banner = null;
    this.superInfo = null;
    this.over = false;
    this.winner = null;
    this.flashScreen = 0;
    this.shakeOn = o.shake !== false;
    this.draws = 0;
    FX.clear();
    this.startRound();
  }

  get finalRound() {
    return this.fighters[0].wins === this.roundsToWin - 1 && this.fighters[1].wins === this.roundsToWin - 1;
  }

  startRound() {
    this.round++;
    const [a, b] = this.fighters;
    a.resetRound(STAGE_W / 2 - 190, 1);
    b.resetRound(STAGE_W / 2 + 190, -1);
    this.projs = [];
    FX.clear();
    this.cam.x = STAGE_W / 2;
    this.cam.y = 0;
    this.timer = this.timeLimit * 60;
    this.koVictim = null;
    this.koLanded = false;
    this.roundWinner = null;
    this.comboDisplay = [null, null];
    this.pf = 0;
    for (const f of this.fighters) f.inputEnabled = false;
    if (this.training) {
      this.phase = 'fight';
      for (const f of this.fighters) f.inputEnabled = true;
      return;
    }
    if (this.round === 1) {
      this.phase = 'intro';
      for (const f of this.fighters) {
        f.state = 'intro';
        f.setAnim('intro', 0);
      }
    } else this.phase = 'ready';
  }

  // ---- main update ----------------------------------------------------------
  update() {
    this.frame++;
    for (const f of this.fighters) f.readInput();
    this.decay();
    if (this.freeze > 0) {
      this.freeze--;
      if (this.superInfo) this.superInfo.t++;
      if (this.freeze === 0) this.superInfo = null;
      FX.update();
      this.updateCam();
      return;
    }
    if (this.slow > 0) {
      this.slow--;
      if (this.slow % 2 === 1) {
        this.updateCam();
        return;
      }
    }
    this.phaseUpdate();
    const [a, b] = this.fighters;
    a.fxTick();
    b.fxTick();
    a.update();
    b.update();
    this.resolvePush();
    this.clampFighters();
    this.autoFace();
    a.computePose();
    b.computePose();
    for (const p of this.projs) p.update();
    Combat.step(this);
    FX.update();
    if (this.stage.update) this.stage.update(this);
    this.updateCam();
    if (this.training) this.trainingUpdate();
  }

  phaseUpdate() {
    this.pf++;
    switch (this.phase) {
      case 'intro':
        if (this.pf === 1) Sound.sfx('whoosh');
        if (this.pf >= 96) {
          this.phase = 'ready';
          this.pf = 0;
          for (const f of this.fighters) f.toNeutral(false);
        }
        break;
      case 'ready': {
        if (this.pf === 1) {
          const label = this.finalRound ? 'FINAL ROUND' : 'ROUND ' + this.round;
          this.showBanner(label, 'round', 70);
          Sound.sfx('round');
        }
        if (this.pf === 72) {
          this.showBanner('FIGHT!', 'fight', 46);
          Sound.sfx('fight');
        }
        if (this.pf >= 80) {
          this.phase = 'fight';
          this.pf = 0;
          for (const f of this.fighters) f.inputEnabled = true;
        }
        break;
      }
      case 'fight':
        if (this.timeLimit > 0 && !this.training) {
          this.timer--;
          if (this.timer <= 0) {
            this.timer = 0;
            this.timeUp();
          } else if (this.timer <= 600 && this.timer % 60 === 0) Sound.sfx('tick', { vol: 0.5 });
        }
        break;
      case 'ko': {
        for (const f of this.fighters) f.inputEnabled = false;
        const ready = (this.koLanded || this.pf > 150) && this.allSettled();
        if (ready && this.roundWinner === null) this.decideKO();
        if (this.roundWinner !== null && this.pf >= this.winAt) this.endRound();
        break;
      }
      case 'timeup':
        for (const f of this.fighters) f.inputEnabled = false;
        if (this.pf === 70) this.decideTime();
        if (this.pf >= 190) this.endRound();
        break;
      case 'over':
        if (this.pf === 150) {
          this.over = true;
        }
        break;
    }
  }

  allSettled() {
    for (const f of this.fighters) {
      if (f.isKO) continue;
      if (!(f.state in NEUTRAL_STATES) && f.state !== 'win') {
        if (f.state === 'attack' || f.state === 'air' || f.state === 'land' || f.state === 'seq' || f.state === 'recover' || f.state === 'dash') {
          // let them finish
          if (f.y <= 0 && (f.state === 'attack' || f.state === 'recover' || f.state === 'land' || f.state === 'dash') && f.sf > 60) {
            f.toNeutral(false);
          }
          return false;
        }
        if (f.state === 'hit' || f.state === 'block' || f.state === 'airhit' || f.state === 'down' || f.state === 'getup' || f.state === 'tech') return false;
      }
    }
    return true;
  }

  decideKO() {
    const [a, b] = this.fighters;
    this.winAt = this.pf + 120;
    if (a.isKO && b.isKO) {
      this.roundWinner = -1;
      this.showBanner('DOUBLE K.O.', 'ko', 100);
      return;
    }
    const w = a.isKO ? b : a;
    this.roundWinner = w.side;
    w.state = 'win';
    w.sf = 0;
    w.vx = 0;
    w.setAnim('win', 6);
    if (w.hp >= w.maxHp) {
      this.showBanner('PERFECT!', 'perfect', 100);
      Sound.sfx('perfect');
    }
  }

  timeUp() {
    this.phase = 'timeup';
    this.pf = 0;
    this.showBanner('TIME!', 'ko', 70);
    Sound.sfx('ko');
    for (const f of this.fighters) f.inputEnabled = false;
  }

  decideTime() {
    const [a, b] = this.fighters;
    const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
    if (Math.abs(ra - rb) < 0.0005) {
      this.roundWinner = -1;
      this.showBanner('DRAW', 'ko', 100);
      return;
    }
    const w = ra > rb ? a : b, l = w === a ? b : a;
    this.roundWinner = w.side;
    if (w.y <= 0) {
      w.state = 'win';
      w.sf = 0;
      w.vx = 0;
      w.setAnim('win', 6);
    }
    if (l.y <= 0 && !(l.state in { down: 1, getup: 1 })) {
      l.state = 'lose';
      l.sf = 0;
      l.vx = 0;
      l.setAnim('lose', 8);
    }
  }

  endRound() {
    const [a, b] = this.fighters;
    if (this.roundWinner === -1) {
      this.draws++;
      // a draw gives each side a point unless that would end in a tie
      if (!(a.wins === this.roundsToWin - 1 && b.wins === this.roundsToWin - 1)) {
        a.wins++;
        b.wins++;
        if (a.wins >= this.roundsToWin && b.wins >= this.roundsToWin) {
          a.wins = b.wins = this.roundsToWin - 1;
        }
      }
    } else if (this.roundWinner !== null) this.fighters[this.roundWinner].wins++;
    if (a.wins >= this.roundsToWin || b.wins >= this.roundsToWin || this.round >= 9) {
      this.phase = 'over';
      this.pf = 0;
      let w = a.wins > b.wins ? a : b.wins > a.wins ? b : null;
      if (!w) w = a.hp >= b.hp ? a : b;
      this.winner = w;
      return;
    }
    this.startRound();
  }

  onKO(vic, att) {
    if (this.phase !== 'fight') return;
    this.phase = 'ko';
    this.pf = 0;
    this.koVictim = vic;
    this.slow = 70;
    this.flashScreen = 10;
    this.shake(16);
    Sound.sfx('ko');
    this.showBanner('K.O.!', 'ko', 110);
    this.koBy = att;
  }
  onKOLanded() {
    this.koLanded = true;
  }

  onComboHit(att, vic) {
    const c = vic.combo;
    if (!c) return;
    const prev = this.comboDisplay[att.side];
    this.comboDisplay[att.side] = { hits: c.hits, dmg: c.dmg, t: 100, pop: prev && prev.hits !== c.hits ? 10 : 10 };
    if (c.hits > att.stats.maxCombo) att.stats.maxCombo = c.hits;
  }
  onComboEnd(vic) {
    const d = this.comboDisplay[1 - vic.side];
    if (d) d.t = Math.min(d.t, 70);
  }

  superFlash(f, m) {
    this.freeze = 50;
    this.superInfo = { f, name: m.name || 'SUPER', t: 0 };
    Sound.sfx('super');
    this.shake(5);
    FX.ring(f.x, -f.y - 100, 160, f.C.color || '#ffd23f', 24);
    f.trail = 30;
  }

  showBanner(text, kind, life) {
    this.banner = { text, kind, life, t: 0 };
  }

  shake(n) {
    if (!this.shakeOn) return;
    this.cam.shake = Math.max(this.cam.shake, n);
  }

  spawn(owner, o) {
    if (o.hit) normHit(o.hit, 'S', o.super ? 'super' : 'special', false);
    const p = new Projectile(this, owner, o);
    this.projs.push(p);
    return p;
  }

  decay() {
    for (let i = 0; i < 2; i++) {
      if (this.meterFlash[i] > 0) this.meterFlash[i]--;
      const d = this.comboDisplay[i];
      if (d) {
        d.t--;
        if (d.pop > 0) d.pop--;
        if (d.t <= 0) this.comboDisplay[i] = null;
      }
    }
    for (const f of this.fighters) {
      if (f.redDelay > 0) f.redDelay--;
      else if (f.redHp > f.hp) f.redHp = Math.max(f.hp, f.redHp - f.maxHp * 0.008);
      if (f.redHp < f.hp) f.redHp = f.hp;
    }
    if (this.banner) {
      this.banner.t++;
      if (this.banner.t >= this.banner.life) this.banner = null;
    }
    if (this.flashScreen > 0) this.flashScreen--;
  }

  trainingUpdate() {
    for (const f of this.fighters) {
      if (f.state in NEUTRAL_STATES && f.idleT > 50 && f.hp < f.maxHp) {
        f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.02);
      }
      if (this.trainingOpts && this.trainingOpts.meter) f.meter = 100;
    }
  }

  // ---- positioning ---------------------------------------------------------
  resolvePush() {
    const [a, b] = this.fighters;
    if (a.state === 'held' || b.state === 'held') return;
    if (a.state === 'ko' || b.state === 'ko') return;
    if (this.passesThrough(a) || this.passesThrough(b)) return;
    const wa = a.S.width / 2, wb = b.S.width / 2;
    const ha = a.pushH(), hb = b.pushH();
    if (a.y >= b.y + hb || b.y >= a.y + ha) return;
    const dx = b.x - a.x;
    const overlap = wa + wb - Math.abs(dx);
    if (overlap <= 0) return;
    let dir = Math.abs(dx) > 0.5 ? Math.sign(dx) : a.facing;
    // airborne fighter landing on top gets pushed in its travel direction
    if (Math.abs(dx) < 8 && a.y > 0 && b.y <= 0 && a.vx !== 0) dir = -Math.sign(a.vx);
    if (Math.abs(dx) < 8 && b.y > 0 && a.y <= 0 && b.vx !== 0) dir = Math.sign(b.vx);
    let pa = overlap / 2, pb = overlap / 2;
    // the side pinned at a wall doesn't move
    const aWall = (dir > 0 && a.x - pa <= WALL) || (dir < 0 && a.x + pa >= STAGE_W - WALL);
    const bWall = (dir > 0 && b.x + pb >= STAGE_W - WALL) || (dir < 0 && b.x - pb <= WALL);
    if (aWall) {
      pa = 0;
      pb = overlap;
    } else if (bWall) {
      pb = 0;
      pa = overlap;
    }
    a.x -= dir * pa;
    b.x += dir * pb;
  }

  // moves with a noPush window (dash-through slashes) ignore body collision
  passesThrough(f) {
    const m = f.state === 'attack' && f.move;
    return !!(m && m.noPush && f.mf >= m.noPush[0] && f.mf <= m.noPush[1]);
  }

  clampFighters() {
    const [a, b] = this.fighters;
    const sep = Math.abs(a.x - b.x);
    if (sep > MAX_SEP && a.state !== 'held' && b.state !== 'held') {
      const excess = sep - MAX_SEP;
      const left = a.x < b.x ? a : b, right = left === a ? b : a;
      const lAway = left.vx < 0, rAway = right.vx > 0;
      if (lAway && !rAway) left.x += excess;
      else if (rAway && !lAway) right.x -= excess;
      else {
        left.x += excess / 2;
        right.x -= excess / 2;
      }
    }
    for (const f of this.fighters) f.x = U.clamp(f.x, WALL, STAGE_W - WALL);
  }

  atWall(f, dir) {
    const o = f.opp;
    if (dir > 0) return f.x >= STAGE_W - WALL - 2 || (f.x > o.x && f.x - o.x >= MAX_SEP - 2);
    return f.x <= WALL + 2 || (f.x < o.x && o.x - f.x >= MAX_SEP - 2);
  }

  autoFace() {
    for (const f of this.fighters) {
      if (f.state in NEUTRAL_STATES && f.y <= 0) f.faceOpp();
    }
  }

  updateCam() {
    const [a, b] = this.fighters;
    const mid = (a.x + b.x) / 2;
    const tx = U.clamp(mid, VIEW_W / 2, STAGE_W - VIEW_W / 2);
    this.cam.x += (tx - this.cam.x) * 0.22;
    const top = Math.max(a.y, b.y);
    const ty = Math.max(0, top - 190) * 0.55;
    this.cam.y += (ty - this.cam.y) * 0.12;
    if (this.cam.shake > 0.4) {
      this.cam.sx = (Math.random() * 2 - 1) * this.cam.shake;
      this.cam.sy = (Math.random() * 2 - 1) * this.cam.shake;
      this.cam.shake *= 0.86;
    } else {
      this.cam.sx = this.cam.sy = 0;
      this.cam.shake = 0;
    }
    this.cam.tzoom = this.freeze > 0 ? 1.06 : this.phase === 'ko' && this.slow > 0 ? 1.05 : 1;
    this.cam.zoom += (this.cam.tzoom - this.cam.zoom) * 0.12;
  }

  // ---- rendering -------------------------------------------------------------
  render(ctx) {
    const cam = this.cam;
    ctx.save();
    ctx.translate(cam.sx, cam.sy);
    ctx.translate(640, GROUND_Y);
    ctx.scale(WORLD_ZOOM, WORLD_ZOOM);
    ctx.translate(-640, -GROUND_Y);
    if (Math.abs(cam.zoom - 1) > 0.001) {
      const fx = this.superInfo ? this.superInfo.f : null;
      const zx = fx ? U.clamp(640 + (fx.x - cam.x), 300, 980) : 640;
      ctx.translate(zx, 420);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-zx, -420);
    }
    this.stage.draw(ctx, cam, this.frame, this);
    const ox = 640 - cam.x, oy = GROUND_Y + cam.y;
    // a light wash over the backdrop keeps the flat fighters in front of it
    if (this.stage.haze) {
      ctx.fillStyle = this.stage.haze;
      ctx.fillRect(-200, -400, 1680, oy + 400 - 2);
    }
    if (this.freeze > 0) {
      ctx.fillStyle = 'rgba(16,8,36,0.6)';
      ctx.fillRect(-200, -200, 1680, 1120);
    }
    for (const f of this.fighters) if (!f.hidden) this.drawShadow(ctx, f, ox, oy);
    FX.draw(ctx, ox, oy, -1);
    for (const p of this.projs) if (p.back && p.draw) this.drawProj(ctx, p, ox, oy);
    const order = this.fighters.slice().sort((p, q) => this.prio(p) - this.prio(q));
    for (const f of order) this.drawFighter(ctx, f, ox, oy);
    for (const p of this.projs) if (!p.back && p.draw) this.drawProj(ctx, p, ox, oy);
    FX.draw(ctx, ox, oy, 0);
    if (this.stage.drawFront) this.stage.drawFront(ctx, cam, this.frame, this);
    FX.draw(ctx, ox, oy, 1);
    if (Game.debugBoxes) this.drawBoxes(ctx, ox, oy);
    ctx.restore();
    if (this.flashScreen > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashScreen / 12})`;
      ctx.fillRect(0, 0, 1280, 720);
    }
    HUD.draw(ctx, this);
  }

  // projectiles get the fighters' inked look too
  drawProj(ctx, p, ox, oy) {
    const o = p.owner;
    Sketch.begin(ctx, o && o.pal, 9, o ? o.facing : 1);
    try {
      p.draw(ctx, ox + p.x, oy - p.y, p);
    } finally {
      Sketch.end(ctx);
    }
  }

  prio(f) {
    if (f.state === 'seq' || f.state === 'attack') return 2;
    if (f.state === 'held') return 0;
    return 1 + f.side * 0.1;
  }

  drawShadow(ctx, f, ox, oy) {
    const h = Math.max(0, f.y);
    const s = U.clamp(1 - h / 500, 0.35, 1);
    ctx.save();
    ctx.globalAlpha = 0.34 * s;
    ctx.fillStyle = '#1a0f2e';
    ctx.beginPath();
    ctx.ellipse(ox + f.x, oy + 2, f.S.width * 0.9 * s + 12, 10 * s + 2, 0, 0, TAU);
    ctx.fill();
    // a darker core right under the feet
    ctx.globalAlpha = 0.22 * s * s;
    ctx.beginPath();
    ctx.ellipse(ox + f.x, oy + 2, f.S.width * 0.55 * s + 6, 6 * s + 1, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawFighter(ctx, f, ox, oy) {
    if (f.hidden) {
      if (f.C.drawWorld) f.C.drawWorld(ctx, f, ox, oy);
      return;
    }
    for (const a of f.afterimages) {
      ctx.save();
      ctx.globalAlpha = 0.4 * (a.life / a.max);
      ctx.translate(ox + a.x, oy - a.y);
      ctx.scale(a.facing, 1);
      Rig.drawCharacter(ctx, f, a.J, Rig.tinted(f.pal, f.trailColor || f.C.trailColor || '#8fd3ff', 0.75, true));
      ctx.restore();
    }
    ctx.save();
    ctx.translate(ox + f.x, oy - f.y);
    ctx.scale(f.facing, 1);
    let pal = f.pal;
    if (f.flash > 0) pal = Rig.tinted(f.pal, f.flashColor, f.flashColor === '#ffffff' ? 0.8 : 0.35, f.flashColor === '#ffffff');
    else if (f.armorFlash > 0) pal = Rig.tinted(f.pal, '#ff5a3c', 0.25 + 0.25 * (f.armorFlash % 4 < 2 ? 1 : 0));
    if (this.freeze > 0 && this.superInfo && this.superInfo.f === f) {
      ctx.shadowColor = f.C.color || '#ffd23f';
      ctx.shadowBlur = 30;
    }
    Rig.drawCharacter(ctx, f, f.J, pal);
    ctx.restore();
    if (f.C.drawWorld) f.C.drawWorld(ctx, f, ox, oy);
  }

  drawBoxes(ctx, ox, oy) {
    ctx.save();
    ctx.lineWidth = 2;
    for (const f of this.fighters) {
      ctx.strokeStyle = 'rgba(80,255,120,0.9)';
      for (const c of f.hurtWorld()) this.capStroke(ctx, c, ox, oy);
      if (f.state === 'attack' && f.move) {
        ctx.strokeStyle = 'rgba(255,60,60,0.95)';
        for (const h of f.move.hits) {
          if (f.mf >= h.at[0] && f.mf <= h.at[1]) this.capStroke(ctx, Combat.hitCap(f, h), ox, oy);
        }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(ox + f.x - f.S.width / 2, oy - f.y - f.pushH(), f.S.width, f.pushH());
    }
    ctx.strokeStyle = 'rgba(255,200,40,0.95)';
    for (const p of this.projs) if (p.hit) this.capStroke(ctx, p.cap(), ox, oy);
    ctx.restore();
  }
  capStroke(ctx, c, ox, oy) {
    ctx.beginPath();
    Draw.taper(ctx, ox + c[0], oy + c[1], c[4], ox + c[2], oy + c[3], c[4]);
    ctx.stroke();
  }
}
