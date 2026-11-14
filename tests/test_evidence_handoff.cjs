const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const preview=await startPreview();
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(preview.url))remote.push(r.url());});
 const base=preview.url;
 await page.goto(base+'decision-journal.html');
 await page.locator('#ticker').fill('EXISTING');await page.locator('#reason').fill('Synthetic pre-existing record');
 await page.getByRole('button',{name:'Save original card',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Original card saved'));
 const original=await page.evaluate(()=>localStorage.getItem('amalgam.decision-journal.v1'));
 for(const period of ['annual','Q3']){
  await page.goto(base+'ring-engine-lab.html');await page.locator('#casePeriod').selectOption(period);
  const expectedFinding=await page.locator('#caseFinding').innerText();
  const expectedSource=await page.locator('#caseSources a').first().getAttribute('href');
  await page.locator('#keepCaseEvidence').click();
  await page.waitForURL('**/decision-journal.html#evidence-draft');
  assert.equal(await page.locator('#ticker').inputValue(),'DAL');
  assert.equal(await page.locator('#recordType').inputValue(),'Plan recorded now');
  assert.equal(await page.locator('#outcome').inputValue(),'Considering');
  assert.equal(await page.locator('#reason').inputValue(),'','no auto-authored investment thesis');
  assert.equal(await page.locator('#draftNotice').isVisible(),true);
  const evidence=await page.locator('#evidence').inputValue();
  assert.ok(evidence.includes(expectedFinding));assert.ok(evidence.includes(expectedSource));
  assert.ok(evidence.includes(period==='annual'?'Full year 2025 vs 2024':'Q3 2025 vs 2024'));
  assert.ok(evidence.includes('not source publication time'));assert.ok(evidence.includes('not independent corroboration'));
  assert.ok(evidence.includes('Historical context only'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('amalgam.decision-journal.v1')),original,'handoff does not save or change original cards');
 }
 await page.locator('#reason').fill('Reviewing historical evidence; no order planned.');
 await page.locator('#outcome').selectOption('Decided against trading');
 await page.getByRole('button',{name:'Save original card',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Original card saved'));
 assert.match(await page.locator('#status').innerText(),/Original card saved/);
 assert.equal(await page.locator('.entry').count(),2);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('amalgam.evidence-draft.v1')),null);
 assert.equal(new URL(page.url()).hash,'');
 await page.reload();assert.equal(await page.locator('#draftNotice').isVisible(),false);
 let cards=await page.evaluate(()=>JSON.parse(localStorage.getItem('amalgam.decision-journal.v1')).cards);
 assert.equal(cards[0].reason,'Synthetic pre-existing record');
 assert.equal(cards[1].outcome,'Decided against trading');assert.match(cards[1].evidence,/Q3 2025 vs 2024/);
 const saved=JSON.stringify(cards);
 // Invalid handoff fails without changing saved records or inserting markup.
 await page.evaluate(()=>sessionStorage.setItem('amalgam.evidence-draft.v1',JSON.stringify({schema:'wrong',ticker:'<script>',capturedAt:'bad',evidence:'bad'})));
 await page.goto(base+'decision-journal.html#evidence-draft');await page.reload();
 assert.match(await page.locator('#status').innerText(),/not loaded/);
 assert.equal(await page.locator('#ticker').inputValue(),'');
 assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('amalgam.decision-journal.v1')).cards)),saved);
 // Missing draft link is also safe.
 await page.evaluate(()=>sessionStorage.removeItem('amalgam.evidence-draft.v1'));await page.reload();
 assert.match(await page.locator('#status').innerText(),/No valid evidence draft/);
 for(const width of [390,320]){await page.setViewportSize({width,height:850});await page.goto(base+'ring-engine-lab.html');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#keepCaseEvidence').click();await page.waitForURL('**/decision-journal.html#evidence-draft');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.setViewportSize({width:1280,height:950});
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 console.log('PASS: annual and quarterly figures/sources, unsaved handoff, prior-record preservation, save/reload, draft cleanup, malformed/missing draft rejection, responsive layout, no outbound requests.');
}finally{await browser.close();await preview.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
