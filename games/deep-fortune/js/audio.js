'use strict';
// ============================================================
//  Tiny synthesized sound effects (WebAudio, no files needed)
// ============================================================
let actx = null, master = null, muted = false;
function audio(){
  if (!actx){
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.connect(actx.destination);
    } catch(e){ return null; }
    if (typeof startMusic === 'function') startMusic();
  }
  if (actx.state === 'suspended') actx.resume();
  master.gain.value = muted ? 0 : settings.volume;
  return actx;
}
function tone(freq, dur, type='square', vol=.06, slide=0, delay=0){
  const a = audio(); if (!a || muted || settings.volume<=0) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq+slide), t0+dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0+dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0+dur+.02);
}
let noiseBuf = null;
function noise(dur, vol=.08, freq=800, type='lowpass'){
  const a = audio(); if (!a || muted || settings.volume<=0) return;
  if (!noiseBuf){ noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1; }
  const s = a.createBufferSource(); s.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = a.createGain(); g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime+dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(a.currentTime+dur+.02);
}
const SFX = {
  hit:    () => { noise(.06,.06,1600+Math.random()*600,'bandpass'); tone(180+Math.random()*60,.04,'square',.02); },
  break:  () => { noise(.14,.1,1100); tone(130,.1,'square',.03,-60); },
  ore:    () => { tone(660,.07,'square',.035); tone(990,.12,'square',.035,0,.06); },
  gem:    () => { tone(880,.08,'triangle',.05); tone(1320,.08,'triangle',.05,0,.06); tone(1760,.16,'triangle',.04,0,.12); },
  hurt:   () => tone(220,.2,'sawtooth',.07,-150),
  cash:   () => [523,659,784,1046].forEach((f,i)=>tone(f,.1,'square',.045,0,i*.07)),
  buy:    () => { tone(600,.06,'square',.04); tone(900,.08,'square',.04,0,.05); },
  place:  () => { tone(300,.05,'triangle',.07); noise(.04,.04,900); },
  pickup: () => tone(500,.06,'triangle',.06,200),
  crash:  () => { noise(.5,.22,380); tone(70,.4,'sawtooth',.06,-30); },
  creak:  () => tone(80+Math.random()*50,.3,'sawtooth',.022,25),
  sizzle: () => noise(.18,.05,3200,'highpass'),
  cough:  () => { noise(.08,.07,700); noise(.08,.05,600); },
  jump:   () => tone(250,.08,'square',.025,180),
  land:   () => noise(.06,.04,400),
  deny:   () => tone(120,.12,'square',.05),
  heal:   () => { tone(520,.12,'triangle',.06,300); tone(780,.14,'triangle',.05,300,.08); },
  click:  () => tone(700,.03,'square',.03),
  step:   () => noise(.03,.015,700),
  win:    () => [523,659,784,1046,1318,1568].forEach((f,i)=>tone(f,.18,'square',.05,0,i*.1)),
  die:    () => { tone(220,.3,'sawtooth',.07,-150); tone(110,.7,'sawtooth',.07,-70,.25); },
};

// (background music lives in music.js)

Object.assign(SFX, {
  swing:    () => noise(.07,.05,2400,'highpass'),
  enemyHit: () => { noise(.06,.08,900); tone(300,.06,'square',.04,-120); },
  enemyDie: () => { tone(420,.12,'square',.05,-300); noise(.15,.06,700); },
  squeak:   () => tone(1800+Math.random()*600,.05,'square',.015,400),
  splat:    () => noise(.1,.05,500),
  coin:     () => { tone(990,.05,'square',.035); tone(1320,.09,'square',.035,0,.05); },
  fuse:     () => tone(1400,.03,'square',.03),
  boom:     () => { noise(.9,.3,300); tone(60,.7,'sawtooth',.09,-30); noise(.3,.15,1500,'bandpass'); },
  chest:    () => [392,523,659,784,1046].forEach((f,i)=>tone(f,.1,'triangle',.05,0,i*.06)),
  teleport: () => { tone(300,.6,'sine',.06,900); tone(450,.6,'triangle',.03,1200,.05); },
  charge:   () => tone(500+Math.random()*200,.05,'sine',.02),
});

Object.assign(SFX, {
  drip:  () => tone(1500 + Math.random()*700, .07, 'sine', .018, -700),
  heart: () => { tone(58, .12, 'sine', .14); tone(52, .12, 'sine', .11, 0, .16); },
  jet:   () => noise(.08, .035, 900 + Math.random()*400, 'bandpass'),
  stomp: () => { noise(.2, .12, 220); tone(55, .2, 'sine', .08); },
  hint:  () => { tone(880,.08,'triangle',.04); tone(1320,.1,'triangle',.04,0,.08); },
});

SFX.achievement = () => [659,784,988,1318].forEach((f,i) => tone(f, .16, 'triangle', .06, 0, i*.09));

Object.assign(SFX, {
  roar:     () => { noise(1.2, .22, 160); tone(55, 1.1, 'sawtooth', .09, -25); tone(82, .9, 'square', .04, -40, .1); },
  rumble:   () => noise(1.2, .16, 120),
  fireball: () => { noise(.25, .1, 900, 'bandpass'); tone(200, .2, 'sawtooth', .04, -120); },
  moan:     () => { tone(220, 1.1, 'sine', .025, -60); tone(233, 1.1, 'sine', .018, -70, .05); },
});

SFX.rewind = () => { tone(900, .5, 'sawtooth', .04, -700); tone(1200, .45, 'square', .02, -900, .05); noise(.4, .05, 2000, 'highpass'); };
SFX.saved = () => tone(1046, .06, 'triangle', .025);

SFX.scan = () => { tone(600, .6, 'sine', .05, 900); tone(1200, .5, 'sine', .02, 600, .08); };

SFX.splash = () => { noise(.25, .09, 1200, 'bandpass'); tone(300, .12, 'sine', .03, -150); };

SFX.thunder = (v = 1) => { noise(2.2, .28*v, 140); noise(1.2, .16*v, 420); tone(42, 1.8, 'sine', .08*v, -12); };
