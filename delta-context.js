/* AMALGAM: Delta "what changed" workflow, pure logic. No DOM, no network of its own.
   Three evidence classes are kept apart on purpose:
     quarterly company evidence  (issuer releases, aged by the 45-day publication rule below)
     refreshed market context     (data.json observations, aged by per-series limits)
     preserved historical case    (a fixed, dated comparison that does not age)
   Every row carries: measurement date, retrieval time, source link, freshness status.
   A failed refresh never shows an old observation as current: it is marked stale, or unavailable if nothing was ever retained. */
(function (root) {
  'use strict';
  var DAY = 864e5;
  var CACHE_KEY = 'amalgam.context.last.v1';
  var QUARTER_WINDOW_DAYS = 45;   // our assumption for when a quarter's results should be public; shown to the user as an assumption
  // Same limits as the live map (map.html HUBDEF age): calendar days.
  var SOURCES = {
    eia: { name: 'U.S. Energy Information Administration', url: 'https://www.eia.gov/opendata/' },
    ust: { name: 'U.S. Treasury', url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates' },
    ecb: { name: 'ECB statistics', url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/' }
  };
  var SERIES = [
    { id: 'HOU', label: 'WTI crude, spot', unit: 'USD per barrel', src: 'eia', dp: 2, maxAge: 12, role: 'Oil' },
    { id: 'DXB', label: 'Brent crude, spot', unit: 'USD per barrel', src: 'eia', dp: 2, maxAge: 12, role: 'Oil' },
    { id: 'NYC', label: 'U.S. 10-year Treasury yield', unit: 'percent', src: 'ust', dp: 2, maxAge: 5, role: 'Rates', chgUnit: 'bp' },
    { id: 'FRA', label: 'EUR/USD reference rate', unit: 'USD per EUR', src: 'ecb', dp: 4, maxAge: 5, role: 'Currency' },
    { id: 'LON', label: 'EUR/GBP reference rate', unit: 'GBP per EUR', src: 'ecb', dp: 5, maxAge: 5, role: 'Currency' }
  ];

  function parseDay(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T00:00:00Z') : NaN; }
  function isTime(s) { return typeof s === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(s) && isFinite(Date.parse(s)); }
  function ageDays(asof, nowMs) { var t = parseDay(asof); return isFinite(t) ? Math.floor((nowMs - t) / DAY) : NaN; }
  function fin(n) { return typeof n === 'number' && isFinite(n); }

  /* ---------- freshness ---------- */
  // opts: {value, asof, maxAge, nowMs, retained (page could not refresh), sourceOk (job result for this source), lastOkUtc}
  function seriesStatus(o) {
    if (!fin(o.value) || !isFinite(parseDay(o.asof))) return { status: 'unavailable', reason: 'No usable observation is held for this series.' };
    var age = ageDays(o.asof, o.nowMs);
    if (age < 0) return { status: 'unavailable', reason: 'The measurement date is after this device\'s clock, so its age cannot be judged.' };
    if (o.retained) return { status: 'stale', reason: 'This page could not refresh just now. Showing the last observation it retained, measured ' + age + ' day' + (age === 1 ? '' : 's') + ' ago.' };
    if (o.sourceOk === false) return { status: 'stale', reason: 'The latest daily refresh of this source failed. Showing the last good value' + (o.lastOkUtc ? ' (retrieved ' + o.lastOkUtc + ')' : '') + '.' };
    if (age > o.maxAge) return { status: 'stale', reason: 'Measured ' + age + ' days ago; this series is treated as current for up to ' + o.maxAge + ' days.' };
    return { status: 'fresh', reason: 'Measured ' + age + ' day' + (age === 1 ? '' : 's') + ' ago; limit ' + o.maxAge + ' days.' };
  }

  function baselineFromHist(hist, asof, spanDays) {
    var a = parseDay(asof);
    if (!Array.isArray(hist) || !isFinite(a)) return null;
    for (var i = 0; i < hist.length; i++) {
      var d = parseDay(hist[i] && hist[i][0]);
      if (isFinite(d) && d <= a - spanDays * DAY && fin(hist[i][1])) return { date: hist[i][0], value: hist[i][1] };
    }
    return null;
  }

  /* ---------- market context ---------- */
  // data: data.json shape. opts: {nowMs, retained}
  function contextRows(data, opts) {
    var hubs = (data && data.hubs) || {}, st = (data && data.status) || {};
    return SERIES.map(function (s) {
      var h = hubs[s.id] || {}, js = st[s.src] || null;
      var value = fin(h.price) ? h.price : null, asof = isFinite(parseDay(h.asof)) ? h.asof : null;
      var sourceOk = js ? js.ok !== false : null;
      var lastOk = js && isTime(js.last_ok_utc) ? js.last_ok_utc : null;
      var verdict = seriesStatus({ value: value, asof: asof, maxAge: s.maxAge, nowMs: opts.nowMs, retained: !!opts.retained, sourceOk: sourceOk, lastOkUtc: lastOk });
      var base = value != null && asof ? baselineFromHist(h.hist, asof, 28) : null, change28 = null;
      if (base) change28 = s.chgUnit === 'bp' ? { value: (value - base.value) * 100, unit: 'bp', since: base.date } : { value: (value / base.value - 1) * 100, unit: '%', since: base.date };
      return {
        id: s.id, label: s.label, unit: s.unit, role: s.role, dp: s.dp, maxAge: s.maxAge,
        value: value, asof: asof,
        change1: fin(h.chg) ? { value: h.chg, unit: s.chgUnit || '%' } : null, change28: change28,
        retrievedUtc: lastOk, jobOk: sourceOk,
        source: SOURCES[s.src], status: verdict.status, reason: verdict.reason
      };
    });
  }

  /* ---------- quarterly company evidence ---------- */
  var QEND = { Q1: '03-31', Q2: '06-30', Q3: '09-30', Q4: '12-31' };
  function periodEnd(p) { var m = /^(\d{4})(Q[1-4])$/.exec(p); return m ? m[1] + '-' + QEND[m[2]] : null; }
  function enrich(o) {
    return {
      period: o.period, periodEnd: periodEnd(o.period), quarter: o.period.slice(4), year: +o.period.slice(0, 4), source: o.source,
      revenue: o.revenue, operatingIncome: o.operatingIncome, fuelExpense: o.fuelExpense,
      margin: 100 * o.operatingIncome / o.revenue, fuelShare: 100 * o.fuelExpense / o.revenue
    };
  }
  function pctChg(a, b) { return (a / b - 1) * 100; }
  function diff(a, b) {
    return { revenuePct: pctChg(a.revenue, b.revenue), fuelPct: pctChg(a.fuelExpense, b.fuelExpense), marginPp: a.margin - b.margin, fuelSharePp: a.fuelShare - b.fuelShare };
  }
  function quarterEvidence(issuer, nowMs) {
    var obs = ((issuer && issuer.observations) || []).filter(function (o) { return periodEnd(o.period); }).map(enrich)
      .sort(function (a, b) { return a.period < b.period ? -1 : 1; });
    if (!obs.length) return { status: 'unavailable', reason: 'No quarterly observations are loaded.', latest: null };
    var latest = obs[obs.length - 1], idx = obs.length - 1;
    var yoy = obs.filter(function (o) { return o.quarter === latest.quarter && o.year === latest.year - 1; })[0] || null;
    var qoq = idx > 0 ? obs[idx - 1] : null;
    var behind = [], y = latest.year, q = +latest.quarter[1];
    for (var guard = 0; guard < 12; guard++) {
      q++; if (q > 4) { q = 1; y++; }
      var pe = periodEnd(y + 'Q' + q), due = parseDay(pe) + QUARTER_WINDOW_DAYS * DAY;
      if (due <= nowMs) behind.push(y + 'Q' + q); else break;
    }
    var status = behind.length ? 'stale' : 'fresh';
    return {
      status: status,
      reason: behind.length
        ? behind.length + ' newer quarter' + (behind.length === 1 ? '' : 's') + ' (' + behind.join(', ') + ') should be public by now under a ' + QUARTER_WINDOW_DAYS + '-day rule (our assumption) and ' + (behind.length === 1 ? 'is' : 'are') + ' not loaded.'
        : 'No later quarter is due yet under a ' + QUARTER_WINDOW_DAYS + '-day rule (our assumption).',
      latest: latest, yoy: yoy, qoq: qoq,
      yoyChange: yoy ? diff(latest, yoy) : null, qoqChange: qoq ? diff(latest, qoq) : null,
      missingQuarters: behind, all: obs,
      sources: issuer.sources, reviewed: issuer.reviewed_date, publicationTimeVerified: issuer.publication_time_verified === true
    };
  }

  /* ---------- load with retained fallback ---------- */
  function validContext(data) { return data && typeof data === 'object' && data.hubs && typeof data.hubs === 'object' && !Array.isArray(data.hubs); }
  function minimal(data) {
    var keep = { generated_utc: data.generated_utc, hubs: {}, status: {} };
    SERIES.forEach(function (s) {
      var h = data.hubs[s.id]; if (h && typeof h === 'object') keep.hubs[s.id] = { price: h.price, chg: h.chg, asof: h.asof, hist: Array.isArray(h.hist) ? h.hist.slice(0, 40) : undefined };
      if (data.status && data.status[s.src]) keep.status[s.src] = data.status[s.src];
    });
    return keep;
  }
  // The bundled snapshot (ring-evidence.js) holds events, not data.json. Convert it, never inventing the job status.
  function fromBundle(bundle) {
    var snap = bundle && bundle.snapshot, out = { generated_utc: snap && snap.snapshot_generated_utc, hubs: {}, status: {} };
    ((snap && snap.events) || []).forEach(function (e) {
      var hub = e && e.metadata && e.metadata.hub;
      if (hub && fin(e.value)) out.hubs[hub] = { price: e.value, chg: e.metadata.change, asof: e.metadata.asof };
    });
    return out;
  }
  // env: {fetchFn, storage, bundle, url, nowFn}. Never throws.
  function loadContext(env) {
    var now = function () { return (env.nowFn ? env.nowFn() : new Date()).toISOString(); };
    return Promise.resolve().then(function () { return env.fetchFn(env.url, { cache: 'no-store' }); })
      .then(function (res) { if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status)); return res.text(); })
      .then(function (text) {
        var data = JSON.parse(text);
        if (!validContext(data)) throw new Error('data.json has no hubs object');
        var loaded = now();
        try { env.storage.setItem(CACHE_KEY, JSON.stringify({ loadedUtc: loaded, data: minimal(data) })); } catch (e) { /* storage unavailable: still live */ }
        return { mode: 'live', data: data, loadedUtc: loaded, error: null };
      })
      .catch(function (err) {
        var msg = String(err && err.message || err).slice(0, 160);
        try {
          var c = JSON.parse(env.storage.getItem(CACHE_KEY) || 'null');
          if (c && isTime(c.loadedUtc) && validContext(c.data)) return { mode: 'retained-last-success', data: c.data, loadedUtc: c.loadedUtc, error: msg };
        } catch (e) { /* unreadable cache: fall through to the bundle */ }
        var b = fromBundle(env.bundle);
        if (validContext(b) && Object.keys(b.hubs).length) return { mode: 'retained-bundle', data: b, loadedUtc: b.generated_utc || null, error: msg };
        return { mode: 'unavailable', data: { hubs: {}, status: {} }, loadedUtc: null, error: msg };
      });
  }

  /* ---------- text for the decision draft (kept compact: the journal limits evidence to 4000 characters) ---------- */
  function money(n) { return n.toLocaleString('en-US'); }
  function sgn(n, d, suf) { return (n > 0 ? '+' : '') + n.toFixed(d) + suf; }
  function quarterText(qe) {
    if (!qe.latest) return 'COMPANY EVIDENCE (quarterly): not loaded.';
    var l = qe.latest, lines = ['COMPANY EVIDENCE (quarterly) · status: ' + qe.status.toUpperCase() + ' · ' + qe.reason,
      'Latest on file ' + l.period + ' (quarter ended ' + l.periodEnd + '); issuer release: ' + qe.sources[l.source] + '. Transcribed by hand, reviewed ' + qe.reviewed + '; publication time not verified.'];
    if (qe.yoyChange) lines.push('vs ' + qe.yoy.period + ': revenue ' + sgn(qe.yoyChange.revenuePct, 1, '%') + ', fuel expense ' + sgn(qe.yoyChange.fuelPct, 1, '%') + ', operating margin ' + sgn(qe.yoyChange.marginPp, 1, ' pp') + ', fuel share of revenue ' + l.fuelShare.toFixed(1) + '% (' + sgn(qe.yoyChange.fuelSharePp, 1, ' pp') + ').');
    return lines.join('\n');
  }
  function contextText(rows, load) {
    var head = 'MARKET CONTEXT (refreshed; separate from the company figures) · page load: ' + load.mode + (load.error ? ' (refresh failed: ' + load.error + ')' : '') + (load.loadedUtc ? ' at ' + load.loadedUtc : '');
    return [head].concat(rows.map(function (r) {
      return '- ' + r.label + ': ' + (r.value == null ? 'unavailable' : r.value.toFixed(r.dp) + ' ' + r.unit + ', measured ' + r.asof + ', retrieved ' + (r.retrievedUtc || 'time not recorded')) + ' · ' + r.status.toUpperCase() + ' · ' + r.source.name + ': ' + r.source.url;
    })).join('\n');
  }

  var api = { SERIES: SERIES, SOURCES: SOURCES, CACHE_KEY: CACHE_KEY, QUARTER_WINDOW_DAYS: QUARTER_WINDOW_DAYS, parseDay: parseDay, ageDays: ageDays, seriesStatus: seriesStatus,
    contextRows: contextRows, quarterEvidence: quarterEvidence, periodEnd: periodEnd, loadContext: loadContext, fromBundle: fromBundle, quarterText: quarterText, contextText: contextText, baselineFromHist: baselineFromHist };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AmalgamDeltaContext = api;
})(typeof window !== 'undefined' ? window : this);
