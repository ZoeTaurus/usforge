'use strict';
// ---------------------------------------------------------------------------
// Stages: procedural, animated parallax backgrounds.
// Every stage draws in screen space using cam.x / cam.y for parallax.
// World x -> screen: (x - cam.x) + 640. Floor at GROUND_Y + cam.y.
//
// Rendering strategy: static scenery is painted ONCE into offscreen canvases
// ("layers" and "sprites") at the exact device scale of the current transform
// and blitted pixel-aligned every frame. An unscaled, pixel-aligned blit is
// close to a memcpy even on a software canvas, while full-screen gradients,
// filtered (scaled / sub-pixel) blits and long strokes cost ~10x more. Only
// the animated details are drawn as vectors each frame.
//
// "Layer space" = screen space with the camera at the stage centre
// (cam.x = 1000, cam.y = 0). A layer with parallax factor f is shifted by
// -(cam.x - 1000) * f horizontally and +cam.y * fy vertically.
// ---------------------------------------------------------------------------

const STAGES = {};
const STAGE_ORDER = [];

function defineStage(s) {
  STAGES[s.id] = s;
  if (!STAGE_ORDER.includes(s.id)) STAGE_ORDER.push(s.id);
  return s;
}

// A stage whose body (layers, sprites, state) is built on first use: battle.js
// (GROUND_Y, STAGE_W) loads after this file. build() returns
// { draw, drawFront?, update? }.
function defineLazyStage(meta, build) {
  let impl = null;
  const get = () => impl || (impl = build());
  return defineStage(
    Object.assign({}, meta, {
      draw(ctx, cam, t, b) {
        get().draw(ctx, cam, t, b);
      },
      drawFront(ctx, cam, t, b) {
        const i = get();
        if (i.drawFront) i.drawFront(ctx, cam, t, b);
      },
      update(b) {
        const i = get();
        if (i.update) i.update(b);
      },
    })
  );
}

const StageKit = {
  // screen x for a world x on a parallax layer (f = 1 -> moves with fighters)
  px(cam, x, f) {
    return (x - STAGE_W / 2) * f + 640 - (cam.x - STAGE_W / 2) * f;
  },

  // ---- legacy immediate-mode helpers (kept for menus / other screens) -------
  sky(ctx, stops, cam, h = 720) {
    const g = ctx.createLinearGradient(0, -cam.y * 0.2, 0, h);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(-100, -100, 1480, h + 200);
  },
  skyline(ctx, cam, f, baseY, opts) {
    const { seed = 1, count = 30, minW = 60, maxW = 140, minH = 80, maxH = 260, color, win, winChance = 0.35, span = 2600, t = 0, roof } = opts;
    const off = (cam.x - STAGE_W / 2) * f;
    let x = -span / 2;
    ctx.fillStyle = color;
    const wins = [];
    for (let i = 0; i < count && x < span / 2; i++) {
      const w = minW + U.hash(seed * 7 + i) * (maxW - minW);
      const h = minH + U.hash(seed * 13 + i * 3) * (maxH - minH);
      const sx = 640 + x - off;
      if (sx + w > -50 && sx < 1330) {
        ctx.fillStyle = color;
        ctx.fillRect(sx, baseY - h, w + 1, h + 400);
        const kind = Math.floor(U.hash(seed * 31 + i) * 4);
        if (roof && kind === 0) {
          ctx.fillRect(sx + w * 0.3, baseY - h - 18, w * 0.4, 18);
        } else if (roof && kind === 1) {
          ctx.fillRect(sx + w * 0.5 - 2, baseY - h - 40, 4, 40);
          ctx.fillRect(sx + w * 0.5 - 8, baseY - h - 30, 16, 3);
        } else if (roof && kind === 2) {
          ctx.fillRect(sx + w * 0.2, baseY - h - 36, 30, 24);
          ctx.beginPath();
          ctx.moveTo(sx + w * 0.2 - 3, baseY - h - 36);
          ctx.lineTo(sx + w * 0.2 + 15, baseY - h - 48);
          ctx.lineTo(sx + w * 0.2 + 33, baseY - h - 36);
          ctx.fill();
          ctx.fillRect(sx + w * 0.2 + 4, baseY - h - 12, 3, 12);
          ctx.fillRect(sx + w * 0.2 + 23, baseY - h - 12, 3, 12);
        }
        if (win) {
          const cols = Math.floor((w - 12) / 14), rows = Math.floor((h - 16) / 20);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const hv = U.hash(seed * 101 + i * 37 + r * 11 + c * 5);
              if (hv < winChance) {
                const flick = U.hash(hv * 99 + Math.floor(t / 90 + hv * 50)) < 0.04 ? 0.25 : 1;
                wins.push([sx + 8 + c * 14, baseY - h + 10 + r * 20, flick]);
              }
            }
          }
        }
      }
      x += w + U.hash(seed * 3 + i) * 10;
    }
    if (win) {
      for (const [wx, wy, a] of wins) {
        ctx.globalAlpha = a;
        ctx.fillStyle = win;
        ctx.fillRect(wx, wy, 6, 9);
      }
      ctx.globalAlpha = 1;
    }
  },
  cloudBand(ctx, cam, f, y, opts) {
    const { seed = 1, n = 6, color = '#fff', speed = 0.1, t = 0, scale = 1, alpha = 1, shade } = opts;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      const span = 2200;
      let x = U.hash(seed * 17 + i) * span + t * speed * (0.5 + U.hash(i * 5 + seed));
      x = ((x - (cam.x - STAGE_W / 2) * f) % span + span) % span - 400;
      const s = (50 + U.hash(seed * 23 + i) * 50) * scale;
      Draw.cloud(ctx, x, y + U.hash(seed * 29 + i) * 60, s, color, 0, INK, shade);
    }
    ctx.restore();
  },

  // ---- camera -----------------------------------------------------------------
  // Sanitized camera (menus pass partial fake cams; battle cams stay in range).
  cam(cam) {
    return {
      x: U.clamp(cam && isFinite(cam.x) ? cam.x : STAGE_W / 2, STAGE_W / 2 - 444, STAGE_W / 2 + 444),
      y: U.clamp(cam && isFinite(cam.y) ? cam.y : 0, 0, 300),
      zoom: cam && cam.zoom > 0 ? cam.zoom : 1,
      shake: cam && cam.shake > 0 ? cam.shake : 0,
    };
  },
  // layer-space x -> screen x on a layer with parallax f
  lx(c, x, f) {
    return x - (c.x - STAGE_W / 2) * f;
  },
  // world x -> screen x (f = 1)
  wx(c, x) {
    return x - c.x + 640;
  },

  // ---- render caches ------------------------------------------------------------
  holders: [],
  _sweepAt: 0,
  _fontsOk: false,
  fontsReady() {
    if (!StageKit._fontsOk) {
      try {
        StageKit._fontsOk = !document.fonts || (document.fonts.check("40px 'Luckiest Guy'") && document.fonts.check("700 20px 'Fredoka'"));
      } catch (e) {
        StageKit._fontsOk = true;
      }
    }
    return StageKit._fontsOk;
  },
  canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  },
  // The cache entry of holder H for device scale k. A new scale (window
  // resize, a menu drawing at another size) is re-rendered once it has been
  // requested for a few draws in a row; until then the nearest entry is
  // drawn scaled.
  entry(H, k) {
    const now = performance.now();
    const E = H.ents;
    let best = null, err = 1e9;
    for (const e of E) {
      const d = Math.abs(Math.log(e.k / k));
      if (d < err) {
        err = d;
        best = e;
      }
    }
    let build = !best;
    if (best && err > 0.002) {
      if (H.pk && Math.abs(Math.log(H.pk / k)) < 0.002) H.pn++;
      else {
        H.pk = k;
        H.pn = 1;
      }
      build = H.pn >= 6;
    } else if (best && best.fontWait && now - best.made > 250 && StageKit.fontsReady()) {
      E.splice(E.indexOf(best), 1);
      StageKit.free(best);
      build = true;
    }
    StageKit.sweep(now);
    if (!build) {
      best.used = now;
      return best;
    }
    const e = { k, cv: H.build(k), used: now, made: now, fontWait: !!H.text && !StageKit.fontsReady() };
    E.push(e);
    if (E.length > 2) {
      let lru = null;
      for (const x of E) if (x !== e && (!lru || x.used < lru.used)) lru = x;
      E.splice(E.indexOf(lru), 1);
      StageKit.free(lru);
    }
    return e;
  },
  free(e) {
    e.cv.width = e.cv.height = 0;
  },
  // drop caches that have not been drawn for a while (e.g. other stages)
  sweep(now) {
    if (now - StageKit._sweepAt < 3000) return;
    StageKit._sweepAt = now;
    for (const H of StageKit.holders) {
      for (let i = H.ents.length - 1; i >= 0; i--) {
        if (now - H.ents[i].used > 20000) {
          StageKit.free(H.ents[i]);
          H.ents.splice(i, 1);
        }
      }
    }
  },
  flush() {
    for (const H of StageKit.holders) {
      for (const e of H.ents) StageKit.free(e);
      H.ents.length = 0;
    }
  },
  // Build a stage's caches ahead of time (e.g. on the VS screen) so the first
  // battle frame doesn't hitch. scale = device px per logical px in battle.
  prewarm(id, scale) {
    const S = STAGES[id];
    if (!S) return;
    const rs = typeof Game !== 'undefined' && Game.renderScale ? Game.renderScale : 1;
    const k = scale || rs * (typeof WORLD_ZOOM !== 'undefined' ? WORLD_ZOOM : 1);
    const g = StageKit.canvas(1, 1).getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    const cam = { x: STAGE_W / 2, y: 0, zoom: 1, shake: 0, sx: 0, sy: 0 };
    S.draw(g, cam, 0, null);
    if (S.drawFront) S.drawFront(g, cam, 0, null);
  },

  // Blit cache entry e with its logical top-left at (x, y) under transform m.
  // Pixel-aligned (fast) when the transform scale matches the cache scale.
  blit(ctx, m, e, x, y) {
    const k = e.k;
    if (m.b === 0 && m.c === 0 && Math.abs(m.a - k) < k * 0.002 && Math.abs(m.d - k) < k * 0.002) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(e.cv, Math.round(m.e + m.a * x), Math.round(m.f + m.d * y));
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      return true;
    }
    ctx.drawImage(e.cv, x, y, e.cv.width / k, e.cv.height / k);
    return false;
  },
  // snap a logical coordinate the way blit() does (so vector overlays line up)
  snapX(m, x) {
    return (Math.round(m.e + m.a * x) - m.e) / m.a;
  },
  snapY(m, y) {
    return (Math.round(m.f + m.d * y) - m.f) / m.d;
  },

  // Cached scenery gets the fighters' hand-drawn finish (see sketch.js): no
  // outlines on big shapes, jagged black brush marks, hatching and specks.
  // It is painted once, so it costs nothing per frame.
  // seed: pass a fixed one when inking live (per-frame) drawing
  inked(g, paint, seed) {
    Sketch.begin(g, StageKit.INKPAL, seed !== undefined ? seed : (StageKit._inkSeed = (StageKit._inkSeed || 0) + 1));
    Sketch.part = 'stage';
    // lit from the right, so buildings and trees get marks down their left sides
    Sketch.dir = StageKit.INKDIR;
    try {
      paint();
    } finally {
      Sketch.end(g);
    }
  },
  INKPAL: { ink: INK },
  INKDIR: [1, 0],

  // A cached parallax layer. o: { f, fy, x0, x1, y0, y1, paint(g, L, k), text }
  // paint() draws in layer space; x0..x1 default to the full parallax range.
  layer(o) {
    const f = o.f === undefined ? 1 : o.f;
    const L = Object.assign({ f, fy: f, y0: -60, y1: 760, ents: [], off: { x: 0, y: 0 } }, o);
    if (L.x0 === undefined) L.x0 = Math.floor(-170 - 444 * L.f);
    if (L.x1 === undefined) L.x1 = Math.ceil(1450 + 444 * L.f);
    L.build = (k) => {
      const cv = StageKit.canvas((L.x1 - L.x0) * k, (L.y1 - L.y0) * k);
      const g = cv.getContext('2d');
      g.setTransform(k, 0, 0, k, -L.x0 * k, -L.y0 * k);
      g.lineJoin = 'round';
      g.lineCap = 'round';
      StageKit.inked(g, () => L.paint(g, L, k));
      return cv;
    };
    StageKit.holders.push(L);
    return L;
  },
  // Draw layer L; returns L.off = offset from layer space to screen space
  // (snapped like the blit, so vector overlays line up with the cache).
  draw(ctx, c, L, m) {
    m = m || ctx.getTransform();
    const e = StageKit.entry(L, Math.hypot(m.a, m.b) / c.zoom);
    let x = L.x0 - (c.x - STAGE_W / 2) * L.f, y = L.y0 + c.y * L.fy;
    if (StageKit.blit(ctx, m, e, x, y)) {
      x = StageKit.snapX(m, x);
      y = StageKit.snapY(m, y);
    }
    L.off.x = x - L.x0;
    L.off.y = y - L.y0;
    return L.off;
  },

  // A cached sprite. o: { w, h, ax, ay, paint(g, S) } in logical px; (ax, ay)
  // is the anchor drawn at the position given to spr().
  sprite(o) {
    const S = Object.assign({ ax: 0, ay: 0, ents: [] }, o);
    S.build = (k) => {
      const cv = StageKit.canvas(S.w * k, S.h * k);
      const g = cv.getContext('2d');
      g.setTransform(k, 0, 0, k, 0, 0);
      g.lineJoin = 'round';
      g.lineCap = 'round';
      StageKit.inked(g, () => S.paint(g, S));
      return cv;
    };
    StageKit.holders.push(S);
    return S;
  },
  // pixel-snapped sprite blit (m = ctx.getTransform(), fetched once per batch)
  spr(ctx, c, m, S, x, y) {
    StageKit.blit(ctx, m, StageKit.entry(S, Math.hypot(m.a, m.b) / c.zoom), x - S.ax, y - S.ay);
  },
  // rotated / scaled / translucent sprite (filtered blit: keep these small)
  sprT(ctx, c, m, S, x, y, rot, sc, alpha) {
    const e = StageKit.entry(S, Math.hypot(m.a, m.b) / c.zoom);
    const cs = Math.cos(rot) * sc, sn = Math.sin(rot) * sc;
    ctx.setTransform(m.a * cs + m.c * sn, m.b * cs + m.d * sn, -m.a * sn + m.c * cs, -m.b * sn + m.d * cs, m.e + m.a * x + m.c * y, m.f + m.b * x + m.d * y);
    const pa = ctx.globalAlpha;
    if (alpha !== undefined) ctx.globalAlpha = pa * alpha;
    ctx.drawImage(e.cv, -S.ax, -S.ay, e.cv.width / e.k, e.cv.height / e.k);
    ctx.globalAlpha = pa;
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  },

  // ---- painting helpers (used inside cached painters, may be slowish) ----------
  vgrad(g, x, y, w, h, stops, gy0 = y, gy1 = y + h) {
    const gr = g.createLinearGradient(0, gy0, 0, gy1);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
  },
  glow(g, x, y, r, col, a = 1, inner = 0) {
    const gr = g.createRadialGradient(x, y, inner, x, y, r);
    gr.addColorStop(0, U.rgba(col, a));
    gr.addColorStop(0.45, U.rgba(col, a * 0.35));
    gr.addColorStop(1, U.rgba(col, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  },
  // Cartoon cumulus as a union of circles with a flat bottom at by.
  cloudPath(g, cx, by, w, h, seed) {
    const nb = Math.max(2, Math.round(w / (h * 0.75)));
    const rb = Math.min(h * 0.45, w / (nb + 1));
    for (let i = 0; i < nb; i++) {
      const x = cx - w / 2 + rb + (i / (nb - 1)) * (w - rb * 2);
      const r = rb * (0.9 + U.hash(seed + i * 3.1) * 0.25);
      g.moveTo(x + r, by - r * 0.55);
      g.arc(x, by - r * 0.55, r, 0, TAU);
    }
    const nt = Math.max(1, Math.round(nb * 0.6));
    for (let i = 0; i < nt; i++) {
      const u = nt === 1 ? 0.5 : i / (nt - 1);
      const r = h * (0.36 + U.hash(seed * 5 + i) * 0.16) * (nt === 1 ? 1.15 : 1);
      const x = cx + (u - 0.5) * (w - r * 2.6) * 0.95 + (U.hash(seed * 3 + i) - 0.5) * rb * 0.6;
      const y = by - h + r;
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, TAU);
    }
  },
  cloud(g, cx, by, w, h, seed, fill, shade, lw = 0, stroke = INK, hi) {
    g.save();
    g.beginPath();
    g.rect(cx - w, by - h * 3, w * 2, h * 3);
    g.clip();
    g.beginPath();
    StageKit.cloudPath(g, cx, by, w, h, seed);
    if (lw > 0) {
      g.lineWidth = lw * 2;
      g.strokeStyle = stroke;
      g.stroke();
    }
    g.fillStyle = fill;
    g.fill();
    if (shade || hi) {
      g.clip();
      if (shade) {
        g.fillStyle = shade;
        g.beginPath();
        g.ellipse(cx, by + h * 0.05, w * 0.62, h * 0.36, 0, 0, TAU);
        g.fill();
      }
      if (hi) {
        g.fillStyle = hi;
        g.beginPath();
        g.ellipse(cx - w * 0.12, by - h * 0.92, w * 0.3, h * 0.2, -0.1, 0, TAU);
        g.fill();
      }
    }
    g.restore();
    if (lw > 0) {
      g.fillStyle = stroke;
      g.fillRect(cx - w / 2 + h * 0.2, by - lw / 2, w - h * 0.4, lw);
    }
  },
  // Rolling silhouette (sum of sines) from x0 to x1 above baseY.
  ridgePath(g, x0, x1, baseY, amp, seed, o = {}) {
    const step = o.step || 16, bottom = o.bottom === undefined ? 780 : o.bottom;
    const f1 = o.freq || 0.004;
    g.moveTo(x0, bottom);
    for (let x = x0; x <= x1 + step; x += step) {
      const n = Math.sin(x * f1 + seed) * 0.55 + Math.sin(x * f1 * 2.3 + seed * 1.7) * 0.3 + Math.sin(x * f1 * 5.1 + seed * 2.9) * 0.15;
      g.lineTo(x, baseY - amp * (0.5 + n * 0.5));
    }
    g.lineTo(x1 + step, bottom);
    g.closePath();
  },
  // buildings with lit windows; returns window rects for flicker overlays
  buildings(g, x0, x1, baseY, o) {
    const { seed = 1, minW = 60, maxW = 140, minH = 80, maxH = 260, color, win, winChance = 0.3, roof = false, bottom = 780, rim, wins = [] } = o;
    let x = x0 - U.hash(seed) * maxW;
    let i = 0;
    const tips = [];
    while (x < x1) {
      const w = Math.round(minW + U.hash(seed * 7 + i) * (maxW - minW));
      const h = Math.round(minH + U.hash(seed * 13 + i * 3) * (maxH - minH));
      const top = baseY - h;
      g.fillStyle = color;
      g.fillRect(x, top, w + 1, bottom - top);
      const kind = Math.floor(U.hash(seed * 31 + i) * 5);
      if (roof && kind === 0) {
        g.fillRect(x + w * 0.3, top - 16, w * 0.4, 16);
      } else if (roof && kind === 1) {
        g.fillRect(x + w * 0.5 - 2, top - 44, 4, 44);
        g.fillRect(x + w * 0.5 - 8, top - 30, 16, 3);
        tips.push([x + w * 0.5, top - 46]);
      } else if (roof && kind === 2) {
        const wx = x + w * 0.22;
        g.fillRect(wx, top - 36, 30, 24);
        g.beginPath();
        g.moveTo(wx - 3, top - 36);
        g.lineTo(wx + 15, top - 48);
        g.lineTo(wx + 33, top - 36);
        g.fill();
        g.fillRect(wx + 4, top - 12, 3, 12);
        g.fillRect(wx + 23, top - 12, 3, 12);
      } else if (roof && kind === 3) {
        g.beginPath();
        g.moveTo(x, top);
        g.lineTo(x + w / 2, top - Math.min(40, w * 0.35));
        g.lineTo(x + w + 1, top);
        g.fill();
      }
      if (rim) {
        g.fillStyle = rim;
        g.fillRect(x, top, w + 1, 2.5);
      }
      if (win) {
        const cols = Math.floor((w - 12) / 14), rows = Math.floor((h - 16) / 20);
        const ox = x + (w - (cols * 14 - 8)) / 2;
        g.fillStyle = win;
        for (let r = 0; r < rows; r++) {
          for (let cc = 0; cc < cols; cc++) {
            const hv = U.hash(seed * 101 + i * 37 + r * 11 + cc * 5);
            if (hv < winChance) {
              const wx = ox + cc * 14, wy = top + 10 + r * 20;
              g.fillRect(wx, wy, 6, 9);
              wins.push(wx, wy, hv);
            }
          }
        }
      }
      x += w + Math.round(U.hash(seed * 3 + i) * 10);
      i++;
    }
    return { wins, tips };
  },
  // per-frame: dim a few windows of a buildings() layer (lights going off)
  flicker(ctx, wins, off, t, color, rate = 0.04) {
    ctx.fillStyle = color;
    for (let i = 0; i < wins.length; i += 3) {
      const hv = wins[i + 2];
      if (U.hash(hv * 99 + Math.floor(t / 90 + hv * 50)) < rate) ctx.fillRect(wins[i] + off.x - 0.5, wins[i + 1] + off.y - 0.5, 7, 10);
    }
  },

  // ---- per-frame helpers ---------------------------------------------------------
  // Wrap a layer-space x into [lo, lo + span) after parallax.
  wrap(x, lo, span) {
    return ((((x - lo) % span) + span) % span) + lo;
  },
  // Perspective floor seams: lines from the floor line (f = 1) towards the
  // bottom (f = spread) for world xs every `step`.
  floorSeams(ctx, c, gy, o) {
    const { step = 120, spread = 1.6, color = 'rgba(29,20,40,0.3)', lw = 2, y1 = 770, x0 = -600, x1 = 2600, phase = 0 } = o;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    const h = y1 - gy;
    for (let x = x0 + phase; x < x1; x += step) {
      const a = x - c.x + 640, b = 640 + (a - 640) * spread;
      if (Math.max(a, b) < -260 || Math.min(a, b) > 1540) continue;
      ctx.moveTo(a, gy + 2);
      ctx.lineTo(a + (b - a) * ((y1 - gy) / h), y1);
    }
    ctx.stroke();
  },
};

// ===========================================================================
// 1. SUNSET ROOFTOP (Jett)
// ===========================================================================
defineLazyStage({ id: 'rooftop', name: 'Sunset Rooftop', music: 'rooftop', thumbColors: ['#ff8a5c', '#5b3f8c'], haze: 'rgba(255,228,240,0.16)' }, () => {
  const SKY = [[0, '#2a1957'], [0.33, '#6e3790'], [0.6, '#ff7a6b'], [0.8, '#ffb46b'], [1, '#ffd99a']];
  const SUN = { x: 655, y: 372, r: 118 };
  let farW = null, nearW = null;

  const sky = StageKit.layer({
    f: 0.03,
    fy: 0.12,
    y0: -40,
    y1: 700,
    paint(g, L) {
      const W = L.x1 - L.x0;
      StageKit.vgrad(g, L.x0, 0, W, 720, SKY);
      g.fillStyle = SKY[0][1];
      g.fillRect(L.x0, L.y0, W, -L.y0 + 1);
      // early stars in the purple part
      for (let i = 0; i < 70; i++) {
        const x = L.x0 + U.hash(i * 3.3 + 1) * W, y = 10 + U.hash(i * 7.7 + 2) ** 1.6 * 260;
        g.globalAlpha = 0.25 + 0.6 * (1 - y / 270) * U.hash(i * 1.9);
        g.fillStyle = '#ffe9f4';
        g.fillRect(x, y, 2, 2);
      }
      g.globalAlpha = 1;
      // sun glow + synthwave sun (slices cut with an even-odd clip)
      StageKit.glow(g, SUN.x, SUN.y, 330, '#ffe6a8', 0.55, 30);
      g.save();
      g.beginPath();
      g.rect(SUN.x - 200, SUN.y - 200, 400, 400);
      for (let i = 0; i < 6; i++) g.rect(SUN.x - 140, SUN.y + 22 + i * 17, 280, 3 + i * 1.7);
      g.clip('evenodd');
      const sg = g.createLinearGradient(0, SUN.y - SUN.r, 0, SUN.y + SUN.r);
      sg.addColorStop(0, '#fff3c4');
      sg.addColorStop(0.55, '#ffd27a');
      sg.addColorStop(1, '#ff8f6b');
      g.fillStyle = sg;
      g.beginPath();
      g.arc(SUN.x, SUN.y, SUN.r, 0, TAU);
      g.fill();
      g.restore();
      // thin far haze streaks
      g.fillStyle = 'rgba(255,214,190,0.22)';
      for (let i = 0; i < 5; i++) {
        const y = 300 + i * 34, w = 300 + U.hash(i * 5.1) * 500, x = L.x0 + U.hash(i * 9.3) * W;
        g.beginPath();
        Draw.roundRectPath(g, x, y, w, 6 + (i % 2) * 3, 4);
        g.fill();
      }
    },
  });

  const cloudSprites = [0, 1, 2].map((i) =>
    StageKit.sprite({
      w: 300,
      h: 110,
      ax: 150,
      ay: 100,
      paint(g) {
        StageKit.cloud(g, 150, 100, [270, 220, 180][i], [80, 66, 56][i], 11 + i * 7, '#ffc4cf', '#f293ad', 0, INK, 'rgba(255,240,236,0.7)');
      },
    })
  );

  const far = StageKit.layer({
    f: 0.12,
    fy: 0.3,
    y0: 150,
    y1: 760,
    paint(g, L) {
      farW = StageKit.buildings(g, L.x0, L.x1, 512, { seed: 2, minW: 50, maxW: 120, minH: 120, maxH: 300, color: '#5a2f73', win: '#ffcf7a', winChance: 0.18, roof: true, rim: '#9a4f86' });
      StageKit.vgrad(g, L.x0, 380, L.x1 - L.x0, 380, [[0, 'rgba(255,140,130,0)'], [0.35, 'rgba(255,140,130,0.28)'], [1, 'rgba(255,170,140,0.55)']]);
    },
  });

  const near = StageKit.layer({
    f: 0.32,
    fy: 0.55,
    y0: 300,
    y1: 760,
    paint(g, L) {
      nearW = StageKit.buildings(g, L.x0, L.x1, 572, { seed: 5, minW: 90, maxW: 190, minH: 90, maxH: 230, color: '#3d2257', win: '#ffd88f', winChance: 0.28, roof: true, rim: '#6a3a6e' });
    },
  });

  // the rooftop itself (moves with the fighters)
  const POSTS = [-100, 400, 900, 1400, 1900, 2400];
  const wall = StageKit.layer({
    f: 1,
    y0: 220,
    y1: 640,
    text: true,
    paint(g, L) {
      const gy = GROUND_Y, X = (x) => x - 360; // world -> layer x
      const x0 = L.x0, W = L.x1 - L.x0;
      g.fillStyle = '#6a4a8a';
      g.fillRect(x0, gy - 92, W, 92);
      g.fillStyle = '#82609f';
      g.fillRect(x0, gy - 104, W, 16);
      g.fillStyle = 'rgba(255,190,150,0.35)';
      g.fillRect(x0, gy - 104, W, 4);
      g.fillStyle = INK;
      g.fillRect(x0, gy - 106, W, 4);
      g.fillRect(x0, gy - 89, W, 3);
      // bricks
      g.strokeStyle = 'rgba(29,20,40,0.25)';
      g.lineWidth = 2;
      g.beginPath();
      for (let row = 0; row < 4; row++) {
        const yy = gy - 86 + row * 22;
        g.moveTo(x0, yy);
        g.lineTo(L.x1, yy);
        for (let x = -660 + (row % 2) * 30; x < L.x1 + 360; x += 60) {
          g.moveTo(X(x), yy);
          g.lineTo(X(x), yy + 22);
        }
      }
      g.stroke();
      // a few lighter bricks
      g.fillStyle = 'rgba(255,255,255,0.07)';
      for (let i = 0; i < 40; i++) {
        const row = Math.floor(U.hash(i * 3.7) * 4), col = Math.floor(U.hash(i * 5.3) * 48) - 12;
        g.fillRect(X(col * 60 + (row % 2) * 30) + 2, gy - 85 + row * 22, 56, 19);
      }
      // wall shadow on the floor side
      g.fillStyle = 'rgba(29,20,40,0.18)';
      g.fillRect(x0, gy - 12, W, 12);
      // graffiti
      g.save();
      g.translate(X(560), gy - 48);
      g.rotate(-0.06);
      Draw.text(g, 'KERFUFFLE', 0, 0, { size: 42, fill: '#7ff0dc', stroke: '#2b1640', lw: 8, shadow: '#ff5577', sh: 4 });
      g.restore();
      g.save();
      g.translate(X(1420), gy - 50);
      g.rotate(0.05);
      Draw.text(g, 'J★TT', 0, 0, { size: 46, fill: '#ffd23f', stroke: '#2b1640', lw: 8, shadow: '#ff5577', sh: 4 });
      g.restore();
      Draw.heart(g, X(1180), gy - 52, 34, '#ff5a7a', 4, '#2b1640');
      // water tower
      const wx = X(220);
      Draw.roundRect(g, wx - 6, gy - 250, 12, 160, 3, '#4a3360', 3);
      Draw.roundRect(g, wx + 70, gy - 250, 12, 160, 3, '#4a3360', 3);
      Draw.line(g, wx, gy - 190, wx + 76, gy - 150, 4, '#4a3360', 2);
      Draw.line(g, wx + 76, gy - 190, wx, gy - 150, 4, '#4a3360', 2);
      Draw.roundRect(g, wx - 20, gy - 340, 116, 100, 14, '#8a5a3c', 4);
      g.fillStyle = '#6f4630';
      for (let i = 0; i < 5; i++) g.fillRect(wx - 14 + i * 22, gy - 336, 4, 92);
      g.fillStyle = 'rgba(255,200,150,0.25)';
      g.fillRect(wx - 16, gy - 336, 10, 92);
      g.fillStyle = INK;
      g.fillRect(wx - 20, gy - 300, 116, 4);
      g.fillRect(wx - 20, gy - 272, 116, 4);
      Draw.poly(g, [wx - 30, gy - 336, wx + 38, gy - 386, wx + 106, gy - 336], '#a86b48', 4);
      // AC unit (fan drawn per frame)
      const ax = X(1700);
      Draw.roundRect(g, ax, gy - 150, 150, 70, 8, '#b9b3cf', 4);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(ax + 6, gy - 144, 138, 5);
      Draw.circle(g, ax + 105, gy - 115, 26, '#8d86a8', 4);
      g.fillStyle = INK;
      for (let i = 0; i < 4; i++) g.fillRect(ax + 12, gy - 140 + i * 13, 50, 5);
      Draw.roundRect(g, ax + 10, gy - 82, 16, 10, 3, '#8d86a8', 3);
      Draw.roundRect(g, ax + 124, gy - 82, 16, 10, 3, '#8d86a8', 3);
      // vent pipe (steam per frame)
      const vx = X(-40);
      Draw.roundRect(g, vx, gy - 170, 26, 90, 4, '#9b93b8', 4);
      Draw.roundRect(g, vx - 6, gy - 178, 38, 14, 5, '#b9b3cf', 4);
      // string-light wires + posts
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < POSTS.length - 1; i++) {
        const x1 = X(POSTS[i]), x2 = X(POSTS[i + 1]), y1 = gy - 190;
        g.moveTo(x1, y1);
        g.quadraticCurveTo((x1 + x2) / 2, y1 + 60, x2, y1);
      }
      g.stroke();
      for (const p of POSTS) Draw.roundRect(g, X(p) - 4, gy - 196, 8, 104, 3, '#3d2a52', 3);
    },
  });

  const floor = StageKit.layer({
    f: 1,
    y0: GROUND_Y - 3,
    y1: 780,
    paint(g, L) {
      const gy = GROUND_Y, W = L.x1 - L.x0;
      StageKit.vgrad(g, L.x0, gy, W, 150, [[0, '#7d6496'], [1, '#4c3766']], gy, 760);
      g.fillStyle = 'rgba(255,190,160,0.16)';
      g.fillRect(L.x0, gy + 2, W, 10);
      g.fillStyle = 'rgba(29,20,40,0.3)';
      g.fillRect(L.x0, gy + 25, W, 2);
      g.fillRect(L.x0, gy + 61, W, 2);
      g.fillRect(L.x0, gy + 104, W, 2);
      // pebbles / tar spots
      for (let i = 0; i < 120; i++) {
        const x = L.x0 + U.hash(i * 4.1) * W, y = gy + 8 + U.hash(i * 6.7) * 110;
        g.fillStyle = i % 3 ? 'rgba(29,20,40,0.22)' : 'rgba(255,220,255,0.16)';
        g.beginPath();
        g.ellipse(x, y, 2 + U.hash(i) * 3, 1.2 + U.hash(i * 2) * 1.5, 0, 0, TAU);
        g.fill();
      }
      g.fillStyle = INK;
      g.fillRect(L.x0, gy - 2, W, 5);
    },
  });

  const bulbCols = ['#ffd23f', '#ff5577', '#7ff0dc'];

  return {
    draw(ctx, cam, t) {
      const c = StageKit.cam(cam);
      const m = ctx.getTransform();
      const gy = GROUND_Y + c.y;
      // sky above the cached range when the camera rises
      ctx.fillStyle = SKY[0][1];
      ctx.fillRect(-300, -400, 1900, 400 + sky.y0 + c.y * sky.fy + 2);
      StageKit.draw(ctx, c, sky, m);
      // twinkling stars
      ctx.fillStyle = '#fff6fb';
      for (let i = 0; i < 10; i++) {
        const a = 0.5 + 0.5 * Math.sin(t * 0.05 + i * 2.1);
        if (a < 0.35) continue;
        const x = StageKit.wrap(U.hash(i * 9.1) * 1500 - (c.x - 1000) * 0.03, -100, 1500), y = 150 + U.hash(i * 4.3) * 110 + c.y * 0.12;
        const s = 1 + a * 2.2;
        ctx.globalAlpha = a;
        ctx.fillRect(x - s, y - 0.6, s * 2, 1.2);
        ctx.fillRect(x - 0.6, y - s, 1.2, s * 2);
      }
      ctx.globalAlpha = 1;
      // high clouds drifting
      for (let i = 0; i < 5; i++) {
        const x = StageKit.wrap(U.hash(i * 17 + 3) * 2000 + t * 0.08 * (0.5 + U.hash(i * 5 + 3)) - (c.x - 1000) * 0.06, -300, 2000);
        StageKit.spr(ctx, c, m, cloudSprites[i % 3], x, 160 + U.hash(i * 29 + 3) * 70 + c.y * 0.15);
      }
      // airplane with blinking light, crossing every ~50 s
      {
        const p = (t % 3000) / 3000, x = -150 + p * 1600 - (c.x - 1000) * 0.05, y = 205 - p * 25 + c.y * 0.15;
        ctx.fillStyle = 'rgba(70,40,90,0.55)';
        ctx.fillRect(x - 9, y - 1.5, 18, 3);
        ctx.fillRect(x - 2, y - 5, 4, 10);
        if (t % 50 < 6) Draw.circle(ctx, x + 9, y, 2.5, '#ff4d6d', 0);
      }
      let off = StageKit.draw(ctx, c, far, m);
      if (farW) {
        StageKit.flicker(ctx, farW.wins, off, t, '#5a2f73');
        for (let i = 0; i < farW.tips.length; i++) {
          if ((t + i * 37) % 90 < 45) continue;
          const [x, y] = farW.tips[i];
          const sx = x + off.x;
          if (sx < -40 || sx > 1320) continue;
          ctx.globalAlpha = 0.35;
          Draw.circle(ctx, sx, y + off.y, 6, '#ff5a5a', 0);
          ctx.globalAlpha = 1;
          Draw.circle(ctx, sx, y + off.y, 2.2, '#ff8080', 0);
        }
      }
      // lower clouds
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 3; i++) {
        const x = StageKit.wrap(U.hash(i * 17 + 9) * 2000 + t * 0.15 * (0.5 + U.hash(i * 5 + 9)) - (c.x - 1000) * 0.15, -300, 2000);
        StageKit.spr(ctx, c, m, cloudSprites[(i + 1) % 3], x, 330 + U.hash(i * 29 + 9) * 50 + c.y * 0.3);
      }
      ctx.globalAlpha = 1;
      // birds (a small flock every ~25 s)
      {
        const cyc = t % 1500;
        if (cyc < 700) {
          const p = cyc / 700;
          ctx.strokeStyle = 'rgba(45,25,70,0.75)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const bx = 1400 - p * 1700 + i * 26 + (i % 2) * 10 - (c.x - 1000) * 0.2, by = 270 + Math.sin(p * 6 + i) * 6 + (i % 3) * 12 + c.y * 0.3;
            const flap = Math.sin(t * 0.35 + i * 1.3) * 4;
            ctx.moveTo(bx - 6, by - flap);
            ctx.lineTo(bx, by);
            ctx.lineTo(bx + 6, by - flap);
          }
          ctx.stroke();
        }
      }
      off = StageKit.draw(ctx, c, near, m);
      if (nearW) StageKit.flicker(ctx, nearW.wins, off, t, '#3d2257');
      // rooftop
      StageKit.draw(ctx, c, wall, m);
      const L = (x) => x - c.x + 640;
      // AC fan
      const ax = L(1700) + 105, ay = gy - 115;
      if (ax > -60 && ax < 1340) {
        ctx.fillStyle = INK;
        const r = t * 0.2;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = r + (i * TAU) / 3, ca = Math.cos(a), sa = Math.sin(a);
          ctx.moveTo(ax - sa * 3, ay + ca * 3);
          ctx.lineTo(ax - sa * 3 + ca * 22, ay + ca * 3 + sa * 22);
          ctx.lineTo(ax + sa * 3 + ca * 22, ay - ca * 3 + sa * 22);
          ctx.lineTo(ax + sa * 3, ay - ca * 3);
        }
        ctx.fill();
        Draw.circle(ctx, ax, ay, 5, '#b9b3cf', 2);
      }
      // vent steam
      const vx = L(-40) + 13;
      if (vx > -100 && vx < 1380) {
        ctx.fillStyle = '#efe4ff';
        for (let i = 0; i < 5; i++) {
          const p = ((t * 0.6 + i * 40) % 200) / 200;
          ctx.globalAlpha = 0.45 * (1 - p);
          ctx.beginPath();
          ctx.arc(vx + Math.sin(p * 5 + i) * 8 + p * 30, gy - 184 - p * 120, 7 + p * 18, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // string-light bulbs
      for (let i = 0; i < POSTS.length - 1; i++) {
        const x1 = L(POSTS[i]), x2 = L(POSTS[i + 1]);
        if (x2 < -60 || x1 > 1340) continue;
        const y1 = gy - 190;
        for (let k = 1; k < 9; k++) {
          const u = k / 9, bx = x1 + (x2 - x1) * u, by = y1 + 2 * (1 - u) * u * 60 + 6;
          const on = (Math.floor(t / 20) + k + i) % 3 !== 0;
          const col = bulbCols[(k + i) % 3];
          if (on) {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(bx, by, 12, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          Draw.circle(ctx, bx, by, 5, on ? col : '#5a4a6a', 2);
        }
      }
      // floor
      StageKit.draw(ctx, c, floor, m);
      StageKit.floorSeams(ctx, c, gy, { step: 120, spread: 1.6, y1: 760 + c.y });
    },
  };
});

// Shared painting helpers for the stages below.
const StageArt = {
  // y of a StageKit.ridgePath silhouette at x (same formula)
  ridgeY(x, baseY, amp, seed, f1 = 0.004) {
    const n = Math.sin(x * f1 + seed) * 0.55 + Math.sin(x * f1 * 2.3 + seed * 1.7) * 0.3 + Math.sin(x * f1 * 5.1 + seed * 2.9) * 0.15;
    return baseY - amp * (0.5 + n * 0.5);
  },
  // small tufts of grass along a line
  tufts(g, x0, x1, y, col, seed, every = 26) {
    g.fillStyle = col;
    for (let x = x0, i = 0; x < x1; x += every * (0.6 + U.hash(seed + i) * 0.8), i++) {
      const h = 6 + U.hash(seed * 3 + i) * 10;
      g.beginPath();
      g.moveTo(x - 5, y);
      g.lineTo(x - 2, y - h);
      g.lineTo(x, y - 2);
      g.lineTo(x + 3, y - h * 0.8);
      g.lineTo(x + 6, y);
      g.closePath();
      g.fill();
    }
  },
  // sprinkled dots (pebbles, sprinkles, flowers)
  speckle(g, x0, x1, y0, y1, n, cols, seed, w = 3, h = 1.6, rot = true) {
    for (let i = 0; i < n; i++) {
      const x = x0 + U.hash(seed + i * 4.1) * (x1 - x0), y = y0 + U.hash(seed * 2 + i * 6.7) * (y1 - y0);
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.ellipse(x, y, w, h, rot ? U.hash(seed * 5 + i) * Math.PI : 0, 0, TAU);
      g.fill();
    }
  },
};

// ===========================================================================
// 2. SUGARPLUM PARK (Mochi)
// ===========================================================================
defineLazyStage({ id: 'candy', name: 'Sugarplum Park', music: 'candy', thumbColors: ['#ffb3d9', '#8fd3ff'], haze: 'rgba(255,255,255,0.12)' }, () => {
  const SKY = [[0, '#74c4ff'], [0.42, '#aee0ff'], [0.72, '#ffd6ef'], [1, '#fff1dc']];
  const WHEEL = { x: 1150, y: 352, r: 112 };

  const sky = StageKit.layer({
    f: 0.03,
    fy: 0.12,
    y0: -40,
    y1: 700,
    paint(g, L) {
      const W = L.x1 - L.x0;
      StageKit.vgrad(g, L.x0, 0, W, 720, SKY);
      g.fillStyle = SKY[0][1];
      g.fillRect(L.x0, L.y0, W, -L.y0 + 1);
      // rainbow
      const cols = ['#ff9db5', '#ffc48a', '#ffe98a', '#b4f0a8', '#9cd8ff', '#c9b0ff'];
      g.globalAlpha = 0.5;
      for (let i = 0; i < cols.length; i++) {
        g.strokeStyle = cols[i];
        g.lineWidth = 20;
        g.beginPath();
        g.arc(560, 600, 470 - i * 20, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      }
      g.globalAlpha = 1;
      // a soft sun
      StageKit.glow(g, 1010, 130, 170, '#fffbe0', 0.95, 20);
      Draw.circle(g, 1010, 130, 46, '#fff6bd', 0);
    },
  });

  const cloudSprites = [0, 1, 2].map((i) =>
    StageKit.sprite({
      w: 300,
      h: 110,
      ax: 150,
      ay: 100,
      paint(g) {
        StageKit.cloud(g, 150, 100, [260, 210, 170][i], [78, 64, 54][i], 3 + i * 9, '#ffffff', 'rgba(255,190,225,0.55)', 0, INK, 'rgba(255,255,255,0.9)');
      },
    })
  );

  // strawberry ice-cream mountains with dripping frosting
  const hills = StageKit.layer({
    f: 0.1,
    fy: 0.3,
    y0: 260,
    y1: 760,
    paint(g, L) {
      const layer = (base, amp, seed, f1, col, frost, dark) => {
        g.beginPath();
        StageKit.ridgePath(g, L.x0, L.x1, base, amp, seed, { freq: f1, step: 8 });
        g.fillStyle = col;
        g.fill();
        g.save();
        g.clip();
        g.fillStyle = dark;
        for (let x = L.x0; x < L.x1; x += 140) {
          g.beginPath();
          g.ellipse(x + 70, StageArt.ridgeY(x + 70, base, amp, seed, f1) + 120, 40, 120, 0.3, 0, TAU);
          g.fill();
        }
        // frosting band with drips
        g.fillStyle = frost;
        g.beginPath();
        for (let x = L.x0; x <= L.x1 + 8; x += 8) g.lineTo(x, StageArt.ridgeY(x, base, amp, seed, f1) - 2);
        for (let x = L.x1 + 8; x >= L.x0; x -= 8) {
          const drip = Math.max(0, Math.sin(x * 0.045 + seed) * 22) + Math.max(0, Math.sin(x * 0.11 + seed * 2) * 9);
          g.lineTo(x, StageArt.ridgeY(x, base, amp, seed, f1) + 16 + drip);
        }
        g.closePath();
        g.fill();
        g.restore();
      };
      layer(470, 190, 1.3, 0.0055, '#f6a3cd', '#fff6fb', 'rgba(220,110,170,0.25)');
      layer(540, 120, 4.1, 0.007, '#a8e6cf', '#ffffff', 'rgba(70,170,140,0.2)');
      // sprinkles on the mint hills
      g.save();
      g.beginPath();
      StageKit.ridgePath(g, L.x0, L.x1, 540, 120, 4.1, { freq: 0.007, step: 8 });
      g.clip();
      StageArt.speckle(g, L.x0, L.x1, 440, 760, 260, ['#ff6fa8', '#ffd23f', '#7fc8ff', '#b892ff'], 7, 4, 1.4);
      g.restore();
    },
  });

  // gumdrops, lollipop trees, a cake castle and the Ferris wheel's frame
  const mid = StageKit.layer({
    f: 0.32,
    fy: 0.55,
    y0: 180,
    y1: 760,
    paint(g, L) {
      const gy = 560;
      // cake castle
      const cx = 380;
      const tower = (x, w, h, roof) => {
        Draw.roundRect(g, x - w / 2, gy - h, w, h, 6, '#ffe3ef', 3);
        g.fillStyle = '#ff9ec7';
        g.fillRect(x - w / 2 + 2, gy - h + 10, w - 4, 8);
        for (let i = 0; i < w / 12 - 1; i++) Draw.circle(g, x - w / 2 + 10 + i * 12, gy - h + 22, 3, '#ffffff', 0);
        Draw.poly(g, [x - w / 2 - 8, gy - h, x, gy - h - roof, x + w / 2 + 8, gy - h], '#c58bff', 3);
        Draw.circle(g, x, gy - h - roof - 8, 8, '#ff4d6d', 3);
        Draw.roundRect(g, x - 6, gy - h * 0.55, 12, 18, 6, '#7a4fa8', 2);
      };
      tower(cx - 70, 50, 150, 60);
      tower(cx + 70, 50, 160, 66);
      Draw.roundRect(g, cx - 60, gy - 120, 120, 120, 8, '#fff0f6', 3);
      g.fillStyle = '#ffb3d1';
      g.fillRect(cx - 58, gy - 120, 116, 14);
      Draw.roundRect(g, cx - 16, gy - 50, 32, 50, 16, '#a26b47', 3);
      tower(cx, 64, 210, 80);
      // gumdrop bushes
      const gum = ['#ff6f9f', '#ffd23f', '#7fd8a8', '#8fb8ff', '#c49bff'];
      for (let i = 0; i < 26; i++) {
        const x = L.x0 + 30 + i * ((L.x1 - L.x0) / 26) + U.hash(i * 3.3) * 30, r = 18 + U.hash(i * 1.7) * 14;
        g.beginPath();
        g.moveTo(x - r, gy + 6);
        g.quadraticCurveTo(x - r, gy - r * 1.4, x, gy - r * 1.4);
        g.quadraticCurveTo(x + r, gy - r * 1.4, x + r, gy + 6);
        g.closePath();
        Draw.fillStroke(g, gum[i % gum.length], 3);
        StageArt.speckle(g, x - r * 0.6, x + r * 0.6, gy - r * 1.1, gy - 4, 6, ['rgba(255,255,255,0.7)'], i * 9, 1.6, 1.6, false);
      }
      // lollipop trees
      for (const [x, s, c] of [[-120, 1, '#ff6f9f'], [760, 1.2, '#7fd8a8'], [1500, 1.05, '#ffb03f'], [1760, 0.9, '#8fb8ff']]) {
        Draw.roundRect(g, x - 5 * s, gy - 170 * s, 10 * s, 170 * s, 4, '#ffffff', 3);
        const r = 48 * s, cy = gy - 170 * s - r * 0.7;
        Draw.circle(g, x, cy, r, c, 3);
        g.strokeStyle = '#ffffff';
        g.lineWidth = 7 * s;
        g.beginPath();
        for (let a = 0; a < 10; a += 0.25) g.lineTo(x + Math.cos(a) * a * r * 0.09, cy + Math.sin(a) * a * r * 0.09);
        g.stroke();
      }
      // Ferris wheel frame (the wheel turns per frame)
      const W = WHEEL;
      Draw.line(g, W.x, W.y, W.x - 70, gy, 9, '#ffffff', 3);
      Draw.line(g, W.x, W.y, W.x + 70, gy, 9, '#ffffff', 3);
      Draw.roundRect(g, W.x - 90, gy - 10, 180, 14, 6, '#ff9ec7', 3);
      // ground strip
      g.fillStyle = '#9fe0c4';
      g.fillRect(L.x0, gy, L.x1 - L.x0, 200);
      g.fillStyle = INK;
      g.fillRect(L.x0, gy, L.x1 - L.x0, 3);
    },
  });

  // candy-cane fence, giant lollipops and an ice-cream stand (moves with the fighters)
  const fence = StageKit.layer({
    f: 1,
    y0: 300,
    y1: 640,
    text: true,
    paint(g, L) {
      const gy = GROUND_Y, X = (x) => x - 360;
      // hedge of cotton candy behind the fence
      g.fillStyle = '#ffc6e2';
      for (let x = L.x0 - 40; x < L.x1 + 40; x += 46) {
        const r = 34 + U.hash(x * 0.37) * 16;
        g.beginPath();
        g.arc(x, gy - 64, r, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#ffd9ec';
      for (let x = L.x0 - 20; x < L.x1 + 40; x += 58) {
        g.beginPath();
        g.arc(x, gy - 78, 20 + U.hash(x * 0.71) * 10, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#ffb3d6';
      g.fillRect(L.x0, gy - 50, L.x1 - L.x0, 50);
      // fence rails + candy-cane posts
      Draw.roundRect(g, L.x0, gy - 86, L.x1 - L.x0, 12, 4, '#ffffff', 3);
      Draw.roundRect(g, L.x0, gy - 50, L.x1 - L.x0, 12, 4, '#ffffff', 3);
      for (let x = -600; x < 2600; x += 70) {
        const px = X(x);
        if (px < L.x0 - 20 || px > L.x1 + 20) continue;
        Draw.roundRect(g, px - 7, gy - 108, 14, 108, 7, '#ffffff', 3);
        g.save();
        g.beginPath();
        Draw.roundRectPath(g, px - 7, gy - 108, 14, 108, 7);
        g.clip();
        g.strokeStyle = '#ff4d6d';
        g.lineWidth = 5;
        g.beginPath();
        for (let y = gy - 120; y < gy + 10; y += 14) {
          g.moveTo(px - 10, y);
          g.lineTo(px + 10, y - 10);
        }
        g.stroke();
        g.restore();
      }
      // giant lollipops
      for (const [x, c1, c2] of [[140, '#ff6f9f', '#ffffff'], [1880, '#7fc8ff', '#ffffff']]) {
        const px = X(x);
        Draw.roundRect(g, px - 7, gy - 250, 14, 250, 5, '#ffffff', 3);
        Draw.circle(g, px, gy - 290, 62, c1, 4);
        g.save();
        g.beginPath();
        g.arc(px, gy - 290, 60, 0, TAU);
        g.clip();
        g.strokeStyle = c2;
        g.lineWidth = 12;
        g.beginPath();
        for (let a = 0; a < 12; a += 0.2) g.lineTo(px + Math.cos(a) * a * 5.2, gy - 290 + Math.sin(a) * a * 5.2);
        g.stroke();
        g.restore();
        Draw.circle(g, px - 20, gy - 312, 10, 'rgba(255,255,255,0.6)', 0);
        // bow on the stick
        Draw.poly(g, [px, gy - 222, px - 26, gy - 236, px - 26, gy - 208], '#ffd23f', 3);
        Draw.poly(g, [px, gy - 222, px + 26, gy - 236, px + 26, gy - 208], '#ffd23f', 3);
        Draw.circle(g, px, gy - 222, 6, '#ffb000', 3);
      }
      // ice-cream stand
      const sx = X(1290);
      Draw.roundRect(g, sx - 70, gy - 120, 140, 96, 10, '#fff4e0', 4);
      for (let i = 0; i < 7; i++) {
        g.fillStyle = i % 2 ? '#ffffff' : '#ff8fb6';
        g.fillRect(sx - 80 + i * 23, gy - 160, 23, 30);
      }
      g.strokeStyle = INK;
      g.lineWidth = 4;
      g.strokeRect(sx - 80, gy - 160, 161, 30);
      for (let i = 0; i < 7; i++) {
        g.fillStyle = i % 2 ? '#ffffff' : '#ff8fb6';
        g.beginPath();
        g.arc(sx - 80 + i * 23 + 11.5, gy - 130, 11.5, 0, Math.PI);
        g.fill();
      }
      Draw.roundRect(g, sx - 76, gy - 168, 6, 56, 3, '#ffffff', 3);
      Draw.roundRect(g, sx + 70, gy - 168, 6, 56, 3, '#ffffff', 3);
      Draw.text(g, 'ICE CREAM', sx, gy - 96, { size: 20, fill: '#ff5f9e', lw: 5, stroke: '#ffffff' });
      // giant cone with scoops on the roof
      Draw.poly(g, [sx - 20, gy - 196, sx + 20, gy - 196, sx, gy - 160], '#e8b06a', 3);
      Draw.circle(g, sx, gy - 206, 20, '#ffe3ef', 3);
      Draw.circle(g, sx - 4, gy - 226, 16, '#9fe0c4', 3);
      Draw.circle(g, sx + 2, gy - 244, 7, '#ff4d6d', 3);
      Draw.roundRect(g, sx - 60, gy - 64, 120, 40, 8, '#ffd6e8', 3);
    },
  });

  const floor = StageKit.layer({
    f: 1,
    y0: GROUND_Y - 3,
    y1: 780,
    paint(g, L) {
      const gy = GROUND_Y, W = L.x1 - L.x0;
      // biscuit path with icing edge and sprinkles
      StageKit.vgrad(g, L.x0, gy, W, 150, [[0, '#ffd9a8'], [1, '#f0b878']], gy, 760);
      g.fillStyle = 'rgba(160,90,40,0.18)';
      for (let i = 0; i < 70; i++) {
        const x = L.x0 + U.hash(i * 3.9) * W, y = gy + 18 + U.hash(i * 7.3) * 110;
        g.beginPath();
        g.arc(x, y, 2 + U.hash(i) * 2.5, 0, TAU);
        g.fill();
      }
      StageArt.speckle(g, L.x0, L.x1, gy + 14, gy + 130, 220, ['#ff6fa8', '#ffd23f', '#7fc8ff', '#b892ff', '#7fd8a8', '#ffffff'], 21, 5, 1.6);
      // icing at the edge
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(L.x0, gy);
      for (let x = L.x0; x <= L.x1; x += 10) g.lineTo(x, gy + 8 + Math.max(0, Math.sin(x * 0.06) * 8) + Math.max(0, Math.sin(x * 0.17) * 3));
      g.lineTo(L.x1, gy);
      g.closePath();
      g.fill();
      g.fillStyle = INK;
      g.fillRect(L.x0, gy - 2, W, 5);
    },
  });

  const balloonCols = ['#ff5f8f', '#ffd23f', '#7fc8ff', '#b892ff', '#7fd8a8'];

  return {
    draw(ctx, cam, t) {
      const c = StageKit.cam(cam);
      const m = ctx.getTransform();
      const gy = GROUND_Y + c.y;
      ctx.fillStyle = SKY[0][1];
      ctx.fillRect(-300, -400, 1900, 400 + sky.y0 + c.y * sky.fy + 2);
      StageKit.draw(ctx, c, sky, m);
      for (let i = 0; i < 5; i++) {
        const x = StageKit.wrap(U.hash(i * 13 + 1) * 2000 + t * 0.12 * (0.5 + U.hash(i * 7 + 1)) - (c.x - 1000) * 0.06, -300, 2000);
        StageKit.spr(ctx, c, m, cloudSprites[i % 3], x, 120 + U.hash(i * 31 + 2) * 120 + c.y * 0.15);
      }
      StageKit.draw(ctx, c, hills, m);
      // balloons drifting up behind the park
      for (let i = 0; i < 5; i++) {
        const p = ((t * 0.0012 * (0.7 + U.hash(i * 5.5) * 0.6) + U.hash(i * 3.1)) % 1);
        const x = StageKit.lx(c, -100 + U.hash(i * 9.7) * 1500, 0.2) + Math.sin(t * 0.02 + i) * 14;
        const y = 600 - p * 640 + c.y * 0.4;
        if (y < -60) continue;
        ctx.strokeStyle = 'rgba(29,20,40,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y + 18);
        ctx.quadraticCurveTo(x + 6, y + 34, x - 2, y + 50);
        ctx.stroke();
        Draw.ellipse(ctx, x, y, 14, 17, 0, balloonCols[i % 5], 3);
        Draw.circle(ctx, x - 5, y - 6, 3.5, 'rgba(255,255,255,0.7)', 0);
      }
      const off = StageKit.draw(ctx, c, mid, m);
      // Ferris wheel
      {
        const wx = WHEEL.x + off.x, wy = WHEEL.y + off.y, R = WHEEL.r, rot = t * 0.004;
        if (wx > -200 && wx < 1480) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = rot + (i * TAU) / 8;
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx + Math.cos(a) * R, wy + Math.sin(a) * R);
          }
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(wx, wy, R, 0, TAU);
          ctx.lineWidth = 9;
          ctx.stroke();
          ctx.strokeStyle = '#ff9ec7';
          ctx.lineWidth = 4;
          ctx.stroke();
          for (let i = 0; i < 8; i++) {
            const a = rot + (i * TAU) / 8, x = wx + Math.cos(a) * R, y = wy + Math.sin(a) * R;
            Draw.roundRect(ctx, x - 11, y, 22, 18, 6, balloonCols[i % 5], 3);
            Draw.line(ctx, x, y - 2, x, y + 2, 2, INK, 0);
          }
          Draw.circle(ctx, wx, wy, 11, '#ffd23f', 3);
        }
      }
      StageKit.draw(ctx, c, fence, m);
      // butterflies
      for (let i = 0; i < 2; i++) {
        const x = StageKit.wx(c, 600 + i * 800 + Math.sin(t * 0.011 + i * 3) * 220), y = gy - 150 - Math.abs(Math.sin(t * 0.03 + i)) * 60;
        const flap = Math.abs(Math.sin(t * 0.4 + i));
        ctx.fillStyle = i ? '#ffd23f' : '#ff8fb6';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(x + s * 6 * flap, y - 3, 7 * flap + 1, 6, s * 0.4, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      }
      StageKit.draw(ctx, c, floor, m);
      StageKit.floorSeams(ctx, c, gy + 6, { step: 150, spread: 1.7, y1: 760 + c.y, color: 'rgba(160,90,40,0.18)' });
    },
  };
});

// ===========================================================================
// 3. THE MAIN EVENT (Bruno)
// ===========================================================================
defineLazyStage({ id: 'arena', name: 'The Main Event', music: 'arena', thumbColors: ['#ff5a5a', '#1b1640'], haze: 'rgba(236,226,255,0.15)' }, () => {
  const BG = [[0, '#0d0a24'], [0.5, '#1d1545'], [1, '#33205e']];
  const SHIRTS = ['#ff5a5a', '#ffd23f', '#5ad1ff', '#7fe3a8', '#ff8fd0', '#b892ff', '#ffffff', '#ff9f43'];
  const SKIN = ['#f7c9a3', '#e0a98a', '#b9805c', '#8a5a3c', '#ffdcc2'];

  const back = StageKit.layer({
    f: 0.05,
    fy: 0.15,
    y0: -60,
    y1: 520,
    text: true,
    paint(g, L) {
      const W = L.x1 - L.x0;
      StageKit.vgrad(g, L.x0, L.y0, W, 600, BG);
      // roof truss with stage lights
      g.fillStyle = '#2a2350';
      g.fillRect(L.x0, 20, W, 16);
      g.fillRect(L.x0, 64, W, 10);
      g.strokeStyle = '#2a2350';
      g.lineWidth = 5;
      g.beginPath();
      for (let x = L.x0; x < L.x1; x += 44) {
        g.moveTo(x, 36);
        g.lineTo(x + 22, 64);
        g.lineTo(x + 44, 36);
      }
      g.stroke();
      for (let x = L.x0 + 40; x < L.x1; x += 120) {
        Draw.roundRect(g, x - 12, 72, 24, 22, 6, '#4a4270', 3);
        StageKit.glow(g, x, 96, 40, '#fff2c4', 0.5, 2);
        Draw.circle(g, x, 92, 7, '#fff6d6', 0);
      }
      // jumbotron
      const jx = 640;
      Draw.roundRect(g, jx - 210, 112, 420, 170, 16, '#262046', 5);
      Draw.roundRect(g, jx - 196, 124, 392, 146, 10, '#120c2a', 3);
      g.save();
      g.beginPath();
      Draw.roundRectPath(g, jx - 196, 124, 392, 146, 10);
      g.clip();
      g.fillStyle = 'rgba(255,90,90,0.18)';
      for (let i = 0; i < 12; i++) {
        g.beginPath();
        g.moveTo(jx, 197);
        g.arc(jx, 197, 300, (i / 12) * TAU, (i / 12) * TAU + 0.26);
        g.fill();
      }
      g.restore();
      Draw.text(g, 'KERFUFFLE!', jx, 180, { size: 54, fill: '#ffd23f', lw: 9, extrude: 5, extrudeColor: '#b3263f' });
      Draw.text(g, 'CHAMPIONSHIP NIGHT', jx, 240, { size: 26, fill: '#ffffff', lw: 6 });
      Draw.roundRect(g, jx - 8, 282, 16, 30, 4, '#262046', 3);
      // banners
      for (const [x, txt, col] of [[250, 'BRUNO #1', '#ff5a5a'], [1030, 'POW!', '#5ad1ff']]) {
        Draw.line(g, x - 60, 74, x - 60, 150, 3, '#8a82b8', 2);
        Draw.line(g, x + 60, 74, x + 60, 150, 3, '#8a82b8', 2);
        Draw.poly(g, [x - 76, 150, x + 76, 150, x + 76, 262, x, 240, x - 76, 262], col, 4);
        Draw.text(g, txt, x, 198, { size: 30, fill: '#ffffff', lw: 6 });
      }
    },
  });

  // crowd rows (cached separately so they can bounce independently)
  const crowdRow = (seed, base, scale, shade, fy) =>
    StageKit.layer({
      f: 0.12 + scale * 0.14,
      fy,
      y0: base - 90 * scale,
      y1: base + 260,
      text: true,
      paint(g, L) {
        g.fillStyle = shade;
        g.fillRect(L.x0, base - 6 * scale, L.x1 - L.x0, 300);
        const step = 34 * scale;
        let i = 0;
        for (let x = L.x0 + U.hash(seed) * step; x < L.x1; x += step * (0.8 + U.hash(seed + i * 1.3) * 0.4), i++) {
          const h = U.hash(seed * 7 + i);
          const y = base - (h * 10) * scale;
          const sc = scale * (0.9 + U.hash(seed * 3 + i) * 0.2);
          // body
          g.fillStyle = U.shade(SHIRTS[Math.floor(h * SHIRTS.length)], -0.35 + scale * 0.25);
          g.beginPath();
          g.ellipse(x, y + 26 * sc, 17 * sc, 22 * sc, 0, 0, TAU);
          g.fill();
          // raised arms on some
          if (U.hash(seed * 11 + i) < 0.3) {
            g.strokeStyle = g.fillStyle;
            g.lineWidth = 6 * sc;
            g.lineCap = 'round';
            g.beginPath();
            g.moveTo(x - 10 * sc, y + 14 * sc);
            g.lineTo(x - 18 * sc, y - 16 * sc);
            g.moveTo(x + 10 * sc, y + 14 * sc);
            g.lineTo(x + 18 * sc, y - 16 * sc);
            g.stroke();
          }
          // head
          g.fillStyle = U.shade(SKIN[Math.floor(U.hash(seed * 5 + i) * SKIN.length)], -0.4 + scale * 0.3);
          g.beginPath();
          g.arc(x, y, 11 * sc, 0, TAU);
          g.fill();
          // signs
          if (U.hash(seed * 13 + i) < 0.06) {
            const sw = 60 * sc, sh = 36 * sc;
            Draw.roundRect(g, x - sw / 2, y - 62 * sc, sw, sh, 4, '#fff8e6', 2.5);
            Draw.text(g, ['♥', 'WOW', 'GO!', '10/10'][Math.floor(U.hash(seed * 17 + i) * 4)], x, y - 44 * sc, { size: 16 * sc, fill: '#ff4d6d', lw: 0 });
            Draw.line(g, x, y - 26 * sc, x, y - 4 * sc, 3, '#c9b28a', 2);
          }
        }
      },
    });
  const rows = [crowdRow(3, 300, 0.7, '#1b1540', 0.25), crowdRow(7, 360, 0.85, '#211a4a', 0.32), crowdRow(11, 430, 1, '#281f55', 0.4)];

  // barricade + ring ropes (moves with the fighters)
  const POSTS = [70, 1930];
  const ring = StageKit.layer({
    f: 1,
    y0: 360,
    y1: 640,
    text: true,
    paint(g, L) {
      const gy = GROUND_Y, X = (x) => x - 360;
      // steel barricade behind the ring
      g.fillStyle = '#3a3366';
      g.fillRect(L.x0, gy - 120, L.x1 - L.x0, 60);
      g.fillStyle = '#5a5290';
      g.fillRect(L.x0, gy - 124, L.x1 - L.x0, 8);
      g.fillStyle = INK;
      g.fillRect(L.x0, gy - 126, L.x1 - L.x0, 3);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (let x = -600; x < 2600; x += 90) g.fillRect(X(x), gy - 116, 4, 56);
      // ring apron behind the fighters (the far side of the ring)
      g.fillStyle = '#c4313f';
      g.fillRect(L.x0, gy - 60, L.x1 - L.x0, 60);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(L.x0, gy - 60, L.x1 - L.x0, 10);
      for (let x = -400; x < 2400; x += 520) Draw.text(g, '★ KERFUFFLE ★', X(x), gy - 28, { size: 28, fill: '#ffd23f', lw: 6 });
      // corner posts + turnbuckles
      for (const p of POSTS) {
        const px = X(p);
        Draw.roundRect(g, px - 10, gy - 200, 20, 200, 5, '#c9c9d6', 4);
        for (const [y, col] of [[gy - 178, '#ff4d6d'], [gy - 136, '#ffffff'], [gy - 94, '#4d8dff']]) Draw.roundRect(g, px - 14, y - 10, 28, 20, 8, col, 3);
      }
      // ropes
      for (const [y, col] of [[gy - 178, '#ff4d6d'], [gy - 136, '#ffffff'], [gy - 94, '#4d8dff']]) {
        g.strokeStyle = INK;
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(X(POSTS[0]), y);
        g.lineTo(X(POSTS[1]), y);
        g.stroke();
        g.strokeStyle = col;
        g.lineWidth = 5;
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.4)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(X(POSTS[0]), y - 1.5);
        g.lineTo(X(POSTS[1]), y - 1.5);
        g.stroke();
      }
    },
  });

  const mat = StageKit.layer({
    f: 1,
    y0: GROUND_Y - 3,
    y1: 780,
    text: true,
    paint(g, L) {
      const gy = GROUND_Y, W = L.x1 - L.x0, X = (x) => x - 360;
      StageKit.vgrad(g, L.x0, gy, W, 70, [[0, '#dfe6f2'], [1, '#b9c4dc']], gy, gy + 70);
      // logo on the canvas
      g.save();
      g.beginPath();
      g.rect(L.x0, gy, W, 70);
      g.clip();
      g.globalAlpha = 0.5;
      Draw.star(g, X(1000), gy + 34, 70, 32, 5, '#ff8f9f', 0, INK, 0);
      g.globalAlpha = 1;
      g.restore();
      g.fillStyle = 'rgba(29,20,40,0.12)';
      for (let i = 0; i < 60; i++) g.fillRect(L.x0 + U.hash(i * 3.3) * W, gy + 6 + U.hash(i * 5.1) * 60, 14, 2);
      // front apron
      g.fillStyle = INK;
      g.fillRect(L.x0, gy + 66, W, 5);
      StageKit.vgrad(g, L.x0, gy + 71, W, 80, [[0, '#d8344a'], [1, '#8a1d34']], gy + 71, gy + 150);
      for (let x = -200; x < 2400; x += 600) Draw.text(g, 'THE MAIN EVENT', X(x), gy + 104, { size: 34, fill: '#ffffff', lw: 7, shadow: '#5a1028', sh: 3 });
      g.fillStyle = INK;
      g.fillRect(L.x0, gy - 2, W, 5);
    },
  });

  return {
    draw(ctx, cam, t) {
      const c = StageKit.cam(cam);
      const m = ctx.getTransform();
      const gy = GROUND_Y + c.y;
      ctx.fillStyle = BG[0][1];
      ctx.fillRect(-300, -400, 1900, 400 + back.y0 + c.y * back.fy + 2);
      StageKit.draw(ctx, c, back, m);
      // jumbotron border chase lights
      {
        const jx = StageKit.lx(c, 640, back.f), jy = 112 + c.y * back.fy;
        for (let i = 0; i < 16; i++) {
          const on = (Math.floor(t / 6) + i) % 4 === 0;
          Draw.circle(ctx, jx - 195 + i * 26, jy + 4, 3.5, on ? '#ffd23f' : '#5a4a8a', 0);
        }
      }
      // crowd rows bounce to the music
      for (let i = 0; i < rows.length; i++) {
        const R = rows[i];
        const bounce = Math.max(0, Math.sin(t * 0.21 + i * 1.7)) * (4 + i * 2);
        StageKit.draw(ctx, { x: c.x, y: c.y - bounce / R.fy, zoom: c.zoom }, R, m);
      }
      // camera flashes in the crowd
      for (let i = 0; i < 4; i++) {
        const cyc = (t + i * 37) % 90;
        if (cyc > 6) continue;
        const k = Math.floor((t + i * 37) / 90);
        const x = StageKit.lx(c, U.hash(k * 7.1 + i) * 1500 - 100, 0.2), y = 300 + U.hash(k * 3.3 + i) * 140 + c.y * 0.3;
        ctx.globalAlpha = 1 - cyc / 7;
        Draw.star(ctx, x, y, 14, 3, 4, '#ffffff', 0, INK, 0.4);
        ctx.globalAlpha = 1;
      }
      // sweeping spotlights
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const sx = StageKit.lx(c, 200 + i * 440, 0.05), sy = -20 + c.y * 0.15;
        const a = Math.sin(t * 0.012 + i * 2.2) * 0.45;
        const tx = sx + Math.tan(a) * 650, ty = gy - 10;
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = i === 1 ? '#fff4c2' : '#c2e6ff';
        ctx.beginPath();
        ctx.moveTo(sx - 14, sy);
        ctx.lineTo(sx + 14, sy);
        ctx.lineTo(tx + 120, ty);
        ctx.lineTo(tx - 120, ty);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.14;
        ctx.beginPath();
        ctx.ellipse(tx, ty + 30, 130, 24, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      StageKit.draw(ctx, c, ring, m);
      StageKit.draw(ctx, c, mat, m);
    },
  };
});

// ===========================================================================
// 4. NEON ALLEY (Volt)
// ===========================================================================
defineLazyStage({ id: 'neon', name: 'Neon Alley', music: 'neon', thumbColors: ['#ff4fd8', '#140c33'], haze: 'rgba(214,200,255,0.17)' }, () => {
  const SKY = [[0, '#0b0722'], [0.45, '#1c1048'], [0.8, '#4a1b62'], [1, '#7a2a6e']];
  const NEON = ['#ff4fd8', '#4ff0ff', '#ffe94f', '#7dff8a', '#ff7a4f'];
  let farW = null;
  const signs = [];

  const glowText = (g, txt, x, y, size, col, rot = 0) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.shadowColor = col;
    g.shadowBlur = 18;
    Draw.text(g, txt, 0, 0, { size, fill: '#ffffff', stroke: col, lw: size * 0.22 });
    g.shadowBlur = 0;
    g.restore();
  };

  const sky = StageKit.layer({
    f: 0.03,
    fy: 0.12,
    y0: -40,
    y1: 700,
    paint(g, L) {
      const W = L.x1 - L.x0;
      StageKit.vgrad(g, L.x0, 0, W, 720, SKY);
      g.fillStyle = SKY[0][1];
      g.fillRect(L.x0, L.y0, W, -L.y0 + 1);
      // a hazy moon behind the smog
      StageKit.glow(g, 300, 150, 150, '#ffd6f4', 0.45, 10);
      Draw.circle(g, 300, 150, 44, '#ffe9f8', 0);
      g.fillStyle = 'rgba(40,20,70,0.55)';
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        Draw.roundRectPath(g, L.x0 + U.hash(i * 3.1) * W, 120 + i * 30, 380, 14, 7);
        g.fill();
      }
    },
  });

  const far = StageKit.layer({
    f: 0.1,
    fy: 0.3,
    y0: 60,
    y1: 760,
    paint(g, L) {
      farW = StageKit.buildings(g, L.x0, L.x1, 520, { seed: 9, minW: 50, maxW: 110, minH: 200, maxH: 420, color: '#1d1440', win: '#6f5cff', winChance: 0.22, roof: true, rim: '#3b2a7a' });
      StageKit.vgrad(g, L.x0, 360, L.x1 - L.x0, 400, [[0, 'rgba(255,79,216,0)'], [1, 'rgba(255,79,216,0.25)']]);
    },
  });

  // big signs on the mid buildings
  const mid = StageKit.layer({
    f: 0.35,
    fy: 0.55,
    y0: 40,
    y1: 760,
    text: true,
    paint(g, L) {
      const gy = 590;
      let x = L.x0 - 30, i = 0;
      while (x < L.x1) {
        const w = 150 + Math.round(U.hash(i * 5.3 + 2) * 120), h = 300 + Math.round(U.hash(i * 2.9 + 1) * 220);
        const top = gy - h;
        g.fillStyle = i % 2 ? '#241850' : '#2c1d5e';
        g.fillRect(x, top, w, h + 200);
        g.fillStyle = '#3a2a7a';
        g.fillRect(x, top, w, 4);
        // windows
        g.fillStyle = 'rgba(120,100,255,0.35)';
        for (let r = 0; r < (h - 40) / 34; r++) {
          for (let cc = 0; cc < (w - 20) / 30; cc++) {
            if (U.hash(i * 31 + r * 7 + cc * 3) < 0.4) g.fillRect(x + 14 + cc * 30, top + 20 + r * 34, 16, 20);
          }
        }
        // fire escape
        if (i % 3 === 1) {
          g.strokeStyle = '#120c2a';
          g.lineWidth = 3;
          for (let r = 0; r < 4; r++) {
            const yy = top + 80 + r * 60;
            g.strokeRect(x + 10, yy, w - 20, 26);
            g.beginPath();
            g.moveTo(x + 14, yy + 26);
            g.lineTo(x + w - 30, yy + 60);
            g.stroke();
          }
        }
        // a neon sign on most buildings
        const kind = i % 5;
        const sx = x + w / 2, sy = top + 70 + U.hash(i * 1.7) * 60;
        const col = NEON[i % NEON.length];
        if (kind === 0) {
          Draw.roundRect(g, sx - 22, sy - 10, 44, 170, 8, '#140c2a', 3);
          for (let k = 0; k < 4; k++) {
            g.save();
            g.shadowColor = col;
            g.shadowBlur = 14;
            g.strokeStyle = col;
            g.lineWidth = 4;
            g.beginPath();
            g.moveTo(sx - 12, sy + 10 + k * 38);
            g.lineTo(sx + 12, sy + 10 + k * 38);
            g.moveTo(sx, sy + 4 + k * 38);
            g.lineTo(sx, sy + 30 + k * 38);
            if (k % 2) {
              g.moveTo(sx - 10, sy + 22 + k * 38);
              g.lineTo(sx + 10, sy + 30 + k * 38);
            }
            g.stroke();
            g.restore();
          }
          signs.push([sx - 22, sy - 10, 44, 170, L.f]);
        } else if (kind === 1) {
          glowText(g, 'RAMEN', sx, sy + 20, 34, col);
          signs.push([sx - 70, sy - 4, 140, 48, L.f]);
        } else if (kind === 2) {
          // robot-head logo
          g.save();
          g.shadowColor = col;
          g.shadowBlur = 16;
          Draw.roundRect(g, sx - 34, sy, 68, 54, 10, 'rgba(0,0,0,0)', 4, col);
          Draw.circle(g, sx - 12, sy + 24, 5, col, 0);
          Draw.circle(g, sx + 12, sy + 24, 5, col, 0);
          Draw.line(g, sx, sy, sx, sy - 18, 3, col, 0);
          g.restore();
          glowText(g, 'ROBO MART', sx, sy + 80, 20, col);
          signs.push([sx - 60, sy - 20, 120, 112, L.f]);
        } else if (kind === 3) {
          glowText(g, '24H', sx, sy + 20, 40, col, -0.05);
          signs.push([sx - 50, sy - 4, 100, 48, L.f]);
        }
        x += w + 6;
        i++;
      }
      // cables across the street
      g.strokeStyle = '#0d0820';
      g.lineWidth = 3;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const x1 = L.x0 + k * 420, y1 = 150 + (k % 3) * 40;
        g.moveTo(x1, y1);
        g.quadraticCurveTo(x1 + 210, y1 + 70, x1 + 420, y1 + 10);
      }
      g.stroke();
    },
  });

  // street-level shopfronts behind the fighters
  const street = StageKit.layer({
    f: 1,
    y0: 240,
    y1: 640,
    text: true,
    paint(g, L) {
      const gy = GROUND_Y, X = (x) => x - 360;
      g.fillStyle = '#1b1238';
      g.fillRect(L.x0, gy - 214, L.x1 - L.x0, 214);
      g.fillStyle = '#2b1d55';
      g.fillRect(L.x0, gy - 220, L.x1 - L.x0, 10);
      g.fillStyle = INK;
      g.fillRect(L.x0, gy - 222, L.x1 - L.x0, 3);
      // shutters with striped awnings
      for (let x = -600; x < 2600; x += 360) {
        const px = X(x);
        if (px < L.x0 - 400 || px > L.x1 + 40) continue;
        Draw.roundRect(g, px + 20, gy - 170, 300, 170, 4, '#3d3466', 4);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        for (let y = gy - 162; y < gy; y += 12) g.fillRect(px + 24, y, 292, 3);
        const col = ['#ff4fd8', '#4ff0ff', '#ffe94f'][((Math.round(x / 360) % 3) + 3) % 3];
        Draw.poly(g, [px + 6, gy - 172, px + 334, gy - 172, px + 314, gy - 204, px + 26, gy - 204], col, 4);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (let k = 0; k < 8; k++) g.fillRect(px + 36 + k * 38, gy - 202, 14, 28);
      }
      // graffiti
      g.save();
      g.translate(X(520), gy - 120);
      g.rotate(-0.05);
      Draw.text(g, 'BZZT!', 0, 0, { size: 56, fill: '#7dff8a', stroke: '#140c2a', lw: 10, shadow: '#ff4fd8', sh: 5 });
      g.restore();
      g.save();
      g.translate(X(1440), gy - 110);
      g.rotate(0.04);
      Draw.text(g, 'V0LT', 0, 0, { size: 50, fill: '#ffe94f', stroke: '#140c2a', lw: 10, shadow: '#4ff0ff', sh: 5 });
      g.restore();
      // vending machine
      const vx = X(980);
      Draw.roundRect(g, vx - 50, gy - 186, 100, 186, 10, '#e8e8f5', 4);
      Draw.roundRect(g, vx - 40, gy - 176, 80, 104, 6, '#9fe8ff', 3);
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < 4; k++) Draw.roundRect(g, vx - 34 + k * 18, gy - 168 + r * 32, 12, 24, 4, NEON[(r + k) % 5], 2);
      }
      Draw.roundRect(g, vx - 30, gy - 56, 60, 20, 4, '#2b2550', 3);
      Draw.roundRect(g, vx + 20, gy - 110, 12, 24, 3, '#ffd23f', 2);
      // trash cans
      for (const tx of [1260, 1310]) {
        const px = X(tx);
        Draw.roundRect(g, px - 22, gy - 66, 44, 66, 6, '#5a5a7a', 4);
        Draw.roundRect(g, px - 26, gy - 74, 52, 12, 5, '#6e6e90', 4);
        g.fillStyle = 'rgba(0,0,0,0.2)';
        for (let k = 0; k < 3; k++) g.fillRect(px - 14 + k * 12, gy - 56, 4, 46);
      }
      // manhole steam pipe at the left
      Draw.roundRect(g, X(250) - 14, gy - 120, 28, 120, 4, '#4a4270', 4);
    },
  });

  const floor = StageKit.layer({
    f: 1,
    y0: GROUND_Y - 3,
    y1: 780,
    paint(g, L) {
      const gy = GROUND_Y, W = L.x1 - L.x0;
      StageKit.vgrad(g, L.x0, gy, W, 150, [[0, '#2a2050'], [1, '#120c28']], gy, 760);
      // neon reflections on the wet street
      for (let i = 0; i < 26; i++) {
        const x = L.x0 + U.hash(i * 7.7) * W, w = 16 + U.hash(i * 3.1) * 40;
        const gr = g.createLinearGradient(0, gy, 0, gy + 120);
        const col = NEON[i % NEON.length];
        gr.addColorStop(0, U.rgba(col, 0.32));
        gr.addColorStop(1, U.rgba(col, 0));
        g.fillStyle = gr;
        g.fillRect(x, gy + 4, w, 120);
      }
      // puddles
      for (let i = 0; i < 8; i++) {
        const x = L.x0 + U.hash(i * 5.9 + 3) * W, y = gy + 30 + U.hash(i * 2.3) * 80;
        g.fillStyle = 'rgba(160,140,255,0.16)';
        g.beginPath();
        g.ellipse(x, y, 60 + U.hash(i) * 50, 9 + U.hash(i * 4) * 6, 0, 0, TAU);
        g.fill();
      }
      // lane markings
      g.fillStyle = 'rgba(255,233,79,0.45)';
      for (let x = L.x0; x < L.x1; x += 180) g.fillRect(x, gy + 70, 90, 6);
      g.fillStyle = INK;
      g.fillRect(L.x0, gy - 2, W, 5);
    },
  });

  return {
    draw(ctx, cam, t) {
      const c = StageKit.cam(cam);
      const m = ctx.getTransform();
      const gy = GROUND_Y + c.y;
      ctx.fillStyle = SKY[0][1];
      ctx.fillRect(-300, -400, 1900, 400 + sky.y0 + c.y * sky.fy + 2);
      StageKit.draw(ctx, c, sky, m);
      let off = StageKit.draw(ctx, c, far, m);
      if (farW) {
        StageKit.flicker(ctx, farW.wins, off, t, '#1d1440', 0.06);
        for (let i = 0; i < farW.tips.length; i++) {
          if ((t + i * 23) % 70 < 35) continue;
          const [x, y] = farW.tips[i];
          Draw.circle(ctx, x + off.x, y + off.y, 2.4, '#ff4d6d', 0);
        }
      }
      // a delivery drone crossing
      {
        const p = (t % 1400) / 1400, x = 1400 - p * 1700 - (c.x - 1000) * 0.2, y = 190 + Math.sin(t * 0.05) * 8 + c.y * 0.25;
        ctx.fillStyle = '#0d0820';
        ctx.fillRect(x - 16, y - 3, 32, 6);
        ctx.fillRect(x - 3, y, 6, 9);
        Draw.circle(ctx, x - 16, y - 4, 2.5, t % 30 < 15 ? '#ff4d6d' : '#4ff0ff', 0);
        Draw.circle(ctx, x + 16, y - 4, 2.5, t % 30 < 15 ? '#4ff0ff' : '#ff4d6d', 0);
      }
      off = StageKit.draw(ctx, c, mid, m);
      // flickering signs (switch off for a moment now and then)
      ctx.fillStyle = 'rgba(20,12,42,0.82)';
      for (let i = 0; i < signs.length; i++) {
        const s = signs[i];
        if (U.hash(i * 9.3 + Math.floor(t / 12)) < 0.06) ctx.fillRect(s[0] + off.x - 6, s[1] + off.y - 6, s[2] + 12, s[3] + 12);
      }
      StageKit.draw(ctx, c, street, m);
      // steam from the pipe
      {
        const vx = StageKit.wx(c, 250);
        if (vx > -100 && vx < 1380) {
          ctx.fillStyle = '#c9b8ff';
          for (let i = 0; i < 5; i++) {
            const p = ((t * 0.7 + i * 40) % 200) / 200;
            ctx.globalAlpha = 0.3 * (1 - p);
            ctx.beginPath();
            ctx.arc(vx + Math.sin(p * 5 + i) * 10, gy - 126 - p * 140, 8 + p * 20, 0, TAU);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
      // vending machine glow pulse
      {
        const vx = StageKit.wx(c, 980);
        if (vx > -100 && vx < 1380) {
          ctx.globalAlpha = 0.12 + 0.06 * Math.sin(t * 0.1);
          ctx.fillStyle = '#9fe8ff';
          ctx.beginPath();
          ctx.ellipse(vx, gy - 60, 120, 80, 0, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      StageKit.draw(ctx, c, floor, m);
      // puddle ripples
      ctx.strokeStyle = 'rgba(200,190,255,0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const p = ((t + i * 23) % 60) / 60;
        const x = StageKit.wx(c, U.hash(i * 4.4 + Math.floor((t + i * 23) / 60)) * 2000), y = gy + 30 + U.hash(i * 7.3) * 90;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath();
        ctx.ellipse(x, y, 4 + p * 26, 1.5 + p * 6, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    drawFront(ctx, cam, t) {
      // rain
      const c = StageKit.cam(cam);
      ctx.strokeStyle = 'rgba(190,200,255,0.35)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 70; i++) {
        const sp = 13 + U.hash(i * 2.7) * 6;
        const x = StageKit.wrap(U.hash(i * 7.1) * 1500 - t * 2.2 - (c.x - 1000) * 0.6, -100, 1500);
        const y = ((U.hash(i * 3.9) * 900 + t * sp) % 900) - 120;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 18);
      }
      ctx.stroke();
    },
  };
});

// ===========================================================================
// 5. MOONLIT BAMBOO (Kiri)
// ===========================================================================
defineLazyStage({ id: 'bamboo', name: 'Moonlit Bamboo', music: 'bamboo', thumbColors: ['#4a6fb5', '#0c1430'], haze: 'rgba(205,226,255,0.17)' }, () => {
  const SKY = [[0, '#070b24'], [0.45, '#15214f'], [0.8, '#2d4682'], [1, '#4a6aa3']];
  const MOON = { x: 820, y: 190, r: 92 };

  // one bamboo stalk: segments with nodes, a few leaf sprays
  const stalk = (g, x, top, bottom, w, col, dark, light, seed, leaves) => {
    const segs = Math.ceil((bottom - top) / (w * 4.2));
    const sh = (bottom - top) / segs;
    for (let i = 0; i < segs; i++) {
      const y = top + i * sh;
      const lean = Math.sin(seed + i * 0.3) * 0.6;
      g.fillStyle = col;
      g.fillRect(x - w / 2 + lean, y, w, sh + 1);
      g.fillStyle = light;
      g.fillRect(x - w / 2 + lean + w * 0.18, y + 3, w * 0.16, sh - 6);
      g.fillStyle = dark;
      g.fillRect(x - w / 2 + lean - 1, y + sh - 3, w + 2, 4);
    }
    if (!leaves) return;
    g.fillStyle = col;
    for (let k = 0; k < 3; k++) {
      const ly = top + (bottom - top) * (0.1 + U.hash(seed + k) * 0.5), dir = U.hash(seed * 3 + k) < 0.5 ? -1 : 1;
      for (let j = 0; j < 4; j++) {
        const a = dir * (0.35 + j * 0.28), len = w * (4 + j * 0.6);
        g.save();
        g.translate(x, ly + j * 6);
        g.rotate(a);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(len * 0.5 * dir, -w * 0.9, len * dir, w * 0.5);
        g.quadraticCurveTo(len * 0.5 * dir, w * 0.4, 0, 0);
        g.fill();
        g.restore();
      }
    }
  };

  const sky = StageKit.layer({
    f: 0.02,
    fy: 0.1,
    y0: -40,
    y1: 700,
    paint(g, L) {
      const W = L.x1 - L.x0;
      StageKit.vgrad(g, L.x0, 0, W, 720, SKY);
      g.fillStyle = SKY[0][1];
      g.fillRect(L.x0, L.y0, W, -L.y0 + 1);
      for (let i = 0; i < 140; i++) {
        const x = L.x0 + U.hash(i * 2.3 + 5) * W, y = U.hash(i * 5.9 + 1) ** 1.4 * 420;
        g.globalAlpha = 0.3 + 0.7 * U.hash(i * 1.1);
        g.fillStyle = '#e8f0ff';
        g.fillRect(x, y, i % 9 ? 1.6 : 2.6, i % 9 ? 1.6 : 2.6);
      }
      g.globalAlpha = 1;
      // the moon
      StageKit.glow(g, MOON.x, MOON.y, 300, '#cfe0ff', 0.5, 40);
      Draw.circle(g, MOON.x, MOON.y, MOON.r, '#fbf6dc', 0);
      g.fillStyle = 'rgba(200,190,150,0.35)';
      for (const [dx, dy, r] of [[-30, -20, 18], [24, 10, 26], [-8, 40, 12], [40, -36, 10], [-46, 22, 9]]) {
        g.beginPath();
        g.arc(MOON.x + dx, MOON.y + dy, r, 0, TAU);
        g.fill();
      }
    },
  });

  const cloudSprites = [0, 1].map((i) =>
    StageKit.sprite({
      w: 420,
      h: 90,
      ax: 210,
      ay: 80,
      paint(g) {
        g.fillStyle = 'rgba(150,170,230,0.32)';
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          Draw.roundRectPath(g, 20 + k * 50 + (i ? 30 : 0), 30 + (k % 3) * 14, 200 - (k % 2) * 60, 14, 7);
          g.fill();
        }
      },
    })
  );

  const mountains = StageKit.layer({
    f: 0.08,
    fy: 0.25,
    y0: 250,
    y1: 760,
    paint(g, L) {
      g.beginPath();
      StageKit.ridgePath(g, L.x0, L.x1, 440, 200, 2.2, { freq: 0.005, step: 8 });
      g.fillStyle = '#1e2d5e';
      g.fill();
      // pagoda on a peak
      const px = 340, py = StageArt.ridgeY(340, 440, 200, 2.2, 0.005);
      g.fillStyle = '#16224a';
      for (let i = 0; i < 4; i++) {
        const w = 60 - i * 12, y = py - 18 - i * 22;
        g.fillRect(px - w * 0.35, y, w * 0.7, 22);
        g.beginPath();
        g.moveTo(px - w / 2 - 8, y + 4);
        g.quadraticCurveTo(px, y - 10, px + w / 2 + 8, y + 4);
        g.lineTo(px + w / 2, y + 8);
        g.lineTo(px - w / 2, y + 8);
        g.closePath();
        g.fill();
      }
      g.fillRect(px - 1.5, py - 120, 3, 30);
      StageKit.vgrad(g, L.x0, 380, L.x1 - L.x0, 200, [[0, 'rgba(120,150,220,0)'], [1, 'rgba(120,150,220,0.35)']]);
      g.beginPath();
      StageKit.ridgePath(g, L.x0, L.x1, 520, 120, 5.3, { freq: 0.008, step: 8 });
      g.fillStyle = '#17244d';
      g.fill();
    },
  });

  const bambooFar = StageKit.layer({
    f: 0.22,
    fy: 0.4,
    y0: -80,
    y1: 760,
    paint(g, L) {
      for (let x = L.x0, i = 0; x < L.x1; x += 55 + U.hash(i * 3.7) * 70, i++) {
        // keep a window around the moon
        if (Math.abs(x - MOON.x) < 120) continue;
        stalk(g, x, -80, 640, 9 + U.hash(i) * 5, '#1f4a52', '#163a42', '#2c5f66', i * 1.7, U.hash(i * 9.1) < 0.4);
      }
      StageKit.vgrad(g, L.x0, 380, L.x1 - L.x0, 300, [[0, 'rgba(90,120,190,0)'], [1, 'rgba(90,120,190,0.4)']]);
    },
  });

  const bambooMid = StageKit.layer({
    f: 0.48,
    fy: 0.6,
    y0: -80,
    y1: 760,
    paint(g, L) {
      for (let x = L.x0 + 20, i = 0; x < L.x1; x += 150 + U.hash(i * 5.3 + 2) * 160, i++) stalk(g, x, -80, 640, 15 + U.hash(i * 2.1) * 7, '#173b38', '#0f2a28', '#26584f', i * 2.9 + 1, U.hash(i * 4.4) < 0.5);
    },
  });

  // clearing: stone lanterns, rocks and a few big stalks (moves with the fighters)
  const LANTERNS = [560, 1440];
  const clearing = StageKit.layer({
    f: 1,
    y0: -80,
    y1: 640,
    paint(g, L) {
      const gy = GROUND_Y, X = (x) => x - 360;
      // low rock wall
      for (let x = -620, i = 0; x < 2620; x += 70 + U.hash(i * 1.9) * 40, i++) {
        const px = X(x);
        if (px < L.x0 - 100 || px > L.x1 + 100) continue;
        const w = 60 + U.hash(i * 3.3) * 50, h = 30 + U.hash(i * 7.1) * 26;
        Draw.ellipse(g, px, gy - h * 0.4, w / 2, h / 2 + 6, 0, i % 2 ? '#3d4766' : '#454f70', 3);
      }
      // big bamboo at the clearing's edge
      for (const x of [-180, 160, 830, 1190, 1860, 2160]) stalk(g, X(x), -80, gy - 10, 24, '#2f6b58', '#1d4a3d', '#4f9478', x * 0.01, true);
      // stone lanterns (light drawn per frame)
      for (const x of LANTERNS) {
        const px = X(x);
        Draw.roundRect(g, px - 30, gy - 24, 60, 24, 4, '#7d86a8', 3);
        Draw.roundRect(g, px - 10, gy - 100, 20, 78, 3, '#8b94b8', 3);
        Draw.roundRect(g, px - 26, gy - 112, 52, 14, 4, '#7d86a8', 3);
        Draw.roundRect(g, px - 20, gy - 154, 40, 42, 4, '#8b94b8', 3);
        g.fillStyle = '#2a2244';
        g.fillRect(px - 10, gy - 146, 20, 24);
        Draw.poly(g, [px - 40, gy - 154, px, gy - 184, px + 40, gy - 154], '#7d86a8', 3);
        Draw.circle(g, px, gy - 188, 6, '#8b94b8', 3);
      }
    },
  });

  const floor = StageKit.layer({
    f: 1,
    y0: GROUND_Y - 30,
    y1: 780,
    paint(g, L) {
      const gy = GROUND_Y, W = L.x1 - L.x0;
      StageKit.vgrad(g, L.x0, gy, W, 150, [[0, '#3c5a52'], [1, '#203530']], gy, 760);
      // stepping stones
      for (let i = 0; i < 30; i++) {
        const x = L.x0 + (i / 30) * W + U.hash(i * 3.1) * 30, y = gy + 26 + (i % 3) * 30 + U.hash(i * 1.3) * 10;
        Draw.ellipse(g, x, y, 34 + U.hash(i) * 14, 9 + U.hash(i * 2) * 4, 0, '#6b7590', 2.5);
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.beginPath();
        g.ellipse(x - 6, y - 3, 18, 3, 0, 0, TAU);
        g.fill();
      }
      StageArt.speckle(g, L.x0, L.x1, gy + 10, gy + 130, 160, ['rgba(140,200,150,0.35)', 'rgba(20,40,30,0.35)'], 31, 4, 2);
      StageArt.tufts(g, L.x0, L.x1, gy + 2, '#4f8a66', 41, 22);
      g.fillStyle = INK;
      g.fillRect(L.x0, gy - 2, W, 5);
    },
  });

  return {
    draw(ctx, cam, t) {
      const c = StageKit.cam(cam);
      const m = ctx.getTransform();
      const gy = GROUND_Y + c.y;
      ctx.fillStyle = SKY[0][1];
      ctx.fillRect(-300, -400, 1900, 400 + sky.y0 + c.y * sky.fy + 2);
      StageKit.draw(ctx, c, sky, m);
      // twinkles
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 12; i++) {
        const a = 0.5 + 0.5 * Math.sin(t * 0.06 + i * 1.9);
        if (a < 0.4) continue;
        const x = StageKit.wrap(U.hash(i * 7.7) * 1500 - (c.x - 1000) * 0.02, -100, 1500), y = 30 + U.hash(i * 3.9) * 300 + c.y * 0.1;
        ctx.globalAlpha = a;
        const s = 1 + a * 2.4;
        ctx.fillRect(x - s, y - 0.6, s * 2, 1.2);
        ctx.fillRect(x - 0.6, y - s, 1.2, s * 2);
      }
      ctx.globalAlpha = 1;
      // a bat crossing the moon now and then
      {
        const cyc = t % 1100;
        if (cyc < 260) {
          const p = cyc / 260, x = StageKit.lx(c, MOON.x - 260 + p * 520, 0.02), y = MOON.y + 40 - Math.sin(p * Math.PI) * 90 + c.y * 0.1;
          const fl = Math.sin(t * 0.6) * 6;
          ctx.fillStyle = '#0b0f24';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x - 8, y - 6 - fl, x - 16, y - 2 - fl);
          ctx.quadraticCurveTo(x - 10, y + 2, x, y + 4);
          ctx.quadraticCurveTo(x + 10, y + 2, x + 16, y - 2 - fl);
          ctx.quadraticCurveTo(x + 8, y - 6 - fl, x, y);
          ctx.fill();
        }
      }
      for (let i = 0; i < 3; i++) {
        const x = StageKit.wrap(U.hash(i * 11 + 4) * 2000 + t * 0.1 * (0.5 + U.hash(i * 3)) - (c.x - 1000) * 0.05, -300, 2000);
        StageKit.spr(ctx, c, m, cloudSprites[i % 2], x, 230 + i * 50 + c.y * 0.15);
      }
      StageKit.draw(ctx, c, mountains, m);
      StageKit.draw(ctx, c, bambooFar, m);
      StageKit.draw(ctx, c, bambooMid, m);
      // drifting mist
      ctx.fillStyle = 'rgba(170,190,240,0.07)';
      for (let i = 0; i < 4; i++) {
        const x = StageKit.wrap(i * 520 + t * 0.25 - (c.x - 1000) * 0.6, -400, 2000);
        ctx.beginPath();
        Draw.roundRectPath(ctx, x, gy - 70 - i * 12, 460, 50, 25);
        ctx.fill();
      }
      StageKit.draw(ctx, c, clearing, m);
      // lantern light flicker
      for (const x of LANTERNS) {
        const lx = StageKit.wx(c, x);
        if (lx < -200 || lx > 1480) continue;
        const fl = 0.75 + 0.25 * Math.sin(t * 0.3 + x) * Math.sin(t * 0.13 + x * 2);
        ctx.globalAlpha = 0.22 * fl;
        ctx.fillStyle = '#ffcf7a';
        ctx.beginPath();
        ctx.arc(lx, gy - 134, 70, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = U.mix('#ff9a3c', '#ffe9a8', fl);
        ctx.fillRect(lx - 10, gy - 146, 20, 24);
      }
      StageKit.draw(ctx, c, floor, m);
      // fireflies
      for (let i = 0; i < 14; i++) {
        const x = StageKit.wx(c, U.hash(i * 5.3) * 2000 + Math.sin(t * 0.013 + i * 2) * 60);
        if (x < -40 || x > 1320) continue;
        const y = gy - 40 - U.hash(i * 2.9) * 260 + Math.sin(t * 0.021 + i) * 30;
        const a = 0.5 + 0.5 * Math.sin(t * 0.09 + i * 1.3);
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = '#e8ff8a';
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    drawFront(ctx, cam, t) {
      // falling bamboo leaves
      const c = StageKit.cam(cam);
      ctx.fillStyle = '#5fae84';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const sp = 0.6 + U.hash(i * 3.3) * 0.6;
        const y = ((U.hash(i * 1.7) * 800 + t * sp) % 820) - 60;
        const x = StageKit.wrap(U.hash(i * 9.1) * 1500 + Math.sin(t * 0.03 + i) * 40 - (c.x - 1000) * 1.1, -100, 1500);
        const r = Math.sin(t * 0.05 + i * 2) * 1.2;
        ctx.save();
        ctx.translate(x, y + c.y);
        ctx.rotate(r);
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.quadraticCurveTo(0, -6, 12, 0);
        ctx.quadraticCurveTo(0, 6, -12, 0);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    },
  };
});

// ===========================================================================
// 6. TEAHOUSE GARDEN (Nana)
// ===========================================================================
defineLazyStage({ id: 'teahouse', name: 'Teahouse Garden', music: 'teahouse', thumbColors: ['#ffc2d6', '#8fd0ff'], haze: 'rgba(255,248,236,0.14)' }, () => {
  const SKY = [[0, '#8fd0ff'], [0.5, '#c8ecff'], [0.85, '#fff1d6'], [1, '#ffe2bd']];
  const BLOSSOM = ['#ffc2d6', '#ffb0c9', '#ffd6e3'];

  const blossomTree = (g, x, gy, s, seed) => {
    // trunk + branches
    g.fillStyle = '#6b4a5a';
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x - 10 * s, gy);
    g.quadraticCurveTo(x - 4 * s, gy - 80 * s, x - 22 * s, gy - 150 * s);
    g.lineTo(x - 8 * s, gy - 152 * s);
    g.quadraticCurveTo(x + 6 * s, gy - 100 * s, x + 30 * s, gy - 160 * s);
    g.lineTo(x + 40 * s, gy - 154 * s);
    g.quadraticCurveTo(x + 14 * s, gy - 80 * s, x + 12 * s, gy);
    g.closePath();
    g.fill();
    g.stroke();
    // canopy: clusters of pink puffs
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI - Math.PI, r = (70 + U.hash(seed + i) * 30) * s;
      const cx = x + Math.cos(a) * r * 1.1, cy = gy - 170 * s + Math.sin(a) * r * 0.55;
      const pr = (36 + U.hash(seed * 2 + i) * 18) * s;
      Draw.circle(g, cx, cy, pr, BLOSSOM[i % 3], 3);
    }
    Draw.circle(g, x, gy - 190 * s, 56 * s, BLOSSOM[1], 3);
    StageArt.speckle(g, x - 110 * s, x + 110 * s, gy - 260 * s, gy - 130 * s, 40, ['#ffffff', '#ff8fb1'], seed, 3, 3, false);
  };

  const sky = StageKit.layer({
    f: 0.03,
    fy: 0.12,
    y0: -40,
    y1: 700,
    paint(g, L) {
      const W = L.x1 - L.x0;
      StageKit.vgrad(g, L.x0, 0, W, 720, SKY);
      g.fillStyle = SKY[0][1];
      g.fillRect(L.x0, L.y0, W, -L.y0 + 1);
      StageKit.glow(g, 230, 150, 200, '#fff8d8', 0.85, 20);
      Draw.circle(g, 230, 150, 52, '#fff5c6', 0);
    },
  });

  const cloudSprites = [0, 1, 2].map((i) =>
    StageKit.sprite({
      w: 300,
      h: 110,
      ax: 150,
      ay: 100,
      paint(g) {
        StageKit.cloud(g, 150, 100, [250, 200, 160][i], [72, 60, 50][i], 21 + i * 5, '#ffffff', 'rgba(200,220,255,0.6)', 0, INK, 'rgba(255,255,255,0.9)');
      },
    })
  );

  // misty ink-painting mountains with a far pagoda
  const mountains = StageKit.layer({
    f: 0.08,
    fy: 0.25,
    y0: 200,
    y1: 760,
    paint(g, L) {
      const peaks = (base, amp, seed, f1, col) => {
        g.beginPath();
        StageKit.ridgePath(g, L.x0, L.x1, base, amp, seed, { freq: f1, step: 6 });
        g.fillStyle = col;
        g.fill();
      };
      peaks(430, 260, 0.7, 0.009, '#b9c8ec');
      StageKit.vgrad(g, L.x0, 300, L.x1 - L.x0, 220, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.6)']]);
      peaks(500, 170, 3.3, 0.011, '#9fb3e0');
      StageKit.vgrad(g, L.x0, 400, L.x1 - L.x0, 200, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.55)']]);
      // pagoda
      const px = 980, py = StageArt.ridgeY(980, 500, 170, 3.3, 0.011);
      g.fillStyle = '#7d8fc4';
      for (let i = 0; i < 5; i++) {
        const w = 56 - i * 9, y = py - 16 - i * 20;
        g.fillRect(px - w * 0.32, y, w * 0.64, 20);
        g.beginPath();
        g.moveTo(px - w / 2 - 10, y + 2);
        g.quadraticCurveTo(px, y - 8, px + w / 2 + 10, y + 2);
        g.lineTo(px + w / 2, y + 7);
        g.lineTo(px - w / 2, y + 7);
        g.closePath();
        g.fill();
      }
    },
  });

  // garden wall with a moon gate, blossom trees
  const garden = StageKit.layer({
    f: 0.35,
    fy: 0.55,
    y0: 160,
    y1: 760,
    paint(g, L) {
      const gy = 590;
      for (const [x, s, seed] of [[-60, 1.1, 3], [420, 0.95, 7], [980, 1.2, 11], [1500, 1, 15]]) blossomTree(g, x, gy - 40, s, seed);
      // white wall with grey tiles
      g.fillStyle = '#fbf6ee';
      g.fillRect(L.x0, gy - 110, L.x1 - L.x0, 200);
      g.fillStyle = 'rgba(160,140,120,0.15)';
      g.fillRect(L.x0, gy - 30, L.x1 - L.x0, 30);
      g.fillStyle = INK;
      g.fillRect(L.x0, gy - 112, L.x1 - L.x0, 3);
      g.fillStyle = '#5d6f8a';
      g.fillRect(L.x0, gy - 128, L.x1 - L.x0, 18);
      g.fillStyle = '#7a8ca8';
      for (let x = L.x0; x < L.x1; x += 16) {
        g.beginPath();
        g.arc(x + 8, gy - 126, 8, Math.PI, TAU);
        g.fill();
      }
      g.fillStyle = INK;
      g.fillRect(L.x0, gy - 136, L.x1 - L.x0, 3);
      // moon gate
      const mx = 700;
      g.fillStyle = '#3f6b4f';
      g.beginPath();
      g.arc(mx, gy - 46, 58, 0, TAU);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(mx, gy - 46, 58, 0, TAU);
      g.clip();
      g.fillStyle = '#9fd98a';
      g.fillRect(mx - 60, gy - 30, 120, 60);
      Draw.circle(g, mx - 20, gy - 60, 26, '#ffb0c9', 0);
      g.restore();
      g.beginPath();
      g.arc(mx, gy - 46, 58, 0, TAU);
      g.lineWidth = 7;
      g.strokeStyle = INK;
      g.stroke();
      g.lineWidth = 3;
      g.strokeStyle = '#d9cfc0';
      g.stroke();
      // bushes along the wall
      for (let x = L.x0, i = 0; x < L.x1; x += 90 + U.hash(i * 2.2) * 60, i++) Draw.ellipse(g, x, gy, 46, 24, 0, i % 2 ? '#6fbf73' : '#5fae66', 3);
    },
  });

  // the teahouse veranda behind the fighters
  const LANTERNS = [770, 1000, 1230];
  const house = StageKit.layer({
    f: 1,
    y0: 150,
    y1: 640,
    text: true,
    paint(g, L) {
      const gy = GROUND_Y, X = (x) => x - 360;
      const x0 = X(650), x1 = X(1350);
      // walls with shoji panels
      g.fillStyle = '#f6e7c8';
      g.fillRect(x0, gy - 250, x1 - x0, 250);
      for (let x = x0 + 28; x < x1 - 60; x += 116) {
        Draw.roundRect(g, x, gy - 220, 100, 170, 2, '#fff8e8', 4);
        g.strokeStyle = '#b08960';
        g.lineWidth = 2.5;
        g.beginPath();
        for (let k = 1; k < 4; k++) {
          g.moveTo(x + k * 25, gy - 220);
          g.lineTo(x + k * 25, gy - 50);
        }
        for (let k = 1; k < 6; k++) {
          g.moveTo(x, gy - 220 + k * 28);
          g.lineTo(x + 100, gy - 220 + k * 28);
        }
        g.stroke();
      }
      // red pillars
      for (let x = x0; x <= x1 + 1; x += 175) Draw.roundRect(g, x - 12, gy - 262, 24, 262, 4, '#d8344a', 4);
      // curved tiled roof
      g.beginPath();
      g.moveTo(x0 - 120, gy - 252);
      g.quadraticCurveTo(x0 - 40, gy - 266, x0 + 40, gy - 320);
      g.lineTo(x1 - 40, gy - 320);
      g.quadraticCurveTo(x1 + 40, gy - 266, x1 + 120, gy - 252);
      g.quadraticCurveTo(x1 + 60, gy - 270, x1, gy - 262);
      g.lineTo(x0, gy - 262);
      g.quadraticCurveTo(x0 - 60, gy - 270, x0 - 120, gy - 252);
      g.closePath();
      Draw.fillStroke(g, '#3f7a74', 4);
      g.strokeStyle = 'rgba(29,20,40,0.35)';
      g.lineWidth = 3;
      g.beginPath();
      for (let x = x0 - 20; x < x1 + 20; x += 26) {
        g.moveTo(x, gy - 262);
        g.lineTo(x + (x - (x0 + x1) / 2) * 0.05, gy - 316);
      }
      g.stroke();
      Draw.roundRect(g, x0 + 30, gy - 334, x1 - x0 - 60, 16, 6, '#2f5f5a', 4);
      // sign board
      Draw.roundRect(g, X(1000) - 70, gy - 300, 140, 40, 6, '#5a3a2a', 4);
      Draw.text(g, 'TEA', X(1000), gy - 280, { size: 28, fill: '#ffd447', lw: 5 });
      // veranda table with a teapot (steam is animated)
      const tx = X(1000);
      Draw.roundRect(g, tx - 70, gy - 70, 140, 14, 5, '#8a5a3c', 4);
      Draw.roundRect(g, tx - 60, gy - 58, 10, 58, 3, '#7a4a30', 3);
      Draw.roundRect(g, tx + 50, gy - 58, 10, 58, 3, '#7a4a30', 3);
      Draw.ellipse(g, tx - 6, gy - 88, 26, 18, 0, '#ffffff', 3);
      Draw.line(g, tx + 18, gy - 92, tx + 36, gy - 104, 4, '#ffffff', 3);
      Draw.circle(g, tx - 6, gy - 108, 5, '#ffffff', 3);
      g.strokeStyle = '#4f8fd8';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(tx - 6, gy - 88, 12, 0.2, Math.PI - 0.2);
      g.stroke();
      Draw.roundRect(g, tx + 40, gy - 82, 14, 12, 4, '#ffffff', 3);
      Draw.roundRect(g, tx - 50, gy - 82, 14, 12, 4, '#ffffff', 3);
      // lantern strings
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x0, gy - 258);
      g.quadraticCurveTo((x0 + x1) / 2, gy - 220, x1, gy - 258);
      g.stroke();
      // garden plants at the house ends
      for (const x of [X(580), X(1420)]) {
        Draw.roundRect(g, x - 26, gy - 40, 52, 40, 8, '#b5643c', 4);
        for (let k = 0; k < 5; k++) Draw.ellipse(g, x - 20 + k * 10, gy - 56 - (k % 2) * 12, 14, 22, (k - 2) * 0.3, '#5fae66', 3);
      }
    },
  });

  const floor = StageKit.layer({
    f: 1,
    y0: GROUND_Y - 3,
    y1: 780,
    paint(g, L) {
      const gy = GROUND_Y, W = L.x1 - L.x0;
      // wooden deck planks
      StageKit.vgrad(g, L.x0, gy, W, 150, [[0, '#d9a066'], [1, '#a8693f']], gy, 760);
      g.fillStyle = 'rgba(80,40,20,0.35)';
      for (let k = 0; k < 6; k++) g.fillRect(L.x0, gy + 18 + k * 22 + k * k * 1.5, W, 2.5);
      g.fillStyle = 'rgba(255,230,190,0.25)';
      for (let k = 0; k < 6; k++) g.fillRect(L.x0, gy + 21 + k * 22 + k * k * 1.5, W, 2);
      // nails and knots
      for (let i = 0; i < 90; i++) {
        const x = L.x0 + U.hash(i * 3.3) * W, k = Math.floor(U.hash(i * 7.1) * 6), y = gy + 10 + k * 22 + k * k * 1.5;
        g.fillStyle = 'rgba(80,40,20,0.4)';
        g.beginPath();
        g.ellipse(x, y, i % 4 ? 2 : 7, i % 4 ? 2 : 3, 0, 0, TAU);
        g.fill();
      }
      g.fillStyle = INK;
      g.fillRect(L.x0, gy - 2, W, 5);
    },
  });

  const petalCols = ['#ffc2d6', '#ffb0c9', '#ffffff'];

  return {
    draw(ctx, cam, t) {
      const c = StageKit.cam(cam);
      const m = ctx.getTransform();
      const gy = GROUND_Y + c.y;
      ctx.fillStyle = SKY[0][1];
      ctx.fillRect(-300, -400, 1900, 400 + sky.y0 + c.y * sky.fy + 2);
      StageKit.draw(ctx, c, sky, m);
      for (let i = 0; i < 4; i++) {
        const x = StageKit.wrap(U.hash(i * 19 + 5) * 2000 + t * 0.1 * (0.5 + U.hash(i * 7 + 5)) - (c.x - 1000) * 0.06, -300, 2000);
        StageKit.spr(ctx, c, m, cloudSprites[i % 3], x, 110 + U.hash(i * 23 + 5) * 110 + c.y * 0.15);
      }
      StageKit.draw(ctx, c, mountains, m);
      // birds
      {
        const cyc = t % 1300;
        if (cyc < 650) {
          const p = cyc / 650;
          ctx.strokeStyle = 'rgba(60,70,110,0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const bx = -100 + p * 1500 + i * 30 - (c.x - 1000) * 0.15, by = 220 + Math.sin(p * 5 + i) * 8 + i * 10 + c.y * 0.2;
            const flap = Math.sin(t * 0.3 + i) * 4;
            ctx.moveTo(bx - 6, by - flap);
            ctx.lineTo(bx, by);
            ctx.lineTo(bx + 6, by - flap);
          }
          ctx.stroke();
        }
      }
      StageKit.draw(ctx, c, garden, m);
      // a cat napping on the wall, tail swishing
      {
        const kx = StageKit.lx(c, 1110, 0.35), ky = 590 - 138 + c.y * 0.55;
        Draw.ellipse(ctx, kx, ky - 10, 26, 14, 0, '#ffb35c', 3);
        Draw.circle(ctx, kx + 24, ky - 16, 12, '#ffb35c', 3);
        Draw.poly(ctx, [kx + 16, ky - 24, kx + 18, ky - 36, kx + 26, ky - 27], '#ffb35c', 2.5);
        Draw.poly(ctx, [kx + 27, ky - 27, kx + 34, ky - 36, kx + 35, ky - 23], '#ffb35c', 2.5);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(kx + 21, ky - 15, 3, 0.2, Math.PI - 0.2);
        ctx.arc(kx + 29, ky - 15, 3, 0.2, Math.PI - 0.2);
        ctx.stroke();
        const sw = Math.sin(t * 0.08) * 10;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(kx - 24, ky - 8);
        ctx.quadraticCurveTo(kx - 44, ky - 12 + sw * 0.4, kx - 46 + sw * 0.6, ky - 30 + sw);
        ctx.stroke();
        ctx.strokeStyle = '#ffb35c';
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
      StageKit.draw(ctx, c, house, m);
      // swaying lanterns
      for (const x of LANTERNS) {
        const lx = StageKit.wx(c, x);
        if (lx < -80 || lx > 1360) continue;
        const sway = Math.sin(t * 0.04 + x) * 0.12;
        const ly = gy - 240 + (x === 1000 ? 4 : -4);
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(sway);
        Draw.line(ctx, 0, 0, 0, 14, 2, INK, 0);
        Draw.ellipse(ctx, 0, 34, 20, 24, 0, '#ff4d5a', 3);
        ctx.fillStyle = 'rgba(255,240,180,0.35)';
        ctx.beginPath();
        ctx.ellipse(-5, 30, 7, 14, 0, 0, TAU);
        ctx.fill();
        Draw.roundRect(ctx, -9, 8, 18, 6, 2, '#ffd447', 2);
        Draw.roundRect(ctx, -9, 56, 18, 6, 2, '#ffd447', 2);
        Draw.line(ctx, 0, 62, 0, 76, 2, '#ffd447', 0);
        ctx.restore();
      }
      // teapot steam
      {
        const tx = StageKit.wx(c, 1000) + 30;
        if (tx > -60 && tx < 1340) {
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 4; i++) {
            const p = ((t * 0.5 + i * 30) % 120) / 120;
            ctx.globalAlpha = 0.5 * (1 - p);
            ctx.beginPath();
            ctx.arc(tx + 10 + Math.sin(p * 6 + i) * 6, gy - 110 - p * 70, 4 + p * 9, 0, TAU);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
      StageKit.draw(ctx, c, floor, m);
      StageKit.floorSeams(ctx, c, gy + 6, { step: 110, spread: 1.6, y1: 760 + c.y, color: 'rgba(80,40,20,0.25)' });
    },
    drawFront(ctx, cam, t) {
      // drifting blossom petals
      const c = StageKit.cam(cam);
      for (let i = 0; i < 14; i++) {
        const sp = 0.7 + U.hash(i * 2.3) * 0.6;
        const y = ((U.hash(i * 4.7) * 800 + t * sp) % 820) - 60;
        const x = StageKit.wrap(U.hash(i * 6.1) * 1500 - t * 0.5 + Math.sin(t * 0.025 + i) * 30 - (c.x - 1000) * 1.05, -100, 1500);
        ctx.save();
        ctx.translate(x, y + c.y);
        ctx.rotate(t * 0.03 + i);
        Draw.ellipse(ctx, 0, 0, 6, 3.6, 0, petalCols[i % 3], 1.5);
        ctx.restore();
      }
    },
  };
});
