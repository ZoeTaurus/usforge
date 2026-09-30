// UsForge icons: small line drawings (24×24, drawn with the text colour) used instead of emojis, so they look
// the same on every device. UsForgeIcon('heart') → an <svg> string. In plain HTML, write <span data-icon="heart"></span>.
(() => {
  const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const dot = (x, y, r = 1.2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
  const rays = (r1, r2) => Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a); return `M${(12 + c * r1).toFixed(1)} ${(12 + s * r1).toFixed(1)}L${(12 + c * r2).toFixed(1)} ${(12 + s * r2).toFixed(1)}`; }).join('');
  // a cog: 8 flat-topped teeth around a ring
  const cog = () => { const pts = []; for (let k = 0; k < 8; k++) { const a = k * 45; for (const [d, r] of [[-13, 7.2], [-8, 9.6], [8, 9.6], [13, 7.2]]) { const t = (a + d) * Math.PI / 180; pts.push(`${(12 + Math.cos(t) * r).toFixed(2)} ${(12 + Math.sin(t) * r).toFixed(2)}`); } } return 'M' + pts.join('L') + 'Z'; };
  const P = {
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    heartFill: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" fill="currentColor"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    starFill: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor"/>',
    gear: `<path d="${cog()}"/><circle cx="12" cy="12" r="3"/>`,
    sun: `<circle cx="12" cy="12" r="4"/><path d="${rays(7, 9.5)}"/>`,
    moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z"/>',
    auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4zM10 21a2.2 2.2 0 0 0 4 0"/>',
    refresh: '<path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L20 9.5M20 4.5v5h-5M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4 14.5M4 19.5v-5h5"/>',
    thumbUp: '<path d="M7 10v10H4.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM7 10l3.8-6.5c1.4 0 2.4 1.1 2.1 2.6L12.3 9h5.6a2 2 0 0 1 2 2.3l-1.2 6.9A2.2 2.2 0 0 1 16.5 20H7"/>',
    thumbDown: '<g transform="rotate(180 12 12)"><path d="M7 10v10H4.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM7 10l3.8-6.5c1.4 0 2.4 1.1 2.1 2.6L12.3 9h5.6a2 2 0 0 1 2 2.3l-1.2 6.9A2.2 2.2 0 0 1 16.5 20H7"/></g>',
    dice: `<rect x="4" y="4" width="16" height="16" rx="3.5"/>${dot(8.7, 8.7)}${dot(15.3, 15.3)}${dot(15.3, 8.7)}${dot(8.7, 15.3)}${dot(12, 12)}`,
    chat: '<path d="M4.5 5h15v11h-9l-6 4.5z"/>',
    gamepad: `<rect x="2.5" y="7.5" width="19" height="10" rx="5"/><path d="M8 10.5v4M6 12.5h4"/>${dot(15.5, 11.2)}${dot(17.8, 13.6)}`,
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.8 8.2l-2.2 5.4-5.4 2.2 2.2-5.4z"/>',
    trophy: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0zM8 6.5H5.2A3 3 0 0 0 8 11M16 6.5h2.8A3 3 0 0 1 16 11M12 13.5V17M8.5 20.5h7M10 17h4v3.5h-4z"/>',
    clock: '<circle cx="12" cy="13" r="7.5"/><path d="M12 13V9.5M9.5 2.8h5M12 2.8v2.7"/>',
    flame: '<path d="M12 3c1.1 3.4 5 5.3 5 10a5 5 0 0 1-10 0c0-2.3 1.1-3.6 2.2-4.6.2 1.7 1.1 2.6 2.3 2.8C10.8 8.6 11.3 5.8 12 3z"/>',
    sparkles: '<path d="M11 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/>',
    medal: '<path d="M8 3l3 6M16 3l-3 6"/><circle cx="12" cy="15" r="5.5"/>',
    owl: `<path d="M6 20.5V11a6 6 0 0 1 12 0v9.5zM6 9.5L4.8 4.5l3.7 2.2M18 9.5l1.2-5-3.7 2.2M11 14.5h2l-1 1.5z"/><circle cx="9.3" cy="11.5" r="2"/><circle cx="14.7" cy="11.5" r="2"/>`,
    potato: `<path d="M7 6.8c3.2-3.2 9.6-2.6 11.6 1.6s.4 9.4-4.2 10.9-10.4.9-11.9-2.7S3.8 10 7 6.8z"/>${dot(9.6, 10.3, .9)}${dot(14.6, 12, .9)}${dot(11, 15.4, .9)}`,
    rocket: `<path d="M12 2.8c3.2 2.1 4.7 5.8 4.2 10.3L14.3 16H9.7l-1.9-2.9C7.3 8.6 8.8 4.9 12 2.8zM9.2 15.5l-3.2 2.3 1-4.2M14.8 15.5l3.2 2.3-1-4.2M10.5 19.5h3"/><circle cx="12" cy="9" r="1.7"/>`,
    bolt: '<path d="M13.5 2.5L4.5 14h6.5l-1 7.5 9.5-12h-6.5z"/>',
    gem: '<path d="M6.5 4h11l3.5 5-9 11.5L3 9zM3 9h18M9.5 4l2.5 5 2.5-5M12 9v11.5"/>',
    crown: '<path d="M3.5 8l4.3 4.2L12 5l4.2 7.2L20.5 8l-2 10.5h-13z"/>',
    ghost: `<path d="M5 20.5V10.5a7 7 0 0 1 14 0v10l-2.3-1.8-2.4 1.8-2.3-1.8-2.3 1.8-2.4-1.8z"/>${dot(9.5, 10.5)}${dot(14.5, 10.5)}`,
    invader: '<path d="M8 4.5l1.6 2.2h4.8L16 4.5M5 9h14v6H5zM5 15l-1.5 3.5M19 15l1.5 3.5M8 18.5h2.5M13.5 18.5H16M9 12h.01M15 12h.01"/>',
    robot: '<rect x="5" y="8" width="14" height="11.5" rx="2.5"/><path d="M12 4.5V8M9 12.8h.01M15 12.8h.01M9.5 16.2h5M2.8 12.5v3M21.2 12.5v3"/><circle cx="12" cy="3.5" r="1"/>',
    sword: '<path d="M20.5 3.5v3.6L10.8 16.8l-3.6-3.6L16.9 3.5zM5.6 11.6l6.8 6.8M8.3 15.7l-4.8 4.8"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8.2-8 9.3-4.5-1.1-8-4.3-8-9.3V6z"/>',
    planet: '<circle cx="12" cy="12" r="5.8"/><ellipse cx="12" cy="12" rx="10.5" ry="3.3" transform="rotate(-20 12 12)"/>',
    music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    brush: '<path d="M18.5 3l2.5 2.5-9.3 9.3-2.5-2.5zM9.2 12.3c-3-.2-4.4 1.8-4.4 3.8 0 1.7-1 2.7-2 3.2 3.4 1 7.5-.2 8.4-3.7"/>',
    bulb: '<path d="M9 18.5h6M10 21.5h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    pizza: `<path d="M12 21L3.3 5.8a18.5 18.5 0 0 1 17.4 0z"/>${dot(10, 9.5)}${dot(14, 10.5)}${dot(12, 14.5)}`,
    leaf: '<path d="M5 19.5C5 10.5 10 5.3 20.5 4.3c-1 10.4-6.2 15.2-15.5 15.2zM5 19.5l8.5-8.5"/>',
    cat: `<path d="M5 20.5V9.5L7.3 3.8 10.3 8h3.4l3-4.2L19 9.5v11z"/>${dot(9.5, 12.5)}${dot(14.5, 12.5)}<path d="M10.8 16h2.4"/>`,
  };
  window.UsForgeIcon = (name, cls = '') => P[name] ? `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" ${S} aria-hidden="true" focusable="false">${P[name]}</svg>` : '';
  window.UsForgeIcon.names = Object.keys(P);
  // the avatars members can pick (profiles.json stores the name)
  window.UsForgeIcon.avatars = ['gamepad', 'rocket', 'star', 'heart', 'flame', 'bolt', 'moon', 'sun', 'gem', 'crown', 'ghost', 'invader', 'robot', 'sword', 'shield', 'planet', 'music', 'brush', 'bulb', 'potato', 'pizza', 'leaf', 'cat', 'dice'];
  // fill in <span data-icon="…"> placeholders in plain HTML
  const fill = () => { for (const el of document.querySelectorAll('[data-icon]:empty')) el.innerHTML = window.UsForgeIcon(el.dataset.icon); };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', fill) : fill();
  window.UsForgeIcon.fill = fill;
})();
