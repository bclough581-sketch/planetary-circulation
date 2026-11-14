"use strict";
const {chromium,devices}=require("playwright");
const path=require("node:path");
const assert=require("node:assert/strict");
const fs=require("node:fs");
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
 try{
  const context=await browser.newContext({...devices["Pixel 7"]});
  const page=await context.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("file://"+path.resolve(__dirname,"..","ring-engine-lab.html"));
  await page.getByRole("heading",{name:"Follow the evidence. See the connections."}).waitFor();
  assert.equal(await page.locator('#starterCase').isVisible(),true,'retained issuer case opens without import');
  assert.equal(await page.locator('#domainCoverage > div').count(),9);
  assert.match(await page.locator('#dataNotice').innerText(),/RETAINED SNAPSHOT/);
  assert.match(await page.locator('#caseFinding').innerText(),/fuel expense fell 7.1%/);
  assert.match(await page.locator('#caseFinding').innerText(),/operating margin fell 0.5/);
  await page.locator('#casePeriod').selectOption('Q3');
  assert.match(await page.locator('#caseFinding').innerText(),/operating margin rose/);
  assert.match(await page.locator('#caseSources a').first().getAttribute('href'),/September-Quarter/);
  assert.equal(await page.locator('#caseRows tr').count(),4);
  await page.locator('[data-case-layer="econ"]').click();
  assert.equal(await page.locator('#layerTitle').innerText(),'Economic');
  assert.match(await page.locator('#observations').innerText(),/USD per barrel/);
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
  await page.locator('#importTools > summary').click();
  await page.locator("#evidenceFile").setInputFiles({name:"test.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(payload))});
  await page.getByText("1 observations, 0 relationships loaded locally.",{exact:false}).waitFor();
  assert.match(await page.locator("#observations").innerText(),/Illustrative market observation/);
  assert.equal(await page.locator('#starterCase').isVisible(),false,'local import must not mix with starter issuer facts');
  assert.match(await page.locator('#dataNotice').innerText(),/LOCAL EVIDENCE FILE/);
  const linked={events:[
    {id:"geo-1",domain:"geopolitics",title:"Synthetic shipping restriction",observed_at:"2026-11-05T12:00:00Z",source:{name:"Test source",url:"https://example.org/a"},status:"observed",missing:[]},
    {id:"market-1",domain:"markets",title:"Synthetic price movement",observed_at:"2026-11-05T13:00:00Z",source:{name:"Test source",url:"https://example.org/b"},status:"observed",missing:["causal attribution"]}
  ],relationships:[{id:"rel-1",from_event:"geo-1",to_event:"market-1",kind:"hypothesized_transmission",status:"hypothesis",explanation:"Test hypothesis only",evidence_ids:["geo-1","market-1"],counterarguments:["Other factors may explain movement"],missing:["Independent attribution"],predictive_advantage:"not_established"}]};
  await page.locator("#evidenceFile").setInputFiles({name:"linked.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(linked))});
  await page.getByText("2 observations, 1 relationships loaded locally.",{exact:false}).waitFor();
  assert.match(await page.locator("#observations").innerText(),/Synthetic shipping restriction → Synthetic price movement/);
  await page.locator("#observations details").filter({hasText:"Synthetic shipping restriction → Synthetic price movement"}).first().locator("summary").first().click();
  assert.match(await page.locator("#observations").innerText(),/Test hypothesis only/);
  assert.match(await page.locator("#observations").innerText(),/UNCONFIRMED relationship/);
  assert.match(await page.locator("#observations").innerText(),/Other factors may explain movement/);
  assert.match(await page.locator("#observations").innerText(),/Independent attribution/);
  assert.match(await page.locator("#observations").innerText(),/Predictive advantage: not established/);
  const evidenceItems=page.locator("#observations details details");
  assert.equal(await evidenceItems.count(),2);
  await evidenceItems.nth(1).locator("summary").click();
  assert.match(await page.locator("#observations").innerText(),/causal attribution/);
  assert.equal(await evidenceItems.nth(1).locator("a").getAttribute("href"),"https://example.org/b");
  assert.match(await page.locator("#observations").innerText(),/No refuted\/non-refuted status conflict declared/);
  linked.relationships.push({id:"rel-2",from_event:"geo-1",to_event:"market-1",kind:"hypothesized_transmission",status:"refuted",explanation:"Synthetic counterevidence",evidence_ids:["geo-1"]});
  await page.locator("#evidenceFile").setInputFiles({name:"conflict.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(linked))});
  await page.getByText("2 observations, 2 relationships loaded locally.",{exact:false}).waitFor();
  assert.match(await page.locator("#observations").innerText(),/hypothesis 1/);
  assert.match(await page.locator("#observations").innerText(),/refuted 1/);
  const conflictRows=page.locator("#observations details").filter({hasText:"Synthetic shipping restriction → Synthetic price movement"});
  await conflictRows.first().locator("summary").first().click();
  assert.match(await page.locator("#observations").innerText(),/CONFLICTING IMPORTED ASSERTIONS/);
  await page.locator("#layerButtons").getByRole("button",{name:"Geopolitical"}).click();
  assert.match(await page.locator("#observations").innerText(),/Synthetic shipping restriction → Synthetic price movement/);
  const fixturePath=path.resolve(__dirname,"generated-evidence-fixture.json");
  assert.ok(fs.existsSync(fixturePath),"Python-generated canonical fixture is required");
  {
    const canonical=fs.readFileSync(fixturePath);
    await page.locator("#evidenceFile").setInputFiles({name:"canonical.json",mimeType:"application/json",buffer:canonical});
    await page.getByText("2 observations, 1 relationships loaded locally.",{exact:false}).waitFor();
    await page.locator("#layerButtons").getByRole("button",{name:"Geopolitical"}).click();
    const exported=page.locator("#observations details").filter({hasText:"Python-exported event → Python-exported market"}).first();
    await exported.locator("summary").first().click();
    assert.match(await page.locator("#observations").innerText(),/Python fixture, no causation/);
    assert.match(await page.locator("#observations").innerText(),/Alternative causes/);
    assert.match(await page.locator("#observations").innerText(),/Causal identification/);
  }
  const snapshotPath=path.resolve(__dirname,"generated-ring-snapshot.json");
  assert.ok(fs.existsSync(snapshotPath),"Real snapshot export fixture is required");
  const snapshot=JSON.parse(fs.readFileSync(snapshotPath,"utf8"));
  assert.equal(snapshot.feed_status,"snapshot_only_not_live");
  assert.ok(snapshot.events.length>0,"Real snapshot must contain observations");
  await page.locator("#evidenceFile").setInputFiles({name:"snapshot.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(snapshot))});
  await page.getByText(snapshot.events.length+" observations, 0 relationships loaded locally.",{exact:false}).waitFor();
  assert.match(await page.locator("#observations").innerText(),/SNAPSHOT ONLY — NOT LIVE/);
  assert.match(await page.locator("#observations").innerText(),/Source authentication: not performed/);
  assert.match(await page.locator("#observations").innerText(),/provisional age review at snapshot generation/);
  assert.equal(snapshot.freshness_records.length,snapshot.events.length);
  await page.locator('#layerButtons').getByRole('button',{name:'Economic'}).click();
  await page.locator("#observations details").filter({hasText:"source measurement"}).first().locator("summary").first().click();
  assert.match(await page.locator("#observations").innerText(),/Snapshot age review:/);
  assert.match(await page.locator("#observations details > summary").first().innerText(),/excluded source record/);
  await page.getByRole("button",{name:"Clear evidence"}).click();
  assert.equal(await page.locator("#importStatus").innerText(),"No evidence loaded.");
  await page.locator("#evidenceFile").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from('{"events":[{"id":"x"}],"relationships":[]}')});
  await page.getByText("Rejected:",{exact:false}).waitFor();
  assert.equal(await page.locator('#starterCase').isVisible(),false);
  await page.getByRole('button',{name:'Restore retained evidence'}).click();
  assert.equal(await page.locator('#starterCase').isVisible(),true);
  assert.match(await page.locator('#observations').innerText(),/8 quarterly periods/);
  await page.locator('#importTools > summary').click();
  for(const width of [1280,390,320]){
   await page.setViewportSize({width,height:900});
   await page.locator('#casePeriod').selectOption('annual');
   await page.evaluate(()=>scrollTo(0,0));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no overflow at '+width);
   if(process.env.AMALGAM_SCREENSHOT_DIR){fs.mkdirSync(process.env.AMALGAM_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.AMALGAM_SCREENSHOT_DIR,'ring-explorer-'+width+'.png'),fullPage:true})}
  }
  // Missing bundle fails to a usable local-import state, with no fictional data.
  const fallback=await context.newPage();
  await fallback.route('**/ring-evidence.js',route=>route.abort());
  await fallback.goto('file://'+path.resolve(__dirname,'..','ring-engine-lab.html'));
  await fallback.locator('#importTools > summary').click();
  assert.match(await fallback.locator('#importStatus').innerText(),/Starter unavailable/);
  assert.equal(await fallback.locator('#starterCase').isVisible(),false);
  assert.equal(await fallback.locator('#observations').innerText(),'');
  await fallback.close();
  if(process.env.AMALGAM_SCREENSHOT_DIR){const desktop=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});await desktop.goto('file://'+path.resolve(__dirname,'..','ring-engine-lab.html'));await desktop.screenshot({path:path.join(process.env.AMALGAM_SCREENSHOT_DIR,'ring-explorer-desktop.png'),fullPage:true});await desktop.close()}
  assert.deepEqual(errors,[]);
  console.log("PASS ring explorer: offline starter, exact comparisons, source links, import isolation, fallback, desktop/mobile layout and existing interactions");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
