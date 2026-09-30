// UsForge upload service (a Cloudflare Worker). Serves the static site, plus a small /api that lets
// listed accounts upload, update or remove their own games. It saves by committing to the GitHub project,
// which then republishes the site. The GitHub key lives only in Cloudflare (the GITHUB_TOKEN secret).
import { DurableObject } from 'cloudflare:workers';
import ACCOUNTS from '../accounts.json';

const REPO = 'ZoeTaurus/usforge', BRANCH = 'main';
// the founders review new games (a founder's own upload needs one of the OTHER founders)
const FOUNDERS = ['taurus', 'henrique', 'alex', 'igor'];
const isFounder = name => FOUNDERS.includes(String(name).toLowerCase());
const MAX_BYTES = 60 * 1024 * 1024, MAX_FILES = 1000, MAX_BINARIES = 35;   // (Workers can only make ~50 requests per upload…)
const BLOB_BATCH = 30, BLOB_BATCH_BYTES = 12 * 1024 * 1024, MAX_ONE_FILE = 25 * 1024 * 1024;   // (…so pictures and sounds come first, in batches, via /api/blobs)
const TEXT = /\.(html?|js|mjs|css|json|txt|md|svg|csv|xml|glsl|frag|vert|map)$/i;
const COVERS = ['cover.png', 'cover.jpg', 'cover.jpeg', 'cover.webp', 'cover.gif'];
// the genres a game can be tagged with (up to 3) — the same list lives in site.js and scripts/build_list.py
const GENRES = ['Action', 'Adventure', 'Arcade', 'Boss rush', 'Casual', 'Crafting', 'Endless runner', 'Exploration', 'Fighting', 'Idle', 'Management', 'Open world', 'Physics', 'Platformer', 'Puzzle', 'Racing', 'Rhythm', 'Roguelike', 'RPG', 'Sandbox', 'Shooter', 'Simulation', 'Sports', 'Stealth', 'Strategy', 'Survival', 'Tower defense', 'Board game', 'Card game', 'Educational', 'Multiplayer', 'Party', 'Quiz', 'Text-based', 'Word game', 'Comedy', 'Fantasy', 'Horror', 'Mystery', 'Pixel art', 'Sci-fi', 'Space', 'Story'];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/play' || url.pathname === '/maker') return withPreview(req, env, url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (['/api/plays', '/api/stats', '/api/stoke', '/api/here'].includes(url.pathname)) return await plays(req, env, url);
      if (url.pathname === '/api/scores') return fresh(await box(env).hsGet(await knownSlug(env, url)));   // (public: a game's top 10)
      if (url.pathname === '/api/members') return fresh(Object.keys(ACCOUNTS));   // (public: member names only, for Credits)
      if (req.method !== 'POST') throw fail(405, 'Use POST.');
      if (url.pathname === '/api/login') return ok(await login(req));
      if (url.pathname === '/api/upload') return ok(await upload(req, env));
      if (url.pathname === '/api/delete') return ok(await remove(req, env));
      if (url.pathname === '/api/member') return ok(await addMember(req, env));
      if (url.pathname === '/api/blobs') return ok(await blobs(req, env));
      if (url.pathname === '/api/reviews') return ok(await reviews(req, env));
      if (url.pathname === '/api/review') return ok(await review(req, env));
      if (url.pathname === '/api/pick') return ok(await pick(req, env));
      if (url.pathname === '/api/score') return ok(await scoreAdd(req, env, url));
      if (url.pathname === '/api/score-delete') return ok(await scoreDelete(req, env));
      if (url.pathname === '/api/profile') return ok(await profile(req, env));
      if (url.pathname === '/api/feedback') return ok(await feedbackAdd(req, env, url));
      if (url.pathname === '/api/feedback-list') return ok(await feedbackList(req, env));
      if (url.pathname === '/api/feedback-delete') return ok(await feedbackDelete(req, env));
      throw fail(404, 'No such thing.');
    } catch (e) {
      return new Response(JSON.stringify({ error: e.msg || 'Something went wrong on our side. Try again in a minute.' }), { status: e.status || 500, headers: { 'content-type': 'application/json' } });
    }
  },
};

// ---------- play counts ----------
// One tiny Durable Object keeps every game's counts: plays, and stokes (the flame "I love this" button).
//   GET  /api/plays → {slug: n}            POST /api/plays?g=slug adds a play
//   GET  /api/stats → {plays, stokes}      POST /api/stoke?g=slug adds a stoke
export class Plays extends DurableObject {
  async all(kind = 'counts') { return (await this.ctx.storage.get(kind)) || {}; }
  async hit(slug, kind = 'counts', by = 1) {
    const c = await this.all(kind);
    c[slug] = Math.max(0, (c[slug] || 0) + by);   // (an unstoke takes one away, never below zero)
    await this.ctx.storage.put(kind, c);
    return c;
  }
  async stats() { return { plays: await this.all('counts'), stokes: await this.all('stokes') }; }
  // who's here right now: each open tab checks in every ~30s (kept in memory only — nothing is saved)
  here = new Map();
  beat(id, game, leave) {
    const now = Date.now();
    if (leave) this.here.delete(id);
    else if (this.here.has(id) || this.here.size < 5000) this.here.set(id, { game, t: now });
    const games = {};
    for (const [k, v] of this.here) {
      if (now - v.t > 100000) { this.here.delete(k); continue; }   // (background tabs check in about once a minute)
      if (v.game) games[v.game] = (games[v.game] || 0) + 1;
    }
    return { online: this.here.size, games };
  }
  // game feedback (private: only the maker and the founders can read it)
  async fbAdd(slug, entry) {
    const k = 'fb:' + slug, list = (await this.ctx.storage.get(k)) || [];
    list.push(entry); while (list.length > 300) list.shift();
    await this.ctx.storage.put(k, list);
  }
  async fbGet(slugs) { const out = {}; for (const s of slugs) out[s] = (await this.ctx.storage.get('fb:' + s)) || []; return out; }
  async fbDel(slug, id) {
    const k = 'fb:' + slug, list = (await this.ctx.storage.get(k)) || [], next = list.filter(e => e.id !== id);
    await this.ctx.storage.put(k, next); return list.length - next.length;
  }
  // high scores: the top 10 per game (best score per nickname); order 'high' = bigger is better, 'low' = smaller (like golf)
  // (boards were cleared on 2026-09-29: they now live under "hs2:", and the old "hs:" ones are deleted the first time any board is used)
  async hsWipeOld() { if (this.hsWiped) return; const old = await this.ctx.storage.list({ prefix: 'hs:' }); if (old.size) await this.ctx.storage.delete([...old.keys()]); this.hsWiped = true; }
  async hsGet(slug) { await this.hsWipeOld(); return (await this.ctx.storage.get('hs2:' + slug)) || { order: 'high', unit: '', list: [] }; }
  async hsAdd(slug, name, score, order, unit) {
    const k = 'hs2:' + slug, b = await this.hsGet(slug);
    if (!b.list.length) { b.order = order; b.unit = unit; }   // (the first score sets which way the board sorts)
    const better = (a, c) => b.order === 'low' ? a < c : a > c;
    const at = Math.floor(Date.now() / 1000), same = b.list.find(e => e.name.toLowerCase() === name.toLowerCase());
    let id = same?.id;
    if (same) { if (better(score, same.score)) Object.assign(same, { score, at, name }); }
    else { id = crypto.randomUUID().slice(0, 8); b.list.push({ id, name, score, at }); }
    b.list.sort((x, y) => (b.order === 'low' ? x.score - y.score : y.score - x.score) || x.at - y.at);
    b.list = b.list.slice(0, 10);
    await this.ctx.storage.put(k, b);
    const rank = b.list.findIndex(e => e.id === id) + 1;
    return { board: b, rank: rank || null, improved: !same || same.score === score };
  }
  async hsDel(slug, id) { const b = await this.hsGet(slug), n = b.list.length; b.list = b.list.filter(e => e.id !== id); await this.ctx.storage.put('hs2:' + slug, b); return n - b.list.length; }
  recent = new Map();
  cooldown(key, ms) {   // true = allowed now (kept in memory only)
    const now = Date.now(), last = this.recent.get(key) || 0;
    if (now - last < ms) return false;
    if (this.recent.size > 5000) this.recent.clear();
    this.recent.set(key, now); return true;
  }
}
async function knownSlug(env, url) {
  const slug = url.searchParams.get('g') || '';
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) throw fail(400, 'Unknown game.');
  const known = await env.ASSETS.fetch(new URL('/games.json', url)).then(r => r.json()).catch(() => []);
  if (!known.some(g => g.slug === slug)) throw fail(404, 'Unknown game.');
  return slug;
}
const fresh = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=15' } });
async function plays(req, env, url) {
  const box = env.PLAYS.get(env.PLAYS.idFromName('all'));
  if (url.pathname === '/api/stats') return fresh(await box.stats());
  if (url.pathname === '/api/here') {   // live count: POST ?id=<random tab id>&g=<game being played, or empty>[&leave=1]
    if (req.method !== 'POST') throw fail(405, 'Use POST.');
    const id = url.searchParams.get('id') || '', game = url.searchParams.get('g') || '';
    if (!/^[a-z0-9]{8,32}$/.test(id) || !/^[a-z0-9-]{0,60}$/.test(game)) throw fail(400, 'Bad check-in.');
    return new Response(JSON.stringify(await box.beat(id, game, url.searchParams.get('leave') === '1')), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
  if (url.pathname === '/api/stoke') {
    if (req.method !== 'POST') throw fail(405, 'Use POST.');
    await box.hit(await knownSlug(env, url), 'stokes', url.searchParams.get('undo') === '1' ? -1 : 1);   // ?undo=1 = unstoke
    return ok(await box.stats());
  }
  if (req.method === 'POST') return ok(await box.hit(await knownSlug(env, url)));
  return fresh(await box.all());
}

// shorten to n characters at a whole word, ending in "…" (never mid-word)
const clip = (text, n) => { text = text.replace(/\s+/g, ' ').trim(); return text.length <= n ? text : text.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[\s,;:–—-]+$/, '') + '…'; };
const fail = (status, msg) => Object.assign(new Error(msg), { status, msg });
const ok = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

// ---------- link previews: when a game or maker link is pasted into a chat, show its title, description and cover ----------
const attr = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function withPreview(req, env, url) {
  const page = await env.ASSETS.fetch(req);
  if (!page.ok || !(page.headers.get('content-type') || '').includes('text/html')) return page;
  try {
    const games = await env.ASSETS.fetch(new URL('/games.json', url)).then(r => r.json());
    let title, desc, image;
    if (url.pathname === '/play') {
      const g = games.find(x => x.slug === url.searchParams.get('g'));
      if (!g) return page;
      title = `${g.title} · UsForge`; desc = g.blurb || `A game by ${g.author} on UsForge.`; image = g.cover;
    } else {
      const want = (url.searchParams.get('n') || '').toLowerCase(), mine = games.filter(g => g.author.toLowerCase() === want);
      if (!mine.length) return page;   // (only real makers — never echo whatever was typed into the link)
      const name = mine[0].author;
      title = `${name} · UsForge`; desc = `${mine.length} game${mine.length === 1 ? '' : 's'} by ${name} on UsForge, a hub for AI games by Lazy Studios.`;
      image = mine.find(g => g.cover)?.cover;
    }
    const img = new URL(image ? '/' + image : '/og.jpg', url).href;
    const tags = [['og:site_name', 'UsForge'], ['og:type', 'website'], ['og:title', title], ['og:description', desc], ['og:image', img], ['og:url', url.href]]
      .map(([k, v]) => `<meta property="${k}" content="${attr(v)}">`).join('')
      + `<meta name="twitter:card" content="summary_large_image"><meta name="description" content="${attr(desc)}">`;
    return new HTMLRewriter()
      .on('title', { element(e) { e.setInnerContent(title); } })
      .on('meta[name="description"]', { element(e) { e.remove(); } })
      .on('head', { element(e) { e.append(tags, { html: true }); } })
      .transform(page);
  } catch (e) { return page; }
}

// ---------- accounts ----------
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
async function check(name, password) {
  const key = Object.keys(ACCOUNTS).find(k => k.toLowerCase() === String(name || '').trim().toLowerCase());
  if (key && password) {
    const [kind, ...rest] = ACCOUNTS[key].hash.split('$');
    let got = '';
    if (kind === 'sha256') got = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vax-attack:' + password)));   // same as Vax Attack
    if (kind === 'pbkdf2') {
      const [iter, salt] = rest, base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
      got = hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: +iter }, base, 256));
    }
    if (got && same(got, rest[rest.length - 1])) return { name: key, admin: !!ACCOUNTS[key].admin, founder: isFounder(key) };
  }
  await new Promise(r => setTimeout(r, 600));   // slow down guessing
  throw fail(401, 'Wrong name or password.');
}
async function login(req) { const b = await req.json(); return await check(b.name, b.password); }

// ---------- GitHub ----------
async function gh(env, path, opts = {}) {
  if (!env.GITHUB_TOKEN) throw fail(503, 'Uploads aren’t switched on yet — Taurus still needs to add the GitHub key in Cloudflare.');
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, { ...opts, headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'usforge', 'content-type': 'application/json' } });
  if (r.status === 404 && opts.soft) return null;
  if (!r.ok) throw fail(502, r.status === 409 || r.status === 422 ? 'Someone else was saving at the same moment — try again.' : `GitHub didn’t accept it (${r.status}).`);
  return r.json();
}
const b64text = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));
const b64bytes = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
async function readJson(env, path, ref) { const f = await gh(env, `/contents/${path}?ref=${ref}`, { soft: true }); return f ? JSON.parse(b64text(f.content)) : null; }

// one commit: `files` is [{ path, text } | { path, bytes } | { path, remove: true }]
async function commit(env, head, files, message) {
  const base = await gh(env, `/git/commits/${head}`), tree = [];
  for (const f of files) {
    if (f.remove) tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null });
    else if (f.text !== undefined) tree.push({ path: f.path, mode: '100644', type: 'blob', content: f.text });
    else if (f.sha) tree.push({ path: f.path, mode: '100644', type: 'blob', sha: f.sha });   // (sent earlier through /api/blobs)
    else { const blob = await gh(env, '/git/blobs', { method: 'POST', body: JSON.stringify({ content: b64bytes(f.bytes), encoding: 'base64' }) }); tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha }); }
  }
  const t = await gh(env, '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
  const c = await gh(env, '/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: t.sha, parents: [head] }) });
  await gh(env, `/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) });
}

// the list the home page reads, updated in the same commit as the game
function relist(list, entry, slug) {
  const games = (list || []).filter(g => g.slug !== slug);
  if (entry) games.push(entry);
  games.sort((a, b) => (b.added || 0) - (a.added || 0) || a.title.localeCompare(b.title));
  return JSON.stringify(games, null, 2) + '\n';
}
async function ownerCheck(env, head, slug, who) {
  const info = await readJson(env, `games/${slug}/game.json`, head);
  if (info && !who.admin && (info.owner || info.author || '').toLowerCase() !== who.name.toLowerCase()) throw fail(403, `“${slug}” belongs to ${info.owner || info.author}. Pick another folder name.`);
  return info;
}
// every file under a folder, with its git id (so files can be moved without re-uploading them)
async function entriesUnder(env, head, prefix) {
  const t = await gh(env, `/git/trees/${head}?recursive=1`);
  return t.tree.filter(x => x.type === 'blob' && x.path.startsWith(prefix)).map(x => ({ path: x.path, sha: x.sha }));
}
async function existingPaths(env, head, slug) {
  const t = await gh(env, `/git/trees/${head}?recursive=1`);
  return t.tree.filter(x => x.type === 'blob' && x.path.startsWith(`games/${slug}/`)).map(x => x.path);
}

// ---------- upload / update ----------
async function upload(req, env) {
  const form = await req.formData();
  const who = await check(form.get('name'), form.get('password'));
  const slug = String(form.get('slug') || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 40) throw fail(400, 'Folder name: lowercase letters, numbers and dashes only (like potato-dash).');
  const title = String(form.get('title') || '').trim().slice(0, 60), blurb = clip(String(form.get('blurb') || ''), 300);
  const link = String(form.get('url') || '').trim(), pixel = form.get('pixel') === 'true';
  if (!title) throw fail(400, 'Give your game a name.');
  if (link && !/^https:\/\/[^\s"<>]+$/.test(link)) throw fail(400, 'The link must start with https://');
  const picked = form.getAll('genre').map(g => String(g).toLowerCase());
  const genres = GENRES.filter(g => picked.includes(g.toLowerCase())).slice(0, 3);
  const dev = form.get('dev') === 'true';   // still in development
  const progress = dev && form.get('progress') !== null && form.get('progress') !== '' ? Math.max(0, Math.min(100, Math.round(+form.get('progress') || 0))) : null;
  const next = dev ? String(form.get('next') || '').trim().slice(0, 100) : '';

  // an optional cover picture sent on its own (drag-and-drop on the upload page); it wins over any cover in the game files
  const coverIn = form.get('cover');
  let coverPath = null;
  if (coverIn && typeof coverIn === 'object' && coverIn.size > 0) {
    const ext = (String(coverIn.name).match(/\.(png|jpe?g|webp|gif)$/i) || [])[1];
    if (!ext) throw fail(400, 'The cover must be a PNG, JPG, WEBP or GIF picture.');
    if (coverIn.size > 3 * 1024 * 1024) throw fail(400, 'That cover picture is over 3 MB — try a smaller one.');
    coverPath = `games/${slug}/cover.${ext.toLowerCase()}`;
  }
  const rootCover = p => new RegExp(`^games/${slug}/cover\\.(png|jpe?g|webp|gif)$`, 'i').test(p);

  // gather files; strip the top folder the browser adds ("MyGame/index.html" → "index.html")
  const raw = form.getAll('files').filter(f => typeof f === 'object' && f.size >= 0);
  const sent = form.getAll('blob').map(v => { try { return JSON.parse(v); } catch (e) { return null; } })   // pictures/sounds already sent via /api/blobs
    .filter(b => b && typeof b.path === 'string' && /^[0-9a-f]{40}$/.test(b.sha) && Number.isFinite(b.size));
  const names = raw.map(f => String(f.name).replace(/\\/g, '/'));
  const every = names.concat(sent.map(b => b.path.replace(/\\/g, '/')));
  const top = every.length && every.every(n => n.includes('/') && n.split('/')[0] === every[0].split('/')[0]) ? every[0].split('/')[0].length + 1 : 0;
  const files = [];
  let total = 0, binaries = 0;
  for (const b of sent) {
    const rel = b.path.replace(/\\/g, '/').slice(top);
    if (!rel || rel.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('.'))) continue;
    total += b.size; files.push({ path: `games/${slug}/${rel}`, sha: b.sha });
  }
  for (let i = 0; i < raw.length; i++) {
    let rel = names[i].slice(top);
    if (raw.length === 1 && /\.html?$/i.test(rel)) rel = 'index.html';   // a single HTML file is the game
    if (!rel || rel.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('.'))) continue;   // skip hidden files and anything odd
    total += raw[i].size;
    const bytes = new Uint8Array(await raw[i].arrayBuffer());
    let text;
    if (TEXT.test(rel)) { try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) {} }
    if (text === undefined) binaries++;
    files.push(text !== undefined ? { path: `games/${slug}/${rel}`, text } : { path: `games/${slug}/${rel}`, bytes });
  }
  const replacing = files.length > 0;   // new game files replace the old ones; no files = keep them
  if (coverPath) {
    for (let i = files.length - 1; i >= 0; i--) if (rootCover(files[i].path)) { if (files[i].text === undefined && !files[i].sha) binaries--; files.splice(i, 1); }
    files.push({ path: coverPath, bytes: new Uint8Array(await coverIn.arrayBuffer()) }); binaries++; total += coverIn.size;
  }
  if (files.length > MAX_FILES) throw fail(400, `That’s ${files.length} files — the limit is ${MAX_FILES}.`);
  if (binaries > MAX_BINARIES) throw fail(400, `Too many images/sounds (${binaries}) — the limit is ${MAX_BINARIES}. Combine some, or ask Taurus to add it.`);
  if (total > MAX_BYTES) throw fail(400, `That game is over ${MAX_BYTES / 1024 / 1024} MB — too big.`);
  const head = (await gh(env, `/git/ref/heads/${BRANCH}`)).object.sha;
  const before = await ownerCheck(env, head, slug, who);
  const waiting = await readJson(env, `review/${slug}/review.json`, head);   // an earlier submission still waiting?
  if (waiting && !who.admin && waiting.owner.toLowerCase() !== who.name.toLowerCase()) throw fail(403, `“${slug}” is waiting for review for ${waiting.owner}. Pick another folder name.`);
  const pendingFiles = waiting?.status === 'pending';
  // one look at the project: the live game's files, and any version waiting for review
  const everything = (before || waiting) ? await entriesUnder(env, head, '') : [];
  const liveTree = everything.filter(e => e.path.startsWith(`games/${slug}/`)), reviewTree = everything.filter(e => e.path.startsWith(`review/${slug}/`));
  // the files we build on: the waiting version if there is one, otherwise the live game
  const baseTree = pendingFiles ? reviewTree.filter(e => !e.path.endsWith('/review.json')).map(e => ({ path: e.path.replace(`review/${slug}/`, `games/${slug}/`), sha: e.sha })) : liveTree;
  const shaOf = new Map(baseTree.map(e => [e.path, e.sha]));
  const existing = [...shaOf.keys()];
  const kept = replacing
    // new game files replace the old ones, but the cover picture stays unless a new one came with them
    ? (coverPath || files.some(f => rootCover(f.path)) ? [] : existing.filter(rootCover))
    : existing.filter(p => !p.endsWith('/game.json') && !(coverPath && rootCover(p)));   // details-only edit keeps the files
  const playable = files.some(f => f.path === `games/${slug}/index.html`) || kept.includes(`games/${slug}/index.html`);
  if (replacing && !playable) throw fail(400, 'Your game needs an index.html at the top of its folder.');
  if (!playable && !link && !dev) throw fail(400, 'Choose your game’s folder (or HTML file), or give a link — or tick “Still in development” to post it as coming soon.');
  const owner = before?.owner || (before?.author && who.admin ? before.author : who.name);
  const info = { title, author: before?.author && who.admin ? before.author : who.name, owner, blurb, ...(pixel ? { pixel: true } : {}), ...(link && !playable ? { url: link } : {}),
    ...(genres.length ? { genres } : {}), ...(dev ? { dev: true, ...(progress !== null ? { progress } : {}), ...(next ? { next } : {}) } : {}) };
  const now = Math.floor(Date.now() / 1000), list = await readJson(env, 'games.json', head);
  const all = new Set([...files.map(f => f.path), ...kept]);
  const cover = COVERS.find(c => all.has(`games/${slug}/${c}`));
  const entry = { slug, title, author: info.author, owner, blurb, cover: cover ? `games/${slug}/${cover}` : null, pixel, url: info.url || null,
    genres, dev, progress: dev ? progress : null, next, build: playable || !!info.url, added: (list || []).find(g => g.slug === slug)?.added || now,
    ...((replacing ? files.some(f => f.text !== undefined && /usforge['"]?\s*:\s*['"]score/.test(f.text)) : (list || []).find(g => g.slug === slug)?.leaderboard) ? { leaderboard: true } : {}),
    ...((before && (replacing || coverPath)) ? { updated: now } : (list || []).find(g => g.slug === slug)?.updated ? { updated: (list || []).find(g => g.slug === slug).updated } : {}) };
  // updates to games already on the site, and anything a founder uploads, go live straight away
  if (who.admin || who.founder || before) {
    const livePaths = new Set(liveTree.map(e => e.path));
    const fromWaiting = kept.filter(p => !livePaths.has(p) && shaOf.has(p)).map(p => ({ path: p, sha: shaOf.get(p) }));   // (files kept from a waiting version)
    const stale = [...livePaths].filter(p => !all.has(p) && !p.endsWith('/game.json')).map(path => ({ path, remove: true }));   // old files (and an old cover) that were replaced
    await commit(env, head, [...files, ...fromWaiting, ...stale, ...reviewTree.map(e => ({ path: e.path, remove: true })),
      { path: `games/${slug}/game.json`, text: JSON.stringify(info, null, 2) + '\n' },
      { path: 'games.json', text: relist(list, entry, slug) }],
      `${before ? 'Update' : 'Add'} ${title} (by ${info.author}, via the upload page)`);
    return { ok: true, slug, updated: !!before, pending: false };
  }
  // a brand-new game from anyone who isn't a founder waits in review/<slug>/ until a founder approves it
  const toReview = p => p.replace(`games/${slug}/`, `review/${slug}/`);
  const staged = [...files.map(f => ({ ...f, path: toReview(f.path) })), ...kept.filter(p => shaOf.has(p)).map(p => ({ path: toReview(p), sha: shaOf.get(p) }))];
  const keep = new Set(staged.map(f => f.path));
  const clear = reviewTree.filter(e => !keep.has(e.path) && !e.path.endsWith('/review.json')).map(e => ({ path: e.path, remove: true }));
  const note = { slug, title, owner, author: info.author, submittedBy: who.name, founder: isFounder(who.name), submitted: now, kind: 'new', status: 'pending', info, entry };
  await commit(env, head, [...staged, ...clear, { path: `review/${slug}/review.json`, text: JSON.stringify(note, null, 2) + '\n' }],
    `Submit ${title} for review (by ${info.author})`);
  return { ok: true, slug, updated: false, pending: true };
}

// ---------- reviews: founders approve or reject what's waiting ----------
async function reviewNotes(env, head) {
  const t = await gh(env, `/git/trees/${head}?recursive=1`);
  const paths = t.tree.filter(x => x.type === 'blob' && /^review\/[a-z0-9-]+\/review\.json$/.test(x.path)).map(x => x.path);
  return (await Promise.all(paths.map(p => readJson(env, p, head)))).filter(Boolean);
}
async function reviews(req, env) {
  const b = await req.json(), who = await check(b.name, b.password);
  const head = (await gh(env, `/git/ref/heads/${BRANCH}`)).object.sha;
  const notes = await reviewNotes(env, head);
  const mine = n => n.owner.toLowerCase() === who.name.toLowerCase() || n.submittedBy.toLowerCase() === who.name.toLowerCase();
  const out = notes.filter(n => mine(n) || (who.founder && n.status === 'pending')).map(n => ({
    slug: n.slug, title: n.title, author: n.author, submittedBy: n.submittedBy, submitted: n.submitted, kind: n.kind, status: n.status,
    note: n.rejectNote || '', reviewer: n.reviewer || '', cover: n.entry?.cover ? n.entry.cover.replace(`games/${n.slug}/`, `review/${n.slug}/`) : null,
    mine: mine(n), canReview: who.founder && n.status === 'pending' && n.submittedBy.toLowerCase() !== who.name.toLowerCase(),
  }));
  return { founder: who.founder, reviews: out.sort((a, b) => a.submitted - b.submitted) };
}
async function review(req, env) {
  const b = await req.json(), who = await check(b.name, b.password), slug = String(b.slug || ''), action = String(b.action || '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw fail(400, 'Unknown game.');
  const head = (await gh(env, `/git/ref/heads/${BRANCH}`)).object.sha;
  const n = await readJson(env, `review/${slug}/review.json`, head);
  if (!n) throw fail(404, 'That game isn’t waiting for review any more.');
  const staged = await entriesUnder(env, head, `review/${slug}/`);
  const own = n.submittedBy.toLowerCase() === who.name.toLowerCase() || n.owner.toLowerCase() === who.name.toLowerCase();

  if (action === 'withdraw') {   // the uploader takes it back (or clears a "not approved" note)
    if (!own && !who.admin) throw fail(403, 'Only the person who sent it can take it back.');
    await commit(env, head, staged.map(e => ({ path: e.path, remove: true })), `Withdraw ${n.title} from review`);
    return { ok: true };
  }
  if (!who.founder) throw fail(403, 'Only the founders can review games.');
  if (n.status !== 'pending') throw fail(400, 'That one has already been reviewed.');
  if (n.submittedBy.toLowerCase() === who.name.toLowerCase()) throw fail(403, 'You sent this one, so another founder has to review it.');

  if (action === 'reject') {
    const reason = String(b.note || '').trim().slice(0, 300);
    const updated = { ...n, status: 'rejected', rejectNote: reason, reviewer: who.name, reviewed: Math.floor(Date.now() / 1000) };
    await commit(env, head, [...staged.filter(e => !e.path.endsWith('/review.json')).map(e => ({ path: e.path, remove: true })),
      { path: `review/${slug}/review.json`, text: JSON.stringify(updated, null, 2) + '\n' }], `Not approved: ${n.title} (reviewed by ${who.name})`);
    return { ok: true };
  }
  if (action !== 'approve') throw fail(400, 'Approve or reject?');
  // approve: move the files into games/<slug>/ (no re-upload — same git ids), replace the old version, list it
  const live = await entriesUnder(env, head, `games/${slug}/`);
  const moved = staged.filter(e => !e.path.endsWith('/review.json')).map(e => ({ path: e.path.replace(`review/${slug}/`, `games/${slug}/`), sha: e.sha }));
  const incoming = new Set(moved.map(e => e.path));
  const list = await readJson(env, 'games.json', head);
  const entry = { ...n.entry, added: (list || []).find(g => g.slug === slug)?.added || Math.floor(Date.now() / 1000) };
  await commit(env, head, [...moved,
    ...live.filter(e => !incoming.has(e.path) && !e.path.endsWith('/game.json')).map(e => ({ path: e.path, remove: true })),
    ...staged.map(e => ({ path: e.path, remove: true })),
    { path: `games/${slug}/game.json`, text: JSON.stringify(n.info, null, 2) + '\n' },
    { path: 'games.json', text: relist(list, entry, slug) }],
    `Approve ${n.title} (by ${n.author}, reviewed by ${who.name})`);
  return { ok: true };
}

// ---------- pictures and sounds, sent ahead in batches (each becomes a GitHub blob; the upload then points at them) ----------
async function blobs(req, env) {
  const form = await req.formData();
  await check(form.get('name'), form.get('password'));
  const list = form.getAll('files').filter(f => typeof f === 'object');
  if (!list.length) throw fail(400, 'No files.');
  if (list.length > BLOB_BATCH) throw fail(400, `At most ${BLOB_BATCH} files at a time.`);
  let size = 0;
  for (const f of list) { if (f.size > MAX_ONE_FILE) throw fail(400, `“${f.name}” is over 25 MB — too big.`); size += f.size; }
  if (size > BLOB_BATCH_BYTES * 1.5) throw fail(400, 'That batch is too big — try again.');
  const shas = [];
  for (const f of list) {
    const b = await gh(env, '/git/blobs', { method: 'POST', body: JSON.stringify({ content: b64bytes(new Uint8Array(await f.arrayBuffer())), encoding: 'base64' }) });
    shas.push(b.sha);
  }
  return { shas };
}

// ---------- founder picks (picks.json: [{ slug, by, at }]) ----------
async function pick(req, env) {
  const b = await req.json(), who = await check(b.name, b.password), slug = String(b.slug || '');
  if (!who.founder) throw fail(403, 'Only the founders can pick games.');
  const head = (await gh(env, `/git/ref/heads/${BRANCH}`)).object.sha;
  const games = (await readJson(env, 'games.json', head)) || [];
  const g = games.find(x => x.slug === slug);
  if (!g) throw fail(404, 'Unknown game.');
  let picks = (await readJson(env, 'picks.json', head)) || [];
  const on = !!b.on, had = picks.some(p => p.slug === slug);
  if (on === had) return { ok: true, picks };
  picks = on ? [...picks, { slug, by: who.name, at: Math.floor(Date.now() / 1000) }] : picks.filter(p => p.slug !== slug);
  await commit(env, head, [{ path: 'picks.json', text: JSON.stringify(picks, null, 2) + '\n' }], `${on ? 'Founder pick' : 'Unpick'}: ${g.title} (${who.name})`);
  return { ok: true, picks };
}

// ---------- game feedback: thumbs up/down + a short note, readable only by the game's maker and the founders ----------
const box = env => env.PLAYS.get(env.PLAYS.idFromName('all'));
async function feedbackAdd(req, env, url) {
  const slug = await knownSlug(env, url), b = await req.json().catch(() => ({}));
  const vote = b.vote === 'up' ? 'up' : b.vote === 'down' ? 'down' : null;
  const note = String(b.note || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!vote && !note) throw fail(400, 'Pick thumbs up or down, or write a note.');
  const ip = req.headers.get('cf-connecting-ip') || 'x';
  if (!(await box(env).cooldown(ip, 20000))) throw fail(429, 'Thanks! Give it a few seconds before sending more.');
  await box(env).fbAdd(slug, { id: crypto.randomUUID().slice(0, 8), vote, note, at: Math.floor(Date.now() / 1000) });
  return { ok: true };
}
async function readableGames(env, who) {   // founders read everything; members read their own games
  const games = await env.ASSETS.fetch(new Request('https://x/games.json')).then(r => r.json()).catch(() => []);
  return games.filter(g => who.founder || (g.owner || g.author || '').toLowerCase() === who.name.toLowerCase());
}
async function feedbackList(req, env) {
  const b = await req.json(), who = await check(b.name, b.password);
  const games = await readableGames(env, who), fb = await box(env).fbGet(games.map(g => g.slug));
  return { games: games.map(g => ({ slug: g.slug, title: g.title, author: g.author, mine: (g.owner || g.author || '').toLowerCase() === who.name.toLowerCase(),
    up: fb[g.slug].filter(e => e.vote === 'up').length, down: fb[g.slug].filter(e => e.vote === 'down').length, notes: fb[g.slug].slice().reverse() })) };
}
async function feedbackDelete(req, env) {
  const b = await req.json(), who = await check(b.name, b.password), slug = String(b.slug || '');
  if (!(await readableGames(env, who)).some(g => g.slug === slug)) throw fail(403, 'That isn’t your game.');
  return { ok: true, removed: await box(env).fbDel(slug, String(b.id || '')) };
}

// ---------- high scores (games send them with postMessage; see the Share page) ----------
async function scoreAdd(req, env, url) {
  const slug = await knownSlug(env, url), b = await req.json().catch(() => ({}));
  const name = String(b.name || '').replace(/\s+/g, ' ').trim(), score = Number(b.score);
  if (!/^[A-Za-z0-9 _-]{2,16}$/.test(name)) throw fail(400, 'Nicknames: 2–16 letters, numbers, spaces, - or _.');
  if (!Number.isFinite(score) || Math.abs(score) > 1e12) throw fail(400, 'That score doesn’t look right.');
  const ip = req.headers.get('cf-connecting-ip') || 'x';
  if (!(await box(env).cooldown('hs:' + ip, 4000))) throw fail(429, 'Slow down a little!');
  const order = b.order === 'low' ? 'low' : 'high', unit = String(b.unit || '').replace(/[^A-Za-z ]/g, '').slice(0, 12);
  return await box(env).hsAdd(slug, name, Math.round(score * 100) / 100, order, unit);
}
async function scoreDelete(req, env) {
  const b = await req.json(), who = await check(b.name, b.password), slug = String(b.slug || '');
  if (!(await readableGames(env, who)).some(g => g.slug === slug)) throw fail(403, 'That isn’t your game.');
  return { ok: true, removed: await box(env).hsDel(slug, String(b.id || '')) };
}

// ---------- member profiles (profiles.json: { Name: { icon, bio, fav } }) ----------
const AVATARS = ['gamepad', 'rocket', 'star', 'heart', 'flame', 'bolt', 'moon', 'sun', 'gem', 'crown', 'ghost', 'invader', 'robot', 'sword', 'shield', 'planet', 'music', 'brush', 'bulb', 'potato', 'pizza', 'leaf', 'cat', 'dice'];   // (same list as icons.js)
async function profile(req, env) {
  const b = await req.json(), who = await check(b.name, b.password);
  const icon = String(b.icon || '');
  if (icon && !AVATARS.includes(icon)) throw fail(400, 'Pick one of the avatars.');
  const bio = String(b.bio || '').replace(/\s+/g, ' ').trim().slice(0, 160), fav = String(b.fav || '');
  const head = (await gh(env, `/git/ref/heads/${BRANCH}`)).object.sha;
  const games = (await readJson(env, 'games.json', head)) || [];
  if (fav && !games.some(g => g.slug === fav)) throw fail(400, 'Pick a game that’s on UsForge.');
  const all = (await readJson(env, 'profiles.json', head)) || {};
  all[who.name] = { ...(icon ? { icon } : {}), ...(bio ? { bio } : {}), ...(fav ? { fav } : {}) };
  if (!Object.keys(all[who.name]).length) delete all[who.name];
  await commit(env, head, [{ path: 'profiles.json', text: JSON.stringify(all, null, 2) + '\n' }], `Profile: ${who.name}`);
  return { ok: true, profile: all[who.name] || {} };
}

// ---------- remove ----------
async function remove(req, env) {
  const b = await req.json(), who = await check(b.name, b.password), slug = String(b.slug || '');
  const head = (await gh(env, `/git/ref/heads/${BRANCH}`)).object.sha;
  const info = await ownerCheck(env, head, slug, who);
  if (!info) throw fail(404, 'That game isn’t there.');
  const gone = (await existingPaths(env, head, slug)).map(path => ({ path, remove: true }));
  await commit(env, head, [...gone, { path: 'games.json', text: relist(await readJson(env, 'games.json', head), null, slug) }], `Remove ${info.title} (by ${info.author})`);
  return { ok: true };
}

// ---------- accounts (admin only): add a friend from the password code they made on the upload page ----------
async function addMember(req, env) {
  const b = await req.json(), who = await check(b.name, b.password);
  if (!who.admin) throw fail(403, 'Only an admin can add accounts.');
  const member = String(b.member || '').trim(), hash = String(b.hash || '').trim();
  if (!/^[A-Za-z0-9_-]{2,16}$/.test(member)) throw fail(400, 'Account names: 2–16 letters, numbers, - or _.');
  if (!/^pbkdf2\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(hash)) throw fail(400, 'That password code doesn’t look right — ask them to copy it again.');
  const head = (await gh(env, `/git/ref/heads/${BRANCH}`)).object.sha;
  const list = (await readJson(env, 'accounts.json', head)) || {};
  const existing = Object.keys(list).find(k => k.toLowerCase() === member.toLowerCase());
  if (existing && list[existing].admin) throw fail(400, 'You can’t replace an admin account here.');
  if (existing) delete list[existing];
  list[member] = { hash };
  await commit(env, head, [{ path: 'accounts.json', text: JSON.stringify(list, null, 2) + '\n' }], `${existing ? 'Reset' : 'Add'} UsForge account: ${member}`);
  return { ok: true, member, reset: !!existing };
}
