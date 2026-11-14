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
    '.star-hero .star-reset{position:absolute;z-index:3;left:50%;bottom:15%;transform:translateX(-50%);min-height:48px;padding:0 26px;border-radius:24px;' +
    'border:1px solid #bcd6ffcc;background:#0a1630e6;color:#eef5ff;box-shadow:0 0 18px #5aa0ff55;font:inherit;font-size:.85rem;letter-spacing:.03em;opacity:0;pointer-events:none;transition:opacity .5s ease;-webkit-tap-highlight-color:transparent}' +
    '.star-hero .star-reset.on{opacity:1;pointer-events:auto}' +
    '@media(max-width:700px){.star-hero{height:clamp(380px,68vh,640px);height:clamp(380px,68svh,640px)}}';
  document.head.appendChild(css);

  var host = document.createElement('section');
  host.className = 'star-hero';
  host.setAttribute('aria-label', 'Amalgam\u2122 compass star. Decorative; it shows no data.');
  var cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
  var hint = document.createElement('p'); hint.className = 'star-hint';
  hint.textContent = 'Flick a star to spin it. Drag outside the star to turn the whole thing any way.';
  var rbtn = document.createElement('button'); rbtn.type = 'button'; rbtn.className = 'star-reset'; rbtn.textContent = 'Recenter';
  var pad = document.createElement('div'); pad.className = 'star-pad'; pad.setAttribute('aria-hidden', 'true');
  host.appendChild(cv); host.appendChild(pad); host.appendChild(hint); host.appendChild(rbtn);
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
  var uX = 0, uY = 0, uvX = 0, uvY = 0, resetting = false, rOn = false;   /* the turn you give the whole star: unlimited range, keeps coasting, stays where you leave it */
  var ang = [0, 0, 0], vis = [0, 0, 0], w = [0, 0, 0], hot = [0, 0, 0], held = [0, 0, 0], tiltHeld = 0, rimHot = 0;   /* per layer: spun angle, spin speed (rad/s, + is clockwise), grab glow, fingers holding it */
  var MAXW = 30, FRICTION = 0.45, FLICK = 1.3;
  var pulses = [], touched = false, born = 0, clock = 0, last = 0, visible = true, running = false;

  function size() {
    var b = host.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    W = Math.max(1, Math.round(b.width * DPR)); H = Math.max(1, Math.round(b.height * DPR));
    cv.width = W; cv.height = H;
    R = Math.min(W, H) * 0.31; CX = W / 2; CY = H * 0.45;
    var pd = 2 * 1.45 * R / DPR;                        /* touch pad = the dial plus its outer rim, so only the star captures touches */
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
    var rot = L.rot + L.spin * t + vis[idx] - Math.PI / 2;
    var tips = [];
    /* decorative flex: each star breathes on its own beat and a ripple travels around its four points;
       it swells when the star is spun or held. Motion only, it carries no data. */
    var sp = Math.min(1, Math.abs(w[idx]) / 12), e = 0.07 + 0.2 * sp + 0.14 * hot[idx];
    var beat = Math.sin(t * (1.5 + idx * 0.55) + idx * 2.1), breath = 1 + e * beat;
    for (var k = 0; k < 4; k++) {
      var a = rot + k * Math.PI / 2, ph = k * Math.PI / 2;
      var ripple = Math.sin(t * 2.4 - ph * (idx % 2 ? -1 : 1) + idx);
      var len = L.r * (1 + 0.045 * Math.sin(t * 0.55 + k * 1.7 + L.rot * 3)) * breath * (1 + e * 0.7 * ripple) * (0.35 + 0.65 * grow);
      tips.push({ x: Math.cos(a) * len, y: Math.sin(a) * len, z: L.z + L.warp * Math.sin(t * 0.42 + ph + L.rot * 5) * (k % 2 ? 1 : -1) * 0.5 + e * 2.4 * Math.sin(t * 2.4 - ph + idx * 1.3) });
    }
    var tw = 0.16 + 1.3 * e, wv = [];                    /* strings twist in a wave that travels from tip to tip */
    for (var tq = 0; tq < 4; tq++) { var row = new Array(N + 1); for (var ti = 0; ti <= N; ti++) { var uu = ti / N; row[ti] = tw * Math.sin(uu * 4.4 - t * 2.1 + tq * 1.4 + idx * 0.9) * Math.sin(uu * Math.PI); } wv.push(row); }
    var buckets = L.north ? 5 : 1, shown = Math.round(N * grow), glow = (1 + kick * 0.9 + hot[idx] * 0.9 + Math.min(0.6, Math.abs(w[idx]) * 0.025)) * (1 + 0.28 * e * 4 * beat);
    for (var pass = 0; pass < 2; pass++) {
      ctx.lineWidth = (pass ? 0.8 : 4) * DPR;
      for (var b = 0; b < buckets; b++) {
        ctx.beginPath();
        for (var q = 0; q < 4; q++) {
          var P = tips[q], Q = tips[(q + 1) % 4];
          for (var i = 0; i <= shown; i++) {
            var u = i / N, red = 0;
            if (L.north) { red = q === 3 ? (1 - u) * (1 - u) : q === 0 ? u * u : 0; if (Math.min(4, Math.floor(red * 5)) !== b) continue; }
            var psA = wv[q][i], psB = wv[(q + 1) % 4][N - i], cA = Math.cos(psA), sA = Math.sin(psA), cB = Math.cos(psB), sB = Math.sin(psB);
            proj((P.x * cA - P.y * sA) * u, (P.x * sA + P.y * cA) * u, L.z + (P.z - L.z) * u, A);
            proj((Q.x * cB - Q.y * sB) * (1 - u), (Q.x * sB + Q.y * cB) * (1 - u), L.z + (Q.z - L.z) * (1 - u), B);
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
    ctx.lineWidth = (1 + rimHot) * DPR; ctx.strokeStyle = 'rgba(190,214,245,' + ((0.30 + 0.5 * rimHot) * g).toFixed(3) + ')';
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

  /* The centre is a window that never ends: rings of light stream outward from a vanishing point, forever,
     with a small spiral galaxy at the bottom and a singularity glowing in it. Spinning the layers makes the dive faster.
     Pure decoration. */
  var STREAKS = []; for (var si = 0; si < 120; si++) STREAKS.push({ a: Math.random() * TAU, z: Math.random(), l: 0.5 + Math.random() * 0.9, h: 190 + Math.random() * 90 });
  var dive = 0.2, QR = 0.74;
  function hsla(h, l, a) { return 'hsla(' + Math.round(h) + ',92%,' + l + '%,' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
  function drawCore(t, life, tx, ty) {
    var g = ease(life / 1.6); if (g <= 0) return;
    proj(0, 0, 0.3, A);
    var cx = A[0], cy = A[1], rp = R * 0.37 * scaleNow * (1 + kick * 0.14) * g;
    var vx = cx + Math.sin(ty) * rp * 0.55 + Math.sin(t * 0.37) * rp * 0.10, vy = cy - Math.sin(tx) * rp * 0.55 + Math.cos(t * 0.29) * rp * 0.10;   /* where it all converges */
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';        /* the void: hides the strings behind it so the window has depth */
    var vg = ctx.createRadialGradient(cx, cy, rp * 0.6, cx, cy, rp * 1.22);
    vg.addColorStop(0, 'rgba(1,3,10,0.97)'); vg.addColorStop(0.82, 'rgba(1,3,10,0.9)'); vg.addColorStop(1, 'rgba(1,3,10,0)');
    ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(cx, cy, rp * 1.22, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, rp, 0, TAU); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    var fr = dive - Math.floor(dive), k, n, th;
    for (k = 0; k < STREAKS.length; k++) {               /* warp streaks racing outward */
      var S = STREAKS[k], d = (S.z + dive * 0.55) % 1, r1 = rp * 1.3 * Math.pow(d, 2.3), r0 = r1 * (1 - 0.16 * S.l * (0.3 + d));
      var ca = Math.cos(S.a), sa = Math.sin(S.a);
      ctx.beginPath(); ctx.moveTo(vx + ca * r0, vy + sa * r0); ctx.lineTo(vx + ca * r1, vy + sa * r1);
      ctx.lineWidth = (0.5 + 1.3 * d) * DPR; ctx.strokeStyle = hsla(S.h, 82, d * d * 0.75 * g); ctx.stroke();
    }
    for (k = 0; k < 24; k++) {                           /* rings, each one deeper than the last, forever */
      var f = k - fr, r = rp * 1.18 * Math.pow(QR, f), q = Math.min(1.4, r / rp);
      var al = Math.min(1, r / (rp * 0.5)) * (r > rp ? Math.max(0, 1 - (r - rp) / (rp * 0.4)) : 1) * g;
      if (al <= 0.01 || r < 0.6 * DPR) continue;
      var kk = k + Math.floor(dive), rx = vx + (cx - vx) * Math.min(1, q), ry = vy + (cy - vy) * Math.min(1, q);   /* deeper rings slide toward the vanishing point */
      var tw = kk * 0.55 - dive * 1.1 - t * 0.12, hue = 215 + 75 * Math.sin(kk * 0.62 + t * 0.2), wob = 0.07 + 0.05 * Math.sin(kk * 1.3 + t * 0.8);
      ctx.beginPath();
      for (n = 0; n <= 72; n++) {
        th = n / 72 * TAU; var rr = r * (0.8 + 0.2 * Math.cos(4 * (th - tw)) + wob * Math.sin(7 * th + kk + t * 1.3));   /* four-pointed, like the star it lives in */
        var X = rx + Math.cos(th) * rr, Y = ry + Math.sin(th) * rr;
        if (n) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      ctx.lineWidth = (0.5 + 2.4 * Math.min(1, q)) * DPR;
      ctx.strokeStyle = hsla(hue, 66, al * 0.55); ctx.stroke();
      ctx.lineWidth = (0.4 + 0.6 * Math.min(1, q)) * DPR;
      ctx.strokeStyle = hsla(hue + 20, 88, al * 0.9); ctx.stroke();
    }
    var gr0 = rp * 0.17;                                 /* a small spiral galaxy at the very bottom */
    for (var arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (n = 0; n < 50; n++) {
        var u = n / 50, aa = arm * TAU / 3 + u * 6.2 + t * 0.8 + dive * 0.4, rd = gr0 * (0.1 + u * 0.9);
        var gx = vx + Math.cos(aa) * rd, gy = vy + Math.sin(aa) * rd * 0.8;
        ctx.moveTo(gx, gy); ctx.lineTo(gx + 0.01, gy + 0.01);
      }
      ctx.lineCap = 'round'; ctx.lineWidth = 1.8 * DPR; ctx.strokeStyle = hsla(200 + arm * 40, 85, 0.7 * g); ctx.stroke(); ctx.lineCap = 'butt';
    }
    var sr = rp * (0.20 + 0.03 * Math.sin(t * 1.1)) * (1 + kick * 0.5);   /* the singularity */
    var sg = ctx.createRadialGradient(vx, vy, 0, vx, vy, sr);
    sg.addColorStop(0, 'rgba(255,255,255,' + (0.95 * g).toFixed(3) + ')'); sg.addColorStop(0.18, 'rgba(200,235,255,' + (0.55 * g).toFixed(3) + ')');
    sg.addColorStop(0.5, 'rgba(110,120,255,' + (0.16 * g).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(90,60,220,0)');
    ctx.fillStyle = sg; ctx.fillRect(vx - sr, vy - sr, sr * 2, sr * 2);
    ctx.restore();
    ctx.lineWidth = 5 * DPR; ctx.strokeStyle = 'rgba(120,170,255,' + (0.10 * g).toFixed(3) + ')';   /* the window's own edge */
    ctx.beginPath(); ctx.arc(cx, cy, rp, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.2 * DPR; ctx.strokeStyle = 'rgba(205,228,255,' + (0.55 * g).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(cx, cy, rp, 0, TAU); ctx.stroke();
  }

  function draw(t) {
    var life = reduce ? 9 : t - born;
    var tx = tiltX + uX, ty = tiltY + uY;
    cX = Math.cos(tx); sX = Math.sin(tx); cY = Math.cos(ty); sY = Math.sin(ty);
    scaleNow = (1 + 0.035 * Math.sin(t * 0.33)) * (1 + kick * 0.07);   /* slow approach and retreat */
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i], a = d.d * (0.55 + 0.45 * Math.sin(t * 0.8 + d.p));
      ctx.fillStyle = 'rgba(200,222,255,' + a.toFixed(3) + ')';
      ctx.fillRect(((((d.x + ty * 0.03 * d.s) % 1) + 1) % 1) * W, d.y * H, d.s * DPR, d.s * DPR);
    }
    drawRing(t, life);
    for (var l = 0; l < LAYERS.length; l++) drawLayer(LAYERS[l], t, life, l);
    drawCore(t, life, tx, ty);
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
    var tk = Math.min(1, dt * (tiltHeld ? 18 : touched ? 3.5 : 1.5));   /* follows a finger on the rim closely, eases back slowly on its own */
    tiltX += (tgtX - tiltX) * tk; tiltY += (tgtY - tiltY) * tk; rimHot += ((tiltHeld ? 1 : 0) - rimHot) * Math.min(1, dt * 8);
    for (var l = 0; l < 3; l++) {                       /* a layer coasts and slows like a real spinner; a held layer follows the finger */
      if (!held[l]) { ang[l] += w[l] * dt; w[l] *= Math.exp(-FRICTION * dt); if (Math.abs(w[l]) < 0.05) w[l] = 0; }
      vis[l] += (ang[l] - vis[l]) * Math.min(1, dt * 30);   /* drawn angle chases the true one a hair behind: hides touch jitter */
      hot[l] += ((held[l] ? 1 : 0) - hot[l]) * Math.min(1, dt * 8);
    }
    if (resetting) {                                     /* Reset: every turn eases back to the start by the shortest way round */
      var rk = Math.min(1, dt * 3.5), done = true; uvX = uvY = 0;
      var ox = Math.round(uX / TAU), oy = Math.round(uY / TAU); uX += (ox * TAU - uX) * rk; uY += (oy * TAU - uY) * rk;
      if (Math.abs(uX - ox * TAU) > 0.003 || Math.abs(uY - oy * TAU) > 0.003) done = false;
      for (var rl = 0; rl < 3; rl++) { w[rl] = 0; var oa = Math.round(ang[rl] / TAU); ang[rl] += (oa * TAU - ang[rl]) * rk; if (Math.abs(ang[rl] - oa * TAU) > 0.003) done = false; }
      if (done) { resetting = false; uX = uY = 0; for (var rd = 0; rd < 3; rd++) { var o2 = Math.round(ang[rd] / TAU) * TAU; ang[rd] = 0; vis[rd] -= o2; } }
    } else if (!tiltHeld) {
      uX += uvX * dt; uY += uvY * dt; var uf = Math.exp(-1.1 * dt); uvX *= uf; uvY *= uf;
      if (Math.abs(uvX) < 0.01) uvX = 0; if (Math.abs(uvY) < 0.01) uvY = 0;
    }
    var off = resetting || Math.abs(uX - Math.round(uX / TAU) * TAU) > 0.06 || Math.abs(uY - Math.round(uY / TAU) * TAU) > 0.06;
    for (var rc = 0; rc < 3 && !off; rc++) off = Math.abs(w[rc]) > 0.05 || Math.abs(ang[rc] - Math.round(ang[rc] / TAU) * TAU) > 0.06;
    if (off !== rOn) { rOn = off; rbtn.classList.toggle('on', off); }
    dive += dt * (0.30 + Math.min(1.6, (Math.abs(w[0]) + Math.abs(w[1]) + Math.abs(w[2])) * 0.045));   /* spinning the layers speeds the dive */
    kick *= Math.pow(0.08, dt);
    draw(clock);
    requestAnimationFrame(frame);
  }
  function start() { if (running || reduce || !visible || document.hidden) return; running = true; last = 0; requestAnimationFrame(frame); }
  function stop() { running = false; }

  /* input. Grab the star where you touch it: outer, middle or inner layer. The layer follows the finger
     around the centre (clockwise finger = clockwise star) and keeps spinning when you let go.
     Grab the thin rim outside the star instead and the whole thing tilts on its axis while the layers keep spinning.
     Several fingers can do several of these at once. A quick tap sends a pulse. Vertical swipes outside the dial still scroll. */
  var grabs = {}, idleTimer = 0;
  function wake() { touched = true; hint.classList.remove('on'); clearTimeout(idleTimer); idleTimer = setTimeout(function () { touched = false; }, 3500); }
  function aim(e) { var b = host.getBoundingClientRect(); tgtY = ((e.clientX - b.left) / b.width - 0.5) * 0.9; tgtX = ((e.clientY - b.top) / b.height - 0.5) * 0.8; }
  function polar(e) {
    var b = pad.getBoundingClientRect(), dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
    return { a: Math.atan2(dy, dx), d: Math.hypot(dx, dy) / (R / DPR) };
  }
  pad.addEventListener('pointerdown', function (e) {
    var p = polar(e), i = p.d >= 1.0 ? -1 : p.d < 0.52 ? 2 : p.d < 0.80 ? 1 : 0;   /* -1 = the rim: tilts the whole star */
    grabs[e.pointerId] = { i: i, a: p.a, x0: e.clientX, y0: e.clientY, tx: e.clientX, ty: e.clientY, t0: performance.now(), moved: false, s: [], v: [] };
    resetting = false; if (i < 0) { uvX = uvY = 0; }
    if (i < 0) tiltHeld++; else { held[i]++; w[i] = 0; }
    wake(); host.classList.add('dragging');
    try { pad.setPointerCapture(e.pointerId); } catch (_) {}
    if (e.pointerType === 'mouse') e.preventDefault();
  });
  pad.addEventListener('pointermove', function (e) {
    var g = grabs[e.pointerId]; if (!g) return;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null; if (!evs || !evs.length) evs = [e];   /* every sample the phone reported, not one per frame */
    for (var k = 0; k < evs.length; k++) {
      var ev = evs[k];
      if (g.i < 0) {                                     /* rim: move the whole star on its axis; layer spin is untouched */
        if (Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0) > 8) g.moved = true;
        var ddx = (ev.clientX - g.tx) * 0.016, ddy = (ev.clientY - g.ty) * 0.016, tnow = performance.now();   /* a finger-width of travel turns it about a degree; no limit */
        uY += ddx; uX -= ddy; g.v.push([tnow, ddx, ddy]);
        while (g.v.length && tnow - g.v[0][0] > 100) g.v.shift();
        g.tx = ev.clientX; g.ty = ev.clientY; continue;
      }
      var p = polar(ev), da = p.a - g.a;
      if (p.d < 0.12) continue;                          /* dead centre: the angle is meaningless there */
      g.a = p.a;
      if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
      if (Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0) > 8) g.moved = true;
      ang[g.i] += da; var now = performance.now(); g.s.push([now, da]);
      while (g.s.length && now - g.s[0][0] > 100) g.s.shift();
    }
    wake(); if (reduce) { vis = ang.slice(); draw(clock); }
  });
  function release(e, cancelled) {
    var g = grabs[e.pointerId]; if (!g) return;
    delete grabs[e.pointerId];
    if (g.i < 0) tiltHeld = Math.max(0, tiltHeld - 1); else held[g.i] = Math.max(0, held[g.i] - 1);
    if (!held[0] && !held[1] && !held[2] && !tiltHeld) host.classList.remove('dragging');
    if (g.i < 0) {                                       /* let go of the rim while still moving: the star keeps turning and slows */
      var tn = performance.now(), sx = 0, sy = 0, f0 = tn, nv = g.v.length;
      for (var kv = 0; kv < nv; kv++) { sx += g.v[kv][1]; sy += g.v[kv][2]; if (g.v[kv][0] < f0) f0 = g.v[kv][0]; }
      if (g.moved && nv && tn - g.v[nv - 1][0] < 90 && !cancelled && !reduce) { var dtv = Math.max(0.03, (tn - f0) / 1000); uvY = Math.max(-14, Math.min(14, sx / dtv)); uvX = Math.max(-14, Math.min(14, -sy / dtv)); }
      return;
    }
    var now = performance.now(), n = g.s.length, sum = 0, first = now;
    for (var k = 0; k < n; k++) if (now - g.s[k][0] <= 100) { sum += g.s[k][1]; if (g.s[k][0] < first) first = g.s[k][0]; }
    var fresh = n && now - g.s[n - 1][0] < 90;           /* finger still moving when it lifted */
    if (g.moved && fresh && !reduce) w[g.i] = Math.max(-MAXW, Math.min(MAXW, FLICK * sum / Math.max(0.03, (now - first) / 1000)));
    else if (!g.moved && !cancelled && now - g.t0 < 500) { pulses.push(clock); kick = 1; if (reduce) draw(clock); }
  }
  rbtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  var lastHit = 0;
  function recenter() {
    var nowT = performance.now(); if (nowT - lastHit < 400) return; lastHit = nowT;   /* pointerup and click both land on a phone */
    uvX = uvY = 0; tgtX = 0.12; tgtY = 0; wake(); pulses.push(clock); kick = 1;     /* a ring and a flash show the tap landed */
    if (reduce) { uX = uY = 0; for (var q = 0; q < 3; q++) { ang[q] = 0; vis[q] = 0; w[q] = 0; } draw(0); return; }
    resetting = true;
  }
  rbtn.addEventListener('pointerup', recenter);
  rbtn.addEventListener('click', recenter);
  pad.addEventListener('pointerup', function (e) { release(e, false); });
  pad.addEventListener('pointercancel', function (e) { release(e, true); });
  host.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' && e.buttons === 0) { wake(); aim(e); } });
  window.__amalgamStarSpin = function () { return { ang: ang.slice(), w: w.slice(), held: held.slice(), tilt: [tiltX + uX, tiltY + uY], u: [uX, uY], resetting: resetting, tiltHeld: tiltHeld, pad: pad.getBoundingClientRect().toJSON(), r: R / DPR }; };
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
