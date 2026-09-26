// Local profiles: sign in with a name (and optional passcode) so each player keeps their own DNA, Lab, Wardrobe and records.
// Everything lives in this browser's storage — it keeps saves apart, it is not real account security.
// Admin profiles unlock the command console. Only one-way hashes of their passwords are stored here.
(() => {
  const V = window.VAX;
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  // admin name → [SHA-256 hash, no-WebCrypto fallback hash] of its password
  const ADMINS = {
    Taurus: ['5caa77e74832f43bf8c03da1749f7dd6a3f9b22c4d56368f85cc646c589d853f', 'h-2093274291'],
    potato: ['0859753aa48401fe8e17aac4ed4ea881270743aa8da4297fd34574ecebdda22f', 'h687427133'],
  };
  const adminOf = n => Object.keys(ADMINS).find(k => k.toLowerCase() === (n || '').toLowerCase());
  const reg = get('vax-profiles') || {};
  let name = get('vax-profile');
  if (name && !reg[name]) name = null;

  const P = V.profile = {
    get name() { return name; },
    get isAdmin() { return !!name && name === adminOf(name); },
    isAdminName: n => !!n && n === adminOf(n),
    list: () => Object.keys(reg).sort((a, b) => (reg[b].last || 0) - (reg[a].last || 0)),
    hasPass: n => !!adminOf(n) || !!reg[n]?.pass,
    // progress keys are per profile; guests keep the original keys (so existing saves become the guest's)
    key: k => name ? k + '@' + name : k,
  };
  const clean = s => (s || '').trim().replace(/\s+/g, ' ').slice(0, 16);
  async function hash(s) {
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vax-attack:' + s));
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) {   // no WebCrypto (very old browsers / insecure origins): a plain string hash
      let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return 'h' + h;
    }
  }
  const find = n => Object.keys(reg).find(k => k.toLowerCase() === n.toLowerCase());

  // returns { err: translationKey } or switches profile (which reloads the page)
  P.signIn = async (rawName, pass = '') => {
    const n = clean(rawName);
    if (!n) return { err: 'auth.errName' };
    if (!/^[\p{L}\p{N} _.-]+$/u.test(n)) return { err: 'auth.errChars' };
    const admin = adminOf(n), id = admin || find(n) || n, rec = reg[id];
    if (admin) {   // admin passwords are fixed — they never come from what's saved in this browser
      if (!pass) return { err: 'auth.errNeedPass' };
      if (!ADMINS[admin].includes(await hash(pass))) return { err: 'auth.errWrong' };
      reg[id] ??= { created: Date.now(), pass: null };
    } else if (rec) {
      if (rec.pass && !pass) return { err: 'auth.errNeedPass' };
      if (rec.pass && rec.pass !== await hash(pass)) return { err: 'auth.errWrong' };
    } else {
      if (pass && pass.length < 4) return { err: 'auth.errShort' };
      reg[id] = { created: Date.now(), pass: pass ? await hash(pass) : null };
    }
    reg[id].last = Date.now();
    put('vax-profiles', reg); put('vax-profile', id);
    location.reload();
    return { ok: true };
  };
  P.signOut = () => { put('vax-profile', null); location.reload(); };
})();
