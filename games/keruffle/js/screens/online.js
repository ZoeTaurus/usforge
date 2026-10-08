'use strict';
// ---------------------------------------------------------------------------
// Online: the lobby where you wait for an opponent, the online fight
// (lockstep, see net.js) and the online results with rematch.
// ---------------------------------------------------------------------------

class OnlineLobbyScreen {
  constructor(s) {
    this.s = s;
    s.mine = s.mine || { char: s.p1.char, pal: s.p1.pal };
    this.t = 0;
    this.state = 'connecting'; // connecting | unavailable | searching | joining | handshake | go
    this.match = null;
    this.pup = new Puppet(s.mine.char, s.mine.pal);
    this.pup.play('idle', 0);
    this.opp = null;
    this.parts = new Particles();
  }
  enter() {
    Sound.playSong('select');
    Net.connect().then((room) => {
      if (this.gone) return;
      if (!room) this.state = 'unavailable';
      else this.search();
    });
  }
  touchMode() {
    return 'menu';
  }

  search() {
    this.state = 'searching';
    this.searchT = 0;
    this.match = null;
    this.opp = null;
    Net.setLobby({ v: NET_PROTO, st: 'search', ts: Date.now(), want: null, ch: this.s.mine.char });
  }

  async matched(partner) {
    this.state = 'joining';
    this.partner = partner.peer;
    this.myTs = Net.lobby.ts;
    Net.setLobby(Object.assign({}, Net.lobby, { st: 'match', want: partner.peer, wts: partner.presence.kf.ts }));
    const m = await NetMatch.open(partner);
    if (this.gone) {
      m.bye();
      return;
    }
    this.match = m;
    m.hello(this.s.mine.char, this.s.mine.pal);
    this.state = 'handshake';
    this.hsT = 0;
    Sound.sfx('select');
  }

  begin(setup) {
    this.state = 'go';
    const s = this.s;
    s.online = { match: this.match, setup };
    s.p1 = { char: setup.p1.ch, pal: setup.p1.pal };
    s.p2 = { char: setup.p2.ch, pal: setup.p2.pal };
    s.stage = setup.stage;
    Game.go(() => new VersusScreen(s));
  }

  cancel() {
    this.gone = true;
    if (this.match) this.match.bye();
    Net.clearLobby();
    Sound.sfx('menuBack');
    Flow.title();
  }

  update() {
    this.t++;
    this.pup.update();
    if (this.opp) this.opp.update();
    this.parts.update();
    if (this.state === 'go') return;
    const m = Input.menu(-1);
    if (m.back || (this.state === 'unavailable' && (m.ok || Input.tapped()))) {
      this.cancel();
      return;
    }
    if (this.state === 'searching') {
      this.searchT++;
      const partner = Net.searchTick();
      if (partner) this.matched(partner);
    } else if (this.state === 'handshake') {
      this.hsT++;
      const th = this.match.theirs();
      if (th && th.hello && !this.opp && CHARS[th.hello.ch]) {
        this.opp = new Puppet(th.hello.ch, U.clamp(th.hello.pal | 0, 0, 2));
        this.opp.play('intro', 0);
        this.burst();
      }
      const setup = this.match.tick(false);
      if (setup) this.begin(setup);
      else if (this.match.left || this.hsT > 60 * 15 || (this.hsT % 15 === 0 && !this.match.sid && Net.jilted(this.partner, this.myTs))) {
        // they went away before the fight: keep looking
        this.match.bye();
        this.search();
      }
    }
  }

  burst() {
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const sp = 4 + Math.random() * 8;
      this.parts.add({ type: Math.random() < 0.5 ? 'star' : 'shard', x: 1000, y: 380, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 0.25, drag: 0.98, size: 7 + Math.random() * 7, life: 60 + Math.random() * 30, color: U.choose(UI.colors), rot: Math.random() * TAU, vr: 0.2 });
    }
  }

  render(ctx) {
    const t = this.t;
    UI.stripes(ctx, t, '#1f2a55', '#24306a', 64, 0.5);
    UI.dots(ctx, '#7fe3ff', 0.06, 26, t);
    UI.header(ctx, 'ONLINE MATCH', 62, t, '#36d6c3', 46);
    if (this.state !== 'unavailable') this.drawFighters(ctx, t);
    this.drawStatus(ctx, t);
    this.parts.draw(ctx, 0, 0, 0);
    this.parts.draw(ctx, 0, 0, 1);
  }

  drawFighters(ctx, t) {
    // you
    const C = CHARS[this.s.mine.char];
    Draw.ellipse(ctx, 280, 560, 150, 30, 0, U.shade(C.color, -0.35), 5);
    Draw.ellipse(ctx, 280, 554, 150, 30, 0, C.color, 5);
    this.pup.draw(ctx, 280, 556, 1.32 * (C.selectScale || 1), 1);
    Draw.text(ctx, 'YOU', 280, 615, { size: 34, fill: '#ffffff', lw: 8 });
    // the opponent (or a question mark while searching)
    if (this.opp) {
      const O = CHARS[this.opp.charId] || this.opp.C;
      Draw.ellipse(ctx, 1000, 560, 150, 30, 0, U.shade(O.color, -0.35), 5);
      Draw.ellipse(ctx, 1000, 554, 150, 30, 0, O.color, 5);
      this.opp.draw(ctx, 1000, 556, 1.32 * (O.selectScale || 1), -1);
      Draw.text(ctx, 'RIVAL', 1000, 615, { size: 34, fill: '#ffd23f', lw: 8 });
    } else {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin(t * 0.08);
      Draw.text(ctx, '?', 1000, 400, { size: 200, fill: '#3c4a8c', lw: 12 });
      ctx.restore();
    }
    // VS
    Draw.star(ctx, 640, 380, 82, 52, 12, '#ff5a7a', 6, INK, t * 0.01);
    Draw.text(ctx, 'VS', 640, 384, { size: 80, fill: '#ffd23f', lw: 12 });
  }

  drawStatus(ctx, t) {
    const dots = '.'.repeat(1 + (Math.floor(t / 20) % 3));
    let line = '', sub = '';
    if (this.state === 'connecting') line = 'CONNECTING' + dots;
    else if (this.state === 'searching' || this.state === 'joining') {
      line = 'SEARCHING FOR AN OPPONENT' + dots;
      const all = Net.lobbyPeers();
      const n = all.length, waiting = all.filter((p) => p.presence.kf.st === 'search').length;
      sub = n <= 1 ? 'Nobody else is here yet. Share the game with a friend so they can join!' : n + ' players online  •  ' + waiting + ' looking for a match';
    } else if (this.state === 'handshake') {
      line = 'OPPONENT FOUND!';
      sub = 'Getting ready' + dots;
    } else if (this.state === 'go') line = "LET'S GO!";
    if (this.state === 'unavailable') {
      UI.panel(ctx, 250, 170, 780, 330, '#2a1b44');
      Draw.text(ctx, "ONLINE PLAY ISN'T AVAILABLE HERE", 640, 214, { size: 30, fill: '#ffd23f', lw: 7 });
      const lines = [
        'Online matches work on the published game page,',
        'opened while you are signed in to Claude.',
        '',
        'Your opponent needs access too: share the game with',
        'them from the Share menu (a public link cannot connect).',
        'Then both of you press ONLINE MATCH at the same time.',
      ];
      lines.forEach((l, i) => Draw.text(ctx, l, 640, 268 + i * 34, { size: 21, font: FONT_UI, fill: '#efe6ff', lw: 0, weight: 600 }));
      UI.hint(ctx, 'J / K / ESC: back', 704, 'TAP TO GO BACK');
    } else {
      Draw.text(ctx, line, 640, 168, { size: 40, fill: '#ffffff', lw: 9 });
      if (sub) Draw.text(ctx, sub, 640, 214, { size: 20, font: FONT_UI, fill: '#cbe6ff', lw: 5, weight: 600 });
      if (this.state === 'searching') {
        const sec = Math.floor(this.searchT / 60);
        Draw.text(ctx, Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'), 640, 470, { size: 30, fill: '#7fe3ff', lw: 6 });
      }
      UI.hint(ctx, 'K / ESC: cancel', 704, 'TAP BACK TO CANCEL');
    }
  }
}

// ---------------------------------------------------------------------------
// The online fight. Both games simulate the same frames in lockstep: local
// presses are recorded `delay` frames ahead and sent, and frame n runs once
// the opponent's press for frame n is here.
class OnlineBattleScreen {
  constructor(s) {
    this.s = s;
    this.match = s.online.match;
    const setup = (this.setup = s.online.setup);
    this.side = this.match.isHost ? 0 : 1;
    this.sid = setup.sid;
    this.D = setup.delay;
    this.local = [];
    this.remote = [];
    for (let i = 0; i < this.D; i++) this.local[i] = this.remote[i] = 0;
    this.remoteTop = this.D - 1;
    this.sim = 0;
    this.t = 0;
    this.stall = 0;
    this.myCk = new Map();
    this.desync = false;
    this.menu = null;
    this.oppLeft = false;
    this.endT = 0;
    this.rng = Det.rng(setup.seed);
    const ctrl = (side) => ({ get: () => (side === this.side ? this.local : this.remote)[this.sim] | 0 });
    Det.run(this.rng, () => {
      this.b = new Battle({
        p1: { char: setup.p1.ch, pal: setup.p1.pal, ctrl: ctrl(0) },
        p2: { char: setup.p2.ch, pal: setup.p2.pal, ctrl: ctrl(1) },
        stage: setup.stage,
        time: setup.time,
        roundsToWin: setup.rounds,
        shake: Game.settings.shake,
      });
    });
  }
  enter() {
    Sound.playSong(this.b.stage.music || 'rooftop');
  }
  exit() {
    Sound.duck(false);
  }
  touchMode() {
    return this.menu ? 'menu' : 'battle';
  }

  localMask() {
    if (this.menu || this.oppLeft) return 0;
    if (OnlineBattleScreen.autoplay !== undefined) {
      this.ai = this.ai || new AIController(OnlineBattleScreen.autoplay);
      return this.ai.get(this.b.fighters[this.side]) | 0;
    }
    return Input.mask(0);
  }

  hash() {
    const b = this.b;
    let s = b.timer + '|' + b.round + '|' + b.projs.length;
    for (const f of b.fighters) s += '|' + f.x.toFixed(3) + ',' + f.y.toFixed(3) + ',' + f.hp + ',' + f.meter.toFixed(2) + ',' + f.state + ',' + (f.moveId || '') + ',' + f.mf + ',' + f.wins;
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h;
  }

  receive() {
    const th = this.match.theirs();
    if (th && th.in && th.in[0] === this.sid) {
      const a = th.in, start = a[1];
      for (let i = 2; i < a.length; i++) {
        const f = start + i - 2;
        if (this.remote[f] === undefined) this.remote[f] = a[i] | 0;
      }
      this.remoteTop = Math.max(this.remoteTop, start + a.length - 3);
    }
    if (th && th.ck && th.ck[0] === this.sid) {
      const mine = this.myCk.get(th.ck[1]);
      if (mine !== undefined && mine !== th.ck[2]) this.desync = true;
    }
  }

  publish(force) {
    const top = this.local.length - 1;
    if (top === this.sentTop && !force) return;
    this.sentTop = top;
    const start = Math.max(0, top - 89);
    if (this.ckOut) this.match.mine.ck = this.ckOut;
    this.match.sendInputs(start, this.local.slice(start, top + 1));
  }

  step() {
    Det.run(this.rng, () => this.b.update());
    this.sim++;
    if (this.sim % 60 === 0) {
      const h = this.hash();
      this.myCk.set(this.sim, h);
      if (this.myCk.size > 20) this.myCk.delete(this.myCk.keys().next().value);
      this.ckOut = [this.sid, this.sim, h];
    }
  }

  openMenu() {
    Sound.sfx('menuOk');
    const close = () => (this.menu = null);
    this.menu = new Menu([
      { label: 'KEEP FIGHTING', action: close },
      { label: 'LEAVE MATCH', action: () => this.leave() },
    ], { y: 300, gap: 66, w: 420, h: 52, size: 26, onBack: close });
  }

  leave() {
    this.match.bye();
    Net.clearLobby();
    Flow.title();
  }

  finish(winner) {
    if (this.done) return;
    this.done = true;
    const stats = this.b.fighters.map((f) => ({ maxCombo: f.stats.maxCombo, dmg: f.stats.dmg, wins: f.wins }));
    Game.go(() => new OnlineResultsScreen(this.s, { winner, left: this.oppLeft, stats }));
  }

  update() {
    this.t++;
    this.receive();
    if (this.match.left && !this.oppLeft && !this.b.over) {
      this.oppLeft = true;
      this.endT = 0;
      Sound.sfx('fight', { vol: 0.5 });
    }
    if (this.menu) this.menu.update();
    else if (Input.pausePressed()) this.openMenu();
    if (this.done) return;
    if (this.oppLeft) {
      if (++this.endT === 150) this.finish(this.side);
      return;
    }
    // lockstep: one frame per tick, two while catching up with the opponent
    const max = this.remoteTop - this.D > this.sim + 1 ? 2 : 1;
    let steps = 0;
    while (steps < max) {
      const f = this.sim + this.D;
      if (this.local[f] === undefined) this.local[f] = this.localMask();
      if (this.remote[this.sim] === undefined) break;
      this.step();
      steps++;
    }
    this.stall = steps ? 0 : this.stall + 1;
    this.publish(this.t % 20 === 0);
    if (this.stall > 60 * 15) {
      this.oppLeft = true; // nothing for 15 s: they're gone
      this.endT = 0;
    }
    if (this.b.phase === 'over' && !this.jingle) {
      this.jingle = true;
      Sound.playSong('victory');
    }
    if (this.b.over) this.finish(this.b.winner ? this.b.winner.side : 0);
  }

  render(ctx) {
    this.b.render(ctx);
    // which one is you
    const x = this.side === 0 ? 66 : 1214;
    Draw.roundRect(ctx, x - 30, 146, 60, 24, 12, '#36d6c3', 3);
    Draw.text(ctx, 'YOU', x, 158, { size: 17, fill: '#ffffff', lw: 4 });
    Draw.text(ctx, 'ONLINE  •  ' + this.setup.rtt + ' ms', 640, 706, { size: 15, font: FONT_UI, fill: '#ffffff', lw: 4, weight: 600, alpha: 0.75 });
    if (this.desync) Draw.text(ctx, 'OUT OF SYNC', 640, 686, { size: 16, fill: '#ff8a9a', lw: 4 });
    if (this.stall > 30 && !this.oppLeft) {
      ctx.fillStyle = 'rgba(16,8,30,0.45)';
      ctx.fillRect(0, 0, 1280, 720);
      Draw.text(ctx, 'WAITING FOR OPPONENT' + '.'.repeat(1 + (Math.floor(this.t / 20) % 3)), 640, 360, { size: 40, fill: '#ffffff', lw: 9 });
    }
    if (this.oppLeft) {
      ctx.fillStyle = 'rgba(16,8,30,0.6)';
      ctx.fillRect(0, 0, 1280, 720);
      Draw.text(ctx, 'YOUR OPPONENT LEFT', 640, 320, { size: 56, fill: '#ffd23f', lw: 11 });
      Draw.text(ctx, 'You win this one!', 640, 384, { size: 26, font: FONT_UI, fill: '#ffffff', lw: 6, weight: 700 });
    }
    if (this.menu) {
      ctx.fillStyle = 'rgba(16,8,30,0.6)';
      ctx.fillRect(0, 0, 1280, 720);
      UI.header(ctx, 'ONLINE MATCH', 200, this.t, '#36d6c3', 44);
      Draw.text(ctx, 'The fight keeps going while this is open!', 640, 262, { size: 20, font: FONT_UI, fill: '#ffd23f', lw: 5, weight: 700 });
      this.menu.draw(ctx);
    }
  }
}

// ---------------------------------------------------------------------------
class OnlineResultsScreen {
  constructor(s, r) {
    this.s = s;
    this.r = r;
    this.match = s.online.match;
    this.side = this.match.isHost ? 0 : 1;
    this.t = 0;
    this.won = r.winner === this.side;
    // your own fighter, cheering or sulking
    const wp = this.side === 0 ? s.p1 : s.p2;
    this.C = CHARS[wp.char];
    this.pup = new Puppet(wp.char, wp.pal);
    this.pup.play(this.won ? 'win' : 'lose', 0);
    this.parts = new Particles();
    this.waiting = false;
    this.menu = new Menu([
      { label: 'REMATCH', action: () => this.rematch() },
      { label: 'NEW OPPONENT', action: () => this.newOpponent() },
      { label: 'MAIN MENU', action: () => this.quit() },
    ], { x: 920, y: 430, w: 400, h: 52, gap: 66, size: 26 });
  }
  enter() {
    if (Sound.current !== 'victory') Sound.playSong(this.won ? 'victory' : 'results');
    if (this.won) for (let i = 0; i < 3; i++) setTimeout(() => this.confetti(), i * 300);
  }
  touchMode() {
    return 'menu';
  }
  confetti() {
    for (let i = 0; i < 40; i++) {
      this.parts.add({ type: 'shard', x: 100 + Math.random() * 1080, y: -20, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, grav: 0.05, drag: 0.99, size: 8 + Math.random() * 8, life: 200, color: U.choose(UI.colors), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.3 });
    }
  }
  rematch() {
    if (this.r.left || this.match.left) return;
    this.waiting = true;
    this.match.set({ rematch: this.match.sid });
  }
  newOpponent() {
    this.match.bye();
    Game.go(() => new OnlineLobbyScreen(this.s));
  }
  quit() {
    this.match.bye();
    Net.clearLobby();
    Flow.title();
  }
  update() {
    this.t++;
    this.pup.update();
    this.parts.update();
    if (this.t > 30) this.menu.update();
    if (this.left()) {
      this.waiting = false;
      return;
    }
    const setup = this.match.tick(this.waiting);
    if (setup) {
      const s = this.s;
      s.online = { match: this.match, setup };
      s.p1 = { char: setup.p1.ch, pal: setup.p1.pal };
      s.p2 = { char: setup.p2.ch, pal: setup.p2.pal };
      s.stage = setup.stage;
      Game.go(() => new VersusScreen(s));
    }
  }
  left() {
    return this.r.left || this.match.left;
  }
  render(ctx) {
    const t = this.t;
    const col = this.won ? this.C.color : '#3b3555';
    ctx.fillStyle = U.shade(col, -0.3);
    ctx.fillRect(0, 0, 1280, 720);
    ctx.save();
    ctx.globalAlpha = 0.5;
    Draw.sunburst(ctx, 330, 420, 1300, 20, t * 0.003, U.shade(col, -0.3), U.shade(col, -0.12));
    ctx.restore();
    Draw.ellipse(ctx, 330, 650, 230, 40, 0, U.shade(col, -0.5), 5);
    Draw.ellipse(ctx, 330, 642, 230, 40, 0, U.shade(col, 0.1), 5);
    const k = U.ease.back(Math.min(1, t / 20));
    this.pup.draw(ctx, 330, 642, 1.65 * (this.C.vsScale || 1) * k, 1);
    const hk = U.ease.back(U.clamp((t - 6) / 16, 0, 1));
    ctx.save();
    ctx.translate(640, 90);
    ctx.scale(hk, hk);
    ctx.rotate(-0.03);
    Draw.text(ctx, this.won ? 'YOU WIN!' : 'YOU LOSE...', 0, 0, { size: 96, fill: this.won ? '#ffd23f' : '#b8b0d8', lw: 14, extrude: 8, extrudeColor: INK });
    ctx.restore();
    const st = this.r.stats;
    if (st) {
      const me = st[this.side];
      UI.panel(ctx, 700, 200, 440, 150, 'rgba(20,10,35,0.75)', { shine: false, lw: 4 });
      Draw.text(ctx, 'ROUNDS  ' + st[this.side].wins + ' - ' + st[1 - this.side].wins, 920, 240, { size: 30, fill: '#ffffff', lw: 6 });
      Draw.text(ctx, 'MAX COMBO: ' + me.maxCombo + '     DAMAGE: ' + Math.round(me.dmg), 920, 290, { size: 22, fill: '#cbe6ff', lw: 5 });
      if (this.r.left) Draw.text(ctx, 'Your opponent left the match', 920, 326, { size: 18, font: FONT_UI, fill: '#ffd23f', lw: 4, weight: 700 });
    }
    this.menu.draw(ctx);
    let note = '';
    if (this.left()) note = 'Your opponent has left';
    else if (this.waiting) note = 'Waiting for your opponent to pick REMATCH' + '.'.repeat(1 + (Math.floor(t / 20) % 3));
    else {
      const th = this.match.theirs();
      if (th && th.rematch === this.match.sid) note = 'Your opponent wants a rematch!';
    }
    if (note) Draw.text(ctx, note, 920, 400, { size: 20, font: FONT_UI, fill: '#ffd23f', lw: 5, weight: 700 });
    this.parts.draw(ctx, 0, 0, 1);
    this.parts.draw(ctx, 0, 0, 0);
  }
}
