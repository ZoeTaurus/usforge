'use strict';
// ============================================================
//  Main loop
// ============================================================

const Game = {
  scene: null,
  save: loadSave() || newSave(),
  time: 0,
  players: 1,
  setScene(s, arg) { Toasts.clear(); this.scene = s; s.enter(arg || {}); },
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  Game.time += dt;
  if (Input.hit('m')) Sound.toggleMute();
  if (Input.hit('l')) { setLang(LANG + 1); Toasts.add(LANGS[LANG].name, '#ffe9b0', 1.5, 20); Sound.play('select'); }
  Fx.update(dt);
  Game.scene.update(dt);
  Toasts.update(dt);

  G = ctx;
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (Fx.shake > 0.3) ctx.translate(randi(-1, 1) * Math.round(Fx.shake * 0.6), randi(-1, 1) * Math.round(Fx.shake * 0.6));
  Game.scene.draw();
  ctx.restore();
  Toasts.draw();
  Fx.draw();
  Input.end();
  requestAnimationFrame(frame);
}

// autosave every so often (time of day, coins)
setInterval(() => { if (Game.save && Game.save.started && Game.scene !== MenuScene) writeSave(); }, 10000);

applyHat(Game.save.hat);
Game.setScene(MenuScene);
requestAnimationFrame(frame);
