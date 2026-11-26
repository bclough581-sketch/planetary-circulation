/* Amalgam neon backdrop: a perspective floor grid receding to a horizon, plus a few drifting
   motes. One canvas, no library. It is deliberately cheap: capped device pixel ratio, ~30fps,
   stops dead when the tab is hidden, and draws a single static frame for anyone who has asked
   for reduced motion. Remove the html.tron class and none of this runs. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = document.createElement('canvas');
  cv.id = 'tron-grid';
  document.body.insertBefore(cv, document.body.firstChild);
  var ctx = cv.getContext('2d', { alpha: false });
  var W = 0, H = 0, dpr = 1, motes = [], streaks = [], t = 0, raf = 0, last = 0;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    motes = [];
    streaks = [];
    for (var q = 0; q < 18; q++) streaks.push({ p: Math.random(), v: 0.004 + Math.random() * 0.012, k: (Math.random() * 32 | 0) - 16, len: 0.06 + Math.random() * 0.1, hot: Math.random() < 0.22 });
    for (var i = 0; i < 26; i++) motes.push({ x: Math.random() * W, y: Math.random() * H, s: 0.12 + Math.random() * 0.35, r: Math.random() < 0.25 ? 1.6 : 1 });
  }

  function draw() {
    var hz = H * 0.40;
    var drift = Math.sin(t * 0.0016) * (W * 0.04);
    var cxp = W / 2 + drift;
    ctx.fillStyle = '#030406';
    ctx.fillRect(0, 0, W, H);

    // horizon flare, drawn as a gradient rather than a blur filter so it stays cheap and crisp
    var g = ctx.createLinearGradient(0, hz - 110, 0, hz + 26);
    g.addColorStop(0, 'rgba(255,59,59,0)');
    g.addColorStop(0.72, 'rgba(255,59,59,.06)');
    g.addColorStop(1, 'rgba(255,90,70,.20)');
    ctx.fillStyle = g; ctx.fillRect(0, hz - 110, W, 136);
    ctx.strokeStyle = 'rgba(255,120,100,.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, hz + .5); ctx.lineTo(W, hz + .5); ctx.stroke();

    // floor rows. p is raised to 2.6 so they bunch hard at the horizon and rush past underfoot
    var rows = 34, off = (t * 0.055) % 1;
    for (var i = 0; i < rows; i++) {
      var p = (i + off) / rows;
      var y = hz + (H - hz) * Math.pow(p, 2.6);
      if (y > H) continue;
      var a = 0.04 + 0.42 * p * p;
      ctx.strokeStyle = 'rgba(255,59,59,' + a.toFixed(3) + ')';
      ctx.lineWidth = p > 0.78 ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.lineWidth = 1;

    // rails fanning out of the vanishing point
    for (var k = -16; k <= 16; k++) {
      var ra = 0.26 - Math.abs(k) * 0.012;
      if (ra <= 0) continue;
      ctx.strokeStyle = 'rgba(255,59,59,' + ra.toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(cxp + k * 4, hz); ctx.lineTo(cxp + k * (W / 5), H); ctx.stroke();
    }

    // speed lines: short streaks riding the rails outward, the thing that reads as velocity
    for (var s = 0; s < streaks.length; s++) {
      var st = streaks[s];
      var sp1 = Math.pow(st.p, 2.6), sp2 = Math.pow(Math.max(0, st.p - st.len), 2.6);
      var y1 = hz + (H - hz) * sp1, y2 = hz + (H - hz) * sp2;
      var x1 = cxp + st.k * 4 + (st.k * (W / 5) - st.k * 4) * sp1;
      var x2 = cxp + st.k * 4 + (st.k * (W / 5) - st.k * 4) * sp2;
      ctx.strokeStyle = 'rgba(255,' + (st.hot ? '170,120' : '70,60') + ',' + (0.1 + 0.75 * st.p).toFixed(3) + ')';
      ctx.lineWidth = st.hot ? 2 : 1.3;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      st.p += st.v; if (st.p > 1.08) { st.p = 0; st.k = (Math.random() * 32 | 0) - 16; st.hot = Math.random() < 0.22; }
    }
    ctx.lineWidth = 1;

    // ceiling, amber and sparse, so the frame reads as a canopy and not a floor alone
    for (var j = 0; j < 12; j++) {
      var q = (j + off) / 12, yy = hz - hz * Math.pow(q, 2.4);
      ctx.strokeStyle = 'rgba(242,180,65,' + (0.02 + 0.12 * q * q).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
    }
    for (var n = 0; n < motes.length; n++) {
      var m = motes[n];
      ctx.fillStyle = m.r > 1 ? 'rgba(242,180,65,.55)' : 'rgba(255,59,59,.5)';
      ctx.fillRect(m.x, m.y, m.r, m.r);
      m.y -= m.s; if (m.y < 0) { m.y = H; m.x = Math.random() * W; }
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 24) return;                          // about 40fps, the motion needs it
    if (!document.documentElement.classList.contains('tron')) return;   // layer off: idle, draw nothing
    last = now; t += 1; draw();
  }

  function start() { if (!raf && !reduce) { last = 0; raf = requestAnimationFrame(loop); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  var canopy = document.createElement('div');
  canopy.id = 'tron-canopy';
  document.body.appendChild(canopy);

  size(); draw();
  if (!reduce) start();
  window.addEventListener('resize', function () { size(); draw(); }, { passive: true });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
})();
