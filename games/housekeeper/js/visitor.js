// The Visitor: from Day 3, something walks the house between 11 PM and dawn.
// Stay in the bedroom and it only wanders (and sometimes stops in your doorway to watch).
// Leave the bedroom and it hunts you, straight through the walls.
(function () {
  const G = HS.Game, hr = HS.hr, T = HS.TILE;
  const rand = (a, b) => a + Math.random() * (b - a);

  // It wanders the hallway. The bedroom doorway is where it likes to stop and look in.
  const HALL = [3, 8, 13, 18, 23, 27].map(x => ({ x: (x + 0.5) * T, y: 10 * T }));
  const DOORWAY = { x: 5.5 * T, y: 10.4 * T, watch: true };

  HS.Visitor = {
    v: null,
    stepT: 0,

    setupDay(d) {
      this.v = null;
      this.active = d >= 3;
    },

    get hunting() { return !!this.v && this.v.mode === 'hunt'; },

    update(dt, m) {
      if (!this.active) return;
      const night = m >= hr(23) + 15 && m < hr(28.8);
      // It's busy at the front door while something is knocking.
      const knocking = G.effect('knocking') || HS.Rulebook.get('night').atBedroom;
      if (!night || knocking) { if (this.v) this.v.hidden = true; if (!night) this.v = null; return; }
      if (!this.v) this.v = { x: 28 * T, y: 10 * T, target: HALL[5], mode: 'wander', wait: 0, cooldown: 0 };
      const v = this.v, P = HS.Player;
      v.hidden = false;
      if (v.cooldown > 0) { v.cooldown -= dt; return; }

      const safe = P.hidden || (G.inRoom('bedroom') && P.y > 11.6 * T);
      v.mode = safe ? 'wander' : 'hunt';

      if (v.mode === 'hunt') {
        this.moveToward(v, P, 38, dt);
        this.stepT -= dt;
        if (this.stepT <= 0) { HS.Audio.play('steps'); this.stepT = 0.7; }
        if (Math.hypot(P.x - v.x, P.y - v.y) < 9) this.caught();
        return;
      }

      // Wander: walk to a point, wait a moment, pick another. Sometimes, the doorway.
      if (v.wait > 0) { v.wait -= dt; return; }
      if (this.moveToward(v, v.target, 20, dt)) {
        v.wait = v.target.watch ? rand(4, 7) : rand(1, 3);
        v.target = Math.random() < 0.3 ? DOORWAY : HALL[Math.floor(Math.random() * HALL.length)];
      }
    },

    // Returns true on arrival.
    moveToward(v, to, speed, dt) {
      const dx = to.x - v.x, dy = to.y - v.y, d = Math.hypot(dx, dy);
      if (d < 2) return true;
      v.x += dx / d * Math.min(d, speed * dt);
      v.y += dy / d * Math.min(d, speed * dt);
      return false;
    },

    caught() {
      const v = this.v, P = HS.Player;
      v.cooldown = 30;
      v.x = 28 * T; v.y = 10 * T; v.mode = 'wander'; v.target = HALL[5];
      HS.Scare.jump(() => {
        P.reset(false);
        const night = HS.Rulebook.get('night');
        const html = '<p>It was right behind you. It was <b>always</b> right behind you.</p><p>You wake up in bed with your heart pounding. Your feet are dirty. The bedroom door is open.</p>';
        if (HS.Rulebook.status.night === 'broken') {
          G.chaos = Math.min(HS.CHAOS_MAX, G.chaos + 20);
          G.say(html, null, 'bad');
        } else {
          night.broken = true;
          G.breakRule('night', html, 25);
        }
      });
    },
  };

  // ---------- jumpscares ----------
  HS.Scare = {
    enabled() {
      try { return localStorage.getItem('housesitting-jumpscares') !== 'off'; } catch (e) { return true; }
    },
    setEnabled(on) {
      try { localStorage.setItem('housesitting-jumpscares', on ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
    },

    // A face, all at once, very close. Then whatever happens next.
    jump(after) {
      if (!this.enabled()) { HS.Audio.play('bad'); G.shake(0.8); if (after) after(); return; }
      const el = document.getElementById('jumpscare');
      const c = el.querySelector('canvas'), ctx = c.getContext('2d');
      c.width = 40; c.height = 30;
      const R = (col, x, y, w, h) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
      R('#000', 0, 0, 40, 30);
      R('#d9cfc0', 12, 2, 16, 26); R('#d9cfc0', 10, 5, 20, 20); R('#bfb3a2', 10, 20, 20, 5);
      R('#000', 13, 9, 5, 6); R('#000', 22, 9, 5, 6);
      R('#fff6c8', 15, 11, 1, 1); R('#fff6c8', 24, 11, 1, 1);
      R('#000', 17, 18, 6, 9); R('#3a0c0c', 18, 19, 4, 7);
      R('#5a2e1f', 10, 2, 20, 3); R('#5a2e1f', 9, 4, 2, 10); R('#5a2e1f', 29, 4, 2, 10);
      el.hidden = false;
      HS.Audio.play('scream');
      G.paused = true;
      setTimeout(() => {
        el.hidden = true;
        G.paused = false;
        if (after) after();
      }, 750);
    },
  };
})();
