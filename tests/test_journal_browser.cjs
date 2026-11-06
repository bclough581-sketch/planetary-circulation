const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const preview=await startPreview();
try{
const context=await browser.newContext({acceptDownloads:true});
const page=await context.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
const url=preview.url+'decision-journal.html';
await page.goto(url);await page.evaluate(()=>localStorage.clear());await page.reload();
await page.locator('#ticker').fill('TEST');await page.locator('#reason').fill('=1+1');
await page.locator('#evidence').fill('<img src=x onerror=alert(1)>');
await page.getByRole('button',{name:'Save original card',exact:true}).click();
await page.waitForFunction(()=>/Original card saved|Not saved:/.test(document.getElementById('status').textContent));
assert.match(await page.locator('#status').innerText(),/Original card saved/);
await page.reload();assert.equal(await page.locator('.entry').count(),1);
await page.getByText('Original card and amendments',{exact:true}).click();
assert.match(await page.locator('.entry').innerText(),/<img src=x onerror=alert\(1\)>/);
assert.equal(await page.locator('.entry img').count(),0);
await page.getByText('Add an amendment / missing execution details',{exact:true}).click();
await page.locator('.entry textarea[name=change]').fill('Stop revised; level Unknown');
await page.locator('.entry textarea[name=reason]').fill('Recollection only; execution record not checked');
await page.getByRole('button',{name:'Save amendment',exact:true}).click();
await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Amendment saved'));
assert.match(await page.locator('#status').innerText(),/Original card preserved/);
let stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('amalgam.decision-journal.v1')));
assert.equal(stored.cards[0].reason,'=1+1');assert.equal(stored.cards[0].amendments.length,1);
assert.equal(stored.cards[0].amendments[0].adherence,'Unresolved');
await page.locator('#backup').click();
const backupBytes=Buffer.from(await page.locator('#exportText').inputValue());
assert.deepEqual(JSON.parse(backupBytes),stored);
await page.locator('#csv').click();
const csvText=await page.locator('#exportText').inputValue();
assert.ok(csvText.includes('"\'=1+1"'),'spreadsheet formula neutralized');
page.once('dialog',d=>d.accept());await page.locator('#deleteAll').click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('All local cards deleted'));assert.equal(await page.locator('.entry').count(),0);
await page.locator('#restore').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:backupBytes});
await page.waitForFunction(()=>document.getElementById('status').textContent.includes('1 cards added'));
assert.equal(await page.locator('.entry').count(),1);
// Invalid/conflicting backups leave existing records intact.
const conflict=JSON.parse(backupBytes);conflict.cards[0].reason='Conflicting copy';
await page.locator('#restore').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(conflict))});
await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Conflicting versions'));
assert.equal(await page.locator('.entry').count(),1);
// Another tab's write is detected before saving.
await page.evaluate(()=>{const key='amalgam.decision-journal.v1',d=JSON.parse(localStorage.getItem(key));d.cards[0].lesson='Changed elsewhere';localStorage.setItem(key,JSON.stringify(d));});
await page.locator('#ticker').fill('OTHER');await page.locator('#reason').fill('New idea');
await page.getByRole('button',{name:'Save original card',exact:true}).click();
await page.waitForFunction(()=>/Original card saved|Not saved:/.test(document.getElementById('status').textContent));
assert.match(await page.locator('#status').innerText(),/changed in another tab/);
assert.equal(await page.locator('#reason').inputValue(),'New idea');
await page.reload();
for(const width of [1280,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no overflow at ${width}`);}
await page.setViewportSize({width:1280,height:950});

// A write failure leaves the form and previously saved records untouched.
const savedBeforeFailure=await page.evaluate(()=>localStorage.getItem('amalgam.decision-journal.v1'));
await page.evaluate(()=>{window.originalStorageWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Test quota exhausted','QuotaExceededError');};});
await page.locator('#ticker').fill('QUOTA');await page.locator('#reason').fill('Unsaved note retained');
await page.getByRole('button',{name:'Save original card',exact:true}).click();
await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Not saved:'));
assert.equal(await page.locator('#reason').inputValue(),'Unsaved note retained');
assert.equal(await page.evaluate(()=>localStorage.getItem('amalgam.decision-journal.v1')),savedBeforeFailure);
await page.evaluate(()=>{Storage.prototype.setItem=window.originalStorageWrite;});await page.reload();
// Editing during a queued save cannot erase the newer unsaved form text.
await page.evaluate(()=>{window.originalLockRequest=navigator.locks.request.bind(navigator.locks);navigator.locks.request=(name,callback)=>new Promise((resolve,reject)=>{window.finishQueuedSave=()=>window.originalLockRequest(name,callback).then(resolve,reject);});});
await page.locator('#ticker').fill('QUEUED');await page.locator('#reason').fill('Original queued reason');
await page.getByRole('button',{name:'Save original card',exact:true}).click();
assert.equal(await page.getByRole('button',{name:'Save original card',exact:true}).isDisabled(),true);
await page.locator('#reason').fill('Newer unsaved edit');
await page.evaluate(()=>{navigator.locks.request=window.originalLockRequest;window.finishQueuedSave();});
await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Newer edits remain'));
assert.equal(await page.locator('#reason').inputValue(),'Newer unsaved edit');
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('amalgam.decision-journal.v1')).cards.at(-1).reason),'Original queued reason');
await page.reload();
// Simultaneous writes from two tabs serialize: the stale tab cannot overwrite.
const second=await context.newPage();await second.goto(url);
for(const [tab,ticker] of [[page,'FIRST'],[second,'SECOND']]){await tab.locator('#ticker').fill(ticker);await tab.locator('#reason').fill('Synthetic concurrent write');}
await Promise.all([page.getByRole('button',{name:'Save original card',exact:true}).click(),second.getByRole('button',{name:'Save original card',exact:true}).click()]);
for(const tab of [page,second])await tab.waitForFunction(()=>/Original card saved|Not saved:/.test(document.getElementById('status').textContent));
const statuses=await Promise.all([page.locator('#status').innerText(),second.locator('#status').innerText()]);
assert.equal(statuses.filter(s=>s.startsWith('Original card saved')).length,1);
assert.equal(statuses.filter(s=>s.includes('changed in another tab')).length,1);
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('amalgam.decision-journal.v1')).cards.length),3);
await second.close();await page.reload();
// Missing validation code fails closed without touching storage.
const missing=await context.newPage();await missing.route('**/journal-core.js',r=>r.abort());
await missing.goto(url);assert.match(await missing.locator('#status').innerText(),/validator did not load/);
assert.equal(await missing.locator('#ticker').isDisabled(),true);
assert.equal(await missing.evaluate(()=>JSON.parse(localStorage.getItem('amalgam.decision-journal.v1')).cards.length),3);await missing.close();
// Corrupt storage is preserved and recoverable.
await page.evaluate(()=>localStorage.setItem('amalgam.decision-journal.v1','broken'));await page.reload();
assert.match(await page.locator('#status').innerText(),/has not been overwritten/);
assert.equal(await page.getByRole('button',{name:'Download raw storage for recovery'}).count(),1);
assert.equal(await page.evaluate(()=>localStorage.getItem('amalgam.decision-journal.v1')),'broken');
await page.locator('#backup').click();assert.match(await page.locator('#status').innerText(),/raw storage recovery/);assert.equal(await page.locator('#exportPanel').isVisible(),false);
assert.deepEqual(errors,[]);assert.equal(requests.filter(u=>/^https?:/.test(u)&&!u.startsWith(preview.url)).length,0,'no outbound requests');
console.log('PASS: save/reload, original preservation, amendment, safe text/CSV, backup/restore, conflicts, quota failures, simultaneous tabs, missing validator, recovery, mobile layout, no network requests.');
}finally{await browser.close();await preview.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
