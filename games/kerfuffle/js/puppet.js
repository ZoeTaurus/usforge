'use strict';
// ---------------------------------------------------------------------------
// Puppet: a fighter that lives outside of a battle (title screen, select
// screen, results) and just plays animations. Portrait: draws a head.
// ---------------------------------------------------------------------------

class Puppet extends Fighter {
  constructor(charId, palIdx = 0) {
    super(null, 0, charId, palIdx, null);
    this.isPuppet = true;
  }
  play(name, blend = 6) {
    const A = typeof name === 'string' ? this.C.anims[name] : name;
    if (A && A !== this.anim) this.setAnim(A, blend);
  }
  update() {
    this.sf++;
    this.tickAnim();
    this.fxTick();
    this.idleT++;
    this.computePose();
  }
  draw(ctx, x, y, scale = 1, facing = 1, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * facing, scale);
    Rig.drawCharacter(ctx, this, this.J, pal || this.pal);
    ctx.restore();
  }
}

const Portrait = {
  _rest: new Map(),
  restJ(C) {
    let J = this._rest.get(C.id);
    if (!J) {
      J = Rig.solve(C, C.poses.stance, true);
      this._rest.set(C.id, J);
    }
    return J;
  },
  head(ctx, C, pal, x, y, size, facing = 1, face = 'normal', t = 0) {
    const R = C.body.headR;
    const s = size / R;
    const fake = {
      C, pal, face, t, data: {}, cos: {}, state: 'idle', isPortrait: true, facing: 1,
      blinking: face === 'normal' && t % 220 < 7,
      J: this.restJ(C),
    };
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * facing, s);
    Sketch.begin(ctx, pal, 1);
    try {
      C.draw.head(ctx, fake, fake.J, pal, face);
    } finally {
      Sketch.end(ctx);
    }
    ctx.restore();
  },
};
