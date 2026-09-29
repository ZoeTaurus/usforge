'use strict';
// ============================================================
//  Rewind: rolling snapshots of the last few seconds so a
//  surprise cave-in doesn't wipe out hours of work.
// ============================================================
const REWIND_SECS = 10, SNAP_EVERY = .5, SNAP_KEEP = 13;
let snaps = [], snapT = 0, rewindFx = 0;
if (settings.rewind === undefined) settings.rewind = true;
if (settings.zoom === undefined) settings.zoom = 1;

const clone = o => JSON.parse(JSON.stringify(o));
function takeSnapshot(){
  const g = Object.assign({}, game); delete g.hint; delete g.banner;
  snaps.push({
    time: game.time,
    tiles: tiles.slice(), deco: deco.slice(),
    game: clone(g),
    P: Object.assign({}, P, { mining:null }),
    enemies: enemies.map(e => Object.assign({}, e)),       // def objects are shared on purpose
    pickups: pickups.map(p => Object.assign({}, p)),
    bombs: bombs.map(b => Object.assign({}, b)),
    caveins: caveins.map(c => Object.assign({}, c)),
    rocks: rocks.map(r => Object.assign({}, r)),
    boss: boss ? clone(boss) : null,
    fireballs: fireballs.map(f => Object.assign({}, f)),
  });
  while (snaps.length && snaps[0].time < game.time - SNAP_KEEP) snaps.shift();
}
function stepRewind(dt){
  rewindFx = Math.max(0, rewindFx - dt*1.5);
  if (!settings.rewind || game.over) return;
  snapT -= dt;
  if (snapT <= 0){ snapT = SNAP_EVERY; takeSnapshot(); }
}
function resetRewind(){ snaps = []; snapT = 0; rewindFx = 0; }
const canRewind = () => settings.rewind && snaps.length > 0 && scene === 'game';

function doRewind(){
  if (!canRewind()) return false;
  // the newest snapshot that is at least 10 s old (or the oldest one we have)
  const oldTime = game.time;
  let i = snaps.length - 1;
  while (i > 0 && snaps[i].time > game.time - REWIND_SECS) i--;
  const s = snaps[i];
  snaps = snaps.slice(0, i);                                    // rewinding again goes further back
  const keep = { stats: game.stats, runAch: game.runAch, won: game.won };
  tiles.set(s.tiles); deco.set(s.deco);
  game = Object.assign(clone(s.game), { over:false, paused:false, shopOpen:false, hint:null, banner:null, recall:null });
  game.stats = keep.stats; game.runAch = keep.runAch; game.won = keep.won;
  game.stats.rewinds = (game.stats.rewinds || 0) + 1;
  P = Object.assign({}, s.P, { iframes:2.5, hurtT:0, mining:null, kbx:0 });
  enemies = s.enemies.map(e => Object.assign({}, e));
  pickups = s.pickups.map(p => Object.assign({}, p));
  bombs = s.bombs.map(b => Object.assign({}, b));
  caveins = s.caveins.map(c => Object.assign({}, c));
  rocks = s.rocks.map(r => Object.assign({}, r));
  boss = s.boss ? clone(s.boss) : null;
  fireballs = s.fireballs.map(f => Object.assign({}, f));
  particles = []; floaters = []; mapOpen = false;
  pointer.down = false;
  snapCamera();
  hideScreens();
  rewindFx = 1;
  SFX.rewind();
  msg(`Rewound ${Math.max(1, Math.round(oldTime - s.time))} seconds. Careful now!`, '#8fd0ff', 3);
  track('rewind');
  if (game.mode === 'career') saveGame();
  return true;
}

// a VHS-style blue wash + scanlines right after rewinding
function drawRewindFx(){
  if (rewindFx <= 0) return;
  ctx.fillStyle = `rgba(90,160,255,${rewindFx*.28})`; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = `rgba(0,0,0,${rewindFx*.25})`;
  for (let y=(performance.now()/20|0) % 4; y<VH; y+=4) ctx.fillRect(0, y, VW, 1);
  if (rewindFx > .5) text('<< REWIND', 10, VH/2, '#ffffff', 12);
}
