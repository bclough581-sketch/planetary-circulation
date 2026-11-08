/* Amalgam rings: pure logic for the luopan-style ring view. No DOM, no network.
   Everything here describes TODAY'S measured readings. Nothing forecasts, nothing recommends. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Rings = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 864e5;
  var MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Hubs in the order they sit on the dial: west to east by longitude, so the dial reads like a sweep around the planet.
  var HUBS = [
    { id: 'HOU', name: 'Houston', sig: 'WTI crude', lon: -95.4 },
    { id: 'NYC', name: 'New York', sig: 'US 10y yield', lon: -74.0 },
    { id: 'GRU', name: 'São Paulo', sig: 'EUR/BRL', lon: -46.6 },
    { id: 'LON', name: 'London', sig: 'EUR/GBP', lon: -0.1 },
    { id: 'ZRH', name: 'Zurich', sig: 'EUR/CHF', lon: 8.5 },
    { id: 'FRA', name: 'Frankfurt', sig: 'EUR/USD', lon: 8.7 },
    { id: 'JNB', name: 'Johannesburg', sig: 'EUR/ZAR', lon: 28.0 },
    { id: 'DXB', name: 'Dubai', sig: 'Brent crude', lon: 55.3 },
    { id: 'BOM', name: 'Mumbai', sig: 'EUR/INR', lon: 72.9 },
    { id: 'SHA', name: 'Shanghai', sig: 'EUR/CNY', lon: 121.5 },
    { id: 'TYO', name: 'Tokyo', sig: 'EUR/JPY', lon: 139.7 },
    { id: 'SYD', name: 'Sydney', sig: 'EUR/AUD', lon: 151.2 }
  ];
  var CHOKE_ORDER = ['PAN', 'CAP', 'SUZ', 'BAB', 'HRM', 'MAL']; // west to east by longitude

  // Freshness gates, same as LICENSES.md (FX and yield 5 days, oil 12, chokepoints 21): older values grey out and drop out of the alignment count.
  var MAX_AGE_DAYS = { ecb: 5, ust: 5, eia: 12, choke: 21 };
  var maxAge = function (d) { return MAX_AGE_DAYS[d && d.src] || MAX_AGE_DAYS.ecb; };
  var JOB_STALE_HOURS = 48;

  // Thresholds fixed in advance (not tuned to outcomes). "In tail" is a description of today's reading only.
  var TAIL = { season: 0.8, range: 0.8, move: 0.9, chokeRatio: 0.8 };

  var clamp01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var mod = function (a, n) { return ((a % n) + n) % n; };

  function ageDays(asof, now) {
    var t = Date.parse(asof + 'T00:00:00Z');
    return isFinite(t) ? (now - t) / DAY : Infinity;
  }

  // Calendar curve, not measured data: 1 in January, 0 in July. Labeled as a calendar everywhere it appears.
  function seasonIndex(m) { return 0.5 * (1 + Math.cos(2 * Math.PI * m / 12)); }

  // hist is newest first: [[date, value], ...]. Yields use point changes (bp); everything else uses % returns.
  function moveStats(hist, isYield) {
    if (!Array.isArray(hist) || hist.length < 8) return null;
    var moves = [];
    for (var i = 0; i < hist.length - 1; i++) {
      var a = hist[i][1], b = hist[i + 1][1];
      if (!isFinite(a) || !isFinite(b) || b === 0) continue;
      moves.push(isYield ? (a - b) * 100 : (a / b - 1) * 100);
    }
    if (moves.length < 7) return null;
    var latest = moves[0], mag = Math.abs(latest), others = moves.slice(1), le = 0;
    for (var j = 0; j < others.length; j++) if (Math.abs(others[j]) <= mag) le++;
    return { move: latest, pct: le / others.length, n: others.length };
  }

  function fmt(x, dp) { return (x >= 0 ? '+' : '') + x.toFixed(dp); }

  function buildRings(data, now, month) {
    now = now == null ? Date.now() : now;
    var m = month == null ? new Date(now).getMonth() : month;
    var hubs = (data && data.hubs) || {};
    var chokes = {};
    ((data && data.chokepoints) || []).forEach(function (c) { chokes[c.id] = c; });

    var season = MONTHS.map(function (l, i) {
      var t = seasonIndex(i);
      return { id: 'M' + i, label: l, name: MONTH_NAMES[i], t: t, dir: 0, elevated: t >= TAIL.season, stale: false, asof: null,
        text: 'northern winter-ness ' + t.toFixed(2) + ' (calendar curve, not measured)', current: i === m };
    });

    var range = HUBS.map(function (h) {
      var d = hubs[h.id];
      if (!d || !isFinite(d.price) || !isFinite(d.lo) || !isFinite(d.hi) || d.hi <= d.lo)
        return { id: h.id, label: h.id, name: h.name + ' ' + h.sig, t: 0, dir: 0, elevated: false, stale: true, missing: true, asof: null, text: 'no data' };
      var p = clamp01((d.price - d.lo) / (d.hi - d.lo)), t = Math.abs(2 * p - 1);
      return { id: h.id, label: h.id, name: h.name + ' ' + h.sig, t: t, dir: p >= 0.5 ? 1 : -1, elevated: t >= TAIL.range,
        stale: ageDays(d.asof, now) > maxAge(d), asof: d.asof, text: '52-week range position ' + Math.round(p * 100) + '% (low 0, high 100)' };
    });

    var choke = CHOKE_ORDER.map(function (id) {
      var c = chokes[id];
      if (!c || !isFinite(c.ratio))
        return { id: id, label: id, name: id, t: 0, dir: 0, elevated: false, stale: true, missing: true, asof: null, text: 'no data' };
      var t = clamp01((1 - c.ratio) / 0.4);
      return { id: id, label: id, name: c.name, t: t, dir: 0, elevated: c.ratio <= TAIL.chokeRatio,
        stale: ageDays(c.asof, now) > MAX_AGE_DAYS.choke, asof: c.asof,
        text: '7-day average ' + Math.round(c.ratio * 100) + '% of the 2025 mean' };
    });

    var move = HUBS.map(function (h) {
      var d = hubs[h.id], s = d && moveStats(d.hist, d.chg_unit === 'bp');
      if (!s) return { id: h.id, label: h.id, name: h.name + ' ' + h.sig, t: 0, dir: 0, elevated: false, stale: true, missing: true, asof: null, text: 'no data' };
      var unit = d.chg_unit === 'bp' ? ' bp' : '%';
      return { id: h.id, label: h.id, name: h.name + ' ' + h.sig, t: s.pct, dir: s.move > 0 ? 1 : s.move < 0 ? -1 : 0, elevated: s.pct >= TAIL.move,
        stale: ageDays(d.asof, now) > maxAge(d), asof: d.asof,
        text: 'last move ' + fmt(s.move, d.chg_unit === 'bp' ? 0 : 2) + unit + ', bigger than ' + Math.round(s.pct * 100) + '% of its last ' + s.n + ' moves' };
    });

    return [
      { key: 'season', name: 'SEASON', cadence: 'yearly', sectors: season, current: m },
      { key: 'range', name: 'MARKET RANGE', cadence: '52-week', sectors: range },
      { key: 'choke', name: 'CHOKEPOINTS', cadence: 'weekly', sectors: choke },
      { key: 'move', name: 'DAILY MOVE', cadence: 'daily', sectors: move }
    ];
  }

  // Which sector sits under the fixed thread (at bearing 0, straight up) for a ring rotated by rot degrees clockwise.
  function sectorAt(rot, n) {
    var a = mod(-rot, 360), w = 360 / n, idx = Math.min(n - 1, Math.floor(a / w)), off = a - (idx + 0.5) * w;
    return { idx: idx, offDeg: off, frac: off / w };
  }
  function isCentered(frac) { return Math.abs(frac) <= 0.15; }

  // Rotation that puts the nearest sector centre exactly under the thread.
  function snapRot(rot, n) {
    var a = mod(-rot, 360), w = 360 / n, k = mod(Math.round(a / w - 0.5), n);
    return mod(-(k + 0.5) * w, 360);
  }
  function stepRot(rot, n, dir) { return snapRot(rot + dir * (360 / n), n); }

  // Bearing of a point from the dial centre, degrees clockwise from straight up.
  function bearing(dx, dy) { return mod(Math.atan2(dx, -dy) * 180 / Math.PI, 360); }
  function ringAtRadius(r, bands) {
    for (var i = 0; i < bands.length; i++) if (r >= bands[i].r0 && r <= bands[i].r1) return i;
    return -1;
  }

  // Describe the readings under the thread. Stale or missing sectors are excluded, never filled in.
  function summarize(readings) {
    var live = readings.filter(function (s) { return s && !s.stale; });
    var n = live.length, el = live.filter(function (s) { return s.elevated; }).length;
    var spread = 0;
    if (n > 1) {
      var mean = live.reduce(function (a, s) { return a + s.t; }, 0) / n;
      var v = live.reduce(function (a, s) { return a + (s.t - mean) * (s.t - mean); }, 0) / n;
      spread = clamp01(Math.sqrt(v) / 0.5);
    }
    return { live: n, elevated: el, spread: spread };
  }

  // Needle in the glass dome: steady when the readings under the thread are similar, wobbling when they differ.
  function needleAngle(spread, tSec, reduced) {
    var amp = spread * 35;
    if (reduced) return amp * 0.6;
    return amp * (0.6 * Math.sin(2.3 * tSec) + 0.4 * Math.sin(5.1 * tSec + 1));
  }

  // Colour meaning for direction differs by market culture: West green up / red down; East Asia red up / green down.
  function dirColors(region) {
    return region === 'east' ? { up: '#e0605a', down: '#3fbf7f' } : { up: '#3fbf7f', down: '#e0605a' };
  }

  function dataHealth(data, now) {
    now = now == null ? Date.now() : now;
    var g = data && Date.parse(data.generated_utc);
    return { jobStale: !isFinite(g) || (now - g) / 36e5 > JOB_STALE_HOURS };
  }

  return {
    MONTHS: MONTHS, HUBS: HUBS, CHOKE_ORDER: CHOKE_ORDER, TAIL: TAIL, MAX_AGE_DAYS: MAX_AGE_DAYS,
    seasonIndex: seasonIndex, moveStats: moveStats, buildRings: buildRings, sectorAt: sectorAt, isCentered: isCentered,
    snapRot: snapRot, stepRot: stepRot, bearing: bearing, ringAtRadius: ringAtRadius, summarize: summarize,
    needleAngle: needleAngle, dirColors: dirColors, dataHealth: dataHealth, mod: mod
  };
});
