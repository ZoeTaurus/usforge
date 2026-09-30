'use strict';
const Input = {
  down: {},
  pressed: {},
  onBlur: null,
  MAP: {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyP: 'pause', Escape: 'pause', KeyM: 'mute', Enter: 'enter',
  },
  press(k) {
    if (!this.down[k]) this.pressed[k] = true;
    this.down[k] = true;
  },
  init() {
    addEventListener('keydown', e => {
      const k = this.MAP[e.code];
      if (!k) return;
      // Let buttons on the menus keep their own Enter/Space behaviour.
      if ((k === 'enter' || k === 'jump') && e.target && e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      this.press(k);
    });
    addEventListener('keyup', e => {
      const k = this.MAP[e.code];
      if (!k) return;
      this.down[k] = false;
    });
    addEventListener('blur', () => {
      this.down = {};
      if (this.onBlur) this.onBlur();
    });
    document.querySelectorAll('[data-key]').forEach(b => {
      const k = b.dataset.key;
      const on = e => { e.preventDefault(); Sfx.init(); this.press(k); b.classList.add('on'); };
      const off = e => { e.preventDefault(); this.down[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
  },
  endFrame() {
    for (const k in this.pressed) this.pressed[k] = false;
  },
};
