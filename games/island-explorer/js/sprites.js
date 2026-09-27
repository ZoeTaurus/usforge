'use strict';
// Every sprite is drawn in code, pixel by pixel, onto small offscreen canvases.
//   S.tiles[id]  -> variants[] of frames[] (opaque ground / wall tiles)
//   S.over[id]   -> variants[] of frames[] (transparent objects drawn on top of ground)
//   S.tall[id]   -> variants[] of canvases (trees, drawn depth-sorted, taller than a tile)
const Sprites = (() => {
  const S = { tiles: [], over: [], tall: [], fringe: {}, decor: {}, chars: {}, mobs: {}, items: {}, boats: {}, fx: {} };

  function make(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const shape = (cx, cy, rx, ry, col) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
          const c2 = typeof col === 'function' ? col(dx, dy, x, y) : col;
          if (c2) { g.fillStyle = c2; g.fillRect(x, y, 1, 1); }
        }
      }
    };
    const P = {
      g, w, h,
      px(x, y, col) { g.fillStyle = col; g.fillRect(Math.floor(x), Math.floor(y), 1, 1); },
      rect(x, y, w2, h2, col) { g.fillStyle = col; g.fillRect(x, y, w2, h2); },
      disc(cx, cy, r, col) { shape(cx, cy, r, r, col); },
      ellipse: shape,
    };
    fn(P);
    return c;
  }

  // Adds a 1px outline around opaque pixels (characters / objects).
  function outline(c, col = '#1a1420', skipBottom = false) {
    const g = c.getContext('2d');
    const w = c.width, h = c.height;
    const d = g.getImageData(0, 0, w, h).data;
    const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y * w + x) * 4 + 3];
    g.fillStyle = col;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (a(x, y) > 0) continue;
      if (a(x - 1, y) > 200 || a(x + 1, y) > 200 || a(x, y - 1) > 200 || (!skipBottom && a(x, y + 1) > 200)) g.fillRect(x, y, 1, 1);
    }
    return c;
  }

  function mirror(c) {
    return make(c.width, c.height, P => { P.g.translate(c.width, 0); P.g.scale(-1, 1); P.g.drawImage(c, 0, 0); });
  }

  // ---------------- ground ----------------
  const BASE = {
    sand(P, r) {
      P.rect(0, 0, 16, 16, '#e9d49b');
      for (let i = 0; i < 16; i++) P.px(r() * 16, r() * 16, r() < 0.5 ? '#dcc488' : '#f4e4b6');
      if (r() < 0.4) { const x = r() * 13 | 0, y = r() * 13 | 0; P.px(x, y, '#cdb173'); P.px(x + 1, y, '#cdb173'); }
    },
    grass(P, r, v) {
      const base = ['#5aa545', '#5aa545', '#57a243', '#5da847'][v % 4];
      P.rect(0, 0, 16, 16, base);
      for (let i = 0; i < 18; i++) P.px(r() * 16, r() * 16, r() < 0.6 ? '#4e9a3c' : '#69b452');
      for (let i = 0; i < 4; i++) {
        const x = 1 + (r() * 14 | 0), y = 2 + (r() * 13 | 0);
        P.px(x, y, '#3f8a30'); P.px(x, y - 1, '#3f8a30');
        if (r() < 0.5) P.px(x + 1, y - 2, '#76c05c');
      }
    },
    jungle(P, r) {
      P.rect(0, 0, 16, 16, '#3e7f33');
      for (let i = 0; i < 22; i++) P.px(r() * 16, r() * 16, r() < 0.5 ? '#356f2c' : '#4a8f3d');
      for (let i = 0; i < 2; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; P.px(x, y, '#2d6226'); P.px(x + 1, y + 1, '#2d6226'); }
    },
    path(P, r) {
      P.rect(0, 0, 16, 16, '#b08a5a');
      for (let i = 0; i < 20; i++) P.px(r() * 16, r() * 16, r() < 0.5 ? '#9c774a' : '#c29d6c');
      if (r() < 0.6) { const x = r() * 14 | 0, y = r() * 14 | 0; P.rect(x, y, 2, 1, '#8a8378'); }
    },
    dirt(P, r) {
      P.rect(0, 0, 16, 16, '#7a5a3a');
      for (let i = 0; i < 14; i++) P.px(r() * 16, r() * 16, r() < 0.5 ? '#6a4a2e' : '#8a6a48');
    },
    cobble(P, r) {
      P.rect(0, 0, 16, 16, '#7d776c');
      for (let row = 0; row < 4; row++) {
        const off = (row % 2) * 2;
        for (let col = -1; col < 4; col++) {
          const x = col * 4 + off, y = row * 4;
          P.rect(x, y, 3, 3, ['#a39d91', '#9b9488', '#aca699'][r() * 3 | 0]);
          P.px(x, y, '#b8b2a6');
        }
      }
    },
    ruinfloor(P, r) {
      P.rect(0, 0, 16, 16, '#8c8f7a');
      P.rect(0, 7, 16, 1, '#77796a'); P.rect(7, 0, 1, 7, '#77796a'); P.rect(3, 8, 1, 8, '#77796a');
      for (let i = 0; i < 6; i++) P.px(r() * 16, r() * 16, '#6a8a4a');
    },
    river(P) { P.rect(0, 0, 16, 16, '#3f8fcf'); },
  };

  function tile(baseName, seed, draw, v = 0) {
    return make(16, 16, P => {
      const r = RNG.mulberry32(seed);
      if (baseName) BASE[baseName](P, r, v);
      if (draw) draw(P, r, v);
    });
  }
  const variants = (n, baseName, draw, seed0) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push([tile(baseName, seed0 * 100 + i, draw, i)]);
    return out;
  };
  // transparent overlay variants
  const overs = (n, draw, seed0, outlineCol) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = tile(null, seed0 * 100 + i, draw, i);
      if (outlineCol) outline(c, outlineCol);
      out.push([c]);
    }
    return out;
  };

  function waterFrames(seed, baseCol, marks, n, vertical = false) {
    const out = [];
    for (let f = 0; f < 8; f++) {
      out.push(make(16, 16, P => {
        const r = RNG.mulberry32(seed);
        P.rect(0, 0, 16, 16, baseCol);
        for (let i = 0; i < n; i++) {
          const x = r() * 16 | 0, y = r() * 16 | 0, len = 2 + (r() * 3 | 0), c = marks[r() * marks.length | 0];
          for (let k = 0; k < len; k++) {
            if (vertical) P.px(x, (y + k + f * 2) % 16, c);
            else P.px((x + k + f * 2) % 16, y, c);
          }
        }
      }));
    }
    return out;
  }

  // Jagged edge of one ground type spilling onto its neighbour. dir: 0 top,1 bottom,2 left,3 right
  function fringe(cols, dir, seed) {
    return make(16, 16, P => {
      const r = RNG.mulberry32(seed);
      for (let i = 0; i < 16; i++) {
        const depth = 1 + (r() * 3 | 0) + (r() < 0.15 ? 1 : 0);
        for (let d = 0; d < depth; d++) {
          const col = d === depth - 1 ? cols[1] : (r() < 0.2 ? cols[2] : cols[0]);
          const [x, y] = dir === 0 ? [i, d] : dir === 1 ? [i, 15 - d] : dir === 2 ? [d, i] : [15 - d, i];
          P.px(x, y, col);
        }
      }
    });
  }

  // ---------------- tall trees ----------------
  function oak(pal, seed) {
    const c = make(20, 30, P => {
      const r = RNG.mulberry32(seed);
      P.ellipse(10, 27.5, 7, 2, 'rgba(0,0,0,0.28)');
      P.rect(9, 17, 3, 11, pal.trunk); P.rect(9, 17, 1, 11, pal.trunkL);
      P.px(8, 27, pal.trunk); P.px(12, 27, pal.trunk); P.px(11, 21, '#3a2410');
      const blobs = [[10, 12, 6.5], [5.5, 13.5, 4.5 + r()], [14.5, 13.5, 4.5 + r()], [10, 6.5, 5.5], [6.5 + r(), 8, 4], [13.5 - r(), 8, 4]];
      for (const [bx, by, br] of blobs) {
        P.disc(bx, by, br, (dx, dy) => {
          const s = dx + dy * 1.3;
          if (s < -br * 0.8) return pal.c[0];
          if (s > br * 0.7) return pal.c[2];
          return r() < 0.1 ? pal.c[0] : pal.c[1];
        });
      }
      for (let i = 0; i < 10; i++) { const x = 4 + r() * 12, y = 3 + r() * 12; P.px(x, y, pal.c[0]); P.px(x + 1, y, pal.c[0]); }
      for (let i = 0; i < 6; i++) P.px(4 + r() * 12, 8 + r() * 9, pal.c[2]);
      if (pal.fruit) for (let i = 0; i < 4; i++) P.px(5 + r() * 10, 6 + r() * 10, pal.fruit);
    });
    return outline(c, pal.c[3], true);
  }
  function jungleTree(seed) {
    const c = make(22, 30, P => {
      const r = RNG.mulberry32(seed);
      const pal = ['#62b465', '#2f7a3a', '#1c5226'];
      P.ellipse(11, 27.5, 8, 2, 'rgba(0,0,0,0.3)');
      P.rect(10, 16, 3, 12, '#5a3a1a'); P.rect(10, 16, 1, 12, '#7a5028');
      P.px(8, 27, '#5a3a1a'); P.px(9, 26, '#5a3a1a'); P.px(13, 26, '#5a3a1a'); P.px(14, 27, '#5a3a1a');
      const blobs = [[11, 11, 8], [4.5, 13, 4.5], [17.5, 13, 4.5], [11, 5, 5.5]];
      for (const [bx, by, br] of blobs) {
        P.disc(bx, by, br, (dx, dy) => {
          const s = dx + dy * 1.3;
          if (s < -br * 0.8) return pal[0];
          if (s > br * 0.7) return pal[2];
          return r() < 0.12 ? pal[0] : pal[1];
        });
      }
      for (let v = 0; v < 4; v++) {
        const x = 3 + (r() * 16 | 0), len = 3 + (r() * 6 | 0);
        for (let k = 0; k < len; k++) P.px(x + (k % 3 === 2 ? 1 : 0), 16 + k, k === len - 1 ? '#8ee06a' : '#2f8a3a');
      }
      for (let i = 0; i < 3; i++) P.px(4 + r() * 14, 5 + r() * 10, '#e05a8a');
    });
    return outline(c, '#0f3a18', true);
  }
  function palm(seed) {
    const c = make(22, 30, P => {
      const r = RNG.mulberry32(seed);
      const lean = r() < 0.5 ? -1 : 1;
      P.ellipse(11 + lean * 2, 28, 5, 1.5, 'rgba(0,0,0,0.22)');
      for (let y = 9; y <= 29; y++) {
        const t = (29 - y) / 20;
        const x = 10 + Math.round(lean * t * t * 4);
        P.px(x, y, '#9a7440'); P.px(x + 1, y, y % 3 === 0 ? '#7a5a30' : '#b08850');
      }
      const tx = 10 + lean * 4, ty = 8;
      const fronds = [[-9, 1], [-7, -4], [-1, -7], [5, -6], [9, -1], [5, 5], [-5, 5]];
      for (const [fx, fy] of fronds) {
        for (let k = 0; k <= 9; k++) {
          const t = k / 9;
          const x = tx + fx * t, y = ty + fy * t + (Math.abs(fx) > 4 ? t * t * 4 : 0);
          P.px(x, y, k < 4 ? '#2e7d32' : '#4caf50');
          if (k > 1 && k < 9) P.px(x, y + 1, '#1f5f22');
          if (k > 3 && k % 2) P.px(x + (fx > 0 ? -1 : 1) * 0, y - 1, '#6ccf6a');
        }
      }
      P.px(tx, ty + 1, '#5a3a1a'); P.px(tx + 1, ty + 1, '#5a3a1a'); P.px(tx, ty + 2, '#6a4a2a');
    });
    return outline(c, '#1a3a14', true);
  }
  function pine(seed) {
    const c = make(16, 30, P => {
      const r = RNG.mulberry32(seed);
      P.ellipse(8, 28, 5.5, 1.6, 'rgba(0,0,0,0.28)');
      P.rect(7, 22, 2, 7, '#5a3a1a');
      for (let tier = 0; tier < 4; tier++) {
        const y0 = 2 + tier * 5;
        for (let row = 0; row < 8; row++) {
          const hw = row * 0.8 + tier * 0.6;
          for (let x = Math.floor(8 - hw); x <= Math.ceil(7 + hw); x++) {
            if (x < 0 || x > 15) continue;
            const col = x < 7 ? (row < 2 ? '#5a9a6e' : '#3a7a52') : x > 9 ? '#1d4a32' : '#2f6b4a';
            P.px(x, y0 + row, col);
          }
        }
      }
      if (r() < 0.5) { P.px(7, 2, '#f0f4f8'); P.px(8, 2, '#f0f4f8'); P.px(6, 4, '#e0e8f0'); P.px(9, 4, '#e0e8f0'); }
    });
    return outline(c, '#0f2a1c', true);
  }

  // ---------------- small objects ----------------
  function drawBush(P, r, berries) {
    P.ellipse(8, 14, 6, 1.6, 'rgba(0,0,0,0.25)');
    P.disc(8, 9, 6, (dx, dy) => {
      if (dx + dy < -3) return '#5cae4c';
      if (dx + dy > 3) return '#2f6f28';
      return r() < 0.2 ? '#2f6f28' : '#3f8a36';
    });
    if (berries) {
      for (const [x, y] of [[5, 7], [9, 5], [11, 9], [6, 11], [8, 9], [11, 12], [4, 10]]) {
        P.px(x, y, '#e03a55'); P.px(x + 1, y, '#a01830'); P.px(x, y + 1, '#a01830');
      }
    }
  }

  function drawHouseWall(P, r, door) {
    P.rect(0, 0, 16, 16, '#d8c8a0');
    for (let i = 0; i < 8; i++) P.px(r() * 16, r() * 16, '#c8b890');
    P.rect(0, 0, 16, 1, '#6b4a2a'); P.rect(0, 15, 16, 1, '#6b4a2a');
    P.rect(0, 0, 1, 16, '#6b4a2a'); P.rect(15, 0, 1, 16, '#6b4a2a');
    if (door) {
      P.rect(4, 3, 8, 13, '#4a2e14'); P.rect(5, 4, 6, 12, '#7a4a24');
      P.rect(7, 4, 1, 12, '#5a3418'); P.rect(9, 4, 1, 12, '#5a3418'); P.px(10, 10, '#e0c060');
    } else {
      P.rect(3, 4, 10, 8, '#6b4a2a'); P.rect(4, 5, 8, 6, '#5a8ac8'); P.rect(4, 5, 3, 2, '#9ac4f0');
      P.rect(7, 5, 1, 6, '#6b4a2a'); P.rect(4, 8, 8, 1, '#6b4a2a'); P.rect(3, 12, 10, 1, '#8a6a4a');
      P.px(4, 12, '#e05a5a'); P.px(6, 12, '#ffd84a'); P.px(9, 12, '#e05a5a'); P.px(11, 12, '#c080f0');
    }
  }

  // ---------------- characters ----------------
  function humanRaw(o, dir, frame) {
    const side = dir >= 2;
    return make(16, 16, P => {
      const { skin, hair, shirt, pants } = o;
      const shoes = o.shoes || '#3a2a1a';
      const skinD = o.skinD || 'rgba(0,0,0,0.15)';
      if (!side) {
        const lh = frame === 1 ? 2 : 3, rh = frame === 2 ? 2 : 3;
        P.rect(5, 13, 2, lh, pants); P.rect(5, 12 + lh, 2, 1, shoes);
        P.rect(9, 13, 2, rh, pants); P.rect(9, 12 + rh, 2, 1, shoes);
      } else {
        const a = frame === 1 ? -1 : frame === 2 ? 1 : 0;
        P.rect(6 + a, 13, 2, 2, pants); P.rect(6 + a, 15, 2, 1, shoes);
        P.rect(8 - a, 13, 2, 2, pants); P.rect(8 - a, 15, 2, 1, shoes);
      }
      P.rect(4, 8, 8, 5, shirt);
      P.rect(4, 8, 8, 1, 'rgba(255,255,255,0.12)');
      P.rect(10, 9, 2, 3, 'rgba(0,0,0,0.12)');
      P.rect(4, 12, 8, 1, o.belt || '#4a3420');
      if (o.sash) for (let i = 0; i < 5; i++) P.px(5 + i, 8 + i, o.sash);
      if (o.torn) { P.px(5, 11, skin); P.px(10, 10, skin); }
      if (!side) {
        const s = frame === 1 ? 1 : frame === 2 ? -1 : 0;
        P.rect(3, 9 + s, 1, 3, skin); P.px(3, 9 + s, shirt);
        P.rect(12, 9 - s, 1, 3, skin); P.px(12, 9 - s, shirt);
      } else {
        const s = frame === 1 ? -1 : frame === 2 ? 1 : 0;
        P.rect(7 + s, 9, 2, 2, shirt); P.rect(7 + s, 11, 2, 1, skin);
      }
      P.rect(4, 2, 8, 6, skin);
      P.rect(4, 7, 8, 1, skinD);
      const eye = '#1a1a2a';
      if (dir === 0) {
        P.rect(4, 1, 8, 2, hair); P.rect(4, 3, 1, 2, hair); P.rect(11, 3, 1, 2, hair);
        P.px(5, 1, 'rgba(255,255,255,0.25)'); P.px(6, 1, 'rgba(255,255,255,0.25)');
        P.px(6, 5, eye); P.px(9, 5, eye);
        P.px(5, 6, 'rgba(255,110,110,0.35)'); P.px(10, 6, 'rgba(255,110,110,0.35)');
        if (o.beard) { P.rect(5, 6, 6, 2, o.beard); P.px(7, 6, skin); P.px(8, 6, skin); }
      } else if (dir === 1) {
        P.rect(4, 1, 8, 6, hair);
        P.px(6, 2, 'rgba(255,255,255,0.2)'); P.px(7, 2, 'rgba(255,255,255,0.2)');
      } else {
        P.rect(4, 1, 8, 2, hair); P.rect(8, 3, 4, 4, hair);
        P.px(5, 5, eye); P.px(3, 5, skin);
        if (o.beard) P.rect(4, 6, 3, 2, o.beard);
      }
      if (o.hat === 'straw') { P.rect(2, 2, 12, 1, '#c8a850'); P.rect(4, 0, 8, 2, '#d8b860'); P.rect(4, 1, 8, 1, '#a88838'); }
      if (o.hat === 'helmet') { P.rect(4, 0, 8, 3, '#a0a8b0'); P.rect(4, 0, 8, 1, '#d0d8e0'); P.rect(3, 2, 10, 1, '#7a828a'); }
      if (o.hat === 'bandana') { P.rect(4, 1, 8, 1, o.band || '#e8e0c8'); }
      if (o.hat === 'cap') { P.rect(4, 0, 8, 2, o.band || '#3a6a3a'); if (dir === 0) P.rect(4, 2, 8, 1, o.band || '#3a6a3a'); }
    });
  }

  S.charSet = function (look) {
    const key = JSON.stringify(look);
    if (S.chars[key]) return S.chars[key];
    const set = [];
    for (let d = 0; d < 4; d++) {
      set[d] = [];
      for (let f = 0; f < 3; f++) {
        const c = d === 3 ? mirror(humanRaw(look, 2, f)) : humanRaw(look, d, f);
        set[d][f] = outline(c);
      }
    }
    S.chars[key] = set;
    return set;
  };

  // ---------------- creatures (facing right) ----------------
  function crab(f) {
    return make(16, 16, P => {
      for (let i = 0; i < 3; i++) {
        P.px(3 + i, 11 + ((i + f) % 2), '#a8302a'); P.px(2 + i, 12 + ((i + f) % 2), '#a8302a');
        P.px(12 - i, 11 + ((i + f) % 2), '#a8302a'); P.px(13 - i, 12 + ((i + f) % 2), '#a8302a');
      }
      P.ellipse(8, 10, 5, 3, (dx, dy) => dy < -1 ? '#f06a5a' : '#d9483b');
      const cy = f ? 5 : 6;
      P.rect(1, cy + 1, 3, 2, '#e0584a'); P.px(1, cy, '#e0584a'); P.px(3, cy, '#e0584a');
      P.rect(12, cy + 1, 3, 2, '#e0584a'); P.px(12, cy, '#e0584a'); P.px(14, cy, '#e0584a');
      P.rect(3, cy + 2, 2, 2, '#d9483b'); P.rect(11, cy + 2, 2, 2, '#d9483b');
      P.rect(6, 5, 1, 3, '#a8302a'); P.rect(9, 5, 1, 3, '#a8302a');
      P.px(6, 4, '#fff'); P.px(9, 4, '#fff');
    });
  }
  function snake(f) {
    return make(16, 16, P => {
      const yAt = x => 10 + Math.round(Math.sin(x * 0.9 + f * Math.PI) * 1.5);
      for (let x = 1; x <= 12; x++) {
        const y = yAt(x);
        P.rect(x, y, 1, 2, '#4caf50'); P.px(x, y + 2, '#c8e06a');
        if (x % 3 === 0) { P.px(x, y, '#2e7d32'); P.px(x, y + 1, '#e0c040'); }
      }
      const hy = yAt(13);
      P.rect(12, hy - 1, 3, 3, '#5cc060'); P.px(14, hy - 1, '#111');
      if (f === 0) P.px(15, hy + 1, '#e53935');
    });
  }
  function boar(f) {
    return make(16, 16, P => {
      const l = f ? 1 : 0;
      P.rect(4, 12, 1, 3 - l, '#3a2618'); P.rect(6, 12, 1, 2 + l, '#3a2618');
      P.rect(10, 12, 1, 3 - l, '#3a2618'); P.rect(12, 12, 1, 2 + l, '#3a2618');
      P.ellipse(8, 10, 6, 3.5, (dx, dy) => dy < -1.5 ? '#7d5a3e' : '#6b4a32');
      for (let x = 3; x <= 11; x++) P.px(x, 6 + (x % 2), '#3f2a1a');
      P.rect(12, 8, 3, 4, '#7d5a3e');
      P.rect(14, 10, 2, 2, '#c49a7a'); P.px(15, 10, '#5a3a2a');
      P.px(13, 12, '#fff'); P.px(14, 12, '#fff');
      P.px(13, 9, '#111'); P.px(12, 7, '#5a3a2a');
      P.px(1, 9, '#3f2a1a'); P.px(2, 8, '#3f2a1a');
    });
  }
  function cat(f) {
    return make(16, 16, P => {
      const o = '#e89a3a', d = '#b8681a';
      P.ellipse(7.5, 12, 4.5, 2.5, o);
      P.px(5, 10, d); P.px(7, 10, d); P.px(9, 10, d); P.px(6, 11, d); P.px(8, 11, d);
      if (f) { P.px(3, 11, o); P.px(2, 10, o); P.px(2, 9, o); P.px(3, 8, o); }
      else { P.px(3, 11, o); P.px(2, 11, o); P.px(1, 10, o); P.px(1, 9, o); }
      P.px(5, 14, d); P.px(10, 14, d); if (f) { P.px(6, 14, d); P.px(9, 14, d); }
      P.disc(12, 9.5, 2.6, o);
      P.px(10, 6, o); P.px(10, 7, o); P.px(13, 6, o); P.px(13, 7, o); P.px(10, 7, '#ffb0b0');
      P.px(12, 9, '#1a1a1a'); P.px(14, 10, '#ff8a9a'); P.px(11, 11, '#ffd84a');
    });
  }

  // ---------------- new biomes, animals and tools ----------------
  function snowPine(seed) {
    const c = pine(seed);
    const g = c.getContext('2d');
    const r = RNG.mulberry32(seed + 9);
    g.fillStyle = '#f4f8fc';
    for (let tier = 0; tier < 4; tier++) {
      const y0 = 2 + tier * 5;
      for (let x = 3; x < 13; x++) if (r() < 0.55) g.fillRect(x, y0 + 2 + Math.abs(x - 8) * 0.6, 1, 1);
    }
    g.fillRect(7, 2, 2, 1);
    return c;
  }
  function deadTree(seed) {
    const c = make(18, 30, P => {
      const r = RNG.mulberry32(seed);
      P.ellipse(9, 28, 5, 1.5, 'rgba(0,0,0,0.25)');
      P.rect(8, 10, 2, 19, '#5a4a3a'); P.rect(8, 10, 1, 19, '#7a6a58');
      const br = [[8, 16, -1, -1, 6], [9, 13, 1, -1, 6], [8, 11, -1, -1, 4], [9, 20, 1, -1, 5]];
      for (const [bx, by, dx, dy, len] of br) {
        for (let k = 0; k < len; k++) P.px(bx + dx * k, by + dy * Math.floor(k * 0.7), '#5a4a3a');
        P.px(bx + dx * len, by + dy * Math.floor(len * 0.7) - 1, '#5a4a3a');
      }
      if (r() < 0.5) { P.px(4, 8, '#3a6a3a'); P.px(13, 6, '#3a6a3a'); }
    });
    return outline(c, '#1a120a', true);
  }
  function quad(o) { // generic 4-legged animal, facing right
    return f => make(16, 16, P => {
      const l = f ? 1 : 0;
      const y0 = o.y || 10;
      for (const [x, up] of [[4, l], [6, 1 - l], [o.w - 3, l], [o.w - 1, 1 - l]]) P.rect(x, y0 + 2, 1, (o.leg || 3) - up, o.legC || o.dark);
      P.ellipse(o.w / 2 + 2, y0, o.w / 2 - 1, o.h, (dx, dy) => dy < -o.h * 0.4 ? o.light : dy > o.h * 0.4 ? o.dark : o.body);
      o.head(P, f);
    });
  }
  function buildExtra() {
    const t = S.tiles, o = S.over;
    t[T.SNOW] = variants(4, null, (P, r) => {
      P.rect(0, 0, 16, 16, '#e8eef4');
      for (let i = 0; i < 14; i++) P.px(r() * 16, r() * 16, r() < 0.5 ? '#d4dde8' : '#ffffff');
      if (r() < 0.4) { const x = r() * 13 | 0, y = r() * 13 | 0; P.rect(x, y, 3, 1, '#c8d4e0'); }
    }, 60);
    t[T.MUD] = variants(4, null, (P, r) => {
      P.rect(0, 0, 16, 16, '#5a5a3a');
      for (let i = 0; i < 18; i++) P.px(r() * 16, r() * 16, r() < 0.5 ? '#4a4a2e' : '#6a6a44');
      if (r() < 0.5) { const x = r() * 12 | 0, y = r() * 13 | 0; P.rect(x, y, 3, 2, '#4a5a44'); P.px(x + 1, y, '#7a9a8a'); }
    }, 61);
    t[T.ASH] = variants(4, null, (P, r) => {
      P.rect(0, 0, 16, 16, '#4a4040');
      for (let i = 0; i < 18; i++) P.px(r() * 16, r() * 16, r() < 0.5 ? '#3a3232' : '#5a504c');
      if (r() < 0.3) P.px(r() * 16, r() * 16, '#ff6a20');
    }, 62);
    t[T.LAVA] = [0, 1].map(i => {
      const out = [];
      for (let f = 0; f < 8; f++) out.push(make(16, 16, P => {
        const r = RNG.mulberry32(70 + i);
        P.rect(0, 0, 16, 16, '#d8401a');
        for (let k = 0; k < 10; k++) {
          const x = r() * 16 | 0, y = r() * 16 | 0, c = ['#ff8a2a', '#ffc040', '#a82810'][r() * 3 | 0];
          P.rect((x + f * 2) % 16, y, 2 + (r() * 2 | 0), 1, c);
        }
        P.px((f * 5) % 16, (f * 3 + i * 7) % 16, '#fff0a0');
      }));
      return out;
    });

    const SN = ['#e8eef4', '#c8d4e0', '#ffffff'], MD = ['#5a5a3a', '#44442a', '#6a6a44'], AS = ['#4a4040', '#353030', '#5a504c'];
    S.fringe.n = [0, 1, 2, 3].map(d => [fringe(SN, d, 540 + d), fringe(SN, d, 550 + d)]);
    S.fringe.m = [0, 1, 2, 3].map(d => [fringe(MD, d, 560 + d), fringe(MD, d, 570 + d)]);
    S.fringe.a = [0, 1, 2, 3].map(d => [fringe(AS, d, 580 + d), fringe(AS, d, 590 + d)]);

    o[T.ORE] = overs(2, (P, r) => {
      P.ellipse(8, 13.5, 6.5, 1.8, 'rgba(0,0,0,0.25)');
      P.ellipse(8, 9.5, 6, 5, (dx, dy) => dy < -2 ? '#9a8a80' : dy > 2 ? '#4e4440' : '#72665e');
      for (let i = 0; i < 6; i++) { const x = 4 + r() * 8, y = 6 + r() * 7; P.px(x, y, '#d88a50'); P.px(x + 1, y, '#f0b070'); }
      P.px(6, 7, '#fff0d0');
    }, 63, '#2a2220');
    o[T.PEBBLE] = overs(3, (P, r) => {
      for (let i = 0; i < 3; i++) { const x = 3 + r() * 9 | 0, y = 7 + r() * 6 | 0; P.rect(x, y, 2, 2, '#9a9a94'); P.px(x, y, '#c8c8c0'); P.px(x + 1, y + 1, '#6a6a64'); }
    }, 64, 'rgba(30,30,30,0.6)');
    o[T.CRATE] = overs(2, (P, r, v) => {
      P.ellipse(8, 14.5, 6, 1.5, 'rgba(0,0,0,0.25)');
      P.rect(2, 4, 12, 10, '#9a6a34'); P.rect(2, 4, 12, 1, '#c08a4a');
      P.rect(2, 8, 12, 1, '#6b4423'); P.rect(2, 4, 1, 10, '#6b4423'); P.rect(13, 4, 1, 10, '#6b4423');
      for (let i = 0; i < 10; i++) P.px(3 + i, 5 + (v ? (i * 0.8) % 8 : 8 - (i * 0.8) % 8), '#6b4423');
      P.px(4, 11, '#5a8a4a'); P.px(11, 6, '#5a8a4a');
    }, 65, '#2a1a0a');
    o[T.DIG] = overs(1, (P) => {
      P.ellipse(8, 9, 5, 3.5, 'rgba(90,60,30,0.35)');
      for (let i = 0; i < 7; i++) { P.px(5 + i, 6 + i * 0.5, '#c0302a'); P.px(11 - i, 6 + i * 0.5, '#c0302a'); P.px(5 + i, 7 + i * 0.5, '#e05040'); P.px(11 - i, 7 + i * 0.5, '#e05040'); }
    }, 66);
    o[T.MUSHROOMS] = overs(2, (P, r) => {
      for (let i = 0; i < 3; i++) {
        const x = 3 + (r() * 9 | 0), y = 7 + (r() * 5 | 0);
        P.rect(x + 1, y + 1, 1, 3, '#f0e8d8');
        P.ellipse(x + 1.5, y + 0.5, 2.5, 1.6, i % 2 ? '#d9483b' : '#c87a3a');
        P.px(x, y, '#fff');
      }
    }, 67, 'rgba(40,20,10,0.7)');

    // player-built walls & gate (wood walls get connecting rails drawn at render time)
    o[T.WALL_WOOD] = overs(1, (P) => {
      P.ellipse(8, 14.5, 4, 1.3, 'rgba(0,0,0,0.3)');
      P.rect(6, 1, 4, 14, '#8a6236'); P.rect(6, 1, 1, 14, '#b08850'); P.rect(9, 1, 1, 14, '#5e4020');
      P.px(6, 0, '#8a6236'); P.px(8, 0, '#8a6236'); P.rect(6, 5, 4, 1, '#5e4020'); P.rect(6, 10, 4, 1, '#5e4020');
    }, 68, '#2a1a0a');
    o[T.WALL_STONE] = overs(1, (P, r) => {
      P.ellipse(8, 15, 7.5, 1.5, 'rgba(0,0,0,0.3)');
      P.rect(0, 2, 16, 13, '#6a6a74');
      for (let row = 0; row < 3; row++) {
        const off = row % 2 ? 4 : 0;
        for (let col = -1; col < 3; col++) P.rect(col * 8 + off + 1, 3 + row * 4, 7, 3, r() < 0.5 ? '#8a8a94' : '#9a9aa4');
      }
      P.rect(0, 2, 16, 1, '#b8b8c4');
    }, 69, '#1e1e24');
    o[T.WGATE] = overs(1, (P) => {
      P.ellipse(8, 14.5, 7, 1.3, 'rgba(0,0,0,0.25)');
      P.rect(0, 2, 2, 13, '#6b4423'); P.rect(14, 2, 2, 13, '#6b4423');
      for (let x = 2; x < 14; x += 3) P.rect(x, 4, 2, 9, '#a07848');
      P.rect(2, 5, 12, 1, '#5e4020'); P.rect(2, 11, 12, 1, '#5e4020'); P.px(7, 8, '#e0b040'); P.px(8, 8, '#e0b040');
    }, 70, '#2a1a0a');
    S.items.wwall = make(16, 16, P => P.g.drawImage(o[T.WALL_WOOD][0][0], 0, 0));
    S.items.swall = make(16, 16, P => P.g.drawImage(o[T.WALL_STONE][0][0], 0, 0));
    S.items.wgate = make(16, 16, P => P.g.drawImage(o[T.WGATE][0][0], 0, 0));
    S.items.fire = make(16, 16, P => P.g.drawImage(o[T.CAMPFIRE][0][0], 0, 0));

    S.tall[T.SNOWPINE] = [0, 1, 2].map(i => snowPine(780 + i));
    S.tall[T.DEADTREE] = [0, 1, 2].map(i => deadTree(790 + i));

    // animals
    const both = (fn) => { const r = [outline(fn(0)), outline(fn(1))]; return { r, l: r.map(mirror) }; };
    S.mobs.rabbit = both(f => make(16, 16, P => {
      const y = f ? 10 : 11;
      P.ellipse(7, y + 1, 3.5, 2.5, (dx, dy) => dy < 0 ? '#c8b8a0' : '#a89880');
      P.disc(10.5, y - 1, 2, '#c8b8a0');
      P.rect(10, y - 6, 1, 4, '#c8b8a0'); P.rect(11, y - 5, 1, 3, '#b8a890'); P.px(10, y - 5, '#ffb0b0');
      P.px(11, y - 1, '#1a1a1a'); P.px(3, y, '#ffffff'); P.px(3, y + 1, '#ffffff');
      P.px(5, y + 4, '#8a7a60'); P.px(9, y + 4 - f, '#8a7a60');
    }));
    S.mobs.deer = both(quad({ w: 11, h: 3, y: 9, leg: 4, body: '#a8703a', light: '#c08a4a', dark: '#7a4a24',
      head: (P) => { P.rect(11, 3, 2, 5, '#a8703a'); P.rect(12, 2, 3, 3, '#b07a42'); P.px(14, 3, '#1a1a1a'); P.px(15, 4, '#3a2a1a');
        P.px(11, 0, '#d8c8a8'); P.px(12, 1, '#d8c8a8'); P.px(13, 0, '#d8c8a8'); P.px(14, 1, '#d8c8a8'); P.px(5, 8, '#f0e0c8'); P.px(7, 8, '#f0e0c8'); } }));
    S.mobs.wolf = both(quad({ w: 11, h: 3, y: 10, leg: 3, body: '#7a7a84', light: '#9a9aa4', dark: '#4a4a54',
      head: (P, f) => { P.rect(11, 6, 3, 4, '#8a8a94'); P.rect(14, 8, 2, 2, '#6a6a74'); P.px(11, 5, '#6a6a74'); P.px(13, 5, '#6a6a74');
        P.px(13, 7, '#ffe040'); P.px(15, 9, '#1a1a1a'); P.px(2, 8 - f, '#6a6a74'); P.px(1, 7 - f, '#6a6a74'); P.px(3, 9, '#6a6a74'); } }));
    S.mobs.bear = both(f => make(16, 16, P => {
      const l = f ? 1 : 0;
      for (const [x, up] of [[3, l], [5, 1 - l], [10, l], [12, 1 - l]]) P.rect(x, 12, 2, 3 - up, '#3a2418');
      P.ellipse(8, 9.5, 6.5, 4.5, (dx, dy) => dy < -2 ? '#7a5030' : dy > 2 ? '#4a2e1a' : '#5e3c24');
      P.disc(13, 7, 2.6, '#6a4428'); P.px(12, 4, '#4a2e1a'); P.px(14, 4, '#4a2e1a');
      P.rect(14, 8, 2, 2, '#b08a6a'); P.px(15, 8, '#1a1a1a'); P.px(13, 6, '#1a1a1a');
    }));
    S.mobs.croc = both(f => make(16, 16, P => {
      const l = f ? 1 : 0;
      P.rect(3, 12 + l, 1, 2, '#2e4a24'); P.rect(9, 12 + (1 - l), 1, 2, '#2e4a24');
      for (let x = 0; x < 16; x++) {
        const th = x < 3 ? 1 : x > 11 ? 1.5 : 2.2;
        P.ellipse(x + 0.5, 11, 0.6, th, x % 3 === 0 ? '#3e6a30' : '#4e7a3a');
      }
      for (let x = 2; x < 11; x += 2) P.px(x, 9, '#2e4a24');
      P.px(12, 9, '#e8e040'); P.px(12, 10, '#1a1a1a');
      if (f) { P.rect(13, 12, 3, 1, '#fff'); } else { P.px(13, 12, '#fff'); P.px(15, 12, '#fff'); }
    }));
    S.mobs.scorpion = both(f => make(16, 16, P => {
      const c = '#c0602a', d = '#8a3a18';
      for (let i = 0; i < 3; i++) { P.px(5 + i * 2, 12 + ((i + f) % 2), d); P.px(5 + i * 2, 9 - ((i + f) % 2), d); }
      P.ellipse(8, 10.5, 4, 2, c);
      P.px(4, 10, c); P.px(3, 9, c); P.px(2, 8, c); P.px(2, 7, c); P.px(3, 6, c); P.px(4, 6, '#ffe060');
      P.rect(12, 9 - f, 2, 1, c); P.rect(13, 8 - f, 2, 1, c); P.rect(12, 12 + f, 2, 1, c); P.rect(13, 13 + f, 2, 1, c);
      P.px(11, 10, '#1a1a1a');
    }));
    S.fx.shark = [0, 1].map(f => make(20, 10, P => {
      P.rect(2 + f, 8, 16 - f * 2, 1, 'rgba(235,248,255,0.8)');
      for (let y = 0; y < 7; y++) { const w = Math.round(y * 0.9) + 1; P.rect(10 - Math.round(y * 0.3), 1 + y, w, 1, y < 2 ? '#8a98a8' : '#5a6878'); }
      P.rect(2, 9, 16, 1, 'rgba(20,50,90,0.6)');
    }));

    // item icons
    const I = S.items;
    const tool = (head, headL, handle = '#8a6236') => make(16, 16, P => {
      for (let i = 0; i < 11; i++) P.px(3 + i, 13 - i, handle);
      for (let i = 0; i < 10; i++) P.px(4 + i, 14 - i, '#6b4423');
      head(P, headL);
    });
    const axeHead = (col, colL) => (P) => { P.rect(10, 1, 4, 6, col); P.rect(9, 2, 1, 4, col); P.rect(13, 2, 1, 4, colL); P.px(10, 1, colL); };
    const pickHead = (col, colL) => (P) => { for (let i = 0; i < 9; i++) P.px(6 + i, 1 + Math.abs(i - 4) * 0.5, i < 4 ? colL : col); for (let i = 0; i < 9; i++) P.px(6 + i, 2 + Math.abs(i - 4) * 0.5, col); };
    I.axe = tool(axeHead('#8a8a8a', '#c0c0c0'));
    I.pick = tool(pickHead('#8a8a8a', '#c0c0c0'));
    I.iaxe = tool(axeHead('#8aa0b8', '#e0ecf8'));
    I.ipick = tool(pickHead('#8aa0b8', '#e0ecf8'));
    I.sword = make(16, 16, P => {
      for (let i = 0; i < 10; i++) { P.px(5 + i, 10 - i, '#e0ecf8'); P.px(6 + i, 10 - i, '#8aa0b8'); }
      P.rect(3, 10, 5, 2, '#8a6236'); P.rect(4, 9, 2, 5, '#6b4423'); P.px(2, 13, '#e0b040');
    });
    I.rod = make(16, 16, P => { for (let i = 0; i < 13; i++) P.px(2 + i, 14 - i, '#a07848'); for (let i = 0; i < 9; i++) P.px(14, 2 + i, '#e8e8f0'); P.rect(13, 11, 3, 2, '#e04a3a'); });
    I.shovel = make(16, 16, P => { for (let i = 0; i < 9; i++) P.px(2 + i, 2 + i, '#8a6236'); P.rect(1, 1, 3, 2, '#6b4423'); P.ellipse(12, 12, 3, 3, '#a0b0c0'); P.px(11, 11, '#e0ecf8'); });
    I.rope = make(16, 16, P => { for (let a = 0; a < 30; a++) { const t2 = a / 30 * Math.PI * 6, rr = 5 - a * 0.1; P.px(8 + Math.cos(t2) * rr, 8 + Math.sin(t2) * rr * 0.8, a % 3 ? '#c8a860' : '#8a6a30'); } P.rect(12, 11, 3, 1, '#c8a860'); });
    I.iron = make(16, 16, P => { P.rect(2, 7, 12, 5, '#6a7a8a'); P.rect(3, 5, 10, 3, '#9aaabb'); P.rect(3, 5, 10, 1, '#d0dce8'); P.rect(2, 11, 12, 1, '#4a5a6a'); });
    I.hide = make(16, 16, P => { P.ellipse(8, 8, 6, 5, (dx, dy) => dy < -1 ? '#c09060' : '#a07040'); P.rect(1, 3, 3, 2, '#a07040'); P.rect(12, 3, 3, 2, '#a07040'); P.rect(1, 11, 3, 2, '#a07040'); P.rect(12, 11, 3, 2, '#a07040'); });
    I.armor = make(16, 16, P => { P.rect(3, 3, 10, 11, '#8a5a2a'); P.rect(1, 3, 3, 5, '#8a5a2a'); P.rect(12, 3, 3, 5, '#8a5a2a'); P.rect(6, 3, 4, 2, '#1a1420'); P.rect(3, 9, 10, 1, '#5e3a1a'); P.rect(4, 4, 1, 9, '#a87a44'); });
    I.gold = make(16, 16, P => { for (const [x, y] of [[5, 10], [10, 10], [7, 6]]) { P.ellipse(x + 0.5, y, 3, 2, '#e0b040'); P.ellipse(x + 0.5, y - 0.5, 2, 1, '#fff0a0'); } });
    I.spyglass = make(16, 16, P => { for (let i = 0; i < 12; i++) { P.px(2 + i, 12 - i * 0.8, '#b08850'); P.px(2 + i, 13 - i * 0.8, i < 5 ? '#e0b040' : '#8a6236'); } P.rect(12, 2, 3, 3, '#9ad0ff'); });
    I.compass = make(16, 16, P => { P.disc(8, 8, 6, '#e0b040'); P.disc(8, 8, 4.8, '#f4f0e0'); P.rect(8, 4, 1, 4, '#e03030'); P.rect(7, 8, 1, 4, '#303030'); });
    I.mushroom = make(16, 16, P => { P.rect(7, 8, 3, 6, '#f0e8d8'); P.ellipse(8.5, 7, 5, 3.5, '#d9483b'); P.px(6, 6, '#fff'); P.px(10, 5, '#fff'); });
    for (const k of ['axe', 'pick', 'iaxe', 'ipick', 'sword', 'rod', 'shovel', 'rope', 'iron', 'hide', 'armor', 'gold', 'spyglass', 'compass', 'mushroom']) outline(I[k]);
  }

  // ---------------- build ----------------
  S.build = function () {
    const t = S.tiles, o = S.over;
    t[T.DEEP] = [0, 1, 2].map(i => waterFrames(10 + i, '#1f4f8c', ['#2a62a8', '#2a62a8', '#3a74bb', '#1a4478'], 7));
    t[T.SHALLOW] = [0, 1, 2].map(i => waterFrames(20 + i, '#3a8bc9', ['#5aa6de', '#6fb6e6', '#4d9bd6'], 7));
    t[T.ROUGH] = [0, 1, 2].map(i => waterFrames(30 + i, '#27395e', ['#c9d6ea', '#8fa3c7', '#3e5580', '#e8f0ff'], 16));
    t[T.RIVER] = [0, 1].map(i => waterFrames(40 + i, '#3f8fcf', ['#6cb0e4', '#8ac4ee', '#3380c0'], 7, true));

    t[T.SAND] = variants(5, 'sand', null, 2);
    t[T.GRASS] = variants(6, 'grass', null, 3);
    t[T.JUNGLE] = variants(4, 'jungle', null, 4);
    t[T.PATH] = variants(4, 'path', null, 5);
    t[T.COBBLE] = variants(3, 'cobble', null, 6);
    t[T.RUINFLOOR] = variants(3, 'ruinfloor', null, 7);
    t[T.CROPS] = variants(2, 'dirt', (P, r) => {
      for (const y of [2, 7, 12]) for (let x = 1; x < 16; x += 2) {
        const h = 2 + (r() * 2 | 0);
        P.rect(x, y + 3 - h, 1, h, '#6a8a3a'); P.px(x, y, '#e8c85a'); P.px(x, y + 1, '#c8a840');
      }
    }, 28);

    t[T.MOUNTAIN] = variants(3, null, (P, r, v) => {
      P.rect(0, 0, 16, 16, '#5e554b');
      for (let i = 0; i < 14; i++) P.px(r() * 16, r() * 16, '#6b6157');
      const cx = 7.5 + (v - 1) * 1.5;
      for (let y = 1; y < 16; y++) {
        const hw = y * 0.55 + 0.5;
        for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
          if (x < 0 || x > 15) continue;
          let col = x < cx ? '#a0968a' : '#7f7468';
          if (y < 5) col = x < cx ? '#f4f4f8' : '#c8ccd8';
          else if (y === 5 && r() < 0.5) col = '#f4f4f8';
          P.px(x, y, col);
        }
      }
    }, 12);
    t[T.CLIFF] = variants(3, null, (P, r) => {
      P.rect(0, 0, 16, 16, '#6d6255');
      for (let y = 0; y < 16; y += 4) {
        P.rect(0, y + 3, 16, 1, '#554b40');
        for (let i = 0; i < 3; i++) P.rect(r() * 14 | 0, y + 1, 2 + (r() * 3 | 0), 1, '#857a6b');
      }
      for (let i = 0; i < 3; i++) P.px(r() * 16, r() * 16, '#4e7a3a');
    }, 13);

    const planks = (P, broken) => {
      P.rect(0, 0, 16, 16, '#3f8fcf');
      for (let x = 0; x < 16; x += 3) {
        if (broken && (x === 6 || x === 9)) continue;
        const len = broken && x === 3 ? 9 : broken && x === 12 ? 11 : 16;
        P.rect(x, 0, 2, len, x % 2 ? '#9a6e3e' : '#8a6236');
        P.px(x, 3, '#5e4020'); P.px(x + 1, 11, '#5e4020');
      }
    };
    t[T.BRIDGE] = variants(1, null, P => planks(P, false), 14);
    t[T.BRIDGE_BROKEN] = variants(1, null, P => planks(P, true), 15);

    t[T.TOWNWALL] = variants(2, null, (P, r) => {
      P.rect(0, 0, 16, 16, '#5a5a63');
      for (let row = 0; row < 4; row++) {
        const off = (row % 2) * 4;
        for (let col = -1; col < 3; col++) {
          P.rect(col * 8 + off + 1, row * 4 + 1, 7, 3, r() < 0.5 ? '#7c7c86' : '#868690');
          P.rect(col * 8 + off + 1, row * 4 + 1, 7, 1, '#9a9aa4');
        }
      }
    }, 16);
    t[T.ROOF] = variants(2, null, (P) => {
      P.rect(0, 0, 16, 16, '#a8433a');
      for (let y = 0; y < 16; y += 4) {
        P.rect(0, y + 3, 16, 1, '#7a2921');
        const off = (y / 4) % 2 ? 2 : 0;
        for (let x = off; x < 16; x += 4) P.rect(x, y, 1, 3, '#8a3129');
        P.rect(0, y, 16, 1, '#c25a4c');
      }
    }, 17);
    t[T.HOUSEWALL] = variants(1, null, (P, r) => drawHouseWall(P, r, false), 18);
    t[T.DOOR] = variants(1, null, (P, r) => drawHouseWall(P, r, true), 19);
    t[T.HUTROOF] = variants(2, null, (P, r) => {
      P.rect(0, 0, 16, 16, '#c9a55a');
      for (let i = 0; i < 26; i++) { const x = r() * 16 | 0, y = r() * 14 | 0; P.rect(x, y, 1, 3, r() < 0.5 ? '#a88540' : '#e0c070'); }
      P.rect(0, 15, 16, 1, '#8a6a30');
    }, 20);
    t[T.HUTWALL] = variants(2, null, (P, r, v) => {
      P.rect(0, 0, 16, 16, '#8a6236');
      for (let y = 0; y < 16; y += 4) { P.rect(0, y + 3, 16, 1, '#5e4020'); P.rect(0, y, 16, 1, '#a07848'); }
      if (v === 1) { P.rect(4, 4, 8, 12, '#3a2410'); P.rect(5, 5, 6, 11, '#5e3a1a'); }
    }, 21);
    t[T.RUINWALL] = variants(3, null, (P, r) => {
      P.rect(0, 0, 16, 16, '#565948');
      for (let row = 0; row < 4; row++) {
        const off = (row % 2) * 4;
        for (let col = -1; col < 3; col++) P.rect(col * 8 + off + 1, row * 4 + 1, 7, 3, r() < 0.5 ? '#7a7d6a' : '#6e7160');
      }
      for (let i = 0; i < 8; i++) { const x = r() * 15 | 0, y = r() * 15 | 0; P.rect(x, y, 2, 1, '#5a7a3a'); P.px(x, y + 1, '#4a6a2a'); }
    }, 33);
    t[T.GATE] = variants(1, 'cobble', (P) => { P.rect(0, 0, 2, 16, '#5a5a63'); P.rect(14, 0, 2, 16, '#5a5a63'); }, 34);

    // ---- soft edges ----
    const GR = ['#5aa545', '#3f8a30', '#69b452'], JG = ['#3e7f33', '#2d6226', '#4a8f3d'];
    S.fringe.g = [0, 1, 2, 3].map(d => [fringe(GR, d, 500 + d), fringe(GR, d, 510 + d)]);
    S.fringe.j = [0, 1, 2, 3].map(d => [fringe(JG, d, 520 + d), fringe(JG, d, 530 + d)]);

    // ---- overlays ----
    o[T.ROCK] = overs(3, (P, r, v) => {
      P.ellipse(8, 13.5, 6.5, 1.8, 'rgba(0,0,0,0.25)');
      const rx = v === 2 ? 5 : 6, ry = v === 2 ? 3.8 : 4.8;
      P.ellipse(8, 10, rx, ry, (dx, dy) => dy < -2 ? '#bcbcbc' : dy > 2 ? '#5e5e5e' : dx > 3 ? '#6e6e6e' : '#8e8e8e');
      P.px(6, 8, '#dadada'); P.px(10, 11, '#5e5e5e'); P.px(9, 10, '#5e5e5e');
      if (v === 1) { P.px(5, 11, '#6a8a4a'); P.px(6, 12, '#6a8a4a'); P.px(4, 12, '#6a8a4a'); }
    }, 11, '#3a3a3a');
    o[T.BERRY] = overs(2, (P, r) => drawBush(P, r, true), 22, '#1f4a1a');
    o[T.BUSH] = overs(2, (P, r) => drawBush(P, r, false), 22, '#1f4a1a');
    o[T.VINE] = overs(2, (P, r) => {
      P.ellipse(8, 14, 6, 1.6, 'rgba(0,0,0,0.22)');
      for (let a = 0; a < 44; a++) {
        const t2 = a / 44 * Math.PI * 6, rr = 1 + a * 0.13;
        P.px(8 + Math.cos(t2) * rr, 9 + Math.sin(t2) * rr * 0.8, a % 4 ? '#2f8a3a' : '#1f6a2a');
      }
      for (let i = 0; i < 7; i++) { const x = 3 + (r() * 10 | 0), y = 4 + (r() * 9 | 0); P.px(x, y, '#9ae07a'); P.px(x + 1, y, '#6fcf5a'); }
      for (const [x, y] of [[4, 6], [11, 5], [7, 11], [12, 11]]) {
        P.px(x, y, '#c080f0'); P.px(x + 1, y, '#9a50d0'); P.px(x, y + 1, '#9a50d0'); P.px(x + 1, y + 1, '#e0b0ff');
      }
    }, 23);
    o[T.STUMP] = overs(2, (P) => {
      P.rect(4, 10, 8, 4, '#8a6236'); P.px(3, 13, '#6b4a26'); P.px(12, 13, '#6b4a26');
      P.ellipse(8, 10, 4, 2, '#c49a62'); P.px(8, 10, '#8a6236'); P.px(6, 10, '#a07848');
    }, 24, '#3a2410');
    o[T.JSTUMP] = o[T.STUMP];
    o[T.FLOWERS] = overs(4, (P, r) => {
      const cols = ['#ff5a5a', '#ffd84a', '#ffffff', '#c080f0', '#ff9ad0', '#7ab8ff'];
      const c = cols[r() * cols.length | 0], c2 = cols[r() * cols.length | 0];
      for (let i = 0; i < 5; i++) {
        const x = 2 + (r() * 12 | 0), y = 2 + (r() * 12 | 0), cc = i % 2 ? c : c2;
        P.px(x, y + 1, '#3f8a30'); P.px(x, y + 2, '#3f8a30');
        P.px(x - 1, y, cc); P.px(x + 1, y, cc); P.px(x, y - 1, cc); P.px(x, y, '#ffe060');
      }
    }, 26);
    o[T.TALLGRASS] = overs(3, (P, r) => {
      for (let i = 0; i < 12; i++) {
        const x = r() * 16 | 0, h = 3 + (r() * 5 | 0), y = 7 + (r() * 9 | 0);
        for (let k = 0; k < h; k++) P.px(x + (k > h - 2 ? 1 : 0), y - k, k > h - 3 ? '#8cd86a' : '#3f8a30');
      }
    }, 27);
    o[T.SHELL] = overs(2, (P, r, v) => {
      const c1 = v ? '#f4c6d0' : '#f8e0c0', c2 = v ? '#d890a0' : '#d8a878';
      P.ellipse(8, 9, 3.5, 3, c1);
      for (let i = -2; i <= 2; i++) P.px(8 + i, 8 + Math.abs(i) * 0.5, c2);
      P.rect(7, 11, 3, 1, c2); P.px(6, 7, '#ffffff');
    }, 37, '#8a6a58');
    o[T.WRECK] = overs(1, (P) => {
      P.ellipse(8, 11, 7.5, 4, (dx, dy) => dy < -1 ? '#a07848' : dy < 1.5 ? '#8a6236' : '#5e4020');
      P.rect(2, 10, 12, 1, '#5e4020');
      P.ellipse(9, 11, 2, 1.5, '#2a1a0a');
      for (let i = 0; i < 11; i++) P.px(4 + i * 0.8, 9 - i * 0.8, '#b08850');
      P.rect(10, 1, 4, 3, '#e8e0c8'); P.px(13, 4, '#e8e0c8'); P.px(11, 4, '#c8c0a8');
    }, 29, '#2a1a0a');
    o[T.CAMPFIRE] = [[0, 1, 2].map(f => tile(null, 300, (P) => {
      P.ellipse(8, 10, 6.5, 4.5, 'rgba(60,40,20,0.35)');
      for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; P.rect(Math.round(8 + Math.cos(ang) * 5.5) - 1, Math.round(10 + Math.sin(ang) * 4) - 1, 2, 2, a % 2 ? '#8a8a8a' : '#6e6e6e'); }
      P.rect(4, 11, 8, 2, '#6b4423'); P.rect(6, 9, 2, 5, '#5a3418');
      P.ellipse(8, 8.5, 3, 3.8, '#ff6a2a');
      P.ellipse(8, 9, 2, 2.4, '#ffb030');
      P.px(8, 10, '#fff0a0');
      const fl = [[8, 3], [7, 5], [9, 4]];
      P.px(fl[f][0], fl[f][1], '#ffd84a'); P.px(fl[f][0] + (f - 1), fl[f][1] - 1, '#ff8a2a');
      P.px(8 + (f - 1), 3 + f, '#ffb030');
    }))];
    o[T.CHEST] = overs(1, (P) => {
      P.rect(2, 5, 12, 10, '#4a2e14'); P.rect(3, 6, 10, 8, '#a0682a'); P.rect(3, 6, 10, 3, '#c0803a');
      P.rect(7, 5, 2, 10, '#e0b040'); P.rect(7, 9, 2, 2, '#303030'); P.rect(3, 9, 10, 1, '#6b4423');
    }, 30);
    o[T.CHEST_OPEN] = overs(1, (P) => {
      P.rect(2, 1, 12, 5, '#4a2e14'); P.rect(3, 2, 10, 3, '#c0803a');
      P.rect(2, 6, 12, 9, '#4a2e14'); P.rect(3, 7, 10, 7, '#a0682a'); P.rect(4, 7, 8, 3, '#1a0e04');
    }, 31);
    o[T.SIGN] = overs(1, (P) => {
      P.ellipse(8, 15, 4, 1, 'rgba(0,0,0,0.25)');
      P.rect(7, 9, 2, 6, '#6b4a26');
      P.rect(1, 2, 14, 8, '#5a3a1a'); P.rect(2, 3, 12, 6, '#b88a54');
      P.rect(3, 4, 9, 1, '#6b4a26'); P.rect(3, 6, 7, 1, '#6b4a26');
    }, 32);
    o[T.SKELETON] = overs(1, (P) => {
      const b = '#e8e4d8';
      P.rect(3, 4, 4, 4, b); P.px(4, 5, '#2a2a2a'); P.px(6, 5, '#2a2a2a'); P.rect(4, 7, 2, 1, '#bdb8a8');
      P.rect(7, 6, 6, 1, b);
      for (let x = 8; x <= 12; x += 2) P.rect(x, 5, 1, 3, b);
      P.rect(12, 9, 3, 1, b); P.rect(9, 10, 1, 4, b); P.rect(2, 12, 5, 1, b);
      P.rect(3, 10, 4, 3, '#8a3a2a'); P.rect(4, 11, 2, 1, '#e8e0c8');
    }, 35);
    o[T.LAMP] = overs(1, (P) => {
      P.ellipse(8, 15, 3, 1, 'rgba(0,0,0,0.3)');
      P.rect(7, 5, 2, 10, '#2a2a30'); P.rect(6, 14, 4, 2, '#2a2a30');
      P.rect(6, 1, 4, 5, '#2a2a30'); P.rect(7, 2, 2, 3, '#ffd060');
    }, 36);
    o[T.RELIC] = [[0, 1, 2, 3].map(f => tile(null, 380, (P) => {
      P.ellipse(8, 14, 4, 1.2, 'rgba(0,0,0,0.3)');
      P.rect(5, 12, 6, 2, '#a07020');
      P.rect(6, 5, 4, 7, '#e0b040'); P.rect(6, 5, 1, 7, '#ffe080');
      P.disc(8, 4, 2.5, '#e0b040'); P.px(7, 3, '#ffe080');
      P.px(7, 4, '#302010'); P.px(9, 4, '#302010'); P.px(8, 8, '#40d0e0');
      const sp = [[2, 3], [13, 5], [3, 10], [12, 1]][f];
      P.px(sp[0], sp[1], '#fff'); P.px(sp[0] - 1, sp[1], '#fff8c0'); P.px(sp[0] + 1, sp[1], '#fff8c0');
      P.px(sp[0], sp[1] - 1, '#fff8c0'); P.px(sp[0], sp[1] + 1, '#fff8c0');
    }))];
    o[T.FOUNTAIN] = [[0, 1, 2].map(f => tile(null, 400, (P) => {
      P.disc(8, 8, 7.5, (dx, dy) => Math.hypot(dx, dy) > 6 ? '#8a909a' : dy < -3 ? '#8ecaf8' : '#5ab0f0');
      P.rect(7, 5, 2, 5, '#c0c4cc');
      const drops = [[5, 4], [11, 4], [4, 7], [12, 7], [6, 2], [10, 2]];
      for (let i = f; i < drops.length; i += 3) P.px(drops[i][0], drops[i][1], '#e8f6ff');
      P.px(7, 3 + f % 2, '#e8f6ff'); P.px(8, 4 - f % 2, '#e8f6ff');
    }))];

    // ---- tall trees ----
    const OAKS = [
      { c: ['#86cf62', '#57a843', '#3a7f30', '#24561f'], trunk: '#6b4423', trunkL: '#8a5a30' },
      { c: ['#78c05a', '#4a963a', '#2f6d28', '#1a4518'], trunk: '#5e3c1e', trunkL: '#7a5028' },
      { c: ['#a8d05a', '#7cb040', '#56862e', '#34521a'], trunk: '#6b4423', trunkL: '#8a5a30' },
      { c: ['#86cf62', '#57a843', '#3a7f30', '#24561f'], trunk: '#6b4423', trunkL: '#8a5a30', fruit: '#e03a3a' },
    ];
    S.tall[T.TREE] = [0, 1, 2, 3, 4, 5].map(i => oak(OAKS[i % OAKS.length], 700 + i));
    S.tall[T.JTREE] = [0, 1, 2, 3].map(i => jungleTree(720 + i));
    S.tall[T.PALM] = [0, 1, 2, 3].map(i => palm(740 + i));
    S.tall[T.PINE] = [0, 1, 2].map(i => pine(760 + i));

    // ---- decor (drawn on plain ground, chosen by position) ----
    const dec = (fn) => outline(make(16, 16, fn), 'rgba(0,0,0,0.35)');
    S.decor.mushroom = dec(P => { P.rect(7, 10, 2, 3, '#f0e8d8'); P.ellipse(8, 9.5, 3, 2, '#d9483b'); P.px(7, 9, '#fff'); P.px(9, 10, '#fff'); });
    S.decor.pebbles = dec(P => { P.rect(4, 10, 2, 2, '#9a9a9a'); P.rect(9, 12, 3, 2, '#8a8a8a'); P.px(7, 8, '#aaaaaa'); });
    S.decor.stick = dec(P => { for (let i = 0; i < 7; i++) P.px(4 + i, 11 - i * 0.5, '#7a5a30'); P.px(8, 8, '#7a5a30'); });
    S.decor.starfish = dec(P => { const c = '#f08050'; P.px(8, 8, c); for (const [dx, dy] of [[0, -2], [2, -1], [1, 2], [-1, 2], [-2, -1]]) { P.px(8 + dx / 2, 8 + dy / 2, c); P.px(8 + dx, 8 + dy, c); } });
    S.decor.driftwood = dec(P => { P.rect(3, 10, 10, 2, '#a89078'); P.rect(3, 10, 10, 1, '#c8b098'); P.px(12, 9, '#a89078'); });
    S.decor.reeds = make(16, 16, P => { for (let i = 0; i < 6; i++) { const x = 2 + i * 2 + (i % 2); const h = 5 + (i * 7) % 4; P.rect(x, 15 - h, 1, h, '#4a8a3a'); P.rect(x, 15 - h, 1, 2, '#7a5a30'); } });
    S.decor.smallflower = make(16, 16, P => { P.px(5, 6, '#ffffff'); P.px(5, 7, '#3f8a30'); P.px(11, 11, '#ffd84a'); P.px(11, 12, '#3f8a30'); });

    // ---- creatures ----
    const both = (fn) => { const r = [outline(fn(0)), outline(fn(1))]; return { r, l: r.map(mirror) }; };
    S.mobs.crab = both(crab);
    S.mobs.snake = both(snake);
    S.mobs.boar = both(boar);
    S.mobs.cat = both(cat);

    S.fx.gull = [0, 1].map(f => make(13, 7, P => {
      const w = '#f4f4f8', tip = '#505060';
      const pts = f ? [[0, 3], [1, 2], [2, 2], [3, 2], [4, 3], [5, 3]] : [[0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3]];
      for (const [x, y] of pts) { P.px(x, y, x < 2 ? tip : w); P.px(12 - x, y, x < 2 ? tip : w); }
      P.rect(5, 3, 3, 2, w); P.px(6, 5, '#f0a020');
    }));
    S.fx.butterfly = ['#ffd84a', '#ff9ad0', '#9ad0ff', '#ffffff'].map(c => [0, 1].map(f => make(5, 4, P => {
      if (f) { P.px(0, 0, c); P.px(1, 1, c); P.px(4, 0, c); P.px(3, 1, c); }
      else { P.rect(0, 0, 2, 2, c); P.rect(3, 0, 2, 2, c); P.px(1, 2, c); P.px(3, 2, c); }
      P.rect(2, 0, 1, 3, '#2a2a2a');
    })));
    S.fx.fish = outline(make(10, 6, P => {
      P.ellipse(4.5, 3, 3.5, 1.8, (dx, dy) => dy < 0 ? '#b8d8f0' : '#7aa8d0');
      P.px(8, 1, '#7aa8d0'); P.px(8, 4, '#7aa8d0'); P.px(9, 0, '#7aa8d0'); P.px(9, 5, '#7aa8d0'); P.px(8, 2, '#7aa8d0'); P.px(8, 3, '#7aa8d0');
      P.px(2, 2, '#111');
    }), '#20405a');
    S.fx.bottle = [0, 1].map(f => outline(make(12, 12, P => {
      P.rect(2, 5 + f, 7, 4, '#4a9a6a'); P.rect(9, 6 + f, 2, 2, '#4a9a6a'); P.rect(11, 6 + f, 1, 2, '#b08850');
      P.rect(3, 6 + f, 5, 2, '#f0e8c8'); P.rect(2, 5 + f, 7, 1, '#8ad0a0');
    }), '#1a3a2a'));
    S.fx.bang = outline(make(5, 9, P => { P.rect(1, 0, 3, 9, '#ffffff'); P.rect(2, 1, 1, 4, '#e03030'); P.px(2, 7, '#e03030'); }));
    S.fx.cloud = make(160, 90, P => {
      const r = RNG.mulberry32(99);
      const blobs = [[50, 45, 38, 26], [90, 40, 44, 30], [125, 50, 30, 22], [75, 58, 40, 20]];
      for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) {
        let v = 0;
        for (const [bx, by, rx, ry] of blobs) v = Math.max(v, 1 - (((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2));
        if (v > 0.12 || (v > 0 && r() < v * 6)) P.px(x, y, '#000');
      }
    });

    // ---- boats ----
    S.boats.raft = outline(make(20, 16, P => {
      for (let i = 0; i < 5; i++) {
        P.rect(0, i * 3, 20, 3, i % 2 ? '#8a6236' : '#9a6e3e');
        P.rect(0, i * 3 + 2, 20, 1, '#5e4020');
        P.rect(0, i * 3, 1, 3, '#c49a62'); P.rect(19, i * 3, 1, 3, '#c49a62');
      }
      P.rect(4, 0, 1, 15, '#d8c890'); P.rect(15, 0, 1, 15, '#d8c890');
    }));
    S.boats.sailboat = outline(make(28, 28, P => {
      P.ellipse(14, 20, 12, 6, (dx, dy) => dy > 2 ? '#5e3a1a' : '#8a5a2a');
      P.ellipse(14, 19.5, 9.5, 4, '#b07a40');
      for (let x = 6; x < 23; x += 3) P.rect(x, 16, 1, 7, '#9a6834');
      P.rect(13, 2, 2, 18, '#6b4423');
      for (let y = 3; y < 17; y++) {
        const w = Math.round((y - 3) * 0.75) + 1;
        P.rect(15, y, w, 1, y % 4 === 0 ? '#d8d0c0' : '#f4f0e0');
      }
      P.rect(12, 1, 4, 2, '#d94f3d');
    }));
    S.boats.sailboatL = mirror(S.boats.sailboat);

    // ---- item icons ----
    const I = S.items;
    I.wood = make(16, 16, P => {
      for (const [y, c] of [[9, '#8a6236'], [4, '#9a6e3e']]) {
        P.rect(2, y, 11, 4, c); P.rect(2, y + 3, 11, 1, '#5e4020');
        P.ellipse(13, y + 2, 2, 2, '#c49a62'); P.px(13, y + 1, '#8a6236');
      }
    });
    I.vine = make(16, 16, P => {
      for (let a = 0; a < 22; a++) { const t2 = a / 22 * Math.PI * 4; const rr = 2 + a * 0.24; P.px(8 + Math.cos(t2) * rr, 8 + Math.sin(t2) * rr, a % 3 ? '#4caf50' : '#8ee06a'); }
      P.px(12, 4, '#c080f0'); P.px(4, 11, '#c080f0');
    });
    I.stone = make(16, 16, P => { P.ellipse(8, 9, 5.5, 4.5, (dx, dy) => dy < -1.5 ? '#c0c0c0' : dy > 2 ? '#6a6a6a' : '#9a9a9a'); P.px(6, 7, '#e0e0e0'); });
    I.fish = make(16, 16, P => P.g.drawImage(S.fx.fish, 0, 0, 10, 6, 1, 4, 14, 8));
    I.meat = make(16, 16, P => { P.ellipse(7, 7, 5, 4, (dx, dy) => dy < -1 ? '#e0808a' : '#c05060'); P.rect(10, 10, 4, 2, '#f0e8d8'); P.rect(13, 9, 2, 4, '#f0e8d8'); P.px(5, 6, '#ffb0b8'); });
    I.cooked = make(16, 16, P => {
      P.ellipse(8, 11, 7, 3, '#e8e8f0'); P.ellipse(8, 10.5, 5, 2, '#c8c8d8');
      P.ellipse(8, 9, 4, 2.5, (dx, dy) => dy < 0 ? '#c07830' : '#8a4a18');
      P.px(6, 3, '#ffffff'); P.px(7, 2, '#ffffff'); P.px(10, 4, '#ffffff'); P.px(9, 3, '#ffffff');
    });
    I.bandage = make(16, 16, P => { P.ellipse(8, 9, 5.5, 5, '#f4f0e8'); P.ellipse(8, 9, 2, 2, '#d8d0c0'); P.rect(12, 9, 3, 4, '#f4f0e8'); P.rect(7, 3, 2, 3, '#e03030'); P.rect(6, 4, 4, 1, '#e03030'); });
    I.key = make(16, 16, P => {
      P.disc(5, 6, 3.5, '#e0b040'); P.g.clearRect(4, 5, 2, 2);
      P.rect(7, 6, 7, 2, '#e0b040'); P.rect(11, 8, 1, 3, '#e0b040'); P.rect(13, 8, 1, 2, '#e0b040'); P.px(4, 4, '#fff0a0');
    });
    I.sailcloth = make(16, 16, P => {
      P.rect(2, 4, 12, 9, '#c8c0a8'); P.rect(2, 3, 12, 8, '#f4f0e0');
      P.rect(2, 6, 12, 1, '#d8d0c0'); P.rect(2, 9, 12, 1, '#d8d0c0'); P.rect(7, 3, 2, 10, '#d94f3d');
    });
    I.shell = make(16, 16, P => {
      P.ellipse(8, 9, 5, 4.5, '#f4c6d0');
      for (let i = -4; i <= 4; i += 2) for (let k = 0; k < 4; k++) P.px(8 + i * (k / 4), 11 - k, '#d890a0');
      P.rect(6, 12, 5, 2, '#d890a0');
    });
    I.relic = make(16, 16, P => P.g.drawImage(o[T.RELIC][0][0], 0, 0));
    I.bottle = make(16, 16, P => P.g.drawImage(S.fx.bottle[0], 0, 0, 12, 12, 1, 1, 14, 14));
    I.spear = make(16, 16, P => { for (let i = 0; i < 11; i++) P.px(3 + i, 13 - i, '#8a6236'); P.rect(12, 2, 3, 3, '#9a9aa4'); P.px(14, 1, '#c0c0c8'); P.px(6, 10, '#6fcf5a'); });
    I.torch = make(16, 16, P => { P.rect(7, 7, 2, 8, '#8a6236'); P.ellipse(8, 5, 2.5, 3.5, '#ff8a2a'); P.ellipse(8, 5.5, 1.3, 2, '#ffe060'); });
    I.raft = make(16, 16, P => P.g.drawImage(S.boats.raft, 0, 0, 20, 16, 0, 2, 16, 13));
    I.sailboat = make(16, 16, P => P.g.drawImage(S.boats.sailboat, 0, 0, 28, 28, 0, 0, 16, 16));
    I.cat = make(16, 16, P => P.g.drawImage(S.mobs.cat.r[0], 0, 0));
    for (const k of ['wood', 'vine', 'stone', 'meat', 'cooked', 'bandage', 'key', 'sailcloth', 'shell', 'spear', 'torch']) outline(I[k]);

    buildExtra();

    // safety: every tile needs art
    for (const k in T) {
      const id = T[k];
      if (!t[id] && !o[id] && !S.tall[id]) t[id] = variants(1, 'grass', null, 1);
    }
  };

  S.make = make; S.outline = outline; S.mirror = mirror;
  // solid white silhouette of a sprite, for hit flashes
  const whiteCache = new Map();
  S.white = function (img) {
    let w = whiteCache.get(img);
    if (!w) {
      w = make(img.width, img.height, P => {
        P.g.drawImage(img, 0, 0);
        P.g.globalCompositeOperation = 'source-in';
        P.g.fillStyle = '#ffffff'; P.g.fillRect(0, 0, img.width, img.height);
      });
      whiteCache.set(img, w);
    }
    return w;
  };
  return S;
})();
