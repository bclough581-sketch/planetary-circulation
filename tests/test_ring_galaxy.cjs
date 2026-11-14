const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||undefined,headless:true});const preview=await startPreview();
try{
const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(preview.url+'ring-engine-lab.html');
await page.waitForFunction(()=>[...document.querySelectorAll('.galaxy-face,.galaxy-disc')].every(img=>img.complete&&img.naturalWidth>0));
assert.equal(await page.locator('.galaxy-face').count(),5);
await page.locator('#stage').scrollIntoViewIfNeeded();
const hits=await page.evaluate(()=>{const rect=document.querySelector('#stage').getBoundingClientRect(),found={};for(let y=rect.top+55;y<Math.min(rect.bottom-55,innerHeight);y+=3)for(let x=rect.left+20;x<rect.right-20;x+=3){const e=document.elementFromPoint(x,y);if(e&&e.classList.contains('ring')&&!found[e.dataset.id])found[e.dataset.id]={x,y};}return found;});
assert.deepEqual(Object.keys(hits).sort(),['econ','geo','market','sector','stock'],'each physical ring has a pointer hit surface');
for(const [id,point] of Object.entries(hits)){await page.mouse.click(point.x,point.y);assert.equal(await page.locator(`.ring[data-id=${id}]`).getAttribute('aria-pressed'),'true',`pointer selects ${id}`);}
const stock=page.locator('.ring[data-id=stock]');await stock.focus();await page.keyboard.press('Enter');assert.equal(await stock.getAttribute('aria-pressed'),'true');
const before=await page.locator('#assembly').getAttribute('style');const point=hits.geo;await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+45,point.y+20,{steps:8});await page.mouse.up();assert.notEqual(await page.locator('#assembly').getAttribute('style'),before,'drag rotates 3D assembly');assert.equal(await stock.getAttribute('aria-pressed'),'true','drag does not change selected ring');
await page.locator('#reset').click();await page.locator('[data-layer-choice=stock]').click();

for(const width of [390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('[data-layer-choice=sector]').click();assert.equal(await page.locator('#sceneLayer').innerText(),'Sector evidence');}
assert.deepEqual(errors,[]);console.log('PASS: vector material loaded, all five physical ring hit surfaces, real pointer selection, keyboard selection, drag without selection, mobile layout and layer updates.');
}finally{await browser.close();await preview.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
