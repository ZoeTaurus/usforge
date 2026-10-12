'use strict';
// ============================================================
//  CRAZY DENTIST — boot, screen scaling, main loop
// ============================================================

const stage = document.getElementById('stage');
const crt = document.getElementById('crt');
let pixelScale = 1;

function resize() {
  const cs = getComputedStyle(stage);
  const aw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const ah = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let s = Math.min(aw / W, ah / H);
  if (s >= 2) s = Math.floor(s);
  s = Math.max(0.5, s);
  pixelScale = s;
  cv.style.width = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
  applyCRT();
}
function applyCRT() {
  crt.hidden = !settings.crt || pixelScale < 2;
  crt.style.backgroundSize = `100% ${pixelScale}px`;
}
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
resize();

window.addEventListener('blur', () => { if (scene && scene.pausable && !Pause.on) { Pause.on = true; SND.drillOff(); } });

let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  UI.hot = false;
  if ((input.key('Escape') || input.key('p')) && scene.pausable && !Trans.busy() && !(scene === Clinic && Clinic.closet)) {
    Pause.on = !Pause.on; SND.sfx('click'); SND.drillOff(); input.hit = {};
  }
  if (input.key('m')) SND.setMusic(!settings.music);
  if (!Pause.on) { scene.update(dt); updateFX(dt); }
  Trans.update(dt);

  G = ctx;
  rect(0, 0, W, H, P.black);
  ctx.save();
  ctx.translate(FX.ox, FX.oy);
  UI.block = Pause.on || Trans.busy();
  scene.draw();
  drawFX();
  ctx.restore();
  UI.block = false;
  if (FX.flash > 0) { ctx.globalAlpha = FX.flash * 0.6; rect(0, 0, W, H, FX.flashC); ctx.globalAlpha = 1; }
  if (Pause.on) { UI.hot = false; Pause.draw(); }
  Trans.apply();

  // in-game cursor (tool sprites during treatments)
  const cur = !Pause.on && scene.cursor ? scene.cursor() : null;
  const onScreen = input.x >= 0 && input.y >= 0 && input.x < W && input.y < H;
  if (onScreen) {
    if (cur && (!input.touch || input.down)) drawCursor(cur.type, cur.x, cur.y, now / 1000, input.down);
    else if (!input.touch) drawCursor(UI.hot ? 'point' : 'arrow', input.x, input.y, now / 1000, input.down);
  }
  input.endFrame();
  requestAnimationFrame(frame);
}

setScene(Title);
requestAnimationFrame(frame);
