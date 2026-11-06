'use strict';
const assert = require('node:assert/strict');
const core = require('../journal-core.js');

function card(id = 'synthetic-1') {
  const c = { id, savedAt: '2026-11-06T12:00:00.000Z' };
  for (const f of core.fields) c[f] = '';
  Object.assign(c, { ticker: 'TEST', recordType: 'Retrospective', outcome: 'Closed', reason: 'Synthetic record', adherence: 'Unresolved', amendments: [] });
  return c;
}
const amendment = { savedAt: '2026-11-06T13:00:00.000Z', change: 'Missing details recorded as Unknown', reason: 'Synthetic correction', planned: 'Unknown', adherence: 'Unresolved' };
const original = card(); original.amendments.push(amendment);
const bundle = { schema: core.schema, cards: [original] };
const before = JSON.stringify(bundle);
const canonical = core.validate(bundle);
assert.equal(JSON.stringify(bundle), before, 'validation does not mutate input');
assert.notEqual(canonical[0], original); assert.notEqual(canonical[0].amendments[0], amendment);

// JSON object field order has no semantic meaning, including amendment fields.
function reverseObject(o) { return Object.fromEntries(Object.entries(o).reverse()); }
const reordered = reverseObject(original);
reordered.amendments = [reverseObject(amendment)];
assert.deepEqual(core.mergeCards([original], [reordered]), { cards: canonical, added: 0 });
const changed = structuredClone(original); changed.reason = 'Conflicting content';
assert.throws(() => core.mergeCards([original], [card('new-card'), changed]), /Conflicting versions/);
assert.equal(JSON.stringify(bundle), before, 'conflict merge is atomic and does not mutate prior records');
assert.equal(core.mergeCards([original], [card('new-card')]).added, 1);

for (const mutate of [
  c => { delete c.reason; }, c => { c.reason = ''; }, c => { c.ticker = 'X'.repeat(21); },
  c => { c.adherence = 'PASS'; }, c => { c.savedAt = 'not-a-date'; },
  c => { c.amendments = Array(201).fill(amendment); }, c => { c.extra = 'unexpected'; },
  c => { c.amendments = [{ ...amendment, planned: 'Maybe' }]; }, c => { c.evidence = 1; }
]) {
  const c = card(); mutate(c);
  assert.throws(() => core.validate({ schema: core.schema, cards: [c] }));
}
assert.throws(() => core.validate({ schema: core.schema, cards: [card(), card()] }), /Invalid decision card/);
assert.throws(() => core.validate({ schema: 'future-version', cards: [] }), /Unsupported/);
assert.throws(() => core.validate({ schema: core.schema, cards: Array.from({ length: 501 }, (_, i) => card('id-' + i)) }), /500 cards/);
assert.deepEqual(core.validate(JSON.parse(core.backupText([original]))), canonical, 'own backup round trips');

const large = Array.from({ length: 120 }, (_, i) => {
  const c = card('large-' + i);
  for (const key of ['reason', 'evidence', 'checklist', 'entryRule']) c[key] = '\u4e2d'.repeat(4000);
  return c;
});
assert.throws(() => core.backupText(large), /5 MB/, 'UTF-8 backup bound, including serialization, is enforced');

for (const input of ['=1+1', '+1', '-1', '@SUM(A1)', ' \t=1', '\uFEFF=1', '\nformula']) {
  assert.ok(core.csvCell(input).startsWith('"\''), 'formula/control prefix escaped');
}
assert.equal(core.csvCell('a"b,c\nd'), '"a""b,c\nd"');
const csvCard = card(); csvCard.reason = '=1+1';
assert.ok(core.csvText([csvCard]).includes('"\'=1+1"'));
console.log('PASS journal core: canonical round trips, order-independent duplicates, atomic conflicts, malformed/oversized rejection, UTF-8 backup size and CSV formula protection.');
