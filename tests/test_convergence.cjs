const assert=require('node:assert/strict');const {analyze,days}=require('../convergence.js');
assert.equal(days('2026-11-01','2026-11-03T20:00:00Z'),2);
const base={generated_utc:'2026-11-03T12:00:00Z',hubs:{HOU:{chg:3,asof:'2026-11-03'}},chokepoints:[{id:'HRM',name:'Hormuz',ratio:.5,asof:'2026-11-02'}],status:{eia:{ok:true},portwatch:{ok:true}}};
let r=analyze(base,'2026-11-03T20:00:00Z');assert.equal(r.convergence.length,1);assert.equal(r.convergence[0].evidence.length,2);assert.equal(r.commercialReady,false);
r=analyze({...base,status:{eia:{ok:true},portwatch:{ok:false}}},'2026-11-03T20:00:00Z');assert.equal(r.convergence.length,0);assert.equal(r.excluded.length,1);
r=analyze(base,'2026-12-10T20:00:00Z');assert.equal(r.events.length,0);assert.equal(r.convergence.length,0);
r=analyze({...base,hubs:{HOU:{chg:-3,asof:'2026-11-03'}}},'2026-11-03T20:00:00Z');assert.equal(r.convergence.length,0);
console.log('Convergence tests passed');
