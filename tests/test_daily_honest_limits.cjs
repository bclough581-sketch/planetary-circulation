'use strict';
// E5: the app must say plainly that its method is unproven, wherever it shows picks or a score.
// The gates failed their sealed 2018-2021 hold-out on 2026-10-15 and 26 preregistered premises
// have been tested with none passing. An app that shows gate dots and score meters without
// carrying that result overstates itself.
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const SRC=fs.readFileSync(path.join(__dirname,'..','amalgam-daily.html'),'utf8');

function extract(name){
  const start=SRC.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' is missing');
  let depth=0;
  for(let j=SRC.indexOf('{',start);j<SRC.length;j++){
    if(SRC[j]==='{')depth++; else if(SRC[j]==='}'){depth--;if(!depth)return SRC.slice(start,j+1);}
  }
  throw new Error('unbalanced braces in '+name);
}

// 1. the note exists and renders
const html=new Function(extract('noEdgeNote')+'\nreturn noEdgeNote();')();
assert.ok(html&&html.length>80,'the note must render real content');

// 2. it makes every claim it is there to make, in plain words
const text=html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
assert.match(text,/NO EDGE PROVEN/);
assert.match(text,/out-of-sample/i,'must name the failed out-of-sample test');
assert.match(text,/26 preregistered premises/,'must give the count, not a vague hedge');
assert.match(text,/none passing/i,'must say none passed');
assert.match(text,/not evidence that the method works/i,'must deny the thing a user would assume');

// 3. it is shown with the picks, and on the scoreboard
assert.match(extract('picksBlock'),/noEdgeNote\(\)/,'the picks block must carry it');
assert.ok(/noEdgeNote\(\)\+\s*\n?\s*'<div class="cp"><b>READ THIS FIRST/.test(SRC),
  'the scoreboard must carry it beside the small-sample warning');
assert.ok((SRC.match(/noEdgeNote\(\)/g)||[]).length>=3,'one definition and at least two uses');

// 4. the three cards still come before it, so P1 (cards above the fold) is not broken
const pb=extract('picksBlock');
assert.ok(pb.indexOf('cardHtml')<pb.indexOf('noEdgeNote()'),'the note sits below the cards');

// 5. the picks label no longer claims the push when the picks came from the published file
assert.doesNotMatch(SRC,/FROM YOUR PUSH/,'that label is wrong now that picks also arrive in the file');

console.log('PASS honest limits: NO EDGE PROVEN renders, states all four facts, shown under the cards and on the scoreboard, 5 checks.');
