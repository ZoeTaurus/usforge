// Live tuning panel (press T). Lets you drag the numbers from settings.js
// while driving. Changes are not saved: use "Copy settings" and paste them
// to Claude, or copy the numbers into src/settings.js yourself.
import GUI from 'lil-gui';
import { SETTINGS } from '../settings.js';

export function createTuningPanel() {
  const gui = new GUI({ title: 'Tuning (T to hide)' });
  const original = JSON.parse(JSON.stringify(SETTINGS));

  for (const [groupName, group] of Object.entries(SETTINGS)) {
    const folder = gui.addFolder(groupName);
    for (const [key, value] of Object.entries(group)) {
      if (typeof value !== 'number') continue;
      const max = value === 0 ? 1 : Math.abs(value) * 3;
      const step = max > 100 ? 10 : max > 10 ? 0.5 : 0.01;
      folder.add(group, key, 0, max, step);
    }
    folder.close();
  }

  gui.add({
    copy: () => {
      const text = 'export const SETTINGS = ' + JSON.stringify(SETTINGS, null, 2) + ';';
      navigator.clipboard?.writeText(text);
      alert('Settings copied! Paste them to Claude, or into src/settings.js.');
    },
  }, 'copy').name('📋 Copy settings');

  gui.add({
    reset: () => {
      for (const [g, group] of Object.entries(original)) Object.assign(SETTINGS[g], group);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
  }, 'reset').name('↺ Reset to file values');

  gui.hide();
  return {
    toggle() { gui._hidden ? gui.show() : gui.hide(); },
  };
}
