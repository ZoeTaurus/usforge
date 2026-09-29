'use strict';
// ============================================================
//  TEMPORARY - Title Art generator.
//  Adds a "TITLE ART" button to the home screen that renders the
//  game logo projected over the mineshaft as a 16:9 (1920x1080)
//  picture, with a download button.
//  To remove it: delete this file and its <script> tag in index.html.
// ============================================================
(function(){
  const W = 1920, H = 1080, GW = 960, GH = 540, K = W / GW;   // a tall slice so the whole shaft fits
  let art = null;

  async function renderTitleArt(){
    try { await document.fonts.load('96px "Press Start 2P"'); } catch(e){}
    const shaftX = HEADFRAME_X + 1;
    // frame the demo mine in an exact 480x270 view and render one frame
    const saved = { cx:cam.x, cy:cam.y, t:homeCam.t, parts:particles, mx:homeMiner.x, st:homeMiner.state, fade:fadeA };
    VW = GW; VH = GH; canvas.width = GW; canvas.height = GH; ctx.imageSmoothingEnabled = false;
    homeCam.t = 0; particles = []; fadeA = 0;
    cam.x = clamp(shaftX*TS + 8 - GW/2, 0, WW*TS - GW); cam.y = SURF*TS - 64;   // stay inside the world
    homeMiner.x = -500;                                             // keep the wandering miner out of shot
    render(performance.now()/1000);
    const [c, x] = mkCanvas(W, H);
    x.imageSmoothingEnabled = false;
    x.drawImage(canvas, 0, 0, GW, GH, 0, 0, W, H);
    const cx0 = cam.x, cy0 = cam.y;
    Object.assign(cam, { x:saved.cx, y:saved.cy }); homeCam.t = saved.t; particles = saved.parts; homeMiner.x = saved.mx; homeMiner.state = saved.st; fadeA = saved.fade;
    resize();

    // the miner climbing the shaft, with lamp glow
    const mx = (shaftX*TS + 1 - cx0)*K, my = ((SURF + 12)*TS - cy0)*K;
    x.save(); x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(mx + 14, my + 10, 0, mx + 14, my + 10, 150);
    g.addColorStop(0, 'rgba(255,230,170,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(mx - 140, my - 140, 300, 300);
    x.restore();
    x.drawImage(MINER[1][0], mx, my, 14*K, 18*K);

    // a projector beam falling on the shaft, and a soft vignette
    const beam = x.createLinearGradient(0, 0, 0, H);
    beam.addColorStop(0, 'rgba(255,220,140,0)'); beam.addColorStop(.35, 'rgba(255,220,140,.10)'); beam.addColorStop(1, 'rgba(255,220,140,0)');
    x.fillStyle = beam; x.beginPath(); x.moveTo(W*.5 - 60, 0); x.lineTo(W*.5 + 60, 0); x.lineTo(W*.5 + 620, H); x.lineTo(W*.5 - 620, H); x.closePath(); x.fill();
    const v = x.createRadialGradient(W/2, H*.45, H*.35, W/2, H*.45, W*.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = v; x.fillRect(0, 0, W, H);

    // the logo
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    if ('letterSpacing' in x) x.letterSpacing = '14px';
    const logo = (str, y, size, face, shadows) => {
      x.font = `${size}px "Press Start 2P", monospace`;
      shadows.forEach(([off, col]) => { x.fillStyle = col; x.fillText(str, W/2 + off, y + off); });
      x.fillStyle = face; x.fillText(str, W/2, y);
    };
    logo('DEEP', 250, 130, '#f1e9d2', [[24, 'rgba(0,0,0,.45)'], [12, '#3a2a5a']]);
    logo('FORTUNE', 420, 130, '#ffd24a', [[36, 'rgba(0,0,0,.45)'], [24, '#4a2200'], [12, '#b86a00']]);
    if ('letterSpacing' in x) x.letterSpacing = '2px';
    x.font = '34px "Press Start 2P", monospace';
    x.fillStyle = '#000'; x.fillText("Dig deep. Get rich. Don't get buried.", W/2 + 4, 520 + 4);
    x.fillStyle = '#ffffff'; x.fillText("Dig deep. Get rich. Don't get buried.", W/2, 520);
    // sparkles
    x.fillStyle = '#fff6b0';
    for (const [sx, sy, s] of [[470, 120, 30], [1480, 90, 40], [1450, 400, 26], [500, 390, 22], [1620, 250, 18]]){
      x.fillRect(sx - s/2, sy - 3, s, 6); x.fillRect(sx - 3, sy - s/2, 6, s);
    }
    return c;
  }

  // ---------- UI ----------
  const btn = document.createElement('button');
  btn.className = 'btn'; btn.id = 'btnTitleArt'; btn.textContent = 'TITLE ART (TEMP)';
  btn.style.cssText = 'border:2px dashed #ffd24a; font-size:8px;';
  document.querySelector('#home .menu-buttons').appendChild(btn);

  const ov = document.createElement('div');
  ov.id = 'titleArtOverlay'; ov.className = 'screen dim';
  ov.innerHTML = `<div style="width:min(96vw, calc((100vh - 110px) * 16 / 9)); display:flex; flex-direction:column; gap:12px; align-items:center;">
      <img id="taImg" alt="Deep Fortune title art" style="width:100%; aspect-ratio:16/9; image-rendering:pixelated; border:4px solid #4a3f5c; box-shadow:0 0 0 4px #000; background:#000;">
      <div class="actions" style="margin:0"><button class="btn gold" id="taDownload">DOWNLOAD PNG (1920x1080)</button><button class="btn" id="taClose">CLOSE</button></div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => { ov.classList.remove('show'); };
  btn.onclick = async () => {
    SFX.click();
    art = await renderTitleArt();
    $('taImg').src = art.toDataURL('image/png');
    ov.classList.add('show');
  };
  $('taClose').onclick = () => { SFX.click(); close(); };
  $('taDownload').onclick = () => { const a = document.createElement('a'); a.href = art.toDataURL('image/png'); a.download = 'deep-fortune-title.png'; a.click(); };
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('show')){ e.stopImmediatePropagation(); close(); } }, true);
})();
