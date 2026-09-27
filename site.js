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
  window.UsForge = { refreshScroll: () => dispatchEvent(new Event('scroll')), GENRES };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', mount) : mount();
})();
