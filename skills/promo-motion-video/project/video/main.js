/* Project timeline: scene functions of t, built on video/engine.js. Keep every visual decision a pure function of t. */
(function () {
  const { P, E, st, tr, split, rise, sink, vo, $, run, grain, clamp, lerp } = window.Engine;
  const C = window.CUES;
  let tick;

  function init() {
    ['#hookTitle', '#tagline', '#ctaTitle'].forEach(s => split($(s)));
    tick = grain($('#grain'), 0.05);
  }

  function hook(t) {
    rise($('#hookTitle')._w, t, vo('v01') || C.vo.v01);
    sink($('#hookTitle')._w, t, C.hook.impact - 0.45);
  }
  function brand(t) {
    const b = C.brand, q = P(t, b.logo, 0.9, E.outBack);
    st($('#logo'), `translate(-50%,-50%) scale(${lerp(0.7, 1, q).toFixed(4)})`, clamp((t - b.logo) / 0.2));
    rise($('#tagline')._w, t, vo('v03') || b.tagline);
  }
  function cta(t) {
    const c = C.cta;
    rise($('#ctaTitle')._w, t, vo('v04') || c.start + 0.3);
    const bq = P(t, c.button, 0.6, E.outBack), press = t >= c.click ? 1 - 0.06 * Math.exp(-(t - c.click) * 10) * Math.sin(Math.min(Math.PI, (t - c.click) * 20)) : 1;
    st($('#ctaBtn'), tr(0, (1 - bq) * 30, lerp(0.85, 1, bq) * press), clamp((t - c.button) / 0.15));
    st($('#ctaUrl'), tr((1 - P(t, c.url, 0.6)) * 30, 0), P(t, c.url, 0.6));
  }

  run({
    init,
    scenes: [
      { id: 'hook', a: 0, b: C.brand.start, fn: hook },
      { id: 'brand', a: C.brand.start, b: C.cta.start, fn: brand },
      { id: 'cta', a: C.cta.start, b: C.duration + 1, fn: cta },
    ],
    overlay: (t, frame) => {
      tick(frame);
      document.body.style.opacity = (1 - P(t, C.cta.fade, C.duration - C.cta.fade, E.inCubic)).toFixed(3); // fade out at the end
    },
  });
})();
