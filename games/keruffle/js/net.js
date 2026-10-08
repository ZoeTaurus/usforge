'use strict';
// ---------------------------------------------------------------------------
// Online play.
//
// Two players' games run the same fight in lockstep: each side sends only
// its button presses, tagged with the frame they belong to, and a frame is
// simulated once both sides' presses for it have arrived. Presses are taken
// a few frames ahead (the input delay), so on a normal connection nobody
// waits. For this to work both games must compute exactly the same fight:
//   Det  — deterministic math for the simulation (browsers may round sin(),
//          atan2() & co. differently) and a seeded Math.random,
//   Net  — the connection (the artifact page's `room` capability: the
//          players' presence objects) and matchmaking in the lobby,
//   NetMatch — one pairing of two players: setup handshake, inputs, rematch.
// ---------------------------------------------------------------------------

const NET_PROTO = 1;

// ---- Det: deterministic math ---------------------------------------------------
const Det = (() => {
  const M = Math;
  const NAMES = ['sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'hypot', 'exp', 'log', 'pow', 'random'];
  const nat = {};
  for (const n of NAMES) nat[n] = M[n];
  const sqrt = M.sqrt, floor = M.floor, round = M.round;
  const PI = 3.141592653589793, PIO2 = 1.5707963267948966;
  const PIO2_HI = 1.5707963267341256, PIO2_LO = 6.077100506506192e-11;
  // kernels from fdlibm (|r| <= pi/4); only + - * / below, which IEEE 754
  // rounds the same everywhere
  const S1 = -1.66666666666666324348e-1, S2 = 8.33333333332248946124e-3, S3 = -1.98412698298579493134e-4;
  const S4 = 2.75573137070700676789e-6, S5 = -2.50507602534068634195e-8, S6 = 1.58969099521155010221e-10;
  const C1 = 4.16666666666666019037e-2, C2 = -1.38888888888741095749e-3, C3 = 2.48015872894767294178e-5;
  const C4 = -2.75573143513906633035e-7, C5 = 2.0875723212981748279e-9, C6 = -1.13596475577881948265e-11;
  const kSin = (r) => {
    const z = r * r;
    return r + r * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))));
  };
  const kCos = (r) => {
    const z = r * r;
    return 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  };
  const quad = (x) => {
    const k = round(x * 0.6366197723675814);
    return [x - k * PIO2_HI - k * PIO2_LO, k & 3];
  };
  const sin = (x) => {
    if (!isFinite(x)) return NaN;
    const [r, q] = quad(x);
    return q === 0 ? kSin(r) : q === 1 ? kCos(r) : q === 2 ? -kSin(r) : -kCos(r);
  };
  const cos = (x) => {
    if (!isFinite(x)) return NaN;
    const [r, q] = quad(x);
    return q === 0 ? kCos(r) : q === 1 ? -kSin(r) : q === 2 ? -kCos(r) : kSin(r);
  };
  const ATAN_C = [];
  for (let n = 25; n >= 1; n -= 2) ATAN_C.push(((n - 1) / 2) % 2 ? -1 / n : 1 / n);
  const atan = (x) => {
    if (x !== x) return NaN;
    const neg = x < 0;
    if (neg) x = -x;
    const inv = x > 1;
    if (inv) x = 1 / x;
    let add = 0;
    if (x > 0.2679491924311227) {
      x = (x * 1.7320508075688772 - 1) / (x + 1.7320508075688772);
      add = 0.5235987755982988;
    }
    const z = x * x;
    let p = 0;
    for (let i = 0; i < ATAN_C.length; i++) p = p * z + ATAN_C[i];
    let r = add + x * p;
    if (inv) r = PIO2 - r;
    return neg ? -r : r;
  };
  const atan2 = (y, x) => {
    if (x !== x || y !== y) return NaN;
    if (x > 0) return atan(y / x);
    if (x < 0) return y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
    return y > 0 ? PIO2 : y < 0 ? -PIO2 : 0;
  };
  const asin = (x) => (x > 1 || x < -1 ? NaN : atan2(x, sqrt((1 - x) * (1 + x))));
  const acos = (x) => (x > 1 || x < -1 ? NaN : atan2(sqrt((1 - x) * (1 + x)), x));
  const hypot = (...a) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * a[i];
    return sqrt(s);
  };
  const pow2 = (v, k) => {
    let p = 1;
    for (let i = 0; i < (k < 0 ? -k : k); i++) p *= 2;
    return k < 0 ? v / p : v * p;
  };
  const exp = (x) => {
    if (x !== x) return NaN;
    if (x > 709) return Infinity;
    if (x < -745) return 0;
    const k = round(x * 1.4426950408889634);
    const r = x - k * 0.6931471803691238 - k * 1.9082149292705877e-10;
    let t = 1, s = 1;
    for (let i = 1; i <= 14; i++) {
      t = (t * r) / i;
      s += t;
    }
    return pow2(s, k);
  };
  const LOG_C = [];
  for (let n = 25; n >= 1; n -= 2) LOG_C.push(1 / n);
  const log = (x) => {
    if (x !== x || x < 0) return NaN;
    if (x === 0) return -Infinity;
    if (x === Infinity) return Infinity;
    let e = 0;
    while (x >= 1.4142135623730951) {
      x /= 2;
      e++;
    }
    while (x < 0.7071067811865476) {
      x *= 2;
      e--;
    }
    const s = (x - 1) / (x + 1), z = s * s;
    let p = 0;
    for (let i = 0; i < LOG_C.length; i++) p = p * z + LOG_C[i];
    return 2 * s * p + e * 0.6931471805599453;
  };
  const pow = (x, y) => {
    if (y === 0) return 1;
    if (x !== x || y !== y) return NaN;
    if (y === floor(y) && y <= 1024 && y >= -1024) {
      let n = y < 0 ? -y : y, b = x, r = 1;
      while (n > 0) {
        if (n % 2 === 1) r *= b;
        b *= b;
        n = floor(n / 2);
      }
      return y < 0 ? 1 / r : r;
    }
    if (x < 0) return NaN;
    if (x === 0) return y > 0 ? 0 : Infinity;
    return exp(y * log(x));
  };
  const tan = (x) => sin(x) / cos(x);
  const det = { sin, cos, tan, atan, atan2, asin, acos, hypot, exp, log, pow };

  const D = {
    active: false,
    det,
    native: nat,
    // a seeded random number generator (mulberry32) with its state in an object
    rng(seed) {
      const st = { s: seed >>> 0 };
      st.next = () => {
        st.s = (st.s + 0x6d2b79f5) >>> 0;
        let t = st.s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      return st;
    },
    // run fn with deterministic math and the given seeded random
    run(rng, fn) {
      if (D.active) return fn();
      for (const n in det) M[n] = det[n];
      M.random = rng.next;
      D.active = true;
      try {
        return fn();
      } finally {
        D.active = false;
        for (const n of NAMES) M[n] = nat[n];
      }
    },
    // cosmetic code (sound, particles, camera shake) runs with the native
    // math and random even inside run(): it may differ between players
    plain(fn, self, args) {
      if (!D.active) return fn.apply(self, args);
      const keep = {};
      for (const n of NAMES) {
        keep[n] = M[n];
        M[n] = nat[n];
      }
      D.active = false;
      try {
        return fn.apply(self, args);
      } finally {
        D.active = true;
        for (const n of NAMES) M[n] = keep[n];
      }
    },
    cosmetic(obj, names) {
      for (const n of names) {
        const fn = obj && obj[n];
        if (typeof fn !== 'function' || fn.__plain) continue;
        const w = function (...args) {
          return D.plain(fn, this, args);
        };
        w.__plain = true;
        obj[n] = w;
      }
    },
  };
  return D;
})();

// What may differ between the two players' games: sound, particles, the
// stage's own animation and the camera shake.
Det.cosmetic(Sound, Object.keys(Sound).filter((k) => typeof Sound[k] === 'function'));
Det.cosmetic(Particles.prototype, ['add', 'update', 'clear']);
Det.cosmetic(FX, Object.keys(FX).filter((k) => typeof FX[k] === 'function'));
Det.cosmetic(Battle.prototype, ['updateCam']);
for (const id in STAGES) Det.cosmetic(STAGES[id], ['update']);

// ---- Net: the connection and the lobby ---------------------------------------
const Net = {
  room: null,
  state: 'idle', // idle | connecting | ready | unavailable
  waiters: [],

  // Resolves the room, or null where online play can't connect.
  async connect() {
    if (this.state === 'ready') return this.room;
    if (this.state === 'unavailable') return null;
    if (this.state === 'connecting') return new Promise((r) => this.waiters.push(r));
    this.state = 'connecting';
    let room = null;
    try {
      if (window.claude && typeof window.claude.use === 'function') room = await window.claude.use('room');
    } catch (e) {
      room = null;
    }
    this.room = room;
    this.state = room ? 'ready' : 'unavailable';
    for (const w of this.waiters.splice(0)) w(room);
    return room;
  },

  me() {
    if (!this.room) return null;
    const p = this.room.peers().find((q) => q.sameTab);
    return p || null;
  },

  // lobby presence: { kf: { v, st: 'search' | 'match', ts, want, ch } }
  lobby: null,
  setLobby(obj) {
    this.lobby = obj;
    if (this.room) this.room.presence({ kf: obj }).catch(() => {});
  },
  clearLobby() {
    this.lobby = null;
    if (this.room) this.room.presence({ kf: null }).catch(() => {});
  },

  lobbyPeers() {
    if (!this.room) return [];
    return this.room.peers().filter((p) => p.kind === 'viewer' && p.presence && p.presence.kf && p.presence.kf.v === NET_PROTO);
  },

  // One matchmaking step. Searchers are paired in the order they started
  // searching; a pairing holds once both sides name each other. Whoever sees
  // that first commits (st 'match', naming this search's ts), and a peer who
  // committed to this very search counts as a match even if we never saw
  // both names at once.
  searchTick() {
    const me = this.me();
    if (!me || !this.lobby || this.lobby.st !== 'search') return null;
    const all = this.lobbyPeers();
    const sure = all.find((p) => !p.sameTab && p.presence.kf.st === 'match' && p.presence.kf.want === me.peer && p.presence.kf.wts === this.lobby.ts);
    if (sure) return sure;
    const list = all
      .filter((p) => p.presence.kf.st === 'search')
      .sort((a, b) => a.presence.kf.ts - b.presence.kf.ts || (a.peer < b.peer ? -1 : 1));
    const i = list.findIndex((p) => p.sameTab);
    if (i < 0) return null;
    const partner = list[i ^ 1] || null;
    const want = partner ? partner.peer : null;
    if (want !== (this.lobby.want || null)) this.setLobby(Object.assign({}, this.lobby, { want }));
    if (partner && partner.presence.kf.want === me.peer) return partner;
    return null;
  },

  // has the partner we committed to gone with someone else?
  jilted(partnerPeer, myTs) {
    const p = this.lobbyPeers().find((q) => q.peer === partnerPeer);
    if (!p) return false;
    const k = p.presence.kf;
    return k.st === 'match' && (k.want !== (this.me() || {}).peer || (myTs && k.wts !== myTs));
  },

  roomName(a, b) {
    const s = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'x';
    const [p, q] = [s(a), s(b)].sort();
    return ('kf-' + p + '-' + q).slice(0, 48);
  },
};

// ---- NetMatch: one pairing --------------------------------------------------------
// Presence in the match room: { m: { id, v, hello, ping, pong, setup, ready,
// in, ck, rematch, bye } }, always sent whole.
class NetMatch {
  constructor(room, me, other, name, lobbyMode) {
    this.room = room; // a named room, or the lobby when named rooms are refused
    this.me = me;
    this.other = other;
    this.name = name;
    this.lobbyMode = lobbyMode;
    this.isHost = me < other;
    this.mine = { id: name, v: NET_PROTO };
    this.sid = 0; // the setup in play
    this.pending = null;
    this.rtts = [];
    this.pingN = 0;
    this.pingAt = 0;
    this.lastSeen = performance.now();
    this.left = false;
    this.created = performance.now();
  }

  static async open(partner) {
    const room = Net.room;
    const me = Net.me().peer;
    const name = Net.roomName(me, partner.peer);
    let r = null;
    try {
      r = await room.join(name);
    } catch (e) {
      r = null;
    }
    return new NetMatch(r || room, me, partner.peer, name, !r);
  }

  set(patch) {
    Object.assign(this.mine, patch);
    for (const k in patch) if (patch[k] === null) delete this.mine[k];
    this.room.presence({ m: this.mine }).catch(() => {});
  }

  // the other player's match object (null until it arrives)
  theirs() {
    const p = this.room.peers().find((q) => q.peer === this.other);
    const t = performance.now();
    if (!p) {
      if (t - this.lastSeen > 4000) this.left = true;
      return null;
    }
    this.lastSeen = t;
    const m = p.presence && p.presence.m;
    if (!m || m.id !== this.name) return null;
    if (m.bye) this.left = true;
    return m;
  }

  hello(ch, pal) {
    this.myFighter = { ch, pal };
    this.set({ hello: { ch, pal } });
  }

  // Handshake / rematch step. Returns a setup to start, or null.
  tick(wantRematch) {
    const th = this.theirs();
    if (!th) return null;
    // answer pings
    if (th.ping !== undefined && th.ping !== this.mine.pong) this.set({ pong: th.ping });
    if (this.isHost) {
      if (!th.hello) return null;
      // measure the round trip
      const now = performance.now();
      if (this.pingN > 0 && th.pong === this.pingN && this.pingAt) {
        this.rtts.push(now - this.pingAt);
        this.pingAt = 0;
      }
      if (!this.pingAt && this.rtts.length < 5 && (!this.lastPing || now - this.lastPing > 120)) {
        this.pingN++;
        this.pingAt = now;
        this.lastPing = now;
        this.set({ ping: this.pingN });
      }
      if (this.pingAt && now - this.pingAt > 3000) this.pingAt = 0; // lost: try again
      const measured = this.rtts.length >= 4 || (this.rtts.length >= 1 && now - this.created > 4000);
      const wanted = this.sid === 0 ? measured : wantRematch && th.rematch === this.sid && this.mine.rematch === this.sid;
      if (wanted && !this.pending) {
        this.pending = this.makeSetup(th.hello);
        this.set({ setup: this.pending });
      }
      if (this.pending && th.ready === this.pending.sid) return this.begin(this.pending);
    } else if (th.setup && th.setup.sid > this.sid && th.setup.v === NET_PROTO) {
      this.set({ ready: th.setup.sid });
      return this.begin(th.setup);
    }
    return null;
  }

  makeSetup(theirHello) {
    const rs = this.rtts.slice().sort((a, b) => a - b);
    const rtt = rs.length ? rs[Math.floor(rs.length / 2)] : 200;
    const delay = U.clamp(Math.ceil((rtt / 2 + 25) / 16.67), 3, 15);
    const p1 = { ch: this.myFighter.ch, pal: this.myFighter.pal };
    const p2 = { ch: theirHello.ch, pal: theirHello.pal };
    const C = CHARS[p2.ch];
    if (p1.ch === p2.ch && p1.pal === p2.pal) p2.pal = (p2.pal + 1) % C.palettes.length;
    const stages = STAGE_ORDER.filter((id) => STAGES[id]);
    return {
      v: NET_PROTO, sid: this.sid + 1, stage: U.choose(stages), seed: (Math.random() * 4294967296) >>> 0,
      delay, rtt: Math.round(rtt), p1, p2, time: 99, rounds: 2,
    };
  }

  begin(setup) {
    this.sid = setup.sid;
    this.pending = null;
    this.setupNow = setup;
    this.set({ rematch: null, in: null, ck: null });
    return setup;
  }

  // ---- inputs ------------------------------------------------------------------
  sendInputs(start, masks) {
    this.mine.in = [this.sid, start].concat(masks);
    this.room.presence({ m: this.mine }).catch(() => {});
  }

  bye() {
    if (this.closed) return;
    this.closed = true;
    this.set({ bye: true });
    const r = this.room;
    if (!this.lobbyMode) setTimeout(() => r.leave().catch(() => {}), 400);
    else setTimeout(() => r.presence({ m: null }).catch(() => {}), 400);
  }
}
