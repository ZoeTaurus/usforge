// Entry point: renderer, game loop, screens and the garage shop UI.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import {
  save, persist, owns, buy, statRatings, computeStats, computeReward, partItem,
  BODIES, WHEELS, SPOILERS, FINISHES, STRIPES, PARTS, PAINT_COLORS, UNDERGLOW_PRICE, LAP_OPTIONS, LAP_FACTOR, PLACE_TOKENS,
  STICKERS, TRAILS, HORNS, BUBBLES,
  DIFFICULTIES, difficultyDef,
} from './state.js';
import { TRACKS, getTrack, cornerPolyline } from './tracks.js';
import { Garage } from './garage.js';
import { Race } from './race.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { stickerImage } from './style.js';
import { withConditions, canNight, rainKind } from './conditions.js';
import { loadGhost } from './ghost.js';
import { dailyChallenges, completeDaily, timeToReset, SWEEP_BONUS } from './daily.js';
import { formatTime, ordinal } from './utils.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const canvas = $('#game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  const text = 'Your browser or device could not start 3D graphics. Try a recent Chrome, Edge, Firefox or Safari.';
  if (window.__bootFail) window.__bootFail(`<b>3D graphics are not available.</b><br>${text}`);
  const f = $('#fatal');
  f.hidden = false;
  f.innerHTML = `<h1>WebGL not available</h1><p>${text}</p>`;
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function applyQuality() {
  const hi = save.settings.quality === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 2 : 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  $('#btn-quality').textContent = hi ? 'HD' : 'LOW';
}
applyQuality();

const input = new Input();
let garage = new Garage(renderer, save.settings.quality);
garage.setCar(save.car);
let race = null;
let active = garage;
let screen = '';
let garageTab = 'parts';
let preview = null; // { field, value } while trying out a locked item
let lastResult = null;

audio.enabled = save.settings.sound;
$('#btn-sound').textContent = save.settings.sound ? '🔊' : '🔇';

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
function show(name) {
  screen = name;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  const inRace = ['hud', 'pause', 'results', 'loading', 'tutdone'].includes(name);
  $('#topbar').classList.toggle('hidden', name === 'hud' || name === 'pause' || name === 'loading');
  document.body.classList.toggle('in-race', inRace);
  if (!inRace) {
    garage.setMode(name === 'garage' ? 'garage' : name === 'menu' || name === 'howto' || name === 'daily' ? 'menu' : 'maps');
  }
  if (name === 'menu') renderMenu();
  if (name === 'garage') {
    if (!save.visitedGarage) {
      save.visitedGarage = true;
      persist();
    }
    renderGarage();
  }
  if (name === 'maps') renderMaps();
  if (name === 'daily') renderDaily();
  updateTokens();
}

let shownTokens = save.tokens;
function updateTokens(animate = false) {
  const el = $('#token-count');
  if (!animate) {
    shownTokens = save.tokens;
    el.textContent = save.tokens.toLocaleString();
    return;
  }
  const from = shownTokens;
  const to = save.tokens;
  shownTokens = to;
  const t0 = performance.now();
  const tick = () => {
    const t = Math.min(1, (performance.now() - t0) / 900);
    el.textContent = Math.round(from + (to - from) * t).toLocaleString();
    if (t < 1) requestAnimationFrame(tick);
  };
  tick();
  $('.token-pill').classList.remove('bump');
  void $('.token-pill').offsetWidth;
  $('.token-pill').classList.add('bump');
}

let toastTimer = 0;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'on ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 2200);
}

function renderDaily() {
  const list = dailyChallenges();
  $('#daily-list').innerHTML = list
    .map((c) => `<div class="daily-item ${c.done ? 'done' : ''}">
      <span class="d-icon">${c.icon}</span>
      <span class="d-text">${c.text}</span>
      <span class="d-reward">${c.done ? '✔ DONE' : `<i class="coin">T</i>${c.reward}`}</span>
    </div>`)
    .join('');
  const left = list.filter((c) => !c.done).length;
  $('#daily-foot').innerHTML = left
    ? `Do all 3 for a bonus <b><i class="coin">T</i>${SWEEP_BONUS}</b> · New challenges in ${timeToReset()}`
    : `🌟 All done for today! New challenges in ${timeToReset()}`;
}

function renderMenu() {
  const s = save.stats;
  const left = dailyChallenges().filter((c) => !c.done).length;
  const badge = $('#daily-badge');
  badge.textContent = left ? String(left) : '✔';
  badge.classList.toggle('done', !left);
  $('#menu-stats').innerHTML = `
    <div><b>${s.races}</b><span>Races</span></div>
    <div><b>${s.wins}</b><span>Wins</span></div>
    <div><b>${s.podiums}</b><span>Podiums</span></div>
    <div><b>${s.tokensEarned.toLocaleString()}</b><span>Tokens won</span></div>`;
}

// ---------------------------------------------------------------------------
// Garage UI
// ---------------------------------------------------------------------------
function carWithPreview() {
  const c = { ...save.car };
  if (preview) c[preview.field] = preview.value;
  return c;
}

function refreshCar() {
  garage.setCar(carWithPreview());
  renderStats();
}

function clearPreview() {
  if (preview) {
    preview = null;
    garage.setCar(save.car);
  }
}

function priceTag(price, owned, equipped) {
  if (equipped) return '<span class="tag-eq">EQUIPPED</span>';
  if (owned) return '<span class="tag-own">OWNED</span>';
  return `<span class="tag-price"><i class="coin">T</i>${price}</span>`;
}

function optionCards(kind, list, field, extra = () => '') {
  return `<div class="cards">${list
    .map((it) => {
      const own = owns(kind, it.id, it.price);
      const eq = save.car[field] === it.id;
      const pv = preview && preview.field === field && preview.value === it.id;
      return `<button class="card ${eq ? 'equipped' : ''} ${pv ? 'previewing' : ''} ${own ? '' : 'locked'}" data-kind="${kind}" data-field="${field}" data-id="${it.id}" data-price="${it.price}">
        <div class="card-name">${it.name}</div>
        ${extra(it)}
        <div class="card-foot">${pv ? `<span class="buy-now">BUY <i class="coin">T</i>${it.price}</span>` : priceTag(it.price, own, eq)}</div>
      </button>`;
    })
    .join('')}</div>`;
}

function swatches(field, colors, allowCustom = true) {
  const cur = (save.car[field] || '').toLowerCase();
  return `<div class="swatches">${colors
    .map((c) => `<button class="swatch ${cur === c.toLowerCase() ? 'on' : ''}" style="--c:${c}" data-color-field="${field}" data-color="${c}" title="${c}"></button>`)
    .join('')}${allowCustom ? `<label class="swatch custom" title="Custom colour"><input type="color" data-color-input="${field}" value="${save.car[field] || '#ffffff'}"><span>+</span></label>` : ''}</div>`;
}

function renderGarage() {
  $$('#garage-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === garageTab));
  const el = $('#garage-content');
  const car = save.car;
  let html = '';
  const desc = (it) => (it.desc ? `<div class="card-desc">${it.desc}</div>` : '');
  if (garageTab === 'parts') {
    html += `<p class="muted tab-intro">Buy parts with your tokens and bolt them on. Better parts make your car faster and show up on it.</p>`;
    for (const slot of PARTS) {
      const cur = partItem(slot.slot, car[slot.slot]);
      html += `<h3>${slot.name} <span class="slot-cur">${cur.name}</span></h3><p class="slot-blurb">${slot.blurb}</p>`;
      html += optionCards(slot.slot, slot.items, slot.slot, desc);
    }
  } else if (garageTab === 'body') {
    html += optionCards('body', BODIES, 'body', (b) => `<div class="card-desc">${b.desc}</div>${bodyBars(b)}`);
  } else if (garageTab === 'paint') {
    html += `<h3>Body colour</h3>${swatches('color', PAINT_COLORS)}`;
    html += `<h3>Stripes & trim colour</h3>${swatches('accent', PAINT_COLORS)}`;
    html += `<h3>Paint finish</h3>${optionCards('finish', FINISHES, 'finish')}`;
  } else if (garageTab === 'wheels') {
    html += `<h3>Rims</h3>${optionCards('wheels', WHEELS, 'wheels', (w) => (w.id === 'offroad' ? '<div class="card-desc">Bigger tyres, raised ride</div>' : ''))}`;
    html += `<h3>Rim colour</h3>${swatches('rimColor', ['#c9ced6', '#f5f5f5', '#111214', '#3a3f47', '#c9a227', '#e3242b', '#2f6bff', '#19c3d6', '#ff3ea5', '#7ed321'])}`;
  } else if (garageTab === 'extras') {
    html += `<h3>Spoiler</h3>${car.body === 'formula' ? '<p class="slot-blurb">The Formula car has its own wings.</p>' : ''}${optionCards('spoiler', SPOILERS, 'spoiler', desc)}`;
    html += `<h3>Stripes</h3>${optionCards('stripes', STRIPES, 'stripes')}`;
    const ugOwned = owns('underglow', 'kit', UNDERGLOW_PRICE);
    html += `<h3>Neon underglow</h3>`;
    if (!ugOwned) {
      html += `<button class="card wide locked" data-buy-underglow="1"><div class="card-name">Underglow kit</div><div class="card-desc">Glowing neon lights under your car — any colour.</div><div class="card-foot"><span class="buy-now">BUY <i class="coin">T</i>${UNDERGLOW_PRICE}</span></div></button>`;
    } else {
      const glow = ['#22e4ff', '#ff2fa8', '#7cff4a', '#ffd23f', '#9b5bff', '#ff4d2e', '#ffffff'];
      html += `<div class="swatches"><button class="swatch off ${!car.underglow ? 'on' : ''}" data-color-field="underglow" data-color="" title="Off">✕</button>${glow
        .map((c) => `<button class="swatch ${car.underglow === c ? 'on' : ''}" style="--c:${c}" data-color-field="underglow" data-color="${c}"></button>`)
        .join('')}<label class="swatch custom" title="Custom colour"><input type="color" data-color-input="underglow" value="${car.underglow || '#22e4ff'}"><span>+</span></label></div>`;
    }
    html += `<h3>Race number</h3><div class="number-row"><button class="btn small" data-num="-1">−</button><b class="race-num">${car.number}</b><button class="btn small" data-num="1">+</button><button class="btn small" data-num="rand">🎲</button></div>`;
  } else if (garageTab === 'style') {
    html += `<p class="muted tab-intro">Make your car stand out! Click something to try it on.</p>`;
    html += `<h3>Sticker</h3>${optionCards('sticker', STICKERS, 'sticker', (it) => `<div class="sticker-pic">${it.id === 'none' ? '' : `<img src="${stickerImage(it.id)}" alt="">`}</div>`)}`;
    html += `<h3>Light trail</h3>${optionCards('trail', TRAILS, 'trail', (it) => `<div class="trail-chip" style="background:${TRAIL_CSS[it.id].replace('ACCENT', car.accent)}"></div>${desc(it)}`)}`;
    html += `<h3>Horn <span class="slot-cur">press H to honk</span></h3>${optionCards('horn', HORNS, 'horn', (it) => `<div class="card-desc">🔊 ${it.desc}</div>`)}`;
    html += `<h3>Bubble colour <span class="slot-cur">on Bubble Reef</span></h3>${optionCards('bubble', BUBBLES, 'bubble', (it) => `<div class="bubble-chip ${it.color ? '' : 'rainbow'}" style="--c:${it.color || 'transparent'}"></div>`)}`;
  }
  el.innerHTML = html;
  renderStats();
}

// Little colour previews for the light trails.
const TRAIL_CSS = {
  none: 'repeating-linear-gradient(90deg, #333 0 6px, #222 6px 12px)',
  neon: 'linear-gradient(90deg, transparent, ACCENT)',
  fire: 'linear-gradient(90deg, #c01010, #ff7a1a, #fff2a0)',
  ice: 'linear-gradient(90deg, #2a6bff, #7ff3ff, #ffffff)',
  gold: 'linear-gradient(90deg, #ff9500, #ffd23f, #fffbe0)',
  galaxy: 'linear-gradient(90deg, #2fe0ff, #8a5bff, #ff4fd8)',
  rainbow: 'linear-gradient(90deg, #ff3b3b, #ff9b2f, #ffe14d, #4dff88, #2fa8ff, #a66bff)',
};

function bodyBars(b) {
  const r = statRatings({ ...save.car, body: b.id });
  return `<div class="mini-bars"><i style="--v:${r.speed}%" title="Speed"></i><i style="--v:${r.accel}%" title="Acceleration"></i><i style="--v:${r.handling}%" title="Handling"></i></div>`;
}

function renderStats() {
  const car = carWithPreview();
  const now = statRatings(save.car);
  const r = statRatings(car);
  const s = computeStats(car);
  const kmh = Math.round(s.maxSpeed * 3.6);
  const kmhNow = Math.round(computeStats(save.car).maxSpeed * 3.6);
  const body = BODIES.find((b) => b.id === car.body);
  const bar = (label, k) => {
    const a = now[k];
    const b = r[k];
    const lo = Math.min(a, b);
    const d = b - a;
    return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${lo}%"></i>${d ? `<b class="${d > 0 ? 'up' : 'down'}" style="left:${lo}%;width:${Math.abs(d)}%"></b>` : ''}</div></div>`;
  };
  const kmhDelta = kmh - kmhNow;
  $('#stats-panel').innerHTML = `
    <div class="stats-head"><span class="num-badge" style="background:${car.color}">${car.number}</span><div><div class="stats-name">${body.name}</div><div class="muted">Top speed ${kmh} km/h${kmhDelta ? ` <b class="${kmhDelta > 0 ? 'up' : 'down'}-txt">${kmhDelta > 0 ? '+' : ''}${kmhDelta}</b>` : ''}</div></div></div>
    ${bar('Top speed', 'speed')}${bar('Acceleration', 'accel')}${bar('Handling', 'handling')}${bar('Nitro', 'nitro')}
    <ul class="parts-list">${PARTS.map((p) => `<li><span>${p.name}</span><b>${partItem(p.slot, car[p.slot]).name}</b></li>`).join('')}</ul>
    ${preview ? '<div class="preview-note">Trying it on. Click it again to buy it.</div>' : ''}`;
}

$('#garage-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  audio.click();
  clearPreview();
  garage.setExtra(null);
  garageTab = b.dataset.tab;
  renderGarage();
});

$('#garage-content').addEventListener('click', (e) => {
  const card = e.target.closest('.card[data-kind]');
  if (card) {
    const { kind, field, id } = card.dataset;
    const price = +card.dataset.price;
    // Show trails and bubbles around the car while choosing them, and play horns.
    garage.setExtra(field === 'trail' || field === 'bubble' ? field : null);
    if (field === 'horn') audio.horn(id);
    if (field === 'nitro' || field === 'exhaust') {
      garage.demoNitro();
      audio.nitroIgnite();
    }
    if (owns(kind, id, price)) {
      preview = null;
      if (save.car[field] !== id) {
        save.car[field] = id;
        persist();
        audio.click();
        refreshCar();
      }
    } else if (preview && preview.field === field && preview.value === id) {
      if (buy(kind, id, price)) {
        save.car[field] = id;
        preview = null;
        persist();
        audio.buy();
        updateTokens(true);
        const isPart = PARTS.some((p) => p.slot === kind);
        toast(`${isPart ? 'Installed' : 'Unlocked'} ${card.querySelector('.card-name').textContent}!`, 'good');
        refreshCar();
      } else {
        audio.error();
        toast(`You need ${price - save.tokens} more tokens. Win races to earn them!`, 'bad');
      }
    } else {
      preview = { field, value: id };
      audio.click();
      refreshCar();
    }
    renderGarage();
    return;
  }
  if (e.target.closest('[data-buy-underglow]')) {
    if (buy('underglow', 'kit', UNDERGLOW_PRICE)) {
      save.car.underglow = '#22e4ff';
      persist();
      audio.buy();
      updateTokens(true);
      toast('Underglow unlocked!', 'good');
      refreshCar();
    } else {
      audio.error();
      toast(`You need ${UNDERGLOW_PRICE - save.tokens} more tokens.`, 'bad');
    }
    renderGarage();
    return;
  }
  const sw = e.target.closest('[data-color-field]');
  if (sw) {
    save.car[sw.dataset.colorField] = sw.dataset.color || null;
    persist();
    audio.click();
    refreshCar();
    renderGarage();
    return;
  }
  const num = e.target.closest('[data-num]');
  if (num) {
    const v = num.dataset.num;
    save.car.number = v === 'rand' ? 1 + Math.floor(Math.random() * 99) : ((save.car.number - 1 + +v + 99) % 99) + 1;
    persist();
    audio.click();
    refreshCar();
    renderGarage();
    return;
  }
});

$('#garage-content').addEventListener('input', (e) => {
  const f = e.target.dataset.colorInput;
  if (!f) return;
  save.car[f] = e.target.value;
  persist();
  refreshCar();
});
$('#garage-content').addEventListener('change', (e) => {
  if (e.target.dataset.colorInput) renderGarage();
});

// ---------------------------------------------------------------------------
// Track select
// ---------------------------------------------------------------------------
function trackSvg(def) {
  const pts = cornerPolyline(def);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const W = 200;
  const H = 120;
  const sc = Math.min((W - 24) / (maxX - minX), (H - 24) / (maxZ - minZ));
  const ox = (W - (maxX - minX) * sc) / 2;
  const oy = (H - (maxZ - minZ) * sc) / 2;
  const d = pts
    .filter((_, i) => i % 3 === 0)
    .map((p, i) => `${i ? 'L' : 'M'}${(ox + (p.x - minX) * sc).toFixed(1)},${(oy + (p.z - minZ) * sc).toFixed(1)}`)
    .join('') + 'Z';
  const s = pts[0];
  return `<svg viewBox="0 0 ${W} ${H}" class="track-svg"><path d="${d}" class="t-shadow"/><path d="${d}" class="t-line"/><circle cx="${ox + (s.x - minX) * sc}" cy="${oy + (s.z - minZ) * sc}" r="5" class="t-start"/></svg>`;
}

function renderMaps() {
  const sel = save.lastTrack;
  $('#map-grid').innerHTML = TRACKS.map((t) => {
    const best = save.best[t.id];
    const stars = '★'.repeat(t.difficulty) + '☆'.repeat(3 - t.difficulty);
    const win = Math.round(Math.round(PLACE_TOKENS[0] * t.reward * (LAP_FACTOR[save.laps] || 1)) * difficultyDef(save.difficulty).reward);
    return `<button class="map-card ${sel === t.id ? 'selected' : ''}" data-track="${t.id}" style="--c1:${t.theme.card[0]};--c2:${t.theme.card[1]}">
      <div class="map-art">${trackSvg(t)}${t.badge ? `<span class="map-new">${t.badge}</span>` : ''}</div>
      <div class="map-info">
        <div class="map-name">${t.name}</div>
        <div class="map-tag">${t.tagline}</div>
        <div class="map-meta"><span class="stars" title="Difficulty">${stars}</span><span>${(trackLength(t) / 1000).toFixed(1)} km</span><span class="win"><i class="coin">T</i>${win} for 1st</span></div>
        <div class="map-best">${best ? `Best lap ${formatTime(best.lap)} · Best finish ${ordinal(best.place)}` : 'Not raced yet'}</div>
      </div>
    </button>`;
  }).join('');
  $('#laps-seg').innerHTML = LAP_OPTIONS.map((l) => `<button class="${save.laps === l ? 'on' : ''}" data-laps="${l}">${l}</button>`).join('');
  const diff = difficultyDef(save.difficulty);
  $('#diff-seg').innerHTML = DIFFICULTIES.map((d) => `<button class="${d.id} ${diff.id === d.id ? 'on' : ''}" data-diff="${d.id}">${d.name}</button>`).join('');
  const def = getTrack(save.lastTrack);
  const st = save.settings;
  const nightOk = canNight(def);
  const rk = rainKind(def);
  const chip = (opt, label, on, disabled, title) =>
    `<button class="chip ${on ? 'on' : ''}" data-opt="${opt}" ${disabled ? 'disabled' : ''} title="${title}">${label}</button>`;
  $('#extra-chips').innerHTML =
    chip('ghost', '👻 Ghost', st.ghost, false, 'Race against your best lap') +
    chip('night', '🌙 Night', nightOk ? st.night : true, !nightOk, nightOk ? 'Race at night · ×1.1 tokens' : `${def.name} is always at night`) +
    chip('rain', rk === 'blizzard' ? '❄️ Blizzard' : '🌧️ Rain', rk && st.rain, !rk, rk ? 'Slippery and wet · ×1.15 tokens' : 'No rain on the Moon!');
  const lapNote = save.laps === 1 ? 'Quick race · half tokens' : save.laps === 5 ? 'Endurance · ×1.6 tokens' : 'Standard race';
  const diffNote = `${diff.name}: ${diff.desc}${diff.reward !== 1 ? ` · ×${diff.reward} tokens` : ''}`;
  let ghostNote = '';
  if (st.ghost) {
    const g = loadGhost(def.id);
    ghostNote = g ? `  ·  👻 Ghost lap ${formatTime(g.duration)}` : '  ·  👻 Finish a lap to make your ghost';
  }
  $('#laps-note').textContent = `${lapNote}  ·  ${diffNote}${ghostNote}`;
}

const lenCache = {};
function trackLength(t) {
  if (!lenCache[t.id]) {
    const pts = cornerPolyline(t);
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    lenCache[t.id] = L;
  }
  return lenCache[t.id];
}

$('#map-grid').addEventListener('click', (e) => {
  const c = e.target.closest('[data-track]');
  if (!c) return;
  audio.click();
  if (save.lastTrack === c.dataset.track && e.detail >= 2) return startRace();
  save.lastTrack = c.dataset.track;
  persist();
  renderMaps();
});
$('#diff-seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-diff]');
  if (!b) return;
  audio.click();
  save.difficulty = b.dataset.diff;
  persist();
  renderMaps();
});
$('#extra-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-opt]');
  if (!b || b.disabled) return;
  audio.click();
  save.settings[b.dataset.opt] = !save.settings[b.dataset.opt];
  persist();
  renderMaps();
});
$('#laps-seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-laps]');
  if (!b) return;
  audio.click();
  save.laps = +b.dataset.laps;
  persist();
  renderMaps();
});

// ---------------------------------------------------------------------------
// Racing
// ---------------------------------------------------------------------------
function startRace() {
  clearPreview();
  audio.unlock();
  const base = getTrack(save.lastTrack);
  const track = withConditions(base, { night: save.settings.night, rain: save.settings.rain });
  $('#loading-text').textContent = `Building ${track.name}…`;
  show('loading');
  // Let the loading screen paint before the heavy build.
  setTimeout(() => {
    try {
      disposeRace();
      race = new Race({
        renderer,
        track,
        laps: save.laps,
        difficulty: save.difficulty,
        ghost: save.settings.ghost,
        // The daily challenges panel starts hidden on phones (small screens).
        dailyOpen: save.settings.dailyHud ?? !input.isTouch,
        onDailyToggle: (open) => {
          save.settings.dailyHud = open;
          persist();
        },
        playerCar: save.car,
        quality: save.settings.quality,
        input,
        hudRoot: $('#screen-hud'),
        onFinish: (r) => finishRace(base, r, track.conditions || {}),
      });
      race.onPause = () => pauseRace(true);
      race.setCameraMode(save.settings.camera || 0);
      active = race;
      show('hud');
    } catch (err) {
      console.error(err);
      toast('Could not start the race: ' + err.message, 'bad');
      show('maps');
    }
  }, 60);
}

// Driving school: an empty Green Valley and step-by-step lessons.
const TUTORIAL_PRIZE = 50;
function startTutorial() {
  clearPreview();
  audio.unlock();
  $('#loading-text').textContent = 'Getting the driving school ready…';
  show('loading');
  setTimeout(() => {
    try {
      disposeRace();
      race = new Race({
        renderer,
        track: getTrack('valley'),
        laps: 99,
        difficulty: 'easy',
        playerCar: save.car,
        quality: save.settings.quality,
        input,
        hudRoot: $('#screen-hud'),
        onFinish: () => {},
        tutorial: { onDone: finishTutorial },
      });
      race.onPause = () => pauseRace(true);
      race.setCameraMode(save.settings.camera || 0);
      active = race;
      show('hud');
    } catch (err) {
      console.error(err);
      toast('Could not start the tutorial: ' + err.message, 'bad');
      show('menu');
    }
  }, 60);
}

function finishTutorial() {
  const first = !save.tutorialDone;
  save.tutorialDone = true;
  if (first) {
    save.tokens += TUTORIAL_PRIZE;
    save.stats.tokensEarned += TUTORIAL_PRIZE;
  }
  persist();
  if (race) race.setPaused(true);
  $('#tut-prize').innerHTML = first ? `Here's <b><i class="coin">T</i>${TUTORIAL_PRIZE}</b> to spend on your car!` : 'Ready for the real thing?';
  show('tutdone');
  if (first) updateTokens(true);
}

function disposeRace() {
  if (race) {
    save.settings.camera = race.camMode;
    persist();
    race.dispose();
    race = null;
  }
  active = garage;
}

function pauseRace(p) {
  if (!race) return;
  if (p && screen !== 'hud') return;
  race.setPaused(p);
  show(p ? 'pause' : 'hud');
}

function finishRace(track, r, conditions) {
  // Night only counts as a bonus when the player chose it.
  const cond = { night: !!(track.theme.night ? false : conditions.night), rain: conditions.rain || null };
  const reward = computeReward({ place: r.place, track, laps: save.laps, fastestLap: r.fastestLap, clean: r.clean, perf: r.perf, difficulty: save.difficulty, conditions: cond });
  // Daily challenges finished by this race.
  const newGhost = !!(race && race.newGhost);
  reward.daily = completeDaily({
    place: r.place, track: track.id, difficulty: save.difficulty, laps: save.laps, perf: r.perf, clean: r.clean,
    night: !!(track.theme.night || conditions.night), rain: conditions.rain, newGhost, honks: race ? race.honks || 0 : 0,
  });
  reward.total += reward.daily.reduce((a, d) => a + d.value, 0);
  save.tokens += reward.total;
  save.stats.races++;
  if (r.place === 1) save.stats.wins++;
  if (r.place <= 3) save.stats.podiums++;
  save.stats.tokensEarned += reward.total;
  const newDriftRecord = r.perf.bestDrift > (save.stats.bestDrift || 0);
  if (newDriftRecord) save.stats.bestDrift = r.perf.bestDrift;
  const prev = save.best[track.id] || { lap: Infinity, place: 99 };
  const newBest = r.bestLap < prev.lap;
  save.best[track.id] = { lap: Math.min(prev.lap, r.bestLap), place: Math.min(prev.place, r.place) };
  persist();
  lastResult = { track, r, reward, newBest, newDriftRecord, cond, newGhost };
  renderResults();
  show('results');
  audio.fanfare(r.place === 1);
}

function renderResults() {
  const { track, r, reward, newBest, newDriftRecord, cond, newGhost } = lastResult;
  const medal = ['gold', 'silver', 'bronze'][r.place - 1] || 'none';
  const headline = r.place === 1 ? 'VICTORY!' : r.place <= 3 ? 'PODIUM FINISH!' : 'RACE COMPLETE';
  const notes = [];
  if (newBest) notes.push(`<b class="hl">NEW BEST LAP ${formatTime(r.bestLap)}</b>`);
  if (newDriftRecord && r.perf.bestDrift >= 300) notes.push(`<b class="hl">NEW DRIFT RECORD ${r.perf.bestDrift.toLocaleString()}</b>`);
  if (newGhost) notes.push('<b class="hl">👻 NEW GHOST LAP</b>');
  const condText = [cond.night && '🌙 Night', cond.rain === 'rain' && '🌧️ Rain', cond.rain === 'blizzard' && '❄️ Blizzard'].filter(Boolean).join(' · ');
  let delay = 0.25;
  const line = (l) => {
    const html = `<div class="rw-line ${l.value < 0 ? 'neg' : ''}" style="animation-delay:${delay.toFixed(2)}s"><span>${l.label}</span><b>${l.value < 0 ? '−' + -l.value : '+' + l.value}</b></div>`;
    delay += 0.22;
    return html;
  };
  const raceLines = reward.lines.map(line).join('');
  const bonusLines = reward.bonus.length
    ? `<h4 class="rw-sub" style="animation-delay:${delay.toFixed(2)}s">PERFORMANCE BONUS</h4>${reward.bonus.map(line).join('')}`
    : `<p class="muted rw-tip">Drift, overtake and hit top speed to earn bonus tokens!</p>`;
  const dailyLines = reward.daily.length ? `<h4 class="rw-sub daily" style="animation-delay:${delay.toFixed(2)}s">📅 DAILY CHALLENGE</h4>${reward.daily.map(line).join('')}` : '';
  const totalDelay = delay;
  $('#results').innerHTML = `
    <div class="res-head">
      <div class="medal ${medal}">${r.place}<sup>${ordinal(r.place).replace(/^\d+/, '')}</sup></div>
      <div class="res-title"><h2>${headline}</h2><div class="muted">${track.name}${condText ? ' · ' + condText : ''} · ${difficultyDef(save.difficulty).name} · ${save.laps} lap${save.laps > 1 ? 's' : ''} · ${formatTime(r.totalTime)}${notes.length ? ' · ' + notes.join(' · ') : ''}</div></div>
      <div class="grade grade-${reward.grade.toLowerCase()}" title="Performance grade"><span>GRADE</span><b>${reward.grade}</b></div>
    </div>
    <div class="res-body">
      <table class="standings-table">
        <thead><tr><th>#</th><th>Driver</th><th>Time</th><th>Best lap</th></tr></thead>
        <tbody>${r.standings
          .map((s, i) => `<tr class="${s.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><i style="background:${s.color}"></i>${s.name}</td><td>${s.estimated ? '<span class="muted">+' + formatTime(s.time - r.totalTime) + '</span>' : formatTime(s.time)}</td><td>${formatTime(s.best)}</td></tr>`)
          .join('')}</tbody>
      </table>
      <div class="reward">
        <h3>TOKENS EARNED</h3>
        ${raceLines}${bonusLines}${dailyLines}
        <div class="rw-total" style="animation-delay:${totalDelay.toFixed(2)}s"><span>TOTAL</span><b><i class="coin">T</i><span id="rw-count">0</span></b></div>
        <div class="muted">Balance: <b id="rw-balance">${(save.tokens - reward.total).toLocaleString()}</b></div>
      </div>
    </div>
    <div class="res-actions">
      <button class="btn primary" data-action="again">RACE AGAIN</button>
      <button class="btn" data-action="highlights">▶ HIGHLIGHTS</button>
      <button class="btn" data-action="play">CHANGE TRACK</button>
      <button class="btn" data-action="garage">GARAGE</button>
      <button class="btn" data-action="menu">MENU</button>
    </div>`;
  // Token count-up with coin sounds.
  const total = reward.total;
  const countDelay = totalDelay * 1000;
  setTimeout(() => {
    const t0 = performance.now();
    let lastCoin = 0;
    const tick = () => {
      const el = $('#rw-count');
      if (!el) return;
      const t = Math.min(1, (performance.now() - t0) / 1200);
      el.textContent = Math.round(total * t);
      $('#rw-balance').textContent = (save.tokens - total + Math.round(total * t)).toLocaleString();
      if (performance.now() - lastCoin > 110 && t < 1) {
        lastCoin = performance.now();
        audio.coin();
      }
      if (t < 1) requestAnimationFrame(tick);
      else updateTokens(true);
    };
    tick();
  }, countDelay);
}

// ---------------------------------------------------------------------------
// Buttons & keys
// ---------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  audio.unlock();
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  audio.click();
  switch (a) {
    case 'tutorial':
      startTutorial();
      break;
    case 'play':
      disposeRace();
      clearPreview();
      // Brand-new players learn to drive first.
      if (!save.tutorialDone && save.stats.races === 0) {
        startTutorial();
        toast('Welcome to driving school! Learn the moves, then the racing begins.', 'good');
      } else if (!save.visitedGarage) {
        garageTab = 'parts';
        show('garage');
        toast('First, build your car! Pick parts and paint, then press CHOOSE TRACK.', 'good');
      } else {
        show('maps');
      }
      break;
    case 'garage':
      disposeRace();
      show('garage');
      break;
    case 'menu':
      disposeRace();
      clearPreview();
      show('menu');
      break;
    case 'howto':
      show('howto');
      break;
    case 'daily':
      show('daily');
      break;
    case 'closedaily':
      show('menu');
      break;
    case 'closehowto':
      show('menu');
      break;
    case 'start':
    case 'again':
      startRace();
      break;
    case 'restart':
      if (race && race.tutorial) startTutorial();
      else startRace();
      break;
    case 'resume':
      pauseRace(false);
      break;
    case 'highlights':
      if (race) {
        show('hud');
        race.playHighlights(() => show('results'));
      }
      break;
    case 'quit':
      disposeRace();
      show('menu');
      break;
  }
});

document.addEventListener('mouseover', (e) => {
  const b = e.target.closest('.btn, .card, .map-card');
  if (b && b !== document._lastHover) audio.hover();
  document._lastHover = b;
});

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.code === 'KeyM' && !(e.target && e.target.tagName === 'INPUT')) toggleSound();
  if (screen === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) {
    input.consume();
    pauseRace(false);
  }
  if (screen === 'maps' && e.code === 'Enter') startRace();
  if (screen === 'results' && e.code === 'Enter') startRace();
  if ((screen === 'howto' || screen === 'maps' || screen === 'garage' || screen === 'daily') && e.code === 'Escape') show('menu');
});

function toggleSound() {
  save.settings.sound = !save.settings.sound;
  audio.setEnabled(save.settings.sound);
  $('#btn-sound').textContent = save.settings.sound ? '🔊' : '🔇';
  persist();
}
$('#btn-sound').addEventListener('click', toggleSound);

$('#btn-quality').addEventListener('click', () => {
  save.settings.quality = save.settings.quality === 'high' ? 'low' : 'high';
  persist();
  applyQuality();
  const mode = garage.mode;
  garage = new Garage(renderer, save.settings.quality);
  garage.setCar(carWithPreview());
  garage.setMode(mode);
  if (!race) active = garage;
  toast(save.settings.quality === 'high' ? 'Graphics: HIGH (shadows, bloom, more scenery)' : 'Graphics: LOW (faster)');
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  garage.resize(window.innerWidth, window.innerHeight);
  if (race) race.resize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && race && screen === 'hud') pauseRace(true);
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (screen === 'loading') return;
  active.update(dt);
  active.render();
}

show('menu');
if (save.stats.races === 0) setTimeout(() => toast('Welcome! You have 150 tokens to spend on car parts.', 'good'), 800);
frame();

// The first frame rendered, so the game is running: remove the loading screen.
window.__gameStarted = true;
document.getElementById('boot')?.remove();

// Debug hooks for automated testing.
window.__game = {
  get race() {
    return race;
  },
  get garage() {
    return garage;
  },
  save,
  startRace,
  show,
};
