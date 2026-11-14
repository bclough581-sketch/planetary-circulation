/* AMALGAM star opening. Decorative only: the star, its motion and its colours
   carry no data and no evidence strength. It is the app icon, alive.
   It is also a fidget spinner: grab the outer, middle or inner star and spin it
   either way; each layer keeps its own speed and direction, and several fingers
   can spin several layers at once.
   Self-contained: injects one section above <main>, no libraries, no network. */
(function () {
  'use strict';
  if (window.__amalgamStar) return; window.__amalgamStar = true;
  var main = document.querySelector('main'); if (!main) return;

  var css = document.createElement('style');
  css.textContent =
    '.star-hero{position:relative;height:clamp(420px,76vh,780px);height:clamp(420px,76svh,780px);overflow:hidden;' +
    'background:radial-gradient(ellipse 70% 55% at 78% 8%,#7a1f4a66,transparent 70%),' +
    'radial-gradient(ellipse 80% 60% at 12% 92%,#0f3f8a77,transparent 70%),' +
    'radial-gradient(ellipse at 50% 45%,#0a1838,#030712 78%);' +
    '-webkit-mask-image:linear-gradient(#000 88%,transparent);mask-image:linear-gradient(#000 88%,transparent);' +
    'touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}' +
    '.star-pad{position:absolute;z-index:2;border-radius:50%;touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none}' +
    '.star-hero.dragging .star-pad{cursor:grabbing}' +
    '.star-hero canvas{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    '.star-hero .star-hint{position:absolute;left:0;right:0;bottom:11%;margin:0;text-align:center;font-size:.82rem;' +
    'letter-spacing:.02em;color:#bcd3ee;opacity:0;transition:opacity 1.2s ease;pointer-events:none;text-shadow:0 0 12px #030712}' +
    '.star-hero .star-hint.on{opacity:.85}' +
    '@media(max-width:700px){.star-hero{height:clamp(380px,68vh,640px);height:clamp(380px,68svh,640px)}}';
  document.head.appendChild(css);

  var host = document.createElement('section');
  host.className = 'star-hero';
  host.setAttribute('aria-label', 'Amalgam compass star. Decorative; it shows no data.');
  var cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
  var hint = document.createElement('p'); hint.className = 'star-hint';
  hint.textContent = 'Flick a star to spin it. Each layer turns on its own.';
  var pad = document.createElement('div'); pad.className = 'star-pad'; pad.setAttribute('aria-hidden', 'true');
  host.appendChild(cv); host.appendChild(pad); host.appendChild(hint);
  main.parentNode.insertBefore(host, main);

  var ctx = cv.getContext('2d'); if (!ctx) { host.remove(); return; }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, DPR = 1, R = 0, CX = 0, CY = 0;
  var TAU = Math.PI * 2, N = 40;

  /* three nested string-art stars, outer to inner */
  var LAYERS = [
    { r: 1.00, z: 0.00, rot: 0.00, spin: -0.020, warp: 0.10, hue: [240, 247, 255], north: true,  delay: 0.00 },
    { r: 0.66, z: 0.16, rot: 0.62, spin: -0.046, warp: 0.30, hue: [110, 214, 255], north: false, delay: 0.25 },
    { r: 0.40, z: 0.30, rot: 1.31, spin: -0.082, warp: 0.42, hue: [205, 236, 255], north: false, delay: 0.50 }
  ];
  var RED = [255, 52, 104];

  var dust = []; for (var i = 0; i < 170; i++) dust.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.3 + 0.25, p: Math.random() * TAU, d: Math.random() * 0.6 + 0.2 });

  var tiltX = 0.12, tiltY = 0, tgtX = 0.12, tgtY = 0, kick = 0;
  var ang = [0, 0, 0], w = [0, 0, 0], hot = [0, 0, 0], held = [0, 0, 0];   /* per layer: spun angle, spin speed (rad/s, + is clockwise), grab glow, fingers holding it */
  var MAXW = 30, FRICTION = 0.45, FLICK = 1.3;
  var pulses = [], touched = false, born = 0, clock = 0, last = 0, visible = true, running = false;

  function size() {
    var b = host.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(b.width * DPR)); H = Math.max(1, Math.round(b.height * DPR));
    cv.width = W; cv.height = H;
    R = Math.min(W, H) * 0.36; CX = W / 2; CY = H * 0.45;
    var pd = 2 * 1.13 * R / DPR;                       /* touch pad = the dial, so only the star captures touches */
    pad.style.width = pad.style.height = pd + 'px';
    pad.style.left = (CX / DPR - pd / 2) + 'px'; pad.style.top = (CY / DPR - pd / 2) + 'px';
    if (!running) draw(clock);
  }

  var cX = 1, sX = 0, cY = 1, sY = 0, scaleNow = 1;
  function proj(x, y, z, out) {             /* unit coords -> screen px with tilt and perspective */
    var y1 = y * cX - z * sX, z1 = y * sX + z * cX;
    var x2 = x * cY + z1 * sY, z2 = -x * sY + z1 * cY;
    var f = 3.2 / (3.2 - z2);
    out[0] = CX + x2 * f * R * scaleNow; out[1] = CY + y1 * f * R * scaleNow;
  }
  function ease(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - Math.pow(1 - t, 3); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }

  var A = [0, 0], B = [0, 0];
  function drawLayer(L, t, life, idx) {
    var grow = ease((life - L.delay) / 1.9); if (grow <= 0) return;
    var rot = L.rot + L.spin * t + ang[idx] - Math.PI / 2;
    var tips = [];
    for (var k = 0; k < 4; k++) {
      var a = rot + k * Math.PI / 2;
      var len = L.r * (1 + 0.045 * Math.sin(t * 0.55 + k * 1.7 + L.rot * 3)) * (0.35 + 0.65 * grow);
      tips.push({ x: Math.cos(a) * len, y: Math.sin(a) * len, z: L.z + L.warp * Math.sin(t * 0.42 + k * Math.PI / 2 + L.rot * 5) * (k % 2 ? 1 : -1) * 0.5 });
    }
    var buckets = L.north ? 5 : 1, shown = Math.round(N * grow), glow = 1 + kick * 0.9 + hot[idx] * 0.9 + Math.min(0.6, Math.abs(w[idx]) * 0.025);
    for (var pass = 0; pass < 2; pass++) {
      ctx.lineWidth = (pass ? 0.8 : 4) * DPR;
      for (var b = 0; b < buckets; b++) {
        ctx.beginPath();
        for (var q = 0; q < 4; q++) {
          var P = tips[q], Q = tips[(q + 1) % 4];
          for (var i = 0; i <= shown; i++) {
            var u = i / N, red = 0;
            if (L.north) { red = q === 3 ? (1 - u) * (1 - u) : q === 0 ? u * u : 0; if (Math.min(4, Math.floor(red * 5)) !== b) continue; }
            proj(P.x * u, P.y * u, L.z + (P.z - L.z) * u, A);
            proj(Q.x * (1 - u), Q.y * (1 - u), L.z + (Q.z - L.z) * (1 - u), B);
            ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
          }
        }
        var col = L.north ? mix(L.hue, RED, b / 4) : L.hue;
        ctx.strokeStyle = rgba(col, Math.min(1, (pass ? 0.5 : 0.075) * glow * (b ? 1.25 : 1)));
        ctx.stroke();
      }
    }
  }

  function drawRing(t, life) {
    var g = ease((life - 0.6) / 1.6); if (g <= 0) return;
    var rr = 1.13, turn = t * 0.008;
    ctx.lineWidth = 1 * DPR; ctx.strokeStyle = 'rgba(190,214,245,' + (0.30 * g).toFixed(3) + ')';
    ctx.beginPath();
    for (var i = 0; i <= 120 * g; i++) { var a = turn + i / 120 * TAU - Math.PI / 2; proj(Math.cos(a) * rr, Math.sin(a) * rr, -0.05, A); if (i) ctx.lineTo(A[0], A[1]); else ctx.moveTo(A[0], A[1]); }
    ctx.stroke();
    ctx.beginPath();
    for (var k = 0; k < 72 * g; k++) {
      var b = turn + k / 72 * TAU - Math.PI / 2, inn = k % 18 === 0 ? 1.045 : k % 6 === 0 ? 1.075 : 1.098;
      proj(Math.cos(b) * rr, Math.sin(b) * rr, -0.05, A); proj(Math.cos(b) * inn, Math.sin(b) * inn, -0.05, B);
      ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
    }
    ctx.stroke();
  }

  function drawCore(t, life) {
    var g = ease(life / 1.2), r = R * 0.5 * scaleNow * (1 + kick * 0.5);
    proj(0, 0, 0.3, A);
    var gr = ctx.createRadialGradient(A[0], A[1], 0, A[0], A[1], r);
    gr.addColorStop(0, 'rgba(255,255,255,' + (0.85 * g).toFixed(3) + ')');
    gr.addColorStop(0.08, 'rgba(190,232,255,' + (0.42 * g).toFixed(3) + ')');
    gr.addColorStop(0.4, 'rgba(70,150,255,' + (0.10 * g).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(40,110,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(A[0] - r, A[1] - r, r * 2, r * 2);
    /* a few live filaments from the centre, one red, as on the icon */
    for (var f = 0; f < 4; f++) {
      var base = f * 1.9 + t * 0.07 * (f % 2 ? 1 : -1);
      ctx.beginPath(); ctx.moveTo(A[0], A[1]);
      for (var s = 1; s <= 14; s++) {
        var u = s / 14, ang = base + Math.sin(t * 0.9 + f * 2.1 + u * 5) * 0.55 * u + Math.sin(t * 1.7 + f + u * 11) * 0.18;
        var d = u * (0.26 + 0.05 * Math.sin(t * 0.6 + f)) * g;
        proj(Math.cos(ang) * d, Math.sin(ang) * d, 0.3, B); ctx.lineTo(B[0], B[1]);
      }
      ctx.lineWidth = (f ? 0.9 : 1.3) * DPR;
      ctx.strokeStyle = f ? 'rgba(170,228,255,' + (0.45 * g).toFixed(3) + ')' : 'rgba(255,70,110,' + (0.75 * g).toFixed(3) + ')';
      ctx.stroke();
    }
  }

  function draw(t) {
    var life = reduce ? 9 : t - born;
    cX = Math.cos(tiltX); sX = Math.sin(tiltX); cY = Math.cos(tiltY); sY = Math.sin(tiltY);
    scaleNow = (1 + 0.035 * Math.sin(t * 0.33)) * (1 + kick * 0.07);   /* slow approach and retreat */
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i], a = d.d * (0.55 + 0.45 * Math.sin(t * 0.8 + d.p));
      ctx.fillStyle = 'rgba(200,222,255,' + a.toFixed(3) + ')';
      ctx.fillRect(((d.x + tiltY * 0.03 * d.s) % 1) * W, d.y * H, d.s * DPR, d.s * DPR);
    }
    drawRing(t, life);
    for (var l = 0; l < LAYERS.length; l++) drawLayer(LAYERS[l], t, life, l);
    drawCore(t, life);
    for (var p = pulses.length - 1; p >= 0; p--) {
      var age = t - pulses[p]; if (age > 1.8) { pulses.splice(p, 1); continue; }
      var pr = ease(age / 1.8) * 1.55;
      ctx.beginPath();
      for (var k = 0; k <= 90; k++) { var an = k / 90 * TAU; proj(Math.cos(an) * pr, Math.sin(an) * pr, 0, A); if (k) ctx.lineTo(A[0], A[1]); else ctx.moveTo(A[0], A[1]); }
      ctx.lineWidth = 1.6 * DPR; ctx.strokeStyle = 'rgba(205,235,255,' + (0.6 * (1 - age / 1.8)).toFixed(3) + ')'; ctx.stroke();
    }
  }

  function frame(ms) {
    if (!running) return;
    var now = ms / 1000, dt = Math.min(0.05, now - (last || now)); last = now;
    if (!document.body.classList.contains('motion-paused')) clock += dt;
    if (!touched) { tgtX = 0.12 + 0.10 * Math.sin(clock * 0.21); tgtY = 0.16 * Math.sin(clock * 0.17); }
    tiltX += (tgtX - tiltX) * Math.min(1, dt * 3.5); tiltY += (tgtY - tiltY) * Math.min(1, dt * 3.5);
    for (var l = 0; l < 3; l++) {                       /* a layer coasts and slows like a real spinner; a held layer follows the finger */
      if (!held[l]) { ang[l] += w[l] * dt; w[l] *= Math.exp(-FRICTION * dt); if (Math.abs(w[l]) < 0.05) w[l] = 0; }
      hot[l] += ((held[l] ? 1 : 0) - hot[l]) * Math.min(1, dt * 8);
    }
    kick *= Math.pow(0.08, dt);
    draw(clock);
    requestAnimationFrame(frame);
  }
  function start() { if (running || reduce || !visible || document.hidden) return; running = true; last = 0; requestAnimationFrame(frame); }
  function stop() { running = false; }

  /* input. Grab the star where you touch it: outer, middle or inner layer. The layer follows the finger
     around the centre (clockwise finger = clockwise star) and keeps spinning when you let go.
     Several fingers can hold several layers. A quick tap sends a pulse. Vertical swipes outside the dial still scroll. */
  var grabs = {}, idleTimer = 0;
  function wake() { touched = true; hint.classList.remove('on'); clearTimeout(idleTimer); idleTimer = setTimeout(function () { touched = false; }, 3500); }
  function aim(e) { var b = host.getBoundingClientRect(); tgtY = ((e.clientX - b.left) / b.width - 0.5) * 0.9; tgtX = ((e.clientY - b.top) / b.height - 0.5) * 0.8; }
  function polar(e) {
    var b = pad.getBoundingClientRect(), dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
    return { a: Math.atan2(dy, dx), d: Math.hypot(dx, dy) / (R / DPR) };
  }
  pad.addEventListener('pointerdown', function (e) {
    var p = polar(e), i = p.d < 0.5 ? 2 : p.d < 0.83 ? 1 : 0;
    grabs[e.pointerId] = { i: i, a: p.a, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, s: [] };
    held[i]++; w[i] = 0; wake(); host.classList.add('dragging');
    try { pad.setPointerCapture(e.pointerId); } catch (_) {}
    if (e.pointerType === 'mouse') e.preventDefault();
  });
  pad.addEventListener('pointermove', function (e) {
    var g = grabs[e.pointerId]; if (!g) return;
    var p = polar(e), da = p.a - g.a; g.a = p.a;
    if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
    if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8) g.moved = true;
    if (p.d < 0.06) return;                              /* dead centre: the angle is meaningless there */
    ang[g.i] += da; var now = performance.now(); g.s.push([now, da]);
    while (g.s.length && now - g.s[0][0] > 100) g.s.shift();
    wake(); if (reduce) draw(clock);
  });
  function release(e, cancelled) {
    var g = grabs[e.pointerId]; if (!g) return;
    delete grabs[e.pointerId]; held[g.i] = Math.max(0, held[g.i] - 1);
    if (!held[0] && !held[1] && !held[2]) host.classList.remove('dragging');
    var now = performance.now(), n = g.s.length, sum = 0, first = now;
    for (var k = 0; k < n; k++) if (now - g.s[k][0] <= 100) { sum += g.s[k][1]; if (g.s[k][0] < first) first = g.s[k][0]; }
    var fresh = n && now - g.s[n - 1][0] < 90;           /* finger still moving when it lifted */
    if (g.moved && fresh && !reduce) w[g.i] = Math.max(-MAXW, Math.min(MAXW, FLICK * sum / Math.max(0.03, (now - first) / 1000)));
    else if (!g.moved && !cancelled && now - g.t0 < 500) { pulses.push(clock); kick = 1; if (reduce) draw(clock); }
  }
  pad.addEventListener('pointerup', function (e) { release(e, false); });
  pad.addEventListener('pointercancel', function (e) { release(e, true); });
  host.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' && e.buttons === 0) { wake(); aim(e); } });
  window.__amalgamStarSpin = function () { return { ang: ang.slice(), w: w.slice(), held: held.slice(), pad: pad.getBoundingClientRect().toJSON(), r: R / DPR }; };
  window.addEventListener('deviceorientation', function (e) {
    if (touched || e.gamma == null || e.beta == null) return;
    tgtY = Math.max(-0.45, Math.min(0.45, e.gamma / 60)); tgtX = Math.max(-0.35, Math.min(0.5, (e.beta - 45) / 70));
  });

  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; visible ? start() : stop(); }).observe(host);
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(host); else window.addEventListener('resize', size);
  size();
  if (reduce) { draw(0); } else { start(); setTimeout(function () { if (!touched) hint.classList.add('on'); }, 3200); }
})();
