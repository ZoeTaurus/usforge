'use strict';
// ---------------------------------------------------------------------------
// Flow: game modes, sessions and navigation between screens.
// ---------------------------------------------------------------------------

const MODES = {
  arcade: { label: 'ARCADE', twoPlayer: false },
  cpu: { label: 'VERSUS CPU', twoPlayer: false },
  vs: { label: 'VERSUS PLAYER', twoPlayer: true },
  training: { label: 'TRAINING', twoPlayer: false },
  online: { label: 'ONLINE MATCH', twoPlayer: false },
};

const HOME_STAGE = { jett: 'rooftop', mochi: 'candy', bruno: 'arena', volt: 'neon', kiri: 'bamboo', nana: 'teahouse' };

const Flow = {
  session: null,

  title() {
    Input.twoPlayer = false;
    Game.go(() => new TitleScreen(true));
  },

  start(mode) {
    this.session = { mode, p1: null, p2: null, stage: null, arcade: null };
    Input.twoPlayer = MODES[mode].twoPlayer;
    Game.go(() => new SelectScreen(this.session));
  },

  toSelect() {
    const s = this.session;
    Input.twoPlayer = MODES[s.mode].twoPlayer;
    s.p1 = s.mode === 'vs' ? null : s.p1;
    Game.go(() => new SelectScreen(s));
  },

  charsChosen() {
    const s = this.session;
    if (s.mode === 'arcade') {
      this.arcadeBegin();
      return;
    }
    if (s.mode === 'online') {
      s.mine = { char: s.p1.char, pal: s.p1.pal };
      Game.go(() => new OnlineLobbyScreen(s));
      return;
    }
    Game.go(() => new StageSelectScreen(s));
  },

  stageChosen(stageId) {
    this.session.stage = stageId;
    this.versus();
  },

  versus() {
    const s = this.session;
    if (s.mode === 'training') {
      Game.go(() => new BattleScreen(s));
      return;
    }
    Game.go(() => new VersusScreen(s));
  },

  makeControllers(s) {
    const human = (p) => ({ get: () => Input.mask(p) });
    const c1 = human(0);
    let c2;
    if (s.mode === 'vs') c2 = human(1);
    else if (s.mode === 'training') c2 = new DummyController(s.dummy || 'stand');
    else c2 = new AIController(s.cpuLevel !== undefined ? s.cpuLevel : Game.settings.difficulty);
    return [c1, c2];
  },

  battleOptions(s) {
    const [c1, c2] = this.makeControllers(s);
    const set = Game.settings;
    return {
      p1: { char: s.p1.char, pal: s.p1.pal, ctrl: c1 },
      p2: { char: s.p2.char, pal: s.p2.pal, ctrl: c2, palette: s.p2.palette, name: s.p2.name, hpMult: s.p2.hpMult },
      stage: s.stage,
      time: s.mode === 'training' ? 0 : set.time,
      roundsToWin: s.mode === 'arcade' ? Math.max(2, set.rounds) : set.rounds,
      training: s.mode === 'training',
      trainingOpts: s.mode === 'training' ? (s.trainingOpts = s.trainingOpts || { dummy: 'stand', meter: true }) : null,
      shake: set.shake,
    };
  },

  battleOver(battle) {
    const s = this.session;
    const w = battle.winner;
    s.lastWinner = w ? w.side : 0;
    s.lastStats = battle.fighters.map((f) => ({ maxCombo: f.stats.maxCombo, dmg: f.stats.dmg, wins: f.wins }));
    if (s.mode === 'arcade') {
      if (w && w.side === 0) {
        s.arcade.idx++;
        if (s.arcade.idx >= s.arcade.order.length) {
          Game.go(() => new EndingScreen(s));
          return;
        }
        Game.go(() => new ResultsScreen(s, { arcadeWin: true }));
      } else Game.go(() => new ContinueScreen(s));
      return;
    }
    Game.go(() => new ResultsScreen(s));
  },

  // ---- arcade ----------------------------------------------------------------
  arcadeBegin() {
    const s = this.session;
    const others = U.shuffle(CHAR_ORDER.filter((id) => id !== s.p1.char && CHARS[id] && CHARS[id].moves));
    const order = others.map((id) => ({ char: id }));
    order.push({ char: s.p1.char, boss: true });
    s.arcade = { order, idx: 0, continues: 0 };
    this.arcadeNext();
  },
  arcadeLevel(idx, total) {
    const base = Game.settings.difficulty;
    if (idx >= total - 1) return Math.min(3, base + 1);
    return U.clamp(base + Math.floor((idx - 2) / 2), 0, 3);
  },
  arcadeNext() {
    const s = this.session;
    const a = s.arcade;
    const opp = a.order[a.idx];
    const C = CHARS[opp.char];
    let pal = 0;
    if (opp.char === s.p1.char) pal = (s.p1.pal + 1) % C.palettes.length;
    s.p2 = { char: opp.char, pal };
    if (opp.boss) {
      s.p2.palette = Flow.shadowPalette(C.palettes[s.p1.pal]);
      s.p2.name = 'SHADOW ' + C.name;
      s.p2.hpMult = 1.15;
    }
    s.cpuLevel = this.arcadeLevel(a.idx, a.order.length);
    const stages = STAGE_ORDER.filter((id) => STAGES[id]);
    const home = stages.find((id) => HOME_STAGE[opp.char] === id);
    // the shadow of yourself waits on your own home stage
    const own = stages.find((id) => HOME_STAGE[s.p1.char] === id);
    s.stage = opp.boss ? own || stages[0] : home || stages[(a.idx + 1) % stages.length];
    Game.go(() => new LadderScreen(s));
  },
  shadowPalette(pal) {
    const t = Rig.tinted(pal, '#2a0f4a', 0.62, false);
    const p = Object.assign({}, t);
    p.dark = Object.assign({}, t.dark);
    p.ink = '#0d0418';
    p.dark.ink = p.ink;
    p.__id = 'shadow' + pal.__id;
    p.shadow = true;
    return p;
  },
};
