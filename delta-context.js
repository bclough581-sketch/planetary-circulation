/* AMALGAM: Delta "what changed" workflow, pure logic. No DOM, no network of its own.
   Three evidence classes are kept apart on purpose:
     quarterly company evidence  (product-only issuer releases and dated publication checks)
     refreshed market context     (data.json observations, aged by per-series limits)
     preserved historical case    (a fixed, dated comparison that does not age)
   Every row carries: measurement date, retrieval time, source link, freshness status.
   A failed refresh never shows an old observation as current: it is marked stale, or unavailable if nothing was ever retained. */
(function (root) {
  'use strict';
  var DAY = 864e5;
  var CACHE_KEY = 'amalgam.context.last.v1';
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

  function parseDay(s) { if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;var t=Date.parse(s+'T00:00:00Z');return isFinite(t)&&new Date(t).toISOString().slice(0,10)===s?t:NaN; }
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
    var unavailable=function(reason){return {status:'unavailable',reason:reason,latest:null};};
    if(!issuer||issuer.schema!=='amalgam.delta-company-evidence.v1')return unavailable('Product company evidence is not loaded; the historical research case is separate.');
    if(issuer.symbol!=='DAL'||issuer.basis!=='consolidated_GAAP'||issuer.unit!=='USD_millions'||!isTime(issuer.reviewed_utc)||!fin(issuer.review_max_age_days)||issuer.review_max_age_days<=0||!isFinite(nowMs))return unavailable('Product evidence metadata is invalid.');
    if(!issuer.metric_definitions||issuer.metric_definitions.revenue!=='Total operating revenue'||issuer.metric_definitions.operatingIncome!=='Operating income'||issuer.metric_definitions.fuelExpense!=='Aircraft fuel and related taxes')return unavailable('Product GAAP measure definitions are invalid.');
    if(Date.parse(issuer.reviewed_utc)>nowMs)return unavailable('The source review is after this device’s clock; currentness cannot be judged.');
    var sources=issuer.sources,raw=issuer.observations;
    if(!sources||typeof sources!=='object'||Array.isArray(sources)||!Array.isArray(raw))return unavailable('Product sources or observations are missing.');
    var sourceKeys=Object.keys(sources);
    if(!sourceKeys.length||sourceKeys.some(function(k){var s=sources[k];return !s||!periodEnd(s.reported_period)||!/^https:\/\/ir\.delta\.com\//.test(s.url)||!isFinite(parseDay(s.published_date))||!isTime(s.retrieved_utc)||!/^[a-f0-9]{64}$/.test(s.raw_sha256)||parseDay(s.published_date)<parseDay(periodEnd(s.reported_period))||Date.parse(s.retrieved_utc)<parseDay(s.published_date)||Date.parse(s.retrieved_utc)>Date.parse(issuer.reviewed_utc);} ))return unavailable('Product source provenance is invalid.');
    var seen=new Set();
    if(raw.some(function(o){if(!o||!periodEnd(o.period)||seen.has(o.period)||!fin(o.revenue)||o.revenue<=0||!fin(o.operatingIncome)||!fin(o.fuelExpense)||o.fuelExpense<0||typeof o.source!=='string'||!Object.prototype.hasOwnProperty.call(sources,o.source))return true;seen.add(o.period);return parseDay(periodEnd(o.period))>parseDay(sources[o.source].published_date);} ))return unavailable('Product observations are invalid or duplicated.');
    var obs = raw.map(enrich)
      .sort(function (a, b) { return a.period < b.period ? -1 : 1; });
    if (!obs.length) return unavailable('No product quarterly observations are loaded.');
    var latest = obs[obs.length - 1];
    var yoy = obs.filter(function (o) { return o.quarter === latest.quarter && o.year === latest.year - 1; })[0] || null;
    var priorQuarter=+latest.quarter[1]-1,priorYear=latest.year;if(priorQuarter===0){priorQuarter=4;priorYear--;}
    var qoq=obs.find(function(o){return o.period===priorYear+'Q'+priorQuarter;})||null;
    var behind=[...new Set(sourceKeys.map(function(k){return sources[k].reported_period;}))].filter(function(p){return !seen.has(p);}).sort();
    var reviewOld=(nowMs-Date.parse(issuer.reviewed_utc))>issuer.review_max_age_days*DAY;
    var status = behind.length||reviewOld ? 'stale' : 'fresh';
    return {
      status: status,
      reason: behind.length?'Published quarter(s) '+behind.join(', ')+' are known from linked releases but not loaded.'
        :reviewOld?'The last publication check is older than '+issuer.review_max_age_days+' days. A newer release may be missing; retained figures are shown.'
        :'Latest confirmed published quarter '+latest.period+' is loaded. Publication check: '+issuer.reviewed_utc.slice(0,10)+'. This is a reviewed snapshot, not continuous live coverage.',
      latest: latest, yoy: yoy, qoq: qoq,
      yoyChange: yoy ? diff(latest, yoy) : null, qoqChange: qoq ? diff(latest, qoq) : null,
      missingQuarters: behind, all: obs,
      sources:sources,reviewed:issuer.reviewed_utc,reviewMaxAgeDays:issuer.review_max_age_days,publicationTimeVerified:false
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
    var offlineResponse=false;
    return Promise.resolve().then(function () { return env.fetchFn(env.url, { cache: 'no-store' }); })
      .then(function (res) { if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));offlineResponse=!!(res.headers&&res.headers.get('X-Amalgam-Offline-Fallback')==='1'); return res.text(); })
      .then(function (text) {
        var data = JSON.parse(text);
        if (!validContext(data)) throw new Error('data.json has no hubs object');
        if(offlineResponse)return {mode:'retained-site-cache',data:data,loadedUtc:null,error:'Network refresh unavailable; this response came from the site’s offline cache.'};
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
      'Latest '+l.period+' (ended '+l.periodEnd+'); published '+qe.sources[l.source].published_date+'; retrieved '+qe.sources[l.source].retrieved_utc+'; '+qe.sources[l.source].url+'. Publication date is not verified first availability.'];
    if (qe.yoyChange) lines.push('vs ' + qe.yoy.period + ': revenue ' + sgn(qe.yoyChange.revenuePct, 1, '%') + ', fuel expense ' + sgn(qe.yoyChange.fuelPct, 1, '%') + ', operating margin ' + sgn(qe.yoyChange.marginPp, 1, ' pp') + ', fuel share of revenue ' + l.fuelShare.toFixed(1) + '% (' + sgn(qe.yoyChange.fuelSharePp, 1, ' pp') + ').');
    return lines.join('\n');
  }
  function contextText(rows, load) {
    var head = 'MARKET CONTEXT (refreshed; separate from the company figures) · page load: ' + load.mode + (load.error ? ' (refresh failed: ' + load.error + ')' : '') + (load.loadedUtc ? ' at ' + load.loadedUtc : '');
    return [head].concat(rows.map(function (r) {
      return '- ' + r.label + ': ' + (r.value == null ? 'unavailable' : r.value.toFixed(r.dp) + ' ' + r.unit + ', measured ' + r.asof + ', retrieved ' + (r.retrievedUtc || 'time not recorded')) + ' · ' + r.status.toUpperCase() + ' · ' + r.source.name + ': ' + r.source.url;
    })).join('\n');
  }

  var api = { SERIES: SERIES, SOURCES: SOURCES, CACHE_KEY: CACHE_KEY, parseDay: parseDay, ageDays: ageDays, seriesStatus: seriesStatus,
    contextRows: contextRows, quarterEvidence: quarterEvidence, periodEnd: periodEnd, loadContext: loadContext, fromBundle: fromBundle, quarterText: quarterText, contextText: contextText, baselineFromHist: baselineFromHist };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AmalgamDeltaContext = api;
})(typeof window !== 'undefined' ? window : this);
