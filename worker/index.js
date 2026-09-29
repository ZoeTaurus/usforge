// UsForge upload service (a Cloudflare Worker). Serves the static site, plus a small /api that lets
// listed accounts upload, update or remove their own games. It saves by committing to the GitHub project,
// which then republishes the site. The GitHub key lives only in Cloudflare (the GITHUB_TOKEN secret).
import { DurableObject } from 'cloudflare:workers';
import ACCOUNTS from '../accounts.json';

const REPO = 'ZoeTaurus/usforge', BRANCH = 'main';
const MAX_BYTES = 60 * 1024 * 1024, MAX_FILES = 1000, MAX_BINARIES = 35;   // (Workers can only make ~50 requests per upload…)
const BLOB_BATCH = 30, BLOB_BATCH_BYTES = 12 * 1024 * 1024, MAX_ONE_FILE = 25 * 1024 * 1024;   // (…so pictures and sounds come first, in batches, via /api/blobs)
const TEXT = /\.(html?|js|mjs|css|json|txt|md|svg|csv|xml|glsl|frag|vert|map)$/i;
const COVERS = ['cover.png', 'cover.jpg', 'cover.jpeg', 'cover.webp', 'cover.gif'];
// the genres a game can be tagged with (up to 3) — the same list lives in site.js and scripts/build_list.py
const GENRES = ['Action', 'Adventure', 'Arcade', 'Boss rush', 'Casual', 'Crafting', 'Endless runner', 'Exploration', 'Fighting', 'Idle', 'Management', 'Open world', 'Physics', 'Platformer', 'Puzzle', 'Racing', 'Rhythm', 'Roguelike', 'RPG', 'Sandbox', 'Shooter', 'Simulation', 'Sports', 'Stealth', 'Strategy', 'Survival', 'Tower defense', 'Board game', 'Card game', 'Educational', 'Multiplayer', 'Party', 'Quiz', 'Text-based', 'Word game', 'Comedy', 'Fantasy', 'Horror', 'Mystery', 'Pixel art', 'Sci-fi', 'Space', 'Story'];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (['/api/plays', '/api/stats', '/api/stoke', '/api/here'].includes(url.pathname)) return await plays(req, env, url);
      if (req.method !== 'POST') throw fail(405, 'Use POST.');
      if (url.pathname === '/api/login') return ok(await login(req));
      if (url.pathname === '/api/upload') return ok(await upload(req, env));
      if (url.pathname === '/api/delete') return ok(await remove(req, env));
      if (url.pathname === '/api/member') return ok(await addMember(req, env));
      if (url.pathname === '/api/blobs') return ok(await blobs(req, env));
      throw fail(404, 'No such thing.');
    } catch (e) {
      return new Response(JSON.stringify({ error: e.msg || 'Something went wrong on our side. Try again in a minute.' }), { status: e.status || 500, headers: { 'content-type': 'application/json' } });
    }
  },
};

// ---------- play counts ----------
// One tiny Durable Object keeps every game's counts: plays, and stokes (the 🔥 "I love this" button).
//   GET  /api/plays → {slug: n}            POST /api/plays?g=slug adds a play
//   GET  /api/stats → {plays, stokes}      POST /api/stoke?g=slug adds a stoke
export class Plays extends DurableObject {
  async all(kind = 'counts') { return (await this.ctx.storage.get(kind)) || {}; }
  async hit(slug, kind = 'counts') {
    const c = await this.all(kind);
    c[slug] = (c[slug] || 0) + 1;
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
      if (now - v.t > 70000) { this.here.delete(k); continue; }
      if (v.game) games[v.game] = (games[v.game] || 0) + 1;
    }
    return { online: this.here.size, games };
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
    await box.hit(await knownSlug(env, url), 'stokes');
    return ok(await box.stats());
  }
  if (req.method === 'POST') return ok(await box.hit(await knownSlug(env, url)));
  return fresh(await box.all());
}

// shorten to n characters at a whole word, ending in "…" (never mid-word)
const clip = (text, n) => { text = text.replace(/\s+/g, ' ').trim(); return text.length <= n ? text : text.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[\s,;:–—-]+$/, '') + '…'; };
const fail = (status, msg) => Object.assign(new Error(msg), { status, msg });
const ok = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

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
    if (got && same(got, rest[rest.length - 1])) return { name: key, admin: !!ACCOUNTS[key].admin };
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
  const existing = before ? await existingPaths(env, head, slug) : [];
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
    genres, dev, progress: dev ? progress : null, next, build: playable || !!info.url, added: (list || []).find(g => g.slug === slug)?.added || now };
  const stale = existing.filter(p => !all.has(p) && !p.endsWith('/game.json')).map(path => ({ path, remove: true }));   // old files (and an old cover) that were replaced
  await commit(env, head, [...files, ...stale,
    { path: `games/${slug}/game.json`, text: JSON.stringify(info, null, 2) + '\n' },
    { path: 'games.json', text: relist(list, entry, slug) }],
    `${before ? 'Update' : 'Add'} ${title} (by ${info.author}, via the upload page)`);
  return { ok: true, slug, updated: !!before };
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
