"use strict";
/* Dependency-free regression tests for the standalone ring lab.
   Run: node tests/test_ring_engine.cjs
   This exercises the actual inline validation function, not a duplicate. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const html=fs.readFileSync(path.join(__dirname,"..","ring-engine-lab.html"),"utf8");
const script=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script,"inline ring engine script exists");
new vm.Script(script[1],{filename:"ring-engine-lab.inline.js"});
const start=script[1].indexOf("const domainLayer=");
const end=script[1].indexOf("function evidenceView(");
assert.ok(start>=0&&end>start,"evidence validation functions found");
const context=vm.createContext({});
vm.runInContext(script[1].slice(start,end)+"\nthis.validate=validateEvidence;this.map=domainLayer;",context);
const base=()=>({events:[{id:"e1",domain:"geopolitics",title:"Example",observed_at:"2026-11-05T12:00:00Z",source:{name:"Example source",url:"https://example.org/record"},status:"observed",missing:[]}],relationships:[]});
const accept=x=>assert.doesNotThrow(()=>context.validate(x));
const reject=x=>assert.throws(()=>context.validate(x));
accept(base());
const versioned=base();versioned.schema_version="amalgam-evidence-v1";accept(versioned);
versioned.schema_version="unknown-v2";reject(versioned);
const pair=base();pair.events.push({...pair.events[0],id:"e2",domain:"markets"});pair.relationships.push({id:"r1",from_event:"e1",to_event:"e2",kind:"hypothesized_transmission",status:"hypothesis",explanation:"Illustrative only",evidence_ids:["e1"]});accept(pair);
for(const [field,value] of [["counterarguments","invalid"],["missing",false],["predictive_advantage","established"]]){const x=JSON.parse(JSON.stringify(pair));x.relationships[0][field]=value;reject(x)}
const canonical=JSON.parse(JSON.stringify(pair));Object.assign(canonical.relationships[0],{counterarguments:["Alternative cause"],missing:["Missing attribution"],predictive_advantage:"not_established"});accept(canonical);
for(const mutate of [
 x=>{x.events[0].id="";},x=>{x.events[0].domain="unknown";},
 x=>{x.events[0].observed_at="2026-11-05";},
 x=>{x.events[0].source.url="javascript:alert(1)";},
 x=>{x.events[0].missing="none";},
 x=>{x.events.push({...x.events[0]});},
 x=>{x.relationships.push({id:"r1",from_event:"e1",to_event:"missing",kind:"exposure",status:"hypothesis",explanation:"x",evidence_ids:["e1"]});}
]){const x=base();mutate(x);reject(x)}
assert.equal(context.map.maritime,"geo");
assert.equal(context.map.markets,"market");
assert.equal(context.map.corporate,"stock");
assert.ok(!Object.values(context.map).includes("sector"),"no inferred sector mapping");
assert.match(html,/INSUFFICIENT EVIDENCE — NO TRADE SIGNAL/);
assert.match(html,/No signal or score calculated/);
assert.match(html,/prefers-reduced-motion/);
assert.match(html,/pointercancel/);
console.log("PASS ring engine: syntax, valid and invalid imports, domain mapping, fail-closed copy, motion hooks");
