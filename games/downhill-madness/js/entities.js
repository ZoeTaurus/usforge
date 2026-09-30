'use strict';
// Drawing helpers + every object on the mountain. Art is drawn in world units:
// origin at the object's base, x to the right, negative y is up.
const Art = {
  trees: [],
  init() { for (let v = 0; v < 3; v++) this.trees.push(this.makeTree(v)); },

  makeTree(v) {
    const cv = document.createElement('canvas');
    cv.width = 250; cv.height = 500;
    const c = cv.getContext('2d');
    const pal = [['#1d5a44', '#2f7d5a', '#123d2e'], ['#27543c', '#3b7f52', '#183726'], ['#285060', '#3c7482', '#18343f']][v];
    c.fillStyle = '#5b3a26';
    c.fillRect(113, 400, 24, 90);
    for (let i = 0; i < 4; i++) {
      const top = 18 + i * 92, bot = top + 175, hw = 42 + i * 27, teeth = 6;
      c.fillStyle = pal[0];
      c.beginPath();
      c.moveTo(125, top);
      c.lineTo(125 + hw, bot);
      for (let k = 1; k <= teeth; k++) {
        const x = 125 + hw - (2 * hw * k) / teeth;
        c.lineTo(x + hw / teeth, bot - 16);
        c.lineTo(x, bot);
      }
      c.closePath(); c.fill();
      c.fillStyle = pal[2];
      c.globalAlpha = 0.55;
      c.beginPath(); c.moveTo(125, top); c.lineTo(125 + hw, bot); c.lineTo(125 + hw * 0.1, bot - 6); c.closePath(); c.fill();
      c.globalAlpha = 1;
      c.fillStyle = pal[1];
      c.beginPath(); c.moveTo(125, top + 12); c.lineTo(125 - hw * 0.85, bot - 10); c.lineTo(125 - hw * 0.3, bot - 8); c.closePath(); c.fill();
      c.fillStyle = '#f3f8ff';
      c.beginPath();
      c.moveTo(125, top - 3);
      c.lineTo(125 + hw * 0.52, top + 84);
      c.quadraticCurveTo(125 + hw * 0.25, top + 64, 125 + hw * 0.05, top + 86);
      c.quadraticCurveTo(125 - hw * 0.2, top + 62, 125 - hw * 0.5, top + 82);
      c.closePath(); c.fill();
      for (let k = 0; k < teeth; k++) {
        const x = 125 - hw + (2 * hw * (k + 0.5)) / teeth;
        c.beginPath(); c.ellipse(x, bot - 7, 11, 5, 0, 0, TAU); c.fill();
      }
    }
    c.fillStyle = '#eef5ff';
    c.beginPath(); c.ellipse(125, 490, 72, 12, 0, 0, TAU); c.fill();
    return cv;
  },

  ell(c, x, y, rx, ry, col) {
    c.fillStyle = col;
    c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU); c.fill();
  },
  circ(c, x, y, r, col) { this.ell(c, x, y, r, r, col); },
  poly(c, pts, col) {
    c.fillStyle = col;
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fill();
  },
  line(c, pts, col, w) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.stroke();
  },
  rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); },
  label(c, text, x, y, size, fill, stroke) {
    c.font = `${size}px "Luckiest Guy", Impact, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (stroke) { c.lineWidth = size * 0.18; c.strokeStyle = stroke; c.lineJoin = 'round'; c.strokeText(text, x, y); }
    c.fillStyle = fill; c.fillText(text, x, y);
    c.textBaseline = 'alphabetic';
  },
};

// Roadside decoration (not collidable).
const DecoArt = {
  pole(c) {
    for (let i = 0; i < 6; i++) Art.rect(c, -9, -330 + i * 55, 18, 55, i % 2 ? '#1d1d28' : '#ff5a1f');
    Art.poly(c, [9, -330, 90, -300, 9, -270], '#ff5a1f');
  },
  sign(c, d) {
    Art.rect(c, -14, -270, 28, 270, '#6b4424');
    Art.rect(c, -200, -400, 400, 140, '#6b4424');
    Art.rect(c, -188, -388, 376, 116, '#f2c14e');
    c.font = '56px "Luckiest Guy", Impact, sans-serif';
    const w = c.measureText(d.text).width, sc = Math.min(1, 340 / w);
    c.save(); c.translate(0, -322); c.scale(sc, sc);
    Art.label(c, d.text, 0, 4, 56, '#2b1d0e');
    c.restore();
    Art.poly(c, [-210, -400, 210, -400, 190, -425, -190, -425], '#f7fbff');
  },
};

const Ent = {
  cross(e, dt) { e.x += e.vx * dt; },
  // Falling objects wait until the player is close enough that they land right on arrival.
  faller(e, dt, G) {
    if (!e.falling) {
      if (e.z - G.player.z < Math.max(G.player.speed, 2500) * e.fallT) e.falling = true;
      return false;
    }
    e.vy -= CFG.GRAVITY * dt;
    e.y += e.vy * dt;
    return e.y <= 0;
  },
};

const ET = {
  rock: {
    kind: 'crash', w: 170, h: 150, d: 70, name: 'a rock',
    draw(c) {
      Art.poly(c, [-190, 0, -175, -90, -110, -150, -20, -175, 90, -160, 170, -95, 195, 0], '#6c7488');
      Art.poly(c, [40, -168, 90, -160, 170, -95, 195, 0, 60, 0, 80, -80], '#565d70');
      Art.poly(c, [-150, -118, -110, -150, -20, -175, 90, -160, 132, -126, 60, -138, 0, -124, -60, -142], '#f4f8ff');
    },
  },
  tree: {
    kind: 'crash', w: 110, h: 950, d: 60, name: 'a tree',
    draw(c, e) { const s = e.s || 1; c.drawImage(Art.trees[e.v || 0], -250 * s, -1000 * s, 500 * s, 1000 * s); },
  },
  snowman: {
    kind: 'smash', w: 130, h: 460, d: 60,
    draw(c, e, t) {
      c.strokeStyle = '#c3d3e8'; c.lineWidth = 8;
      for (const [y, r] of [[-100, 110], [-255, 82], [-375, 58]]) {
        Art.circ(c, 0, y, r, '#f6faff');
        c.beginPath(); c.arc(0, y, r, -0.3, 1.9); c.stroke();
      }
      const wave = Math.sin(t * 5 + e.seed) * 0.35;
      Art.line(c, [-70, -265, -150, -330 - wave * 60, -185, -390 - wave * 80], '#5b3a26', 12);
      Art.line(c, [70, -265, 160, -300 + wave * 40, 195, -290], '#5b3a26', 12);
      for (const y of [-280, -240, -200]) Art.circ(c, 0, y, 10, '#222');
      Art.circ(c, -22, -390, 9, '#222'); Art.circ(c, 22, -390, 9, '#222');
      Art.poly(c, [0, -375, 75, -365, 0, -356], '#ff8c1a');
      Art.rect(c, -60, -330, 120, 24, '#d62839');
      Art.rect(c, -72, -432, 144, 16, '#1d1d28');
      Art.rect(c, -46, -500, 92, 72, '#1d1d28');
      Art.rect(c, -46, -448, 92, 13, '#d62839');
    },
  },
  penguin: {
    kind: 'smash', w: 80, h: 200, d: 50, update: Ent.cross,
    draw(c, e, t) {
      c.rotate(Math.sin(t * 14 + e.seed) * 0.13);
      const flap = Math.sin(t * 18 + e.seed) * 25;
      Art.poly(c, [-48, -140, -92, -70 + flap, -44, -76], '#1c1f2b');
      Art.poly(c, [48, -140, 92, -70 - flap, 44, -76], '#1c1f2b');
      Art.ell(c, 0, -92, 56, 92, '#1c1f2b');
      Art.ell(c, 0, -80, 38, 70, '#f5f5f5');
      Art.ell(c, 0, -172, 40, 38, '#1c1f2b');
      Art.circ(c, -14, -180, 10, '#fff'); Art.circ(c, 14, -180, 10, '#fff');
      Art.circ(c, -12, -179, 5, '#111'); Art.circ(c, 12, -179, 5, '#111');
      Art.poly(c, [-13, -165, 13, -165, 0, -143], '#ffa51f');
      Art.ell(c, -22, -4, 22, 9, '#ffa51f'); Art.ell(c, 22, -4, 22, 9, '#ffa51f');
    },
  },
  ramp: {
    kind: 'ramp', w: 340, h: 0, d: 160, power: 1,
    draw(c) { drawRamp(c, 340, 170, false); },
  },
  megaramp: {
    kind: 'ramp', w: 560, h: 0, d: 220, power: 1.75,
    draw(c) { drawRamp(c, 560, 300, true); },
  },
  mogul: {
    kind: 'bump', w: 280, h: 0, d: 120,
    draw(c) {
      c.fillStyle = '#dfe9f6';
      c.beginPath(); c.ellipse(0, 0, 290, 95, 0, Math.PI, TAU); c.fill();
      c.fillStyle = '#f7fbff';
      c.beginPath(); c.ellipse(-30, 0, 240, 85, 0, Math.PI, TAU); c.fill();
    },
  },
  coin: {
    kind: 'coin', w: 120, h: 220, d: 90,
    draw(c, e, t) {
      c.translate(0, -110);
      Art.circ(c, 0, 0, 100, 'rgba(255,214,70,0.28)');
      const sp = Math.cos(t * 5 + e.seed);
      c.scale(Math.max(0.15, Math.abs(sp)), 1);
      Art.circ(c, 0, 0, 72, '#e89b00');
      Art.circ(c, 0, 0, 62, '#ffcc2e');
      Art.circ(c, 0, 0, 50, '#ffe177');
      c.strokeStyle = '#e89b00'; c.lineWidth = 10; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        c.beginPath(); c.moveTo(Math.cos(a) * -36, Math.sin(a) * -36); c.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); c.stroke();
      }
    },
  },
  boost: { kind: 'boost', w: 300, h: 0, d: 220, flat: true },
  yeti: {
    kind: 'crash', w: 190, h: 640, d: 80, name: 'a yeti', update: Ent.cross,
    draw(c, e, t) {
      const st = Math.sin(t * 8 + e.seed);
      Art.rect(c, -85, -170 + Math.max(0, st) * -30, 62, 170, '#dfe7f2');
      Art.rect(c, 23, -170 + Math.max(0, -st) * -30, 62, 170, '#dfe7f2');
      Art.ell(c, -55, -8 + Math.max(0, st) * -30, 50, 18, '#7b93b8');
      Art.ell(c, 55, -8 + Math.max(0, -st) * -30, 50, 18, '#7b93b8');
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * 130, -440); c.rotate(s * (2.5 + Math.sin(t * 9 + s) * 0.35));
        Art.ell(c, 0, 70, 48, 115, '#eef3fa');
        Art.ell(c, 0, 175, 34, 26, '#7b93b8');
        c.restore();
      }
      Art.ell(c, 0, -340, 155, 215, '#eef3fa');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        Art.ell(c, Math.cos(a) * 150, -340 + Math.sin(a) * 205, 32, 26, '#eef3fa');
      }
      Art.ell(c, 0, -300, 95, 150, '#dce5f1');
      Art.ell(c, 0, -480, 76, 66, '#7b93b8');
      Art.ell(c, -28, -500, 18, 14, '#fff'); Art.ell(c, 28, -500, 18, 14, '#fff');
      Art.circ(c, -26, -498, 8, '#101a3a'); Art.circ(c, 26, -498, 8, '#101a3a');
      Art.line(c, [-50, -528, -10, -514], '#2c3a55', 10); Art.line(c, [50, -528, 10, -514], '#2c3a55', 10);
      Art.ell(c, 0, -452, 40, 22 + Math.abs(Math.sin(t * 6)) * 10, '#3a1020');
      Art.poly(c, [-28, -466, -18, -448, -8, -466], '#fff'); Art.poly(c, [8, -466, 18, -448, 28, -466], '#fff');
    },
  },
  snowball: {
    kind: 'crash', w: 300, h: 600, d: 250, name: 'a giant snowball', update(e, dt) { e.x += e.vx * dt; e.rot2 = (e.rot2 || 0) + e.vx * dt * 7; },
    draw(c, e) {
      c.translate(0, -300);
      c.save(); c.rotate(e.rot2 || 0);
      Art.circ(c, 0, 0, 300, '#f4f8ff');
      c.strokeStyle = '#d4e0ef'; c.lineWidth = 14;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(0, 0, 90 + i * 45, i, i + 1.6); c.stroke(); }
      Art.line(c, [180, -200, 330, -330], '#3d6fd6', 22); Art.line(c, [215, -170, 360, -290], '#3d6fd6', 22);
      Art.line(c, [-150, 230, -230, 360], '#1d1d28', 34); Art.line(c, [-100, 250, -150, 390], '#1d1d28', 34);
      Art.ell(c, -238, 372, 36, 22, '#d62839'); Art.ell(c, -155, 402, 36, 22, '#d62839');
      c.save(); c.translate(-240, -150); c.rotate(-0.9); c.drawImage(Art.trees[1], -80, -330, 160, 320); c.restore();
      c.restore();
      c.globalAlpha = 0.35;
      c.fillStyle = '#9fb3cf';
      c.beginPath(); c.arc(0, 0, 300, -1.2, 1.9); c.arc(-40, -10, 270, 1.9, -1.2, true); c.fill();
      c.globalAlpha = 1;
    },
  },
  pylon: {
    kind: 'crash', w: 70, h: 1500, d: 50, name: 'a ski lift tower',
    draw(c, e, t) {
      Art.poly(c, [-55, 0, -28, -1450, 28, -1450, 55, 0], '#8d97a8');
      c.strokeStyle = '#6b7486'; c.lineWidth = 10;
      for (let y = -100; y > -1400; y -= 160) {
        c.beginPath(); c.moveTo(-50, y); c.lineTo(45, y - 150); c.moveTo(50, y); c.lineTo(-45, y - 150); c.stroke();
      }
      Art.rect(c, -300, -1480, 600, 40, '#5f6879');
      for (const s of [-1, 1]) {
        const sw = Math.sin(t * 2 + s + e.seed) * 0.08;
        c.save(); c.translate(s * 250, -1440); c.rotate(sw);
        Art.line(c, [0, 0, 0, 230], '#3a4050', 10);
        Art.rect(c, -80, 230, 160, 22, '#e63946');
        Art.rect(c, -80, 160, 18, 80, '#e63946');
        if (s === 1) { // a very patient skeleton
          Art.circ(c, 0, 128, 32, '#f3efe0');
          Art.circ(c, -11, 124, 7, '#222'); Art.circ(c, 11, 124, 7, '#222');
          Art.line(c, [0, 160, 0, 225, 50, 232, 60, 290], '#f3efe0', 12);
        }
        c.restore();
      }
    },
  },
  piano: {
    kind: 'crash', w: 220, h: 320, d: 120, name: 'a falling piano',
    update(e, dt, G) {
      if (Ent.faller(e, dt, G)) {
        e.type = 'wreck'; e.y = 0;
        G.spawnFx('poof', e.x, e.z);
        if (e.z - G.player.z < 16000) Sfx.plonk();
      } else if (e.falling) e.rot = Math.sin(e.t * 3) * 0.25;
    },
    draw(c, e) {
      c.translate(0, -160); c.rotate(e.rot || 0);
      Art.rect(c, -210, -160, 420, 300, '#17131a');
      Art.rect(c, -226, -176, 452, 26, '#2e2436');
      Art.rect(c, -200, 0, 400, 56, '#231c29');
      Art.rect(c, -190, 6, 380, 36, '#f8f5ea');
      for (let i = 0; i < 13; i++) if (i % 7 !== 2 && i % 7 !== 6) Art.rect(c, -180 + i * 28, 6, 14, 22, '#111');
      Art.rect(c, -190, 56, 30, 100, '#17131a'); Art.rect(c, 160, 56, 30, 100, '#17131a');
      Art.label(c, 'GRAND-ISH', 0, -80, 44, '#d8b25a');
    },
  },
  wreck: {
    kind: 'crash', w: 230, h: 150, d: 120, name: 'a smashed piano',
    draw(c) {
      c.save(); c.rotate(0.18);
      Art.rect(c, -220, -130, 440, 130, '#17131a');
      Art.rect(c, -200, -150, 380, 30, '#f8f5ea');
      c.restore();
      Art.rect(c, 230, -20, 50, 18, '#f8f5ea'); Art.rect(c, -300, -12, 40, 14, '#f8f5ea');
      Art.line(c, [-120, -150, -60, -230, 0, -170], '#d8b25a', 6);
    },
  },
  cow: {
    kind: 'crash', w: 190, h: 230, d: 120, name: 'a flying cow',
    update(e, dt, G) {
      e.x += e.vx * dt;
      if (!e.mooed && e.z - G.player.z < 9000) { e.mooed = true; Sfx.moo(); }
    },
    draw(c, e, t) {
      c.translate(0, -115);
      c.rotate(Math.sin(t * 3 + e.seed) * 0.35);
      if (e.vx > 0) c.scale(-1, 1);
      for (const [x, a] of [[-90, -0.7], [-40, -0.2], [50, 0.2], [100, 0.7]]) {
        c.save(); c.translate(x, 60); c.rotate(a + Math.sin(t * 9 + x) * 0.3);
        Art.rect(c, -13, 0, 26, 90, '#fafafa'); Art.rect(c, -14, 80, 28, 22, '#2b2b2b');
        c.restore();
      }
      Art.ell(c, 0, 0, 170, 96, '#fafafa');
      Art.ell(c, -60, -22, 42, 30, '#222'); Art.ell(c, 55, 28, 46, 28, '#222'); Art.ell(c, 100, -44, 26, 20, '#222');
      Art.ell(c, 30, 88, 30, 18, '#ff9fb0');
      Art.line(c, [165, -10, 215, -60 + Math.sin(t * 12) * 20], '#fafafa', 12);
      Art.ell(c, -175, -42, 62, 52, '#fafafa');
      Art.poly(c, [-205, -86, -240, -130, -190, -95], '#e9dcc0'); Art.poly(c, [-150, -88, -125, -135, -160, -94], '#e9dcc0');
      Art.ell(c, -212, -18, 38, 27, '#ff9fb0');
      Art.circ(c, -222, -18, 6, '#8a4455'); Art.circ(c, -202, -18, 6, '#8a4455');
      Art.circ(c, -190, -58, 9, '#222'); Art.circ(c, -160, -58, 9, '#222');
      Art.rect(c, -225, -104, 70, 16, '#ff5a1f'); Art.rect(c, -210, -128, 40, 30, '#ff5a1f'); // tiny aviator cap
    },
  },
  ufo: {
    kind: 'beam', w: 250, h: 1400, d: 280,
    update(e, dt) { e.y = 1400 + Math.sin(e.t * 2) * 70; e.x = e.bx + Math.sin(e.t * 0.9) * 0.08; },
    shadow: false,
    draw(c, e, t) {
      const g = c.createLinearGradient(0, 0, 0, e.y);
      g.addColorStop(0, 'rgba(140,255,170,0.55)');
      g.addColorStop(1, 'rgba(140,255,170,0.12)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(-70, 20); c.lineTo(70, 20); c.lineTo(270, e.y); c.lineTo(-270, e.y); c.closePath(); c.fill();
      Art.ell(c, 0, e.y, 270, 60, 'rgba(140,255,170,0.35)');
      c.fillStyle = 'rgba(170,230,255,0.75)';
      c.beginPath(); c.ellipse(0, -30, 110, 90, 0, Math.PI, TAU); c.fill();
      Art.ell(c, 0, -60, 36, 44, '#6fe36f');
      Art.ell(c, -14, -66, 11, 16, '#111'); Art.ell(c, 14, -66, 11, 16, '#111');
      Art.ell(c, 0, 0, 270, 58, '#a9b3c7');
      Art.ell(c, 0, 16, 250, 34, '#7d879c');
      for (let i = 0; i < 8; i++) {
        const on = (Math.floor(t * 8) + i) % 2 === 0;
        Art.circ(c, -210 + i * 60, 6, 13, on ? '#fff36b' : '#ff4fa3');
      }
    },
  },
  meteor: {
    kind: 'none', w: 0, h: 0, d: 0,
    update(e, dt, G) {
      if (Ent.faller(e, dt, G)) {
        e.type = 'crater'; e.y = 0; e.x = e.tx; e.t = 0;
        G.spawnFx('boom', e.x, e.z);
        const dz = e.z - G.player.z;
        if (dz < 20000) { Sfx.boom(U.clamp(1 - dz / 20000, 0.3, 1)); G.shake = Math.max(G.shake, 0.6 * (1 - dz / 20000)); }
        return;
      }
      e.x = e.tx + (e.y / e.y0) * 1.4 * e.dir;
    },
    draw(c, e, t) {
      c.rotate(-0.5 * e.dir);
      const g = c.createLinearGradient(0, 0, 0, -900);
      g.addColorStop(0, 'rgba(255,190,70,0.95)');
      g.addColorStop(1, 'rgba(255,60,30,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(-110, 0); c.lineTo(0, -950); c.lineTo(110, 0); c.closePath(); c.fill();
      Art.circ(c, 0, 0, 150, 'rgba(255,170,60,0.5)');
      Art.circ(c, 0, 0, 115, '#5b3a2e');
      Art.line(c, [-50, -30, 0, 10, 40, -40], '#ffb347', 14);
      Art.line(c, [-20, 50, 30, 30], '#ffb347', 12);
    },
  },
  crater: {
    kind: 'crash', w: 270, h: 170, d: 150, name: 'a meteor crater',
    draw(c, e, t) {
      Art.ell(c, 0, 0, 300, 80, '#6b5a66');
      Art.ell(c, 0, 4, 240, 56, '#2e2127');
      for (let i = 0; i < 5; i++) {
        const x = -160 + i * 80, h = 120 + Math.sin(t * 13 + i * 2) * 40;
        Art.poly(c, [x - 40, 0, x + Math.sin(t * 9 + i) * 20, -h, x + 40, 0], i % 2 ? '#ff7a1f' : '#ffc23a');
      }
      Art.ell(c, 0, -10, 70, 50, '#3b2a24');
    },
  },
  duck: {
    kind: 'crash', w: 300, h: 680, d: 150, name: 'a giant rubber duck',
    draw(c, e, t) {
      c.rotate(Math.sin(t * 2 + e.seed) * 0.05);
      Art.ell(c, -250, -250, 90, 130, '#f2bf00'); Art.ell(c, 250, -250, 90, 130, '#f2bf00');
      Art.ell(c, 0, -230, 300, 215, '#ffd21f');
      Art.ell(c, 60, -190, 200, 140, '#ffe45c');
      Art.ell(c, 0, -530, 155, 145, '#ffd21f');
      Art.ell(c, 0, -470, 100, 42, '#ff7b1c');
      Art.ell(c, 0, -458, 80, 18, '#e0600c');
      Art.ell(c, -62, -570, 22, 30, '#1a1a1a'); Art.ell(c, 62, -570, 22, 30, '#1a1a1a');
      Art.circ(c, -55, -580, 8, '#fff'); Art.circ(c, 69, -580, 8, '#fff');
    },
  },
  dino: {
    kind: 'crash', w: 260, h: 920, d: 150, name: 'a T-rex in a beanie',
    update(e, dt, G) {
      e.x += e.vx * dt;
      if (!e.roared && e.z - G.player.z < 10000) { e.roared = true; Sfx.roar(); }
    },
    draw(c, e, t) {
      if (e.vx < 0) c.scale(-1, 1);
      const st = Math.sin(t * 6 + e.seed);
      Art.poly(c, [-110, -470, -470, -330, -130, -380], '#3a9a48');
      for (const [x, ph] of [[-60, 0], [30, Math.PI]]) {
        c.save(); c.translate(x, -340); c.rotate(Math.sin(t * 6 + ph) * 0.35);
        Art.rect(c, -38, 0, 76, 300, ph ? '#46b556' : '#3a9a48');
        Art.rect(c, -30, 280, 100, 40, '#2f7d3b');
        c.restore();
      }
      Art.ell(c, 0, -440, 200, 155, '#46b556');
      Art.ell(c, 50, -400, 125, 100, '#9be07a');
      Art.line(c, [140, -470, 200, -430 + st * 15, 225, -445], '#46b556', 22);
      Art.rect(c, 90, -640, 90, 150, '#46b556');
      Art.ell(c, 180, -680, 160, 95, '#46b556');
      Art.poly(c, [120, -640, 330, -650, 320, -600, 130, -610], '#46b556');
      Art.poly(c, [150, -640, 320, -660, 320, -650, 150, -625], '#7a1f2a');
      for (let i = 0; i < 6; i++) Art.poly(c, [170 + i * 26, -652, 182 + i * 26, -632, 194 + i * 26, -654], '#fff');
      Art.circ(c, 215, -715, 18, '#fff'); Art.circ(c, 220, -713, 9, '#111');
      c.fillStyle = '#d62839';
      c.beginPath(); c.ellipse(160, -755, 115, 70, 0, Math.PI, TAU); c.fill();
      Art.rect(c, 45, -765, 230, 24, '#ffd23f');
      Art.circ(c, 160, -835, 30, '#fff');
      Art.rect(c, 80, -560, 120, 36, '#ffd23f');
      Art.rect(c, 70, -560, 36, 110, '#ffd23f');
    },
  },
  poof: {
    kind: 'none', w: 0, h: 0, d: 0,
    update(e) { if (e.t > 0.7) e.dead = true; },
    draw(c, e) {
      const k = e.t / 0.7;
      c.globalAlpha *= 1 - k;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        Art.circ(c, Math.cos(a) * 260 * k, -120 + Math.sin(a) * 160 * k - 100 * k, 110 * (1 - k * 0.5), '#f7fbff');
      }
    },
  },
  boom: {
    kind: 'none', w: 0, h: 0, d: 0,
    update(e) { if (e.t > 0.9) e.dead = true; },
    draw(c, e) {
      const k = e.t / 0.9;
      c.globalAlpha *= 1 - k;
      Art.circ(c, 0, -200 - k * 300, 250 + k * 350, '#5a4a52');
      Art.circ(c, 0, -150 - k * 200, 200 + k * 250, '#ff7a1f');
      Art.circ(c, 0, -120 - k * 150, 120 + k * 150, '#ffe07a');
    },
  },
};

function drawRamp(c, w, h, mega) {
  for (const s of [-1, 1]) {
    Art.rect(c, s * (w + 40) - 6, -h - 260, 12, h + 260, '#3a2a1a');
    Art.poly(c, [s * (w + 40), -h - 260, s * (w + 40) + s * 110, -h - 225, s * (w + 40), -h - 190], mega ? '#ff2e63' : '#ff5a1f');
  }
  Art.poly(c, [-w - 24, 0, -w * 0.94 - 24, -h, -w * 0.94, -h, -w, 0], '#6d4522');
  Art.poly(c, [w + 24, 0, w * 0.94 + 24, -h, w * 0.94, -h, w, 0], '#6d4522');
  Art.poly(c, [-w, 0, -w * 0.94, -h, w * 0.94, -h, w, 0], mega ? '#f7f7f7' : '#c9864f');
  if (mega) {
    for (let i = 0; i < 6; i++) {
      const x0 = -w + (i * 2 * w) / 6;
      Art.poly(c, [x0, 0, x0 + w / 6, 0, x0 * 0.94 + (w / 6) * 0.94, -h, x0 * 0.94, -h], i % 2 ? '#ffffff' : '#e63946');
    }
  } else {
    c.strokeStyle = '#a86f3a'; c.lineWidth = 6;
    for (let i = 1; i < 5; i++) { const y = (-h * i) / 5; c.beginPath(); c.moveTo(-w, y); c.lineTo(w, y); c.stroke(); }
  }
  for (let i = 0; i < 2; i++) {
    const y = -h * (0.25 + i * 0.42);
    Art.line(c, [-80, y + 40, 0, y - 5, 80, y + 40], '#ffd23f', 24);
  }
  Art.poly(c, [-w * 0.94, -h - 16, w * 0.94, -h - 16, w * 0.94, -h, -w * 0.94, -h], '#3a2a1a');
  if (mega) Art.label(c, 'MEGA', 0, -h * 0.55, 120, '#ffd23f', '#101a3a');
}

// ---------------------------------------------------------------- v2 additions
const POWERS = {
  shield: { name: 'SHIELD', color: '#4db8ff', dur: 20, sub: 'absorbs one wipeout' },
  magnet: { name: 'COIN MAGNET', color: '#ff4f7b', dur: 10, sub: 'coins come to you' },
  rocket: { name: 'ROCKET!', color: '#ff7a1f', dur: 4, sub: 'smash through everything' },
  double: { name: '2× POINTS', color: '#5ee27a', dur: 15, sub: 'everything scores double' },
};

// Icon drawn centred at 0,0 with radius r (used on the mountain and in the HUD).
function drawPowerIcon(c, type, r) {
  const col = POWERS[type].color;
  Art.circ(c, 0, 0, r, col);
  Art.circ(c, 0, 0, r * 0.8, '#101a3a');
  c.save(); c.scale(r / 100, r / 100);
  if (type === 'shield') {
    Art.poly(c, [0, -55, 45, -38, 40, 20, 0, 55, -40, 20, -45, -38], col);
    Art.poly(c, [0, -38, 28, -26, 25, 12, 0, 36], '#bfe6ff');
  } else if (type === 'magnet') {
    c.strokeStyle = col; c.lineWidth = 26; c.lineCap = 'butt';
    c.beginPath(); c.arc(0, -5, 34, Math.PI, 0, true); c.stroke();
    Art.rect(c, -47, -10, 26, 24, '#e6f4ff'); Art.rect(c, 21, -10, 26, 24, '#e6f4ff');
  } else if (type === 'rocket') {
    c.rotate(-0.6);
    Art.poly(c, [0, -58, 20, -20, 20, 30, -20, 30, -20, -20], '#e6f4ff');
    Art.poly(c, [-20, 10, -36, 36, -20, 30], col); Art.poly(c, [20, 10, 36, 36, 20, 30], col);
    Art.circ(c, 0, -12, 9, col);
    Art.poly(c, [-12, 32, 0, 62, 12, 32], '#ffd23f');
  } else {
    Art.label(c, '2×', 0, 6, 70, col);
  }
  c.restore();
}

// Ground-plane helper: fill a polygon given world offsets [dx, dz] from the entity.
function groundPoly(c, gp, pts, col) {
  c.fillStyle = col;
  c.beginPath();
  pts.forEach((p, i) => { const q = gp(p[0], p[1]); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
  c.closePath(); c.fill();
}

Object.assign(ET, {
  boost: {
    kind: 'boost', w: 300, h: 0, d: 220, flat: true,
    drawFlat(c, gp, e, t) {
      const w = 300;
      groundPoly(c, gp, [[-w - 40, -230], [w + 40, -230], [w + 40, 230], [-w - 40, 230]], 'rgba(16,26,58,0.55)');
      for (let i = 0; i < 3; i++) {
        const dz = -150 + i * 140, on = (Math.floor(t * 10) - i) % 3 === 0;
        groundPoly(c, gp, [[-w, dz - 60], [0, dz + 50], [w, dz - 60], [w, dz - 10], [0, dz + 100], [-w, dz - 10]], on ? '#ffffff' : '#35f0ff');
      }
    },
  },
  power: {
    kind: 'power', w: 160, h: 360, d: 110,
    update(e) { e.y = 140 + Math.sin(e.t * 3 + e.seed) * 40; },
    draw(c, e, t) {
      c.translate(0, -120);
      Art.circ(c, 0, 0, 150 + Math.sin(t * 8) * 10, U.rgb(U.hex(POWERS[e.p].color), 0.25));
      c.rotate(Math.sin(t * 2 + e.seed) * 0.3);
      drawPowerIcon(c, e.p, 110);
    },
  },
  crevasse: {
    kind: 'crevasse', w: 2800, h: 0, d: 0, len: 1600, flat: true,
    update(e, dt, G) {
      if (!e.warned && e.z - G.player.z < Math.max(G.player.speed, 3000) * 2.4) {
        e.warned = true;
        G.banner('CREVASSE! HIT A RAMP!', '#4db8ff');
        if (!G.attract) Sfx.whoosh();
      }
    },
    drawFlat(c, gp, e, t) {
      const W = 2800, L = 1600;
      groundPoly(c, gp, [[-W, -60], [W, -60], [W, L + 60], [-W, L + 60]], '#9fd8ff');
      groundPoly(c, gp, [[-W, 0], [W, 0], [W, L], [-W, L]], '#0c2748');
      groundPoly(c, gp, [[-W, L * 0.55], [W, L * 0.55], [W, L], [-W, L]], '#16406e');
      groundPoly(c, gp, [[-W, L - 90], [W, L - 90], [W, L], [-W, L]], '#5fa8e0');
      for (let i = -10; i <= 10; i++) {
        const x = i * 260, h = 80 + Math.abs((i * 37) % 60);
        groundPoly(c, gp, [[x - 50, 0], [x + 50, 0], [x, h]], '#dff3ff');
      }
    },
  },
  snowcat: {
    kind: 'crash', w: 340, h: 540, d: 160, name: 'an oncoming snowcat',
    update(e, dt, G) {
      e.z += e.vz * dt;
      if (!e.honked && e.z - G.player.z < 14000) { e.honked = true; Sfx.honk(); }
    },
    draw(c, e, t) {
      Art.rect(c, -330, -120, 110, 120, '#2b2d42'); Art.rect(c, 220, -120, 110, 120, '#2b2d42');
      for (let i = 0; i < 5; i++) { Art.rect(c, -330, -110 + i * 24, 110, 8, '#4a4d63'); Art.rect(c, 220, -110 + i * 24, 110, 8, '#4a4d63'); }
      Art.rect(c, -230, -300, 460, 230, '#e63946');
      Art.rect(c, -170, -500, 340, 210, '#e63946');
      Art.rect(c, -145, -475, 290, 150, '#9fd8ff');
      Art.circ(c, 0, -390, 34, '#f1c19e');
      Art.rect(c, -40, -432, 80, 22, '#ffd23f');
      Art.line(c, [40, -380, 90, -440 + Math.sin(t * 12) * 20], '#f1c19e', 16);
      const flash = Math.floor(t * 6) % 2;
      Art.rect(c, -30, -540, 60, 40, flash ? '#ffb02e' : '#a86400');
      for (const s of [-1, 1]) {
        Art.circ(c, s * 170, -240, 90, 'rgba(255,247,194,0.25)');
        Art.circ(c, s * 170, -240, 44, '#fff7c2');
      }
      Art.rect(c, -390, -110, 780, 90, '#c9ced8');
      Art.rect(c, -390, -110, 780, 16, '#eef2f8');
      for (let i = 0; i < 13; i++) Art.poly(c, [-380 + i * 60, -20, -350 + i * 60, 10, -320 + i * 60, -20], '#8d97a8');
      Art.label(c, 'GROOMING IN PROGRESS', 0, -190, 36, '#ffffff', '#101a3a');
    },
  },
  rival: {
    kind: 'rival', w: 150, h: 380, d: 100,
    update(e, dt) {
      e.z += e.vz * dt;
      e.x = e.bx + Math.sin(e.t * 0.8 + e.seed) * 0.35;
    },
    draw(c, e, t) {
      Player.drawFigure(c, sledById(e.sled), outfitById(e.outfit), false, 'ride', t, 6000, Math.cos(e.t * 0.8 + e.seed) * 0.5);
      Art.label(c, e.name, 0, -480, 64, '#ffffff', '#101a3a');
    },
  },
  gate: {
    kind: 'gate', w: 430, h: 800, d: 80,
    draw(c, e, t) {
      const col = e.hit ? '#5ee27a' : e.col;
      for (const s of [-1, 1]) {
        Art.rect(c, s * 430 - 14, -800, 28, 800, '#1d1d28');
        Art.poly(c, [s * 430, -720, s * 430 - s * 160, -680 + Math.sin(t * 10 + s) * 12, s * 430, -620], col);
      }
      Art.rect(c, -444, -840, 888, 100, col);
      Art.label(c, e.hit ? 'NICE!' : 'GO!', 0, -786, 70, '#ffffff', '#101a3a');
    },
  },
  bestflag: {
    kind: 'marker', w: 99999, h: 0, d: 200,
    draw(c, e) {
      const X = 2000;
      for (const s of [-1, 1]) Art.rect(c, s * X - 25, -1300, 50, 1300, '#101a3a');
      Art.rect(c, -X, -1320, X * 2, 220, '#ffffff');
      for (let i = 0; i < 40; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) Art.rect(c, -X + i * 100, -1320 + j * 40, 100, 40, '#101a3a');
      Art.label(c, e.label, 0, -1165, 110, '#ffd23f', '#101a3a');
    },
  },
});
