'use strict';
// Phase 1 wide layout. The contract is that the phone is untouched: every wide rule lives
// inside a min-width query, and the region wrappers are display:contents below the breakpoint.
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'..');
const SRC=fs.readFileSync(path.join(ROOT,'amalgam-daily.html'),'utf8');
const WIDE=fs.readFileSync(path.join(ROOT,'wide.css'),'utf8');

// 1. nothing outside a media query may change the phone, except the wrappers disappearing
const outside=WIDE.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g,'')
                  .replace(/\/\*[\s\S]*?\*\//g,'').trim();
assert.equal(outside,'#app > .z{display:contents}','only the display:contents rule may sit outside a query');

// 2. the regions exist in the render and are wrapped
for(const cls of ['z-hud','z-picks','z-meter','z-inst','z-sig'])
  assert.ok(SRC.includes('class="z '+cls+'"'),'missing region '+cls);
assert.ok(/<section class="z z-picks">'\+picksBlock\(P\)\+'<\/section>/.test(SRC),'picks must be wrapped whole');

// 3. the svg width functions must measure their container, not the window. keying off the
//    window overflowed the block the moment the column stopped being the full viewport.
const clw=SRC.slice(SRC.indexOf('function clW()'),SRC.indexOf('function clW()')+420);
assert.match(clw,/querySelector\('\.cl'\)/,'clW must measure the block it draws into');
assert.doesNotMatch(SRC,/var W=Math\.round\(Math\.min\(window\.innerWidth\|\|390,430\)-20\)/,
  'the hud must not size itself from the window any more');

// 4. the breakpoints widen the column and the cards, which is the whole point
assert.match(WIDE,/@media \(min-width:1000px\)/);
assert.match(WIDE,/#app\{max-width:1080px\}/);
assert.match(WIDE,/#app > \.z\{display:block\}/);
assert.match(WIDE,/\.sheet\{max-width:860px/,'panels are a reading surface on a desktop');

// 5. no phone-breaking selector: nothing in a query may target a width below the breakpoint
assert.doesNotMatch(WIDE,/max-width:\s*\d{3}px\)/,'no max-width media queries, phone rules stay in the app');

console.log('PASS wide layout: regions wrapped, container-measured svg, phone rules untouched, 5 checks.');
