'use strict';
// Each card is sized alone to risk about 3% of equity. Once the lit BUY followed the gates
// instead of rank, several cards could be lit at once, and on a small account their combined
// cost can exceed cash while their combined risk is a multiple of one trade. This guards the
// line that does that addition on screen.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'amalgam-daily.html'), 'utf8');

function extract(name){
  const start = SRC.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' is missing');
  let depth = 0;
  for (let j = SRC.indexOf('{', start); j < SRC.length; j++){
    if (SRC[j] === '{') depth++; else if (SRC[j] === '}'){ depth--; if (!depth) return SRC.slice(start, j + 1); }
  }
  throw new Error('unbalanced braces in ' + name);
}
const BODY = extract('basketNote');
const run = (S, P, decided) => new Function('S', 'P', 'decided', BODY + '\nreturn basketNote(P);')(S, P, decided);

const card = (sym, sh, entry, stop, met) => ({
  m: {sym}, met: met === undefined ? 3 : met,
  z: {sh, cash: sh * entry, risk: sh * (entry - stop)}
});
const none = () => null;
// deliberately not Brent's figures: a round account, so a leak here would be obvious
const ACCT = {netLiq: 10000, cash: 5000, sample: false};

// 1. one card needs no addition
assert.equal(run({acct: ACCT}, [card('AAA', 10, 100, 97)], none), '');

// 2. no account, or the sample account, means no claim about cash
assert.equal(run({acct: null}, [card('AAA', 10, 100, 97), card('BBB', 10, 100, 97)], none), '');
assert.equal(run({acct: {netLiq: 10000, cash: 5000, sample: true}},
                 [card('AAA', 10, 100, 97), card('BBB', 10, 100, 97)], none), '');

// 3. two affordable cards: states the combined risk and the multiple, no alarm
const ok = run({acct: ACCT}, [card('AAA', 10, 100, 97), card('BBB', 10, 100, 97)], none);
assert.match(ok, /ALL 2 TOGETHER/);
assert.match(ok, /\$2,000 against \$5,000 of cash/);
assert.match(ok, /risk about 0\.3% on its own/);
assert.match(ok, /All 2 would risk 0\.6%, which is 2\.0 times one trade/);
assert.ok(!/short by/.test(ok), 'an affordable basket must not claim a shortfall');

// 4. a basket that will not fit says so, and says by how much
const over = run({acct: ACCT}, [card('AAA', 30, 100, 97), card('BBB', 30, 100, 97)], none);
assert.match(over, /YOU CANNOT TAKE ALL 2/);
assert.match(over, /short by \$1,000/);

// 5. a card already decided today drops out of the arithmetic
const decidedAAA = s => (s === 'AAA' ? {decision: 'buy'} : null);
assert.equal(run({acct: ACCT}, [card('AAA', 10, 100, 97), card('BBB', 10, 100, 97)], decidedAAA), '');

// 6. a card that missed a gate is not part of the basket either
assert.equal(run({acct: ACCT}, [card('AAA', 10, 100, 97), card('BBB', 10, 100, 97, 2)], none), '');

// 7. amalgam-daily.html is served publicly from GitHub Pages, so the real account must never
//    be baked into it. The page is allowed a placeholder; every account object literal in the
//    file has to carry sample:true. The live figures arrive in the push link at run time.
//    This is not hypothetical: a draft of basketNote carried the real cash figure in a code
//    comment and was caught before it was written.
const accts = SRC.match(/acct\s*:\s*\{[^}]*\}/g) || [];
assert.ok(accts.length > 0, 'expected at least the placeholder account');
for (const a of accts) assert.match(a, /sample\s*:\s*true/, 'an account literal is not marked as a sample: ' + a);
assert.ok(!/netLiq\s*:\s*\d+\s*,\s*cash\s*:\s*\d+\s*\}/.test(SRC.replace(/sample\s*:\s*true/g, 'S')),
          'an unmarked netLiq/cash pair is in the published page');

console.log('PASS basket arithmetic: combined cost and risk shown, shortfall named, 10 checks.');
