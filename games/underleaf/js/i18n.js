'use strict';
/* Translation. The game is written in English; every piece of text the player sees is looked up
   here on its way to the screen, so the rest of the code doesn't need to know about languages.

   - Page text is translated as it appears, by watching the page for changes.
   - Text drawn on the canvas goes through the same lookup (fillText is wrapped).
   - Dictionary keys are the English text. In a key, `#` stands for any number and `{name}`
     for any words, which are translated on their own: "Shared food with # sisters",
     "You are a {species}. Find food and carry it home." In the translation, `#` (or #1, #2…)
     and `{name}` put those pieces back. */

const L10N = {
  langs: { en: 'English', pt: 'Português', es: 'Español', fr: 'Français', de: 'Deutsch', zh: '中文' },
  dict: {},
  lang: 'en',
  cache: new Map(),
  pats: null,
  missing: new Set(),

  add(code, d) { this.dict[code] = Object.assign(this.dict[code] || {}, d); this.pats = null; this.cache.clear(); },

  init() {
    let l = null;
    try { l = localStorage.getItem('underleaf-lang'); } catch (e) { /* storage may be unavailable */ }
    if (!l || !this.langs[l]) { const nav = (navigator.language || 'en').slice(0, 2).toLowerCase(); l = this.langs[nav] ? nav : 'en'; }
    this.lang = l;
    document.documentElement.lang = l;
    // canvas text
    const P = CanvasRenderingContext2D.prototype;
    for (const fn of ['fillText', 'strokeText', 'measureText']) {
      const orig = P[fn];
      P[fn] = function (t, ...rest) { return orig.call(this, L10N.lang !== 'en' && typeof t === 'string' ? L10N.tr(t) : t, ...rest); };
    }
    // page text
    this.obs = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'characterData') this.textNode(m.target);
        else if (m.type === 'attributes') this.attr(m.target, m.attributeName);
        else for (const n of m.addedNodes) this.walk(n);
      }
    });
    this.obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
    this.walk(document.body);
  },

  set(code) {
    if (!this.langs[code]) return;
    this.lang = code;
    this.cache.clear(); this.pats = null;
    document.documentElement.lang = code;
    try { localStorage.setItem('underleaf-lang', code); } catch (e) { /* ignore */ }
    this.walk(document.body);
    for (const s of document.querySelectorAll('select.langSel')) s.value = code;
    if (window.game && game.ui) { game.ui.lastNest = null; if (game.ui.renderNestPanel && game.view === 'nest') game.ui.renderNestPanel(); }
  },

  /* ------------------------------------------------------------- page */

  walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { this.textNode(root); return; }
    if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE' || root.hasAttribute('data-notr')) return;
    for (const a of ['title', 'aria-label', 'placeholder']) if (root.hasAttribute(a)) this.attr(root, a);
    for (let c = root.firstChild; c; c = c.nextSibling) this.walk(c);
  },

  textNode(n) {
    if (n.parentNode && n.parentNode.closest && n.parentNode.closest('[data-notr]')) return;
    const cur = n.nodeValue;
    const src = n.__tr !== undefined && cur === n.__tr ? n.__orig : cur;
    const out = this.tr(src);
    n.__orig = src; n.__tr = out;
    if (out !== cur) n.nodeValue = out;
  },

  attr(el, name) {
    const store = el.__trA || (el.__trA = {});
    const cur = el.getAttribute(name);
    if (cur == null) return;
    const rec = store[name];
    const src = rec && cur === rec.tr ? rec.orig : cur;
    const out = this.tr(src);
    store[name] = { orig: src, tr: out };
    if (out !== cur) el.setAttribute(name, out);
  },

  /* ----------------------------------------------------------- lookup */

  tr(s) {
    if (this.lang === 'en' || !s) return s;
    let r = this.cache.get(s);
    if (r !== undefined) return r;
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = m[2];
    if (!core || !/[A-Za-z]/.test(core)) r = s;
    else {
      const t = this.core(core, 0);
      // (Latin names and single key letters are meant to stay as they are)
      if (t == null && core.length > 1 && !/^[A-Z][a-z]+( [a-z]+)?$/.test(core)) this.missing.add(core);
      r = t == null ? s : m[1] + t + m[3];
    }
    if (this.cache.size > 8000) this.cache.clear();
    this.cache.set(s, r);
    return r;
  },

  core(s, depth) {
    const d = this.dict[this.lang] || {};
    if (d[s] !== undefined) return d[s];
    // the same thing with a capital letter, kept in lower case mid-sentence
    if (/^[a-z]/.test(s)) {
      const t = d[s[0].toUpperCase() + s.slice(1)];
      if (t !== undefined) return this.lang === 'de' ? t : t[0].toLowerCase() + t.slice(1);
    }
    if (depth > 3) return null;
    for (const p of this.patterns()) {
      const mm = s.match(p.re);
      if (!mm) continue;
      const nums = [], words = {};
      p.slots.forEach((slot, i) => {
        const v = mm[i + 1];
        if (slot === '#') nums.push(v);
        else { const t = this.core(v, depth + 1); words[slot] = t == null ? v : t; }
      });
      let i = 0;
      return p.out
        .replace(/#(\d)?/g, (all, n) => (n ? nums[+n - 1] : nums[i++]) ?? all)
        .replace(/\{(\w+)\}/g, (all, k) => words[k] ?? all);
    }
    return null;
  },

  patterns() {
    if (this.pats) return this.pats;
    const d = this.dict[this.lang] || {};
    const list = [];
    for (const key of Object.keys(d)) {
      if (!/#|\{\w+\}/.test(key)) continue;
      const slots = [];
      const src = key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/#|\{(\w+)\}/g, (all, name) => {
        slots.push(name || '#');
        return name ? '(.+?)' : '(\\d[\\d,.]*)';
      });
      list.push({ re: new RegExp('^' + src + '$'), slots, out: d[key], weight: key.replace(/#|\{\w+\}/g, '').length });
    }
    list.sort((a, b) => b.weight - a.weight);
    return (this.pats = list);
  },

  /* A language menu: <select class="langSel">. */
  picker() {
    const s = document.createElement('select');
    s.className = 'langSel'; s.setAttribute('data-notr', ''); s.setAttribute('aria-label', 'Language');
    for (const [code, name] of Object.entries(this.langs)) { const o = document.createElement('option'); o.value = code; o.textContent = name; s.appendChild(o); }
    s.value = this.lang;
    s.addEventListener('change', () => this.set(s.value));
    return s;
  },
};
