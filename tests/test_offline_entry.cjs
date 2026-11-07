'use strict';
// Offline-entry regression: after one visit, reopening the root with the server gone must still reach the Explorer.
const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const preview=await startPreview();let closed=false;
try{
  const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];
  await ctx.route(u=>!u.href.startsWith(preview.url)&&u.protocol!=='data:',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(preview.url);await page.waitForURL(/ring-engine-lab\.html/);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  const cached=await page.evaluate(async()=>{const ks=await caches.keys();const c=await caches.open(ks[0]);return (await c.keys()).map(r=>new URL(r.url).pathname);});
  for(const f of ['/','/index.html','/ring-engine-lab.html','/amalgam-theme.css','/ring-evidence.js','/galaxy-ring.svg','/intelligence/data/delta-quarterly-curated.json','/decision-journal.html','/journal-core.js','/scoreboard.html','/scoreboard.json','/map.html'])assert.ok(cached.includes(f),'cached: '+f);
  await page.reload();await page.waitForSelector('#openCase');
  assert.ok(await page.evaluate(()=>!!navigator.serviceWorker.controller),'page controlled by the service worker');
  await preview.close();closed=true; // server unavailable from here on
  const root=await ctx.newPage();
  await root.goto(preview.url);await root.waitForURL(/ring-engine-lab\.html/);
  assert.match(await root.textContent('header'),/EVIDENCE EXPLORER/);
  assert.ok(await root.locator('#openCase').count(),'Explorer content renders offline');
  await root.click('header a[href="scoreboard.html"]');await root.waitForURL(/scoreboard\.html/);await root.waitForSelector('#grave details');
  await root.click('a.back[href="decision-journal.html"]');await root.waitForURL(/decision-journal\.html/);
  await root.click('header a[href="ring-engine-lab.html"]');await root.waitForURL(/ring-engine-lab\.html/);
  assert.deepEqual(errors,[]);
  console.log('PASS offline entry: root reopens to the Explorer with the server stopped; Explorer, journal and scoreboard load from the cache; shell files precached.');
}finally{await browser.close();if(!closed)await preview.close();}
})().catch(e=>{console.error(e);process.exit(1)});
