'use strict';
const FLIP_RATE = 11.5, SPIN_RATE = 12.5;

const Player = {
  reset() {
    Object.assign(this, {
      x: 0, z: 0, speed: 0, air: 0, vy: 0, flip: 0, spin: 0, airTime: 0, grabTime: 0, grab: false,
      crash: 0, tumble: 0, invuln: 0, lean: 0, boost: 0, deep: false, launchKind: '', maxAir: 0, squash: 0,
      pw: { shield: 0, magnet: 0, rocket: 0, double: 0, giant: 0, wings: 0 }, grind: null, grindT: 0, icy: 0, nado: 0, giantK: 0, jumpZ: 0, mud: 0, spooked: 0,
    });
    const d = Save.data;
    this.sled = sledById(d.sled);
    this.look = outfitById(d.outfit);
    this.pet = petById(d.pet || 'none');
    this.petAir = 0; this.petSide = 1;
  },

  get airborne() { return this.air > 0 || this.vy > 0; },
  get unstoppable() { return this.pw.rocket > 0; },

  launch(vy, kind) {
    if (!this.airborne) { this.airTime = 0; this.grabTime = 0; this.maxAir = 0; }
    this.vy = Math.max(this.vy, vy);
    this.air = Math.max(this.air, 1);
    this.launchKind = kind;
    this.squash = -0.25;
    if (kind !== 'bump') Sfx.jump(kind);
  },

  // `controls` is true for the keyboard/touch, or an input object from the AI pilot.
  update(dt, G, controls) {
    const inp = controls === true ? Input.down : controls || {};
    const jumpPressed = controls === true ? Input.pressed.jump : inp.jumpPressed;
    const maxBase = G.maxSpeed;
    let target = maxBase;
    const seg = G.track.get(Math.floor(this.z / CFG.SEG_LEN));
    for (const k in this.pw) if (this.pw[k] > 0 && k !== 'shield') this.pw[k] = Math.max(0, this.pw[k] - dt);
    if (this.pw.shield > 0) this.pw.shield = Math.max(0, this.pw.shield - dt);
    this.squash = U.approach(this.squash, 0, dt * 2.5);
    this.giantK = U.approach(this.giantK, this.pw.giant > 0 ? 0.6 : 0, dt * 2); // 1.6× size
    // The pet hops after you a beat late and keeps to the roomier side.
    this.petAir += (this.air * 0.8 - this.petAir) * Math.min(1, dt * 6);
    this.petSide = U.approach(this.petSide, this.x > 0.8 ? -1 : this.x < -0.8 ? 1 : this.petSide, dt * 4);

    if (this.crash > 0) {
      this.crash -= dt;
      this.tumble += dt;
      this.speed = U.approach(this.speed, maxBase * 0.18, maxBase * 0.5 * dt);
      this.airPhysics(dt, G);
      if (this.crash <= 0) { this.invuln = 1.6; this.flip = 0; this.spin = 0; this.air = 0; this.vy = 0; }
      return;
    }

    if (this.grind) {
      // Locked onto a rail: slide along it until the end or a hop.
      const r = this.grind;
      this.x += (r.x - this.x) * Math.min(1, dt * 14);
      this.air = r.h; this.vy = 0;
      this.lean = Math.sin(G.time * 22) * 0.12;
      this.grindT += dt;
      if (jumpPressed || r.dead || this.z > r.z + r.len) G.endGrind(!!jumpPressed);
    } else if (!this.airborne) {
      let steer = controls ? (inp.right ? 1 : 0) - (inp.left ? 1 : 0) : 0;
      if (this.spooked > 0) steer = -steer; // ghosts flip your steering
      // On ice you barely steer and slowly slide.
      this.x += steer * (1.1 + this.speed / 6500) * dt * (this.icy > 0 ? 0.3 : 1);
      if (this.icy > 0) this.x += Math.sin(G.time * 2.3) * 0.18 * dt;
      this.lean = U.approach(this.lean, steer, dt * 6);
      if (controls) {
        if (inp.up) target *= 1.12;
        if (inp.down) target *= 0.5;
        if (jumpPressed) this.launch(900 + this.speed * 0.1, 'hop');
      }
      this.x -= seg.curve * (this.speed / 10000) * dt * 0.28;
    } else {
      this.lean = U.approach(this.lean, 0, dt * 4);
      if (this.nado > 0) { this.nado -= dt; this.spin += 16 * dt; } // the snownado spins you
      else if (controls) this.tricks(dt, inp);
      this.airPhysics(dt, G);
    }

    this.x = U.clamp(this.x, -1.35, 1.35);
    this.deep = Math.abs(this.x) > 1.02 && !this.airborne;
    if (this.deep) target *= 0.5;
    target *= U.clamp(1 + (-G.track.grade(this.z) - 0.14) * 0.8, 0.8, 1.2);
    if (this.boost > 0) { this.boost -= dt; target = Math.max(target, maxBase * 1.45); }
    if (this.pw.rocket > 0) target = Math.max(target, maxBase * 1.85);
    if (G.fever > 0) target *= 1.15;
    if (this.icy > 0) { target *= 1.15; this.icy -= dt; }
    if (this.mud > 0) { target *= 0.55; this.mud -= dt; }
    if (this.spooked > 0) this.spooked -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    if (this.speed < target) {
      const acc = maxBase * 0.38 + (this.boost > 0 || this.pw.rocket > 0 ? maxBase * 1.6 : 0);
      this.speed = Math.min(target, this.speed + acc * dt);
    } else {
      const k = this.deep ? 2.5 : inp.down && controls ? 1.8 : 0.9;
      this.speed = Math.max(target, this.speed - (this.speed - target) * k * dt);
    }
  },

  tricks(dt, inp) {
    if (inp.up) this.flip -= FLIP_RATE * dt;
    else if (inp.down) this.flip += FLIP_RATE * dt;
    else this.flip = U.approach(this.flip, U.nearestTurn(this.flip), FLIP_RATE * 0.9 * dt);

    if (inp.right) this.spin += SPIN_RATE * dt;
    else if (inp.left) this.spin -= SPIN_RATE * dt;
    else this.spin = U.approach(this.spin, U.nearestTurn(this.spin), SPIN_RATE * 0.9 * dt);

    this.grab = !!inp.jump && this.airTime > 0.15;
    if (this.grab) this.grabTime += dt;
  },

  airPhysics(dt, G) {
    if (!this.airborne) return;
    this.vy -= CFG.GRAVITY * (this.pw.wings > 0 ? 0.45 : 1) * (G.mod === 'lowgrav' ? 0.6 : 1) * dt; // wings / low-gravity days
    this.air += this.vy * dt;
    this.airTime += dt;
    this.maxAir = Math.max(this.maxAir, this.air);
    if (this.air <= 0) {
      this.air = 0;
      if (this.crash > 0) {
        if (this.vy < -500) { this.vy = -this.vy * 0.35; this.air = 1; } else this.vy = 0;
        return;
      }
      this.vy = 0;
      this.land(G);
    }
  },

  land(G) {
    const fe = Math.abs(this.flip - U.nearestTurn(this.flip));
    const se = Math.abs(this.spin - U.nearestTurn(this.spin));
    const flips = Math.round(Math.abs(this.flip) / TAU);
    const spins = Math.round(Math.abs(this.spin) / TAU);
    const back = this.flip < 0;
    const airTime = this.airTime, grabT = this.grabTime;
    this.flip = 0; this.spin = 0; this.grab = false;
    this.squash = 0.35;
    if (fe > 0.95 || se > 1.1) {
      G.crash(fe > 0.95 ? 'Landed on your head' : 'Landed sideways');
      return;
    }
    Sfx.land();
    const perfect = (flips || spins) && fe < 0.18 && se < 0.22;
    G.landed(flips, spins, back, airTime, grabT, fe > 0.45 || se > 0.55, perfect);
  },

  // ---------------------------------------------------------------- drawing
  draw(c, gx, gy, k, G) {
    const sh = Math.max(0.2, 1 - this.air / 2600);
    c.fillStyle = 'rgba(20,30,70,0.25)';
    c.beginPath(); c.ellipse(gx, gy, 175 * k * sh, 36 * k * sh, 0, 0, TAU); c.fill();

    c.save();
    c.translate(gx, gy - this.air * k);
    c.scale(k * (1 + this.giantK), k * (1 + this.giantK));
    if (this.crash > 0 || G.state === 'caught') { this.drawCrash(c, G); c.restore(); return; }
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2) c.globalAlpha = 0.45;

    c.rotate(this.lean * 0.16 + (this.deep ? Math.sin(G.time * 30) * 0.03 : 0));
    const cf = Math.cos(this.flip), cs = Math.cos(this.spin);
    c.translate(0, -170);
    c.rotate(Math.sin(this.spin) * 0.25);
    c.scale(U.sign(cs) * Math.max(0.12, Math.abs(cs)) * (1 + this.squash * 0.5), U.sign(cf) * Math.max(0.12, Math.abs(cf)) * (1 - this.squash));
    c.translate(0, 170);
    const pose = this.grab ? 'grab' : this.airborne ? 'air' : 'ride';
    if (this.pw.wings > 0) {
      const flap = Math.sin(G.time * (this.airborne ? 9 : 4)) * 0.35;
      for (const sd of [-1, 1]) {
        c.save(); c.translate(sd * 60, -200); c.rotate(sd * (-0.3 + flap));
        c.fillStyle = '#ffffff';
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sd * 260, -220, sd * 330, -60); c.quadraticCurveTo(sd * 200, 0, 0, 30); c.fill();
        c.strokeStyle = '#ffe45c'; c.lineWidth = 8; c.stroke();
        c.restore();
      }
    }
    this.drawFigure(c, this.sled, this.look, cf * cs < 0, pose, G.time, this.speed, 0);
    c.globalAlpha = 1;

    if (this.pw.shield > 0) {
      const a = this.pw.shield < 3 ? 0.4 + 0.4 * Math.sin(G.time * 20) : 0.6;
      c.strokeStyle = `rgba(120,210,255,${a})`;
      c.fillStyle = `rgba(120,210,255,${a * 0.25})`;
      c.lineWidth = 14;
      c.beginPath(); c.ellipse(0, -190, 260, 250, 0, 0, TAU); c.fill(); c.stroke();
      Art.ell(c, -120, -330, 40, 20, `rgba(255,255,255,${a})`);
    }
    if (this.pw.magnet > 0) {
      c.save(); c.translate(0, -520 + Math.sin(G.time * 6) * 12);
      drawPowerIcon(c, 'magnet', 60);
      c.restore();
    }
    c.restore();
  },

  // Sled + rider in local world units. Used for the player, rivals and garage previews.
  drawFigure(c, sled, look, front, pose, t, speed, lean) {
    if (lean) c.rotate(lean * 0.16);
    if (front) { sled.near(c, t); this.drawRider(c, front, pose, t, speed, look); sled.far(c, t); }
    else { sled.far(c, t); this.drawRider(c, front, pose, t, speed, look); sled.near(c, t); }
  },

  drawRider(c, front, pose, t, speed, look) {
    const fast = U.clamp(speed / 14000, 0, 1);

    const pts = [18, -228];
    for (let i = 1; i <= 7; i++) {
      pts.push(20 + i * 24 * (0.6 + fast), -226 + Math.sin(t * (14 + fast * 20) - i) * (8 + fast * 22) + i * 5);
    }
    Art.line(c, pts, look.hat === 'crown' ? '#d62839' : '#e63946', look.hat === 'crown' ? 40 : 26);

    if (front) {
      Art.ell(c, -70, -40, 38, 26, '#26314f');
      Art.ell(c, 70, -40, 38, 26, '#26314f');
    }

    let hands;
    if (pose === 'ride') hands = [[-150, -70], [150, -70]];
    else if (pose === 'grab') hands = [[-40, -380], [40, -380]];
    else hands = [[-160, -330 + Math.sin(t * 22) * 40], [160, -330 + Math.sin(t * 22 + 2) * 40]];
    for (let i = 0; i < 2; i++) {
      const sx = i ? 80 : -80;
      Art.line(c, [sx, -195, hands[i][0], hands[i][1]], look.sleeve, 44);
      Art.circ(c, hands[i][0], hands[i][1], 27, look.mitt);
    }

    c.fillStyle = look.jacket;
    c.beginPath();
    c.moveTo(-100, -48);
    c.quadraticCurveTo(-118, -200, -62, -232);
    c.lineTo(62, -232);
    c.quadraticCurveTo(118, -200, 100, -48);
    c.closePath(); c.fill();
    Art.rect(c, -104, -150, 208, 22, look.stripe);
    if (!front) Art.label(c, '7', 0, -185, 60, look.stripe);
    else Art.rect(c, -6, -230, 12, 180, 'rgba(0,0,0,0.18)');

    const skin = look.hat === 'banana' && !front ? look.hatColor : front ? '#f1c19e' : '#6b4226';
    Art.circ(c, 0, -280, 58, skin);
    if (front) {
      Art.rect(c, -52, -306, 104, 38, '#222');
      const gg = c.createLinearGradient(-50, -304, 50, -270);
      gg.addColorStop(0, '#ffcb3a'); gg.addColorStop(1, '#ff4f7b');
      c.fillStyle = gg; c.fillRect(-46, -301, 92, 28);
      if (fast > 0.55 || pose !== 'ride') Art.ell(c, 0, -244, 16 + fast * 8, 10 + fast * 16, '#5a1020');
      else {
        c.strokeStyle = '#5a1020'; c.lineWidth = 8;
        c.beginPath(); c.arc(0, -258, 22, 0.2, Math.PI - 0.2); c.stroke();
      }
    }
    drawHat(c, look, front, t);
  },

  drawCrash(c, G) {
    const tt = this.tumble, fade = Math.max(0, 1 - tt / 1.3);
    c.save();
    c.translate(-150 - tt * 140, -30 - Math.abs(Math.sin(tt * 6)) * 120 * fade);
    c.rotate(tt * 6 * fade + 0.6);
    this.sled.far(c, G.time); this.sled.near(c, G.time);
    c.restore();

    c.save();
    c.translate(90 + tt * 70, -40 - Math.abs(Math.sin(tt * 7)) * 260 * fade);
    c.rotate(tt * 10 * fade + (1 - fade) * 1.5);
    c.translate(0, 150);
    Art.line(c, [-40, -60, -130, 30], '#26314f', 44);
    Art.line(c, [40, -60, 130, 30], '#26314f', 44);
    this.drawRider(c, true, 'air', G.time, this.speed, this.look);
    c.restore();

    if (tt > 0.8) {
      for (let i = 0; i < 4; i++) {
        const a = G.time * 5 + (i / 4) * TAU;
        c.save();
        c.translate(190 + tt * 70 + Math.cos(a) * 110, -470 + Math.sin(a) * 30);
        c.fillStyle = '#ffd23f';
        c.beginPath();
        for (let j = 0; j < 10; j++) {
          const r = j % 2 ? 12 : 28, b = (j / 10) * TAU;
          c.lineTo(Math.cos(b) * r, Math.sin(b) * r);
        }
        c.closePath(); c.fill();
        c.restore();
      }
    }
  },

  petX() { return this.x + 0.32 * this.petSide; },

  drawPet(c, gx, gy, k, G) {
    if (!this.pet || this.pet.id === 'none') return;
    const px = gx + 0.32 * this.petSide * CFG.ROAD_W * k;
    c.fillStyle = 'rgba(20,30,70,0.2)';
    c.beginPath(); c.ellipse(px, gy, 90 * k, 20 * k, 0, 0, TAU); c.fill();
    c.save();
    c.translate(px, gy - this.petAir * k);
    c.scale(k, k);
    c.rotate(this.lean * 0.1);
    this.pet.draw(c, G.time);
    c.restore();
  },

  previewPet(cv, id) {
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.save();
    c.translate(cv.width / 2, cv.height * 0.86);
    const k = cv.height / 330;
    c.scale(k, k);
    Art.ell(c, 0, 6, 130, 18, 'rgba(16,26,58,0.25)');
    const pet = petById(id);
    if (pet.id === 'none') Art.label(c, 'NONE', 0, -100, 60, '#9aa3b5');
    else pet.draw(c, 0.3);
    c.restore();
  },

  preview(cv, sledId, outfitId, front) {
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.save();
    c.translate(cv.width / 2, cv.height * 0.9);
    const k = cv.height / 640;
    c.scale(k, k);
    Art.ell(c, 0, 10, 220, 30, 'rgba(16,26,58,0.25)');
    this.drawFigure(c, sledById(sledId), outfitById(outfitId), front, 'ride', 0.3, 3000, 0);
    c.restore();
  },
};
