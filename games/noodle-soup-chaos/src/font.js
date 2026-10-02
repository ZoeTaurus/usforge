'use strict';
// Tiny 3x5 bitmap font. Every glyph is 15 bits, read row by row.
const FONT_SRC = {
  'A':'010101111101101','B':'110101110101110','C':'011100100100011','D':'110101101101110',
  'E':'111100110100111','F':'111100110100100','G':'011100101101011','H':'101101111101101',
  'I':'111010010010111','J':'001001001101010','K':'101101110101101','L':'100100100100111',
  'M':'101111111101101','N':'110101101101101','O':'010101101101010','P':'110101110100100',
  'Q':'010101101110011','R':'110101110101101','S':'011100010001110','T':'111010010010010',
  'U':'101101101101111','V':'101101101101010','W':'101101111111101','X':'101101010101101',
  'Y':'101101010010010','Z':'111001010100111',
  '0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110',
  '4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010',
  '8':'111101111101111','9':'111101111001110',
  '.':'000000000000010',',':'000000000010100','!':'010010010000010','?':'110001010000010',
  ':':'000010000010000',"'":'010010000000000','-':'000000111000000','+':'000010111010000',
  '/':'001001010100100','$':'011110010011110','(':'001010010010001',')':'100010010010100',
  '*':'000101010101000','%':'101001010100101','@':'101111111010000','~':'000011110000000',
  '"':'101101000000000','=':'000111000111000','>':'100010001010100','<':'001010100010001',
  '&':'010101010101011','#':'000010111010101','_':'000000000000111','^':'010101000000000',
  ' ':'000000000000000'
};
const GLYPH = {};
for (const k in FONT_SRC) {
  const g = []; const s = FONT_SRC[k];
  for (let i = 0; i < 15; i++) if (s[i] === '1') g.push([i % 3, (i / 3) | 0]);
  GLYPH[k] = g;
}

function tw(s, sc = 1) { s = String(s); return s.length ? s.length * 4 * sc - sc : 0; }

// Plain text. col may be a single colour or an array of 5 row colours (gradient).
function txt(s, x, y, col, sc = 1) {
  s = String(s).toUpperCase(); x = Math.floor(x); y = Math.floor(y);
  const grad = Array.isArray(col);
  if (!grad) ctx.fillStyle = col;
  let cx = x;
  for (const ch of s) {
    const g = GLYPH[ch] || GLYPH['?'];
    for (let i = 0; i < g.length; i++) {
      const p = g[i];
      if (grad) ctx.fillStyle = col[p[1]];
      ctx.fillRect(cx + p[0] * sc, y + p[1] * sc, sc, sc);
    }
    cx += 4 * sc;
  }
}
function txtC(s, cx, y, col, sc = 1) { txt(s, cx - Math.floor(tw(s, sc) / 2), y, col, sc); }

// Outlined text: draws each lit block expanded by `rad` in the outline colour first.
function txtO(s, x, y, col, ocol = '#1a1020', sc = 1, rad = 1) {
  s = String(s).toUpperCase(); x = Math.floor(x); y = Math.floor(y);
  ctx.fillStyle = ocol;
  let cx = x;
  for (const ch of s) {
    const g = GLYPH[ch] || GLYPH['?'];
    for (const p of g) ctx.fillRect(cx + p[0] * sc - rad, y + p[1] * sc - rad, sc + rad * 2, sc + rad * 2);
    cx += 4 * sc;
  }
  txt(s, x, y, col, sc);
}
function txtOC(s, cx, y, col, ocol, sc = 1, rad = 1) { txtO(s, cx - Math.floor(tw(s, sc) / 2), y, col, ocol, sc, rad); }

// Word wrap to a pixel width.
function wrap(s, maxw) {
  const maxc = Math.max(1, Math.floor((maxw + 1) / 4));
  const words = String(s).toUpperCase().split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (test.length > maxc && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
