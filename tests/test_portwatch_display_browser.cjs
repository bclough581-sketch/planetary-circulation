'use strict';
// Main hotfix: synthetic shipping sentinels, loopback only, isolated browser state.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
 const server=http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const file=path.resolve(root,'.'+decodeURIComponent(p));const rel=path.relative(root,file);if(rel.startsWith('..')||path.isAbsolute(rel)){res.writeHead(403);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await fs.readFile(file));}catch{res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/',browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
 try{
  const fixture=JSON.parse(await fs.readFile(path.join(root,'data.json'),'utf8'));
  fixture.chokepoints=[{id:'MAL',name:'SHIPPING_SENTINEL_8901234',latest:8901234,avg7:8901234,base:8901234,ratio:.123456,asof:new Date().toISOString().slice(0,10),lat:2,lon:102}];
  const ctx=await browser.newContext({serviceWorkers:'block'}),page=await ctx.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route(u=>!u.href.startsWith(base)&&u.protocol!=='data:',r=>{external.push(r.request().url());return r.fulfill({status:200,contentType:'text/css',body:''});});
  await page.route('**/data.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
  const target=process.env.PORTWATCH_TEST_PAGE||'index.html';
  await page.goto(base+target);
  await page.waitForFunction(()=>document.querySelectorAll('#tbl tbody tr').length>0&&document.getElementById('stxt').textContent.includes('updated'));
  assert.ok(await page.locator('#tbl tbody tr').count()>=12,'market table remains');
  assert.match(await page.locator('#shippingDisclosure').innerText(),/withheld pending reuse review/);
  assert.equal(await page.locator('[data-ov="ship"]').isDisabled(),true);
  assert.equal(await page.locator('[data-pre="sea"]').isDisabled(),true);
  for(const preset of ['mkt','all']){
   await page.locator('[data-pre="'+preset+'"]').click();
   assert.equal(await page.evaluate(()=>ov.ship),false);
   assert.equal(await page.evaluate(()=>CH.length),0);
  }
  assert.match(await page.locator('#ht3').innerText(),/withheld/);
  assert.doesNotMatch(await page.locator('body').innerText(),/SHIPPING_SENTINEL_8901234|8901234|12\.3456/);
  // Re-merging a periodic/cached snapshot must not even read the shipping payload.
  await page.evaluate(()=>{Object.defineProperty(DATA,'chokepoints',{get(){throw Error('shipping payload read');}});merge();buildTable();buildStatus();heroTiles();});
  assert.equal(await page.evaluate(()=>CH.length),0);
  assert.match(await page.locator('#ctbl tbody').innerText(),/withheld/);
  await page.locator('#q').fill('Hormuz');await page.locator('#find button').click();
  assert.doesNotMatch(await page.locator('#findres').innerText(),/Showing.*Hormuz/i);
  for(const width of [390,1280]){await page.setViewportSize({width,height:850});assert.ok(await page.locator('#tbl').isVisible());}
  assert.deepEqual(errors,[]);
  assert.ok(external.every(u=>/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)),'only pre-existing font attempts, all intercepted');
  await ctx.close();console.log('PASS PortWatch display: no shipping payload ingestion or figures, disabled shipping controls, periodic re-merge safe, market table/search/layout retained; no provider requests.');
 }finally{await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
