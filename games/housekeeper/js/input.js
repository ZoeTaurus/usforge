// Keyboard state: `down` = held, `hit` = pressed this frame.
HS.Input = {
  keys: {},
  pressed: {},

  init() {
    const block = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if (block.includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    addEventListener('blur', () => { this.keys = {}; });
  },

  down(...ks) { return ks.some(k => this.keys[k]); },
  hit(...ks) { return ks.some(k => this.pressed[k]); },
  anyMove() { return this.hit('w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'); },
  endFrame() { this.pressed = {}; },
};
