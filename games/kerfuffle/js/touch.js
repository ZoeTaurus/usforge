'use strict';
// ---------------------------------------------------------------------------
// Touch controls for phones and tablets: a floating stick on the left half of
// the screen and attack buttons on the right, as a DOM overlay above the
// canvas. They hold "virtual keys" that belong to player 1's key map, so
// battles, training and menus all work without special cases. Menus are
// tapped directly on the canvas; a back button stands in for Esc.
// ---------------------------------------------------------------------------

const TOUCH_KEYS = {
  UP: 'TouchUp', DOWN: 'TouchDown', LEFT: 'TouchLeft', RIGHT: 'TouchRight',
  LIGHT: 'TouchL', HEAVY: 'TouchH', SPECIAL: 'TouchS', SUPER: 'TouchSUP', THROW: 'TouchTHR',
};
for (const k in TOUCH_KEYS) KEYMAPS[0][k].push(TOUCH_KEYS[k]);

const Touch = {
  active: false, // the player is using touch (shown until a physical key is pressed)
  mode: 'off', // 'battle' | 'menu' | 'title' | 'off'
  root: null,
  els: {},
  stick: null, // { id, x0, y0, dirs }

  init() {
    let coarse = false;
    try {
      coarse = window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
    } catch (e) {
      coarse = false;
    }
    this.active = coarse;
    this.build();
    window.addEventListener('touchstart', () => this.setActive(true), { passive: true, capture: true });
    window.addEventListener('keydown', (e) => {
      if (!e.code.startsWith('Touch')) this.setActive(false);
    });
    window.addEventListener('resize', () => this.refresh());
    window.addEventListener('blur', () => this.releaseAll());
  },

  build() {
    const css = document.createElement('style');
    css.textContent = `
      #touch { position: fixed; inset: 0; pointer-events: none; z-index: 5; display: none;
        --b: clamp(56px, 17vmin, 92px); --pad: clamp(10px, 3vmin, 24px);
        font-family: 'Luckiest Guy', 'Arial Black', system-ui, sans-serif;
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      #touch.on { display: block; }
      #touch .zone, #touch .tb, #touch .sb { pointer-events: auto; touch-action: none; }
      #touch .zone { position: absolute; left: 0; top: 18%; bottom: 0; width: 46%; }
      #touch .base { position: absolute; width: calc(var(--b) * 1.9); height: calc(var(--b) * 1.9);
        margin: calc(var(--b) * -0.95) 0 0 calc(var(--b) * -0.95); border-radius: 50%;
        border: 3px solid rgba(255,255,255,0.55); background: rgba(16,10,24,0.28); display: none; }
      #touch .knob { position: absolute; width: calc(var(--b) * 0.85); height: calc(var(--b) * 0.85);
        margin: calc(var(--b) * -0.425) 0 0 calc(var(--b) * -0.425); border-radius: 50%;
        background: rgba(255,255,255,0.85); border: 3px solid #140c1f; display: none; }
      #touch .hint { position: absolute; left: calc(var(--pad) + var(--b) * 0.5); bottom: calc(var(--pad) + var(--b) * 0.4);
        width: calc(var(--b) * 1.5); height: calc(var(--b) * 1.5); border-radius: 50%;
        border: 3px dashed rgba(255,255,255,0.35); color: rgba(255,255,255,0.6);
        display: grid; place-items: center; font-size: calc(var(--b) * 0.2); letter-spacing: 0.05em; text-align: center; }
      #touch .tb { position: absolute; width: var(--b); height: var(--b); border-radius: 50%;
        display: grid; place-items: center; color: #fff; font-size: calc(var(--b) * 0.2); letter-spacing: 0.04em;
        background: rgba(16,10,24,0.34); border: 3px solid var(--c); box-shadow: inset 0 -5px 0 rgba(0,0,0,0.25);
        text-shadow: 0 2px 0 #140c1f; }
      #touch .tb[data-key], #touch .sb[data-esc] { background-image: var(--ink); background-size: 100% 100%; }
      #touch .tb.small { width: calc(var(--b) * 0.72); height: calc(var(--b) * 0.72); font-size: calc(var(--b) * 0.16); }
      #touch .tb.down { background-color: var(--c); color: #140c1f; text-shadow: none; transform: scale(0.94); }
      #touch .tb.ready { animation: tglow 0.6s ease-in-out infinite alternate; background-color: rgba(255,179,0,0.55); }
      @keyframes tglow { from { box-shadow: 0 0 0 0 rgba(255,210,63,0.9); } to { box-shadow: 0 0 22px 6px rgba(255,210,63,0.9); } }
      #touch .tb.l { --c: #7fe3ff; right: calc(var(--pad) + var(--b) * 1.12); bottom: var(--pad); }
      #touch .tb.h { --c: #ff8a9a; right: var(--pad); bottom: calc(var(--pad) + var(--b) * 0.42); }
      #touch .tb.s { --c: #ffd23f; right: calc(var(--pad) + var(--b) * 0.98); bottom: calc(var(--pad) + var(--b) * 1.12); }
      #touch .tb.thr { --c: #c9b6ff; right: calc(var(--pad) + var(--b) * 2.22); bottom: calc(var(--pad) + var(--b) * 0.12); }
      #touch .tb.sup { --c: #ffb300; right: calc(var(--pad) + var(--b) * 0.1); bottom: calc(var(--pad) + var(--b) * 1.55); }
      #touch .sb { position: absolute; top: calc(var(--pad) * 0.6); height: calc(var(--b) * 0.52); min-width: calc(var(--b) * 0.62);
        padding: 0 calc(var(--b) * 0.16); border-radius: calc(var(--b) * 0.26); display: grid; place-items: center;
        color: #fff; font-size: calc(var(--b) * 0.2); letter-spacing: 0.05em; background: rgba(16,10,24,0.55);
        border: 2px solid rgba(255,255,255,0.7); }
      #touch .sb.down { background-color: #fff; color: #140c1f; }
      #touch .pause { left: 50%; transform: translateX(-50%); }
      #touch .back { left: calc(var(--pad) * 0.8); }
      #touch .battle-only, #touch .menu-only { display: none; }
      #touch.battle .battle-only { display: grid; }
      #touch.battle .zone.battle-only { display: block; }
      #touch.menu .menu-only { display: grid; }
      #rotate { position: fixed; inset: 0; z-index: 6; display: none; place-items: center; pointer-events: none;
        background: rgba(20,12,31,0.82); color: #fff; font-family: 'Luckiest Guy', 'Arial Black', system-ui, sans-serif;
        text-align: center; font-size: 22px; letter-spacing: 0.04em; padding-inline: 16px; }
      #rotate.on { display: grid; }
      #rotate span { display: block; font-size: 64px; line-height: 1.1; transform: rotate(90deg); }
    `;
    document.head.appendChild(css);

    const root = document.createElement('div');
    root.style.setProperty('--ink', `url(${this.inkTexture()})`);
    root.id = 'touch';
    root.innerHTML = `
      <div class="zone battle-only"><div class="hint">MOVE<br>&amp; JUMP</div><div class="base"></div><div class="knob"></div></div>
      <div class="tb l battle-only" data-key="LIGHT">LIGHT</div>
      <div class="tb h battle-only" data-key="HEAVY">HEAVY</div>
      <div class="tb s battle-only" data-key="SPECIAL">SPECIAL</div>
      <div class="tb small thr battle-only" data-key="THROW">THROW</div>
      <div class="tb small sup battle-only" data-key="SUPER">SUPER</div>
      <div class="sb pause battle-only" data-esc="1">❚❚</div>
      <div class="sb back menu-only" data-esc="1">◀ BACK</div>`;
    document.body.appendChild(root);
    this.root = root;
    const rot = document.createElement('div');
    rot.id = 'rotate';
    rot.innerHTML = '<div><span>📱</span>Turn your phone sideways<br>to play</div>';
    document.body.appendChild(rot);
    this.els.rotate = rot;

    // attack buttons: hold while pressed (multi-touch via pointer capture)
    for (const el of root.querySelectorAll('.tb')) {
      const code = TOUCH_KEYS[el.dataset.key];
      const down = (e) => {
        e.preventDefault();
        try {
          el.setPointerCapture(e.pointerId);
        } catch (err) {
          /* fine without capture */
        }
        el.classList.add('down');
        this.press(code);
      };
      const up = () => {
        el.classList.remove('down');
        this.release(code);
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    }
    // pause / back stand in for Esc
    for (const el of root.querySelectorAll('.sb')) {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.classList.add('down');
        Input.pressedQ.add('Escape');
        Sound.sfx('menuBack');
      });
      const up = () => el.classList.remove('down');
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    }
    // the floating stick
    const zone = root.querySelector('.zone');
    this.els.zone = zone;
    this.els.base = zone.querySelector('.base');
    this.els.knob = zone.querySelector('.knob');
    this.els.hint = zone.querySelector('.hint');
    this.els.sup = root.querySelector('.tb.sup');
    this.els.pause = root.querySelector('.sb.pause');
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.stick) return;
      try {
        zone.setPointerCapture(e.pointerId);
      } catch (err) {
        /* fine without capture */
      }
      const r = zone.getBoundingClientRect();
      this.stick = { id: e.pointerId, x0: e.clientX - r.left, y0: e.clientY - r.top, dirs: 0 };
      this.els.base.style.display = this.els.knob.style.display = 'block';
      this.els.hint.style.display = 'none';
      this.moveStick(e);
    });
    zone.addEventListener('pointermove', (e) => {
      if (this.stick && e.pointerId === this.stick.id) this.moveStick(e);
    });
    const end = (e) => {
      if (this.stick && e.pointerId === this.stick.id) this.endStick();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
    this.refresh();
  },

  // The backgrounds' hand-drawn ink texture as an image for the buttons: a
  // jagged black fringe along the bottom with hatching and specks.
  inkTexture() {
    try {
      const S = 128, cv = document.createElement('canvas');
      cv.width = cv.height = S;
      const g = cv.getContext('2d'), rnd = U.rng(42);
      g.fillStyle = 'rgba(12,6,20,0.78)';
      g.beginPath();
      g.moveTo(0, S);
      g.lineTo(0, S * 0.8);
      const teeth = 7;
      for (let i = 0; i <= teeth * 2; i++) {
        const x = (i / (teeth * 2)) * S + (i % 2 ? (rnd() - 0.5) * 8 : 0);
        g.lineTo(x, i % 2 ? S * (0.5 - rnd() * 0.18) : S * (0.8 + rnd() * 0.06));
      }
      g.lineTo(S, S);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(12,6,20,0.7)';
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      g.beginPath();
      for (let i = 0; i < 9; i++) {
        const x = 8 + (i / 9) * S + rnd() * 6, y = S * (0.62 - rnd() * 0.08);
        g.moveTo(x, y);
        g.lineTo(x + 9, y - 16 - rnd() * 8);
      }
      g.stroke();
      g.fillStyle = 'rgba(12,6,20,0.7)';
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const x = rnd() * S, y = S * (0.3 + rnd() * 0.15), r = 1.2 + rnd() * 1.4;
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, Math.PI * 2);
      }
      g.fill();
      return cv.toDataURL();
    } catch (e) {
      return '';
    }
  },

  moveStick(e) {
    const S = this.stick, el = this.els;
    const r = el.zone.getBoundingClientRect();
    const R = el.base.offsetWidth * 0.5 || 60;
    let dx = e.clientX - r.left - S.x0, dy = e.clientY - r.top - S.y0;
    const d = Math.hypot(dx, dy);
    // drag past the rim and the base follows the thumb
    if (d > R) {
      S.x0 += (dx / d) * (d - R);
      S.y0 += (dy / d) * (d - R);
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    el.base.style.left = S.x0 + 'px';
    el.base.style.top = S.y0 + 'px';
    el.knob.style.left = S.x0 + dx + 'px';
    el.knob.style.top = S.y0 + dy + 'px';
    const nx = dx / R, ny = dy / R;
    let dirs = 0;
    if (nx > 0.38) dirs |= BTN.RIGHT;
    if (nx < -0.38) dirs |= BTN.LEFT;
    if (ny < -0.5) dirs |= BTN.UP;
    if (ny > 0.45) dirs |= BTN.DOWN;
    this.setDirs(dirs);
  },
  endStick() {
    this.stick && this.setDirs(0);
    this.stick = null;
    this.els.base.style.display = this.els.knob.style.display = 'none';
    this.els.hint.style.display = '';
  },
  setDirs(dirs) {
    const S = this.stick;
    if (!S) return;
    for (const name of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
      const on = (dirs & BTN[name]) !== 0, was = (S.dirs & BTN[name]) !== 0;
      if (on && !was) this.press(TOUCH_KEYS[name]);
      else if (!on && was) this.release(TOUCH_KEYS[name]);
    }
    S.dirs = dirs;
  },

  press(code) {
    if (!Input.keys.has(code)) Input.pressedQ.add(code);
    Input.keys.add(code);
    Input.lastDevice = 'touch';
  },
  release(code) {
    Input.keys.delete(code);
  },
  releaseAll() {
    for (const k in TOUCH_KEYS) Input.keys.delete(TOUCH_KEYS[k]);
    if (this.stick) this.endStick();
    if (this.root) for (const el of this.root.querySelectorAll('.down')) el.classList.remove('down');
  },

  setActive(on) {
    if (this.active === on) return;
    this.active = on;
    if (!on) this.releaseAll();
    this.refresh();
  },

  // called every frame: which controls the current screen wants
  update() {
    const s = Game.screen;
    let mode = 'menu';
    if (s && s.touchMode) mode = typeof s.touchMode === 'function' ? s.touchMode() : s.touchMode;
    if (mode !== this.mode) {
      this.mode = mode;
      if (mode !== 'battle') this.releaseAll();
      this.refresh();
    }
    if (mode === 'battle' && this.active) {
      const b = s.b || s.battle;
      const ready = !!(b && b.fighters[0].meter >= 100);
      if (ready !== this.superReady) {
        this.superReady = ready;
        this.els.sup.classList.toggle('ready', ready);
      }
    }
  },

  refresh() {
    if (!this.root) return;
    const show = this.active && (this.mode === 'battle' || this.mode === 'menu');
    this.root.classList.toggle('on', show);
    this.root.classList.toggle('battle', this.mode === 'battle');
    this.root.classList.toggle('menu', this.mode === 'menu');
    const portrait = this.active && window.innerHeight > window.innerWidth * 1.05;
    this.els.rotate.classList.toggle('on', portrait);
    this.placePause();
  },

  // The pause button goes in a letterbox bar when there is room, else under
  // the timer. Computed from the window like Game.resize (which may run later).
  placePause() {
    const el = this.els.pause, ww = window.innerWidth, wh = window.innerHeight;
    if (!el || !ww || !wh) return;
    const sc = Math.min(ww / 1280, wh / 720);
    const side = (ww - 1280 * sc) / 2, top = (wh - 720 * sc) / 2;
    const b = el.offsetHeight || 36;
    const st = el.style;
    if (side >= b * 1.6) {
      st.left = side / 2 + 'px';
      st.top = '12px';
    } else if (top >= b + 8) {
      st.left = '50%';
      st.top = (top - b) / 2 + 'px';
    } else {
      st.left = '50%';
      st.top = top + 118 * sc + 'px';
    }
  },
};
