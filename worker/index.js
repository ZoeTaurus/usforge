// UsForge upload service (a Cloudflare Worker). Serves the static site, plus a small /api that lets
// listed accounts upload, update or remove their own games. It saves by committing to the GitHub project,
// which then republishes the site. The GitHub key lives only in Cloudflare (the GITHUB_TOKEN secret).
import ACCOUNTS from '../accounts.json';

const REPO = 'ZoeTaurus/usforge', BRANCH = 'main';
const MAX_BYTES = 20 * 1024 * 1024, MAX_FILES = 250, MAX_BINARIES = 35;   // (Workers can only make ~50 requests per upload)
const TEXT = /\.(html?|js|mjs|css|json|txt|md|svg|csv|xml|glsl|frag|vert|map)$/i;
const COVERS = ['cover.png', 'cover.jpg', 'cover.jpeg', 'cover.webp', 'cover.gif'];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (req.method !== 'POST') throw fail(405, 'Use POST.');
      if (url.pathname === '/api/login') return ok(await login(req));
      if (url.pathname === '/api/upload') return ok(await upload(req, env));
      if (url.pathname === '/api/delete') return ok(await remove(req, env));
      if (url.pathname === '/api/member') return ok(await addMember(req, env));
      throw fail(404, 'No such thing.');
    } catch (e) {
      return new Response(JSON.stringify({ error: e.msg || 'Something went wrong on our side. Try again in a minute.' }), { status: e.status || 500, headers: { 'content-type': 'application/json' } });
    }
  },
};

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
  const title = String(form.get('title') || '').trim().slice(0, 60), blurb = String(form.get('blurb') || '').trim().slice(0, 140);
  const link = String(form.get('url') || '').trim(), pixel = form.get('pixel') === 'true';
  if (!title) throw fail(400, 'Give your game a name.');
  if (link && !/^https:\/\/[^\s"<>]+$/.test(link)) throw fail(400, 'The link must start with https://');

  // gather files; strip the top folder the browser adds ("MyGame/index.html" → "index.html")
  const raw = form.getAll('files').filter(f => typeof f === 'object' && f.size >= 0);
  const names = raw.map(f => String(f.name).replace(/\\/g, '/'));
  const top = names.length && names.every(n => n.includes('/') && n.split('/')[0] === names[0].split('/')[0]) ? names[0].split('/')[0].length + 1 : 0;
  const files = [];
  let total = 0, binaries = 0;
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
  if (files.length > MAX_FILES) throw fail(400, `That’s ${files.length} files — the limit is ${MAX_FILES}.`);
  if (binaries > MAX_BINARIES) throw fail(400, `Too many images/sounds (${binaries}) — the limit is ${MAX_BINARIES}. Combine some, or ask Taurus to add it.`);
  if (total > MAX_BYTES) throw fail(400, 'That game is over 20 MB — too big.');
  const head = (await gh(env, `/git/ref/heads/${BRANCH}`)).object.sha;
  const before = await ownerCheck(env, head, slug, who);
  const existing = before ? await existingPaths(env, head, slug) : [];
  const kept = files.length ? [] : existing.filter(p => !p.endsWith('/game.json'));   // details-only edit keeps the files
  const playable = files.some(f => f.path === `games/${slug}/index.html`) || kept.includes(`games/${slug}/index.html`);
  if (!playable && !link) throw fail(400, files.length ? 'Your game needs an index.html at the top of its folder.' : 'Choose your game’s folder (or HTML file), or give a link.');
  const owner = before?.owner || (before?.author && who.admin ? before.author : who.name);
  const info = { title, author: before?.author && who.admin ? before.author : who.name, owner, blurb, ...(pixel ? { pixel: true } : {}), ...(link && !playable ? { url: link } : {}) };
  const now = Math.floor(Date.now() / 1000), list = await readJson(env, 'games.json', head);
  const all = new Set([...files.map(f => f.path), ...kept]);
  const cover = COVERS.find(c => all.has(`games/${slug}/${c}`));
  const entry = { slug, title, author: info.author, owner, blurb, cover: cover ? `games/${slug}/${cover}` : null, pixel, url: info.url || null, added: (list || []).find(g => g.slug === slug)?.added || now };
  const stale = files.length ? existing.filter(p => !all.has(p) && !p.endsWith('/game.json')).map(path => ({ path, remove: true })) : [];
  await commit(env, head, [...files, ...stale,
    { path: `games/${slug}/game.json`, text: JSON.stringify(info, null, 2) + '\n' },
    { path: 'games.json', text: relist(list, entry, slug) }],
    `${before ? 'Update' : 'Add'} ${title} (by ${info.author}, via the upload page)`);
  return { ok: true, slug, updated: !!before };
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
