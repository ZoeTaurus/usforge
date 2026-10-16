// DEV / CREATIVE MODE panel (press C). Switches:
//   No enemies  - no demons spawn, the boss disappears
//   No damage   - your car can't be hurt (crashes, claws, fireballs...)
//   Free build  - unlimited parts, everything unlocked, free upgrades, and
//                 pick any chassis. Nothing you do in it is saved: switch it
//                 off and your real build and progress come back.
// The switches are remembered between visits.
import { SETTINGS } from '../settings.js';

const KEY = 'helldrive.dev';

// Read the remembered switches. Called first thing, before anything spawns.
export function loadDevSettings() {
  try { Object.assign(SETTINGS.dev, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* ignore */ }
  SETTINGS.build.unlimitedParts = SETTINGS.dev.creative;
}

export class DevPanel {
  constructor({ onChange, onTier, onRegion, regions = [], current = null }) {
    this.onChange = onChange; // (which) => void
    this.onTier = onTier;     // (tierIndex) => void
    this.onRegion = onRegion; // (regionId) => void
    loadDevSettings();

    const el = document.createElement('div');
    el.id = 'devpanel';
    el.innerHTML = `
      <div class="d-title">🛠️ DEV / CREATIVE <small>C to close</small></div>
      <label><input type="checkbox" data-k="noEnemies"> No enemies <small>(no demons, no boss)</small></label>
      <label><input type="checkbox" data-k="noDamage"> No damage <small>(invincible car)</small></label>
      <label><input type="checkbox" data-k="creative"> Free build <small>(unlimited parts, all unlocked, not saved)</small></label>
      <div class="d-tiers"><span>Chassis:</span>${SETTINGS.chassisTiers.map((t, i) => `<button data-tier="${i}">${t.name}</button>`).join('')}</div>
      <div class="d-regions"><span>Go to region:</span>${regions.map((r) => `<button data-region="${r.id}" ${r.id === current ? 'class="here"' : ''}>${r.name}</button>`).join('')}</div>`;
    document.body.appendChild(el);
    this.el = el;
    this.badge = document.createElement('div');
    this.badge.id = 'devbadge';
    document.body.appendChild(this.badge);

    el.addEventListener('change', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      SETTINGS.dev[k] = e.target.checked;
      if (k === 'creative') SETTINGS.build.unlimitedParts = e.target.checked;
      try { localStorage.setItem(KEY, JSON.stringify(SETTINGS.dev)); } catch { /* ignore */ }
      this.#refresh();
      this.onChange(k);
      e.target.blur(); // so keys (WASD) go back to driving
    });
    el.addEventListener('click', (e) => {
      const t = e.target.dataset?.tier;
      if (t != null) this.onTier(Number(t));
      const r = e.target.dataset?.region;
      if (r) this.onRegion?.(r);
    });
    this.#refresh();
  }

  get open() { return this.el.classList.contains('on'); }
  toggle() { this.el.classList.toggle('on'); this.#refresh(); }

  #refresh() {
    const D = SETTINGS.dev;
    this.el.querySelectorAll('input[data-k]').forEach((i) => { i.checked = !!D[i.dataset.k]; });
    this.el.querySelector('.d-tiers').style.display = D.creative ? 'flex' : 'none';
    const on = [D.noEnemies && 'NO ENEMIES', D.noDamage && 'NO DAMAGE', D.creative && 'FREE BUILD'].filter(Boolean);
    this.badge.textContent = on.length ? `DEV: ${on.join(' · ')}  (C)` : '';
    this.badge.style.display = on.length ? 'block' : 'none';
  }
}
