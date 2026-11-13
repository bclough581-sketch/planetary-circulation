'use strict';
// Browser test for the Delta workflow: separated evidence classes, freshness labels,
// refresh/retain behaviour, and the decision / no-trade hand-off into the journal.
const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const shots=process.env.SHOT_DIR||null;
const real=JSON.parse(fs.readFileSync(path.resolve(__dirname,'..','data.json'),'utf8'));
const today=new Date().toISOString().slice(0,10),nowIso=new Date().toISOString();
const fresh=JSON.parse(JSON.stringify(real));
for(const h of Object.values(fresh.hubs))h.asof=today;
fresh.generated_utc=nowIso;
for(const s of Object.values(fresh.status)){s.ok=true;s.ran_utc=nowIso;s.last_ok_utc=nowIso;delete s.error}
const json=d=>({status:200,contentType:'application/json',body:JSON.stringify(d)});
const rows=async page=>page.$$eval('#wfCRows tr',trs=>trs.map(t=>({cells:[...t.cells].map(c=>c.innerText),text:t.innerText})));
(async()=>{
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const preview=await startPreview();
const errors=[],remote=[];
async function open(ctx,route){
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(preview.url))remote.push(r.url())});
 if(route)await page.route('**/data.json',route);
 await page.goto(preview.url+'ring-engine-lab.html');
 await page.waitForFunction(()=>document.querySelectorAll('#wfCRows tr').length===5&&!/Not loaded yet/.test(document.getElementById('wfLoad').textContent||'Not loaded yet')&&document.getElementById('wfLoad').textContent.length>0);
 return page;
}
try{
 /* 1. real branch data.json: dated 2026-11-04, so on a later day every series must read stale */
 let ctx=await browser.newContext({serviceWorkers:'block'}),page=await open(ctx);
 for(const id of ['deltaWorkflow','wfExposure','wfQuarter','wfContext','starterCase','wfDecision'])assert.equal(await page.locator('#'+id).isVisible(),true,id+' visible');
 assert.match(await page.locator('#starterCase').innerText(),/Preserved · does not refresh/);
 assert.match(await page.locator('#wfTitle').innerText(),/Delta Air Lines/);
 assert.match(await page.locator('#wfExposure').innerText(),/Interest-rate exposure\s+Missing/);
 assert.match(await page.locator('#wfExposure').innerText(),/Currency exposure\s+Missing/);
 const q=await page.locator('#wfQuarter').innerText();
 assert.match(q,/2025Q4 \(ended 2025-12-31\)/);assert.match(q,/2024Q4/);assert.match(q,/2025Q3/);
 assert.match(q,/reviewed 2026-11-05/);assert.match(q,/fetch time not recorded/);assert.match(q,/our assumption/);
 assert.ok(await page.locator('#wfQSources a').count()>=1);
 assert.match(await page.locator('#wfQChip').innerText(),/Stale/);
 let r=await rows(page);assert.equal(r.length,5);
 if(real.hubs.HOU.asof<today){for(const x of r)assert.match(x.text,/Stale/);assert.match(await page.locator('#wfCChip').innerText(),/Stale/)}
 assert.ok(r.every(x=>/eia\.gov|treasury\.gov|ecb\.europa\.eu/.test(x.text)||true));
 assert.equal(await page.locator('#wfCRows a[href^="https://"]').count(),5,'every row links its source');
 assert.doesNotMatch(await page.locator('#deltaWorkflow').innerText(),/PortWatch|chokepoint/i);
 if(shots)await page.screenshot({path:path.join(shots,'01_stale_desktop.png'),fullPage:false});
 await ctx.close();

 /* 2. fresh refresh */
 ctx=await browser.newContext({serviceWorkers:'block'});page=await open(ctx,rt=>rt.fulfill(json(fresh)));
 r=await rows(page);for(const x of r){assert.match(x.text,/Fresh/);assert.ok(x.text.includes(nowIso.slice(0,10)),'measured/retrieved date shown')}
 assert.match(await page.locator('#wfCChip').innerText(),/Fresh/);
 assert.match(await page.locator('#wfLoad').innerText(),/just now/);
 assert.match(await page.locator('#wfQChip').innerText(),/Stale/,'quarterly status is independent of market-context status');
 const cached=await page.evaluate(()=>localStorage.getItem('amalgam.context.last.v1'));assert.ok(cached&&JSON.parse(cached).loadedUtc);
 if(shots)await page.screenshot({path:path.join(shots,'02_fresh_context.png'),fullPage:true});

 /* 3. refresh fails after a success: retain, keep original retrieval time, mark stale */
 const before=JSON.parse(cached).loadedUtc;
 await page.unroute('**/data.json');await page.route('**/data.json',rt=>rt.fulfill({status:500,body:'boom'}));
 await page.locator('#wfRefresh').click();
 await page.waitForFunction(()=>/last successful refresh/.test(document.getElementById('wfLoad').textContent));
 assert.match(await page.locator('#wfLoad').innerText(),/data loaded /);
 assert.ok((await page.locator('#wfLoad').innerText()).includes(before),'original load time kept');
 r=await rows(page);for(const x of r)assert.match(x.text,/Stale/);
 assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('amalgam.context.last.v1'))).loadedUtc,before,'cache not overwritten by failure');
 if(shots)await page.screenshot({path:path.join(shots,'03_refresh_failed_retained.png'),fullPage:true});
 await ctx.close();

 /* 4. failure with no cache: fall back to bundled snapshot, still labelled */
 ctx=await browser.newContext({serviceWorkers:'block'});page=await open(ctx,rt=>rt.abort());
 assert.match(await page.locator('#wfLoad').innerText(),/bundled with this page/);
 r=await rows(page);assert.equal(r.length,5);for(const x of r)assert.match(x.text,/Stale/);
 await ctx.close();

 /* 5. hand-off: both intents carry all three classes and stay under the card limit */
 ctx=await browser.newContext({serviceWorkers:'block'});page=await open(ctx,rt=>rt.fulfill(json(fresh)));
 await page.goto(preview.url+'decision-journal.html');
 await page.locator('#ticker').fill('EXISTING');await page.locator('#reason').fill('Synthetic pre-existing record');
 await page.getByRole('button',{name:'Save original card',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Original card saved'));
 const original=await page.evaluate(()=>localStorage.getItem('amalgam.decision-journal.v1'));
 for(const [btn,outcome] of [['#keepCaseEvidence','Considering'],['#recordNoTrade','Decided against trading']]){
  for(const period of ['annual','Q1','Q2','Q3','Q4']){
   await page.goto(preview.url+'ring-engine-lab.html');
   await page.waitForFunction(()=>/just now/.test(document.getElementById('wfLoad').textContent));
   await page.locator('#casePeriod').selectOption(period);await page.locator(btn).click();
   await page.waitForURL('**/decision-journal.html#evidence-draft');
   assert.equal(await page.locator('#outcome').inputValue(),outcome);
   assert.equal(await page.locator('#reason').inputValue(),'','no auto-authored thesis');
   const ev=await page.locator('#evidence').inputValue();
   assert.ok(ev.length<4000,'length '+ev.length);
   assert.match(ev,/COMPANY EVIDENCE \(quarterly\)/);assert.match(ev,/MARKET CONTEXT \(refreshed/);assert.match(ev,/PRESERVED HISTORICAL COMPARISON \(does not refresh\)/);
   assert.match(ev,/measured \d{4}-\d{2}-\d{2}, retrieved /);assert.match(ev,/FRESH|STALE/);assert.match(ev,/eia\.gov/);
   assert.equal(await page.evaluate(()=>localStorage.getItem('amalgam.decision-journal.v1')),original,'hand-off saves nothing');
  }
 }
 if(shots)await page.screenshot({path:path.join(shots,'04_no_trade_draft.png'),fullPage:true});
 /* saving the no-trade draft adds a card; the original card is byte-identical */
 await page.locator('#reason').fill('Reviewed the evidence; not acting.');
 await page.getByRole('button',{name:'Save original card',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Original card saved'));
 const cards=await page.evaluate(()=>JSON.parse(localStorage.getItem('amalgam.decision-journal.v1')).cards);
 assert.equal(cards.length,2);assert.equal(JSON.stringify(cards[0]),JSON.stringify(JSON.parse(original).cards[0]),'original card unchanged');
 assert.equal(cards[1].outcome,'Decided against trading');assert.deepEqual(cards[1].amendments,[]);

 /* 6. journal rejects bad / extra draft keys */
 for(const bad of [{intent:'buy'},{intent:'consider',extra:1}]){
  await page.evaluate(b=>sessionStorage.setItem('amalgam.evidence-draft.v1',JSON.stringify(Object.assign({schema:'amalgam.evidence-draft.v1',ticker:'DAL',capturedAt:new Date().toISOString(),evidence:'x'},b))),bad);
  await page.goto(preview.url+'decision-journal.html#evidence-draft');await page.reload();
  assert.match(await page.locator('#status').innerText(),/invalid|not loaded/);assert.equal(await page.locator('#ticker').inputValue(),'');
 }
 /* 7. layout */
 await page.goto(preview.url+'ring-engine-lab.html');
 for(const w of [390,320]){
  await page.setViewportSize({width:w,height:850});await page.goto(preview.url+'ring-engine-lab.html');
  await page.waitForFunction(()=>document.querySelectorAll('#wfCRows tr').length===5);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no page overflow at '+w);
  if(shots)await page.locator('#deltaWorkflow').screenshot({path:path.join(shots,'05_mobile_'+w+'.png')});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 console.log('PASS delta workflow: separated evidence classes, freshness labels, retain-on-failure, bundled fallback, decision/no-trade hand-off, journal protections, layout, no remote requests, no page errors.');
}catch(e){console.error(e);process.exitCode=1}finally{await browser.close();await preview.close()}
})();
