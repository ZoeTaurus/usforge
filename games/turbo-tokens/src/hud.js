// In-race heads-up display (DOM overlay).
import { Vector3 } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { ordinal, formatTime } from './utils.js';

const ARC_LEN = 0.75 * 2 * Math.PI * 62; // 270° of a r=62 circle

export class HUD {
  constructor(root, { laps, path, isTouch, cars }) {
    this.root = root;
    this.laps = laps;
    this.path = path;
    this.cache = {};
    root.innerHTML = `
      <div class="hud-tl">
        <div class="hud-pos"><span data-k="pos">-</span><span class="suf" data-k="suf"></span><span class="of">/${cars.length}</span></div>
        <div class="hud-lap">LAP <b data-k="lap">1</b><span>/${laps}</span></div>
        <ol class="standings" data-k="standings"></ol>
        <div class="hud-daily" data-k="daily">
          <div class="hd-head"><span>📅 DAILY CHALLENGES</span><button class="hd-close" data-k="dailyclose" title="Hide (Q)">✕</button></div>
          <div class="hd-list" data-k="dailylist"></div>
        </div>
        <button class="hud-daily-tab" data-k="dailytab" title="Daily challenges (Q)">📅<b data-k="dailyleft"></b></button>
      </div>
      <div class="hud-tc">
        <div class="hud-time" data-k="time">0:00.000</div>
        <div class="hud-sub">LAP <span data-k="laptime">0:00.000</span> · BEST <span data-k="best">--:--.---</span></div>
        <div class="hud-ghost" data-k="ghost"></div>
      </div>
      <div class="hud-tr"><canvas class="minimap" width="200" height="200"></canvas></div>
      <div class="hud-br">
        <svg class="gauge" viewBox="0 0 160 160">
          <defs>
            <linearGradient id="gaugeGrad" x1="0" x2="1" y1="1" y2="0">
              <stop offset="0" stop-color="#32e0ff"/><stop offset="0.6" stop-color="#ffe14d"/><stop offset="1" stop-color="#ff3b5c"/>
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r="62" class="gauge-bg" stroke-dasharray="${ARC_LEN} 1000" transform="rotate(135 80 80)"/>
          <circle cx="80" cy="80" r="62" class="gauge-fg" data-k="arc" stroke-dasharray="${ARC_LEN} 1000" stroke-dashoffset="${ARC_LEN}" transform="rotate(135 80 80)"/>
        </svg>
        <div class="speed"><b data-k="speed">0</b><span>KM/H</span></div>
        <div class="nitro"><div class="nitro-label">NITRO ${isTouch ? '' : '<kbd>SHIFT</kbd>'}</div><div class="nitro-bar"><div data-k="nitro"></div></div></div>
      </div>
      <div class="hud-msg" data-k="msg"></div>
      <div class="hud-count" data-k="count"></div>
      <div class="hud-warn" data-k="warn">WRONG WAY</div>
      <div class="hud-hint" data-k="hint">Arrows / WASD to drive · SPACE brake · hold E to drift · SHIFT nitro · C camera · R reset · ESC pause</div>
      <div class="tags" data-k="tags"></div>
      <div class="drift-meter" data-k="drift"><span class="dm-label">DRIFT</span><b class="dm-pts" data-k="dpts">0</b><span class="dm-mult" data-k="dmult">×1</span><div class="dm-grace"><i data-k="dgrace"></i></div></div>
      <div class="popups" data-k="popups"></div>
      <div class="hud-tip" data-k="tipbox"></div>
      <div class="hud-flash" data-k="flash"></div>
      <div class="replay" data-k="replay">
        <div class="rp-bar top"></div><div class="rp-bar bottom"></div>
        <div class="rp-tag"><i></i>REPLAY</div>
        <div class="rp-head">RACE HIGHLIGHTS</div>
        <div class="rp-cap" data-k="rpcap"><b data-k="rptitle"></b><span data-k="rpsub"></span></div>
        <div class="rp-pips" data-k="rppips"></div>
        <button class="rp-skip" data-k="rpskip">SKIP ▶</button>
        <div class="rp-flash" data-k="rpflash"></div>
      </div>
      <div class="speedlines" data-k="lines"></div>
      ${isTouch ? `
      <div class="touch">
        <div class="touch-left"><button data-touch="left">◀</button><button data-touch="right">▶</button></div>
        <div class="touch-right">
          <button data-touch="nitro" class="t-nitro">N₂O</button>
          <button data-touch="handbrake" class="t-drift">DRIFT</button>
          <button data-touch="down" class="t-brake">BRAKE</button>
          <button data-touch="up" class="t-gas">GAS</button>
        </div>
        <button class="touch-pause" data-touch="pause">II</button>
        <button class="touch-horn" data-touch="horn">📯</button>
      </div>` : ''}
    `;
    this.el = {};
    root.querySelectorAll('[data-k]').forEach((e) => (this.el[e.dataset.k] = e));
    // Daily challenges panel: ✕ hides it, the 📅 tab brings it back.
    this.el.dailyclose.addEventListener('click', () => this.onDailyToggle && this.onDailyToggle(false));
    this.el.dailytab.addEventListener('click', () => this.onDailyToggle && this.onDailyToggle(true));
    this.mini = root.querySelector('.minimap');
    this.buildMinimap();
    this.tags = new Map();
    for (const c of cars) {
      if (c.isPlayer) continue;
      const t = document.createElement('div');
      t.className = 'tag';
      t.innerHTML = `<i style="background:${c.color}"></i>${c.name}`;
      this.el.tags.appendChild(t);
      this.tags.set(c, t);
    }
    this.msgTimer = 0;
    this.tipTimer = 0;
    setTimeout(() => this.el.hint && this.el.hint.classList.add('fade'), 7000);
    this.el.rpskip.addEventListener('click', () => this.onSkip && this.onSkip());
  }

  // Small hint box above the bottom of the screen.
  tip(text, time = 3) {
    this.el.tipbox.textContent = text;
    this.el.tipbox.classList.add('on');
    this.tipTimer = time;
  }

  setDailyOpen(open) {
    this.el.daily.classList.toggle('on', open);
    this.el.dailytab.classList.toggle('on', !open);
  }

  // list: from dailyLive() — icon, text, reward, status, note, frac.
  updateDaily(list) {
    const key = list.map((c) => `${c.status}:${c.note}:${c.frac}`).join('|');
    if (this.cache.daily === key) return;
    this.cache.daily = key;
    const label = { done: '✔ DONE', ok: '✔ Finish to collect!' };
    this.el.dailylist.innerHTML = list
      .map((c) => `<div class="hd-item ${c.status}">
        <span class="hd-icon">${c.icon}</span>
        <div class="hd-body">
          <div class="hd-text">${c.text}</div>
          <div class="hd-note">${label[c.status] || c.note}${c.status === 'ok' && c.note ? ` · ${c.note}` : ''}<b class="hd-pay"><i class="coin">T</i>${c.reward}</b></div>
          ${c.status === 'progress' && c.frac != null ? `<div class="hd-bar"><i style="width:${Math.round(c.frac * 100)}%"></i></div>` : ''}
        </div>
      </div>`)
      .join('');
    const left = list.filter((c) => c.status !== 'done').length;
    this.el.dailyleft.textContent = left ? String(left) : '✔';
  }

  // Lightning flash over the whole screen.
  flash(strength = 0.6) {
    const f = this.el.flash;
    f.style.transition = 'none';
    f.style.opacity = String(strength);
    void f.offsetWidth;
    f.style.transition = 'opacity 0.9s ease-out';
    f.style.opacity = '0';
  }

  // Time gap to the ghost car (seconds, negative = you are ahead). null hides it.
  ghost(gap) {
    const el = this.el.ghost;
    const txt = gap == null ? '' : `👻 ${gap < 0 ? '−' : '+'}${Math.abs(gap).toFixed(2)}`;
    if (this.cache.ghost === txt) return;
    this.cache.ghost = txt;
    el.textContent = txt;
    el.classList.toggle('on', gap != null);
    el.classList.toggle('ahead', gap != null && gap < 0);
  }

  // Floating text that rises and fades ("OVERTAKE!", "+1,240 DRIFT").
  popup(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'popup ' + cls;
    el.textContent = text;
    this.el.popups.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  drift(d) {
    const show = d.chain > 0 && (d.active || d.grace > 0);
    this.el.drift.classList.toggle('on', show);
    this.el.drift.classList.toggle('hot', d.mult >= 3);
    if (!show) return;
    this.set('dpts', Math.round(d.chain * d.mult).toLocaleString());
    this.set('dmult', '×' + d.mult);
    this.el.dgrace.style.width = (d.active ? 100 : (d.grace / 1.2) * 100).toFixed(0) + '%';
  }

  replay(on, count = 0) {
    this.root.classList.toggle('replaying', on);
    this.el.replay.classList.toggle('on', on);
    if (on) this.el.rppips.innerHTML = Array.from({ length: count }, () => '<i><b></b></i>').join('');
  }

  replayClip(i, n, clip) {
    this.el.rptitle.textContent = clip.title;
    this.el.rpsub.textContent = clip.sub;
    const cap = this.el.rpcap;
    cap.classList.remove('in');
    void cap.offsetWidth;
    cap.classList.add('in');
    const flash = this.el.rpflash;
    flash.classList.remove('go');
    void flash.offsetWidth;
    flash.classList.add('go');
    [...this.el.rppips.children].forEach((p, k) => {
      p.className = k < i ? 'done' : k === i ? 'now' : '';
      p.firstChild.style.width = k < i ? '100%' : '0%';
    });
    this.pip = this.el.rppips.children[i];
  }

  replayProgress(u) {
    if (this.pip) this.pip.firstChild.style.width = Math.min(100, u * 100).toFixed(1) + '%';
  }

  set(k, v) {
    if (this.cache[k] === v) return;
    this.cache[k] = v;
    this.el[k].textContent = v;
  }

  buildMinimap() {
    const p = this.path;
    const b = p.bounds();
    const S = 200;
    const pad = 16;
    const sc = (S - pad * 2) / Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const ox = (S - (b.maxX - b.minX) * sc) / 2;
    const oz = (S - (b.maxZ - b.minZ) * sc) / 2;
    // Top-down view: +X to the right, +Z down the screen.
    this.map = (x, z) => [ox + (x - b.minX) * sc, oz + (z - b.minZ) * sc];
    const bg = document.createElement('canvas');
    bg.width = bg.height = S;
    const ctx = bg.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const trace = () => {
      ctx.beginPath();
      for (let i = 0; i <= p.count; i += 2) {
        const j = i % p.count;
        const [x, y] = this.map(p.px[j], p.pz[j]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    trace();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 11;
    ctx.stroke();
    trace();
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 5;
    ctx.stroke();
    // Start line.
    const [sx, sy] = this.map(p.px[0], p.pz[0]);
    ctx.fillStyle = '#ff3b5c';
    ctx.fillRect(sx - 3, sy - 6, 6, 12);
    this.miniBg = bg;
  }

  drawMinimap(cars, player) {
    const ctx = this.mini.getContext('2d');
    ctx.clearRect(0, 0, 200, 200);
    ctx.drawImage(this.miniBg, 0, 0);
    for (const c of cars) {
      if (c === player) continue;
      const [x, y] = this.map(c.x, c.z);
      ctx.fillStyle = c.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const [x, y] = this.map(player.x, player.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI - player.heading);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  }

  update(r) {
    const { player, ranking, raceTime } = r;
    const pos = ranking.indexOf(player) + 1;
    this.set('pos', String(pos));
    this.set('suf', ordinal(pos).replace(/^\d+/, ''));
    this.set('lap', String(Math.min(this.laps, player.lapsCompleted + 1)));
    this.set('time', formatTime(raceTime));
    this.set('laptime', formatTime(Math.max(0, raceTime - player.lapStart)));
    this.set('best', formatTime(player.bestLap));
    const kmh = Math.round(Math.abs(player.speed) * 3.6);
    this.set('speed', String(kmh));
    const frac = Math.min(1, kmh / 300);
    const off = ARC_LEN * (1 - frac);
    if (Math.abs((this.cache.arc || 0) - off) > 0.5) {
      this.cache.arc = off;
      this.el.arc.setAttribute('stroke-dashoffset', off.toFixed(1));
    }
    const n = Math.round(player.nitro * 100);
    if (this.cache.nitro !== n) {
      this.cache.nitro = n;
      this.el.nitro.style.width = n + '%';
      this.el.nitro.parentElement.classList.toggle('full', n >= 99);
    }
    this.el.nitro.parentElement.classList.toggle('active', player.boosting);
    this.el.lines.classList.toggle('on', player.boosting);
    this.el.warn.classList.toggle('on', r.wrongWay);

    const order = ranking.map((c) => c.name).join('|');
    if (order !== this.cache.order) {
      this.cache.order = order;
      this.el.standings.innerHTML = ranking
        .map((c, i) => `<li class="${c === player ? 'me' : ''}"><span>${i + 1}</span><i style="background:${c.color}"></i>${c.name}</li>`)
        .join('');
    }
    if (this.msgTimer > 0) {
      this.msgTimer -= r.dt;
      if (this.msgTimer <= 0) this.el.msg.classList.remove('on');
    }
    if (this.tipTimer > 0) {
      this.tipTimer -= r.dt;
      if (this.tipTimer <= 0) this.el.tipbox.classList.remove('on');
    }
    if (r.drift) this.drift(r.drift);
    this.drawMinimap(r.cars, player);
  }

  updateTags(camera, cars, w, h) {
    for (const [c, el] of this.tags) {
      const dx = c.x - camera.position.x;
      const dz = c.z - camera.position.z;
      const d = Math.hypot(dx, dz);
      _v.set(c.x, (c.y || 0) + (c.bubble ? 3.1 : 2.4), c.z).project(camera);
      const vis = d < 90 && _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      el.style.display = vis ? 'flex' : 'none';
      if (vis) {
        el.style.transform = `translate(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px) translate(-50%, -100%)`;
        el.style.opacity = String(Math.min(1, (90 - d) / 30));
      }
    }
  }

  message(text, cls = '', time = 2) {
    const m = this.el.msg;
    m.className = 'hud-msg on ' + cls;
    m.textContent = text;
    this.msgTimer = time;
  }

  countdown(text, cls = '') {
    const c = this.el.count;
    c.textContent = text;
    c.className = 'hud-count ' + cls;
    void c.offsetWidth; // restart the CSS animation
    if (text) c.classList.add('pop');
  }

  dispose() {
    this.root.innerHTML = '';
  }
}

const _v = new Vector3();
