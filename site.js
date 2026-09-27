// Shared by every UsForge page: the Light / Dark / Auto theme switch, and the scroll-to-top / scroll-to-bottom buttons.
// (The theme itself is applied by a one-line script in each page's <head>, before anything paints — see THEME_BOOT.)
(() => {
  const KEY = 'usforge-theme';
  const get = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch (e) {} };
  // Auto follows the clock: light from 7am to 7pm, dark the rest of the day
  const resolve = mode => mode === 'auto' ? ((h => h >= 7 && h < 19)(new Date().getHours()) ? 'light' : 'dark') : mode;
  const apply = () => { document.documentElement.dataset.theme = resolve(get()); document.documentElement.dataset.mode = get(); paint(); };
  const LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' }, ICON = { auto: '◐', light: '☀', dark: '☾' };
  const NEXT = { auto: 'light', light: 'dark', dark: 'auto' };

  // the switch: one button that cycles Auto → Light → Dark, dropped into any element marked data-theme-switch
  function paint() {
    for (const b of document.querySelectorAll('.theme-btn')) {
      const m = get(), now = resolve(m);
      b.innerHTML = `<span aria-hidden="true">${ICON[m]}</span> ${LABEL[m]}`;
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
  // the genres a game can be tagged with (up to 3) — the same list lives in worker/index.js and scripts/build_list.py
  const GENRES = ['Action', 'Adventure', 'Arcade', 'Boss rush', 'Casual', 'Comedy', 'Horror', 'Party', 'Platformer', 'Puzzle', 'Racing', 'Roguelike', 'RPG', 'Sci-fi', 'Shooter', 'Simulation', 'Sports', 'Story', 'Strategy', 'Text-based'];

  // the team (credits and maker pages); roles in `lead` are highlighted
  const TEAM = [
    { name: 'Taurus', roles: ['Director', 'Leader', 'Developer', 'Quality Control', 'Ideas'], lead: 2 },
    { name: 'Henrique', roles: ['Designer', 'Developer', 'Ideas'] },
    { name: 'Alex', roles: ['Developer', 'Ideas', 'Potato'] },
    { name: 'Igor', roles: ['Developer'] },
  ];

  // plays + stokes from the Worker, fetched once per page ({plays, stokes}, or null on the GitHub Pages copy)
  let statsP = null;
  const stats = (again) => (!statsP || again) ? (statsP = fetch('/api/stats', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(d => d && d.plays ? d : null).catch(() => null)) : statsP;

  // this browser's own memory: games played recently, and games it has stoked
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const recent = () => store.get('usforge-recent', []);
  const played = slug => store.set('usforge-recent', [slug, ...recent().filter(s => s !== slug)].slice(0, 8));
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
      if (!c) return;
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
    if (!window.Embers || document.getElementById('bgEmbers')) return;
    const c = document.createElement('canvas'); c.className = 'bg-embers'; c.id = 'bgEmbers'; c.setAttribute('aria-hidden', 'true');
    document.body.prepend(c); Embers(c, { count: 16, alpha: .38, speed: .5 });
  });

  window.UsForge = { refreshScroll: () => dispatchEvent(new Event('scroll')), GENRES, TEAM, stats, recent, played, stoked, stoke, FLAME, toast };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', mount) : mount();
})();
