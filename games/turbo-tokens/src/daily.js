// Daily challenges: three new goals every day, picked from the date, with token prizes.
import { TRACKS } from './tracks.js';
import { save, persist } from './state.js';
import { mulberry32 } from './utils.js';

export const SWEEP_BONUS = 100; // for finishing all three in a day

// Each challenge: make(rand) -> params, text(params), reward(params), test(result, params).
const POOL = {
  win: {
    icon: '🏆',
    make: (rand) => ({ track: TRACKS[Math.floor(rand() * TRACKS.length)].id }),
    text: (p) => `Win a race on ${trackName(p.track)}`,
    reward: () => 120,
    test: (r, p) => r.place === 1 && r.track === p.track,
    live: (s, p) => (s.track !== p.track ? { blocked: `Race on ${trackName(p.track)}` } : { ok: s.place === 1, text: s.place === 1 ? 'You are 1st!' : `You are ${ord(s.place)}` }),
  },
  podium: {
    icon: '🥉',
    make: () => ({}),
    text: () => 'Finish in the top 3 on Hard or Insane',
    reward: () => 110,
    test: (r) => r.place <= 3 && (r.difficulty === 'hard' || r.difficulty === 'insane'),
    live: (s) => (s.difficulty !== 'hard' && s.difficulty !== 'insane' ? { blocked: 'Pick Hard or Insane' } : { ok: s.place <= 3, text: `You are ${ord(s.place)}` }),
  },
  drift: {
    icon: '💨',
    make: (rand) => ({ n: [1500, 2500, 4000][Math.floor(rand() * 3)] }),
    text: (p) => `Score ${p.n.toLocaleString()} drift points in one race`,
    reward: (p) => (p.n >= 4000 ? 120 : p.n >= 2500 ? 90 : 60),
    test: (r, p) => (r.perf.driftScore || 0) >= p.n,
    live: (s, p) => count(s.perf.driftScore || 0, p.n),
  },
  overtakes: {
    icon: '🏎️',
    make: (rand) => ({ n: [5, 8, 12][Math.floor(rand() * 3)] }),
    text: (p) => `Make ${p.n} overtakes in one race`,
    reward: (p) => (p.n >= 12 ? 110 : p.n >= 8 ? 80 : 60),
    test: (r, p) => (r.perf.overtakes || 0) >= p.n,
    live: (s, p) => count(s.perf.overtakes || 0, p.n),
  },
  speed: {
    icon: '⚡',
    make: (rand) => ({ n: [200, 220, 240][Math.floor(rand() * 3)] }),
    text: (p) => `Reach a top speed of ${p.n} km/h`,
    reward: (p) => (p.n >= 240 ? 100 : p.n >= 220 ? 75 : 50),
    test: (r, p) => (r.perf.topSpeedKmh || 0) >= p.n,
    live: (s, p) => count(s.perf.topSpeedKmh || 0, p.n, ' km/h'),
  },
  perfect: {
    icon: '🚦',
    make: () => ({}),
    text: () => 'Get a perfect start',
    reward: () => 50,
    test: (r) => !!r.perf.perfectStart,
    live: (s) => (s.perf.perfectStart ? { ok: true } : s.launched ? { failed: 'Missed it this time' } : { text: 'Gas right on GREEN!' }),
  },
  clean: {
    icon: '✨',
    make: () => ({}),
    text: () => 'Finish a race without hitting a wall',
    reward: () => 70,
    test: (r) => r.clean,
    live: (s) => (s.wallHits ? { failed: 'Hit a wall this time' } : { ok: true, text: 'No wall hits yet' }),
  },
  night: {
    icon: '🌙',
    make: () => ({}),
    text: () => 'Finish a race at night',
    reward: () => 60,
    test: (r) => r.night,
    live: (s) => (s.night ? { ok: true } : { blocked: 'Turn on Night' }),
  },
  rain: {
    icon: '🌧️',
    make: () => ({}),
    text: () => 'Finish a race in the rain or a blizzard',
    reward: () => 60,
    test: (r) => !!r.rain,
    live: (s) => (s.rain ? { ok: true } : { blocked: 'Turn on Rain' }),
  },
  ghost: {
    icon: '👻',
    make: () => ({}),
    text: () => 'Set a new ghost lap on any track',
    reward: () => 70,
    test: (r) => r.newGhost,
    live: (s) => (s.newGhost ? { ok: true } : { text: 'Drive your fastest lap!' }),
  },
  lead: {
    icon: '🥇',
    make: () => ({}),
    text: () => 'Lead 2 laps in one race',
    reward: () => 80,
    test: (r) => (r.perf.lapsLed || 0) >= 2,
    live: (s) => count(s.perf.lapsLed || 0, 2, ' laps'),
  },
  insane: {
    icon: '💀',
    make: () => ({}),
    text: () => 'Finish a race on Insane',
    reward: () => 90,
    test: (r) => r.difficulty === 'insane',
    live: (s) => (s.difficulty === 'insane' ? { ok: true } : { blocked: 'Pick Insane' }),
  },
  honk: {
    icon: '📯',
    make: () => ({}),
    text: () => 'Honk your horn 10 times in one race',
    reward: () => 40,
    test: (r) => r.honks >= 10,
    live: (s) => count(s.honks || 0, 10, ' honks'),
  },
  endurance: {
    icon: '⏱️',
    make: () => ({}),
    text: () => 'Finish a 5-lap race',
    reward: () => 80,
    test: (r) => r.laps === 5,
    live: (s) => (s.laps === 5 ? { ok: true } : { blocked: 'Pick 5 laps' }),
  },
};

// Progress like "3/8" with a bar.
function count(now, goal, unit = '') {
  return { ok: now >= goal, text: `${Math.min(now, goal).toLocaleString()}/${goal.toLocaleString()}${unit}`, frac: Math.min(1, now / goal) };
}

function ord(n) {
  return n + (['st', 'nd', 'rd'][n - 1] || 'th');
}

function trackName(id) {
  return (TRACKS.find((t) => t.id === id) || TRACKS[0]).name;
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Today's three challenges (made once per day, the same for everyone on that date).
export function dailyChallenges() {
  const key = todayKey();
  if (!save.daily || save.daily.date !== key) {
    const rand = mulberry32(hash(key));
    const types = Object.keys(POOL);
    const picked = [];
    while (picked.length < 3) {
      const t = types[Math.floor(rand() * types.length)];
      if (!picked.includes(t)) picked.push(t);
    }
    save.daily = { date: key, items: picked.map((type) => ({ type, params: POOL[type].make(rand), done: false })), swept: false };
    persist();
  }
  return save.daily.items.map((it) => {
    const c = POOL[it.type];
    return { ...it, icon: c.icon, text: c.text(it.params), reward: c.reward(it.params) };
  });
}

// Check a finished race. Marks challenges done and returns the token lines won.
export function completeDaily(result) {
  const list = dailyChallenges();
  const won = [];
  list.forEach((c, i) => {
    if (c.done || !POOL[c.type].test(result, c.params)) return;
    save.daily.items[i].done = true;
    won.push({ label: `${c.icon} ${c.text}`, value: c.reward });
  });
  if (won.length && !save.daily.swept && save.daily.items.every((it) => it.done)) {
    save.daily.swept = true;
    won.push({ label: '🌟 All 3 daily challenges done!', value: SWEEP_BONUS });
  }
  persist();
  return won;
}

// Live progress during a race. state: place, track, difficulty, laps, perf, wallHits,
// launched, night, rain, newGhost, honks. Each item gets a status:
// done (earlier today), ok (finish the race to collect), progress, blocked or failed.
export function dailyLive(state) {
  return dailyChallenges().map((c) => {
    const l = c.done ? {} : POOL[c.type].live(state, c.params);
    const status = c.done ? 'done' : l.ok ? 'ok' : l.blocked ? 'blocked' : l.failed ? 'failed' : 'progress';
    return { ...c, status, note: l.blocked || l.failed || l.text || '', frac: l.frac ?? null };
  });
}

// "5h 12m" until the challenges change at midnight.
export function timeToReset() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.round((next - now) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}
