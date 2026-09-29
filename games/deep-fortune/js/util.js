'use strict';
// ============================================================
//  Small helpers: RNG, math, canvas, storage, settings
// ============================================================
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
let R = mulberry32(1);                         // world/sim RNG (re-seeded per world)
const ri = (a,b) => a + Math.floor(R()*(b-a+1));
const clamp = (v,a,b) => v<a ? a : v>b ? b : v;
const lerp = (a,b,t) => a + (b-a)*t;
const rgb = (c,m=1,a=1) => `rgba(${clamp(c[0]*m|0,0,255)},${clamp(c[1]*m|0,0,255)},${clamp(c[2]*m|0,0,255)},${a})`;
const $ = id => document.getElementById(id);
const I = (x,y) => y*WW + x;
const inb = (x,y) => x>=0 && x<WW && y>=0 && y<WH;
const fmtMoney = n => '$' + Math.floor(n).toLocaleString();
const fmtTime = t => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;

function mkCanvas(w,h){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c,x];
}

function b64enc(u8){ let s=''; for (let i=0;i<u8.length;i+=0x8000) s += String.fromCharCode.apply(null, u8.subarray(i,i+0x8000)); return btoa(s); }
function b64dec(str, len){ const s = atob(str), u = new Uint8Array(len); for (let i=0;i<len && i<s.length;i++) u[i] = s.charCodeAt(i); return u; }

const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v==null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } },
  del(k){ try { localStorage.removeItem(k); } catch(e){} },
};

const settings = Object.assign({ volume:.7, music:true, shake:true, softLight:true, minimap:true }, store.get(SETTINGS_KEY, {}));
function saveSettings(){ store.set(SETTINGS_KEY, settings); }
const shade = (c,m) => c.map(v => clamp(v*m|0, 0, 255));
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ---------- UsForge leaderboard ----------
function sendScoreToUsForge(seconds) {
  // only when running inside UsForge's page; does nothing when the game is opened on its own.
  // The board is "fastest retirement": a time in seconds, lowest wins (UsForge shows it as mm:ss).
  if (window.parent === window) return;
  try {
    window.parent.postMessage({ usforge: 'score', score: Math.round(seconds), order: 'low', unit: 'time' }, '*');
  } catch (e) {}
}
