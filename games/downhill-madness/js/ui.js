'use strict';
// DOM menus: title, garage, pause and the "you got buried" screen.
const UI = {
  current: 'title',
  prev: 'title',

  init() {
    const $ = id => document.getElementById(id);
    this.$ = $;
    this.el = {
      title: $('title-screen'), pause: $('pause-screen'), over: $('over-screen'), garage: $('garage-screen'), trophies: $('trophy-screen'),
      mute: $('mute'), touch: $('touch'),
    };
    $('play').addEventListener('click', () => G.start());
    $('again').addEventListener('click', () => G.start());
    $('resume').addEventListener('click', () => G.pause(false));
    $('quit').addEventListener('click', () => G.toTitle());
    $('menu').addEventListener('click', () => G.toTitle());
    $('open-garage').addEventListener('click', () => this.showGarage());
    $('open-trophies').addEventListener('click', () => { Trophies.render(); this.only('trophies'); });
    $('trophy-back').addEventListener('click', () => this.back());
    $('over-garage').addEventListener('click', () => this.showGarage());
    this.el.mute.addEventListener('click', () => { Sfx.init(); this.setMute(Sfx.toggleMute()); });
    document.querySelectorAll('[data-setting]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.setting, st = Save.data.settings;
      st[k] = !st[k];
      Save.write();
      Sfx.init();
      Sfx.applySettings();
      this.syncSettings();
    }));
    document.querySelectorAll('[data-voice-style]').forEach(b => b.addEventListener('click', () => {
      Sfx.init();
      Voice.cycle();
      this.syncSettings();
    }));
    this.setMute(Sfx.muted);
    this.syncSettings();
    const how = $('how');
    if (how && Save.data.best === 0) how.open = true;
  },

  syncSettings() {
    const st = Save.data.settings;
    document.querySelectorAll('[data-setting]').forEach(b => b.setAttribute('aria-pressed', String(!!st[b.dataset.setting])));
    document.querySelectorAll('[data-voice-style]').forEach(b => {
      b.textContent = `Voice: ${Voice.style().label}`;
      b.hidden = !st.voice;
    });
    const tip = document.getElementById('voice-tip');
    if (tip) tip.hidden = !(st.voice && /Mac/i.test(navigator.platform || navigator.userAgent) && Voice.basicOnly());
  },

  setMute(m) {
    this.el.mute.textContent = m ? 'Sound off' : 'Sound on';
    this.el.mute.setAttribute('aria-pressed', String(!m));
  },

  only(which) {
    for (const k of ['title', 'pause', 'over', 'garage', 'trophies']) this.el[k].hidden = k !== which;
    this.el.touch.hidden = which !== null;
    if (which && which !== 'garage' && which !== 'trophies') this.prev = which;
    this.current = which;
  },

  profile() {
    const d = Save.data;
    return `<span><b>Rank ${d.rank}</b> ${rankName(d.rank)}</span>
      <span><b>${U.fmt(d.bank)}</b> coins</span>
      <span><b>${U.fmt(d.best)}</b> best score</span>
      <span><b>${U.fmt(d.bestDist)} m</b> furthest</span>
      <span><b>${Trophies.count()}/${TROPHIES.length}</b> trophies</span>`;
  },

  showTitle() {
    this.$('profile').innerHTML = this.profile();
    this.$('title-missions').innerHTML = Missions.html(null);
    this.only('title');
    this.$('play').focus();
  },

  showGarage() {
    Garage.render();
    this.only('garage');
  },

  back() {
    if (this.prev === 'over') { this.only('over'); this.$('over-coins').textContent = `Bank: ${U.fmt(Save.data.bank)} coins`; }
    else this.showTitle();
  },

  showPause() {
    this.$('pause-missions').innerHTML = Missions.html(G.stats);
    this.only('pause');
    this.$('resume').focus();
  },

  showOver(G, isBest) {
    const st = G.stats;
    this.$('over-title').textContent = U.pick(['BURIED!', 'AVALANCHED!', "SNOW'D UNDER!", 'FLATTENED!']);
    this.$('over-cause').textContent = G.overLine;
    const e = G.earned;
    const total = e.coins + e.dist + e.missions;
    this.$('over-coins').textContent =
      `+${U.fmt(total)} coins  ·  ${e.coins} picked up, ${e.dist} for distance, ${e.missions} from missions & trophies  ·  Bank: ${U.fmt(Save.data.bank)}`;
    const rows = [
      ['Score', U.fmt(G.score)],
      ['Distance', `${U.fmt(G.dist)} m`],
      ['Top speed', `${Math.round(G.topSpeed * CFG.KMH)} km/h`],
      ['Madness', `${G.level} · ${levelName(G.level)}`],
      ['Best trick', G.bestTrick || 'none (coward)'],
      ['Best combo', `×${st.combo}`],
      ['Tricks landed', st.tricks],
      ['Perfect landings', st.perfects],
      ['Wipeouts', G.crashes],
      ['Things bowled over', st.bowled + st.demolished],
      ['Rail time', `${st.grind.toFixed(1)}s`],
      ['Yeti Kings beaten', st.bosses],
    ];
    this.$('stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    this.$('over-missions').innerHTML = Missions.html(st);
    this.$('new-best').hidden = !isBest;
    this.only('over');
    this.$('again').focus();
  },
};
