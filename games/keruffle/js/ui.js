'use strict';
// ---------------------------------------------------------------------------
// UI kit: chunky cartoon buttons, panels, menus (keyboard/gamepad/mouse),
// animated backgrounds.
// ---------------------------------------------------------------------------

const UI = {
  colors: ['#ff5a7a', '#ffd23f', '#36d6c3', '#7a5cff', '#ff9a3c', '#8cff8a'],

  panel(ctx, x, y, w, h, fill = '#2d1f45', opts = {}) {
    const r = opts.r || 18;
    ctx.save();
    if (opts.shadow !== false) {
      ctx.globalAlpha = 0.35;
      Draw.roundRect(ctx, x + 6, y + 8, w, h, r, '#0b0614', 0);
      ctx.globalAlpha = 1;
    }
    Draw.roundRect(ctx, x, y, w, h, r, fill, opts.lw || 5, opts.stroke || INK);
    if (opts.shine !== false) {
      ctx.globalAlpha = 0.12;
      Draw.roundRect(ctx, x + 8, y + 6, w - 16, Math.min(22, h * 0.25), r * 0.6, '#ffffff', 0);
    }
    ctx.restore();
  },

  // Draw shapes with the stages' hand-drawn ink finish (sketch.js): jagged
  // black brush marks with hatching and specks on the side away from the
  // light (dir, in local units), drawn live with a fixed seed.
  inked(ctx, seed, dir, paint, part = 'button') {
    Sketch.begin(ctx, UI.INKPAL, seed);
    Sketch.part = part;
    Sketch.dir = dir;
    try {
      paint();
    } finally {
      Sketch.end(ctx);
    }
  },
  INKPAL: { ink: INK },
  // light from above: a fringe of marks along the whole bottom of a button
  BTN_LIGHT: [0.1, -0.995],
  seedOf(text) {
    let h = 7;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 9973;
    return h;
  },

  button(ctx, x, y, w, h, label, sel, t, opts = {}) {
    const color = opts.color || '#ff5a7a';
    const s = sel ? 1.06 + Math.sin(t * 0.15) * 0.015 : 1;
    const rot = sel ? Math.sin(t * 0.1) * 0.012 : 0;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(s, s);
    ctx.rotate(rot);
    const bx = -w / 2, by = -h / 2;
    const face = sel ? color : '#5b4880';
    Draw.roundRect(ctx, bx, by + 7, w, h, h / 2, U.shade(face, -0.45), 5);
    // the face, with the backgrounds' ink texture, then its outline
    UI.inked(ctx, UI.seedOf(String(label)), UI.BTN_LIGHT, () => Draw.roundRect(ctx, bx, by, w, h, h / 2, face, 0));
    Draw.roundRect(ctx, bx, by, w, h, h / 2, null, 5);
    ctx.globalAlpha = 0.25;
    Draw.roundRect(ctx, bx + 14, by + 5, w - 28, h * 0.32, h * 0.16, '#ffffff', 0);
    ctx.globalAlpha = 1;
    const hasVal = opts.value !== undefined;
    Draw.text(ctx, label, hasVal ? bx + 28 : 0, 3, { size: opts.size || h * 0.52, align: hasVal ? 'left' : 'center', fill: sel ? '#ffffff' : '#d9cdee', lw: sel ? 7 : 5 });
    if (hasVal) {
      Draw.text(ctx, opts.value, w / 2 - 28, 3, { size: (opts.size || h * 0.52) * 0.9, align: 'right', fill: '#ffd23f', lw: 6 });
    }
    ctx.restore();
    if (sel && opts.pointer !== false) {
      const px = x - 30 + Math.sin(t * 0.2) * 5;
      UI.pointer(ctx, px, y + h / 2, 1);
      UI.pointer(ctx, x + w + 30 - Math.sin(t * 0.2) * 5, y + h / 2, -1);
    }
  },

  pointer(ctx, x, y, dir) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    Draw.poly(ctx, [-14, -14, 10, 0, -14, 14, -8, 0], '#ffd23f', 4);
    ctx.restore();
  },

  // Rotating comic sunburst
  burst(ctx, x, y, r, t, c1, c2, n = 18) {
    Draw.sunburst(ctx, x, y, r, n, t * 0.004, c1, c2);
  },

  // Scrolling diagonal stripes background
  stripes(ctx, t, c1, c2, w = 70, speed = 0.6) {
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.save();
    ctx.fillStyle = c2;
    const off = (t * speed) % (w * 2);
    ctx.beginPath();
    for (let x = -800 - w * 2 + off; x < 1400; x += w * 2) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w + 720, 720);
      ctx.lineTo(x + 720, 720);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  },

  // Halftone dots overlay
  dots(ctx, color, alpha = 0.12, step = 22, t = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    const off = (t * 0.3) % step;
    for (let y = -step; y < 740; y += step) {
      for (let x = -step + ((y / step) % 2) * (step / 2); x < 1300; x += step) {
        const rr = 2 + 2.5 * (y / 720);
        ctx.beginPath();
        ctx.arc(x + off, y + off, rr, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  // Big header with a ribbon behind
  header(ctx, text, y, t, color = '#ff5a7a', size = 60) {
    const w = Draw.measure(ctx, text, size) + 110;
    ctx.save();
    ctx.translate(640, y);
    ctx.rotate(-0.025 + Math.sin(t * 0.03) * 0.008);
    // ribbon tails
    Draw.poly(ctx, [-w / 2 - 50, -14, -w / 2 + 20, -14, -w / 2 + 20, 38, -w / 2 - 50, 38, -w / 2 - 30, 12], U.shade(color, -0.35), 5);
    Draw.poly(ctx, [w / 2 + 50, -14, w / 2 - 20, -14, w / 2 - 20, 38, w / 2 + 50, 38, w / 2 + 30, 12], U.shade(color, -0.35), 5);
    Draw.roundRect(ctx, -w / 2, -36, w, 72, 14, color, 5);
    Draw.text(ctx, text, 0, 2, { size, fill: '#ffffff', lw: 10, extrude: 5, extrudeColor: INK });
    ctx.restore();
  },

  // touchText replaces the keyboard hint while touch controls are in use
  hint(ctx, text, y = 700, touchText) {
    if (touchText !== undefined && typeof Touch !== 'undefined' && Touch.active) text = touchText;
    if (text) Draw.text(ctx, text, 640, y, { size: 17, font: FONT_UI, fill: '#ffffff', lw: 5, weight: 600 });
  },

  bar(ctx, x, y, w, h, v, max, color) {
    Draw.roundRect(ctx, x, y, w, h, h / 2, '#1d1428', 3);
    const n = max;
    const gap = 4;
    const sw = (w - 8 - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      Draw.roundRect(ctx, x + 4 + i * (sw + gap), y + 4, sw, h - 8, (h - 8) / 2, i < v ? color : '#3a2b52', 0);
    }
  },

  inRect(mx, my, r) {
    return mx >= r[0] && mx <= r[0] + r[2] && my >= r[1] && my <= r[1] + r[3];
  },
};

// Vertical menu with keyboard/gamepad/mouse support.
class Menu {
  constructor(items, opts = {}) {
    this.items = items; // {label, action, value?(), left?(), right?(), disabled?}
    this.sel = opts.sel || 0;
    this.x = opts.x || 640;
    this.y = opts.y || 300;
    this.w = opts.w || 380;
    this.h = opts.h || 54;
    this.gap = opts.gap || 66;
    this.player = opts.player !== undefined ? opts.player : -1;
    this.t = 0;
    this.onBack = opts.onBack || null;
    this.colors = opts.colors || UI.colors;
    this.size = opts.size;
  }
  rect(i) {
    return [this.x - this.w / 2, this.y + i * this.gap, this.w, this.h];
  }
  update() {
    this.t++;
    const m = Input.menu(this.player);
    const n = this.items.length;
    const move = (d) => {
      let i = this.sel;
      for (let k = 0; k < n; k++) {
        i = (i + d + n) % n;
        if (!this.items[i].disabled) break;
      }
      if (i !== this.sel) {
        this.sel = i;
        Sound.sfx('menuMove');
      }
    };
    if (m.up) move(-1);
    if (m.down) move(1);
    const it = this.items[this.sel];
    if (m.left && it.left) {
      it.left();
      Sound.sfx('menuMove');
    }
    if (m.right && it.right) {
      it.right();
      Sound.sfx('menuMove');
    }
    // mouse
    const ms = Input.mouse;
    if (ms.moved || ms.clicked) {
      for (let i = 0; i < n; i++) {
        if (!this.items[i].disabled && UI.inRect(ms.x, ms.y, this.rect(i))) {
          if (this.sel !== i && ms.moved) {
            this.sel = i;
            Sound.sfx('menuMove');
          }
          if (ms.clicked) {
            this.sel = i;
            const item = this.items[i];
            if (item.right && !item.action) item.right();
            else if (item.action) {
              Sound.sfx('menuOk');
              item.action();
            }
            ms.clicked = false;
          }
        }
      }
      ms.moved = false;
    }
    if (m.ok && it.action) {
      Sound.sfx('menuOk');
      it.action();
    } else if (m.ok && it.right) {
      it.right();
      Sound.sfx('menuMove');
    }
    if (m.back && this.onBack) {
      Sound.sfx('menuBack');
      this.onBack();
    }
  }
  draw(ctx) {
    this.items.forEach((it, i) => {
      const [x, y, w, h] = this.rect(i);
      const val = it.value ? it.value() : undefined;
      UI.button(ctx, x, y, w, h, it.label, i === this.sel, this.t, {
        color: it.color || this.colors[i % this.colors.length],
        value: val,
        size: this.size,
      });
    });
  }
}
