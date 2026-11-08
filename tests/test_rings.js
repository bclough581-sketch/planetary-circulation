'use strict';
// node tests/test_rings.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const R = require('../rings.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8'));
const NOW = Date.parse('2026-11-08T12:00:00Z');
let n = 0;
const ok = (name, fn) => { fn(); n++; };
const near = (a, b, e, msg) => assert.ok(Math.abs(a - b) <= (e || 1e-9), (msg || '') + ' got ' + a + ' want ' + b);

ok('season curve: 1 in Jan, 0 in Jul, 0.5 in Apr and Oct', () => {
  near(R.seasonIndex(0), 1); near(R.seasonIndex(6), 0); near(R.seasonIndex(3), 0.5); near(R.seasonIndex(9), 0.5);
});

ok('sectorAt: thread at a sector edge, then centred after snap', () => {
  const a = R.sectorAt(0, 12);
  assert.strictEqual(a.idx, 0); near(a.offDeg, -15); near(a.frac, -0.5);
  const s = R.snapRot(0, 12);
  near(s, 345);
  const b = R.sectorAt(s, 12);
  assert.strictEqual(b.idx, 0); near(b.offDeg, 0); assert.ok(R.isCentered(b.frac));
});

ok('rotating a ring clockwise one sector moves the previous sector under the thread', () => {
  let rot = R.snapRot(0, 12);              // sector 0 centred
  rot = R.stepRot(rot, 12, 1);             // clockwise
  assert.strictEqual(R.sectorAt(rot, 12).idx, 11);
  rot = R.stepRot(rot, 12, -1);
  assert.strictEqual(R.sectorAt(rot, 12).idx, 0);
});

ok('snapRot lands on a sector centre from any rotation, for every ring size used', () => {
  [6, 12].forEach(N => { for (let r = 0; r < 360; r += 3.7) {
    const s = R.snapRot(r, N), at = R.sectorAt(s, N);
    near(at.offDeg, 0, 1e-6, 'N=' + N + ' r=' + r);
    assert.ok(Math.abs(R.mod(s - r + 180, 360) - 180) <= 180 / N + 1e-6, 'snap moved more than half a sector');
  } });
});

ok('bearing is clockwise from straight up', () => {
  near(R.bearing(0, -10), 0); near(R.bearing(10, 0), 90); near(R.bearing(0, 10), 180); near(R.bearing(-10, 0), 270);
});

ok('ringAtRadius hits bands and gaps', () => {
  const B = [{ r0: 62, r1: 94 }, { r0: 96, r1: 128 }];
  assert.strictEqual(R.ringAtRadius(70, B), 0); assert.strictEqual(R.ringAtRadius(100, B), 1);
  assert.strictEqual(R.ringAtRadius(95, B), -1); assert.strictEqual(R.ringAtRadius(10, B), -1);
});

ok('rings built from the real data.json', () => {
  const rings = R.buildRings(data, NOW, 10);
  assert.deepStrictEqual(rings.map(r => r.key), ['season', 'range', 'choke', 'move']);
  assert.deepStrictEqual(rings.map(r => r.sectors.length), [12, 12, 6, 12]);
  const gru = rings[1].sectors.find(s => s.id === 'GRU'), h = data.hubs.GRU;
  const p = (h.price - h.lo) / (h.hi - h.lo);
  near(gru.t, Math.abs(2 * p - 1), 1e-9); assert.strictEqual(gru.dir, p >= 0.5 ? 1 : -1);
  const hrm = rings[2].sectors.find(s => s.id === 'HRM');
  assert.strictEqual(hrm.elevated, true); near(hrm.t, 1);          // 7-day average about 5% of the 2025 mean
  const suz = rings[2].sectors.find(s => s.id === 'SUZ');
  assert.strictEqual(suz.elevated, false); near(suz.t, 0);          // ratio above 1
  assert.deepStrictEqual(rings[2].sectors.map(s => s.id), R.CHOKE_ORDER);
  assert.strictEqual(rings[0].sectors[10].current, true);           // November
  assert.strictEqual(rings[0].sectors[10].elevated, false);         // 0.5*(1+cos(2pi*10/12)) = 0.25
  assert.strictEqual(rings[0].sectors[0].elevated, true);           // January
});

ok('yield moves are in basis points, not percent', () => {
  const s = R.moveStats(data.hubs.NYC.hist, true);
  near(s.move, 2, 1e-6);                                            // 4.86 vs 4.84
  const g = R.moveStats(data.hubs.GRU.hist, false);
  near(g.move, data.hubs.GRU.chg, 1e-9);                            // matches the pipeline's own change
});

ok('move percentile counts only the other days', () => {
  const hist = [['d0', 110], ['d1', 100], ['d2', 100], ['d3', 100], ['d4', 100], ['d5', 100], ['d6', 100], ['d7', 100], ['d8', 100]];
  const s = R.moveStats(hist, false);                               // latest +10%, seven other moves of 0%
  near(s.move, 10, 1e-9); near(s.pct, 1); assert.strictEqual(s.n, 7);
  assert.strictEqual(R.moveStats(hist.slice(0, 5), false), null);   // too little history
});

ok('freshness gates grey out old readings and drop them from the count', () => {
  const rings = R.buildRings(data, NOW + 2 * 864e5, 10);             // 2026-11-10 12:00: oil asof 11-03 is 7.5 days old (limit 12), FX asof 11-06 is 4.5 (limit 5)
  assert.strictEqual(rings[1].sectors.find(s => s.id === 'HOU').stale, false);
  assert.strictEqual(rings[1].sectors.find(s => s.id === 'GRU').stale, false);
  const hou = R.buildRings(data, NOW + 7 * 864e5, 10)[1].sectors.find(s => s.id === 'HOU');   // 12.5 days: oil now stale
  assert.strictEqual(hou.stale, true);
  assert.strictEqual(R.buildRings(data, NOW + 4 * 864e5, 10)[1].sectors.find(s => s.id === 'GRU').stale, true);   // FX at 6.5 days: stale
  const fresh = R.buildRings(data, NOW, 10);
  assert.strictEqual(fresh[1].sectors.find(s => s.id === 'HOU').stale, false);
  assert.strictEqual(fresh[2].sectors.every(s => !s.stale), true);   // chokepoints limit is 21 days
  const sm = R.summarize([fresh[2].sectors[4], hou]);
  assert.strictEqual(sm.live, 1); assert.strictEqual(sm.elevated, 1); assert.strictEqual(sm.spread, 0);
});

ok('missing data is flagged, never filled in', () => {
  const rings = R.buildRings({ hubs: {}, chokepoints: [] }, NOW, 0);
  assert.ok(rings[1].sectors.every(s => s.missing && s.stale));
  assert.ok(rings[2].sectors.every(s => s.missing && s.stale));
  assert.ok(rings[3].sectors.every(s => s.missing && s.stale));
  assert.strictEqual(R.summarize([null, rings[1].sectors[0]]).live, 0);
});

ok('spread: identical readings steady the needle, opposite readings wobble it', () => {
  const mk = t => ({ t, stale: false, elevated: t >= 0.8 });
  near(R.summarize([mk(0.5), mk(0.5), mk(0.5)]).spread, 0);
  near(R.summarize([mk(0), mk(1)]).spread, 1);
  const sm = R.summarize([mk(1), mk(0.9), mk(0.85), mk(0.1)]);
  assert.strictEqual(sm.elevated, 3); assert.strictEqual(sm.live, 4);
  for (let t = 0; t < 20; t += 0.37) assert.ok(Math.abs(R.needleAngle(0.6, t, false)) <= 0.6 * 35 + 1e-9);
  near(R.needleAngle(0, 3.3, false), 0); near(R.needleAngle(1, 3.3, true), 21);
});

ok('colour direction swaps by region and nothing else', () => {
  const w = R.dirColors('west'), e = R.dirColors('east');
  assert.strictEqual(w.up, e.down); assert.strictEqual(w.down, e.up); assert.notStrictEqual(w.up, w.down);
});

ok('data job older than 48 hours is flagged', () => {
  assert.strictEqual(R.dataHealth(data, Date.parse(data.generated_utc) + 47 * 36e5).jobStale, false);
  assert.strictEqual(R.dataHealth(data, Date.parse(data.generated_utc) + 49 * 36e5).jobStale, true);
  assert.strictEqual(R.dataHealth({}, NOW).jobStale, true);
});

ok('no advice wording anywhere in the readings', () => {
  const bad = /\b(buy|sell|signal|should|recommend|predict|forecast|will rise|will fall)\b/i;
  R.buildRings(data, NOW, 10).forEach(r => r.sectors.forEach(s => assert.ok(!bad.test(s.text + ' ' + s.name), s.text)));
});

console.log('rings: ' + n + ' test groups passed');
