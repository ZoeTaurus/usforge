'use strict';
// ---------------------------------------------------------------------------
// Game bootstrap: canvas scaling, fixed 60 Hz loop, screen manager with
// cartoon wipe transitions.
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  music: 7, sfx: 8, difficulty: 1, time: 99, rounds: 2, shake: true, boxes: false,
};

const Game = {
  W: 1280,
  H: 720,
  canvas: null,
  ctx: null,
  screen: null,
  trans: null,
  frame: 0,
  acc: 0,
  last: 0,
  debugBoxes: false,
  settings: null,
  paused: false,

  init() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, Store.get('settings', {}));
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    Input.init(this.canvas);
    Touch.init();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F2') {
        this.debugBoxes = !this.debugBoxes;
        e.preventDefault();
      }
      if (e.code === 'F11' || (e.code === 'KeyF' && e.altKey)) {
        this.toggleFullscreen();
        e.preventDefault();
      }
    });
    // unlock audio on first gesture
    const unlock = () => {
      Sound.init();
      Sound.setVolumes(this.settings.music, this.settings.sfx);
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('mousedown', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('touchend', unlock); // iOS only unlocks audio on touchend
    window.addEventListener('pointerup', unlock);
    this.start();
  },

  start() {
    const q = new URLSearchParams(location.search);
    const dev = q.get('dev');
    if (dev && typeof DevScreens !== 'undefined' && DevScreens[dev]) this.screen = DevScreens[dev](q);
    else this.screen = new TitleScreen();
    if (this.screen.enter) this.screen.enter();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  saveSettings() {
    Store.set('settings', this.settings);
    Sound.setVolumes(this.settings.music, this.settings.sfx);
  },

  toggleFullscreen() {
    // fullscreen is optional: embedded frames and phones may refuse it
    try {
      const p = !document.fullscreenElement ? document.documentElement.requestFullscreen() : document.exitFullscreen();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      /* ignore */
    }
  },

  resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const s = Math.min(ww / this.W, wh / this.H);
    const cw = Math.floor(this.W * s), ch = Math.floor(this.H * s);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.canvas.style.left = Math.floor((ww - cw) / 2) + 'px';
    this.canvas.style.top = Math.floor((wh - ch) / 2) + 'px';
    this.canvas.width = Math.floor(cw * dpr);
    this.canvas.height = Math.floor(ch * dpr);
    this.renderScale = (cw * dpr) / this.W;
  },

  loop(ts) {
    let dt = ts - this.last;
    this.last = ts;
    if (dt > 250) dt = 250;
    this.acc += dt;
    const step = 1000 / 60;
    let n = 0;
    while (this.acc >= step && n < 5) {
      this.update();
      this.acc -= step;
      n++;
    }
    if (n === 5) this.acc = 0;
    const w0 = performance.now();
    this.render();
    this.adapt(performance.now() - w0, dt);
    requestAnimationFrame((t) => this.loop(t));
  },

  // Slow devices drop the fighters' shadows, then their inked lines, when a
  // battle runs below ~45 fps and drawing is a big part of each frame.
  adapt(ms, dt) {
    if (Sketch.quality <= 1 || dt > 250 || !(this.screen && this.screen.b) || this.trans) return;
    const k = this.adaptT ? 0.96 : 0;
    this.renderAvg = (this.renderAvg || ms) * k + ms * (1 - k);
    this.frameAvg = (this.frameAvg || dt) * k + dt * (1 - k);
    this.adaptT = (this.adaptT || 0) + 1;
    if (this.adaptT > 180 && this.frameAvg > 22 && this.renderAvg > 6) {
      Sketch.quality--;
      this.adaptT = 0;
    }
  },

  update() {
    this.frame++;
    Input.update();
    Touch.update();
    if (this.trans) {
      const tr = this.trans;
      tr.t++;
      if (!tr.swapped && tr.t >= tr.dur / 2) {
        tr.swapped = true;
        if (this.screen && this.screen.exit) this.screen.exit();
        this.screen = typeof tr.to === 'function' ? tr.to() : tr.to;
        if (this.screen.enter) this.screen.enter();
      }
      if (tr.t >= tr.dur) this.trans = null;
      if (tr.swapped && this.screen) this.screen.update();
      return;
    }
    if (this.screen) this.screen.update();
  },

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.screen) this.screen.render(ctx);
    if (this.trans) this.drawTransition(ctx, this.trans);
  },

  // Go to another screen. `to` is a screen or a factory.
  go(to, dur = 40) {
    if (this.trans) return;
    this.trans = { to, t: 0, dur, swapped: false, color: U.choose(['#ff5a7a', '#7a5cff', '#ffd23f', '#36d6c3']) };
    Sound.sfx('whoosh', { vol: 0.5 });
  },

  drawTransition(ctx, tr) {
    const half = tr.dur / 2;
    const p = tr.t < half ? U.ease.inout(tr.t / half) : 1 - U.ease.inout((tr.t - half) / half);
    const n = 9, D = 0.45;
    const cols = ['#ff5a7a', '#7a5cff', '#ffd23f', '#36d6c3'];
    const bw = 1280 / (n - 1);
    ctx.save();
    for (let i = -1; i < n + 1; i++) {
      const d = (D * (i + 1)) / (n + 1);
      const q = U.clamp(p * (1 + D) - d, 0, 1);
      if (q <= 0) continue;
      const x = i * bw;
      ctx.save();
      ctx.translate(x + bw / 2, 360);
      ctx.rotate(0.2);
      const h = 1000 * q;
      ctx.fillStyle = cols[(i + 4) % cols.length];
      ctx.fillRect(-bw / 2 - 30, -500, bw + 60, h);
      ctx.fillStyle = INK;
      if (q < 1) ctx.fillRect(-bw / 2 - 30, -500 + h - 8, bw + 60, 8);
      ctx.restore();
    }
    ctx.restore();
  },
};

window.addEventListener('load', () => {
  const go = () => Game.init();
  if (document.fonts && document.fonts.load) {
    Promise.race([
      Promise.all([document.fonts.load("40px 'Luckiest Guy'"), document.fonts.load("600 20px 'Fredoka'"), document.fonts.load("700 20px 'Fredoka'")]),
      new Promise((r) => setTimeout(r, 1500)),
    ]).then(go, go);
  } else go();
});
