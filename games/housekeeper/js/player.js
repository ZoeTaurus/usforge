// The housesitter: movement, collision, sitting/hiding.
HS.Player = {
  x: 0, y: 0, r: 5,
  vx: 0, vy: 0,
  speed: 70,
  face: { x: 0, y: 1 },
  moving: false,
  walkT: 0,
  sitting: null,
  hidden: false,
  prev: null,

  reset(atDoor) {
    const T = HS.TILE;
    if (atDoor) { this.x = 26.5 * T; this.y = 9.6 * T; this.face = { x: -1, y: 0 }; }
    else { this.x = 4.5 * T; this.y = 15.5 * T; this.face = { x: 0, y: 1 }; }
    this.vx = this.vy = 0;
    this.sitting = null;
    this.hidden = false;
    this.moving = false;
  },

  sit(o) {
    if (this.sitting) return;
    this.prev = { x: this.x, y: this.y };
    this.sitting = o;
    this.x = (o.x + o.w / 2) * HS.TILE;
    this.y = (o.y + o.h / 2) * HS.TILE;
    this.vx = this.vy = 0;
    this.moving = false;
    HS.Rulebook.onSit(o);
  },

  stand() {
    const o = this.sitting;
    this.sitting = null;
    this.hidden = false;
    this.x = this.prev.x;
    this.y = this.prev.y;
    HS.Game.onStand(o);
  },

  update(dt) {
    const I = HS.Input;
    if (this.sitting) {
      if (I.anyMove()) this.stand();
      return;
    }

    let ix = (I.down('d', 'arrowright') ? 1 : 0) - (I.down('a', 'arrowleft') ? 1 : 0);
    let iy = (I.down('s', 'arrowdown') ? 1 : 0) - (I.down('w', 'arrowup') ? 1 : 0);
    const len = Math.hypot(ix, iy) || 1;
    ix /= len; iy /= len;

    if (HS.Game.effect('icy')) {
      // Slippery floor: accelerate slowly, slide a lot.
      this.vx += ix * 210 * dt;
      this.vy += iy * 210 * dt;
      const f = Math.pow(0.35, dt);
      this.vx *= f; this.vy *= f;
      const sp = Math.hypot(this.vx, this.vy), max = this.speed * 1.3;
      if (sp > max) { this.vx *= max / sp; this.vy *= max / sp; }
    } else {
      this.vx = ix * this.speed;
      this.vy = iy * this.speed;
    }

    if (ix || iy) this.face = { x: ix, y: iy };
    this.moveAxis(this.vx * dt, 0);
    this.moveAxis(0, this.vy * dt);
    this.moving = Math.hypot(this.vx, this.vy) > 3;
    if (this.moving) this.walkT += dt * 8;
  },

  moveAxis(dx, dy) {
    const nx = this.x + dx, ny = this.y + dy;
    if (!this.hits(nx, ny)) {
      this.x = nx; this.y = ny;
    } else if (dx) {
      this.vx *= -0.3;
    } else {
      this.vy *= -0.3;
    }
  },

  hits(x, y) {
    const r = this.r - 1;
    return [[-r, -r], [r, -r], [-r, r], [r, r]].some(([ox, oy]) => HS.Map.isSolidAt(x + ox, y + oy));
  },
};
