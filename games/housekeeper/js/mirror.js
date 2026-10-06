// The mirror close-up: look at your reflection. It's you. Mostly.
// Each visit picks one wrong thing based on the day, the time, and how upset the house is.
(function () {
  const G = HS.Game;

  HS.MirrorView = {
    // Which wrong thing happens this time.
    pickMood() {
      const h = HS.Clock.hour(), d = G.day;
      if (G.chaos >= 70) return 'black';
      if (h >= 22 && d >= 3) return 'behind';
      if (d >= 6) return 'glance';
      if (d >= 4) return 'smile';
      if (d >= 2) return 'blink';
      return 'normal';
    },

    caption(mood) {
      return {
        normal: 'It\'s you. You look a little tired. Your reflection looks a little tired too. Good. That\'s how it should be.',
        blink: 'It\'s you. Your reflection blinks. You\'re pretty sure you didn\'t.',
        smile: 'Your reflection is smiling at you. You touch your mouth to check. You are not smiling.',
        glance: 'Your reflection\'s eyes keep flicking to something over your shoulder. Then back to you. Then over your shoulder.',
        behind: 'There\'s someone standing behind you in the reflection. You don\'t turn around. If you turn around, they\'ll be gone, and then they\'ll be somewhere else.',
        black: 'Your reflection\'s eyes are completely black. It looks worried. For you.',
      }[mood];
    },

    open() {
      const mood = this.pickMood();
      G.say(`<canvas class="mirror-view" width="64" height="48"></canvas><p>${this.caption(mood)}</p>`, [
        { label: 'Wave', action: () => G.say(G.day >= 4
          ? '<p>You wave. Your reflection waves back.</p><p>Then it presses its palm flat against the glass, and keeps it there, until you leave the room.</p>'
          : '<p>You wave. Your reflection waves back… about a second too late.</p>') },
        { label: 'Step away', action: () => {} },
      ], 'mirror');
      const canvas = document.querySelector('#dialog-text .mirror-view');
      if (canvas) this.animate(canvas, mood);
    },

    animate(canvas, mood) {
      const ctx = canvas.getContext('2d');
      const PAL = HS.Sprites.PAL;
      const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
      const start = performance.now();
      let nextBlink = 1.2 + Math.random() * 2;

      const frame = now => {
        if (!canvas.isConnected) return;
        const t = (now - start) / 1000;

        // Bathroom tiles behind you.
        R('#d3ecef', 0, 0, 64, 48);
        for (let x = 0; x < 64; x += 8) R('#b5dbe1', x, 0, 1, 48);
        for (let y = 0; y < 48; y += 8) R('#b5dbe1', 0, y, 64, 1);

        // Someone behind you.
        if ((mood === 'behind' && t > 1.5) || (mood === 'glance' && t > 2.5)) {
          const a = Math.min(1, (t - (mood === 'behind' ? 1.5 : 2.5)) / 1.5);
          ctx.globalAlpha = a;
          R('#1a1222', 46, 4, 12, 44); R('#1a1222', 48, 0, 8, 6);
          R('#e8e2d6', 49, 2, 6, 6); R(PAL.k, 50, 4, 1, 1); R(PAL.k, 53, 4, 1, 1);
          ctx.globalAlpha = 1;
        }

        // You (in the mirror).
        const cx = 30;
        R(PAL.o, cx - 15, 38, 30, 10); R(PAL.O, cx - 15, 44, 30, 4);           // shoulders
        R(PAL.s, cx - 3, 34, 6, 5);                                            // neck
        R(PAL.h, cx - 11, 6, 22, 8); R(PAL.h, cx - 12, 10, 3, 14); R(PAL.h, cx + 9, 10, 3, 14);
        R(PAL.s, cx - 9, 12, 18, 22); R(PAL.S, cx - 9, 31, 18, 3);              // face
        R(PAL.h, cx - 9, 11, 18, 3);                                           // fringe

        // Eyes.
        let blinking = false;
        if (mood !== 'normal' && t > nextBlink && t < nextBlink + 0.15) blinking = true;
        if (t > nextBlink + 0.15) nextBlink = t + (mood === 'blink' ? 1.5 + Math.random() : 3 + Math.random() * 3);
        if (blinking) {
          R(PAL.S, cx - 7, 20, 5, 1); R(PAL.S, cx + 2, 20, 5, 1);
        } else if (mood === 'black') {
          R(PAL.e, cx - 7, 18, 5, 4); R(PAL.e, cx + 2, 18, 5, 4);
        } else {
          R(PAL.w, cx - 7, 18, 5, 4); R(PAL.w, cx + 2, 18, 5, 4);
          let look = 0;
          if (mood === 'glance') look = Math.floor(t * 1.3) % 2 ? 2 : 0;
          if (mood === 'behind') look = 2;
          R(PAL.e, cx - 5 + look, 19, 2, 2); R(PAL.e, cx + 4 + look, 19, 2, 2);
        }

        // Mouth: a smile that grows while you watch (you aren't smiling).
        if (mood === 'smile') {
          const half = 2 + Math.min(4, Math.floor(t * 1.5));
          R('#a8384a', cx - half + 1, 28, half * 2 - 2, 1);
          R('#a8384a', cx - half, 27, 1, 1); R('#a8384a', cx + half - 1, 27, 1, 1);
          if (half >= 5) R(PAL.w, cx - half + 1, 27, half * 2 - 2, 1);
        } else {
          R('#a8384a', cx - 2, 28, 4, 1);
        }

        // Glass glare.
        R('rgba(255,255,255,.5)', 4, 3, 2, 10); R('rgba(255,255,255,.5)', 6, 3, 1, 3);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
  };
})();
