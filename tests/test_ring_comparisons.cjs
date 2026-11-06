const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});const preview=await startPreview();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(preview.url+'ring-engine-lab.html');
 assert.equal(await page.locator('.instrument-field').getAttribute('aria-hidden'),'true');
 assert.ok(await page.locator('.instrument-field path').count()>=144);
 await page.locator('[data-layer-choice=econ]').click();assert.equal(await page.locator('#sceneLayer').innerText(),'Economic evidence');
 for(const period of ['annual','Q1','Q2','Q3','Q4']){
  await page.locator('#casePeriod').selectOption(period);
  const results=await page.evaluate(period=>{
   const issuer=window.AMALGAM_STARTER.issuer,rows=period==='annual'?issuer.annual_comparisons:issuer.observations;
   const before=rows.find(r=>period==='annual'?r.year===2024:r.period==='2024'+period),after=rows.find(r=>period==='annual'?r.year===2025:r.period==='2025'+period);
   return {expected:[before.fuelExpense,after.fuelExpense,100*before.operatingIncome/before.revenue,100*after.operatingIncome/after.revenue],bars:[...document.querySelectorAll('.comparison-fill')].map(b=>({value:+b.dataset.value,ceiling:+b.dataset.ceiling,width:parseFloat(b.style.width)}))};
  },period);
  assert.equal(results.bars.length,4);
  results.bars.forEach((bar,i)=>{assert.ok(Math.abs(bar.value-results.expected[i])<1e-10);assert.ok(Math.abs(bar.width-100*bar.value/bar.ceiling)<.001);assert.ok(bar.ceiling>=bar.value);});
  assert.equal(results.bars[0].ceiling,results.bars[1].ceiling);assert.equal(results.bars[2].ceiling,results.bars[3].ceiling);
 }
 assert.equal(await page.locator('.source-figures').getAttribute('open'),null);await page.locator('.source-figures summary').click();assert.equal(await page.locator('#caseRows').isVisible(),true);await page.locator('.source-figures summary').click();
 await page.locator('.motion-presets [data-motion=still]').click();assert.equal(await page.locator('.ring').first().evaluate(el=>getComputedStyle(el).animationPlayState),'paused');assert.equal(await page.locator('.water-ribbons').evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
 await page.locator('.motion-presets [data-motion=flow]').click();const fast=parseFloat(await page.locator('.ring').first().evaluate(el=>getComputedStyle(el).animationDuration));assert.equal(await page.locator('.motion-presets [data-motion=flow]').getAttribute('aria-pressed'),'true');
 await page.locator('.motion-presets [data-motion=drift]').click();const slow=parseFloat(await page.locator('.ring').first().evaluate(el=>getComputedStyle(el).animationDuration));assert.ok(slow>fast);
 await page.getByRole('button',{name:'Pause motion',exact:true}).click();assert.equal(await page.locator('.motion-presets [data-motion=still]').getAttribute('aria-pressed'),'true');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.motion-presets [data-motion=flow]').click();assert.equal(await page.locator('.water-ribbons').evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await page.locator('.ring').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.locator('#casePeriod').selectOption('annual');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1050});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.setViewportSize({width:1440,height:1050});await page.locator('[data-layer-choice=stock]').click();assert.equal(await page.locator('.ring.selected').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 assert.deepEqual(errors,[]);console.log('PASS: exact comparison values and proportional zero-based bars for all five periods, expandable source table, still/drift/flow and pause, reduced motion, responsive layout.');
}finally{await browser.close();await preview.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
