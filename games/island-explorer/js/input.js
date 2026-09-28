'use strict';
// Keyboard + touch input. Discrete presses are turned into named actions.
const Input = {
  keys: {},
  touch: { x: 0, y: 0, active: false },
  isTouch: false,
  KEYMAP: {
    e: 'interact', enter: 'interact', ' ': 'attack', k: 'attack', j: 'journal',
    c: 'craft', m: 'map', tab: 'map', f: 'eat', h: 'heal', escape: 'pause', p: 'pause',
    1: 'r1', 2: 'r2', 3: 'r3', 4: 'r4', 5: 'r5', 6: 'r6', 7: 'r7', 8: 'r8', 9: 'r9',
    arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', q: 'roll', l: 'roll', b: 'build', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
  },

  init(onAction) {
    this.onAction = onAction;
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
      this.keys[k] = true;
      if (!e.repeat && this.KEYMAP[k]) onAction(this.KEYMAP[k]);
    });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    addEventListener('blur', () => { this.keys = {}; this.touch.active = false; });
    this.isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
    if (this.isTouch) this.initTouch();
    document.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); onAction(b.dataset.act); });
    });
  },

  // Movement vector; analog (magnitude <= 1) on touch.
  axis() {
    const K = this.keys;
    let x = 0, y = 0;
    if (K.a || K.arrowleft) x--;
    if (K.d || K.arrowright) x++;
    if (K.w || K.arrowup) y--;
    if (K.s || K.arrowdown) y++;
    if (!x && !y && this.touch.active) { x = this.touch.x; y = this.touch.y; }
    return [x, y];
  },
  sprint() { return !!this.keys.shift || (this.touch.active && Math.hypot(this.touch.x, this.touch.y) > 0.95); },

  initTouch() {
    document.body.classList.add('touch');
    const zone = document.getElementById('stickZone');
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let id = null, cx = 0, cy = 0;
    const R = 46;
    const move = e => {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx *= R / len; dy *= R / len; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const m = Math.min(1, len / R);
      this.touch.x = m < 0.2 ? 0 : dx / R;
      this.touch.y = m < 0.2 ? 0 : dy / R;
    };
    zone.addEventListener('pointerdown', e => {
      if (id !== null) return;
      id = e.pointerId; zone.setPointerCapture(id);
      cx = e.clientX; cy = e.clientY;
      stick.style.left = cx + 'px'; stick.style.top = cy + 'px';
      stick.classList.add('on');
      this.touch.active = true;
      move(e);
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const end = e => {
      if (e.pointerId !== id) return;
      id = null; this.touch.active = false; this.touch.x = this.touch.y = 0;
      stick.classList.remove('on'); knob.style.transform = '';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  },
};
