'use strict';
// ---------------------------------------------------------------------------
// Character select (1P / 2P / vs CPU) and stage select.
// ---------------------------------------------------------------------------

const P_COLORS = ['#ff4d6d', '#4dabff'];

class SelectScreen {
  constructor(session) {
    this.s = session;
    this.t = 0;
    this.ids = CHAR_ORDER.filter((id) => CHARS[id] && CHARS[id].moves);
    this.cols = 3;
    this.parts = new Particles();
    const mode = session.mode;
    this.single = mode !== 'vs';
    this.cursors = [this.mkCursor(0, session.p1)];
    if (mode !== 'arcade') this.cursors.push(this.mkCursor(1, null));
    if (this.single && this.cursors[1]) this.cursors[1].state = 'wait';
    this.doneT = -1;
    this.pups = {};
  }
  mkCursor(side, prev) {
    const idx = prev ? Math.max(0, this.ids.indexOf(prev.char)) : side === 0 ? 0 : Math.min(this.ids.length - 1, 2);
    return { side, idx, state: 'choose', pal: prev ? prev.pal : 0, pop: 0, roll: 0, flash: 0 };
  }
  enter() {
    Sound.playSong('select');
  }

  puppet(id, pal, side = 0) {
    const key = side + ':' + id + ':' + pal;
    if (!this.pups[key]) this.pups[key] = new Puppet(id, pal);
    return this.pups[key];
  }

  cardRect(i) {
    const w = 118, h = 128, gap = 16;
    const c = i % this.cols, r = Math.floor(i / this.cols);
    const rows = Math.ceil(this.ids.length / this.cols);
    const tw = this.cols * w + (this.cols - 1) * gap;
    const x = 640 - tw / 2 + c * (w + gap);
    const y = 168 + r * (h + gap) + (rows === 1 ? 70 : 0);
    return [x, y, w, h];
  }

  // which input drives a cursor
  inputFor(cur) {
    if (!this.single) return Input.menu(cur.side);
    return Input.menu(-1);
  }

  takenPal(cur, id) {
    // in mirror matches the second player can't share a palette
    const other = this.cursors[1 - cur.side];
    if (other && other.state !== 'choose' && other.state !== 'wait' && this.ids[other.idx] === id) return other.pal;
    return -1;
  }

  update() {
    this.t++;
    this.parts.update();
    for (const k in this.pups) this.pups[k].update();
    if (this.doneT >= 0) {
      this.doneT++;
      if (this.doneT === 50) this.finish();
      return;
    }
    // active cursor(s)
    const active = this.single ? this.cursors.filter((c) => c.state !== 'wait' && c.state !== 'ready').slice(0, 1) : this.cursors.filter((c) => c.state !== 'ready');
    for (const cur of active) this.updateCursor(cur);
    // mouse (player 1 / the active single cursor)
    this.mouse(active);
    // backing out of the screen
    if (this.single && active.length === 0 && this.cursors.every((c) => c.state === 'ready')) this.allReady();
    if (!this.single && this.cursors.every((c) => c.state === 'ready')) this.allReady();
    for (const c of this.cursors) {
      if (c.pop > 0) c.pop--;
      if (c.flash > 0) c.flash--;
    }
  }

  updateCursor(cur) {
    const m = this.inputFor(cur);
    const n = this.ids.length;
    if (cur.roll > 0) {
      cur.roll--;
      if (cur.roll % 3 === 0) {
        cur.idx = Math.floor(Math.random() * n);
        Sound.sfx('menuMove', { vol: 0.5 });
      }
      if (cur.roll === 0) this.confirmChar(cur);
      return;
    }
    if (cur.state === 'choose') {
      const c = cur.idx % this.cols, r = Math.floor(cur.idx / this.cols);
      const rows = Math.ceil(n / this.cols);
      let ni = cur.idx;
      if (m.left) ni = r * this.cols + ((c - 1 + this.cols) % this.cols);
      if (m.right) ni = r * this.cols + ((c + 1) % this.cols);
      if (m.up || m.down) ni = ((r + (m.down ? 1 : rows - 1)) % rows) * this.cols + c;
      if (ni >= n) ni = n - 1;
      if (ni !== cur.idx) {
        cur.idx = ni;
        cur.pop = 8;
        Sound.sfx('menuMove');
      }
      if (m.ok) this.confirmChar(cur);
      else if (m.alt) cur.roll = 24;
      else if (m.back) this.back(cur);
    } else if (cur.state === 'palette') {
      if (m.left) this.stepPal(cur, -1);
      if (m.right) this.stepPal(cur, 1);
      if (m.ok) this.confirmPal(cur);
      if (m.back) {
        cur.state = 'choose';
        Sound.sfx('menuBack');
      }
    }
  }

  stepPal(cur, d) {
    const id = this.ids[cur.idx];
    const np = CHARS[id].palettes.length;
    const taken = this.takenPal(cur, id);
    let p = cur.pal;
    for (let k = 0; k < np; k++) {
      p = (p + d + np) % np;
      if (p !== taken) break;
    }
    cur.pal = p;
    Sound.sfx('menuMove');
  }

  confirmPal(cur) {
    cur.state = 'ready';
    cur.flash = 16;
    Sound.sfx('select');
    this.puppet(this.ids[cur.idx], cur.pal, cur.side).play('win', 4);
    this.burst(cur);
    if (this.single && cur.side === 0 && this.cursors[1]) this.cursors[1].state = 'choose';
  }

  confirmChar(cur) {
    const id = this.ids[cur.idx];
    cur.state = 'palette';
    const taken = this.takenPal(cur, id);
    if (cur.pal >= CHARS[id].palettes.length) cur.pal = 0;
    if (cur.pal === taken) cur.pal = (cur.pal + 1) % CHARS[id].palettes.length;
    Sound.sfx('menuOk');
    cur.flash = 10;
  }

  back(cur) {
    Sound.sfx('menuBack');
    if (this.single && cur.side === 1) {
      // back to player 1's palette choice
      cur.state = 'wait';
      this.cursors[0].state = 'palette';
      return;
    }
    Flow.title();
  }

  mouse(active) {
    const ms = Input.mouse;
    if (!ms.moved && !ms.clicked) return;
    const cur = this.single ? active[0] : this.cursors[0];
    if (!cur || cur.state !== 'choose') {
      if (cur && cur.state === 'palette' && ms.clicked) {
        // the ◀ ▶ arrows under the preview change color; anywhere else confirms
        const x = cur.side === 0 ? 220 : 1060;
        const arrow = ms.y > 606 && ms.y < 676 ? (Math.abs(ms.x - (x - 132)) < 52 ? -1 : Math.abs(ms.x - (x + 132)) < 52 ? 1 : 0) : 0;
        if (arrow) this.stepPal(cur, arrow);
        else this.confirmPal(cur);
        ms.clicked = false;
      }
      ms.moved = false;
      return;
    }
    for (let i = 0; i < this.ids.length; i++) {
      if (UI.inRect(ms.x, ms.y, this.cardRect(i))) {
        if (cur.idx !== i) {
          cur.idx = i;
          cur.pop = 8;
          Sound.sfx('menuMove');
        }
        if (ms.clicked) this.confirmChar(cur);
      }
    }
    ms.moved = false;
    ms.clicked = false;
  }

  burst(cur) {
    const x = cur.side === 0 ? 220 : 1060;
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const sp = 4 + Math.random() * 8;
      this.parts.add({ type: Math.random() < 0.5 ? 'star' : 'shard', x, y: 380, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 0.25, drag: 0.98, size: 7 + Math.random() * 7, life: 60 + Math.random() * 30, color: U.choose(UI.colors), rot: Math.random() * TAU, vr: 0.2 });
    }
  }

  allReady() {
    if (this.doneT < 0) {
      this.doneT = 0;
      Sound.sfx('fight', { vol: 0.6 });
    }
  }

  finish() {
    const s = this.s;
    const c0 = this.cursors[0];
    s.p1 = { char: this.ids[c0.idx], pal: c0.pal };
    if (this.cursors[1]) {
      const c1 = this.cursors[1];
      s.p2 = { char: this.ids[c1.idx], pal: c1.pal };
    }
    Flow.charsChosen();
  }

  // ---- rendering -----------------------------------------------------------------
  render(ctx) {
    const t = this.t;
    UI.stripes(ctx, t, '#3a1e63', '#432470', 64, 0.5);
    UI.dots(ctx, '#ff8ac4', 0.07, 26, t);
    // side glows in the hovered characters' colors
    this.cursors.forEach((cur) => {
      const C = CHARS[this.ids[cur.idx]];
      const x = cur.side === 0 ? 220 : 1060;
      const g = ctx.createRadialGradient(x, 380, 20, x, 380, 330);
      g.addColorStop(0, U.rgba(C.color, 0.55));
      g.addColorStop(1, U.rgba(C.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - 340, 40, 680, 680);
    });
    const title = this.s.mode === 'arcade' ? 'ARCADE: CHOOSE YOUR FIGHTER!' : this.s.mode === 'training' ? 'TRAINING: CHOOSE FIGHTERS' : 'CHOOSE YOUR FIGHTER!';
    UI.header(ctx, title, 62, t, '#ff5a7a', 46);

    // previews
    for (const cur of this.cursors) this.drawPreview(ctx, cur);
    // grid
    for (let i = 0; i < this.ids.length; i++) this.drawCard(ctx, i);
    // description of the most relevant cursor
    const focus = this.single ? this.cursors.find((c) => c.state === 'choose' || c.state === 'palette') || this.cursors[0] : this.cursors[0];
    this.drawInfo(ctx, focus);
    this.parts.draw(ctx, 0, 0, 0);
    this.parts.draw(ctx, 0, 0, 1);
    if (this.doneT >= 0) {
      const k = U.ease.back(Math.min(1, this.doneT / 14));
      ctx.save();
      ctx.translate(640, 360);
      ctx.scale(k, k);
      ctx.rotate(-0.06);
      Draw.text(ctx, 'READY!', 0, 0, { size: 120, fill: '#ffd23f', lw: 14, extrude: 8, extrudeColor: '#c2410c' });
      ctx.restore();
    }
    const hint = this.single
      ? 'MOVE: WASD/ARROWS   PICK: J/ENTER   RANDOM: L   BACK: K/ESC'
      : 'P1: WASD + J (pick) K (back) L (random)     P2: ARROWS + NUM1 (pick) NUM2 (back) NUM3 (random)';
    UI.hint(ctx, hint, 704, 'TAP A FIGHTER, THEN TAP ◀ ▶ FOR COLORS AND TAP AGAIN TO CONFIRM');
  }

  drawCard(ctx, i) {
    const [x, y, w, h] = this.cardRect(i);
    const id = this.ids[i];
    const C = CHARS[id];
    const on = this.cursors.filter((c) => c.idx === i && c.state !== 'wait');
    const hot = on.length > 0;
    const pop = on.reduce((a, c) => Math.max(a, c.pop), 0);
    const s = hot ? 1.06 + pop * 0.012 : 1;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2 - (hot ? 4 : 0));
    ctx.scale(s, s);
    ctx.rotate(hot ? Math.sin(this.t * 0.08 + i) * 0.02 : 0);
    const bx = -w / 2, by = -h / 2;
    Draw.roundRect(ctx, bx + 4, by + 7, w, h, 16, 'rgba(10,4,20,0.45)', 0);
    Draw.roundRect(ctx, bx, by, w, h, 16, hot ? C.color : U.mix(C.color, '#2d1f45', 0.45), 5);
    ctx.save();
    ctx.beginPath();
    Draw.roundRectPath(ctx, bx + 3, by + 3, w - 6, h - 6, 13);
    ctx.clip();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    for (let k = -4; k < 8; k++) ctx.fillRect(bx + k * 26 + ((this.t * 0.4) % 26), by - 20, 10, h + 40);
    ctx.globalAlpha = 1;
    Portrait.head(ctx, C, C.palettes[0], 0, -8, 40, 1, hot ? 'happy' : 'normal', this.t + i * 40);
    ctx.fillStyle = INK;
    ctx.fillRect(bx, h / 2 - 30, w, 30);
    ctx.restore();
    Draw.roundRect(ctx, bx, by, w, h, 16, null, 5);
    Draw.text(ctx, C.name, 0, h / 2 - 15, { size: 22, fill: hot ? '#ffffff' : '#cbbbe6', lw: 0 });
    ctx.restore();
    // cursor frames + tags
    on.forEach((cur, k) => {
      const col = this.single && cur.side === 1 ? '#9aa7c7' : P_COLORS[cur.side];
      const label = this.single && cur.side === 1 ? 'CPU' : cur.side === 0 ? '1P' : '2P';
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2 - 4);
      ctx.scale(s, s);
      ctx.lineWidth = 6;
      ctx.strokeStyle = col;
      ctx.setLineDash(on.length > 1 ? [18, 12] : []);
      ctx.lineDashOffset = k * 15 + this.t * 0.5;
      ctx.beginPath();
      Draw.roundRectPath(ctx, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 20);
      ctx.stroke();
      ctx.restore();
      const tx = x + (on.length > 1 ? (k === 0 ? w * 0.28 : w * 0.72) : w / 2);
      const ty = y - 16 + Math.sin(this.t * 0.15 + k) * 3;
      Draw.roundRect(ctx, tx - 26, ty - 14, 52, 26, 10, col, 4);
      Draw.text(ctx, label, tx, ty, { size: 18, fill: '#ffffff', lw: 4 });
    });
  }

  drawPreview(ctx, cur) {
    if (cur.state === 'wait') {
      // CPU opponent not chosen yet
      const x = 1060;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.t * 0.08);
      Draw.text(ctx, '?', x, 380, { size: 180, fill: '#5a4482', lw: 12 });
      ctx.restore();
      Draw.text(ctx, 'CPU', x, 560, { size: 40, fill: '#9aa7c7', lw: 8 });
      return;
    }
    const id = this.ids[cur.idx];
    const C = CHARS[id];
    const L = cur.side === 0;
    const x = L ? 220 : 1060;
    const pal = cur.state === 'choose' ? 0 : cur.pal;
    const p = this.puppet(id, pal, cur.side);
    const scale = 1.32 * (C.selectScale || 1);
    // podium
    Draw.ellipse(ctx, x, 532, 150, 30, 0, U.shade(C.color, -0.35), 5);
    Draw.ellipse(ctx, x, 526, 150, 30, 0, C.color, 5);
    ctx.save();
    ctx.globalAlpha = 0.3;
    Draw.ellipse(ctx, x - 30, 518, 70, 10, 0, '#ffffff', 0);
    ctx.restore();
    ctx.save();
    if (cur.flash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = cur.flash * 3;
    }
    p.draw(ctx, x, 528, scale, L ? 1 : -1);
    ctx.restore();
    // name plate
    const ny = 584;
    ctx.save();
    ctx.translate(x, ny);
    ctx.rotate(L ? -0.03 : 0.03);
    Draw.roundRect(ctx, -170, -34, 340, 68, 16, INK, 0);
    Draw.roundRect(ctx, -164, -28, 328, 56, 12, C.color, 4);
    Draw.text(ctx, C.name, 0, 2, { size: 50, fill: '#ffffff', lw: 10, extrude: 4, extrudeColor: INK });
    ctx.restore();
    // style + palette / ready
    if (cur.state === 'palette') {
      const n = C.palettes.length;
      const a = 0.6 + 0.4 * Math.sin(this.t * 0.2);
      if (Touch.active) {
        // big tappable arrows
        for (const d of [-1, 1]) {
          Draw.circle(ctx, x + d * 132, 640, 26, '#ffd23f', 4);
          Draw.text(ctx, d < 0 ? '◀' : '▶', x + d * 132 + d * 2, 642, { size: 24, fill: INK, lw: 0 });
        }
        Draw.text(ctx, 'COLOR ' + (cur.pal + 1) + '/' + n, x, 640, { size: 26, fill: '#ffd23f', lw: 6 });
      } else Draw.text(ctx, '◀  COLOR ' + (cur.pal + 1) + '/' + n + '  ▶', x, 640, { size: 26, fill: '#ffd23f', lw: 6, alpha: a });
    } else if (cur.state === 'ready') {
      Draw.text(ctx, 'READY!', x, 640, { size: 32, fill: '#8cff8a', lw: 7 });
    } else {
      Draw.roundRect(ctx, x - 90, 624, 180, 32, 16, '#1d1428', 3);
      Draw.text(ctx, C.style, x, 641, { size: 20, fill: C.color === '#7a5cff' ? '#c4b4ff' : U.shade(C.color, 0.3), lw: 0 });
    }
    // corner tag
    const tag = this.single && cur.side === 1 ? 'CPU' : cur.side === 0 ? 'P1' : 'P2';
    Draw.text(ctx, tag, L ? 44 : 1236, 140, { size: 40, fill: this.single && cur.side === 1 ? '#9aa7c7' : P_COLORS[cur.side], lw: 8, align: L ? 'left' : 'right' });
  }

  drawInfo(ctx, cur) {
    const C = CHARS[this.ids[cur.idx]];
    const x = 452, y = 462, w = 376, h = 214;
    UI.panel(ctx, x, y, w, h, '#2a1b44');
    Draw.text(ctx, C.title || '', x + w / 2, y + 26, { size: 18, font: FONT_UI, fill: '#ffd23f', lw: 4 });
    const lines = Draw.wrap(ctx, C.desc || '', w - 36, 15, FONT_UI, 600);
    lines.slice(0, 3).forEach((ln, i) => Draw.text(ctx, ln, x + w / 2, y + 52 + i * 19, { size: 15, font: FONT_UI, fill: '#efe6ff', lw: 0, weight: 600 }));
    const st = C.ui || {};
    const rows = [['POWER', st.power || 3], ['SPEED', st.speed || 3], ['RANGE', st.range || 3], ['DIFFICULTY', st.difficulty || 3]];
    rows.forEach(([lab, v], i) => {
      const ry = y + 118 + i * 23;
      Draw.text(ctx, lab, x + 22, ry + 8, { size: 14, font: FONT_UI, fill: '#cbbbe6', lw: 0, align: 'left' });
      UI.bar(ctx, x + 130, ry, 220, 17, v, 5, i === 3 ? '#ff9a3c' : C.color);
    });
  }
}

// ---------------------------------------------------------------------------
class StageSelectScreen {
  constructor(session) {
    this.s = session;
    this.t = 0;
    this.ids = STAGE_ORDER.filter((id) => STAGES[id]);
    this.items = this.ids.concat(['random']);
    const prev = session.stage ? this.items.indexOf(session.stage) : 0;
    this.sel = Math.max(0, prev);
    this.thumbs = {};
    this.done = false;
  }
  enter() {
    Sound.playSong('select');
  }
  rect(i) {
    const w = 300, h = 169, gap = 26;
    if (i >= this.ids.length) return [640 - 130, 568, 260, 50];
    const c = i % 3, r = Math.floor(i / 3);
    return [640 - (3 * w + 2 * gap) / 2 + c * (w + gap), 124 + r * (h + 48), w, h];
  }
  thumb(id) {
    if (this.thumbs[id]) return this.thumbs[id];
    const k = 0.5;
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 360;
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    try {
      g.save();
      g.translate(640, GROUND_Y);
      g.scale(WORLD_ZOOM, WORLD_ZOOM);
      g.translate(-640, -GROUND_Y);
      STAGES[id].draw(g, { x: STAGE_W / 2, y: 0, zoom: 1, shake: 0, sx: 0, sy: 0 }, 200, null);
      g.restore();
    } catch (e) {
      g.fillStyle = '#333';
      g.fillRect(0, 0, 1280, 720);
    }
    this.thumbs[id] = c;
    return c;
  }
  update() {
    this.t++;
    if (this.done) return;
    // build one thumbnail per frame so the screen appears instantly
    for (const id of this.ids) {
      if (!this.thumbs[id]) {
        this.thumb(id);
        break;
      }
    }
    const m = Input.menu(-1);
    const n = this.items.length;
    const s = gridNav(this.sel, m, this.ids.length, 3);
    if (s !== this.sel) {
      this.sel = s;
      Sound.sfx('menuMove');
    }
    const ms = Input.mouse;
    if (ms.moved || ms.clicked) {
      for (let i = 0; i < n; i++) {
        if (UI.inRect(ms.x, ms.y, this.rect(i))) {
          if (this.sel !== i) {
            this.sel = i;
            Sound.sfx('menuMove');
          }
          if (ms.clicked) m.ok = true;
        }
      }
      ms.moved = ms.clicked = false;
    }
    if (m.ok) {
      this.done = true;
      Sound.sfx('select');
      let id = this.items[this.sel];
      if (id === 'random') id = U.choose(this.ids);
      Flow.stageChosen(id);
    } else if (m.back) {
      Sound.sfx('menuBack');
      Flow.toSelect();
    }
  }
  render(ctx) {
    const t = this.t;
    UI.stripes(ctx, t, '#1f3a5f', '#24436c', 64, 0.5);
    UI.dots(ctx, '#7fe3ff', 0.06, 26, t);
    UI.header(ctx, 'PICK A STAGE!', 62, t, '#36d6c3', 46);
    this.items.forEach((id, i) => {
      const [x, y, w, h] = this.rect(i);
      const sel = i === this.sel;
      const s = sel ? 1.05 : 1;
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(s, s);
      ctx.rotate(sel ? Math.sin(t * 0.07) * 0.01 : 0);
      if (id === 'random') {
        UI.button(ctx, -w / 2, -h / 2, w, h, 'RANDOM', sel, t, { color: '#ff9a3c', pointer: false });
        ctx.restore();
        return;
      }
      Draw.roundRect(ctx, -w / 2 + 5, -h / 2 + 8, w, h, 14, 'rgba(5,10,25,0.5)', 0);
      ctx.save();
      ctx.beginPath();
      Draw.roundRectPath(ctx, -w / 2, -h / 2, w, h, 14);
      ctx.clip();
      const th = this.thumbs[id];
      if (th) ctx.drawImage(th, -w / 2, -h / 2, w, h);
      else {
        const S = STAGES[id];
        const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        g.addColorStop(0, S.thumbColors ? S.thumbColors[1] : '#333');
        g.addColorStop(1, S.thumbColors ? S.thumbColors[0] : '#555');
        ctx.fillStyle = g;
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      if (!sel) {
        ctx.fillStyle = 'rgba(20,10,40,0.35)';
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      ctx.restore();
      Draw.roundRect(ctx, -w / 2, -h / 2, w, h, 14, null, sel ? 7 : 5, sel ? '#ffd23f' : INK);
      ctx.restore();
      Draw.text(ctx, STAGES[id].name.toUpperCase(), x + w / 2, y + h + 22, { size: 22, fill: sel ? '#ffd23f' : '#ffffff', lw: 6 });
    });
    const id = this.items[this.sel];
    const info = id === 'random' ? 'Let fate decide!' : '♪ Now playing on this stage: ' + (STAGE_SONG_NAMES[STAGES[id].music] || STAGES[id].music);
    Draw.text(ctx, info, 640, 652, { size: 20, font: FONT_UI, fill: '#e8fbff', lw: 5 });
    UI.hint(ctx, 'MOVE: WASD/ARROWS   PICK: J/ENTER   BACK: K/ESC', 704, 'TAP A STAGE');
  }
}

// Navigate a grid of `count` cells (cols wide) plus one extra button below it
// (index === count).
function gridNav(sel, m, count, cols) {
  const rows = Math.ceil(count / cols);
  if (sel >= count) {
    if (m.up) return Math.min(count - 1, (rows - 1) * cols + Math.floor(cols / 2));
    if (m.down) return Math.min(count - 1, Math.floor(cols / 2));
    return sel;
  }
  const c = sel % cols, r = Math.floor(sel / cols);
  const rowLen = Math.min(cols, count - r * cols);
  if (m.left) return r * cols + ((c - 1 + rowLen) % rowLen);
  if (m.right) return r * cols + ((c + 1) % rowLen);
  if (m.down) return r + 1 < rows ? Math.min(count - 1, sel + cols) : count;
  if (m.up) return r > 0 ? sel - cols : count;
  return sel;
}

const STAGE_SONG_NAMES = {
  rooftop: 'Rooftop Rumble', candy: 'Sugar Rush', arena: 'Main Event', neon: 'Neon Nights', bamboo: 'Moonlit Blades', teahouse: 'Tea for Two Hundred',
};
