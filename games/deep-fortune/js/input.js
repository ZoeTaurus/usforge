'use strict';
// ============================================================
//  Input: keyboard, mouse/pen/touch pointer, on-screen buttons
// ============================================================
const keys = {};
const touchBtn = { left:false, right:false, up:false, down:false };
const pointer = { x:0, y:0, down:false, id:null, inside:false };
const input = { left:false, right:false, up:false, down:false, jump:false, jumpOnly:false,
                mining:false, digKey:false, aim:null, buildMode:false, pointerType:'mouse' };

function refreshInput(){
  pollGamepad();
  input.left  = !!(keys['a'] || keys['arrowleft'] || touchBtn.left);
  input.right = !!(keys['d'] || keys['arrowright'] || touchBtn.right);
  input.up    = !!(keys['w'] || keys['arrowup'] || touchBtn.up);
  input.down  = !!(keys['s'] || keys['arrowdown'] || touchBtn.down);
  input.jumpOnly = !!keys[' '];
  input.jump  = input.up || input.jumpOnly;
  input.digKey = !!(keys['j'] || keys['k']);
  // aim tile under the pointer (mouse always; touch only while held)
  if (pointer.inside && (input.pointerType === 'mouse' || pointer.down)){
    input.aim = { x: Math.floor((pointer.x + cam.x)/TS), y: Math.floor((pointer.y + cam.y)/TS) };
    input.aimPx = { x: pointer.x + cam.x, y: pointer.y + cam.y };
  } else { input.aim = null; input.aimPx = null; }
  input.buildKey = !!keys['b'];
  const g = pad.state;
  if (g){
    input.left ||= g.left; input.right ||= g.right; input.up ||= g.up; input.down ||= g.down;
    if (g.jump){ input.jump = true; input.jumpOnly = true; }
    input.digKey ||= g.dig; input.buildKey ||= g.build;
  }
  input.mining = pointer.down && !input.buildMode && !pointer.placing;
}

function toGame(e){ const r = canvas.getBoundingClientRect(); return { x:(e.clientX - r.left) / r.width * VW, y:(e.clientY - r.top) / r.height * VH }; }
function hudHit(p){ return hudRects.find(r => p.x >= r.x && p.x < r.x+r.w && p.y >= r.y && p.y < r.y+r.h); }

canvas.addEventListener('pointerdown', e => {
  audio();
  if (scene !== 'game' || game.paused) return;
  const p = toGame(e); pointer.x = p.x; pointer.y = p.y; pointer.inside = true;
  input.pointerType = e.pointerType || 'mouse';
  const hit = hudHit(p);
  if (hit){ if (hit.action === 'medkit') useMedkit(); else if (hit.action === 'beacon') startRecall(); else { game.sel = hit.n; SFX.click(); } return; }
  if (pointer.down) return;                         // ignore extra fingers
  pointer.down = true; pointer.id = e.pointerId; pointer.placing = false;
  try { canvas.setPointerCapture(e.pointerId); } catch(_){}
  if (e.button === 2 || e.shiftKey || input.buildMode){
    pointer.placing = true;
    const tx = Math.floor((p.x + cam.x)/TS), ty = Math.floor((p.y + cam.y)/TS);
    if (inReach(tx,ty)) placeItem(tx,ty); else SFX.deny();
  }
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  const p = toGame(e); pointer.inside = true;
  if (pointer.down && e.pointerId !== pointer.id) return;
  pointer.x = p.x; pointer.y = p.y;
  if (e.pointerType) input.pointerType = e.pointerType;
});
const endPointer = e => { if (e.pointerId === pointer.id){ pointer.down = false; pointer.id = null; pointer.placing = false; } };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pointer.inside = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { if (mapOpen){ mapScroll += e.deltaY*.5; e.preventDefault(); return; } if (scene !== 'game' || game.paused) return; game.sel = (game.sel + (e.deltaY > 0 ? 1 : ITEMS.length-1)) % ITEMS.length; e.preventDefault(); }, { passive:false });

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[k] = true;
  if ([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k) || (k === 'tab' && scene === 'game' && !currentScreen)) e.preventDefault();
  if (e.repeat) return;
  onKey(k);
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; pointer.down = false; for (const b in touchBtn) touchBtn[b] = false; if (scene === 'game' && !game.paused && !game.over) pauseGame(); });

function onKey(k){
  if (k === 'escape' || k === 'p'){ handleBack(); return; }
  if (scene !== 'game' || game.over) return;
  if (k === 'tab'){ if (!currentScreen) toggleMap(); return; }
  if (mapOpen) return;
  if (k === 'e'){ if (game.shopOpen) closeShop(); else if (nearShop() && !game.paused) openShop(); return; }
  if (game.paused) return;
  if (k >= '1' && k <= '4' && k.length === 1){ game.sel = +k - 1; SFX.click(); }
  if (k === 'r') startRecall();
  if (k === 'b') buildKeyLast = null;
  if (k === 'm'){ muted = !muted; if (master) master.gain.value = muted ? 0 : settings.volume; msg(muted ? 'Sound off' : 'Sound on'); }
  if (k === 'h') useMedkit();
  if (k === 'f') placeAtFeet();
  if (k === 'n'){ settings.minimap = !settings.minimap; saveSettings(); }
}

// ---------- on-screen touch controls ----------
function bindHold(el, name){
  const on = e => { e.preventDefault(); audio(); touchBtn[name] = true; el.classList.add('held'); };
  const off = e => { e.preventDefault(); touchBtn[name] = false; el.classList.remove('held'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
}
function setupTouch(){
  if (!isTouch) return;
  document.body.classList.add('touch');
  bindHold($('tLeft'), 'left'); bindHold($('tRight'), 'right'); bindHold($('tUp'), 'up'); bindHold($('tDown'), 'down');
  $('tBuild').addEventListener('pointerdown', e => { e.preventDefault(); input.buildMode = !input.buildMode; $('tBuild').classList.toggle('on', input.buildMode); SFX.click(); });
  $('tFeet').addEventListener('pointerdown', e => { e.preventDefault(); placeAtFeet(); });
  $('tShop').addEventListener('pointerdown', e => { e.preventDefault(); if (nearShop()) openShop(); });
  $('tPause').addEventListener('pointerdown', e => { e.preventDefault(); handleBack(); });
  $('tMap').addEventListener('pointerdown', e => { e.preventDefault(); toggleMap(); });
}

// ---------- B key: build at the cursor (or at your feet), hold and sweep to place several ----------
let buildKeyLast = null;
function stepBuildKey(){
  if (!input.buildKey){ buildKeyLast = null; return; }
  let t = null;
  const fromPad = pad.state && pad.state.build && !keys['b'];
  if (!fromPad && input.aim && input.pointerType === 'mouse' && inReach(input.aim.x, input.aim.y)) t = input.aim;
  else t = { x: Math.floor(pcx()/TS), y: Math.floor(pcy()/TS) };
  const key = t.x + ',' + t.y;
  if (key === buildKeyLast) return;
  buildKeyLast = key;
  if (isSolid(t.x, t.y) || deco[I(t.x, t.y)]) return;           // quietly skip occupied tiles while sweeping
  placeItem(t.x, t.y);
}
