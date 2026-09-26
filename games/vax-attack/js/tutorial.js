// First-run tutorial: four short prompts during your first Waves run (move → shoot → dash → grab a power-up).
// Each step finishes when you actually do the thing. It shows once per profile and can be skipped.
(() => {
  const V = window.VAX;
  const G = V.G, { t } = V;
  const $ = id => document.getElementById(id);
  const box = $('tutBox'), text = $('tutText'), stepEl = $('tutStep');
  const STEPS = ['move', 'shoot', 'dash', 'power', 'done'];
  let st = null;   // { i, t, moved, lx, ly }

  const done = () => { V.meta.data.tutDone = true; V.meta.save(); st = null; box.hidden = true; };
  $('tutSkip').onclick = () => { done(); V.input.release(); };
  function show() {
    const k = STEPS[st.i], touch = V.input.touchMode && k !== 'power' && k !== 'done';
    text.textContent = t('tut.' + k + (touch ? 'Touch' : k === 'shoot' && !V.ui.autofire ? 'Manual' : ''));
    stepEl.textContent = k === 'done' ? '' : `${st.i + 1}/4`;
    box.hidden = false; box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  }
  const next = () => { st.i++; st.t = 0; V.SND.pick(); show(); };

  V.tut = {
    update(dt) {
      const S = G.S, P = G.P;
      if (!st) {
        // start on the first real Waves run of this profile
        if (V.meta.data.tutDone || S.bot || S.mode !== 'waves' || S.wave !== 1 || S.cheated) return;
        st = { S, i: 0, t: 0, moved: 0, lx: P.x, ly: P.y }; show();
        return;
      }
      if (S.bot || S.cheated || st.S !== S) { box.hidden = true; st = null; return; }   // a new run starts the tutorial fresh
      st.t += dt;
      const k = STEPS[st.i];
      if (k === 'move') { st.moved += Math.hypot(P.x - st.lx, P.y - st.ly); st.lx = P.x; st.ly = P.y; if (st.moved > 50) next(); }
      else if (k === 'shoot') { if (S.kills > 0) next(); }
      else if (k === 'dash') { if (P.dashing > 0) next(); }
      else if (k === 'power') { if ((S.collected || 0) > 0 || st.t > 14) next(); }
      else if (st.t > 3.5) done();
    },
    hide() { box.hidden = true; },
    reset() { V.meta.data.tutDone = false; V.meta.save(); },
  };
  // leaving a run hides the prompt (it picks up again next time if you didn't finish)
  const toTitle = V.game.toTitle;
  V.game.toTitle = () => { if (st) { st = null; box.hidden = true; } toTitle(); };
  V.i18n.onChange(() => { if (st) show(); });
})();
