/* AMALGAM star opening. Decorative only: the star, its motion and its colours
   carry no data and no evidence strength. It is the app icon, alive.
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
    'touch-action:pan-y;cursor:grab;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}' +
    '.star-hero.dragging{cursor:grabbing}' +
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
  hint.textContent = 'Drag to turn it. Tap to send a pulse.';
  host.appendChild(cv); host.appendChild(hint);
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

  var tiltX = 0.12, tiltY = 0, tgtX = 0.12, tgtY = 0, spinBoost = 0, extraRot = 0, kick = 0;
  var pulses = [], touched = false, born = 0, clock = 0, last = 0, visible = true, running = false;

  function size() {
    var b = host.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(b.width * DPR)); H = Math.max(1, Math.round(b.height * DPR));
    cv.width = W; cv.height = H;
    R = Math.min(W, H) * 0.36; CX = W / 2; CY = H * 0.45;
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
  function drawLayer(L, t, life) {
    var grow = ease((life - L.delay) / 1.9); if (grow <= 0) return;
    var rot = L.rot + L.spin * t + extraRot * (0.6 + L.z * 2.2) - Math.PI / 2;
    var tips = [];
    for (var k = 0; k < 4; k++) {
      var a = rot + k * Math.PI / 2;
      var len = L.r * (1 + 0.045 * Math.sin(t * 0.55 + k * 1.7 + L.rot * 3)) * (0.35 + 0.65 * grow);
      tips.push({ x: Math.cos(a) * len, y: Math.sin(a) * len, z: L.z + L.warp * Math.sin(t * 0.42 + k * Math.PI / 2 + L.rot * 5) * (k % 2 ? 1 : -1) * 0.5 });
    }
    var buckets = L.north ? 5 : 1, shown = Math.round(N * grow), glow = 1 + kick * 0.9;
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
    for (var l = 0; l < LAYERS.length; l++) drawLayer(LAYERS[l], t, life);
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
    extraRot += spinBoost * dt; spinBoost *= Math.pow(0.25, dt); kick *= Math.pow(0.08, dt);
    draw(clock);
    requestAnimationFrame(frame);
  }
  function start() { if (running || reduce || !visible || document.hidden) return; running = true; last = 0; requestAnimationFrame(frame); }
  function stop() { running = false; }

  /* input: hover or drag tilts, sideways drag spins, tap pulses. Vertical swipes still scroll the page. */
  var down = null, idleTimer = 0;
  function wake() { touched = true; hint.classList.remove('on'); clearTimeout(idleTimer); idleTimer = setTimeout(function () { touched = false; }, 3500); }
  function aim(e) { var b = host.getBoundingClientRect(); tgtY = ((e.clientX - b.left) / b.width - 0.5) * 0.9; tgtX = ((e.clientY - b.top) / b.height - 0.5) * 0.8; }
  host.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, lx: e.clientX, moved: false, t: performance.now() }; });
  host.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse' && !down) { wake(); aim(e); return; }
    if (!down) return;
    var dx = e.clientX - down.lx; down.lx = e.clientX;
    if (Math.abs(e.clientX - down.x) > 8) { down.moved = true; host.classList.add('dragging'); }
    if (down.moved) { wake(); spinBoost += dx * 0.012; aim(e); }
  });
  function up(e) {
    if (down && !down.moved && Math.abs(e.clientY - down.y) < 8 && performance.now() - down.t < 500) { wake(); pulses.push(clock); kick = 1; if (reduce) draw(clock); }
    down = null; host.classList.remove('dragging');
  }
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', function () { down = null; host.classList.remove('dragging'); });
  host.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') down = null; });
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
