'use strict';
// The install-time precache. Every file here is downloaded before a phone can show anything, so
// the list is a budget, not a wish list. The fetch handler caches everything else on first visit,
// which is why trimming this costs no page its offline support after one open.
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'..');
const SW=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');

const decl=SW.match(/const SHELL='([^']+)', FILES=\[(.*?)\];/s);
assert.ok(decl,'sw.js still declares SHELL and FILES');
const shell=decl[1], files=[...decl[2].matchAll(/'([^']+)'/g)].map(m=>m[1]);

// addAll rejects as a whole, so one missing file means no offline support at all, silently.
const missing=files.filter(f=>f!=='./'&&!fs.existsSync(path.join(ROOT,f)));
assert.deepEqual(missing,[],'every precached file exists');

const bytes=files.filter(f=>f!=='./').reduce((s,f)=>s+fs.statSync(path.join(ROOT,f)).size,0);
assert.ok(bytes<400*1024,'install payload is '+Math.round(bytes/1024)+' KB, budget is 400 KB');
const heavy=files.filter(f=>f!=='./'&&fs.statSync(path.join(ROOT,f)).size>250*1024);
assert.deepEqual(heavy,[],'no single file over 250 KB is precached');

// What the app itself needs in order to open with no network.
for(const f of ['./','index.html','amalgam-daily.html','manifest.webmanifest'])
  assert.ok(files.includes(f),'the app shell precaches '+f);
// Icons the page asks for by name, as opposed to the ones the OS fetches from the manifest.
const iconRefs=[...fs.readFileSync(path.join(ROOT,'amalgam-daily.html'),'utf8')
  .matchAll(/href="([a-z0-9._-]+\.(?:png|svg))"/g)].map(m=>m[1]);
for(const f of new Set(iconRefs)) assert.ok(files.includes(f),'the page references '+f+', so it is precached');

// The side pages are deliberately absent: they are 1.7 MB and are cached on first visit instead.
for(const f of ['d9-star-ring.png','icon-512.png','map.html','land.json','galaxy-ring.svg','ring-engine-lab.html'])
  assert.ok(!files.includes(f),f+' must not be in the install payload');

// A changed list with an unchanged name leaves every existing install on the old cache.
assert.ok(/^pc-shell-v(\d+)$/.test(shell),'the cache name carries a version');
assert.ok(+shell.match(/\d+/)[0]>=52,'the cache name was bumped when the list changed');

console.log('test_sw_precache.cjs PASS  '+files.length+' files, '+Math.round(bytes/1024)+' KB at install');
