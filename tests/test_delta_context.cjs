'use strict';
// Unit tests for delta-context.js: freshness rules, stale-on-failure, quarter ageing, retained fallback, PortWatch exclusion.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = require('../delta-context.js');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'product-data/retained-context-2026-11-04.json'), 'utf8'));
const issuer = JSON.parse(fs.readFileSync(path.join(root, 'product-data/delta-company-evidence.json'), 'utf8'));
const sandbox = { window: {} }; vm.createContext(sandbox); vm.runInContext(fs.readFileSync(path.join(root, 'ring-evidence.js'), 'utf8'), sandbox);
const bundle = sandbox.window.AMALGAM_STARTER;
const T = s => Date.parse(s);
let n = 0; const ok = (c, m) => { n++; assert.ok(c, m); };

// ---- seriesStatus
const base = { value: 1, asof: '2026-11-10', maxAge: 5, nowMs: T('2026-11-12T12:00:00Z') };
assert.equal(D.seriesStatus(base).status, 'fresh'); n++;
assert.equal(D.seriesStatus({ ...base, asof: '2026-11-07' }).status, 'fresh', 'age 5 days = the limit, still fresh'); n++;
assert.equal(D.seriesStatus({ ...base, asof: '2026-11-06' }).status, 'stale', 'age 6 days, one past the limit, is stale'); n++;
assert.equal(D.seriesStatus({ ...base, sourceOk: false }).status, 'stale'); n++;
assert.match(D.seriesStatus({ ...base, sourceOk: false, lastOkUtc: '2026-11-09T22:10:00Z' }).reason, /latest daily refresh .* failed.*2026-11-09T22:10:00Z/); n++;
assert.equal(D.seriesStatus({ ...base, retained: true }).status, 'stale', 'a failed page refresh is never fresh even if the date is recent'); n++;
for (const bad of [{ value: null }, { value: NaN }, { asof: null }, { asof: 'not-a-date' }, { asof: '2026-11-30' }]) assert.equal(D.seriesStatus({ ...base, ...bad }).status, 'unavailable', JSON.stringify(bad)), n++;

// ---- fixed retained context: advancing data.json must not move stale-test dates
const rows = D.contextRows(data, { nowMs: T('2026-11-12T20:00:00Z') });
assert.deepEqual(rows.map(r => r.id), ['HOU', 'DXB', 'NYC', 'FRA', 'LON']); n++;
ok(rows.every(r => r.status === 'stale'), 'on 2026-11-12 the fixed retained November 4 fixture must read stale');
const early = D.contextRows(data, { nowMs: T('2026-11-04T12:00:00Z') });
ok(early.every(r => r.status === 'fresh'), 'at the snapshot time every series is within its limit');
ok(rows.every(r => r.source && /^https:\/\//.test(r.source.url) && r.asof && r.value != null), 'every row carries source link, measurement date and value');
const wti = rows[0]; assert.equal(wti.value, data.hubs.HOU.price); assert.equal(wti.asof, data.hubs.HOU.asof); n += 2;
assert.equal(wti.retrievedUtc, data.status.eia.last_ok_utc, 'retrieval time is the job\'s last successful pull for that source'); n++;
// 28-day change recomputed independently from hist
{ const h = data.hubs.HOU.hist, asof = Date.parse(data.hubs.HOU.asof + 'T00:00:00Z'); const b = h.find(x => Date.parse(x[0] + 'T00:00:00Z') <= asof - 28 * 864e5);
  assert.equal(wti.change28.since, b[0]); assert.ok(Math.abs(wti.change28.value - (h[0][1] / b[1] - 1) * 100) < 1e-9); n += 2;
  const y = rows[2]; const hy = data.hubs.NYC.hist, ay = Date.parse(data.hubs.NYC.asof + 'T00:00:00Z'); const by = hy.find(x => Date.parse(x[0] + 'T00:00:00Z') <= ay - 28 * 864e5);
  assert.equal(y.change28.unit, 'bp'); assert.ok(Math.abs(y.change28.value - (hy[0][1] - by[1]) * 100) < 1e-9); n += 2; }
// a failed job for one source marks only that source stale
{ const d2 = JSON.parse(JSON.stringify(data)); d2.status.ecb.ok = false; const r2 = D.contextRows(d2, { nowMs: T('2026-11-04T12:00:00Z') });
  assert.deepEqual(r2.map(r => r.status), ['fresh', 'fresh', 'fresh', 'stale', 'stale']); n++; }
// missing hub -> unavailable, others unaffected
{ const d3 = JSON.parse(JSON.stringify(data)); delete d3.hubs.DXB; const r3 = D.contextRows(d3, { nowMs: T('2026-11-04T12:00:00Z') });
  assert.equal(r3[1].status, 'unavailable'); assert.equal(r3[1].value, null); assert.equal(r3[0].status, 'fresh'); n += 3; }
// PortWatch / chokepoints are never read
ok(!JSON.stringify(rows).includes('Hormuz') && !JSON.stringify(D.SERIES).toLowerCase().includes('portwatch'), 'PortWatch stays excluded');
// source URLs in the module match what the bundle already cites
for (const e of bundle.snapshot.events) { const hub = e.metadata.hub, s = D.SERIES.find(x => x.id === hub); if (s) assert.equal(D.SOURCES[s.src].url, e.source.url, hub); } n++;

// ---- quarterly evidence
const reviewed=T(issuer.reviewed_utc),q = D.quarterEvidence(issuer, reviewed+3600000);
assert.equal(q.latest.period, '2026Q3'); assert.equal(q.latest.periodEnd, '2026-09-30'); assert.equal(q.status, 'fresh'); assert.deepEqual(q.missingQuarters, []); n += 4;
assert.ok(Math.abs(q.yoyChange.fuelPct - (4351 / 2570 - 1) * 100) < 1e-9);
assert.ok(Math.abs(q.yoyChange.marginPp - (100 * 1454 / 20186 - 100 * 1684 / 16673)) < 1e-9);
assert.ok(Math.abs(q.latest.fuelShare - 100 * 4351 / 20186) < 1e-9); n += 3;
assert.equal(q.yoy.period, '2025Q3'); assert.equal(q.qoq.period, '2026Q2'); n += 2;
const oldReview=D.quarterEvidence(issuer,reviewed+8*864e5);
assert.equal(oldReview.status,'stale');assert.match(oldReview.reason,/publication check/);n+=2;
const missing=D.quarterEvidence({...issuer,observations:issuer.observations.filter(o=>o.period!=='2026Q3')},reviewed+3600000);
assert.equal(missing.status,'stale');assert.deepEqual(missing.missingQuarters,['2026Q3']);assert.match(missing.reason,/Published quarter/);n+=3;
assert.equal(D.quarterEvidence(bundle.issuer,reviewed+3600000).status,'unavailable','never substitute the frozen research fixture');n++;
assert.equal(D.quarterEvidence(issuer,reviewed-1).status,'unavailable','future review never marked fresh');n++;
const noQ2=D.quarterEvidence({...issuer,observations:issuer.observations.filter(o=>o.period!=='2026Q2')},reviewed+3600000);
assert.equal(noQ2.qoq,null,'a missing quarter is not replaced with a nonadjacent comparison');n++;
for(const changed of [{unit:'USD_billions'},{observations:[...issuer.observations,issuer.observations[0]]},{sources:{}},{metric_definitions:{...issuer.metric_definitions,fuelExpense:'Adjusted fuel expense'}},{observations:[{...issuer.observations[0],source:'constructor'}]}])assert.equal(D.quarterEvidence({...issuer,...changed},reviewed+3600000).status,'unavailable'),n++;
assert.equal(D.quarterEvidence({ observations: [] }, T('2026-11-12')).status, 'unavailable'); n++;
assert.equal(q.publicationTimeVerified, false); n++;

// ---- loadContext: live, retained-last-success, retained-bundle, unavailable
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v), _m: m }; };
const good = { ok: true, status: 200, text: async () => JSON.stringify(data) };
(async () => {
  const st = mem(), now = () => new Date('2026-11-12T20:00:00Z');
  let r = await D.loadContext({ fetchFn: async () => good, storage: st, bundle, url: 'data.json', nowFn: now });
  assert.equal(r.mode, 'live'); assert.equal(r.loadedUtc, '2026-11-12T20:00:00.000Z'); assert.ok(st._m.has(D.CACHE_KEY)); assert.equal(r.error, null); n += 4;
  const cached = JSON.parse(st._m.get(D.CACHE_KEY)); assert.ok(Object.keys(cached.data.hubs).length === 5 && !JSON.stringify(cached).includes('chokepoints')); n++;
  const offline=await D.loadContext({fetchFn:async()=>({...good,headers:{get:key=>key==='X-Amalgam-Offline-Fallback'?'1':null}}),storage:st,bundle,url:'data.json',nowFn:()=>new Date('2026-11-14T00:00:00Z')});
  assert.equal(offline.mode,'retained-site-cache');assert.equal(offline.loadedUtc,null);assert.equal(JSON.parse(st._m.get(D.CACHE_KEY)).loadedUtc,cached.loadedUtc);n+=3;
  assert.ok(D.contextRows(offline.data,{nowMs:T('2026-11-04T12:00:00Z'),retained:true}).every(r=>r.status==='stale'),'even recent cached observations are not a fresh network retrieval');n++;
  for (const [name, f] of [['network error', async () => { throw new Error('offline'); }], ['404', async () => ({ ok: false, status: 404, text: async () => '' })], ['html body', async () => ({ ok: true, status: 200, text: async () => '<html>Not found</html>' })], ['wrong shape', async () => ({ ok: true, status: 200, text: async () => '{"x":1}' })]]) {
    const r2 = await D.loadContext({ fetchFn: f, storage: st, bundle, url: 'data.json', nowFn: () => new Date('2026-11-13T09:00:00Z') });
    assert.equal(r2.mode, 'retained-last-success', name); assert.equal(r2.loadedUtc, '2026-11-12T20:00:00.000Z', name + ': keeps the ORIGINAL retrieval time, not the failed attempt'); assert.ok(r2.error, name); n += 3;
    const rr = D.contextRows(r2.data, { nowMs: T('2026-11-13T09:00:00Z'), retained: true });
    assert.ok(rr.every(x => x.status === 'stale' && /could not refresh/.test(x.reason)), name + ': retained rows are stale'); n++;
  }
  const r3 = await D.loadContext({ fetchFn: async () => { throw new Error('offline'); }, storage: mem(), bundle, url: 'data.json', nowFn: now });
  assert.equal(r3.mode, 'retained-bundle'); assert.equal(r3.loadedUtc, bundle.snapshot.snapshot_generated_utc); assert.equal(Object.keys(r3.data.hubs).length >= 5, true); assert.deepEqual(r3.data.status, {}); n += 4;
  const rb = D.contextRows(r3.data, { nowMs: T('2026-11-12T20:00:00Z'), retained: true }); ok(rb.every(x => x.status === 'stale' && x.retrievedUtc === null), 'bundle rows: stale, retrieval time honestly not recorded');
  const r4 = await D.loadContext({ fetchFn: async () => { throw new Error('offline'); }, storage: mem(), bundle: null, url: 'data.json', nowFn: now });
  assert.equal(r4.mode, 'unavailable'); assert.ok(D.contextRows(r4.data, { nowMs: T('2026-11-12'), retained: true }).every(x => x.status === 'unavailable')); n += 2;
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const r5 = await D.loadContext({ fetchFn: async () => good, storage: broken, bundle, url: 'data.json', nowFn: now }); assert.equal(r5.mode, 'live', 'storage failure does not break a live load'); n++;
  const r6 = await D.loadContext({ fetchFn: async () => { throw new Error('x'); }, storage: broken, bundle, url: 'data.json', nowFn: now }); assert.equal(r6.mode, 'retained-bundle', 'unreadable cache falls back to the bundle'); n++;
  // draft text stays inside the journal's limit with all three classes present
  const txt = D.quarterText(q) + '\n\n' + D.contextText(rows, { mode: 'live', loadedUtc: '2026-11-12T20:00:00.000Z', error: null });
  ok(txt.length < 2200, 'company + context text leaves room for the historical section (' + txt.length + ' chars)');
  console.log('PASS delta-context: ' + n + ' assertions');
})().catch(e => { console.error(e); process.exit(1); });
