const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const KEY='amalgam.decision-journal.v1';
// Regression cases ported from the legacy journal red-team. Synthetic data, isolated browser contexts only.
(async()=>{
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const preview=await startPreview();
try{
const url=preview.url+'decision-journal.html';
const ctx=await browser.newContext({acceptDownloads:true});
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settled=p=>p.waitForFunction(()=>/Original card saved|Not saved:|Existing storage could not/.test(document.getElementById('status').textContent));
const save=async(p,ticker,reason)=>{await p.locator('#ticker').fill(ticker);await p.locator('#reason').fill(reason);await p.getByRole('button',{name:'Save original card',exact:true}).click();await settled(p);return p.locator('#status').innerText();};
const stored=p=>p.evaluate(k=>localStorage.getItem(k),KEY);
await page.goto(url);await page.evaluate(()=>localStorage.clear());await page.reload();

// 1. Valid JSON that is not a store: preserved byte-for-byte, saving blocked, recovery offered.
for(const raw of ['[null]','[]','null','{}','{"schema":"amalgam.decision-journal.v1","cards":[null]}','"text"']){
  await page.evaluate(([k,v])=>localStorage.setItem(k,v),[KEY,raw]);await page.reload();
  assert.match(await page.locator('#status').innerText(),/has not been overwritten/,raw);
  const msg=await save(page,'BLOCK','must not save');
  assert.match(msg,/could not be read/,raw);assert.equal(await stored(page),raw,'bytes untouched: '+raw);
  assert.equal(await page.getByRole('button',{name:'Download raw storage for recovery'}).count(),1);
}
await page.evaluate(()=>localStorage.clear());await page.reload();

// 2. Sequential stale tab: B loaded before A saved; B's later save must be refused, not overwrite A.
const tabB=await ctx.newPage();await tabB.goto(url);
assert.match(await save(page,'FIRST','tab A save'),/Original card saved/);
const msgB=await save(tabB,'SECOND','tab B stale save');
assert.match(msgB,/changed in another tab/);
assert.equal(await tabB.locator('#reason').inputValue(),'tab B stale save','B keeps its unsaved form');
let cards=JSON.parse(await stored(page)).cards;
assert.deepEqual(cards.map(c=>c.ticker),['FIRST'],'FIRST survives; SECOND was not written');
await tabB.reload();assert.match(await save(tabB,'SECOND','after reload'),/Original card saved/);
assert.deepEqual(JSON.parse(await stored(tabB)).cards.map(c=>c.ticker),['FIRST','SECOND']);
await tabB.close();await page.reload();

// 3. Refused write during RESTORE: no false success, storage and list unchanged.
const before=await stored(page);
const backup=JSON.parse(before);const extra=structuredClone(backup.cards[0]);extra.id='restore-extra';extra.ticker='EXTRA';
const good=Buffer.from(JSON.stringify({schema:backup.schema,cards:[...backup.cards,extra]}));
await page.evaluate(()=>{window.__orig=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('refused','QuotaExceededError');};});
await page.locator('#restore').setInputFiles({name:'b.json',mimeType:'application/json',buffer:good});
await page.waitForFunction(()=>/Not saved:|Backup restored|Restore rejected/.test(document.getElementById('status').textContent));
const rs=await page.locator('#status').innerText();assert.match(rs,/Not saved:/);assert.doesNotMatch(rs,/Backup restored/);
await page.evaluate(()=>{Storage.prototype.setItem=window.__orig;});
assert.equal(await stored(page),before);assert.equal(await page.locator('.entry').count(),2,'list not advanced past storage');

// 4. Refused ERASE: no false "deleted", records remain in storage and on screen.
await page.evaluate(()=>{window.__rm=Storage.prototype.removeItem;Storage.prototype.removeItem=function(){throw new DOMException('refused','SecurityError');};});
page.once('dialog',d=>d.accept());await page.locator('#deleteAll').click();
await page.waitForFunction(()=>/Could not delete|All local cards deleted/.test(document.getElementById('status').textContent));
const es=await page.locator('#status').innerText();assert.match(es,/Could not delete/);assert.doesNotMatch(es,/deleted\. Exported/);
await page.evaluate(()=>{Storage.prototype.removeItem=window.__rm;});
assert.equal(await stored(page),before);assert.equal(await page.locator('.entry').count(),2);

// 5. Restore policy: legacy-format, duplicate-ID, conflicting and unknown-key backups are rejected; nothing changes.
const one=backup.cards[0];
const dup=Buffer.from(JSON.stringify({schema:backup.schema,cards:[{...one,id:'dup'},{...one,id:'dup',reason:'different'}]}));
const legacy=Buffer.from(JSON.stringify({app:'amalgam-journal',version:1,entries:[{id:'x',ticker:'OLD'}]}));
const unknown=Buffer.from(JSON.stringify({schema:backup.schema,cards:[],extra:1}));
for(const [name,buf] of [['dup.json',dup],['legacy.json',legacy],['unknown.json',unknown]]){
  await page.locator('#restore').setInputFiles({name,mimeType:'application/json',buffer:buf});
  await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Restore rejected'));
  assert.equal(await stored(page),before,name+' left storage untouched');
  await page.reload();
}
// 6. Full-length evidence (4,000) survives save, reload and backup unclipped.
const long='e'.repeat(4000);
await page.locator('#ticker').fill('LONG');await page.locator('#reason').fill('limit test');await page.locator('#evidence').fill(long);
await page.getByRole('button',{name:'Save original card',exact:true}).click();await settled(page);
await page.reload();await page.locator('#backup').click();
const exported=JSON.parse(await page.locator('#exportText').inputValue());
assert.equal(exported.cards.find(c=>c.ticker==='LONG').evidence.length,4000);
assert.deepEqual(errors,[]);
console.log('PASS journal regression (browser): non-store storage preserved, stale-tab refusal, refused restore/erase reporting, restore policy rejections, unclipped evidence.');
}finally{await browser.close();await preview.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
