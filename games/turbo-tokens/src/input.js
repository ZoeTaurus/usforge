// Keyboard + on-screen touch controls.

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'brake',
  KeyE: 'handbrake',
  ShiftLeft: 'nitro', ShiftRight: 'nitro', KeyN: 'nitro',
};
const PRESS = { KeyC: 'camera', Escape: 'pause', KeyP: 'pause', KeyR: 'reset', KeyM: 'mute', KeyH: 'horn', KeyQ: 'daily', Enter: 'skip', Space: 'skip' };

export class Input {
  constructor() {
    this.down = new Set();
    this.touch = new Set();
    this.pressed = [];
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = KEYMAP[e.code];
      if (k) {
        this.down.add(k);
        e.preventDefault();
      }
      if (PRESS[e.code] && !e.repeat) this.pressed.push(PRESS[e.code]);
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) this.down.delete(k);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.touch.clear();
    });
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  bindTouch(root) {
    root.querySelectorAll('[data-touch]').forEach((el) => {
      const k = el.dataset.touch;
      const on = (e) => {
        e.preventDefault();
        if (k === 'camera' || k === 'pause' || k === 'horn') this.pressed.push(k);
        else this.touch.add(k);
        el.classList.add('held');
      };
      const off = (e) => {
        e.preventDefault();
        this.touch.delete(k);
        el.classList.remove('held');
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    });
  }

  has(k) {
    return this.down.has(k) || this.touch.has(k);
  }

  read() {
    return {
      throttle: this.has('up') ? 1 : 0,
      brake: this.has('down') || this.has('brake') ? 1 : 0,
      reverse: this.has('down'), // Space only brakes; S / ↓ also reverses
      steer: (this.has('left') ? 1 : 0) - (this.has('right') ? 1 : 0),
      handbrake: this.has('handbrake'),
      nitro: this.has('nitro'),
    };
  }

  consume() {
    const p = this.pressed;
    this.pressed = [];
    return p;
  }
}
