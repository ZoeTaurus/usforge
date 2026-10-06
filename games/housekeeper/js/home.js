// Home screen: an animated pixel painting of the house at night, plus the main menu.
// Cozy lit windows, a moon, fog… and someone who sometimes looks out of the attic window.
(function () {
  const W = 240, H = 135;
  let ctx = null;
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  const ENDINGS = [
    ['good', 'A Pretty Good Week', 'Survive the week.'],
    ['adopted', 'Adopted', 'Be perfect. Every single day.'],
    ['bad', 'Never Again', 'Survive the week… badly.'],
    ['replaced', 'Replaced', 'Robin said 6 AM.'],
    ['basement', 'Downstairs', 'Some notes open doors.'],
    ['evicted', 'Evicted', 'Make the house very, very upset.'],
    ['true', 'Home Again', 'Find every page. Go down on the last night.'],
  ];

  HS.Home = {
    t: 0,
    sel: 0,
    stars: [],
    panel: null,
    knockT: 25,

    init() {
      const canvas = document.getElementById('home-canvas');
      canvas.width = W;
      canvas.height = H;
      ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < 45; i++) this.stars.push({ x: Math.random() * W, y: Math.random() * 60, p: Math.random() * 6 });

      // Bind every menu button, including ones that start hidden (like Continue).
      document.querySelectorAll('#home-menu button').forEach(b => {
        b.addEventListener('mouseenter', () => { this.sel = Math.max(0, this.buttons().indexOf(b)); this.renderMenu(); });
        b.addEventListener('click', () => { this.wake(); this.activate(b.id); });
      });
      document.getElementById('home-panel').addEventListener('click', e => {
        const a = e.target.closest('[data-act]');
        if (a) this.panelAction(a.dataset.act);
      });
    },

    buttons() {
      return [...document.querySelectorAll('#home-menu button')].filter(b => !b.hidden);
    },

    show() {
      const save = HS.Save.load(), mem = HS.Save.memory();
      const cont = document.getElementById('btn-continue');
      cont.hidden = !save;
      if (save) {
        const time = save.mid ? ` · ${HS.Clock.format(save.mid.minutes)}` : '';
        cont.textContent = `Continue · Day ${(save.mid || save).day}${time}`;
      }
      document.getElementById('btn-endings').textContent = `Endings ${(mem.endings || []).length}/7`;
      document.getElementById('title-kicker').textContent = mem.runs > 0 ? 'welcome back' : 'a slightly haunted chore simulator';
      this.sel = 0;
      this.closePanel();
      this.renderMenu();
      HS.Audio.setTrack('home');
    },

    // Audio can only start after the player touches something.
    wake() {
      HS.Audio.init();
      HS.Audio.setTrack('home');
      HS.UI.updateMusicLabel();
    },

    renderMenu() {
      this.buttons().forEach((b, i) => b.classList.toggle('sel', i === this.sel));
    },

    update(dt) {
      const I = HS.Input;
      if (Object.keys(I.pressed).length) this.wake();
      if (this.panel) {
        if (I.hit('escape', 'backspace')) this.closePanel();
        else if (this.panel === 'confirm' && I.hit('enter')) this.panelAction('confirm-new');
        else if (this.panel !== 'confirm' && I.hit('enter', ' ', 'e')) this.closePanel();
      } else {
        const n = this.buttons().length;
        if (I.hit('arrowup', 'w')) { this.sel = (this.sel + n - 1) % n; this.renderMenu(); }
        if (I.hit('arrowdown', 's')) { this.sel = (this.sel + 1) % n; this.renderMenu(); }
        if (I.hit('enter', ' ', 'e')) this.activate(this.buttons()[this.sel].id);
      }
      // Every so often, very quietly, someone knocks.
      this.knockT -= dt;
      if (this.knockT <= 0) { HS.Audio.play('knockSoft'); this.knockT = 30 + Math.random() * 30; }
      this.draw(dt);
    },

    activate(id) {
      const G = HS.Game;
      switch (id) {
        case 'btn-continue': return G.continueGame();
        case 'btn-new':
          if (HS.Save.load()) return this.openPanel('confirm');
          return G.newGame();
        case 'btn-howto': return this.openPanel('howto');
        case 'btn-endings': return this.openPanel('endings');
        case 'btn-options': return this.openPanel('options');
      }
    },

    openPanel(kind) {
      this.panel = kind;
      const el = document.getElementById('home-panel');
      const back = '<div class="panel-buttons"><button data-act="close">Back <kbd>Esc</kbd></button></div>';
      const mem = HS.Save.memory(), got = mem.endings || [];
      let html = '';
      if (kind === 'howto') {
        html = `<h2>How to play</h2>
          <ul>
            <li><kbd>WASD</kbd> move · <kbd>E</kbd> interact · <kbd>1</kbd><kbd>2</kbd> choose · <kbd>Esc</kbd> pause · <kbd>M</kbd> music</li>
            <li>Nothing to do? <b>Hold <kbd>F</kbd></b> to fast-forward time. The house will usually find you something to do.</li>
            <li>Robin's rules are on the <b>fridge</b>. New ones appear every morning. Read them.</li>
            <li>Rules are pinned on the right side of the screen. Usually they're correct. <b>The fridge is always correct.</b></li>
            <li>Breaking rules upsets the house. If the house gets too upset… well.</li>
            <li>Texts from <b>Robin</b> are real. Texts from anyone else are not.</li>
            <li>There are torn pages hidden around the house. Something sparkles where one is hidden.</li>
            <li>The game saves automatically every in-game hour, when you pause, and when you close it. <b>Continue</b> picks up right where you left off.</li>
            <li class="dim">This game has a few jumpscares. You can turn them off in Options.</li>
          </ul>${back}`;
      } else if (kind === 'endings') {
        html = `<h2>Endings ${got.length}/7</h2><ul class="endings">${ENDINGS.map(([id, name, hint]) => got.includes(id)
          ? `<li class="got"><span>★</span><b>${name}</b></li>`
          : `<li><span>?</span><b>???</b> <i>${hint}</i></li>`).join('')}</ul>${back}`;
      } else if (kind === 'options') {
        const save = HS.Save.load();
        html = `<h2>Options</h2>
          <div class="panel-buttons column">
            <button data-act="music">Music: ${HS.Audio.music.on ? 'on' : 'off'}</button>
            <button data-act="scares">Jumpscares: ${HS.Scare.enabled() ? 'on' : 'off'}</button>
            ${save ? `<button data-act="erase">Erase save (Day ${save.day})</button>` : ''}
            ${mem.runs > 0 ? '<button data-act="forget">Make the house forget you</button>' : ''}
            <button data-act="close">Back</button>
          </div>`;
      } else if (kind === 'confirm') {
        html = `<h2>Start over?</h2><p>Your Day ${(HS.Save.load().mid || HS.Save.load()).day} save will be lost.</p>
          <div class="panel-buttons"><button class="primary" data-act="confirm-new">Start over <kbd>Enter</kbd></button><button data-act="close">Cancel <kbd>Esc</kbd></button></div>`;
      } else if (kind === 'forgot') {
        html = `<h2>Done.</h2><p>The house says it has forgotten you.</p><p class="dim">It's lying. But it's trying.</p>${back}`;
      }
      el.innerHTML = html;
      el.hidden = false;
      document.getElementById('home-menu').hidden = true;
    },

    closePanel() {
      this.panel = null;
      document.getElementById('home-panel').hidden = true;
      document.getElementById('home-menu').hidden = false;
    },

    panelAction(act) {
      switch (act) {
        case 'close': return this.closePanel();
        case 'confirm-new': this.closePanel(); return HS.Game.newGame();
        case 'music': HS.UI.toggleMusic(); return this.openPanel('options');
        case 'scares': HS.Scare.setEnabled(!HS.Scare.enabled()); return this.openPanel('options');
        case 'erase': HS.Save.clear(); this.show(); return this.openPanel('options');
        case 'forget': HS.Save.forget(); this.show(); return this.openPanel('forgot');
      }
    },

    // ---------- the painting of the house ----------
    draw(dt) {
      this.t += dt;
      const t = this.t, mem = HS.Save.memory();

      // Sky, dithered between bands.
      const bands = ['#0b0818', '#110c22', '#17112d', '#1e1638', '#251b42'];
      bands.forEach((c, i) => {
        R(c, 0, i * 16, W, 16);
        if (i) for (let x = (i % 2); x < W; x += 2) R(c, x, i * 16 - 1, 1, 1);
      });
      for (const s of this.stars) if (Math.sin(t * 1.5 + s.p) > -0.3) R(Math.sin(t * 3 + s.p) > 0.8 ? '#ffffff' : '#9c8fc0', s.x, s.y, 1, 1);

      // Moon, with a cloud drifting past.
      const mx = 198, my = 22;
      for (let dy = -9; dy <= 9; dy++) {
        const half = Math.floor(Math.sqrt(81 - dy * dy));
        R('#f3ecd0', mx - half, my + dy, half * 2, 1);
      }
      R('#d8cfae', mx - 3, my - 3, 3, 2); R('#d8cfae', mx + 2, my + 2, 2, 2); R('#d8cfae', mx - 1, my + 5, 2, 1);
      const cx = ((t * 3) % (W + 60)) - 40;
      R('#2a2045', cx, 18, 26, 4); R('#2a2045', cx + 5, 15, 14, 3); R('#2a2045', cx + 3, 22, 18, 2);

      // Hills and pine trees.
      for (let x = 0; x < W; x++) R('#120d22', x, 92 + Math.round(Math.sin(x / 23) * 4 + Math.sin(x / 7) * 1.5), 1, 30);
      const pine = (x, base, hgt) => { for (let i = 0; i < hgt; i++) R('#0a0714', x - Math.floor(i / 2.4), base - hgt + i, Math.floor(i / 1.2) + 1, 1); };
      pine(20, 112, 38); pine(40, 114, 30); pine(56, 112, 22); pine(184, 112, 26); pine(206, 114, 40); pine(228, 112, 30);

      // Ground + path.
      R('#141a1b', 0, 112, W, 23);
      R('#1c2826', 0, 112, W, 1);
      for (let y = 113; y < H; y++) { const w = 10 + (y - 112) * 0.9; R('#262021', 120 - w / 2, y, w, 1); }

      // House body + siding.
      R('#2b1f35', 77, 61, 86, 52);
      R('#4a3d5c', 78, 62, 84, 50);
      for (let y = 65; y < 112; y += 4) R('#403453', 78, y, 84, 1);
      // Roof (stepped triangle) + chimney with smoke.
      for (let i = 0; i < 26; i++) R(i === 0 ? '#3d3150' : '#2b1f35', 120 - i * 1.85 - 4, 37 + i, i * 3.7 + 8, 1);
      R('#2b1f35', 142, 38, 8, 16); R('#3d3150', 142, 38, 8, 2);
      for (let i = 0; i < 6; i++) {
        const p = (t * 0.25 + i / 6) % 1;
        R(`rgba(160,150,190,${(0.35 * (1 - p)).toFixed(2)})`, 145 + Math.sin(p * 6 + i) * 3 + p * 8, 35 - p * 30, 3, 2);
      }

      // Windows: warm and cozy. Mostly.
      const flick = Math.sin(t * 0.7) > 0.97;
      const win = (x, y, lit, figure) => {
        R('#2b1f35', x - 1, y - 1, 18, 16);
        R(lit ? '#ffd257' : '#151020', x, y, 16, 14);
        if (lit) { R('#ffe9a8', x + 2, y + 2, 5, 4); R(`rgba(255,210,87,0.12)`, x - 6, 112, 28, 10); }
        if (figure) { R('#1a1222', x + 5, y + 4, 6, 4); R('#1a1222', x + 3, y + 8, 10, 6); }
        R('#2b1f35', x + 7, y, 2, 14); R('#2b1f35', x, y + 6, 16, 2);
        R('#a83a3a', x, y, 2, 14); R('#a83a3a', x + 14, y, 2, 14);
      };
      // The other you, in the left window, after you've been here before.
      const otherYou = mem.runs > 0 && Math.floor(t / 9) % 3 === 1;
      win(88, 74, true, otherYou);
      win(136, 74, !flick, false);

      // Attic window. Sometimes someone is looking out.
      R('#2b1f35', 113, 44, 14, 12);
      const watching = (t % 14) > 10.5 && (t % 14) < 13;
      R(watching ? '#ffd257' : '#3a2a20', 114, 45, 12, 10);
      if (watching) {
        R('#1a1222', 117, 47, 6, 4); R('#1a1222', 116, 51, 8, 4);
        if ((t % 14) > 12) { R('#fff6c8', 118, 48, 1, 1); R('#fff6c8', 121, 48, 1, 1); }
      }
      R('#2b1f35', 119, 45, 2, 10);

      // Front door, porch light (flickers), and steps.
      const hover = this.buttons()[this.sel] && this.buttons()[this.sel].id === 'btn-new' && !this.panel;
      R('#2b1f35', 113, 86, 14, 26);
      R('#6a3f22', 114, 87, 12, 25);
      if (hover) R('#0a0610', 114, 87, 3, 25); // the door opens a crack when you hover "New game"
      R('#ffd257', 123, 99, 2, 2);
      const porch = Math.random() > 0.02;
      if (porch) { R('#ffe9a8', 128, 82, 3, 3); R('rgba(255,233,168,0.10)', 108, 82, 26, 32); }
      R('#2b1f35', 110, 112, 20, 2); R('#3d3150', 108, 114, 24, 2);

      // Fence.
      for (let x = 2; x < W; x += 7) { if (x > 100 && x < 140) continue; R('#2a2232', x, 116, 2, 8); }
      R('#2a2232', 0, 118, 102, 1); R('#2a2232', 140, 118, W - 140, 1);

      // Fog drifting along the ground.
      for (let i = 0; i < 3; i++) {
        const fx = ((t * (4 + i * 2)) % (W + 120)) - 120;
        R(`rgba(170,160,210,${0.06 + i * 0.02})`, fx, 118 + i * 5, 120, 3);
        R(`rgba(170,160,210,${0.05 + i * 0.02})`, fx + 140, 120 + i * 4, 90, 2);
      }
    },
  };
})();
