const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 fs.mkdirSync('browser-layout',{recursive:true});
 try{
  for(const width of [1280,390,320]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('file://'+path.resolve('convergence-research.html'));
   const names=['weather','geopolitics','maritime','aviation','energy','commodities','economics','markets','corporate'];
   const data={schema:'amalgam.research.v1',generated_utc:new Date().toISOString(),observations:[],excluded:[],relationships:[],domains:Object.fromEntries(names.map(x=>[x,0])),predictive_advantage:'not_established',licensing:{portwatch_commercial_reuse:'permission_not_verified'},feed_health:[],relationship_readiness:{status:'not_ready',historical_relationships_validated:0,predictive_advantage:'not_established',blocking_reasons:['No historical panel']}};
   await page.locator('#file').setInputFiles({name:'research-view.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
   await page.locator('.ring-node').first().click();
   assert.equal(await page.locator('#ledger-domain').inputValue(),'weather');
   await page.locator('#ring-all').click();
   assert.equal(await page.locator('#ledger-domain').inputValue(),'all');
   const geometry=await page.evaluate(()=>{
    const boxes=[...document.querySelectorAll('.ring-node')].map(x=>x.getBoundingClientRect());
    const overlaps=[];
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
     const a=boxes[i],b=boxes[j];
     if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([i,j]);
    }
    return {overlaps,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:'browser-layout/viewer-'+width+'.png',fullPage:true});
   assert.deepEqual(geometry.overlaps,[],width+' ring controls overlap');
   assert.equal(geometry.overflow,false,width+' page overflow');
   assert.deepEqual(errors,[],width+' browser errors');
   console.log('Passed viewport',width,'interaction, nonoverlap, overflow and script checks');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
