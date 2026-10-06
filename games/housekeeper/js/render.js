// Pixel renderer. Everything is drawn at 480x320 with integer rectangles and sprites,
// then scaled up by CSS with `image-rendering: pixelated`.
(function () {
  const T = HS.TILE, W = HS.W, H = HS.H;
  const LIGHT_SCALE = 4; // lighting is computed at 1/4 resolution for chunky pixel shadows

  let ctx = null;
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  HS.Render = {
    t: 0,
    bg: null,
    dark: null,
    dctx: null,

    init(canvas) {
      ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      this.dark = document.createElement('canvas');
      this.dark.width = W / LIGHT_SCALE;
      this.dark.height = H / LIGHT_SCALE;
      this.dctx = this.dark.getContext('2d');
    },

    camY: 0,
    history: [],

    // The house is taller than the screen: the view follows you up and down.
    updateCamera(dt) {
      const target = Math.max(0, Math.min(HS.MAP_H - H, HS.Player.y - H / 2));
      if (Math.abs(target - this.camY) > H) this.camY = target;
      else this.camY += (target - this.camY) * Math.min(1, dt * 6);
      this.camYi = Math.round(this.camY);
    },

    // Floors + walls never change, so bake them once.
    bakeBackground() {
      this.bg = document.createElement('canvas');
      this.bg.width = W;
      this.bg.height = HS.MAP_H;
      const main = ctx;
      ctx = this.bg.getContext('2d');
      this.floors();
      this.walls();
      ctx = main;
    },

    draw(dt) {
      this.t += dt;
      const G = HS.Game;
      if (G.shakeT > 0) G.shakeT -= dt;
      if (!this.bg) this.bakeBackground();
      this.updateCamera(dt);
      // Remember where you've been for the last moment (the mirror is a little behind).
      const Pl = HS.Player;
      this.history.push({ x: Pl.x, y: Pl.y, fx: Pl.face.x, fy: Pl.face.y, t: this.t });
      while (this.history.length > 2 && this.history[0].t < this.t - 1.5) this.history.shift();

      ctx.save();
      R('#1d1629', 0, 0, W, H);
      if (G.shakeT > 0) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));
      ctx.save();
      ctx.translate(0, -this.camYi);
      ctx.drawImage(this.bg, 0, 0);

      const objs = HS.Map.objects.filter(o => o.visible)
        .sort((a, b) => (a.layer - b.layer) || ((a.y + a.h) - (b.y + b.h)));
      const P = HS.Player;
      let playerDrawn = false;
      for (const o of objs) {
        // Draw the player in depth order (behind things lower on screen).
        if (!playerDrawn && o.layer > 0 && (o.y + o.h) * T > P.y + 4 && P.sitting !== o) { this.player(); playerDrawn = true; }
        this.obj(o);
        if (P.sitting === o) { this.player(); playerDrawn = true; }
      }
      if (!playerDrawn) this.player();
      this.otherYou();
      this.daytimeShadow();
      ctx.restore();

      this.lighting();
      ctx.save();
      ctx.translate(0, -this.camYi);
      this.inTheDark();
      ctx.restore();
      this.effects();
      ctx.restore();
    },

    // ---------- background ----------
    floors() {
      R('#d9c4a3', T, T, W - 2 * T, HS.MAP_H - 2 * T);
      for (const r of HS.Map.rooms) {
        const x = r.x * T, y = r.y * T, w = r.w * T, h = r.h * T;
        R(r.color, x, y, w, h);
        ctx.fillStyle = r.alt;
        if (r.pattern === 'checker') {
          for (let ty = 0; ty < r.h * 2; ty++)
            for (let tx = 0; tx < r.w * 2; tx++)
              if ((tx + ty) % 2) ctx.fillRect(x + tx * 8, y + ty * 8, 8, 8);
        } else if (r.pattern === 'planks') {
          for (let ty = 0; ty < r.h * 4; ty++) {
            ctx.fillRect(x, y + ty * 4 + 3, w, 1);
            for (let px = (ty % 3) * 9; px < w; px += 27) ctx.fillRect(x + px, y + ty * 4, 1, 3);
          }
        } else if (r.pattern === 'tile') {
          for (let tx = 0; tx < r.w; tx++) ctx.fillRect(x + tx * T, y, 1, h);
          for (let ty = 0; ty < r.h; ty++) ctx.fillRect(x, y + ty * T, w, 1);
        } else if (r.pattern === 'carpet') {
          for (let i = 0; i < r.w * r.h * 6; i++) {
            const a = Math.abs(Math.sin(i * 12.9898 + r.x) * 43758.5453) % 1;
            const b = Math.abs(Math.sin(i * 78.233 + r.y) * 12345.678) % 1;
            ctx.fillRect(x + Math.floor(a * w), y + Math.floor(b * h), 1, 1);
          }
        }
      }
    },

    walls() {
      const g = HS.Map.grid;
      for (let y = 0; y < HS.MAP_ROWS; y++) {
        for (let x = 0; x < HS.COLS; x++) {
          if (g[y][x] !== '#') continue;
          R('#3d3150', x * T, y * T, T, T);
          R('#463a5c', x * T, y * T, T, 1);
          if (y + 1 < HS.MAP_ROWS && g[y + 1][x] === '.') {
            R('#6d5a86', x * T, y * T + 11, T, 5);
            R('#8a77a6', x * T, y * T + 11, T, 1);
            R('#58486e', x * T, y * T + 15, T, 1);
          }
        }
      }
    },

    // ---------- objects ----------
    obj(o) {
      const x = Math.round(o.x * T), y = Math.round(o.y * T), w = o.w * T, h = o.h * T, t = this.t;
      const G = HS.Game, RB = HS.Rulebook, S = HS.Sprites, PAL = S.PAL;
      const cx = x + w / 2;
      const blink = Math.floor(t * 3) % 2 === 0;

      switch (o.kind) {
        case 'rug':
          R(o.color, x + 2, y + 2, w - 4, h - 4);
          R('rgba(255,255,255,.3)', x + 4, y + 4, w - 8, 1);
          R('rgba(255,255,255,.3)', x + 4, y + h - 5, w - 8, 1);
          R('rgba(255,255,255,.3)', x + 4, y + 4, 1, h - 8);
          R('rgba(255,255,255,.3)', x + w - 5, y + 4, 1, h - 8);
          break;

        case 'sprite':
          S.draw(ctx, o.sprite, cx, y + h, o.flip);
          break;

        case 'item':
          if (blink) R('rgba(255,255,200,.5)', x + 3, y + 3, 10, 10);
          S.draw(ctx, o.sprite, cx, y + h - (Math.floor(t * 2) % 2), false);
          break;

        case 'bowl':
          S.draw(ctx, 'bowl', cx, y + h);
          break;

        case 'fern':
          if (o.big) S.draw(ctx, 'fern', cx, y + h, false, 2);
          else S.draw(ctx, 'fern', cx, y + h);
          break;

        case 'fridge': {
          R(PAL.k, x + 1, y, 14, 32);
          R(PAL.W, x + 2, y + 1, 12, 30);
          R(PAL.g, x + 2, y + 11, 12, 1);
          R(PAL.g, x + 2, y + 29, 12, 2);
          R(PAL.G, x + 11, y + 4, 1, 5);
          R(PAL.G, x + 11, y + 14, 1, 9);
          // The note itself, blinking until read today.
          R(!G.noteRead && blink ? PAL.w : PAL.y, x + 4, y + 15, 5, 6);
          R(PAL.Y, x + 5, y + 17, 3, 1);
          R(PAL.Y, x + 5, y + 19, 2, 1);
          if (RB.get('fridge').state === 'humming') {
            for (let i = 0; i < 2; i++) {
              const p = (t * 0.7 + i / 2) % 1;
              S.draw(ctx, 'music', x + 18 + i * 5, y + 12 - p * 14);
            }
          }
          break;
        }

        case 'counter':
          R(PAL.k, x, y, w, h);
          R(PAL.L, x + 1, y + 1, w - 2, 9);
          R(PAL.N, x + 1, y + 10, w - 2, 5);
          R(PAL.G, x + 17, y + 2, 14, 7);
          R(PAL.k, x + 19, y + 3, 3, 2); R(PAL.k, x + 26, y + 3, 3, 2);
          R(PAL.k, x + 19, y + 6, 3, 2); R(PAL.k, x + 26, y + 6, 3, 2);
          R(PAL.w, x + 45, y + 3, 4, 5); R(PAL.r, x + 46, y + 4, 2, 2);
          break;

        case 'ksink':
          R(PAL.k, x, y, w, h);
          R(PAL.L, x + 1, y + 1, w - 2, 9);
          R(PAL.N, x + 1, y + 10, w - 2, 5);
          R(PAL.G, x + 3, y + 3, 10, 6);
          R(PAL.c, x + 4, y + 4, 8, 4);
          R(PAL.g, x + 7, y + 1, 2, 3);
          if (RB.on('dishes') && RB.status.dishes === 'pending') { R(PAL.w, x + 5, y + 4, 4, 3); R(PAL.r, x + 6, y + 5, 2, 1); }
          break;

        case 'shelf': {
          R(PAL.k, x, y, w, h);
          R(PAL.N, x + 1, y + 1, w - 2, h - 2);
          R(PAL.n, x + 1, y + 7, w - 2, 1);
          const books = [PAL.r, PAL.C, PAL.v, PAL.y, PAL.p, PAL.o, PAL.c, PAL.m];
          for (let i = 0; i < 7; i++) {
            R(books[i % 8], x + 2 + i * 4, y + 2 + (i % 3 === 0 ? 1 : 0), 3, 5 - (i % 3 === 0 ? 1 : 0));
            R(books[(i + 3) % 8], x + 2 + i * 4, y + 9 + (i % 2), 3, 5 - (i % 2));
          }
          break;
        }

        case 'table':
          R(PAL.k, x + 1, y + 2, w - 2, h - 4);
          R(PAL.n, x + 2, y + 3, w - 4, h - 8);
          R(PAL.l, x + 2, y + 3, w - 4, 2);
          R(PAL.N, x + 2, y + h - 5, w - 4, 3);
          R(PAL.k, x + 22, y + 10, 5, 7); R(PAL.c, x + 23, y + 11, 3, 5);
          R(PAL.m, x + 21, y + 7, 3, 3); R(PAL.r, x + 25, y + 6, 3, 3); R(PAL.v, x + 24, y + 9, 1, 2);
          break;

        case 'chair5': {
          const following = RB.get('chair').state === 'following';
          const wob = following ? Math.round(Math.sin(t * 20)) : 0;
          S.draw(ctx, 'chair', cx + wob, y + h);
          break;
        }

        case 'painting':
          this.painting(x, y);
          break;

        case 'tv': {
          R(PAL.G, x + 13, y + 13, 6, 3);
          R(PAL.k, x + 1, y, 30, 14);
          R(PAL.e, x + 3, y + 2, 26, 10);
          const st = RB.get('tv').state;
          if (st === 'on' || st === 'watching') {
            for (let i = 0; i < 60; i++) {
              const v = Math.floor(Math.random() * 200) + 55;
              R(`rgb(${v},${v},${v})`, x + 3 + Math.floor(Math.random() * 26), y + 2 + Math.floor(Math.random() * 10), 1, 1);
            }
            if (st === 'watching') { R(PAL.o, x + 12, y + 5, 8, 4); R(PAL.w, x + 13, y + 4, 6, 1); }
            if (HS.Clock.hour() >= 21 && G.day >= 3 && Math.floor(t / 2) % 3 === 0) {
              R(PAL.e, x + 11, y + 4, 3, 2); R(PAL.e, x + 18, y + 4, 3, 2); R(PAL.e, x + 14, y + 8, 4, 3);
            }
          } else {
            R(PAL.G, x + 4, y + 3, 3, 1);
          }
          break;
        }

        case 'couch':
          R(PAL.k, x, y - 5, w, h + 5);
          R(PAL.R, x + 1, y - 4, w - 2, 7);
          R(PAL.r, x + 1, y + 3, w - 2, h - 4);
          R(PAL.R, x + 16, y + 3, 1, h - 4); R(PAL.R, x + 32, y + 3, 1, h - 4);
          R(PAL.R, x + 1, y - 4, 4, h + 3); R(PAL.R, x + w - 5, y - 4, 4, h + 3);
          break;

        case 'armchair':
          R(PAL.k, x + 1, y, 14, 16);
          R(PAL.R, x + 2, y + 1, 12, 5);
          R(PAL.r, x + 2, y + 6, 12, 9);
          R(PAL.R, x + 2, y + 1, 2, 14); R(PAL.R, x + 12, y + 1, 2, 14);
          break;

        case 'bed':
          R(PAL.k, x + 1, y, w - 2, h);
          R(PAL.N, x + 2, y + 1, w - 4, h - 2);
          R(PAL.k, x + 4, y + 3, w - 8, 10);
          R(PAL.W, x + 5, y + 4, w - 10, 8);
          R(PAL.C, x + 3, y + 15, w - 6, h - 18);
          R(PAL.c, x + 3, y + 15, w - 6, 3);
          for (let i = 0; i < 4; i++) R(PAL.b, x + 7 + (i % 2) * 10, y + 23 + i * 6, 3, 2);
          break;

        case 'wardrobe':
          R(PAL.k, x, y, w, h);
          R(PAL.n, x + 1, y + 1, w - 2, h - 2);
          R(PAL.N, x + 16, y + 1, 1, h - 2);
          R(PAL.y, x + 13, y + 7, 2, 2); R(PAL.y, x + 18, y + 7, 2, 2);
          break;

        case 'phone': {
          const ringing = RB.get('phone').state === 'ringing';
          S.draw(ctx, 'phone', cx + (ringing && blink ? 1 : 0), y + h);
          if (ringing && blink) { R(PAL.y, x + 1, y + 2, 1, 3); R(PAL.y, x + 14, y + 2, 1, 3); }
          break;
        }

        case 'towel':
          S.draw(ctx, G.holding === 'towel' || RB.get('painting').state === 'covered' ? 'rack' : 'towel', cx, y + h);
          break;

        case 'mirror':
          this.mirror(x, y);
          break;

        case 'tub': {
          R(PAL.k, x, y + 2, w, h - 2);
          R(PAL.W, x + 1, y + 3, w - 2, h - 4);
          R(PAL.c, x + 3, y + 6, w - 6, h - 10);
          R(PAL.w, x + 5, y + 8, 6, 1);
          const n = RB.on('ducks') ? RB.get('ducks').count : 7;
          for (let i = 0; i < n; i++) {
            const dx = x + 4 + (i % 4) * 6, dy = y + 8 + Math.floor(i / 4) * 9 + (Math.floor(t * 2 + i) % 2);
            S.draw(ctx, 'duck', dx + 3, dy + 6);
          }
          break;
        }

        case 'washer': {
          const isWasher = o.id === 'washer';
          const stopped = isWasher && RB.get('washer').state === 'stopped';
          R(PAL.k, x + 1, y + 1, 14, 15);
          R(PAL.W, x + 2, y + 2, 12, 13);
          R(PAL.g, x + 2, y + 2, 12, 3);
          R(stopped ? (blink ? PAL.v : PAL.V) : PAL.G, x + 11, y + 3, 2, 1);
          R(PAL.G, x + 4, y + 6, 8, 8);
          R(PAL.c, x + 5, y + 7, 6, 6);
          if (isWasher && !stopped) {
            const a = t * 8;
            R(PAL.w, x + 7 + Math.round(Math.cos(a) * 2), y + 9 + Math.round(Math.sin(a) * 2), 2, 2);
          }
          break;
        }

        case 'bin':
          R(PAL.k, x + 2, y + 1, 12, 15);
          R(PAL.V, x + 3, y + 2, 10, 13);
          R(PAL.v, x + 3, y + 2, 10, 3);
          R(PAL.v, x + 5, y + 7, 1, 6); R(PAL.v, x + 10, y + 7, 1, 6);
          break;

        case 'boxes':
          R(PAL.k, x + 1, y + 12, 18, 20); R(PAL.l, x + 2, y + 13, 16, 18); R(PAL.y, x + 9, y + 13, 2, 18);
          R(PAL.k, x + 15, y + 16, 16, 16); R(PAL.L, x + 16, y + 17, 14, 14); R(PAL.y, x + 22, y + 17, 2, 14);
          R(PAL.k, x + 6, y + 2, 14, 12); R(PAL.L, x + 7, y + 3, 12, 10); R(PAL.N, x + 9, y + 6, 8, 1);
          break;

        case 'dust':
          R('#8a8070', x + 4, y + 10, 8, 3); R('#9a9080', x + 6, y + 8, 5, 2); R('#7a7060', x + 3, y + 12, 3, 1); R('#7a7060', x + 11, y + 11, 2, 1);
          break;

        case 'photo': {
          R(PAL.N, x + 3, y + 2, 10, 9);
          R(PAL.L, x + 4, y + 3, 8, 7);
          // Every day, another face is scratched out.
          const scratched = Math.min(4, G.day - 1);
          for (let i = 0; i < 4; i++) {
            const hx = x + 4 + i * 2;
            R(PAL.s, hx, y + 5, 1, 2); R(i % 2 ? PAL.C : PAL.r, hx, y + 7, 1, 2);
            if (i < scratched) R(PAL.k, hx, y + 4, 1, 4);
          }
          break;
        }

        case 'coats':
          R(PAL.N, x + 7, y, 2, 16);
          R(PAL.C, x + 2, y + 2, 5, 9); R(PAL.R, x + 9, y + 2, 5, 10); R(PAL.V, x + 5, y + 1, 6, 5);
          break;

        case 'desk': {
          R(PAL.k, x, y + 3, w, 13);
          R(PAL.n, x + 1, y + 4, w - 2, 11);
          R(PAL.l, x + 1, y + 4, w - 2, 3);
          R(PAL.k, cx - 7, y - 1, 14, 8); R(PAL.G, cx - 6, y, 12, 6); R(PAL.g, cx - 5, y + 1, 10, 2);
          R(PAL.w, cx - 4, y - 6, 8, 6); R(PAL.k, cx - 3, y - 4, 6, 1); R(PAL.k, cx - 3, y - 2, 4, 1);
          for (let i = 0; i < 5; i++) R(PAL.W, cx - 5 + i * 2, y + 4, 1, 1);
          R(PAL.y, x + w - 9, y - 3, 6, 3); R(PAL.k, x + w - 7, y, 1, 4);
          break;
        }

        case 'globe': {
          R(PAL.N, cx - 1, y + 11, 2, 4); R(PAL.N, cx - 4, y + 14, 8, 2);
          R(PAL.k, cx - 6, y + 1, 12, 11);
          R(PAL.C, cx - 5, y + 2, 10, 9);
          const off = Math.floor(t * 3) % 10;
          ctx.save(); ctx.beginPath(); ctx.rect(cx - 5, y + 2, 10, 9); ctx.clip();
          R(PAL.v, cx - 5 + off - 3, y + 4, 4, 3); R(PAL.v, cx - 5 + ((off + 5) % 10) - 2, y + 7, 3, 3);
          ctx.restore();
          break;
        }

        case 'fireplace': {
          R(PAL.k, x, y - 6, w, 22);
          R('#6b6b78', x + 1, y - 5, w - 2, 20);
          for (let i = 0; i < 4; i++) R('#55555f', x + 1, y - 2 + i * 4, w - 2, 1);
          R(PAL.e, x + 8, y + 1, 16, 14);
          if (RB.get('fire').out) { R('#3a2a2a', x + 9, y + 12, 14, 2); R(PAL.r, x + 14, y + 12, 1, 1); R(PAL.r, x + 18, y + 13, 1, 1); R(PAL.N, x - 1, y - 7, w + 2, 2); break; }
          for (let i = 0; i < 5; i++) {
            const fh = 4 + ((Math.floor(t * 10) + i * 3) % 6);
            R(i % 2 ? PAL.o : PAL.y, x + 10 + i * 2.5, y + 14 - fh, 2, fh);
          }
          R(PAL.r, x + 9, y + 12, 14, 2);
          R(PAL.N, x - 1, y - 7, w + 2, 2);
          break;
        }

        case 'crib': {
          R(PAL.N, x + 1, y + 3, w - 2, h - 4);
          R(PAL.W, x + 3, y + 6, w - 6, h - 10);
          R(PAL.m, x + 3, y + 15, w - 6, h - 19);
          for (let i = 0; i < 9; i++) R(PAL.n, x + 3 + i * 3.3, y + 4, 1, h - 6);
          // the mobile turns on its own
          R(PAL.k, cx, y - 6, 1, 6);
          const a = t * 1.2;
          [PAL.y, PAL.c, PAL.m].forEach((col, i) => R(col, cx + Math.round(Math.cos(a + i * 2.1) * 5) - 1, y - 2 + Math.round(Math.sin(a + i * 2.1)), 2, 2));
          break;
        }

        case 'horse': {
          // Rocks by itself at night. And for a while after you touch it.
          const rocking = HS.Clock.hour() >= 22 || (this.horseT && t - this.horseT < 4);
          const r = rocking ? Math.round(Math.sin(t * 4) * 1.5) : 0;
          R(PAL.N, x + 1, y + 13 + (r > 0 ? 0 : 1), 14, 2);
          R(PAL.l, x + 4, y + 6 + r, 8, 5);
          R(PAL.l, x + 10, y + 2 + r, 4, 5);
          R(PAL.N, x + 9, y + 2 + r, 2, 4);
          R(PAL.k, x + 12, y + 3 + r, 1, 1);
          R(PAL.l, x + 4, y + 11 + r, 1, 2); R(PAL.l, x + 11, y + 11 + r, 1, 2);
          R(PAL.N, x + 2, y + 6 + r, 2, 2);
          R(PAL.r, x + 6, y + 5 + r, 4, 2);
          break;
        }

        case 'blocks':
          R(PAL.r, x + 2, y + 9, 5, 5); R(PAL.C, x + 8, y + 9, 5, 5); R(PAL.y, x + 5, y + 4, 5, 5);
          R(PAL.w, x + 4, y + 11, 1, 1); R(PAL.w, x + 10, y + 11, 1, 1); R(PAL.w, x + 7, y + 6, 1, 1);
          break;

        case 'musicbox': {
          R(PAL.k, x + 3, y + 7, 10, 8);
          R(PAL.p, x + 4, y + 8, 8, 6);
          R(PAL.y, x + 4, y + 10, 8, 1);
          if (this.musicT && t - this.musicT < 4) {
            R(PAL.P, x + 4, y + 2, 8, 5);
            const b = Math.floor(t * 4) % 2;
            R(PAL.m, x + 7, y + 4 + b, 2, 3); R(PAL.s, x + 7, y + 3 + b, 2, 1);
          } else {
            R(PAL.P, x + 3, y + 6, 10, 2);
          }
          break;
        }

        case 'window': {
          const dark = HS.Clock.darkness() > 0.4;
          R(PAL.N, x + 1, y - 1, w - 2, 14);
          R(dark ? '#1b2340' : '#9fd4f0', x + 3, y + 1, w - 6, 10);
          if (dark) {
            R('#f3ecd0', x + 21, y + 2, 3, 3);
            // Something on the lawn, facing the house. Only sometimes.
            if (G.day >= 3 && Math.floor(t / 7) % 3 === 0) { R('#05030a', x + 8, y + 4, 3, 7); R('#05030a', x + 8, y + 2, 3, 2); }
          } else {
            R('#7cc06a', x + 3, y + 8, w - 6, 3);
          }
          R(PAL.N, x + 15, y + 1, 2, 10); R(PAL.N, x + 3, y + 5, w - 6, 1);
          if ((RB.get('curtains').closed || []).includes(o.id)) {
            R('#8f2a20', x + 2, y, w - 4, 12);
            for (let i = 0; i < 6; i++) R('#a83a3a', x + 3 + i * 5, y, 2, 12);
          }
          break;
        }

        case 'telescope':
          R(PAL.k, x + 7, y + 8, 1, 7);
          R(PAL.k, x + 4, y + 14, 1, 2); R(PAL.k, x + 10, y + 14, 1, 2);
          R(PAL.k, x + 5, y + 12, 1, 2); R(PAL.k, x + 9, y + 12, 1, 2);
          for (let i = 0; i < 6; i++) R(i < 2 ? PAL.y : PAL.G, x + 2 + i * 2, y + 7 - i, 3, 3);
          break;

        case 'door': {
          // Rattles in its frame while something knocks.
          const x = Math.round(o.x * T) + (G.effect('knocking') && Math.floor(t * 12) % 3 === 0 ? 1 : 0);
          R(PAL.k, x + 2, y, 12, h);
          R(PAL.n, x + 3, y + 1, 10, h - 2);
          R(PAL.N, x + 5, y + 4, 6, 9); R(PAL.N, x + 5, y + 18, 6, 9);
          R(PAL.y, x + 4, y + 15, 2, 2);
          if (RB.get('delivery').state === 'waiting' && blink) R(PAL.y, x + 6, y - 2, 4, 1);
          break;
        }

        case 'basement': {
          R(PAL.k, x + 1, y, 14, h);
          R('#2b2220', x + 2, y + 1, 12, h - 2);
          for (let i = 1; i < 5; i++) R('#3d302c', x + 2, y + i * 6, 12, 1);
          R(PAL.G, x + 3, y + 15, 2, 2);
          const glow = G.heartOpen ? PAL.y : G.basementOpen ? PAL.r : null;
          if (glow && (blink || G.heartOpen)) { R(glow, x + 13, y + 1, 1, h - 2); R(glow, x + 2, y + h - 2, 12, 1); }
          break;
        }
      }

      // Hidden lore page: an occasional sparkle.
      if (HS.Story.pageAt(o.id) >= 0 && Math.floor(t * 2) % 5 === 0) {
        R(PAL.w, x + w - 4, y + 1, 1, 3);
        R(PAL.w, x + w - 5, y + 2, 3, 1);
      }
    },

    // A cozy portrait of a sweet old woman. Her eyes follow you. Her smile has opinions.
    painting(x, y) {
      const G = HS.Game, U = HS.Uncanny, PAL = HS.Sprites.PAL, P = HS.Player;
      const L = x - 4, Tp = y + 1, cx = L + 12;
      R(PAL.k, L, Tp, 24, 15);
      R(PAL.Y, L + 1, Tp + 1, 22, 13);
      R(PAL.y, L + 1, Tp + 1, 22, 1);
      R('#3e5c48', L + 3, Tp + 3, 18, 9);
      R('#4a6b54', L + 3, Tp + 3, 18, 1);

      const st = HS.Rulebook.get('painting').state;
      if (st === 'covered') {
        R(PAL.m, L - 1, Tp - 1, 26, 17);
        R(PAL.w, L - 1, Tp + 4, 26, 2); R(PAL.w, L - 1, Tp + 10, 26, 2);
        return;
      }
      if (U.emptyT > 0) {
        // Just an empty armchair in a green room.
        R(PAL.R, cx - 3, Tp + 7, 6, 4); R(PAL.r, cx - 2, Tp + 8, 4, 2);
        return;
      }

      const mood = Math.min(4, Math.floor(G.chaos / 20));
      // cardigan + collar
      R('#7a3f8a', cx - 5, Tp + 10, 10, 2);
      R(PAL.w, cx - 1, Tp + 10, 2, 1);
      // hair (grey bun)
      R(PAL.g, cx - 2, Tp + 3, 4, 1);
      R(PAL.g, cx - 4, Tp + 4, 8, 1);
      R(PAL.W, cx - 1, Tp + 3, 1, 1);
      // face
      R(PAL.s, cx - 3, Tp + 5, 6, 5);
      R(PAL.g, cx - 4, Tp + 5, 1, 3); R(PAL.g, cx + 3, Tp + 5, 1, 3);
      R(PAL.S, cx - 3, Tp + 9, 6, 1);
      // eyes: follow you left/right, blink now and then
      if (U.blinking > 0) {
        R(PAL.S, cx - 3, Tp + 6, 2, 1); R(PAL.S, cx + 1, Tp + 6, 2, 1);
      } else {
        const off = P.x > (x + 8) ? 1 : 0;
        R(PAL.w, cx - 3, Tp + 6, 2, 1); R(PAL.w, cx + 1, Tp + 6, 2, 1);
        R(PAL.k, cx - 3 + off, Tp + 6, 1, 1); R(PAL.k, cx + 1 + off, Tp + 6, 1, 1);
      }
      // worried eyebrows once the house is upset (the smile doesn't change)
      if (mood >= 2) { R('#5d4a5a', cx - 2, Tp + 5, 1, 1); R('#5d4a5a', cx + 1, Tp + 5, 1, 1); }
      // rosy cheeks
      R(PAL.m, cx - 3, Tp + 7, 1, 1); R(PAL.m, cx + 2, Tp + 7, 1, 1);
      // mouth
      if (mood >= 4) {
        R(PAL.e, cx - 1, Tp + 7, 2, 3);
      } else {
        // A gentle U-shaped smile that stretches while you're away, eventually past the edges of her face.
        const half = 2 + Math.round(U.grin * 2); // 2..4
        const mouth = '#a8384a';
        R(mouth, cx - half + 1, Tp + 8, (half - 1) * 2, 1);
        R(mouth, cx - half, Tp + 7, 1, 1); R(mouth, cx + half - 1, Tp + 7, 1, 1);
        if (half >= 4) R(PAL.w, cx - half + 1, Tp + 7, (half - 1) * 2, 1); // teeth
      }
      if (st === 'crying') {
        const d = Math.floor(this.t * 6) % 3;
        R(PAL.c, cx - 3, Tp + 7 + d, 1, 1); R(PAL.c, cx + 2, Tp + 7 + ((d + 1) % 3), 1, 1);
      }
    },

    // Someone who looks exactly like you, standing very still in a doorway.
    otherYou() {
      const g = HS.Uncanny.ghost;
      if (!g) return;
      const P = HS.Player;
      const dx = P.x - g.x, dy = P.y - g.y;
      let dir = 'front', flip = false;
      if (Math.abs(dx) > Math.abs(dy)) { dir = 'side'; flip = dx < 0; } else if (dy < 0) dir = 'back';
      R('rgba(0,0,0,.25)', Math.round(g.x) - 5, Math.round(g.y) + 3, 10, 2);
      HS.Sprites.draw(ctx, `p_${dir}`, g.x, g.y + 4, flip);
    },

    // Where you were `lag` seconds ago.
    sampleHistory(lag) {
      const want = this.t - lag;
      let s = this.history[0];
      for (const h of this.history) { if (h.t <= want) s = h; else break; }
      return s;
    },

    // A proper mirror. Your reflection is in it… slightly behind you, and more behind each day.
    mirror(x, y) {
      const G = HS.Game, PAL = HS.Sprites.PAL, t = this.t, hour = HS.Clock.hour();
      R(PAL.k, x, y, 32, 16);
      R(PAL.Y, x + 1, y + 1, 30, 14);
      R(PAL.y, x + 1, y + 1, 30, 1);
      const gx = x + 3, gy = y + 3, gw = 26, gh = 10;
      R('#bfe6f2', gx, gy, gw, gh);
      R('#d3ecef', gx, gy + gh - 3, gw, 3);
      R('#b5dbe1', gx + 6, gy + gh - 3, 1, 3); R('#b5dbe1', gx + 18, gy + gh - 3, 1, 3);

      let lag = G.day >= 4 ? 0.4 : G.day >= 2 ? 0.15 : 0;
      if (hour >= 22 && G.day >= 3) lag = 0.9;
      const inBath = G.inRoom('bath');
      if (inBath) this.mirrorSeen = { t, s: this.sampleHistory(lag) };
      // It stays a moment after you leave.
      const show = inBath ? this.mirrorSeen.s : (this.mirrorSeen && t - this.mirrorSeen.t < 2.5 ? this.mirrorSeen.s : null);

      ctx.save();
      ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
      if (show) {
        const rx = gx + gw / 2 + (show.x - (x + 16)) * 0.35;
        let dir = 'front', flip = false;
        if (Math.abs(show.fx) > Math.abs(show.fy)) { dir = 'side'; flip = show.fx > 0; }
        else if (show.fy > 0) dir = 'back';
        // From Day 5, sometimes it keeps looking at you, whichever way you turn.
        if (G.day >= 5 && Math.floor(t / 6) % 4 === 1) { dir = 'front'; flip = false; }
        HS.Sprites.draw(ctx, `p_${dir}`, rx, gy + gh + 6, flip);
      } else if (hour >= 22 && G.day >= 3) {
        // At night, someone else is in there.
        const fx = gx + gw / 2 + Math.round(Math.sin(t * 0.3) * 5);
        R('#e8e2d6', fx - 3, gy + 1, 6, 7);
        R(PAL.k, fx - 2, gy + 3, 1, 1); R(PAL.k, fx + 1, gy + 3, 1, 1);
        R('#1a1222', fx - 4, gy + 8, 8, 3);
      }
      ctx.restore();
      R('rgba(255,255,255,.7)', gx + 2, gy + 1, 1, 4); R('rgba(255,255,255,.7)', gx + 3, gy + 1, 1, 1);
      R('rgba(255,255,255,.35)', gx + 21, gy + 4, 1, 3);
    },

    player() {
      const P = HS.Player, G = HS.Game;
      if (P.hidden) return;
      const S = HS.Sprites;
      const px = Math.round(P.x), py = Math.round(P.y);

      if (G.sleeping) {
        S.draw(ctx, 'p_front', px, py - 4);
        R(S.PAL.C, px - 7, py - 6, 14, 10);
        R(S.PAL.c, px - 7, py - 6, 14, 2);
        const z = Math.floor(this.t * 2) % 3;
        R(S.PAL.w, px + 6 + z * 2, py - 16 - z * 3, 3, 1);
        R(S.PAL.w, px + 7 + z * 2, py - 15 - z * 3, 1, 1);
        R(S.PAL.w, px + 6 + z * 2, py - 14 - z * 3, 3, 1);
        return;
      }

      // At night (from Day 4) your shadow is slow to follow you.
      const lag = HS.Clock.darkness() > 0.5 && G.day >= 4;
      if (!this.shadow || !lag) this.shadow = { x: px, y: py };
      else { const k = Math.min(1, 2.5 * (1 / 60)); this.shadow.x += (px - this.shadow.x) * k; this.shadow.y += (py - this.shadow.y) * k; }
      R('rgba(0,0,0,.3)', Math.round(this.shadow.x) - 5, Math.round(this.shadow.y) + 3, 10, 2);
      const f = P.face;
      let dir = 'front', flip = false;
      if (Math.abs(f.x) > Math.abs(f.y)) { dir = 'side'; flip = f.x < 0; }
      else if (f.y < 0) dir = 'back';
      let frame = '';
      if (P.moving && !P.sitting) frame = Math.floor(P.walkT) % 2 ? '_a' : '_b';
      const bob = P.moving && Math.floor(P.walkT) % 2 ? 1 : 0;
      S.draw(ctx, `p_${dir}${frame}`, px, py + 4 - bob, flip);
    },

    // ---------- lighting ----------
    lighting() {
      const G = HS.Game, RB = HS.Rulebook, h = HS.Clock.hour();
      if (h >= 16.5 && h < 21) {
        const k = Math.min(1, (h - 16.5) / 1.5) * (h < 20 ? 1 : 21 - h);
        R(`rgba(255,140,60,${(0.14 * k).toFixed(3)})`, 0, 0, W, H);
      }

      const blackout = G.effect('blackout');
      let a = blackout ? 0.96 : HS.Clock.darkness();
      if (G.effect('flicker') && Math.random() < 0.08) a = Math.min(0.97, a + 0.4);
      if (a < 0.01) return;

      const d = this.dctx, s = LIGHT_SCALE;
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, this.dark.width, this.dark.height);
      d.fillStyle = `rgba(14,10,34,${a})`;
      d.fillRect(0, 0, this.dark.width, this.dark.height);
      d.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r) => {
        // Three hard-edged rings = stepped pixel light.
        [[1, 0.35], [0.72, 0.55], [0.45, 1]].forEach(([k, alpha]) => {
          d.fillStyle = `rgba(0,0,0,${alpha})`;
          d.beginPath(); d.arc(x / s, (y - this.camYi) / s, (r * k) / s, 0, Math.PI * 2); d.fill();
        });
      };
      const P = HS.Player;
      // Each night your light reaches a little less far. And sometimes it just… goes out.
      const radius = 66 - (G.day - 1) * 3;
      if (!P.hidden && !HS.Uncanny.lightsOut) hole(P.x, P.y, blackout ? 22 : G.sleeping ? 34 : radius);
      if (!blackout) {
        if (h >= 19) hole(4.5 * T, 13.5 * T, 50);
        const tv = RB.get('tv').state;
        if (tv === 'on' || tv === 'watching') hole(25 * T, 2 * T, 52 + Math.random() * 8);
        if (RB.get('fridge').state === 'humming') hole(1.5 * T, 2 * T, 30);
        if (h >= 19 && !RB.get('fire').out) hole(6 * T, 34 * T, 48);  // the study fire
        const closed = RB.get('curtains').closed || [];
        if (h >= 20 && !closed.includes('window1')) hole(22 * T, 34.6 * T, 28); // moonlight in the sunroom
        if (h >= 20 && !closed.includes('window2')) hole(26 * T, 34.6 * T, 28);
      }
      if (G.heartOpen) hole(28.5 * T, 13 * T, 40);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.dark, 0, 0, W, H);

      if (G.basementOpen || G.heartOpen) {
        const col = G.heartOpen ? '255,210,90' : '255,60,40';
        const p = Math.floor(this.t * 2) % 2 ? 0.25 : 0.15;
        R(`rgba(${col},${p})`, 27 * T, 12 * T - 4 - this.camYi, 2 * T, 2 * T + 8);
      }
    },

    // Drawn on top of the darkness, so you can see them when you can't see anything else.
    inTheDark() {
      const U = HS.Uncanny, G = HS.Game;
      if (U.eyes && Math.floor(U.eyes.t * 3) % 7 !== 0) {
        const col = G.chaos >= 60 ? '#ff4040' : '#fff6c8';
        R(col, U.eyes.x - 2, U.eyes.y, 1, 1);
        R(col, U.eyes.x + 1, U.eyes.y, 1, 1);
      }
      // Whatever is following your footsteps walks exactly where you walked, a step behind.
      if (HS.Rulebook.get('footsteps').state === 'active') {
        const s = this.sampleHistory(0.7);
        const x = Math.round(s.x), y = Math.round(s.y) + 4;
        R('rgba(0,0,0,.55)', x - 4, y - 18, 8, 18); R('rgba(0,0,0,.55)', x - 3, y - 22, 6, 4);
      }
      // Hallucination: for a split second, something is standing right beside you.
      const hal = HS.Uncanny.hallucination;
      if (hal) {
        const P = HS.Player, x = Math.round(P.x + hal.dx), y = Math.round(P.y + hal.dy) + 4;
        R('#000', x - 4, y - 19, 8, 19); R('#000', x - 3, y - 23, 6, 4);
        R('#ff3030', x - 2, y - 21, 1, 1); R('#ff3030', x + 1, y - 21, 1, 1);
      }
      // The Visitor.
      const v = HS.Visitor.v;
      if (v && !v.hidden && v.cooldown <= 0) {
        const x = Math.round(v.x), y = Math.round(v.y) + 4;
        const col = 'rgba(0,0,0,.92)';
        R(col, x - 4, y - 19, 8, 19); R(col, x - 3, y - 23, 6, 4); R(col, x - 5, y - 17, 1, 9); R(col, x + 4, y - 17, 1, 9);
        const eye = v.mode === 'hunt' ? '#ff3030' : '#fff6c8';
        if (Math.floor(this.t * 3) % 9 !== 0) { R(eye, x - 2, y - 21, 1, 1); R(eye, x + 1, y - 21, 1, 1); }
      }
      // Something tall, standing just outside the bedroom door.
      if (HS.Rulebook.get('night').atBedroom) {
        const x = Math.round(5.5 * T), y = Math.round(10.9 * T);
        R('rgba(0,0,0,.9)', x - 4, y - 19, 8, 19);
        R('rgba(0,0,0,.9)', x - 3, y - 23, 6, 4);
        R('#fff6c8', x - 2, y - 21, 1, 1);
        R('#fff6c8', x + 1, y - 21, 1, 1);
      }
    },

    // A long shadow on the floor, stretching in from a doorway. Cast by nothing.
    daytimeShadow() {
      const s = HS.Daytime.floorShadow;
      if (!s) return;
      const a = Math.min(0.45, s.t / 4);
      for (let i = 0; i < 26; i++) {
        const w = 6 + Math.round(Math.sin(i / 26 * Math.PI) * 4) - (i > 20 ? (i - 20) : 0);
        R(`rgba(10,6,20,${a.toFixed(2)})`, Math.round(s.x - w / 2), Math.round(s.y + s.dir * (4 + i)), w, 1);
      }
      R(`rgba(10,6,20,${a.toFixed(2)})`, Math.round(s.x - 3), Math.round(s.y + s.dir * 31), 6, 4);
    },

    effects() {
      const G = HS.Game;
      const D = HS.Daytime;
      // The house goes quiet and the light dims, in the middle of the afternoon.
      if (D.dimT > 0) R(`rgba(20,14,40,${(Math.min(1, D.dimT / 3) * 0.32).toFixed(2)})`, 0, 0, W, H);
      // Something enormous passes outside; its shadow crosses the whole house.
      if (D.sweep !== null) {
        const x = Math.round(-W * 0.6 + D.sweep * W * 1.8);
        R('rgba(8,5,18,.45)', x, 0, Math.round(W * 0.45), H);
        R('rgba(8,5,18,.25)', x - 30, 0, 30, H);
        R('rgba(8,5,18,.25)', x + Math.round(W * 0.45), 0, 30, H);
      }
      if (G.effect('static')) {
        for (let i = 0; i < 260; i++) {
          const v = Math.floor(Math.random() * 255);
          R(`rgba(${v},${v},${v},0.35)`, Math.floor(Math.random() * W), Math.floor(Math.random() * H), 1, 1);
        }
        for (let y = Math.floor(this.t * 20) % 3; y < H; y += 3) R('rgba(0,0,0,0.08)', 0, y, W, 1);
      }
      if (G.effect('icy')) {
        R('rgba(160,220,255,0.14)', 0, 0, W, H);
        for (let i = 0; i < 6; i++) {
          R('rgba(230,248,255,0.5)', 0, 0, W, 6 - i); R('rgba(230,248,255,0.5)', 0, H - 6 + i, W, 6 - i);
        }
        R('rgba(230,248,255,0.4)', 0, 0, 4, H); R('rgba(230,248,255,0.4)', W - 4, 0, 4, H);
      }
      if (G.effect('damp')) {
        R('rgba(60,140,120,0.14)', 0, 0, W, H);
        for (let i = 0; i < 12; i++) {
          const dx = (i * 41) % W, dy = (this.t * 40 + i * 37) % H;
          R('rgba(143,211,255,0.6)', dx, Math.floor(dy), 1, 3);
        }
      }
    },
  };
})();
