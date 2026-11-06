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
  await page.getByRole("button",{name:"Clear evidence"}).click();
  assert.equal(await page.locator("#importStatus").innerText(),"No evidence loaded.");
  await page.locator("#evidenceFile").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from('{"events":[{"id":"x"}],"relationships":[]}')});
  await page.getByText("Rejected:",{exact:false}).waitFor();
  assert.deepEqual(errors,[]);
  console.log("PASS Pixel 7 emulation: rendering, view controls, evidence import, rejection, clear, no page errors");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
