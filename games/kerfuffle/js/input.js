'use strict';
// ---------------------------------------------------------------------------
// Keyboard + gamepad input. Produces per-player bitmasks every logic frame and
// edge-triggered menu input with key repeat.
// ---------------------------------------------------------------------------

const BTN = {
  UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8,
  LIGHT: 16, HEAVY: 32, SPECIAL: 64, SUPER: 128, THROW: 256, START: 512,
};
const BTN_ATTACKS = BTN.LIGHT | BTN.HEAVY | BTN.SPECIAL | BTN.SUPER | BTN.THROW;

const KEYMAPS = [
  // Player 1 — left side of the keyboard + J K L
  {
    UP: ['KeyW'], DOWN: ['KeyS'], LEFT: ['KeyA'], RIGHT: ['KeyD'],
    LIGHT: ['KeyJ'], HEAVY: ['KeyK'], SPECIAL: ['KeyL'], SUPER: ['KeyI'], THROW: ['KeyU'],
    START: ['Escape', 'Enter'],
  },
  // Player 2 — arrows + numpad (or , . / ; ')
  {
    UP: ['ArrowUp'], DOWN: ['ArrowDown'], LEFT: ['ArrowLeft'], RIGHT: ['ArrowRight'],
    LIGHT: ['Numpad1', 'Comma'], HEAVY: ['Numpad2', 'Period'], SPECIAL: ['Numpad3', 'Slash'],
    SUPER: ['Numpad5', 'Quote'], THROW: ['Numpad4', 'Semicolon'],
    START: ['NumpadEnter', 'Backspace'],
  },
];

// Pretty names for the controls screens
const KEY_LABELS = {
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyJ: 'J', KeyK: 'K', KeyL: 'L', KeyI: 'I', KeyU: 'U',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Numpad1: 'Num1', Numpad2: 'Num2', Numpad3: 'Num3', Numpad4: 'Num4', Numpad5: 'Num5',
  Comma: ',', Period: '.', Slash: '/', Quote: "'", Semicolon: ';', Escape: 'Esc', Enter: 'Enter',
};

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Slash', 'Quote', 'Backspace',
  'Tab', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'NumpadEnter',
]);

const Input = {
  keys: new Set(),
  pressedQ: new Set(), // pressed since the last poll
  pressed: new Set(), // pressed this logic frame
  pads: [],
  padPrev: [],
  padNow: [],
  twoPlayer: false, // when false, every device drives player 1
  masks: [0, 0],
  prevMasks: [0, 0],
  devMasks: { kb: [0, 0], pad: [] },
  repeat: {},
  anyPressed: false,
  mouse: { x: 0, y: 0, down: false, clicked: false, moved: false, _clickQ: false },
  lastDevice: 'kb',

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code) || e.code.startsWith('Key') || e.code.startsWith('Digit')) {
        if (!(e.ctrlKey || e.metaKey) || GAME_KEYS.has(e.code)) e.preventDefault();
      }
      if (!e.repeat) {
        this.keys.add(e.code);
        this.pressedQ.add(e.code);
      }
      this.lastDevice = 'kb';
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
    if (canvas) {
      const toLocal = (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - r.left) / r.width) * Game.W;
        this.mouse.y = ((e.clientY - r.top) / r.height) * Game.H;
      };
      canvas.addEventListener('mousemove', (e) => {
        toLocal(e);
        this.mouse.moved = true;
      });
      canvas.addEventListener('mousedown', (e) => {
        toLocal(e);
        this.mouse.down = true;
        this.mouse._clickQ = true;
      });
      window.addEventListener('mouseup', () => (this.mouse.down = false));
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches[0]) toLocal(e.touches[0]);
        this.mouse._clickQ = true;
        e.preventDefault();
      }, { passive: false });
    }
  },

  _maskFromKeys(map) {
    let m = 0;
    for (const name in map) {
      const codes = map[name];
      for (let i = 0; i < codes.length; i++) {
        if (this.keys.has(codes[i]) || this.pressed.has(codes[i])) {
          m |= BTN[name];
          break;
        }
      }
    }
    return m;
  },

  _maskFromPad(p) {
    if (!p) return 0;
    const b = (i) => p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5);
    let m = 0;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (b(12) || ay < -0.5) m |= BTN.UP;
    if (b(13) || ay > 0.5) m |= BTN.DOWN;
    if (b(14) || ax < -0.5) m |= BTN.LEFT;
    if (b(15) || ax > 0.5) m |= BTN.RIGHT;
    if (b(0)) m |= BTN.UP; // A jumps
    if (b(2)) m |= BTN.LIGHT; // X
    if (b(3)) m |= BTN.HEAVY; // Y
    if (b(1)) m |= BTN.SPECIAL; // B
    if (b(5) || b(7)) m |= BTN.SUPER; // RB / RT
    if (b(4) || b(6)) m |= BTN.THROW; // LB / LT
    if (b(9)) m |= BTN.START;
    return m;
  },

  _padButtons(p) {
    if (!p) return 0;
    let bits = 0;
    for (let i = 0; i < Math.min(16, p.buttons.length); i++) {
      if (p.buttons[i].pressed || p.buttons[i].value > 0.5) bits |= 1 << i;
    }
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (ay < -0.5) bits |= 1 << 12;
    if (ay > 0.5) bits |= 1 << 13;
    if (ax < -0.5) bits |= 1 << 14;
    if (ax > 0.5) bits |= 1 << 15;
    return bits;
  },

  // Called once per logic frame.
  update() {
    this.pressed = this.pressedQ;
    this.pressedQ = new Set();
    this.anyPressed = this.pressed.size > 0;

    this.mouse.clicked = this.mouse._clickQ;
    this.mouse._clickQ = false;
    if (this.mouse.clicked) this.anyPressed = true;

    let pads = [];
    try {
      pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((p) => p && p.connected) : [];
    } catch (e) {
      pads = [];
    }
    this.pads = pads;
    this.padPrev = this.padNow;
    this.padNow = pads.map((p) => this._padButtons(p));
    for (let i = 0; i < this.padNow.length; i++) {
      if (this.padNow[i] & ~(this.padPrev[i] || 0)) {
        this.anyPressed = true;
        this.lastDevice = 'pad';
      }
    }

    const kbA = this._maskFromKeys(KEYMAPS[0]);
    const kbB = this._maskFromKeys(KEYMAPS[1]);
    const padM = pads.map((p) => this._maskFromPad(p));
    this.prevMasks = this.masks.slice();
    if (!this.twoPlayer) {
      let m = kbA | kbB;
      for (const pm of padM) m |= pm;
      this.masks = [m, 0];
    } else {
      let p1 = kbA, p2 = kbB;
      if (padM.length === 1) p2 |= padM[0];
      else if (padM.length >= 2) {
        p1 |= padM[0];
        p2 |= padM[1];
        for (let i = 2; i < padM.length; i++) p2 |= padM[i];
      }
      this.masks = [p1, p2];
    }
  },

  mask(player) {
    return this.masks[player] || 0;
  },

  // which pad index (if any) belongs to a player in two-player mode
  _padsFor(player) {
    const n = this.padNow.length;
    if (player < 0 || !this.twoPlayer) return [...Array(n).keys()];
    if (n === 1) return player === 1 ? [0] : [];
    if (player === 0) return n > 0 ? [0] : [];
    return [...Array(n).keys()].slice(1);
  },

  _padEdge(player, bit) {
    for (const i of this._padsFor(player)) {
      if ((this.padNow[i] & (1 << bit)) && !((this.padPrev[i] || 0) & (1 << bit))) return true;
    }
    return false;
  },
  _padHeld(player, bit) {
    for (const i of this._padsFor(player)) if (this.padNow[i] & (1 << bit)) return true;
    return false;
  },

  _keyEdge(codes) {
    for (const c of codes) if (this.pressed.has(c)) return true;
    return false;
  },
  _keyHeld(codes) {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  },

  // Edge-triggered menu input. player: 0, 1, or -1 for "anyone".
  menu(player = -1) {
    const maps = player < 0 || !this.twoPlayer ? KEYMAPS : [KEYMAPS[player]];
    const extraOk = player <= 0 || !this.twoPlayer ? ['Enter', 'Space'] : ['NumpadEnter'];
    const extraBack = player <= 0 || !this.twoPlayer ? ['Escape', 'Backspace'] : [];
    const res = { up: false, down: false, left: false, right: false, ok: false, back: false, alt: false, start: false };
    const dirs = [
      ['up', 'UP', 12],
      ['down', 'DOWN', 13],
      ['left', 'LEFT', 14],
      ['right', 'RIGHT', 15],
    ];
    const key = 'p' + player;
    if (!this.repeat[key]) this.repeat[key] = {};
    const rep = this.repeat[key];
    for (const [name, btn, padBit] of dirs) {
      let codes = [];
      for (const m of maps) codes = codes.concat(m[btn]);
      const edge = this._keyEdge(codes) || this._padEdge(player, padBit);
      const held = this._keyHeld(codes) || this._padHeld(player, padBit);
      if (edge) {
        res[name] = true;
        rep[name] = 0;
      } else if (held) {
        rep[name] = (rep[name] || 0) + 1;
        if (rep[name] > 20 && rep[name] % 5 === 0) res[name] = true;
      } else rep[name] = 0;
    }
    let ok = extraOk, back = extraBack, alt = [], start = [];
    for (const m of maps) {
      ok = ok.concat(m.LIGHT);
      back = back.concat(m.HEAVY);
      alt = alt.concat(m.SPECIAL);
    }
    res.ok = this._keyEdge(ok) || this._padEdge(player, 0) || this._padEdge(player, 2);
    res.back = this._keyEdge(back) || this._padEdge(player, 1);
    res.alt = this._keyEdge(alt) || this._padEdge(player, 3);
    res.start = this._keyEdge(['Enter', 'Escape', 'NumpadEnter']) || this._padEdge(player, 9);
    if (this._padEdge(player, 9)) res.ok = true;
    return res;
  },

  // a click or tap anywhere on the screen (consumed)
  tapped() {
    const c = this.mouse.clicked;
    this.mouse.clicked = false;
    return c;
  },

  // in-game pause button (any device belonging to the player, or anyone)
  pausePressed() {
    return this._keyEdge(['Escape', 'Enter', 'NumpadEnter', 'KeyP']) || this._padEdge(-1, 9);
  },
};
