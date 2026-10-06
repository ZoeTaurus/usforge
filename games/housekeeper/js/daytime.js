// Daytime wrongness: one or two unsettling things per day, in broad daylight.
// None of these cost anything. They just make the bright, cozy house feel… off.
(function () {
  const G = HS.Game, hr = HS.hr, T = HS.TILE;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const ROOM_NAMES = { kitchen: 'kitchen', dining: 'dining room', living: 'living room', laundry: 'laundry room', study: 'study', nursery: 'nursery', sunroom: 'sunroom', backhall: 'back hallway', bath: 'bathroom' };

  // Is a rule keeping you busy right now? Then wait; never interfere with a rule.
  function busy() {
    const RB = HS.Rulebook;
    return ['on', 'watching'].includes(RB.get('tv').state) || RB.get('phone').state === 'ringing' ||
      RB.get('painting').state === 'crying' || RB.get('washer').state === 'stopped' ||
      RB.get('delivery').state === 'waiting' || RB.get('footsteps').state === 'active' ||
      RB.get('fridge').state === 'humming' || RB.get('chair').state === 'present' || HS.Player.sitting;
  }

  const EVENTS = {
    // The music stops, the light dims, and the house just… waits.
    silence: { from: 2, run(D) { HS.Audio.silence(25); D.dimT = 25; } },

    // A text from Robin, timestamped tonight. Then it deletes itself.
    future: {
      from: 3,
      run() {
        const msg = pick(['why did you let it in', 'please tell me you didn\'t open the door', 'are you still there? the house isn\'t answering', 'it\'s ok. I forgive you']);
        const el = HS.UI.text(HS.FRIEND, msg, 'R', pick(['11:48 PM', '2:13 AM', '3:33 AM', '5:59 AM']));
        setTimeout(() => { const body = el.querySelector('.body'); if (body) body.innerHTML = '<i>This message was deleted.</i>'; }, 4500);
      },
    },

    // A long shadow on the floor, like someone standing in the doorway. There's nobody there.
    shadow: {
      from: 3,
      run(D) {
        const P = HS.Player;
        const doors = [[4, 8], [14, 8], [24, 8], [5, 11], [15, 11], [24, 11], [15, 19], [22, 19], [5, 22], [14, 22], [24, 22]]
          .map(([x, y]) => ({ x: (x + 0.5) * T, y: (y + 0.5) * T }))
          .filter(d => Math.hypot(d.x - P.x, d.y - P.y) > 40)
          .sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y));
        if (!doors.length) return false;
        const d = doors[0];
        D.floorShadow = { x: d.x, y: d.y, dir: P.y > d.y ? 1 : -1, t: 8 };
      },
    },

    // A dining chair is pulled into the middle of the room, facing the door you just came through.
    chair: {
      from: 2,
      run() {
        if (G.inRoom('dining')) return false; // it only moves when you're not looking
        const c = HS.Map.byId.chair4;
        Object.assign(c, { x: 14, y: 6, flip: false, flavor: ['A chair has been pulled out into the middle of the room. It\'s facing the doorway. Facing where you just came in.'] });
      },
    },

    // You blink. Twenty minutes are gone, and you're somewhere else.
    lostTime: {
      from: 4,
      run() {
        const before = HS.Clock.format();
        const rooms = HS.Map.rooms.filter(r => ROOM_NAMES[r.id] && !G.inRoom(r.id) && r.id !== 'nursery');
        const r = pick(rooms);
        let x, y, tries = 0;
        do { x = (r.x + 1 + Math.random() * (r.w - 2)) * T; y = (r.y + 1 + Math.random() * (r.h - 2)) * T; tries++; }
        while (HS.Player.hits(x, y) && tries < 40);
        if (HS.Player.hits(x, y)) return false;
        HS.Player.x = x; HS.Player.y = y;
        HS.Clock.minutes += 20;
        if (HS.Requests.current) HS.Requests.current.until += 20;
        HS.Audio.play('static');
        G.say(`<p>You blink.</p><p>It's <b>${HS.Clock.format()}</b>. A second ago it was ${before}.</p><p>You're standing in the ${ROOM_NAMES[r.id]}. You don't remember walking here. Your hands are cold.</p>`, null, 'bad');
      },
    },

    // One knock on the front door, in the middle of the day.
    knock: {
      from: 2,
      run(D) {
        if (HS.Rulebook.get('delivery').state === 'waiting') return false;
        HS.Audio.play('knockSoft');
        G.text('H', 'Someone knocked on the front door. Just once.');
        D.shoes = true;
      },
    },

    // Something enormous walks past outside. Its shadow crosses the whole house.
    giant: { from: 5, run(D) { D.sweep = 0; HS.Audio.play('rumble'); G.shake(1.5); } },
  };

  HS.Daytime = {
    plan: [],
    dimT: 0,
    floorShadow: null,
    sweep: null,
    shoes: false,

    setupDay(d) {
      this.dimT = 0;
      this.floorShadow = null;
      this.sweep = null;
      this.shoes = false;
      const options = Object.keys(EVENTS).filter(k => EVENTS[k].from <= d);
      const count = d < 2 ? 0 : d < 4 ? 1 : 2;
      const picks = [];
      while (picks.length < count && options.length) picks.push(options.splice(Math.floor(Math.random() * options.length), 1)[0]);
      // Spread them out across the day.
      this.plan = picks.map((id, i) => ({ id, at: hr(10.5 + i * 4 + rand(0, 3.5)) }));
    },

    update(dt, m) {
      if (this.dimT > 0) this.dimT -= dt;
      if (this.floorShadow) {
        const s = this.floorShadow, P = HS.Player;
        s.t -= dt;
        if (s.t <= 0 || Math.hypot(s.x - P.x, s.y - P.y) < 26) this.floorShadow = null;
      }
      if (this.sweep !== null) { this.sweep += dt / 3.5; if (this.sweep > 1) this.sweep = null; }

      for (const ev of this.plan) {
        if (G.fired[`day-${ev.id}`] || m < ev.at || m > hr(19)) continue;
        if (busy()) { ev.at = m + 15; continue; }
        const ok = EVENTS[ev.id].run(this) !== false;
        if (ok) G.fired[`day-${ev.id}`] = true; else ev.at = m + 20;
        break;
      }
    },

    // The front door after the noon knock.
    interact(o) {
      if (o.id !== 'frontdoor' || !this.shoes) return false;
      this.shoes = false;
      G.say('<p>You open the door a crack. Nobody there. Bright, empty street.</p><p>On the doormat is a pair of shoes. Your size. Still warm, like someone just stepped out of them.</p><p>When you look up and back down, they\'re gone.</p>', null, 'bad');
      return true;
    },
  };
})();
