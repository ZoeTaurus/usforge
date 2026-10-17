// The title screen and the main menu, over the attract-mode movie (see
// attract.js). First the TITLE: the big logo and "click anywhere". Click (or
// press any key) and you get the MENU:
//   DRIVE / CONTINUE  start playing (in the region you're in)
//   HOW TO PLAY       the controls and the basic idea
//   NEW RUN           wipe souls, unlocks, chassis and build (asks twice)
// Arrow keys + Enter work too. onMenu() is called when the menu opens;
// the promise resolves when you start driving.
import { SETTINGS } from '../settings.js';
import { REGIONS, PLANNED_REGIONS } from '../regions/index.js';
import { GFX, QUALITY_LEVELS, QUALITY_ORDER, setQuality } from '../core/graphics.js';

const GFX_SUB = {
  low: 'Fastest. No shadows, simple lighting',
  medium: 'Shadows, headlights, glowing eyes & lava',
  high: 'Soft shadows, bloom, explosion flashes',
};

const HOW_TO = `
  <h3>HOW TO PLAY</h3>
  <p>You invade Hell in a car you build yourself. You can <b>never</b> leave it.
  Splat demons, collect their <b class="soul">souls</b>, and spend them on parts
  and upgrades: Muscle Car → Armored Car → Half-Track → <b>HELL TANK</b>.
  Beat each region's boss to open a Hellgate to the next.</p>
  <table>
    <tr><td>W / S</td><td>gas / brake &amp; reverse</td></tr>
    <tr><td>A / D</td><td>steer</td></tr>
    <tr><td>SPACE</td><td>handbrake (drift!)</td></tr>
    <tr><td>MOUSE</td><td>aim · <b>CLICK</b> (hold) to fire</td></tr>
    <tr><td>RAM</td><td>demons at 40+ km/h to splat them</td></tr>
    <tr><td>E</td><td>grab scrap that fell off your car</td></tr>
    <tr><td>G</td><td>garage: build, buy, repair</td></tr>
    <tr><td>R</td><td>unstick · <b>BACKSPACE</b> back to the start</td></tr>
    <tr><td>H · M · C</td><td>hide help · mute · dev / creative mode</td></tr>
  </table>
  <p class="dim">Pieces of your car break off as they take damage. Lose the cabin and the whole run starts over.</p>`;

export function showTitleScreen({ region, progress, onMenu }) {
  const el = document.getElementById('start');
  document.body.classList.add('title-open');
  const regionNo = REGIONS.indexOf(region) + 1;
  const tier = progress.tierInfo;
  const fresh = progress.souls < 1 && progress.tier === 0 && !progress.region && !Object.keys(progress.cleared).length;

  el.querySelector('.t-run').innerHTML = `
    <div class="t-run-label">REGION ${regionNo} / ${PLANNED_REGIONS.length}</div>
    <div class="t-run-name">${region.name}</div>
    <div class="t-run-tag">${region.tagline || ''}</div>
    <div class="t-run-stats">
      <span><b class="soul">✦ ${Math.floor(progress.souls)}</b> souls</span>
      <span><b>${tier.name}</b> chassis</span>
      ${progress.cleared[region.id] ? '<span><b>☠</b> boss beaten</span>' : ''}
    </div>`;

  const items = [
    { id: 'drive', label: fresh ? 'DRIVE INTO HELL' : 'CONTINUE', sub: fresh ? 'Start your engine' : `Back to ${region.name}`, primary: true },
    { id: 'how', label: 'HOW TO PLAY', sub: 'Controls & the basics' },
    { id: 'gfx', label: `GRAPHICS: ${GFX.label}`, sub: GFX_SUB[GFX.name] },
  ];
  if (!fresh && !SETTINGS.dev.creative) items.push({ id: 'new', label: 'NEW RUN', sub: 'Wipe everything, start over' });
  const menu = el.querySelector('.t-menu');
  menu.innerHTML = items.map((it, i) => `
    <button class="t-btn ${it.primary ? 'primary' : ''}" data-i="${i}">
      <span class="t-arrow">▶</span><span class="t-label">${it.label}<small>${it.sub}</small></span>
    </button>`).join('');
  const buttons = [...menu.querySelectorAll('.t-btn')];
  const panel = el.querySelector('.t-panel');
  let sel = 0, confirmNew = false;
  const select = (i) => { sel = (i + buttons.length) % buttons.length; buttons.forEach((b, n) => b.classList.toggle('sel', n === sel)); };
  select(0);
  el.classList.add('ready');

  return new Promise((resolve) => {
    // ---- Title: wait for a click or any key ----
    const toMenu = (e) => {
      if (e.type === 'keydown' && ['Tab', 'F5', 'F11', 'F12'].includes(e.code)) return;
      e.preventDefault?.();
      el.removeEventListener('click', toMenu);
      window.removeEventListener('keydown', toMenu);
      el.classList.add('menu');
      onMenu?.();
      // (give the click a moment so it doesn't also press a menu button)
      setTimeout(() => {
        el.addEventListener('click', onClick);
        el.addEventListener('mouseover', onHover);
        window.addEventListener('keydown', onKey);
      }, 150);
    };

    const choose = (i) => {
      const it = items[i];
      if (it.id === 'drive') {
        cleanup();
        el.classList.add('leaving');
        document.body.classList.remove('title-open');
        setTimeout(() => el.remove(), 700);
        resolve();
      } else if (it.id === 'how') {
        panel.innerHTML = HOW_TO;
        el.classList.toggle('panel-open', panel.classList.toggle('on'));
      } else if (it.id === 'gfx') {
        // Next quality level. It needs a restart; come straight back to the menu.
        const next = QUALITY_ORDER[(QUALITY_ORDER.indexOf(GFX.name) + 1) % QUALITY_ORDER.length];
        setQuality(next);
        buttons[i].querySelector('.t-label').innerHTML = `GRAPHICS: ${QUALITY_LEVELS[next].label}<small>Restarting…</small>`;
        try { sessionStorage.setItem('helldrive.toMenu', '1'); } catch { /* ignore */ }
        setTimeout(() => location.reload(), 150);
      } else if (it.id === 'new') {
        const b = buttons[i];
        if (!confirmNew) {
          confirmNew = true;
          b.classList.add('danger');
          b.querySelector('.t-label').innerHTML = 'REALLY?<small>Souls, unlocks, chassis and build will be gone. Click again.</small>';
          return;
        }
        try {
          localStorage.removeItem('helldrive.progress');
          localStorage.removeItem('helldrive.build');
        } catch { /* ignore */ }
        location.reload();
      }
    };
    const onClick = (e) => {
      const b = e.target.closest('.t-btn');
      if (b) choose(Number(b.dataset.i));
    };
    const onHover = (e) => {
      const b = e.target.closest('.t-btn');
      if (b) select(Number(b.dataset.i));
    };
    const onKey = (e) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') select(sel + 1);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') select(sel - 1);
      else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); choose(sel); }
      else if (e.code === 'Escape') { panel.classList.remove('on'); el.classList.remove('panel-open'); }
    };
    const cleanup = () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('mouseover', onHover);
      window.removeEventListener('keydown', onKey);
    };
    let skip = false;
    try { skip = sessionStorage.getItem('helldrive.toMenu') === '1'; sessionStorage.removeItem('helldrive.toMenu'); } catch { /* ignore */ }
    if (skip) { el.classList.add('menu'); toMenu({ type: 'skip' }); return; }
    el.addEventListener('click', toMenu);
    window.addEventListener('keydown', toMenu);
  });
}
