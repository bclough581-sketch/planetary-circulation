'use strict';
// Regression cases ported from the legacy journal-stage1 red-team. Synthetic data only.
const assert = require('node:assert/strict');
const core = require('../journal-core.js');
function card(id = 'synthetic-1', extra = {}) {
  const c = { id, savedAt: '2026-11-06T12:00:00.000Z' };
  for (const f of core.fields) c[f] = '';
  return Object.assign(c, { ticker: 'TEST', recordType: 'Retrospective', outcome: 'Closed', reason: 'Synthetic record', adherence: 'Unresolved', amendments: [] }, extra);
}
const S = core.schema;

// 1. Syntactically valid JSON that is not a valid store must never validate (so the UI keeps it read-only).
for (const bad of [[null], [], [[]], {}, null, 'x', 7, true, { schema: S }, { schema: S, cards: [null] }, { schema: S, cards: 'x' }, { schema: S, cards: [card()], extra: 1 }, { cards: [card()] }]) {
  assert.throws(() => core.validate(bad), `rejected: ${JSON.stringify(bad)}`);
}
// A legacy-format (journal-stage1) backup must not be silently accepted or converted.
assert.throws(() => core.validate({ app: 'amalgam-journal', version: 1, entries: [{ id: 'a', ticker: 'TEST' }] }), /Unsupported/);
assert.throws(() => core.validate({ version: 1, entries: [] }), /Unsupported/);

// 2. Prototype-key and unsafe IDs are rejected, never used as map keys.
for (const id of ['__proto__', 'a_b', 'a b', '', 'x'.repeat(81), '../x']) {
  assert.throws(() => core.validate({ schema: S, cards: [card(id)] }), `unsafe id rejected: ${id}`);
}

// Names that merely look like prototype keys are legal ids and must stay inert (Map-based merge, no object-key lookup).
for (const id of ['constructor', 'prototype', 'toString', 'hasOwnProperty']) {
  const m = core.mergeCards([card('seed')], [card(id)]);
  assert.equal(m.added, 1); assert.deepEqual(m.cards.map(c => c.id), ['seed', id]);
  assert.equal(Object.getPrototypeOf(m.cards[0]), Object.prototype); assert.equal({}.polluted, undefined);
}

// 3. Duplicate IDs: never merged down. Same-ID distinct content, in one import or across stores, rejects atomically.
const a = card('same'), b = card('same', { reason: 'Different content' });
assert.throws(() => core.mergeCards([], [a, b]), /Invalid decision card/);
assert.throws(() => core.mergeCards([a], [b]), /Conflicting versions/);
const withAmend = card('same'); withAmend.amendments.push({ savedAt: '2026-11-06T13:00:00.000Z', change: 'c', reason: 'r', planned: 'Unknown', adherence: 'Unresolved' });
assert.throws(() => core.mergeCards([a], [withAmend]), /Conflicting versions/, 'an added amendment is also a conflict, never a silent replace');
// Equal or malformed timestamps do not authorize replacement either.
const later = card('same', { savedAt: '2027-01-01T00:00:00.000Z' }); const bad = card('same', { savedAt: 'garbage' });
assert.throws(() => core.mergeCards([a], [later]), /Conflicting versions/);
assert.throws(() => core.mergeCards([a], [bad]));
// Existing records and the incoming list are untouched after a rejected merge.
const store = [a], incoming = [b], s0 = JSON.stringify(store), i0 = JSON.stringify(incoming);
assert.throws(() => core.mergeCards(store, incoming));
assert.equal(JSON.stringify(store), s0); assert.equal(JSON.stringify(incoming), i0);

// 4. No lossy conversion: evidence at the 4,000-char limit survives a backup round trip exactly; 4,001 is refused, not clipped.
const full = card('full', { evidence: 'e'.repeat(4000) });
assert.equal(core.validate(JSON.parse(core.backupText([full])))[0].evidence.length, 4000);
assert.throws(() => core.validate({ schema: S, cards: [card('over', { evidence: 'e'.repeat(4001) })] }));
const amended = card('am'); amended.amendments = Array.from({ length: 200 }, (_, i) => ({ savedAt: '2026-11-06T13:00:00.000Z', change: 'c' + i, reason: 'r', planned: 'Unknown', adherence: 'Unresolved' }));
assert.equal(core.validate(JSON.parse(core.backupText([amended])))[0].amendments.length, 200, '200 amendments preserved');

// 5. CSV formula protection: whitespace, NBSP, BOM, tab/CR/LF lead, each formula lead character, in any field.
for (const lead of ['=', '+', '-', '@']) for (const pad of ['', ' ', '  ', ' ', '﻿', ' ﻿ ', '\t']) {
  assert.ok(core.csvCell(pad + lead + 'cmd').startsWith('"\''), `escaped: ${JSON.stringify(pad + lead)}`);
}
for (const lead of ['\r=1', '\n=1', '\t=1']) assert.ok(core.csvCell(lead).startsWith('"\''));
assert.equal(core.csvCell('plain'), '"plain"');
for (const f of ['evidence', 'lesson', 'exitReason']) {
  const c = card('csv', { [f]: ' =HYPERLINK("http://x")' });
  assert.ok(core.csvText([c]).includes('"\' =HYPERLINK'), `field ${f} escaped`);
}
console.log('PASS journal regression (core): non-store JSON shapes, legacy format, unsafe ids, duplicate/conflict policy, lossless limits, CSV leading characters.');
