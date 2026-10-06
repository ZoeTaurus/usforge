// DOM UI: HUD, screens, dialogs, phone messages, rule panels.
(function () {
  const $ = id => document.getElementById(id);
  const ICON = { pending: '□', done: '✔', broken: '✖', missed: '–', quiet: '·' };
  const HOLD = { bag: 'trash bag', note: 'strange note', towel: 'towel' };
  const MOODS = [[20, 'Cozy'], [40, 'Fine'], [60, 'Uneasy'], [80, 'Upset'], [101, 'FURIOUS']];
  const SCREENS = ['title-screen', 'card-screen', 'report-screen', 'ending-screen', 'pause-screen'];
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const T = s => HS.T(s);

  HS.UI = {
    queue: [],
    current: null,
    el: {},

    init() {
      HS.I18n.translatePage();
      document.querySelectorAll('[id]').forEach(n => { this.el[n.id] = n; });
      const G = HS.Game, el = this.el;
      el['btn-start'].onclick = () => G.startDay();
      el['btn-next'].onclick = () => G.showDayCard();
      el['btn-retry'].onclick = () => G.retryDay();
      el['btn-title'].onclick = () => this.showTitle();
      el['btn-resume'].onclick = () => this.togglePause(false);
      el['btn-quit'].onclick = () => { HS.Game.persist(); this.togglePause(false); this.showTitle(); };
      el['music-btn'].onclick = () => this.toggleMusic();
      el['btn-music2'].onclick = () => this.toggleMusic();
      this.showTitle();
    },

    // ---------- screens ----------
    showScreen(id) {
      SCREENS.forEach(s => { this.el[s].hidden = s !== id; });
    },

    showTitle() {
      HS.Game.phase = 'title';
      this.clearDialogs();
      this.setPrompt(null);
      this.setSleep(false);
      this.showScreen('title-screen');
      HS.Home.show();
    },

    showDayCard({ day, fresh, changed, chaos, pages }) {
      this.el['card-day'].textContent = T(`DAY ${day}`);
      this.el['card-name'].textContent = T(HS.DAY_NAMES[day]);
      let html = '';
      if (day === 1) html += '<p>Read the rules on the fridge. Follow them. How hard can it be?</p>';
      if (fresh.length) html += `<p class="label">New rules</p><ul>${fresh.map(s => `<li>+ ${s}</li>`).join('')}</ul>`;
      if (changed.length) html += `<p class="label">Changed</p><ul>${changed.map(s => `<li>~ ${s}</li>`).join('')}</ul>`;
      if (day === 7) html += '<p>Robin comes home at <b>6 AM</b>. Survive one more night.</p>';
      if (day > 1) html += `<p class="dim">House mood: ${MOODS.find(([m]) => chaos < m)[1]} · Pages found: ${pages}/7</p>`;
      this.el['card-body'].innerHTML = T(html);
      this.showScreen('card-screen');
    },

    startDay() {
      this.showScreen(null);
      this.clearDialogs();
      this.el['phone-msgs'].innerHTML = '';
      this.setSleep(false);
      this.renderRules();
    },

    showReport({ day, stars: n, msg, list, pages, chaos }) {
      this.clearDialogs();
      this.setPrompt(null);
      this.setSleep(false);
      this.el['report-title'].textContent = T(`Day ${day} complete`);
      this.el['report-stars'].textContent = stars(n);
      this.el['report-msg'].textContent = T(msg);
      this.el['report-list'].innerHTML = list.map(([st, label]) => `<li class="${st}"><span>${ICON[st]}</span>${T(label)}${st === 'quiet' ? ` <i>${T('(didn\'t happen)')}</i>` : ''}</li>`).join('');
      this.el['report-extra'].textContent = T(`Pages found: ${pages}/7 · House mood overnight: ${MOODS.find(([m]) => chaos < m)[1]}`);
      this.showScreen('report-screen');
    },

    showEnding(e) {
      this.clearDialogs();
      this.setPrompt(null);
      this.setSleep(false);
      this.el['end-kicker'].textContent = T(e.kicker);
      this.el['end-title'].textContent = T(e.title);
      this.el['end-body'].innerHTML = T(e.body);
      this.el['end-msg'].textContent = T(e.msg);
      this.el['end-stats'].textContent = T(e.stats);
      this.el['end-hint'].textContent = T(e.hint || '');
      this.el['btn-retry'].hidden = !e.retry;
      this.showScreen('ending-screen');
    },

    togglePause(on = !HS.Game.paused) {
      if (on) HS.Game.persist(true);
      HS.Game.paused = on;
      this.el['pause-screen'].hidden = !on;
      this.updateMusicLabel();
    },

    toggleMusic() {
      HS.Audio.init();
      HS.Audio.toggleMusic();
      this.updateMusicLabel();
    },

    updateMusicLabel() {
      const on = HS.Audio.music.on;
      this.el['music-btn'].textContent = T(on ? '♪ ON' : '♪ OFF');
      this.el['btn-music2'].textContent = T(on ? 'Music: on' : 'Music: off');
    },

    // ---------- dialogs ----------
    isBlocking() {
      return !!this.current;
    },

    dialog(html, choices = null, style = '') {
      this.queue.push({ html, choices, style });
      if (HS.Game.sleeping) { HS.Game.sleeping = false; this.setSleep(false); }
      if (!this.current) this.next();
    },

    next() {
      this.current = this.queue.shift() || null;
      if (!this.current) { this.el.dialog.hidden = true; return; }
      const { html, choices, style } = this.current;
      this.el['dialog-box'].className = 'dialog-box ' + style;
      this.el['dialog-text'].innerHTML = T(html);
      this.corrupt();
      const wrap = this.el['dialog-choices'];
      wrap.innerHTML = '';
      (choices || [{ label: 'Continue' }]).forEach((c, i) => {
        const b = document.createElement('button');
        b.innerHTML = `<kbd>${choices ? i + 1 : 'E'}</kbd> ${T(c.label)}`;
        b.onclick = () => this.choose(i);
        wrap.appendChild(b);
      });
      this.el.dialog.hidden = false;
    },

    // Late at night (and when the house is upset), a word in the dialog briefly becomes something else.
    corrupt() {
      const G = HS.Game, h = HS.Clock.hour();
      if (G.phase !== 'play' || h < 22 || (G.day < 5 && G.chaos < 40) || Math.random() > 0.3) return;
      const walker = document.createTreeWalker(this.el['dialog-text'], NodeFilter.SHOW_TEXT);
      const nodes = [];
      const WORD = /[\u4e00-\u9fff]{2,4}|[A-Za-zÀ-ÿ]{4,}/g;
      while (walker.nextNode()) if (walker.currentNode.nodeValue.match(WORD)) nodes.push(walker.currentNode);
      if (!nodes.length) return;
      const node = nodes[Math.floor(Math.random() * nodes.length)];
      const words = [...node.nodeValue.matchAll(WORD)];
      const w = words[Math.floor(Math.random() * words.length)];
      const span = document.createElement('span');
      span.className = 'corrupt';
      span.textContent = T(['BEHIND YOU', 'LET ME IN', 'STAY', 'MINE', 'I SEE YOU', 'DON\'T LOOK', 'HELLO'][Math.floor(Math.random() * 7)]);
      const after = node.splitText(w.index);
      after.nodeValue = after.nodeValue.slice(w[0].length);
      node.parentNode.insertBefore(span, after);
      setTimeout(() => { span.textContent = w[0]; span.className = ''; }, 420);
    },

    choose(i) {
      const c = this.current;
      if (!c) return;
      const ch = c.choices ? c.choices[i] : null;
      if (c.choices && !ch) return;
      this.current = null;
      if (ch && ch.action) ch.action();
      if (!this.current) this.next();
    },

    clearDialogs() {
      this.queue = [];
      this.current = null;
      this.el.dialog.hidden = true;
    },

    handleKeys() {
      const I = HS.Input;
      if (!this.current) return;
      const list = this.current.choices;
      if (list) {
        for (let i = 0; i < list.length; i++) if (I.hit(String(i + 1))) return this.choose(i);
      } else if (I.hit('e', ' ', 'enter')) {
        this.choose(0);
      }
    },

    // ---------- phone + panels ----------
    text(from, msg, who, time) {
      const box = this.el['phone-msgs'];
      const div = document.createElement('div');
      div.className = 'msg ' + ({ R: 'robin', F: 'fake', H: 'sys', U: 'unknown' }[who] || '');
      div.innerHTML = `<div class="from">${T(from)}<span>${time || HS.Clock.format()}</span></div><div class="body">${T(msg)}</div>`;
      box.prepend(div);
      while (box.children.length > 6) box.lastChild.remove();
      HS.Audio.play('chime');
      return div;
    },

    renderRules() {
      const G = HS.Game, RB = HS.Rulebook, d = G.day;
      const U = HS.Uncanny;
      const label = id => T((U && U.ruleLabel(id, d)) || RB.defs[id].short(d));
      const item = (id, label) => {
        const def = RB.defs[id], prog = def.progress && RB.status[id] === 'pending' ? ` <b>(${def.progress(RB.st[id])})</b>` : '';
        return `<li class="${RB.status[id]}"><span class="ico">${ICON[RB.status[id]]}</span><span>${label}${prog}</span></li>`;
      };
      let html;
      if (G.noteRead) {
        html = `<ol>${RB.rules().map(id => item(id, label(id))).join('')}</ol>`;
      } else {
        const known = RB.rules().filter(id => id in G.seen);
        const unknown = RB.rules().length - known.length;
        html = known.length ? `<ol>${known.map(id => item(id, label(id))).join('')}</ol>` : '';
        let hint;
        if (d === 1) hint = 'Robin left a note on the <b>fridge</b> (kitchen, top-left). Go read it!';
        else if (unknown === 1) hint = 'Robin updated the note. <b>1 new rule</b>. Read the <b>fridge</b>!';
        else if (unknown > 1) hint = `Robin updated the note. <b>${unknown} new rules</b>. Read the <b>fridge</b>!`;
        else hint = 'Robin updated the note. Read the <b>fridge</b>!';
        html += `<p class="hint">${T(hint)}</p>`;
      }
      this.el['note-body'].innerHTML = html;
      this.el['chore-list'].innerHTML = RB.chores().map(id => item(id, T(RB.defs[id].short(d)))).join('') + HS.Requests.html();
    },

    setPrompt(text) {
      const p = this.el.prompt;
      if (!text) { p.hidden = true; return; }
      p.innerHTML = `<kbd>E</kbd> ${T(text)}`;
      p.hidden = false;
    },

    setFast(on) {
      if (this.el['fast-indicator'].hidden === !on) return;
      this.el['fast-indicator'].hidden = !on;
    },

    flashSaved() {
      const el = this.el['save-indicator'];
      el.hidden = false;
      clearTimeout(this.savedTimer);
      this.savedTimer = setTimeout(() => { el.hidden = true; }, 1500);
    },

    setSleep(on) {
      this.el['sleep-overlay'].hidden = !on;
    },

    update() {
      const G = HS.Game;
      // Keep countdowns in the sidebar ticking.
      const minute = Math.floor(HS.Clock.minutes);
      if (G.phase === 'play' && minute !== this.lastMinute) { this.lastMinute = minute; this.renderRules(); }
      this.el['hud-day'].textContent = G.day;
      this.el['hud-time'].textContent = HS.Clock.format();
      // For a moment, the bar says everything is fine.
      const c = HS.Uncanny.moodLieT > 0 ? 0 : G.chaos;
      this.el['chaos-fill'].style.width = c + '%';
      this.el['chaos-fill'].style.background = c < 40 ? '#5cb85c' : c < 70 ? '#ffd257' : '#d64545';
      this.el['chaos-label'].textContent = T(MOODS.find(([max]) => c < max)[1]);
      this.el['hud-holding'].textContent = HOLD[G.holding] ? T(HOLD[G.holding]) : '—';
      this.el['hud-pages'].textContent = `${G.pages.length}/7`;
    },
  };
})();
