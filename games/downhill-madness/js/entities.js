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
      if (e.y < 10) { c.fillStyle = 'rgba(20,30,70,0.18)'; c.beginPath(); c.ellipse(0, 0, 70, 16, 0, 0, TAU); c.fill(); }
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
      if (!e.falling) return; // only its shadow shows until it drops
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
  } else if (type === 'giant') {
    Art.label(c, 'XL', 0, 6, 74, col);
  } else if (type === 'wings') {
    for (const sd of [-1, 1]) {
      c.fillStyle = col; c.beginPath();
      c.moveTo(sd * 6, 10); c.quadraticCurveTo(sd * 60, -60, sd * 58, -10); c.quadraticCurveTo(sd * 40, 20, sd * 6, 10); c.fill();
    }
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

// ---------------------------------------------------------------- v4: more obstacles
// Low ones (log, fence, skier) can be cleared with a hop.
Object.assign(ET, {
  log: {
    kind: 'crash', w: 420, h: 120, d: 70, name: 'a fallen log',
    draw(c) {
      Art.rect(c, -420, -120, 840, 110, '#7a4a24');
      for (let i = 0; i < 6; i++) Art.rect(c, -400 + i * 140, -110, 90, 8, '#5e3518');
      Art.ell(c, -420, -65, 30, 58, '#c9955a'); Art.ell(c, -420, -65, 16, 32, '#a87a44');
      Art.ell(c, 420, -65, 30, 58, '#c9955a'); Art.ell(c, 420, -65, 16, 32, '#a87a44');
      Art.poly(c, [-400, -118, -300, -140, -100, -128, 120, -142, 330, -126, 410, -118], '#f4f8ff');
      Art.line(c, [180, -120, 230, -200, 210, -240], '#5e3518', 14);
    },
  },
  fence: {
    kind: 'crash', w: 300, h: 170, d: 60, name: 'a snow fence',
    draw(c) {
      for (const x of [-290, 0, 290]) Art.rect(c, x - 12, -200, 24, 200, '#6b4424');
      Art.rect(c, -300, -170, 600, 110, '#ff5a1f');
      c.strokeStyle = '#c8400f'; c.lineWidth = 6;
      c.beginPath();
      for (let x = -300; x <= 300; x += 40) { c.moveTo(x, -170); c.lineTo(x + 40, -60); c.moveTo(x + 40, -170); c.lineTo(x, -60); }
      c.stroke();
      Art.poly(c, [-310, -172, 310, -172, 300, -186, -300, -186], '#f4f8ff');
    },
  },
  skier: {
    kind: 'crash', w: 260, h: 130, d: 60, name: 'a crashed skier',
    draw(c, e, t) {
      Art.line(c, [-260, -10, 120, -40], '#3d6fd6', 16);
      Art.line(c, [-120, -60, 260, -20], '#3d6fd6', 16);
      Art.ell(c, 0, -70, 120, 60, '#f4f8ff');
      Art.line(c, [-40, -110, -60, -170], '#e63946', 30);
      Art.line(c, [50, -110, 70, -170], '#e63946', 30);
      Art.ell(c, -62, -180, 26, 16, '#2b2d42'); Art.ell(c, 72, -180, 26, 16, '#2b2d42');
      Art.line(c, [-160, -80, -230, -150 + Math.sin(t * 6) * 30], '#ffd23f', 26);
      Art.circ(c, -230, -150 + Math.sin(t * 6) * 30, 18, '#ff5a1f');
      Art.line(c, [150, -60, 200, -230], '#9aa3b5', 8);
    },
  },
  igloo: {
    kind: 'crash', w: 270, h: 260, d: 140, name: 'an igloo',
    draw(c, e, t) {
      c.fillStyle = '#eef5ff';
      c.beginPath(); c.ellipse(0, 0, 280, 260, 0, Math.PI, TAU); c.fill();
      c.strokeStyle = '#c3d4ea'; c.lineWidth = 6;
      for (let r = 1; r < 4; r++) { c.beginPath(); c.ellipse(0, 0, 280, 260 * (1 - r * 0.25), 0, Math.PI, TAU); c.stroke(); }
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 70, 0); c.lineTo(i * 62, -60); c.stroke(); }
      c.fillStyle = '#1d2c4a';
      c.beginPath(); c.ellipse(0, 0, 70, 95, 0, Math.PI, TAU); c.fill();
      Art.circ(c, -18, -60, 9, '#ffd23f'); Art.circ(c, 18, -60, 9, '#ffd23f'); // someone's home
      Art.rect(c, 150, -330, 8, 120, '#5b3a26');
      Art.poly(c, [158, -330, 230, -312 + Math.sin(t * 8) * 6, 158, -294], '#e63946');
    },
  },
  cabin: {
    kind: 'crash', w: 400, h: 760, d: 180, name: 'a ski cabin',
    draw(c, e, t) {
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.6 + i / 4) % 1;
        Art.circ(c, 220 + k * 120, -720 - k * 400, 40 + k * 70, `rgba(230,236,245,${0.7 * (1 - k)})`);
      }
      Art.rect(c, 180, -720, 70, 180, '#7a7f8c');
      Art.rect(c, -380, -420, 760, 420, '#8a5a2e');
      for (let y = -400; y < 0; y += 50) Art.rect(c, -380, y, 760, 10, '#6d4522');
      Art.poly(c, [-450, -400, 0, -700, 450, -400], '#5e3518');
      Art.poly(c, [-470, -395, 0, -720, 470, -395, 420, -420, 0, -690, -420, -420], '#f4f8ff');
      Art.rect(c, -70, -260, 140, 260, '#5e3518');
      Art.circ(c, 45, -130, 10, '#ffd23f');
      for (const x of [-280, 170]) {
        Art.rect(c, x, -320, 110, 100, '#ffcf6b');
        Art.rect(c, x + 50, -320, 10, 100, '#6d4522'); Art.rect(c, x, -275, 110, 10, '#6d4522');
      }
      Art.label(c, 'HOT COCOA', 0, -470, 56, '#ffd23f', '#3a2410');
    },
  },
  moose: {
    kind: 'crash', w: 230, h: 640, d: 120, name: 'a moose', update: Ent.cross,
    draw(c, e, t) {
      if (e.vx < 0) c.scale(-1, 1);
      const st = Math.sin(t * 7 + e.seed);
      for (const [x, ph] of [[-150, 0], [-90, Math.PI], [110, Math.PI], [170, 0]]) {
        c.save(); c.translate(x, -330); c.rotate(Math.sin(t * 7 + ph) * 0.3);
        Art.rect(c, -16, 0, 32, 330, '#4a2e1a'); c.restore();
      }
      Art.ell(c, 0, -400, 240, 120, '#6b4226');
      Art.ell(c, -170, -470, 80, 90, '#6b4226');
      Art.rect(c, 170, -540, 80, 160, '#6b4226');
      Art.ell(c, 270, -560, 110, 60, '#6b4226');
      Art.ell(c, 360, -545, 40, 34, '#4a2e1a');
      Art.circ(c, 260, -585, 10, '#111');
      Art.line(c, [270, -440, 285, -390 + st * 6], '#4a2e1a', 22);
      for (const s of [-1, 1]) {
        c.save(); c.translate(230, -610); c.scale(1, s > 0 ? 1 : 0.85);
        Art.poly(c, [0, 0, -60, -120, -20, -100, 0, -170, 30, -110, 70, -160, 70, -90, 120, -110, 60, -20], '#d9c39a');
        c.restore();
      }
    },
  },
  unibear: {
    kind: 'crash', w: 150, h: 700, d: 100, name: 'a bear on a unicycle', update: Ent.cross,
    draw(c, e, t) {
      c.rotate(Math.sin(t * 5 + e.seed) * 0.12);
      Art.circ(c, 0, -110, 110, '#2b2d42');
      Art.circ(c, 0, -110, 90, '#9aa3b5');
      c.save(); c.translate(0, -110); c.rotate(t * e.vx * 20);
      Art.line(c, [-90, 0, 90, 0], '#2b2d42', 8); Art.line(c, [0, -90, 0, 90], '#2b2d42', 8);
      c.restore();
      Art.rect(c, -10, -340, 20, 230, '#2b2d42');
      Art.rect(c, -60, -360, 120, 30, '#e63946');
      Art.ell(c, 0, -470, 120, 140, '#7a4a24');
      Art.ell(c, 0, -440, 75, 90, '#c9955a');
      Art.circ(c, 0, -640, 85, '#7a4a24');
      Art.circ(c, -70, -710, 30, '#7a4a24'); Art.circ(c, 70, -710, 30, '#7a4a24');
      Art.ell(c, 0, -615, 40, 30, '#c9955a'); Art.circ(c, 0, -625, 12, '#111');
      Art.circ(c, -30, -660, 9, '#111'); Art.circ(c, 30, -660, 9, '#111');
      Art.poly(c, [-50, -720, 0, -830, 50, -720], '#5ee27a'); Art.circ(c, 0, -835, 14, '#ffd23f');
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + (i / 3) * TAU;
        Art.circ(c, Math.cos(a) * 130, -780 + Math.sin(a) * 70, 20, ['#ff5a5f', '#ffd23f', '#4db8ff'][i]);
      }
      Art.line(c, [-90, -520, -120, -760], '#7a4a24', 36); Art.line(c, [90, -520, 120, -760], '#7a4a24', 36);
    },
  },
  hottub: {
    kind: 'crash', w: 360, h: 420, d: 160, name: 'a yeti hot tub party',
    draw(c, e, t) {
      for (let i = 0; i < 5; i++) {
        const k = (t * 0.5 + i / 5) % 1;
        Art.circ(c, -200 + i * 100, -260 - k * 300, 40 + k * 50, `rgba(255,255,255,${0.5 * (1 - k)})`);
      }
      Art.ell(c, -40, -270, 110, 100, '#eef3fa');
      Art.ell(c, -40, -290, 60, 52, '#7b93b8');
      Art.circ(c, -60, -300, 8, '#111'); Art.circ(c, -20, -300, 8, '#111');
      c.strokeStyle = '#2c3a55'; c.lineWidth = 6; c.beginPath(); c.arc(-40, -275, 22, 0.2, Math.PI - 0.2); c.stroke();
      Art.rect(c, -60, -230, 40, 40, '#ffd23f');
      Art.line(c, [60, -250, 170, -340 + Math.sin(t * 3) * 10], '#eef3fa', 50);
      Art.rect(c, 150, -400, 40, 60, 'rgba(230,240,255,0.8)');
      Art.ell(c, 0, -200, 360, 50, '#4db8ff');
      Art.ell(c, 160, -210, 30, 24, '#ffd21f');
      Art.rect(c, -380, -200, 760, 200, '#8a5a2e');
      for (let x = -360; x < 380; x += 60) Art.rect(c, x, -200, 10, 200, '#6d4522');
      Art.rect(c, -390, -110, 780, 16, '#3a4050'); Art.rect(c, -390, -40, 780, 16, '#3a4050');
    },
  },
});

// ---------------------------------------------------------------- v5: rails and the Yeti King
Object.assign(ET, {
  rail: {
    kind: 'rail', w: 50, h: 140, d: 0, len: 3000, flat: true, selfClip: true,
    // Painted strictly far-to-near in thin slices, with each support post drawn
    // right after the slice behind it, so posts show under the rail along its
    // whole length and every slice hides correctly behind hills.
    drawFlat(c, gp, e, t, R) {
      const L = e.len, h = e.h, w = 46, top = h, bot = h - 44;
      const up = (dx, dz, y) => { const q = gp(dx, dz); return [q[0], q[1] - y * q[2], q[2]]; };
      const quad = (pts, col) => {
        c.fillStyle = col; c.beginPath();
        pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
        c.closePath(); c.fill();
      };
      const start = Math.max(0, R.near);
      if (start >= L) return;
      // Only the side of the box facing the camera is visible.
      const mid = up(0, Math.min(L, start + 600), top);
      const side = mid[0] > R.W / 2 ? -w : w;
      const post = z => {
        quad([up(-80, z - 45, 0), up(80, z - 45, 0), up(80, z + 45, 0), up(-80, z + 45, 0)], '#8d97a8'); // base plate
        quad([up(-18, z, 0), up(18, z, 0), up(18, z, bot), up(-18, z, bot)], '#2b2d42');
        quad([up(side * 0.39, z, 0), up(side * 0.39 + (side > 0 ? -12 : 12), z, 0), up(side * 0.39 + (side > 0 ? -12 : 12), z, bot), up(side * 0.39, z, bot)], '#4a5168');
      };
      const STEP = 250, POST = 500;
      for (let z0 = Math.floor((L - 1) / STEP) * STEP; z0 + STEP > start; z0 -= STEP) {
        const a = Math.max(start, z0), b = Math.min(L, z0 + STEP);
        if (b <= a) continue;
        c.save();
        c.beginPath(); c.rect(-R.W, -R.W, R.W * 3, R.W + R.clipAt(a)); c.clip();
        quad([up(side, a, bot), up(side, a, top), up(side, b, top), up(side, b, bot)], '#2b2d42'); // side face
        quad([up(-w, a, top), up(w, a, top), up(w, b, top), up(-w, b, top)], '#ff5a1f');            // top
        quad([up(-w * 0.25, a, top + 1), up(w * 0.25, a, top + 1), up(w * 0.25, b, top + 1), up(-w * 0.25, b, top + 1)], '#ffd23f');
        if (a % POST === 0 && a >= start) post(a); // the post at this slice's near edge sits in front of it
        c.restore();
      }
      // Front cap and sign while the start is still well ahead of the camera.
      if (R.near < -300) {
        quad([up(-w, 0, bot), up(w, 0, bot), up(w, 0, top), up(-w, 0, top)], '#ffd23f');
        if (R.near < -1500) {
          const s0 = up(0, 0, h + 150);
          if (s0[2] * 110 > 5) Art.label(c, 'GRIND', s0[0], s0[1], Math.max(8, 110 * s0[2]), '#ffd23f', '#101a3a');
        }
      }
    },
  },
  bossyeti: {
    kind: 'none', w: 0, h: 1500, d: 0,
    draw(c, e, t) {
      c.save();
      c.scale(2.4, 2.4);
      ET.yeti.draw(c, e, t);
      Art.poly(c, [-62, -540, -62, -610, -32, -575, 0, -625, 32, -575, 62, -610, 62, -540], '#ffd23f');
      Art.circ(c, 0, -570, 10, '#e63946');
      c.restore();
      if (e.throwT > 0) Art.circ(c, 330, -1150, 150, '#f4f8ff');
      Art.label(c, 'THE YETI KING', 0, -1700, 150, '#ffd23f', '#101a3a');
    },
  },
  snowbomb: {
    kind: 'crash', w: 170, h: 320, d: 130, name: "the Yeti King's snowball",
    update(e, dt) {
      e.z += e.vz * dt;
      e.x += e.vx * dt;
      if (e.y > 0 || e.vy > 0) {
        e.vy -= 2400 * dt;
        e.y += e.vy * dt;
        if (e.y <= 0) { e.y = 0; e.vy = 0; e.vx = 0; }
      }
      e.spin = (e.spin || 0) + dt * 8;
    },
    draw(c, e) {
      c.translate(0, -160);
      c.rotate(e.spin || 0);
      Art.circ(c, 0, 0, 165, '#f4f8ff');
      c.strokeStyle = '#c9d7ea'; c.lineWidth = 12;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 60 + i * 35, i * 2, i * 2 + 1.8); c.stroke(); }
    },
  },
});


// ---------------------------------------------------------------- v6: caves, launchers, weather, ice
Object.assign(ET, {
  arch: {
    kind: 'none', w: 0, h: 1900, d: 0,
    draw(c, e, t) {
      const X = 2150, T = 300;
      c.fillStyle = '#7fbfe8';
      c.beginPath();
      c.moveTo(-X - T, 0); c.lineTo(-X - T, -1300);
      c.quadraticCurveTo(-X - T, -2100, 0, -2150);
      c.quadraticCurveTo(X + T, -2100, X + T, -1300);
      c.lineTo(X + T, 0); c.lineTo(X, 0); c.lineTo(X, -1300);
      c.quadraticCurveTo(X, -1850, 0, -1860);
      c.quadraticCurveTo(-X, -1850, -X, -1300);
      c.lineTo(-X, 0); c.closePath(); c.fill();
      c.strokeStyle = '#dff3ff'; c.lineWidth = 40;
      c.beginPath(); c.moveTo(-X, 0); c.lineTo(-X, -1300); c.quadraticCurveTo(-X, -1850, 0, -1860); c.quadraticCurveTo(X, -1850, X, -1300); c.lineTo(X, 0); c.stroke();
      for (let i = -6; i <= 6; i++) {
        const x = i * 300, yTop = -1860 + Math.pow(i / 7, 2) * 520, len = 120 + ((i * 53) & 127);
        Art.poly(c, [x - 40, yTop, x + 40, yTop, x, yTop + len], '#e9f7ff');
      }
      const glow = 0.5 + 0.5 * Math.sin(t * 2 + e.seed);
      Art.circ(c, -X - 150, -700, 60, `rgba(125,252,255,${0.4 + glow * 0.4})`);
      Art.circ(c, X + 150, -900, 50, `rgba(179,107,255,${0.4 + glow * 0.4})`);
    },
  },
  tramp: {
    kind: 'tramp', w: 270, h: 0, d: 120,
    draw(c, e, t) {
      for (const s of [-1, 1]) Art.rect(c, s * 220 - 12, -70, 24, 70, '#2b2d42');
      Art.ell(c, 0, -80, 280, 60, '#e63946');
      Art.ell(c, 0, -84 + (e.hit ? Math.max(0, 30 - e.t * 60) : 0), 235, 44, '#3d6fd6');
      Art.ell(c, -60, -92, 90, 12, 'rgba(255,255,255,0.35)');
      c.strokeStyle = '#ffd23f'; c.lineWidth = 6;
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 240, -80 + Math.sin(a) * 50); c.lineTo(Math.cos(a) * 270, -80 + Math.sin(a) * 58); c.stroke(); }
      Art.label(c, 'BOING', 0, -170, 60, '#ffd23f', '#101a3a');
    },
  },
  cannon: {
    kind: 'cannon', w: 230, h: 0, d: 140,
    draw(c, e, t) {
      for (const s of [-1, 1]) {
        Art.circ(c, s * 250, -120, 120, '#8a5a2e');
        Art.circ(c, s * 250, -120, 95, '#c9955a');
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t; Art.line(c, [s * 250, -120, s * 250 + Math.cos(a) * 95, -120 + Math.sin(a) * 95], '#8a5a2e', 12); }
      }
      Art.circ(c, 0, -230, 230, '#e63946');
      for (let i = 0; i < 6; i++) {
        c.fillStyle = '#ffffff'; c.beginPath();
        c.arc(0, -230, 230, (i / 6) * TAU, (i / 6) * TAU + 0.35); c.lineTo(0, -230); c.fill();
      }
      Art.circ(c, 0, -230, 190, '#2b2d42');
      Art.circ(c, 0, -230, 160, '#101a3a');
      Art.label(c, 'GET IN', 0, -230, 70, '#ffd23f');
      Art.label(c, 'HUMAN CANNON', 0, -510, 70, '#ffffff', '#e63946');
    },
  },
  nado: {
    kind: 'nado', w: 260, h: 2400, d: 220, update: Ent.cross,
    draw(c, e, t) {
      for (let i = 0; i < 14; i++) {
        const k = i / 13, y = -k * 2200, r = 90 + k * 420;
        const wob = Math.sin(t * 6 + i * 0.7) * (30 + k * 80);
        c.strokeStyle = i % 2 ? 'rgba(235,242,252,0.85)' : 'rgba(180,200,225,0.75)';
        c.lineWidth = 36 - k * 14;
        c.beginPath(); c.ellipse(wob, y, r, r * 0.18, 0, t * 4 + i, t * 4 + i + Math.PI * 1.4); c.stroke();
      }
      c.save(); c.translate(Math.sin(t * 3) * 260, -1300); c.rotate(t * 5); c.scale(0.35, 0.35);
      ET.cow.draw(c, { vx: 1, seed: 1, rot: 0 }, t);
      c.restore();
      Art.ell(c, 0, 0, 260, 50, 'rgba(235,242,252,0.7)');
    },
  },
  ice: {
    kind: 'ice', w: 900, h: 0, d: 0, len: 2600, flat: true,
    drawFlat(c, gp, e, t, R) {
      const W = 900, L = e.len || 2600;
      groundPoly(c, gp, [[-W - 60, -60], [W + 60, -60], [W + 60, L + 60], [-W - 60, L + 60]], '#e9f7ff');
      groundPoly(c, gp, [[-W, 0], [W, 0], [W, L], [-W, L]], '#8fd3f4');
      for (let i = 0; i < 6; i++) {
        const z = ((i * 0.17 + 0.05) * L), x = -W + ((i * 331) % (2 * W));
        groundPoly(c, gp, [[x, z], [x + 260, z], [x + 140, z + 380], [x - 120, z + 380]], 'rgba(255,255,255,0.55)');
      }
      for (let i = 0; i < 8; i++) {
        const z = (i / 8) * L + 100, x = -W + 120 + ((i * 433) % (2 * W - 240));
        if (Math.sin(t * 5 + i * 1.7) > 0.5) groundPoly(c, gp, [[x - 30, z], [x + 30, z], [x, z + 90]], '#ffffff');
      }
    },
  },
});

// ---------------------------------------------------------------- v7: train, ski jump, new power-ups
POWERS.giant = { name: 'GIANT MODE', color: '#b36bff', dur: 8, sub: 'you are enormous. crush everything' };
POWERS.wings = { name: 'WINGS', color: '#ffe45c', dur: 10, sub: 'glide forever, flip forever' };

function drawSkiJump(c) {
  const w = 620, h = 520;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) Art.line(c, [s * (w + 20), 0, s * (w - 60), -h * (i + 1) / 5], '#5f6879', 14);
    Art.rect(c, s * (w + 60) - 10, -h - 700, 20, h + 700, '#3a4050');
    Art.rect(c, s * (w + 60) - 60, -h - 760, 120, 70, '#2b2d42');
    Art.circ(c, s * (w + 60), -h - 725, 26, '#fff7c2');
    Art.poly(c, [s * (w + 60), -h - 690, s * (w + 60) - s * 300, -h - 100, s * (w + 60) + s * 80, -h - 100], 'rgba(255,247,194,0.12)');
  }
  Art.poly(c, [-w, 0, -w * 0.9, -h, w * 0.9, -h, w, 0], '#eef5ff');
  for (let i = 0; i < 6; i++) {
    const x0 = -w + (i * 2 * w) / 6, x1 = x0 + w / 6;
    Art.poly(c, [x0, 0, x1, 0, x1 * 0.9, -h, x0 * 0.9, -h], i % 2 ? '#3d6fd6' : '#eef5ff');
  }
  Art.poly(c, [-w * 0.9, -h - 24, w * 0.9, -h - 24, w * 0.9, -h, -w * 0.9, -h], '#e63946');
  Art.label(c, 'SKI JUMP', 0, -h * 0.5, 130, '#ffd23f', '#101a3a');
}

Object.assign(ET, {
  skijump: { kind: 'ramp', w: 620, h: 0, d: 240, power: 2.3, draw(c) { drawSkiJump(c); } },
  traintrack: {
    kind: 'none', w: 0, h: 0, d: 0, flat: true,
    drawFlat(c, gp) {
      const X = 6000;
      groundPoly(c, gp, [[-X, -170], [X, -170], [X, 170], [-X, 170]], 'rgba(90,70,60,0.35)');
      for (let x = -X; x < X; x += 260) groundPoly(c, gp, [[x, -150], [x + 90, -150], [x + 90, 150], [x, 150]], '#6b4424');
      for (const z of [-90, 90]) groundPoly(c, gp, [[-X, z - 16], [X, z - 16], [X, z + 16], [-X, z + 16]], '#3a4050');
    },
  },
  loco: {
    kind: 'crash', w: 360, h: 640, d: 160, name: 'the Polar Express',
    update(e, dt, G) {
      e.x += e.vx * dt;
      if (!e.honked && e.z - G.player.z < 15000) { e.honked = true; Sfx.trainHorn(); }
    },
    draw(c, e, t) {
      if (e.vx < 0) c.scale(-1, 1);
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.8 + i / 4) % 1;
        Art.circ(c, 160 - k * 500, -760 - k * 380, 60 + k * 90, `rgba(240,244,250,${0.75 * (1 - k)})`);
      }
      Art.rect(c, -360, -470, 520, 330, '#1d2233');
      Art.rect(c, 160, -560, 200, 420, '#e63946');
      Art.rect(c, 190, -520, 140, 110, '#ffcf6b');
      Art.rect(c, 110, -700, 80, 240, '#2b2d42');
      Art.rect(c, 90, -720, 120, 40, '#3a4050');
      Art.rect(c, -360, -480, 520, 30, '#ffd23f');
      Art.label(c, 'POLAR EXPRESS', -100, -300, 64, '#ffd23f');
      Art.poly(c, [-360, -140, -470, -20, -360, -20], '#c9ced8');
      for (const x of [-260, -80, 100, 260]) {
        Art.circ(c, x, -90, 85, '#2b2d42'); Art.circ(c, x, -90, 55, '#e63946');
        Art.line(c, [x, -90, x + Math.cos(t * 12) * 50, -90 + Math.sin(t * 12) * 50], '#ffd23f', 12);
      }
      Art.circ(c, -390, -360, 40, '#fff7c2');
    },
  },
  traincar: {
    kind: 'crash', w: 330, h: 560, d: 160, name: 'a train carriage', update: Ent.cross,
    draw(c, e, t) {
      if (e.vx < 0) c.scale(-1, 1);
      const col = ['#3d6fd6', '#e63946', '#2a9d8f', '#8a5a2e'][e.style || 0];
      Art.rect(c, -330, -540, 660, 400, col);
      Art.rect(c, -350, -570, 700, 40, '#1d2233');
      for (let i = 0; i < 4; i++) {
        const x = -270 + i * 150;
        Art.rect(c, x, -470, 110, 110, '#ffcf6b');
        if ((i + (e.style || 0)) % 2 === 0) { // a penguin passenger
          Art.ell(c, x + 55, -400, 34, 40, '#1c1f2b'); Art.ell(c, x + 55, -395, 22, 28, '#f5f5f5');
          Art.circ(c, x + 46, -420, 6, '#fff'); Art.circ(c, x + 64, -420, 6, '#fff');
          Art.poly(c, [x + 48, -410, x + 62, -410, x + 55, -398], '#ffa51f');
        }
      }
      Art.rect(c, -330, -200, 660, 30, '#1d2233');
      for (const x of [-220, 220]) { Art.circ(c, x, -90, 80, '#2b2d42'); Art.circ(c, x, -90, 48, '#9aa3b5'); }
      Art.rect(c, 330, -260, 70, 26, '#1d2233');
    },
  },
});

// Roadside crowds and night lamps.
DecoArt.crowd = function (c, d) {
  const t = performance.now() / 1000;
  const cols = ['#e63946', '#3d6fd6', '#ffd23f', '#2a9d8f', '#b36bff', '#ff5a1f'];
  for (let i = 0; i < 6; i++) {
    const x = -300 + i * 120, j = Math.abs(Math.sin(t * 6 + i * 1.3 + d.seed)) * 40;
    Art.ell(c, x, -130 - j, 46, 80, cols[(i + d.seed) % 6]);
    Art.circ(c, x, -240 - j, 36, '#f1c19e');
    Art.rect(c, x - 38, -280 - j, 76, 22, cols[(i + 3 + d.seed) % 6]);
    Art.line(c, [x - 30, -170 - j, x - 70, -260 - j + Math.sin(t * 10 + i) * 30], cols[(i + d.seed) % 6], 18);
    Art.line(c, [x + 30, -170 - j, x + 70, -260 - j + Math.cos(t * 10 + i) * 30], cols[(i + d.seed) % 6], 18);
  }
  Art.rect(c, -360, -420, 720, 90, '#ffffff');
  Art.label(c, d.text, 0, -375, 56, '#e63946');
};
const _drawPole = DecoArt.pole;
DecoArt.pole = function (c, d) {
  _drawPole(c, d);
  const night = Math.max(Theme.pal.moon || 0, Theme.pal.stars || 0);
  if (night > 0.2) {
    Art.rect(c, -40, -360, 80, 30, '#2b2d42');
    Art.circ(c, 0, -330, 90, `rgba(255,220,120,${0.35 * night})`);
    Art.circ(c, 0, -330, 26, '#fff3b0');
  }
};

// ---------------------------------------------------------------- v8: zone scenery sprites
// Each sprite is pre-rendered at 0.5 px per world unit; w/h are its world size.
const ZONES = [
  { id: 'pine', name: 'Pine Ridge', bank: null, flake: null },
  { id: 'candy', name: 'Candy Land', bank: [255, 170, 205], flake: 'candy' },
  { id: 'haunted', name: 'Haunted Woods', bank: [150, 140, 175], flake: '#c9c3d8' },
  { id: 'crystal', name: 'Crystal Forest', bank: [130, 215, 255], flake: '#bff4ff' },
];
const ZONE_SEGS = Math.round((1800 * CFG.METER) / CFG.SEG_LEN);
function zoneIndexAt(segI) { return Math.floor(Math.max(0, segI) / ZONE_SEGS) % ZONES.length; }
function zoneAtZ(z) { return ZONES[zoneIndexAt(Math.floor(z / CFG.SEG_LEN))]; }

Art.sprite = function (w, h, fn) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * 0.5); cv.height = Math.ceil(h * 0.5);
  const c = cv.getContext('2d');
  c.scale(0.5, 0.5); c.translate(w / 2, h);
  fn(c);
  return { cv, w, h };
};

Art.initZones = function () {
  const S = Art.sprite;
  const cane = flip => S(320, 940, c => {
    if (flip) c.scale(-1, 1);
    c.lineCap = 'round'; c.lineWidth = 46;
    const path = () => { c.beginPath(); c.moveTo(0, -20); c.lineTo(0, -720); c.arc(-80, -720, 80, 0, Math.PI, true); };
    c.strokeStyle = '#ffffff'; path(); c.stroke();
    c.strokeStyle = '#e63946'; c.setLineDash([34, 34]); path(); c.stroke(); c.setLineDash([]);
    Art.ell(c, 0, -10, 70, 16, '#eef5ff');
  });
  const lolli = S(420, 900, c => {
    Art.rect(c, -10, -560, 20, 560, '#f4f6fa');
    const cols = ['#ff4f7b', '#ffd23f', '#5ee27a', '#4db8ff', '#b36bff'];
    Art.circ(c, 0, -700, 190, '#ffffff');
    for (let i = 0; i < 5; i++) Art.circ(c, 0, -700, 180 - i * 34, cols[i]);
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 14;
    c.beginPath(); for (let a = 0; a < 14; a += 0.2) c.lineTo(Math.cos(a) * a * 12, -700 + Math.sin(a) * a * 12); c.stroke();
    Art.ell(c, 0, -8, 80, 16, '#eef5ff');
  });
  const gumdrop = S(560, 960, c => {
    const cols = ['#2ec27e', '#26a269', '#57e389'];
    [[0, -150, 260, 170], [0, -420, 200, 150], [0, -650, 140, 120]].forEach(([x, y, rx, ry], i) => {
      c.fillStyle = cols[i]; c.beginPath(); c.ellipse(x, y, rx, ry, 0, Math.PI, TAU); c.lineTo(x + rx, y + ry * 0.4); c.lineTo(x - rx, y + ry * 0.4); c.fill();
      for (let k = 0; k < 6; k++) Art.circ(c, x - rx * 0.7 + k * rx * 0.28, y - ry * 0.3 + (k % 2) * 30, 14, ['#ff4f7b', '#ffd23f', '#ffffff', '#4db8ff'][k % 4]);
    });
    Art.poly(c, [0, -880, 24, -820, 86, -820, 36, -786, 54, -726, 0, -762, -54, -726, -36, -786, -86, -820, -24, -820], '#ffd23f');
    Art.ell(c, 0, -6, 200, 22, '#eef5ff');
  });
  const deadTree = seed => S(700, 1040, c => {
    let r = seed;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    const branch = (x, y, a, len, w, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      c.strokeStyle = '#3a3346'; c.lineWidth = w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
      if (d > 0) { branch(x2, y2, a - 0.5 - rnd() * 0.3, len * 0.7, w * 0.65, d - 1); branch(x2, y2, a + 0.4 + rnd() * 0.3, len * 0.68, w * 0.65, d - 1); }
      else { c.strokeStyle = '#eef5ff'; c.lineWidth = w * 0.8; c.beginPath(); c.moveTo(x2 - 6, y2); c.lineTo(x2 + 6, y2); c.stroke(); }
    };
    branch(0, 0, -Math.PI / 2, 380, 46, 4);
    Art.ell(c, 0, -6, 130, 18, '#eef5ff');
  });
  const tomb = S(300, 360, c => {
    c.fillStyle = '#8d8a99'; c.beginPath(); c.moveTo(-110, 0); c.lineTo(-110, -200); c.arc(0, -200, 110, Math.PI, 0); c.lineTo(110, 0); c.fill();
    Art.rect(c, -110, -60, 220, 60, '#6f6c7d');
    Art.label(c, 'RIP', 0, -190, 70, '#4a4757');
    c.fillStyle = '#eef5ff'; c.beginPath(); c.ellipse(0, -300, 90, 26, 0, Math.PI, TAU); c.fill();
    Art.ell(c, 0, -4, 150, 20, '#eef5ff');
  });
  const ghost = S(320, 640, c => {
    c.fillStyle = 'rgba(245,245,255,0.82)';
    c.beginPath(); c.moveTo(-120, -160); c.quadraticCurveTo(-130, -560, 0, -580); c.quadraticCurveTo(130, -560, 120, -160);
    for (let i = 0; i < 5; i++) c.quadraticCurveTo(120 - i * 60 - 30, -110, 120 - (i + 1) * 60, -160);
    c.fill();
    Art.ell(c, -40, -440, 22, 34, '#2b2d42'); Art.ell(c, 40, -440, 22, 34, '#2b2d42');
    Art.ell(c, 0, -360, 26, 34, '#2b2d42');
  });
  const crystal = seed => S(620, 980, c => {
    let r = seed;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    const cols = [['#7fe7ff', '#3fb8e8'], ['#c9a6ff', '#8f5be8'], ['#ffb3e6', '#e86fbf']];
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 80 + (rnd() - 0.5) * 40, h = 380 + rnd() * 520, w = 60 + rnd() * 40, a = (i - 2) * 0.12;
      const [lite, dark] = cols[Math.floor(rnd() * 3)];
      c.save(); c.translate(x, 0); c.rotate(a);
      Art.poly(c, [-w, 0, -w, -h + w, 0, -h, 0, 0], lite);
      Art.poly(c, [0, 0, 0, -h, w, -h + w, w, 0], dark);
      Art.poly(c, [-w * 0.6, -h * 0.2, -w * 0.6, -h * 0.85, -w * 0.3, -h * 0.9, -w * 0.3, -h * 0.25], 'rgba(255,255,255,0.5)');
      c.restore();
    }
    Art.ell(c, 0, -6, 260, 26, '#eef5ff');
  });
  const frostPine = S(500, 1000, c => { c.save(); c.translate(-250, -1000); c.scale(2, 2); c.filter = 'hue-rotate(150deg) saturate(0.6) brightness(1.25)'; c.drawImage(Art.trees[0], 0, 0); c.restore(); });
  Art.zoneSprites = {
    pine: Art.trees.map(cv => ({ cv, w: 500, h: 1000 })),
    candy: [cane(false), cane(true), lolli, gumdrop, gumdrop],
    haunted: [deadTree(3), deadTree(11), deadTree(29), tomb, ghost],
    crystal: [crystal(5), crystal(17), crystal(41), frostPine, frostPine],
  };
};

// Floating letter tiles: collect M-A-D-N-E-S-S in order.
const WORD = 'MADNESS';
ET.letter = {
  kind: 'letter', w: 150, h: 300, d: 110,
  update(e) { e.y = 120 + Math.sin(e.t * 3 + e.seed) * 40; },
  draw(c, e, t) {
    c.translate(0, -140);
    Art.circ(c, 0, 0, 170 + Math.sin(t * 6) * 12, 'rgba(255,90,31,0.25)');
    c.rotate(Math.sin(t * 2 + e.seed) * 0.15);
    Art.rect(c, -120, -120, 240, 240, '#101a3a');
    Art.rect(c, -104, -104, 208, 208, '#ffd23f');
    Art.label(c, WORD[e.idx], 0, 12, 190, '#ff5a1f', '#101a3a');
  },
};

// Zone-aware trees: obstacle trees match the scenery you're in.
ET.tree.draw = function (c, e) {
  const s = e.s || 1;
  const set = Art.zoneSprites && e.set ? Art.zoneSprites[e.set] : null;
  if (set) { const sp = set[(e.v || 0) % set.length]; c.drawImage(sp.cv, -sp.w / 2 * s, -sp.h * s, sp.w * s, sp.h * s); }
  else c.drawImage(Art.trees[e.v || 0], -250 * s, -1000 * s, 500 * s, 1000 * s);
};

// ---------------------------------------------------------------- v9: zone hazards
Object.assign(ET, {
  // Candy Land
  gummy: {
    kind: 'smash', w: 110, h: 260, d: 60, update: Ent.cross,
    draw(c, e, t) {
      const col = ['rgba(255,79,123,0.85)', 'rgba(94,226,122,0.85)', 'rgba(255,210,63,0.9)', 'rgba(77,184,255,0.85)'][e.style || 0];
      c.rotate(Math.sin(t * 12 + e.seed) * 0.12);
      for (const s of [-1, 1]) { Art.ell(c, s * 45, -30, 34, 36, col); Art.ell(c, s * 85, -130, 26, 40, col); }
      Art.ell(c, 0, -120, 80, 95, col);
      Art.circ(c, 0, -220, 62, col);
      Art.circ(c, -44, -268, 22, col); Art.circ(c, 44, -268, 22, col);
      Art.circ(c, -20, -230, 8, 'rgba(0,0,0,0.6)'); Art.circ(c, 20, -230, 8, 'rgba(0,0,0,0.6)');
      Art.ell(c, -25, -150, 22, 40, 'rgba(255,255,255,0.35)');
    },
  },
  choco: {
    kind: 'mud', w: 1500, h: 0, d: 0, len: 1800, flat: true,
    drawFlat(c, gp, e, t) {
      const W = 2400, L = e.len || 1800;
      groundPoly(c, gp, [[-W, -50], [W, -50], [W, L + 50], [-W, L + 50]], '#a0673a');
      groundPoly(c, gp, [[-W, 0], [W, 0], [W, L], [-W, L]], '#6b3a1e');
      for (let i = 0; i < 7; i++) {
        const z = ((i / 7 + t * 0.08) % 1) * L, x = -W + ((i * 571) % (2 * W));
        groundPoly(c, gp, [[x, z], [x + 420, z], [x + 360, z + 60], [x - 60, z + 60]], 'rgba(200,140,90,0.5)');
      }
    },
  },
  // Haunted Woods
  spook: {
    kind: 'ghost', w: 150, h: 420, d: 90,
    update(e, dt) { e.x += e.vx * dt; e.y = e.by + Math.sin(e.t * 3 + e.seed) * 80; },
    draw(c, e, t) {
      c.globalAlpha *= 0.85;
      c.translate(0, -60);
      c.fillStyle = '#f5f5ff';
      c.beginPath(); c.moveTo(-110, -60); c.quadraticCurveTo(-120, -420, 0, -430); c.quadraticCurveTo(120, -420, 110, -60);
      for (let i = 0; i < 4; i++) c.quadraticCurveTo(110 - i * 55 - 27, -10 + Math.sin(t * 10 + i) * 14, 110 - (i + 1) * 55, -60);
      c.fill();
      Art.ell(c, -36, -300, 20, 30, '#2b2d42'); Art.ell(c, 36, -300, 20, 30, '#2b2d42');
      Art.ell(c, 0, -220, 26, 34 + Math.sin(t * 8) * 8, '#2b2d42');
      Art.label(c, 'BOO', 0, -500, 70, '#b36bff', '#101a3a');
    },
  },
  // Crystal Forest
  laser: {
    kind: 'laser', w: 2600, h: 300, d: 70,
    update(e) { e.on = Math.sin(e.t * Math.PI * 0.9 + e.seed) > -0.2; },
    draw(c, e, t) {
      const X = 2100;
      for (const s of [-1, 1]) {
        Art.poly(c, [s * X - 90, 0, s * X - 50, -520, s * X, -620, s * X + 50, -520, s * X + 90, 0], '#8f5be8');
        Art.poly(c, [s * X - 40, -60, s * X - 20, -480, s * X, -560, s * X, -60], '#c9a6ff');
        Art.circ(c, s * X, -180, 40, e.on ? '#ff4f7b' : '#3a2050');
      }
      if (e.on) {
        const fl = 0.7 + Math.random() * 0.3;
        c.strokeStyle = `rgba(255,79,123,${0.35 * fl})`; c.lineWidth = 90;
        c.beginPath(); c.moveTo(-X, -180); c.lineTo(X, -180); c.stroke();
        c.strokeStyle = '#ffffff'; c.lineWidth = 18;
        c.beginPath(); c.moveTo(-X, -180); c.lineTo(X, -180); c.stroke();
      } else {
        c.setLineDash([60, 60]); c.strokeStyle = 'rgba(255,79,123,0.35)'; c.lineWidth = 8;
        c.beginPath(); c.moveTo(-X, -180); c.lineTo(X, -180); c.stroke(); c.setLineDash([]);
      }
    },
  },
  shard: {
    kind: 'crash', w: 130, h: 400, d: 100, name: 'a falling crystal',
    update(e, dt, G) {
      if (Ent.faller(e, dt, G)) {
        e.y = 0; e.landed = true; e.type = 'crystalrock';
        if (e.z - G.player.z < 15000) { Sfx.smash(); G.spawnFx('poof', e.x, e.z); }
      } else if (e.falling) e.rot = Math.sin(e.t * 9) * 0.2;
    },
    draw(c, e) {
      if (!e.falling) return; // only its shadow shows until it drops
      c.rotate(e.rot || 0);
      Art.poly(c, [-60, -80, 0, -420, 60, -80, 0, 0], '#7fe7ff');
      Art.poly(c, [0, 0, 0, -420, 60, -80], '#3fb8e8');
    },
  },
  crystalrock: {
    kind: 'crash', w: 150, h: 380, d: 100, name: 'a crystal shard',
    draw(c) {
      Art.poly(c, [-90, 0, -60, -260, 0, -400, 50, -240, 90, 0], '#7fe7ff');
      Art.poly(c, [0, -400, 50, -240, 90, 0, 10, 0], '#3fb8e8');
      Art.poly(c, [-50, -60, -30, -240, -10, -250, -20, -70], 'rgba(255,255,255,0.55)');
    },
  },
});
