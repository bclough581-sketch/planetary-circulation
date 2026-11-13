'use strict';
const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {entry}=require('./test_journal_migration.cjs');
const OLD='amalgam.journal.v1',KEY='amalgam.decision-journal.v1';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
 const preview=await startPreview();
 try{
  const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844}});
  const writer=await ctx.newPage(),page=await ctx.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(preview.url)&&!r.url().startsWith('blob:'))external.push(r.url());});
  await writer.goto(preview.url+'journal.html');
  let original=JSON.stringify([entry()]);
  // This tab simulates the retired implementation's old-key writes, not a new-key writer.
  const oldWrite=raw=>writer.evaluate(([k,v])=>localStorage.setItem(k,v),[OLD,raw]);
  const raw=()=>page.evaluate(k=>localStorage.getItem(k),OLD);
  const current=()=>page.evaluate(k=>localStorage.getItem(k),KEY);
  const copy=async()=>{await page.locator('#copyLegacy').click();await page.waitForFunction(()=>!document.getElementById('copyLegacy').disabled);};
  await oldWrite(original);await page.goto(preview.url+'decision-journal.html');
  assert.equal(await page.locator('#count').innerText(),'(0)');
  assert.match(await page.locator('#legacyNotice').innerText(),/1 older card/);
  if(process.env.JOURNAL_MIGRATION_SCREENSHOT)await page.screenshot({path:process.env.JOURNAL_MIGRATION_SCREENSHOT,fullPage:true});
  await copy();assert.match(await page.locator('#status').innerText(),/Copied 1 older/);
  assert.equal(await raw(),original);let saved=JSON.parse(await current());
  assert.equal(saved.cards.length,1);assert.equal(saved.cards[0].recordType,'Retrospective');
  assert.equal(saved.cards[0].execution,'Older self-reported entry price: 10\nOlder self-reported exit price: 9.2');
  await page.getByText('Add an amendment / missing execution details',{exact:true}).click();
  await page.locator('.entry textarea[name=change]').fill('Later self-reported review');
  await page.locator('.entry textarea[name=reason]').fill('Synthetic review after copying');
  await page.getByRole('button',{name:'Save amendment',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Amendment saved'));
  await copy();assert.match(await page.locator('#status').innerText(),/Copied 0 older/);
  assert.equal(JSON.parse(await current()).cards[0].amendments.length,1,'repeat copy preserves later amendments');
  // A later save in an older tab remains visible as separate, uncopied data.
  original=JSON.stringify([entry(),entry({id:'old_2',ticker:'LATER',reason:'Saved from older tab after copying'})]);
  await oldWrite(original);
  await page.waitForFunction(()=>document.getElementById('legacyNotice').textContent.includes('changed in another tab'));
  assert.match(await page.locator('#legacyNotice').innerText(),/2 older card/);
  assert.equal(JSON.parse(await current()).cards.length,1);
  await copy();assert.equal(JSON.parse(await current()).cards.length,2);assert.equal(await raw(),original);
  // Interrupted copy: old-key mutation while conversion is waiting refuses the stale snapshot.
  const before=await current();
  await page.evaluate(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle);window.releaseDigest=null;crypto.subtle.digest=(...args)=>new Promise((resolve,reject)=>{window.releaseDigest=()=>{crypto.subtle.digest=digest;digest(...args).then(resolve,reject);};});});
  await page.locator('#copyLegacy').click();await page.waitForFunction(()=>typeof window.releaseDigest==='function');
  original=JSON.stringify([entry(),entry({id:'old_2',ticker:'LATER'}),entry({id:'third',ticker:'THIRD'})]);
  await oldWrite(original);await page.evaluate(()=>window.releaseDigest());
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('older journal changed while copying'));
  assert.equal(await current(),before);assert.equal(await raw(),original);
  // Failed writes retain both the old source and destination.
  await page.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='amalgam.decision-journal.v1')throw Error('synthetic quota');return window.realSet.call(this,k,v);};});
  await copy();assert.match(await page.locator('#status').innerText(),/Not saved: synthetic quota/);
  assert.equal(await current(),before);assert.equal(await raw(),original);
  await page.evaluate(()=>{Storage.prototype.setItem=window.realSet;});
  // The old URL remains a read-only recovery page; exact raw bytes export without conversion.
  assert.equal((await writer.reload()).status(),200);
  assert.equal(await writer.locator('#oldRaw').inputValue(),original);
  const dl=writer.waitForEvent('download');await writer.locator('#exportOld').click();
  const download=await dl;assert.equal(await fs.readFile(await download.path(),'utf8'),original);
  assert.equal(await raw(),original);
  // Corrupt sources are not copied or deleted; recovery works even without a valid schema.
  const bad='[not JSON\n';await oldWrite(bad);
  await page.waitForFunction(()=>document.getElementById('copyLegacy').disabled);
  assert.match(await page.locator('#legacyNotice').innerText(),/unreadable/);
  await writer.reload();assert.equal(await writer.locator('#oldRaw').inputValue(),bad);
  assert.equal(await current(),before);
  // Deletion is restricted to the new journal; original recovery data remains available.
  page.once('dialog',d=>d.accept());await page.locator('#deleteAll').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('All local cards deleted'));
  assert.equal(await current(),null);assert.equal(await raw(),bad);
  // Missing Web Locks fails closed instead of making a false atomic-write promise.
  const noLocks=await ctx.newPage();await noLocks.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));
  await noLocks.goto(preview.url+'decision-journal.html');
  await noLocks.locator('#ticker').fill('LOCK');await noLocks.locator('#reason').fill('Synthetic unavailable-lock check');
  await noLocks.getByRole('button',{name:'Save original card',exact:true}).click();
  await noLocks.waitForFunction(()=>document.getElementById('status').textContent.includes('Safe saving is unavailable'));
  assert.equal(await current(),null);await noLocks.close();
  // Narrow layout with the migration notice visible.
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await ctx.close();
  console.log('PASS journal migration browser: old-tab changes, repeat copy, interrupted copy, quota failure, exact recovery export, old URL, narrow layout, no outbound requests, locks unavailable, source retained on delete.');
 }finally{await browser.close();await preview.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
