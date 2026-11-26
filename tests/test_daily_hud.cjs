/* The HUD layer: the rules that keep the look from lying.
   Each check here guards a specific way a pretty interface can misreport the system. */
const fs = require('fs'), assert = require('assert');
const html = fs.readFileSync(__dirname + '/../amalgam-daily.html', 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

/* 1. The filled green BUY is the app telling you to act, so it follows the only rule the
      system can defend: all three gates cleared. It used to follow rank, and rank is decided
      by a 20-day strength tiebreak with no measured edge. */
ok(/html\.tron \.pk \.bt\.buy\{[\s\S]{0,160}?background:#07100c/.test(html),
   'a card that did not clear every gate gets the outline BUY');
ok(/html\.tron \.pk\.g3 \.bt\.buy\{[\s\S]{0,200}?linear-gradient/.test(html),
   'a 3-of-3 card gets the filled slab');
ok(!/:has\(\.pickr\) \.bt\.buy/.test(html),
   'the slab must not key on the PICK badge, which is rank and not a gate result');
ok(/var clean = \(c\.met === 3\);/.test(html) && /\(clean \? ' g3' : ''\)/.test(html),
   'the g3 class comes from the gate count');

/* A name that cleared every gate but lost the tiebreak is not "watch only". */
ok(/clean\s*\?\s*'<div class="role rankr">RANK '/.test(html),
   'a 3-of-3 card that is not rank 1 is labelled by its rank, not dismissed');
ok(/: '<div class="role watchr">WATCH ONLY<\/div>'/.test(html),
   'WATCH ONLY survives for a card that genuinely missed a gate');

/* 2. One renderer. Two copies of the race would eventually disagree about the ledger. */
ok(/function raceInline\(/.test(html), 'raceInline exists');
ok((html.match(/raceInline\(/g) || []).length >= 3,
   'both the always-on section and the phone sheet call raceInline');

/* 3. Nothing is scored yet. The panel must say so and must not draw a number. */
const src = html.slice(html.indexOf('function raceNum('));
ok(/AT THE LINE|START/.test(src), 'the empty state draws the starting grid');
ok(/\(s\.n\|\|0\)>0/.test(src.replace(/\s/g, '')),
   'a horizon value is only plotted when that lane has closed sessions behind it');

/* 4. Colour contract. Red is the frame of this app, so a red number would read as decoration
      rather than as a loss. Losses are slate, wins green, the benchmark amber. */
/* The START gate is structure and is allowed to be red. What must never be red is a line,
   a dot or a label that carries a result, because the whole frame of this app is red. */
const scored = src.slice(src.indexOf('} else {'), src.indexOf("/* the app states"));
ok(!/ff3b3b/i.test(scored), 'no red anywhere in the scored chart');
ok(/RACE_LANES = \{[\s\S]*?\n\};/.test(src.length ? html : ''), 'lane styles are declared in one table');
ok(/#7f93ad/.test(src) && /#2fd47a/.test(src) && /#f2b441/.test(src),
   'loss slate, win green and benchmark amber are all present');

/* 5. A true minus, so a column of results stays aligned under tabular figures. */
ok(/\\u2212|−/.test(src), 'negatives use U+2212, not a hyphen');

/* 6. The always-on race is a wide-screen feature. A phone keeps it behind its button, and the
      hide rule is a max-width query so it cannot win on source order. */
ok(/@media \(max-width:1279px\)\{ \.z-race\{display:none\} \}/.test(html),
   'the race is hidden below 1280 by a query, not by a bare rule');
ok(/@media \(min-width:1280px\)[\s\S]{0,1200}?\.z-race\{display:block\}/.test(html),
   'the race is revealed at 1280 and up');

/* 7. The phone layout must not change. The region wrappers vanish from layout below 1280. */
ok(/\.zgrid\{display:contents\}/.test(html), 'the grid container is display:contents by default');

console.log('PASS hud layer: buy hierarchy, one race renderer, honest empty state, colour contract, ' + n + ' checks.');
