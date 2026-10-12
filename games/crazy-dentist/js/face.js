'use strict';
// ============================================================
//  CRAZY DENTIST — the big close-up face (treatment view)
// ============================================================

const FACE = { cx: 126, cy: 92, rx: 112, ry: 104 };
const MOUTH = { cx: 126, cy: 124, rx: 78, ry: 38 };

function ellRow(cx, cy, rx, ry, y, c) {
  const hw = ellHW(rx, ry, y - Math.round(cy));
  if (hw >= 0) rect(Math.round(cx) - hw, y, hw * 2 + 1, 1, c);
}
function ringE(cx, cy, rx, ry, th, c) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    const o = ellHW(rx, ry, dy);
    if (o < 0) continue;
    const i = ellHW(rx - th, ry - th, dy);
    if (i < 0) { rect(cx - o, cy + dy, o * 2 + 1, 1, c); continue; }
    rect(cx - o, cy + dy, o - i, 1, c); rect(cx + i + 1, cy + dy, o - i, 1, c);
  }
}

// current mouth ellipse for an opening amount 0..1
function mouthShape(open) { return { cx: MOUTH.cx, cy: MOUTH.cy, rx: Math.round(lerp(58, MOUTH.rx, open)), ry: Math.max(2, Math.round(lerp(4, MOUTH.ry, open))) }; }

function browColor(L) {
  if (L.type === 'vampire') return P.black;
  if (L.type === 'grandma') return P.lgray;
  if (L.type === 'pirate') return P.ddbrown;
  if (L.type === 'kid' || L.hair === 'bald') return L.hc === P.yellow ? P.gold : L.hc;
  return L.hc === P.yellow ? P.gold : L.hc;
}

// st: { open, pain, numb, mood, t, blink, talk }
function drawFaceBase(L, st) {
  const t = st.t || 0, pain = st.react > 0 ? 100 : (st.pain || 0), fx = st.fx || {};
  const fear = clamp(pain / 100, 0, 1);
  // background: treatment room with lamp glow
  rect(0, 0, W, H, P.navy);
  dellipse(40, 0, 120, 70, P.slate);
  ellipse(40, -4, 50, 24, P.slate);
  dellipse(40, -4, 40, 18, P.gray);

  const { cx, cy } = FACE;
  const shark = L.type === 'shark', alien = L.type === 'alien';
  // ears
  if (!shark && !alien) {
    for (const s of [-1, 1]) {
      const ex = cx + s * 108;
      ellipse(ex, 100, 13, 19, P.black); ellipse(ex, 100, 12, 18, L.shade); ellipse(ex - s * 2, 100, 7, 12, L.skin);
      ellipse(ex - s * 1, 101, 3, 7, L.shade);
    }
  }
  // head
  ellipse(cx, cy, FACE.rx + 1, FACE.ry + 1, P.black);
  ellipse(cx, cy, FACE.rx, FACE.ry, L.shade);
  ellipse(cx - 5, cy - 4, FACE.rx - 6, FACE.ry - 5, L.skin);

  if (L.type === 'pirate') { // earring + beard
    ringE(cx - 108, 124, 6, 6, 2, P.gold);
    dellipse(cx, 142, 98, 44, P.dbrown);
    ellipse(cx, 172, 86, 22, P.dbrown);
  }
  if (shark) {
    ellipse(cx, 146, 84, 36, P.white);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const gx = cx + s * (84 - i * 7);
      line(gx, 74 + i * 2, gx - s * 3, 100 + i * 2, P.dgray, 2);
    }
  }
  if (L.type === 'grandma') {
    line(92, 26, 112, 24, L.shade); line(140, 24, 160, 26, L.shade); line(96, 31, 114, 29, L.shade);
    ellipse(cx - 108, 120, 4, 4, P.white); px(cx - 109, 119, P.lgray);
  }
  // cheeks
  if (!shark) { dellipse(58, 88, 15, 7, L.type === 'alien' ? P.yellow : P.salmon); dellipse(194, 88, 15, 7, L.type === 'alien' ? P.yellow : P.salmon); }
  if (fx.soot) { dellipse(cx, cy, FACE.rx - 2, FACE.ry - 2, P.black); dellipse(cx + 1, cy, FACE.rx - 20, FACE.ry - 20, P.ddbrown); }
  if (L.freckles) for (const [fx, fy] of [[50, 82], [56, 86], [62, 81], [68, 87], [186, 82], [192, 86], [198, 81], [204, 87]]) rect(fx, fy, 2, 2, P.brown);

  // eyes
  const eyeX = shark ? 62 : alien ? 44 : 40;
  const look = clamp((input.x - cx) / 60, -1, 1), lookY = clamp((input.y - 60) / 80, -1, 1);
  for (const s of [-1, 1]) {
    const ex = cx + s * eyeX, ey = shark ? 40 : 44;
    if (L.type === 'pirate' && s === 1) continue;
    if (shark) {
      circle(ex, ey, 7, P.black); rect(ex - 3, ey - 4, 2, 2, P.white);
      continue;
    }
    if (alien) {
      ellipse(ex, ey, 19, 11, P.black);
      ellipse(ex - 6 - s * 0, ey - 4, 4, 2, P.white); px(ex + 6, ey + 3, P.slate);
      if (st.blink) { ellipse(ex, ey, 19, 11, L.shade); rect(ex - 18, ey, 37, 2, P.ddgreen); }
      continue;
    }
    if (st.mood === 'happy') {
      for (let dx = -12; dx <= 12; dx++) rect(ex + dx, ey + 2 - Math.round((1 - (dx / 12) ** 2) * 7), 1, 3, P.black);
      continue;
    }
    const ry = Math.round(9 + fear * 3);
    ellipse(ex, ey, 15, ry + 1, P.black);
    ellipse(ex, ey, 14, ry, P.white);
    const ir = Math.round(7 - fear * 2.5);
    const ix = ex + Math.round(look * 5), iy = ey + Math.round(lookY * 2);
    if (st.hypno) {
      ringE(ex, ey, 8, 8, 2, P.plum); ringE(ex, ey, 5, 5, 1, P.pink); ringE(ex, ey, 3, 3, 1, P.plum);
      const a = (st.t || 0) * 6 * s;
      px(ex + Math.round(Math.cos(a) * 6), ey + Math.round(Math.sin(a) * 6), P.white);
    } else {
      circle(ix, iy, ir, L.eye); circle(ix, iy, Math.max(1, ir - 3), P.black);
      rect(ix - 3, iy - 3, 2, 2, P.white);
    }
    if (st.blink) { ellipse(ex, ey, 15, ry + 1, L.shade); rect(ex - 14, ey, 29, 2, P.black); }
    else if (st.numb || st.mood === 'sleepy') { // droopy lids
      for (let y = ey - ry - 1; y <= ey - 1; y++) ellRow(ex, ey, 15, ry + 1, y, L.shade);
      rect(ex - 14, ey - 1, 29, 1, P.black);
    }
    if (st.mood === 'angry') tri(ex - s * 16, ey - ry - 6, ex + s * 16, ey - ry + 4, ex + s * 16, ey - ry - 6, L.skin);
    if (L.glasses) {
      if (L.type === 'grandma') { ringE(ex, ey, 21, 17, 2, P.gold); }
      else { rect(ex - 19, ey - 13, 38, 3, P.black); rect(ex - 19, ey + 11, 38, 3, P.black); rect(ex - 19, ey - 13, 3, 27, P.black); rect(ex + 16, ey - 13, 3, 27, P.black); }
    }
    if (L.type === 'grandma') { line(ex + s * 24, ey + 2, ex + s * 30, ey - 2, L.shade); line(ex + s * 24, ey + 6, ex + s * 30, ey + 8, L.shade); }
  }
  if (L.glasses) rect(cx - 19, 40, 38, 3, L.type === 'grandma' ? P.gold : P.black);
  if (alien) { ellipse(cx, 18, 9, 6, P.black); px(cx - 3, 15, P.white); px(cx - 2, 15, P.white); }

  // brows
  if (!shark && !alien && !fx.noBrows) {
    const worry = clamp((pain - 30) / 50, 0, 1), anger = st.mood === 'angry' ? 1 : 0;
    for (const s of [-1, 1]) {
      if (L.type === 'pirate' && s === 1) continue;
      const ex = cx + s * eyeX, by = 26;
      line(ex + s * 15, by + 2, ex - s * 12, by - Math.round(worry * 6) + anger * 7, browColor(L), 4);
    }
  }
  if (L.type === 'pirate') {
    line(cx + 30, 36, cx - 100, 8, P.black, 3); line(cx + 50, 44, cx + 108, 60, P.black, 3);
    ellipse(cx + eyeX, 45, 17, 13, P.black); ellipse(cx + eyeX - 4, 41, 5, 3, P.slate);
  }
  // sweat & tears
  if (pain > 45 && !st.numb) {
    const k = (t * 0.7) % 1;
    for (const [sx, off] of [[30, 0], [214, 0.5]]) {
      const kk = (k + off) % 1, sy = 20 + kk * 40;
      rect(sx, sy, 3, 4, P.cyan); px(sx + 1, sy - 1, P.cyan); px(sx, sy + 1, P.white);
    }
  }
  if (pain > 75 && !shark && !alien) {
    for (const s of [-1, 1]) {
      const ex = cx + s * eyeX;
      if (L.type === 'pirate' && s === 1) continue;
      const k = (t * 2 + (s > 0 ? 0.5 : 0)) % 1;
      rect(ex - 10, 56, 3, 10 + k * 20, P.cyan); rect(ex - 9, 56, 1, 10 + k * 20, P.white);
    }
  }

  // nose
  if (alien) { rect(cx - 6, 70, 3, 2, P.ddgreen); rect(cx + 3, 70, 3, 2, P.ddgreen); }
  else if (shark) { rect(cx - 8, 64, 4, 2, P.dgray); rect(cx + 4, 64, 4, 2, P.dgray); }
  else {
    ellipse(cx + 1, 70, 12, 8, L.shade); ellipse(cx - 1, 68, 9, 6, L.skin);
    rect(cx - 5, 64, 3, 2, P.white);
    ellipse(cx - 6, 74, 3, 1, P.ddbrown); ellipse(cx + 6, 74, 3, 1, P.ddbrown);
  }

  // hair / hats
  const hc = L.hc;
  switch (L.hair) {
    case 'short': case 'pony':
      ellipse(cx, -8, 110, 28, hc);
      for (let i = 0; i < 9; i++) ellipse(30 + i * 24, 16, 13, 6, hc);
      break;
    case 'spiky':
      ellipse(cx, -10, 110, 24, hc);
      for (let i = 0; i < 10; i++) tri(22 + i * 21, 10, 44 + i * 21, 10, 33 + i * 21, 26, hc);
      break;
    case 'bob':
      ellipse(28, 46, 18, 48, hc); ellipse(224, 46, 18, 48, hc);
      ellipse(cx, -6, 112, 28, hc); rect(30, 0, 192, 20, hc);
      break;
    case 'bald':
      dellipse(100, 10, 22, 6, P.white);
      ellipse(24, 66, 9, 16, hc); ellipse(228, 66, 9, 16, hc);
      break;
    case 'afro':
      ellipse(14, 44, 24, 44, hc); ellipse(238, 44, 24, 44, hc);
      ellipse(cx, -12, 140, 40, hc);
      dellipse(cx, -12, 136, 36, P.black);
      break;
    case 'bandana':
      ellipse(cx, -6, 114, 28, P.red); ellRow(cx, -6, 114, 28, 21, P.dred);
      for (let i = 0; i < 8; i++) circle(40 + i * 25, 6 + (i % 2) * 6, 2, P.white);
      ellipse(240, 24, 10, 7, P.red); tri(240, 24, 252, 40, 244, 44, P.red); tri(240, 24, 232, 44, 240, 46, P.dred);
      break;
    case 'slick':
      ellipse(cx, -8, 112, 28, P.black); tri(104, 16, 148, 16, cx, 34, P.black);
      line(60, 6, 100, 14, P.slate); line(150, 14, 190, 6, P.slate);
      break;
    case 'fin':
      tri(108, 16, 146, 16, 138, -24, P.black); tri(111, 15, 143, 15, 137, -20, L.skin); line(130, 14, 136, -14, L.shade, 2);
      break;
    case 'bun':
      circle(cx, -10, 22, P.white);
      ellipse(cx, -6, 110, 28, P.white);
      for (let i = 0; i < 6; i++) line(40 + i * 32, 2, 52 + i * 32, 18, P.lgray);
      break;
    case 'beanie':
      ellipse(cx, -4, 114, 30, P.red);
      for (let y = 10; y <= 15; y++) ellRow(cx, -4, 114, 30, y, y < 13 ? P.yellow : P.sky);
      for (let i = 0; i < 6; i++) rect(30 + i * 34, 0, 6, 9, P.dred);
      break;
    case 'antennae':
      for (const s of [-1, 1]) { line(cx + s * 30, 16, cx + s * 52, -2, P.black, 3); circle(cx + s * 52, 2, 5, P.black); circle(cx + s * 52, 2, 4, P.yellow); }
      break;
  }

  if (fx.soot || fx.singed) { // frazzled hair + smoke
    if (fx.soot) for (let i = 0; i < 12; i++) { const hx = 24 + i * 18; line(hx, 22, hx + ((i % 3) - 1) * 6, 6 - (i % 2) * 6, P.black, 2); }
    for (let i = 0; i < 3; i++) { const k = ((st.t || 0) * 0.6 + i / 3) % 1; dellipse(60 + i * 66, 20 - k * 30, 10 + k * 8, 6 + k * 5, P.gray); }
  }
  if (fx.cement) for (const [sx, sy, r] of [[70, 34, 9], [178, 60, 7], [40, 110, 6], [210, 118, 8], [140, 20, 5]]) { ellipse(sx, sy, r + 1, r, P.dgray); ellipse(sx - 1, sy - 1, r, r - 1, P.gray); px(sx - 3, sy - 3, P.lgray); }
  // lips
  const m = mouthShape(st.open || 0);
  if ((st.open || 0) > 0.02) {
    ellipse(m.cx, m.cy, m.rx + 7, m.ry + 7, P.black);
    ellipse(m.cx, m.cy, m.rx + 6, m.ry + 6, L.lipD);
    ellipse(m.cx, m.cy - 1, m.rx + 5, m.ry + 4, L.lip);
    drect(m.cx - 30, m.cy + m.ry + 3, 60, 2, P.white);
  } else {
    // closed mouth with expression
    const curve = st.mood === 'happy' ? -10 : st.mood === 'angry' || pain > 60 ? 7 : -3;
    ellipse(m.cx, m.cy, 62, 9, P.black); ellipse(m.cx, m.cy, 61, 8, L.lip);
    for (let x = -54; x <= 54; x++) {
      const yo = Math.round(curve * ((x / 54) ** 2) - curve * 0.3);
      rect(m.cx + x, m.cy + yo, 1, 2, L.lipD);
    }
    if (L.type === 'vampire') { tri(m.cx - 26, m.cy + 1, m.cx - 18, m.cy + 1, m.cx - 22, m.cy + 10, P.white); tri(m.cx + 18, m.cy + 1, m.cx + 26, m.cy + 1, m.cx + 22, m.cy + 10, P.white); }
  }
}

function drawFaceOver(L, st) {
  const m = mouthShape(st.open || 0), fx = st.fx || {}, t = st.t || 0;
  if (fx.foam) for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, r = 1.12 + (i % 3) * 0.06;
    const bx = m.cx + Math.cos(a) * (m.rx + 6) * r, by = m.cy + Math.sin(a) * (m.ry + 6) * r + Math.sin(t * 3 + i) * 1.5;
    circle(bx, by, 3 + (i % 3), P.lgray); circle(bx - 1, by - 1, 2 + (i % 3), P.white);
  }
  if (fx.bump) { ellipse(150, 6, 13, 9, P.black); ellipse(150, 6, 12, 8, L.skin); rect(146, 1, 3, 2, P.white); }
  if (L.stache) {
    const c = L.hc === P.yellow ? P.gold : L.hc, y = m.cy - m.ry - 6;
    ellipse(m.cx - 18, y, 20, 6, c); ellipse(m.cx + 18, y, 20, 6, c);
    ellipse(m.cx - 36, y + 4, 6, 4, c); ellipse(m.cx + 36, y + 4, 6, 4, c);
  }
  if (L.type === 'kid') { dellipse(m.cx + 52, m.cy + m.ry + 6, 10, 4, P.hot); circle(m.cx + 60, m.cy + m.ry + 2, 2, P.yellow); circle(m.cx - 56, m.cy + 8, 2, P.cyan); }
}
