'use strict';
// Sleds and outfits you can buy with coins. Every sled is drawn in two layers:
// `far` (the nose, behind the rider when seen from behind) and `near` (the body, in front of the rider).

const SLEDS = [
  { id: 'toboggan', name: 'Red Toboggan', cost: 0, blurb: 'A classic. Allegedly steerable.',
    far(c) {
      c.strokeStyle = '#b71f33'; c.lineWidth = 30;
      c.beginPath(); c.ellipse(0, -48, 150, 62, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    },
    near(c) {
      Art.line(c, [-150, -4, 150, -4], '#2b2d42', 14);
      Art.poly(c, [-165, -60, 165, -60, 150, -10, -150, -10], '#d62839');
      Art.poly(c, [-150, -10, 150, -10, 140, 4, -140, 4], '#8e1726');
      Art.rect(c, -120, -48, 240, 10, '#f25c6e');
    } },
  { id: 'box', name: 'Cardboard Box', cost: 150, blurb: 'Structurally questionable.',
    far(c) {
      Art.poly(c, [-140, -150, -100, -230, 100, -230, 140, -150], '#b98547');
    },
    near(c) {
      Art.rect(c, -160, -150, 320, 150, '#c9955a');
      Art.rect(c, -160, -150, 320, 12, '#a87a44');
      Art.poly(c, [-160, -150, -230, -210, -205, -225, -150, -160], '#d9a86b');
      Art.poly(c, [160, -150, 230, -210, 205, -225, 150, -160], '#d9a86b');
      Art.rect(c, -30, -150, 60, 150, 'rgba(230,220,190,0.55)');
      Art.label(c, 'FRAGILE', 0, -70, 44, '#b3261e');
      Art.label(c, '↑ THIS SIDE UP', 0, -28, 22, '#5a3b1c');
    } },
  { id: 'tub', name: 'Clawfoot Bathtub', cost: 400, blurb: 'Comes with a duck. The duck is in charge.',
    far(c, t) {
      Art.rect(c, 120, -250, 16, 110, '#c9ced8');
      Art.poly(c, [120, -250, 70, -250, 70, -236, 120, -236], '#c9ced8');
      Art.ell(c, -120, -200, 34, 28, '#ffd21f');
      Art.ell(c, -95, -228, 22, 20, '#ffd21f');
      Art.poly(c, [-80, -232, -58, -226, -80, -220], '#ff7b1c');
    },
    near(c, t) {
      for (const s of [-1, 1]) {
        Art.ell(c, s * 150, -8, 26, 20, '#d8b25a');
        Art.poly(c, [s * 150 - 20, -8, s * 150, 14, s * 150 + 20, -8], '#d8b25a');
      }
      c.fillStyle = '#f5f7fb';
      c.beginPath(); c.moveTo(-200, -150);
      c.quadraticCurveTo(-200, -10, -120, -10); c.lineTo(120, -10);
      c.quadraticCurveTo(200, -10, 200, -150); c.closePath(); c.fill();
      Art.rect(c, -210, -160, 420, 22, '#dfe4ee');
      for (let i = 0; i < 7; i++) Art.circ(c, -170 + i * 57, -164 + Math.sin(t * 4 + i) * 5, 26, '#ffffff');
      Art.ell(c, 60, -90, 90, 30, 'rgba(160,190,230,0.35)');
    } },
  { id: 'cart', name: 'Shopping Cart', cost: 700, blurb: 'Wheel number three has opinions.',
    far(c) {
      c.strokeStyle = '#9aa3b5'; c.lineWidth = 8;
      c.strokeRect(-150, -240, 300, 100);
    },
    near(c, t) {
      for (const x of [-140, 140]) Art.circ(c, x, -6, 20, '#2b2d42');
      Art.circ(c, 140 + Math.sin(t * 30) * 4, -6, 20, '#2b2d42');
      c.strokeStyle = '#b8c0cf'; c.lineWidth = 8;
      c.beginPath();
      for (let i = 0; i <= 8; i++) { const x = -170 + i * 42.5; c.moveTo(x, -180); c.lineTo(x * 0.9, -30); }
      for (let j = 0; j <= 4; j++) { const y = -180 + j * 37.5, k = 1 - (j / 4) * 0.1; c.moveTo(-170 * k, y); c.lineTo(170 * k, y); }
      c.stroke();
      Art.line(c, [-150, -30, 150, -30], '#8d97a8', 12);
      Art.line(c, [-190, -200, 190, -200], '#e63946', 22);
    } },
  { id: 'door', name: 'Front Door', cost: 1000, blurb: 'Still has the doorbell. Please ring.',
    far(c) {
      Art.poly(c, [-150, -60, -140, -110, 140, -110, 150, -60], '#7a4a24');
    },
    near(c) {
      Art.poly(c, [-170, -70, 170, -70, 160, 0, -160, 0], '#9c5f2e');
      Art.rect(c, -130, -58, 110, 44, '#b87438');
      Art.rect(c, 20, -58, 110, 44, '#b87438');
      Art.circ(c, 120, -36, 12, '#e8c15a');
      Art.rect(c, -40, -40, 80, 18, '#e8c15a');
      Art.label(c, '42', 0, -30, 18, '#5a3b1c');
    } },
  { id: 'piano', name: 'Grand Piano', cost: 1600, blurb: 'The pianos that fall from the sky are its cousins.',
    far(c) {
      Art.poly(c, [-150, -120, 60, -330, 160, -120], '#17131a');
      Art.line(c, [60, -330, 20, -120], '#3a3140', 8);
    },
    near(c) {
      Art.poly(c, [-200, -120, 200, -120, 185, -20, -185, -20], '#17131a');
      Art.rect(c, -180, -110, 360, 40, '#f8f5ea');
      for (let i = 0; i < 20; i++) if (i % 7 !== 2 && i % 7 !== 6) Art.rect(c, -172 + i * 18, -110, 9, 24, '#111');
      Art.rect(c, -170, -20, 24, 26, '#17131a'); Art.rect(c, 146, -20, 24, 26, '#17131a');
    } },
  { id: 'rocket', name: 'Actual Rocket', cost: 2500, blurb: 'Not legal on any mountain. Always on fire.', fire: true,
    far(c) {
      Art.poly(c, [-40, -150, 0, -290, 40, -150], '#e63946');
    },
    near(c, t) {
      for (const s of [-1, 1]) Art.poly(c, [s * 80, -140, s * 210, -10, s * 80, -40], '#e63946');
      Art.circ(c, 0, -90, 110, '#d7dde8');
      Art.circ(c, 0, -90, 80, '#8d97a8');
      Art.circ(c, 0, -90, 60, '#3a4050');
      const f = 0.8 + Math.sin(t * 40) * 0.2;
      Art.circ(c, 0, -90, 50 * f, '#ffb02e');
      Art.circ(c, 0, -90, 28 * f, '#fff3a8');
    } },
  { id: 'unicorn', name: 'Inflatable Unicorn', cost: 3500, blurb: 'Majestic. Buoyant. Faster than it has any right to be.', rainbow: true,
    far(c, t) {
      c.save(); c.translate(0, -150); c.rotate(Math.sin(t * 5) * 0.05);
      Art.ell(c, 0, -120, 55, 120, '#fbe3f4');
      Art.ell(c, 0, -230, 70, 55, '#fbe3f4');
      Art.poly(c, [-14, -275, 0, -380, 14, -275], '#ffd23f');
      ['#ff5a5f', '#ffb02e', '#ffe45c', '#5ee27a', '#4db8ff', '#b36bff'].forEach((col, i) => Art.ell(c, -50 - i * 6, -200 + i * 22, 22, 26, col));
      c.restore();
    },
    near(c) {
      Art.ell(c, 0, -60, 210, 70, '#fbe3f4');
      Art.ell(c, -40, -75, 120, 30, '#ffffff');
      Art.ell(c, 0, -10, 200, 20, '#e8b8d8');
    } },
];

const OUTFITS = [
  { id: 'classic', name: 'Classic Blue', cost: 0, blurb: 'Warm. Reasonable. Soon to be neither.',
    jacket: '#1e88e5', sleeve: '#1565c0', stripe: '#ffd23f', mitt: '#ff5a1f', hat: 'beanie', hatColor: '#ff5a1f' },
  { id: 'ninja', name: 'Snow Ninja', cost: 200, blurb: 'Silent. Deadly. Screaming, actually.',
    jacket: '#22232b', sleeve: '#15161c', stripe: '#d62839', mitt: '#22232b', hat: 'ninja', hatColor: '#d62839' },
  { id: 'viking', name: 'Viking', cost: 500, blurb: 'Raided a ski shop once.',
    jacket: '#8a5a2e', sleeve: '#6d4522', stripe: '#c9c9c9', mitt: '#6d4522', hat: 'viking', hatColor: '#9aa3b5' },
  { id: 'royal', name: 'Royalty', cost: 900, blurb: 'Rules the mountain for about eight seconds.',
    jacket: '#6a2fb5', sleeve: '#4d1f8a', stripe: '#ffd23f', mitt: '#ffffff', hat: 'crown', hatColor: '#ffd23f' },
  { id: 'astro', name: 'Astronaut', cost: 1400, blurb: 'For when madness reaches the Cosmic level.',
    jacket: '#eef2f8', sleeve: '#c9d3e3', stripe: '#ff5a1f', mitt: '#c9d3e3', hat: 'astro', hatColor: '#9fe3ff' },
  { id: 'banana', name: 'Banana Suit', cost: 2000, blurb: 'Peak aerodynamics. Peak dignity.',
    jacket: '#ffd21f', sleeve: '#f2bf00', stripe: '#6b4a1e', mitt: '#ffd21f', hat: 'banana', hatColor: '#ffd21f' },
];

const RIVAL_NAMES = ['GARY', 'SVEN', 'GRANDMA', 'BRAD', 'OLGA', 'A BEAR?', 'DOUG', 'INGRID', 'KEVIN', 'THE MAYOR', 'CHAD', 'MRS. P'];

function sledById(id) { return SLEDS.find(s => s.id === id) || SLEDS[0]; }
function outfitById(id) { return OUTFITS.find(o => o.id === id) || OUTFITS[0]; }

// Hats drawn over the head at (0, -280), radius 58.
function drawHat(c, look, front, t) {
  switch (look.hat) {
    case 'ninja': {
      c.fillStyle = '#15161c';
      c.beginPath(); c.ellipse(0, -290, 62, 56, 0, Math.PI, TAU); c.fill();
      Art.rect(c, -62, -304, 124, 20, look.hatColor);
      if (!front) {
        const w = Math.sin(t * 20) * 14;
        Art.line(c, [30, -294, 110, -270 + w, 170, -285 - w], look.hatColor, 14);
        Art.line(c, [30, -294, 100, -250 - w, 150, -240 + w], look.hatColor, 12);
      }
      break;
    }
    case 'viking':
      for (const s of [-1, 1]) {
        c.fillStyle = '#f3efe0';
        c.beginPath(); c.moveTo(s * 55, -300); c.quadraticCurveTo(s * 120, -310, s * 110, -390); c.quadraticCurveTo(s * 95, -330, s * 50, -325); c.closePath(); c.fill();
      }
      c.fillStyle = look.hatColor;
      c.beginPath(); c.ellipse(0, -290, 66, 62, 0, Math.PI, TAU); c.fill();
      Art.rect(c, -68, -300, 136, 20, '#6b7486');
      Art.rect(c, -8, -350, 16, 60, '#6b7486');
      break;
    case 'crown':
      if (!front) { c.fillStyle = '#6b4226'; c.beginPath(); c.ellipse(0, -290, 60, 50, 0, Math.PI, TAU); c.fill(); }
      Art.poly(c, [-56, -320, -56, -380, -28, -348, 0, -392, 28, -348, 56, -380, 56, -320], look.hatColor);
      Art.circ(c, 0, -338, 10, '#e63946'); Art.circ(c, -34, -334, 7, '#3d6fd6'); Art.circ(c, 34, -334, 7, '#5ee27a');
      break;
    case 'astro':
      Art.rect(c, -70, -236, 140, 22, '#c9d3e3');
      c.fillStyle = 'rgba(159,227,255,0.35)';
      c.beginPath(); c.arc(0, -285, 86, 0, TAU); c.fill();
      c.strokeStyle = '#eef2f8'; c.lineWidth = 10; c.stroke();
      Art.ell(c, -32, -318, 22, 12, 'rgba(255,255,255,0.7)');
      break;
    case 'banana':
      c.fillStyle = look.hatColor;
      c.beginPath(); c.moveTo(-64, -250); c.quadraticCurveTo(-80, -380, 0, -430); c.quadraticCurveTo(80, -380, 64, -250);
      if (front) { c.lineTo(40, -250); c.quadraticCurveTo(0, -350, -40, -250); }
      c.closePath(); c.fill();
      Art.rect(c, -8, -455, 16, 34, '#6b4a1e');
      if (front) { Art.ell(c, -40, -380, 8, 18, '#e0a800'); }
      break;
    default: // beanie
      c.fillStyle = look.hatColor;
      c.beginPath(); c.ellipse(0, -296, 62, 56, 0, Math.PI, TAU); c.fill();
      Art.rect(c, -64, -306, 128, 22, '#ffd23f');
      Art.circ(c, Math.sin(t * 16) * 8, -358 + Math.abs(Math.sin(t * 9)) * -6, 22, '#fff');
  }
}

// ---------------------------------------------------------------- shop screen
const Garage = {
  tab: 'sleds',
  init() {
    this.el = document.getElementById('garage-screen');
    this.grid = document.getElementById('garage-grid');
    this.bank = document.getElementById('garage-bank');
    this.el.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.render(); }));
    document.getElementById('garage-back').addEventListener('click', () => UI.back());
    this.grid.addEventListener('click', e => {
      const b = e.target.closest('button[data-id]');
      if (b) this.act(b.dataset.id);
    });
  },
  items() { return this.tab === 'sleds' ? SLEDS : OUTFITS; },
  act(id) {
    const d = Save.data, item = this.items().find(i => i.id === id);
    if (!item) return;
    const key = this.tab === 'sleds' ? 'sled' : 'outfit';
    if (d.owned[id]) {
      d[key] = id;
      Sfx.init(); Sfx.coin();
    } else if (d.bank >= item.cost) {
      d.bank -= item.cost;
      d.owned[id] = true;
      d[key] = id;
      Sfx.init(); Sfx.level();
    } else {
      Sfx.init(); Sfx.beep(false);
      return;
    }
    Save.write();
    this.render();
  },
  render() {
    const d = Save.data;
    this.bank.textContent = U.fmt(d.bank);
    this.el.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === this.tab)));
    const key = this.tab === 'sleds' ? 'sled' : 'outfit';
    this.grid.innerHTML = this.items().map(it => {
      const owned = d.owned[it.id], equipped = d[key] === it.id;
      const label = equipped ? 'Riding' : owned ? 'Equip' : `${U.fmt(it.cost)} coins`;
      const cls = equipped ? 'equipped' : owned ? '' : d.bank >= it.cost ? 'buy' : 'locked';
      return `<article class="item ${cls}">
        <canvas width="220" height="200" data-prev="${it.id}"></canvas>
        <h3>${it.name}</h3><p>${it.blurb}</p>
        <button type="button" data-id="${it.id}" ${equipped ? 'disabled' : ''}>${label}</button>
      </article>`;
    }).join('');
    this.grid.querySelectorAll('canvas[data-prev]').forEach(cv => {
      const id = cv.dataset.prev;
      const sled = this.tab === 'sleds' ? id : d.sled;
      const outfit = this.tab === 'sleds' ? d.outfit : id;
      Player.preview(cv, sled, outfit, this.tab !== 'sleds');
    });
  },
};
