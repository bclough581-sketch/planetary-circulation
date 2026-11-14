const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const luminance=hex=>{const rgb=hex.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const [name,fg,bg] of [
 ['HUD panel text','f1f5fb','193e72'],['HUD secondary','bfccdd','193e72'],['HUD muted','c1d6ef','193e72'],['HUD badge','f0f6ff','456994'],['HUD notice','e1e9f3','183867'],['HUD eyebrow','b6dfff','193e72'],['body text','f1f5fb','193d70'],['secondary text','bfccdd','193d70'],['muted text','aabdd3','193d70'],
 ['links','b6d9ff','193d70'],['primary hover','f5f8ff','306ac4'],['primary','f5f8ff','195cba'],['silver pill','f0f6ff','4b7099'],['tactile primary brightest bevel','f5f8ff','2d68b6'],['tactile primary hover','f5f8ff','346fbd'],['button hover','f1f5fb','385b87'],
 ['placeholder','a6b9cf','09182d'],['coverage','b6c7dc','101f36'],['metric labels','b3c6dc','244b7b'],
 ['notice','e1e9f3','183451'],['heading gradient darkest stop','a9c9ee','193d70']]){
 assert.ok(ratio(fg,bg)>=4.5,`${name}: ${ratio(fg,bg).toFixed(2)} below 4.5`);
}
assert.ok(ratio('849cbb','09182d')>=3,'field boundaries');
(async()=>{
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const preview=await startPreview();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const file of ['ring-engine-lab.html','decision-journal.html']){
  await page.goto(preview.url+file);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--silver').trim()),'#e1e9f3','shared stylesheet loaded');
  assert.equal(await page.locator('button.primary').first().evaluate(el=>getComputedStyle(el).color),'rgb(245, 248, 255)');
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1050});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${file} overflow ${width}`);
     }
 }
 await page.goto(preview.url+'ring-engine-lab.html');
 assert.equal(await page.locator('.ring').count(),5);
 assert.equal(await page.locator('.ring').first().evaluate(el=>getComputedStyle(el).animationName),'none','reduced motion honored');
 await page.locator('#layerButtons').getByRole('button',{name:'Economic',exact:true}).click();
 assert.equal(await page.locator('#layerTitle').innerText(),'Economic');
 assert.equal(await page.locator('[data-layer-choice=econ]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('[data-layer-choice=stock]').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('.ring[data-id=econ]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('[data-case-layer=econ]').getAttribute('aria-pressed'),'true');
 const key=page.locator('#keepCaseEvidence');await key.scrollIntoViewIfNeeded();
 const rect=await key.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
 await page.mouse.down();assert.equal(await key.evaluate(el=>getComputedStyle(el).transform),'matrix(1, 0, 0, 1, 0, 3)','physical press depth');
 
 await page.mouse.move(1,1);await page.mouse.up();
 assert.match(await page.locator('#observations').innerText(),/USD per barrel/);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.reload();
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body,'::before').animationName),'ambient-beat');
 await page.getByRole('button',{name:'Pause motion',exact:true}).click();
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body,'::before').animationPlayState),'paused');
 assert.equal(await page.locator('.stage').evaluate(el=>getComputedStyle(el,'::before').animationPlayState),'paused');
 await page.goto(preview.url+'decision-journal.html');
 await page.getByRole('button',{name:'Pause glow',exact:true}).click();
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body,'::before').animationPlayState),'paused');
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body,'::before').animationName),'none');
 await page.emulateMedia({forcedColors:'active'});
 assert.notEqual(await page.locator('h1').evaluate(el=>getComputedStyle(el).webkitTextFillColor),'rgba(0, 0, 0, 0)','heading visible in high-contrast mode');
 assert.deepEqual(errors,[]);
 console.log('PASS: tactile palette contrast pairs >=4.5:1; field boundary contrast >=3:1; shared theme, rings, selected-state semantics, physical press depth, ambient pulse/pause, reduced motion, high contrast, no errors, no overflow at 1440/390/320.');
}finally{await browser.close();await preview.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
