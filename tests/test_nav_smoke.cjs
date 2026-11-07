'use strict';
// Navigation and narrow-phone smoke checks for the integration draft. Loopback only.
const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const FULL_HASH='0BB6ECCD4C9EDD162B481E98ABA00085321510BD35F242E9DB3BE59F9EF1FDEB';
(async()=>{
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const preview=await startPreview();
try{
  const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{const u=r.url();if(u.startsWith(preview.url)||u.startsWith('data:'))return;if(/map\.html$/.test(page.url())&&u.startsWith('https://fonts.googleapis.com/'))return;external.push(u);}); // the live map's existing font request is the only allowed outbound call
  const path=()=>new URL(page.url()).pathname;
  // 1. Root lands on the approved ring Explorer
  await page.goto(preview.url);await page.waitForURL(/ring-engine-lab\.html/);
  assert.match(await page.textContent('header'),/EVIDENCE EXPLORER/);
  assert.ok(await page.locator('#openCase').count(),'Explorer hero present');
  // 2. Explorer -> journal -> back to Explorer
  await page.click('header a[href="decision-journal.html"]');await page.waitForURL(/decision-journal\.html/);
  await page.click('header a[href="ring-engine-lab.html"]');await page.waitForURL(/ring-engine-lab\.html/);
  // 3. Explorer -> scoreboard -> Explorer; scoreboard -> journal -> scoreboard
  await page.click('header a[href="scoreboard.html"]');await page.waitForURL(/scoreboard\.html/);
  await page.waitForSelector('#grave details');
  await page.click('a.back[href="decision-journal.html"]');await page.waitForURL(/decision-journal\.html/);
  await page.click('header a[href="scoreboard.html"]');await page.waitForURL(/scoreboard\.html/);
  await page.click('a.back[href="ring-engine-lab.html"]');await page.waitForURL(/ring-engine-lab\.html/);
  // 4. Explorer -> live map -> Explorer (root), map still renders its own page
  await page.click('header a[href="map.html"]');await page.waitForURL(/map\.html/);
  await page.click('.legalrow a[href="./"]');await page.waitForURL(/ring-engine-lab\.html/);
  // 5. Scoreboard narrow-phone layout: no horizontal overflow, full DIL1 hash intact and visible
  for(const w of [375,390]){
    const p=await ctx.newPage();await p.setViewportSize({width:w,height:800});
    await p.goto(preview.url+'scoreboard.html');await p.waitForSelector('#grave details');
    for(const d of await p.locator('#grave details').all())await d.evaluate(e=>e.open=true);
    const m=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,txt:document.body.innerText}));
    assert.ok(m.sw<=m.cw,'no horizontal overflow at '+w+' ('+m.sw+'>'+m.cw+')');
    assert.ok(m.txt.replace(/\s+/g,'').includes(FULL_HASH),'complete DIL1 hash present at '+w);
    const wide=await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>document.documentElement.clientWidth+1).length);
    assert.equal(wide,0,'no element extends past viewport at '+w);
    await p.close();
  }
  // 6. Gap disclosures remain visible on the four rows
  {const p=await ctx.newPage();await p.goto(preview.url+'scoreboard.html');await p.waitForSelector('#grave details');assert.equal(await p.locator('#grave .tag.gap').count(),4);await p.close();}
  assert.deepEqual(errors,[]);assert.deepEqual(external,[],'no outbound requests');
  console.log('PASS nav smoke: entry lands on Explorer, Explorer/journal/scoreboard/map routes and returns work, scoreboard has no overflow at 375/390 with full hash, no errors, no outbound requests.');
}finally{await browser.close();await preview.close();}
})().catch(e=>{console.error(e);process.exit(1)});
