// Translations. English is the source language: every translation file maps an English string to its translation.
//
// Text is translated where it reaches the screen (dialogs, texts, prompts, panels, menus). HTML is translated one
// "paragraph" at a time (each <p>, <li>, <h3>… with its inline <b>/<i> tags), so translators see whole sentences.
// Keys with {0}, {1}… are patterns: "It's <b>{0}</b>." matches "It's <b>3:00 PM</b>." and the captured values
// are translated too if they're known strings (like room names).
(function () {
  const LANGS = {
    en: { name: 'English', html: 'en' },
    'zh-Hans': { name: '简体中文', html: 'zh-CN' },
    'zh-Hant': { name: '繁體中文', html: 'zh-TW' },
    es: { name: 'Español', html: 'es' },
  };
  const KEY = 'housesitting-lang';
  const BLOCK = 'p,li,h1,h2,h3,div,ol,ul,section,nav,canvas,button,label';
  // Whitespace-insensitive, and `&` matches `&amp;` (HTML serializes it either way).
  const norm = s => s.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

  function detect() {
    try { const saved = localStorage.getItem(KEY); if (saved && LANGS[saved]) return saved; } catch (e) { /* storage unavailable */ }
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('zh')) return /tw|hk|mo|hant/.test(nav) ? 'zh-Hant' : 'zh-Hans';
    if (nav.startsWith('es')) return 'es';
    return 'en';
  }

  HS.I18n = {
    LANGS,
    lang: detect(),
    dicts: {},
    patterns: null,

    // Translation files call this.
    add(lang, entries) {
      const d = this.dicts[lang] || (this.dicts[lang] = {});
      for (const [k, v] of Object.entries(entries)) d[norm(k)] = v;
      this.patterns = null;
    },

    setLang(lang) {
      try { localStorage.setItem(KEY, lang); } catch (e) { /* storage unavailable */ }
      location.reload();
    },

    get dict() { return this.dicts[this.lang] || {}; },

    compilePatterns() {
      this.patterns = [];
      for (const [k, v] of Object.entries(this.dict)) {
        if (!/\{\d+\}/.test(k)) continue;
        const parts = k.split(/(\{\d+\})/);
        const order = [];
        const re = parts.map(p => {
          const m = p.match(/^\{(\d+)\}$/);
          if (m) { order.push(+m[1]); return '(.+?)'; }
          return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('');
        this.patterns.push({ re: new RegExp('^' + re + '$'), order, v });
      }
      // Longer (more specific) patterns first.
      this.patterns.sort((a, b) => b.re.source.length - a.re.source.length);
    },

    // Translate one plain string or paragraph of inline HTML. Returns null if unknown.
    lookup(s) {
      const k = norm(s);
      if (!k) return null;
      const d = this.dict;
      if (d[k] !== undefined) return d[k];
      if (!this.patterns) this.compilePatterns();
      for (const p of this.patterns) {
        const m = k.match(p.re);
        if (!m) continue;
        return p.v.replace(/\{(\d+)\}/g, (_, i) => {
          const val = m[p.order.indexOf(+i) + 1];
          return val === undefined ? '' : this.value(val);
        });
      }
      return null;
    },

    // A value captured by a pattern (a room name, a label…): translate it if we know it.
    value(v) {
      const d = this.dict, k = norm(v);
      if (d[k] !== undefined) return d[k];
      const cap = k.charAt(0).toUpperCase() + k.slice(1);
      if (d[cap] !== undefined) return d[cap];
      const inner = this.lookup(k);
      return inner !== null ? inner : v;
    },

    // Translate a string that may contain HTML.
    t(s) {
      if (this.lang === 'en' || typeof s !== 'string' || !s) return s;
      if (!/[<&]/.test(s)) { const v = this.lookup(s); return v !== null ? v : s; }
      const tpl = document.createElement('template');
      tpl.innerHTML = s;
      // A single sentence with only inline tags (<b>, <i>…) is translated as one unit.
      if (!tpl.content.querySelector(BLOCK)) {
        const v = this.lookup(tpl.innerHTML);
        if (v !== null) return v;
      }
      this.walk(tpl.content);
      return tpl.innerHTML;
    },

    walk(node) {
      for (const el of [...node.children]) {
        if (el.tagName === 'CANVAS' || el.tagName === 'SCRIPT') continue;
        if (!el.querySelector(BLOCK)) {
          const v = this.lookup(el.innerHTML);
          if (v !== null) el.innerHTML = v;
          else if (el.children.length) this.walk(el); // no whole-sentence match: try its pieces
        } else {
          this.walk(el);
        }
      }
      // Loose text sitting directly between blocks.
      for (const tn of [...node.childNodes]) {
        if (tn.nodeType !== 3 || !tn.nodeValue.trim()) continue;
        const v = this.lookup(tn.nodeValue);
        if (v === null) continue;
        const tpl = document.createElement('template');
        tpl.innerHTML = v;
        tn.replaceWith(tpl.content);
      }
    },

    // Translate the static text already in the page (menus, HUD labels, buttons).
    translatePage() {
      document.documentElement.lang = LANGS[this.lang].html;
      if (this.lang === 'en') return;
      this.walk(document.body);
      document.title = this.t(document.title);
    },
  };

  // Short helper used across the game.
  HS.T = s => HS.I18n.t(s);
})();
