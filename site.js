// Shared by every UsForge page: the Light / Dark / Auto theme switch, and the scroll-to-top / scroll-to-bottom buttons.
// (The theme itself is applied by a one-line script in each page's <head>, before anything paints — see THEME_BOOT.)
(() => {
  // ---------- theme colour: the visitor's pick (default #4d8cf7), and every colour made from it ----------
  const DEFAULT_ACCENT = '#4d8cf7';
  const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const setPref = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const okHex = h => /^#[0-9a-f]{6}$/i.test(h);
  const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, k) => '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
  const hueOf = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  const lum = rgb => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  let accent = DEFAULT_ACCENT;
  function applyAccent(hex) {
    accent = okHex(hex) ? hex.toLowerCase() : DEFAULT_ACCENT;
    const c = rgbOf(accent), rgba = a => `rgba(${c.join(', ')}, ${a})`;
    // text on a filled accent button: whichever of dark navy or white reads better
    const ink = (lum(c) + .05) / (lum([6, 18, 42]) + .05) >= (1.05) / (lum(c) + .05) ? '#06122a' : '#ffffff';
    let el = document.getElementById('accentStyle');
    if (!el) { el = document.createElement('style'); el.id = 'accentStyle'; document.head.append(el); }
    el.textContent = `:root, :root[data-theme] { --accent: ${accent}; --accent-ink: ${ink}; --glow: ${rgba(.45)}; --glow-bg: ${mix(c, [7, 9, 14], .82)};
  --tint-30: ${rgba(.3)}; --tint-20: ${rgba(.2)}; --tint-10: ${rgba(.1)}; --accent-edge: ${rgba(.55)}; --accent-ring: ${rgba(.7)}; }
:root[data-theme="light"] { --glow: ${rgba(.3)}; --glow-bg: ${mix(c, [255, 255, 255], .75)}; --tint-30: ${rgba(.24)}; --tint-20: ${rgba(.15)}; --tint-10: ${rgba(.08)}; --accent-edge: ${rgba(.5)}; --accent-ring: ${rgba(.75)}; }`;
    if (window.UsForge) window.UsForge.accentHue = hueOf(c);
  }
  applyAccent(pref('usforge-accent', DEFAULT_ACCENT));
  const sparksOn = () => pref('usforge-sparks', 'on') !== 'off', tiltOn = () => pref('usforge-tilt', 'on') !== 'off';

  const KEY = 'usforge-theme';
  const get = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch (e) {} };
  // Auto follows the clock: light from 7am to 7pm, dark the rest of the day
  const resolve = mode => mode === 'auto' ? ((h => h >= 7 && h < 19)(new Date().getHours()) ? 'light' : 'dark') : mode;
  const apply = () => { document.documentElement.dataset.theme = resolve(get()); document.documentElement.dataset.mode = get(); paint(); };
  const LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' }, ICON = { auto: 'auto', light: 'sun', dark: 'moon' };
  const NEXT = { auto: 'light', light: 'dark', dark: 'auto' };

  // the switch: one button that cycles Auto → Light → Dark, dropped into any element marked data-theme-switch
  function paint() {
    for (const b of document.querySelectorAll('.theme-btn')) {
      const m = get(), now = resolve(m);
      b.innerHTML = `${window.UsForgeIcon?.(ICON[m]) || ''} ${LABEL[m]}`;
      b.title = m === 'auto' ? `Theme: Auto (${now} right now — light 7am–7pm)` : `Theme: ${LABEL[m]}`;
      b.setAttribute('aria-label', `Theme: ${LABEL[m]}. Click to change.`);
    }
  }
  function mount() {
    for (const spot of document.querySelectorAll('[data-theme-switch]')) {
      if (spot.querySelector('.theme-btn')) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'theme-btn';
      b.onclick = () => { set(NEXT[get()]); apply(); };
      spot.append(b);
      const gear = document.createElement('a');
      gear.href = 'settings.html'; gear.className = 'gear-btn'; gear.title = 'Settings'; gear.setAttribute('aria-label', 'Settings'); gear.innerHTML = window.UsForgeIcon?.('gear') || 'Settings';
      if (/settings(\.html)?$/.test(location.pathname)) gear.setAttribute('aria-current', 'page');
      spot.append(gear);
      // "You" (favorites, stats, badges) in the menu
      const nav = spot.closest('nav');
      if (nav && !nav.querySelector('.you-link')) {
        const you = document.createElement('a');
        you.href = '/you.html'; you.className = 'you-link'; you.innerHTML = `${window.UsForgeIcon?.('heart') || ''} You`;
        if (/\/you(\.html)?$/.test(location.pathname)) you.setAttribute('aria-current', 'page');
        nav.insertBefore(you, spot);
      }
      const app = document.createElement('button');
      app.type = 'button'; app.className = 'app-btn'; app.hidden = true; app.innerHTML = `${window.UsForgeIcon?.('download') || ''} Get the app`;
      app.onclick = () => install();
      spot.insertBefore(app, b);
      paintApp();   // (now that the button exists)
    }
    apply();
    setInterval(() => { if (get() === 'auto') apply(); }, 5 * 60 * 1000);   // day turns to night while the page is open

    // scroll buttons (not on pages marked data-no-scroll-buttons, like a running game)
    if (document.body.hasAttribute('data-no-scroll-buttons')) return;
    const wrap = document.createElement('div');
    wrap.className = 'scroll-btns';
    wrap.innerHTML = '<button type="button" class="sb" data-to="top" aria-label="Scroll to top">↑</button><button type="button" class="sb" data-to="bottom" aria-label="Scroll to bottom">↓</button>';
    document.body.append(wrap);
    const [up, down] = wrap.children;
    const smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    up.onclick = () => scrollTo({ top: 0, behavior: smooth });
    down.onclick = () => scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth });
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight, y = scrollY;
      wrap.hidden = max < 200 || document.body.classList.contains('playing');
      up.classList.toggle('off', y < 120); down.classList.toggle('off', y > max - 120);
    };
    addEventListener('scroll', update, { passive: true }); addEventListener('resize', update);
    new ResizeObserver(update).observe(document.body);
    update();
  }
  // Tips: the Stripe Payment Link people are sent to (make it in the Stripe dashboard → Payment Links → "customers choose what to pay").
  // While it's empty, every Support button stays hidden. Only a buy.stripe.com / donate.stripe.com link is used.
  const SUPPORT_URL = '';
  const supportUrl = /^https:\/\/(buy|donate)\.stripe\.com\/[A-Za-z0-9_]+$/.test(SUPPORT_URL) ? SUPPORT_URL : '';
  addEventListener('DOMContentLoaded', () => {
    for (const el of document.querySelectorAll('[data-support]')) el.hidden = !supportUrl;
    for (const el of document.querySelectorAll('[data-support-go]')) el.href = supportUrl || 'support.html';
  });

  // the genres a game can be tagged with (up to 3) — the same list lives in worker/index.js and scripts/build_list.py
  const GENRE_GROUPS = [
    ['How it plays', ['Action', 'Adventure', 'Arcade', 'Boss rush', 'Casual', 'Crafting', 'Endless runner', 'Exploration', 'Fighting', 'Idle', 'Management', 'Open world', 'Physics', 'Platformer', 'Puzzle', 'Racing', 'Rhythm', 'Roguelike', 'RPG', 'Sandbox', 'Shooter', 'Simulation', 'Sports', 'Stealth', 'Strategy', 'Survival', 'Tower defense']],
    ['Cards, words & friends', ['Board game', 'Card game', 'Educational', 'Multiplayer', 'Party', 'Quiz', 'Text-based', 'Word game']],
    ['Mood & setting', ['Comedy', 'Fantasy', 'Horror', 'Mystery', 'Pixel art', 'Sci-fi', 'Space', 'Story']],
  ];
  const GENRES = GENRE_GROUPS.flatMap(([, list]) => list);

  // the team (credits and maker pages); roles in `lead` are highlighted
  const TEAM = [
    { name: 'Taurus', roles: ['Director', 'Leader', 'Developer', 'Quality Control', 'Ideas'], lead: 2 },
    { name: 'Henrique', roles: ['Designer', 'Developer', 'Ideas', 'Composer'] },
    { name: 'Alex', roles: ['Developer', 'Ideas', 'Quality Control', 'Potato'] },
    { name: 'Igor', roles: ['Developer', 'Marketing'] },
  ];

  // plays + stokes from the Worker, fetched once per page ({plays, stokes}, or null on the GitHub Pages copy)
  let statsP = null;
  const stats = (again) => (!statsP || again) ? (statsP = fetch('/api/stats', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(d => d && d.plays ? d : null).catch(() => null)) : statsP;

  // this browser's own memory: games played recently, and games it has stoked
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const recent = () => store.get('usforge-recent', []);
  const played = slug => {
    store.set('usforge-recent', [slug, ...recent().filter(s => s !== slug)].slice(0, 8));
    const n = store.get('usforge-plays', {}); n[slug] = (n[slug] || 0) + 1; store.set('usforge-plays', n);   // your own play counts
    const h = new Date().getHours(); if (h < 5) store.set('usforge-nightowl', true);
  };
  // ---------- "You": favorites, play time and badges (this browser only; no account) ----------
  const favs = () => store.get('usforge-favs', []);
  const isFav = slug => favs().includes(slug);
  const toggleFav = slug => { const on = !isFav(slug); store.set('usforge-favs', on ? [slug, ...favs()] : favs().filter(s => s !== slug)); return on; };
  const addTime = (slug, secs) => { const t = store.get('usforge-time', {}); t[slug] = (t[slug] || 0) + secs; store.set('usforge-time', t); };
  (() => { const d = new Date().toISOString().slice(0, 10), days = store.get('usforge-days', []); if (!days.includes(d)) store.set('usforge-days', [...days, d].slice(-400)); })();
  const flag = k => store.set('usforge-' + k, true);
  const stoked = slug => store.get('usforge-stoked', []).includes(slug);
  async function stoke(slug) {
    if (stoked(slug)) return null;
    store.set('usforge-stoked', [...store.get('usforge-stoked', []), slug]);
    const r = await fetch('/api/stoke?g=' + encodeURIComponent(slug), { method: 'POST' }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (r) statsP = Promise.resolve(r);
    return r;
  }
  const FLAME = '<svg class="flame" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1c.6 2.6 3.6 4.2 3.6 7.6A3.6 3.6 0 0 1 8 12.2a3.6 3.6 0 0 1-3.6-3.6c0-1.5.7-2.4 1.4-3.2.1 1.3.8 2 1.6 2.2C6.8 5.4 7.4 3 8 1Z" fill="currentColor"/><path d="M8 15c-2.4 0-4-1.5-4-3.3 0 1.5 1.8 2.3 4 2.3s4-.8 4-2.3C12 13.5 10.4 15 8 15Z" fill="currentColor" opacity=".55"/></svg>';

  // cards lean toward the pointer, with a glint where it is
  const calmMotion = matchMedia('(prefers-reduced-motion: reduce)').matches, finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!calmMotion && finePointer) {
    addEventListener('pointermove', e => {
      const c = e.target.closest?.('.tilt');
      if (!c || !tiltOn()) return;
      const b = c.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      c.style.setProperty('--rx', ((.5 - y) * 9).toFixed(2) + 'deg'); c.style.setProperty('--ry', ((x - .5) * 11).toFixed(2) + 'deg');
      c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    }, { passive: true });
    addEventListener('pointerout', e => { const c = e.target.closest?.('.tilt'); if (c && !c.contains(e.relatedTarget)) { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); } });
  }

  // clicking a game card: its cover flies into place on the game page (browsers with page transitions)
  addEventListener('click', e => {
    const a = e.target.closest?.('a[data-cover]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    document.querySelectorAll('[style*="view-transition-name"]').forEach(x => x.style.viewTransitionName = '');
    const c = a.querySelector('.cover') || a; c.style.viewTransitionName = 'game-cover';
  });
  addEventListener('pageshow', () => document.querySelectorAll('.cover').forEach(c => { if (c.style.viewTransitionName) c.style.viewTransitionName = ''; }));

  // "/" jumps to search, wherever there is one
  addEventListener('keydown', e => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || /input|textarea|select/i.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable) return;
    const q = document.getElementById('q'); if (q && q.offsetParent) { e.preventDefault(); q.focus(); q.select(); }
  });

  // a small message that pops up from the bottom (easter eggs, stokes)
  function toast(html, ms = 2600) {
    let t = document.querySelector('.uf-toast');
    if (!t) { t = document.createElement('div'); t.className = 'uf-toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.innerHTML = html; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms);
  }

  // faint sparks drifting up behind every page (embers.js), fewer than on the title screen
  addEventListener('DOMContentLoaded', () => {
    if (!window.Embers || document.getElementById('bgEmbers') || !sparksOn()) return;
    const c = document.createElement('canvas'); c.className = 'bg-embers'; c.id = 'bgEmbers'; c.setAttribute('aria-hidden', 'true');
    document.body.prepend(c); Embers(c, { count: 16, alpha: .38, speed: .5 });
  });

  // ---------- live count: this tab checks in every 30s while it's visible; the site shows who's here ----------
  const LIVE = { online: 0, games: {}, ready: false };
  let tabId = '', playingNow = '';
  try { tabId = sessionStorage.getItem('usforge-tab') || ''; } catch (e) {}
  if (!/^[a-z0-9]{8,32}$/.test(tabId)) { tabId = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join(''); try { sessionStorage.setItem('usforge-tab', tabId); } catch (e) {} }
  const hereUrl = leave => `/api/here?id=${tabId}&g=${encodeURIComponent(playingNow)}${leave ? '&leave=1' : ''}`;
  function paintLive() {
    for (const el of document.querySelectorAll('[data-live]')) {   // "● 2 playing" wherever a page asks for it
      const n = el.dataset.live === '*' ? LIVE.online : LIVE.games[el.dataset.live] || 0;
      el.hidden = !LIVE.ready || !n;
      if (n) el.innerHTML = `<i class="live-dot" aria-hidden="true"></i>${n} ${el.dataset.live === '*' ? 'online now' : 'playing' + (el.dataset.now !== undefined ? ' now' : '')}`;
      if (el.dataset.live === '*' && !el.dataset.wired) wireWho(el);
    }
    paintWho();
    dispatchEvent(new CustomEvent('usforge-live', { detail: LIVE }));
  }
  // click "N online now" to see what everyone's playing
  let titles = null, whoEl = null, whoPanel = null;
  function wireWho(el) {
    el.dataset.wired = '1'; el.classList.add('live-clickable');
    el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-expanded', 'false'); el.title = 'See what everyone’s playing';
    const toggle = async () => {
      if (whoPanel) return closeWho();
      whoEl = el; el.setAttribute('aria-expanded', 'true');
      whoPanel = document.createElement('div'); whoPanel.className = 'who-panel'; whoPanel.setAttribute('role', 'dialog'); whoPanel.setAttribute('aria-label', 'Who’s online');
      document.body.append(whoPanel); placeWho();
      if (!titles) { titles = {}; try { for (const g of await (await fetch('/games.json', { cache: 'no-cache' })).json()) titles[g.slug] = g.title; } catch (e) {} }
      paintWho();
    };
    el.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  }
  function placeWho() {
    if (!whoPanel || !whoEl) return;
    const r = whoEl.getBoundingClientRect();
    whoPanel.style.top = `${r.bottom + scrollY + 8}px`;
    whoPanel.style.left = `${Math.max(12, Math.min(r.left + scrollX, scrollX + innerWidth - whoPanel.offsetWidth - 12))}px`;
  }
  function paintWho() {
    if (!whoPanel) return;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const playing = Object.entries(LIVE.games).sort((a, b) => b[1] - a[1]);
    const inGames = playing.reduce((t, [, n]) => t + n, 0), browsing = Math.max(0, LIVE.online - inGames);
    whoPanel.innerHTML = `<b class="who-title">Right now on UsForge</b>
      ${playing.length ? `<ul>${playing.map(([slug, n]) => `<li><a href="/play.html?g=${encodeURIComponent(slug)}"><i class="live-dot" aria-hidden="true"></i>${esc(titles?.[slug] || slug)}</a><span>${n} playing</span></li>`).join('')}</ul>` : '<p>Nobody’s in a game right now.</p>'}
      ${browsing ? `<p>${browsing} ${browsing === 1 ? 'person is' : 'people are'} browsing${playing.length ? '' : ' the site'}.</p>` : ''}
      <p class="who-note">Updates every 30 seconds · no names, just numbers</p>`;
    placeWho();
  }
  function closeWho() { whoPanel?.remove(); whoPanel = null; whoEl?.setAttribute('aria-expanded', 'false'); whoEl?.focus?.(); whoEl = null; }
  addEventListener('click', e => { if (whoPanel && !whoPanel.contains(e.target)) closeWho(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && whoPanel) closeWho(); });
  addEventListener('resize', placeWho);

  // a tab you switch away from keeps counting for 5 minutes (browsers slow background timers to about once a
  // minute, which is enough); after that it drops out. Closing the tab removes it straight away.
  const AWAY_MS = 5 * 60 * 1000;
  let hiddenSince = document.hidden ? Date.now() : 0, gone = false;
  async function beat() {
    if (document.hidden && hiddenSince && Date.now() - hiddenSince > AWAY_MS) { if (!gone) { gone = true; leave(); } return; }
    gone = false;
    try {
      const r = await fetch(hereUrl(false), { method: 'POST', cache: 'no-store' });
      if (!r.ok) return;
      Object.assign(LIVE, await r.json(), { ready: true }); paintLive();
    } catch (e) {}
  }
  const leave = () => { try { navigator.sendBeacon?.(hereUrl(true)); } catch (e) {} };
  addEventListener('DOMContentLoaded', () => { beat(); setInterval(beat, 30000); });
  addEventListener('visibilitychange', () => { if (document.hidden) hiddenSince = Date.now(); else { hiddenSince = 0; beat(); } });
  addEventListener('pagehide', leave);

  // ---------- "Get the app": install UsForge (a real prompt where the browser allows it, otherwise a short how-to) ----------
  let deferredPrompt = null;
  const ua = navigator.userAgent;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|OPR|Firefox/.test(ua);
  const installMode = () => standalone() ? null : deferredPrompt ? 'prompt' : isIOS ? 'ios' : isMacSafari ? 'mac' : null;
  function paintApp() { const m = installMode(); for (const b of document.querySelectorAll('.app-btn')) b.hidden = !m; dispatchEvent(new Event('usforge-app')); }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; paintApp(); });
  addEventListener('appinstalled', () => { deferredPrompt = null; paintApp(); toast('<b>UsForge installed!</b> Find it with your other apps.'); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  const HOWTO = {
    ios: ['Install UsForge on your iPhone or iPad', ['Tap the <b>Share</b> button (the square with an arrow pointing up) at the bottom or top of Safari.', 'Scroll down and tap <b>Add to Home Screen</b>.', 'Tap <b>Add</b>. UsForge appears on your home screen.'], 'Only works in Safari on iPhone and iPad.'],
    mac: ['Install UsForge on your Mac', ['In the menu bar at the top of the screen, click <b>File</b>.', 'Click <b>Add to Dock</b>, then <b>Add</b>.', 'UsForge opens in its own window from your Dock.'], ''],
  };
  async function install() {
    const m = installMode();
    if (m === 'prompt') {
      const p = deferredPrompt; deferredPrompt = null;
      p.prompt(); const { outcome } = await p.userChoice.catch(() => ({}));
      if (outcome !== 'accepted') deferredPrompt = null;
      paintApp(); return;
    }
    if (!HOWTO[m]) return;
    const [title, steps, note] = HOWTO[m];
    let d = document.getElementById('appSheet');
    if (!d) { d = document.createElement('dialog'); d.id = 'appSheet'; d.className = 'app-sheet'; document.body.append(d); d.addEventListener('click', e => { if (e.target === d) d.close(); }); }
    d.innerHTML = `<h2>${title}</h2><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>${note ? `<p>${note}</p>` : ''}<button type="button" class="big-play" autofocus>Got it</button>`;
    d.querySelector('button').onclick = () => d.close();
    d.showModal();
  }

  // ---------- "We need more members!" banner (closable; stays closed in this browser) ----------
  const BANNER = 'usforge-banner-members-1';   // (change the number to show a new banner to everyone again)
  addEventListener('DOMContentLoaded', () => {
    if (pref(BANNER, '') === 'closed' || /\/add(\.html)?$/.test(location.pathname) || /\/404(\.html)?$/.test(location.pathname)) return;
    const bar = document.createElement('div');
    bar.className = 'site-banner'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Announcement');
    bar.innerHTML = `<p><b>We need more members!</b> <span>Make games with AI? Join UsForge and share them with everyone.</span> <a href="/add.html#join">How to join →</a></p>
      <button type="button" class="banner-x" aria-label="Close this message">${window.UsForgeIcon?.('close') || '×'}</button>`;
    bar.querySelector('.banner-x').onclick = () => { setPref(BANNER, 'closed'); bar.classList.add('closing'); setTimeout(() => bar.remove(), 250); };
    document.body.prepend(bar);
  });

  window.UsForge = { accentHue: hueOf(rgbOf(accent)), DEFAULT_ACCENT, get accent() { return accent; }, setAccent: hex => { setPref('usforge-accent', hex && okHex(hex) && hex.toLowerCase() !== DEFAULT_ACCENT ? hex.toLowerCase() : null); applyAccent(hex || DEFAULT_ACCENT); }, setTheme: m => { set(m); apply(); }, get theme() { return get(); }, pref, setPref, supportUrl, refreshScroll: () => dispatchEvent(new Event('scroll')), install, get installMode() { return installMode(); }, GENRES, GENRE_GROUPS, TEAM, live: LIVE, paintLive, setPlaying: slug => { playingNow = slug || ''; beat(); }, stats, recent, played, stoked, stoke, FLAME, toast, store, favs, isFav, toggleFav, addTime, flag };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', mount) : mount();
})();
