// UsForge in other languages. The pages are written in English; this swaps the site's own words for the chosen
// language as the page is built (and as new bits appear later, like toasts and panels). Each language's words live in
// lang/<code>.js as { "English text": "translation" }, plus a few patterns for sentences with a name or number in them.
// Games' own titles, descriptions and names are never translated, and the games themselves aren't either.
(() => {
  const KEY = 'usforge-lang';
  // the languages the site itself is translated into
  const SITE = [['en', 'English'], ['pt', 'Português'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['zh', '中文']];
  // the languages a game can say it supports (the same codes live in worker/index.js and scripts/build_list.py)
  const ALL = [['en', 'English'], ['pt', 'Português'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['nl', 'Nederlands'], ['pl', 'Polski'],
    ['ru', 'Русский'], ['uk', 'Українська'], ['tr', 'Türkçe'], ['zh', '中文'], ['ja', '日本語'], ['ko', '한국어'], ['ar', 'العربية'], ['hi', 'हिन्दी']];
  const nameOf = code => (ALL.find(l => l[0] === code) || [code, code])[1];
  const saved = (() => { try { return localStorage.getItem(KEY); } catch (e) { return null; } })();
  // first visit: follow the browser's language if the site has it
  const guess = () => { for (const l of navigator.languages || [navigator.language || 'en']) { const c = String(l).slice(0, 2).toLowerCase(); if (SITE.some(s => s[0] === c)) return c; } return 'en'; };
  const lang = SITE.some(s => s[0] === saved) ? saved : guess();
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
  if (lang !== 'en') {
    document.documentElement.dataset.i18n = 'pending';   // (the page stays hidden for a moment so it doesn't flash in English)
    const base = document.currentScript?.src || location.href;   // (lang/ sits next to this file, wherever the page is)
    document.write(`<script src="${new URL(`lang/${lang}.js?v=2`, base).href}"><\/script>`);
    setTimeout(() => { delete document.documentElement.dataset.i18n; }, 1500);   // (never stay hidden if something goes wrong)
  }

  let dict = {}, patterns = [];
  const done = new WeakMap();   // text node → the English it was translated from
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'IFRAME', 'svg', 'SVG']);
  function tr(text) {
    const t = text.trim();
    if (!t || !/[A-Za-z]/.test(t)) return null;
    if (Object.prototype.hasOwnProperty.call(dict, t)) return text.replace(t, dict[t]);
    // patterns: "{t:$1}" in a replacement means "translate that part too" (like a genre name in "Action (8)")
    for (const [re, to] of patterns) if (re.test(t)) return text.replace(t, t.replace(re, to).replace(/\{t:([^}]*)\}/g, (m, x) => Object.prototype.hasOwnProperty.call(dict, x) ? dict[x] : x));
    if (window.USF_COLLECT) window.USF_COLLECT.add(t);   // (a helper for whoever adds a language: words with no translation yet)
    return null;
  }
  function skip(el) { for (let e = el; e && e !== document.body; e = e.parentElement) if (SKIP.has(e.tagName) || e.translate === false || e.classList?.contains('notranslate')) return true; return false; }
  function node(n) {
    if (n.nodeType === 3) {
      if (done.get(n) === n.nodeValue || !n.parentElement || skip(n.parentElement)) return;
      const out = tr(n.nodeValue);
      if (out !== null && out !== n.nodeValue) { n.nodeValue = out; }
      done.set(n, n.nodeValue);
    } else if (n.nodeType === 1) {
      if (n.translate === false || n.classList?.contains('notranslate')) return;
      for (const a of ['placeholder', 'title', 'aria-label', 'alt']) {   // (text boxes keep what's typed in them, but their hint is translated)
        const v = n.getAttribute(a); if (!v) continue;
        const out = tr(v); if (out !== null) n.setAttribute(a, out);
      }
      if (SKIP.has(n.tagName)) return;
      for (const c of n.childNodes) node(c);
    }
  }
  function title() { const parts = document.title.split(' · '); const t = parts.map(p => (tr(p) ?? p)).join(' · '); if (t !== document.title) document.title = t; }
  function run() {
    dict = window.USF_DICT || {}; patterns = (window.USF_PATTERNS || []).map(([re, to]) => [new RegExp(re), to]);
    if (lang !== 'en') {
      node(document.body); title();
      new MutationObserver(list => {
        for (const m of list) {
          if (m.type === 'characterData') node(m.target);
          else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); const out = v && tr(v); if (out && out !== v) m.target.setAttribute(m.attributeName, out); }
          else for (const n of m.addedNodes) node(n);
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
      new MutationObserver(title).observe(document.querySelector('title') || document.head, { childList: true, characterData: true, subtree: true });
    }
    delete document.documentElement.dataset.i18n;
    mount();
  }

  // the language button in the menu, next to the light/dark switch
  function mount() {
    for (const spot of document.querySelectorAll('[data-theme-switch]')) {
      if (spot.querySelector('.lang-btn')) continue;
      const wrap = document.createElement('span'); wrap.className = 'lang-wrap';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lang-btn notranslate';
      b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false'); b.title = t('Language');
      b.innerHTML = `${window.UsForgeIcon?.('globe') || ''} ${lang.toUpperCase()}`;
      const menu = document.createElement('div'); menu.className = 'lang-menu'; menu.hidden = true;
      menu.innerHTML = `<b>${t('Language')}</b>` + SITE.map(([c, n]) => `<button type="button" class="notranslate" data-lang="${c}" aria-pressed="${c === lang}">${n}</button>`).join('') +
        `<p>${t('Some games are only in one language. Translating the site doesn’t change the words inside a game.')}</p>`;
      b.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; b.setAttribute('aria-expanded', String(!menu.hidden)); };
      menu.onclick = e => { const c = e.target.closest('[data-lang]')?.dataset.lang; if (c) set(c); };
      addEventListener('click', e => { if (!wrap.contains(e.target)) { menu.hidden = true; b.setAttribute('aria-expanded', 'false'); } });
      addEventListener('keydown', e => { if (e.key === 'Escape') menu.hidden = true; });
      wrap.append(b, menu);
      spot.prepend(wrap);
    }
  }
  function set(c) { try { localStorage.setItem(KEY, c); } catch (e) {} location.reload(); }
  // translate one sentence from code (for things drawn on a canvas, or text that needs to be right before it's shown)
  function t(s) { const out = Object.prototype.hasOwnProperty.call(window.USF_DICT || {}, s) ? window.USF_DICT[s] : null; return out ?? s; }

  window.UsForgeI18n = { lang, SITE, ALL, nameOf, set, t };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', run); else run();
})();
