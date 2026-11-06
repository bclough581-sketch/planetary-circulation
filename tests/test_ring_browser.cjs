"use strict";
const {chromium,devices}=require("playwright");
const path=require("node:path");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({...devices["Pixel 7"]});
  const page=await context.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("file://"+path.resolve(__dirname,"..","ring-engine-lab.html"));
  await page.getByRole("heading",{name:"Convergence, with depth"}).waitFor();
  assert.equal(await page.locator(".ring").count(),5);
  // A tap selects; a real pointer drag on a ring rotates without selecting.
  await page.locator("#layerButtons").getByRole("button",{name:"Market"}).click();
  await page.locator("#stage").scrollIntoViewIfNeeded();
  const hit=await page.evaluate(()=>{
    const rect=document.querySelector("#stage").getBoundingClientRect();
    for(let y=rect.top+12;y<rect.bottom-12;y+=3)
      for(let x=rect.left+12;x<rect.right-12;x+=3){
        const el=document.elementFromPoint(x,y);
        if(el&&el.classList.contains("ring"))return {x,y,id:el.dataset.id};
      }
    return null;
  });
  assert.ok(hit,"at least one ring surface is hit-testable");
  await page.mouse.move(hit.x,hit.y);
  await page.mouse.down();
  await page.mouse.move(hit.x+35,hit.y+20,{steps:5});
  await page.mouse.up();
  assert.equal(await page.locator("#layerTitle").innerText(),"Market","drag must not select ring");
  assert.match(await page.locator("#assembly").getAttribute("style"),/rotateY\(/,"drag changes orientation");
  await page.locator("#layerButtons").getByRole("button",{name:"Geopolitical"}).click();
  assert.equal(await page.locator("#layerTitle").innerText(),"Geopolitical");
  await page.getByRole("button",{name:"Depth view"}).click();
  assert.match(await page.locator("#assembly").getAttribute("style"),/rotateY\(-23deg\)/);
  await page.getByRole("button",{name:"Settle view"}).click();
  assert.match(await page.locator("#assembly").getAttribute("style"),/rotateX\(78deg\)/);
  await page.getByRole("button",{name:"Reset"}).click();
  await page.locator("#layerButtons").getByRole("button",{name:"Market"}).click();
  assert.equal(await page.locator("#layerTitle").innerText(),"Market");
  const payload={events:[{id:"test-1",domain:"markets",title:"Illustrative market observation",observed_at:"2026-11-05T12:00:00Z",source:{name:"Synthetic",url:"https://example.org"},status:"observed",missing:[]}],relationships:[]};
  await page.locator("#evidenceFile").setInputFiles({name:"test.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(payload))});
  await page.getByText("1 observations, 0 relationships loaded locally.",{exact:false}).waitFor();
  assert.match(await page.locator("#observations").innerText(),/Illustrative market observation/);
  const linked={events:[
    {id:"geo-1",domain:"geopolitics",title:"Synthetic shipping restriction",observed_at:"2026-11-05T12:00:00Z",source:{name:"Test source",url:"https://example.org/a"},status:"observed",missing:[]},
    {id:"market-1",domain:"markets",title:"Synthetic price movement",observed_at:"2026-11-05T13:00:00Z",source:{name:"Test source",url:"https://example.org/b"},status:"observed",missing:["causal attribution"]}
  ],relationships:[{id:"rel-1",from_event:"geo-1",to_event:"market-1",kind:"correlates_with",status:"inferred",explanation:"Test hypothesis only",evidence_ids:["geo-1","market-1"]}]};
  // Use a schema-valid relationship kind and status from the actual validator.
  linked.relationships[0].kind="related_to";
  await page.locator("#evidenceFile").setInputFiles({name:"linked.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(linked))});
  await page.getByText("2 observations, 1 relationships loaded locally.",{exact:false}).waitFor();
  assert.match(await page.locator("#observations").innerText(),/Synthetic shipping restriction → Synthetic price movement/);
  assert.match(await page.locator("#observations").innerText(),/Test hypothesis only/);
  await page.locator("#layerButtons").getByRole("button",{name:"Geopolitical"}).click();
  assert.match(await page.locator("#observations").innerText(),/Synthetic shipping restriction → Synthetic price movement/);
  await page.getByRole("button",{name:"Clear evidence"}).click();
  assert.equal(await page.locator("#importStatus").innerText(),"No evidence loaded.");
  await page.locator("#evidenceFile").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from('{"events":[{"id":"x"}],"relationships":[]}')});
  await page.getByText("Rejected:",{exact:false}).waitFor();
  assert.deepEqual(errors,[]);
  console.log("PASS Pixel 7 emulation: rendering, view controls, evidence import, rejection, clear, no page errors");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
