'use strict';
// The opening star is a fidget spinner: each of its three layers spins on its own, either way,
// with several fingers at once, and the page still scrolls from outside the dial. Loopback only.
const {startPreview}=require('./browser_preview.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
const preview=await startPreview();
try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route(u=>!u.href.startsWith(preview.url)&&u.protocol!=='data:',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await page.goto(preview.url+'ring-engine-lab.html');
  await page.waitForFunction(()=>typeof window.__amalgamStarSpin==='function');
  await page.waitForTimeout(2600); // let the weave-in finish
  const cdp=await ctx.newCDPSession(page);
  const st=()=>page.evaluate(()=>window.__amalgamStarSpin());
  const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
  const pt=(s,frac,deg,id)=>{const cx=s.pad.x+s.pad.width/2,cy=s.pad.y+s.pad.height/2,a=deg*Math.PI/180;return{id,x:cx+Math.cos(a)*frac*s.r,y:cy+Math.sin(a)*frac*s.r};};
  // Pad is the dial: it sits inside the phone width and leaves margins to scroll from.
  let s=await st();
  assert.ok(s.pad.width>200&&s.pad.width<=390-30,'dial is sized to the phone with scroll margins: '+s.pad.width);
  assert.deepEqual(s.ang,[0,0,0],'nothing spun yet');
  // 1. Outer layer, clockwise swipe (screen angle increasing = clockwise).
  await touch('touchStart',[pt(s,.92,-90,1)]);
  for(let i=1;i<=10;i++){await touch('touchMove',[pt(s,.92,-90+i*20,1)]);await page.waitForTimeout(16);}
  await touch('touchEnd',[]);
  let a=await st();
  assert.ok(a.ang[0]>0.8,'outer layer turned clockwise: '+a.ang[0]);
  assert.ok(a.w[0]>2,'outer layer keeps spinning clockwise after release: '+a.w[0]);
  assert.ok(Math.abs(a.ang[1])<0.01&&Math.abs(a.ang[2])<0.01,'middle and inner layers untouched');
  // 2. It coasts and slows down.
  const w0=a.w[0],ang0=a.ang[0];await page.waitForTimeout(900);
  let b=await st();
  assert.ok(b.ang[0]>ang0+0.5,'keeps turning on its own');
  assert.ok(b.w[0]>0&&b.w[0]<w0,'slows down but does not reverse');
  // 3. Inner layer, counter-clockwise swipe, while the outer one is still turning clockwise.
  await touch('touchStart',[pt(s,.28,0,1)]);
  for(let i=1;i<=9;i++){await touch('touchMove',[pt(s,.28,0-i*22,1)]);await page.waitForTimeout(16);}
  await touch('touchEnd',[]);
  let c=await st();
  assert.ok(c.ang[2]<-0.8&&c.w[2]<-2,'inner layer turns counter-clockwise: '+c.ang[2]+' '+c.w[2]);
  assert.ok(c.w[0]>0,'outer layer is still going clockwise: a combination');
  assert.ok(Math.abs(c.ang[1])<0.01,'middle layer untouched');
  // 4. Two fingers at once: middle clockwise, outer counter-clockwise.
  await page.waitForTimeout(3500); // let both settle
  const before=await st();
  await touch('touchStart',[pt(s,.70,90,1),pt(s,.95,-90,2)]);
  for(let i=1;i<=9;i++){await touch('touchMove',[pt(s,.70,90+i*20,1),pt(s,.95,-90-i*20,2)]);await page.waitForTimeout(16);}
  const mid=await st();
  assert.deepEqual(mid.held,[1,1,0],'two layers held by two fingers');
  await touch('touchEnd',[]);
  const d=await st();
  assert.ok(d.ang[1]-before.ang[1]>0.8,'middle turned clockwise');
  assert.ok(d.ang[0]-before.ang[0]<-0.8,'outer turned counter-clockwise at the same time');
  // 5. A tap does not add spin: it brakes the layer under the finger, like touching a real spinner.
  await touch('touchStart',[pt(s,.92,10,1)]);await page.waitForTimeout(60);await touch('touchEnd',[]);
  const t1=await st();
  assert.equal(t1.w[0],0,'tap stops the outer layer instead of spinning it');
  await page.waitForTimeout(300);
  const t2=await st();
  assert.ok(Math.abs(t2.ang[0]-t1.ang[0])<0.01,'and it stays stopped');
  // 6. Move the whole star on its axis from the rim while a layer keeps spinning.
  await touch('touchStart',[pt(s,.5,-90,1)]);               // inner... grab and flick the middle layer first
  await touch('touchEnd',[]);
  await touch('touchStart',[pt(s,.70,200,1)]);
  for(let i=1;i<=8;i++){await touch('touchMove',[pt(s,.70,200+i*22,1)]);await page.waitForTimeout(16);}
  await touch('touchEnd',[]);
  const sp0=await st();
  assert.ok(Math.abs(sp0.w[1])>2,'middle layer is spinning before the tilt: '+sp0.w[1]);
  const rim=pt(s,1.12,0,1);
  await touch('touchStart',[rim]);
  for(let i=1;i<=8;i++){await touch('touchMove',[{id:1,x:rim.x-i*5,y:rim.y+i*12}]);await page.waitForTimeout(16);}
  const tl=await st();
  assert.equal(tl.tiltHeld,1,'rim is held');
  assert.ok(Math.abs(tl.ang[1]-sp0.ang[1])>0.02,'layer keeps spinning while the star is being tilted');
  await page.waitForTimeout(250);
  const tl2=await st();
  await touch('touchEnd',[]);
  assert.ok(Math.abs(tl2.tilt[0]-sp0.tilt[0])>0.25||Math.abs(tl2.tilt[1]-sp0.tilt[1])>0.25,'whole star tilted: '+JSON.stringify([sp0.tilt,tl2.tilt]));
  assert.ok(Math.abs(tl2.ang[1]-tl.ang[1])>0.1&&Math.sign(tl2.w[1])===Math.sign(sp0.w[1]),'same direction of spin, still going');
  assert.deepEqual([tl2.held,tl2.tiltHeld],[[0,0,0],1],'no layer held while tilting');
  // 7. Tilt with one finger on the rim and spin a layer with another, at the same moment.
  await page.waitForTimeout(400);
  const c0=await st();
  await touch('touchStart',[{...pt(s,1.12,180,1)},{...pt(s,.28,0,2)}]);
  for(let i=1;i<=8;i++){await touch('touchMove',[{id:1,x:pt(s,1.12,180,1).x+i*6,y:pt(s,1.12,180,1).y+i*10},pt(s,.28,0-i*22,2)]);await page.waitForTimeout(16);}
  const c1=await st();
  assert.deepEqual([c1.tiltHeld,c1.held[2]],[1,1],'rim and inner layer held by two fingers');
  await touch('touchEnd',[]);
  const c2=await st();
  assert.ok(Math.abs(c2.tilt[0]-c0.tilt[0])>0.2||Math.abs(c2.tilt[1]-c0.tilt[1])>0.2,'tilted');
  assert.ok(c2.ang[2]-c0.ang[2]<-0.8,'inner layer spun counter-clockwise at the same time');
  // 8. The page still scrolls from the margin beside the dial.
  const y0=await page.evaluate(()=>scrollY);
  const x=Math.max(8,s.pad.x/2);
  await touch('touchStart',[{id:1,x,y:520}]);
  for(let i=1;i<=12;i++){await touch('touchMove',[{id:1,x,y:520-i*14}]);await page.waitForTimeout(16);}
  await touch('touchEnd',[]);await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>scrollY)>y0+20,'vertical swipe beside the dial scrolls the page');
  // 9. The whole star turns without limit, keeps coasting after release, and Reset brings everything home.
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);
  const s9=await st(),r0=pt(s9,1.25,90,1),u0=s9.u.slice();
  await touch('touchStart',[r0]);
  for(let i=1;i<=7;i++){await touch('touchMove',[{id:1,x:r0.x-i*40,y:r0.y}]);await page.waitForTimeout(8);}
  const m1=await st();
  await touch('touchEnd',[]);
  assert.ok(Math.abs(m1.u[1]-u0[1])>Math.PI,'turned further than half a turn: '+(m1.u[1]-u0[1]));
  await page.waitForTimeout(250);
  const m2=await st();
  assert.ok(Math.abs(m2.u[1]-m1.u[1])>0.05,'keeps turning after release');
  await page.waitForFunction(()=>document.querySelector('.star-reset').classList.contains('on'));
  await page.click('.star-reset');
  await page.waitForFunction(()=>{const s=window.__amalgamStarSpin();return !s.resetting&&Math.abs(s.u[0])<0.01&&Math.abs(s.u[1])<0.01&&s.ang.every(a=>Math.abs(a)<0.01)},null,{timeout:6000});
  await page.waitForFunction(()=>!document.querySelector('.star-reset').classList.contains('on'));
  assert.deepEqual(errors,[]);
  console.log('PASS: star spinner: layers spin independently both ways, coast and slow, turning the whole star any amount with Reset to bring it home, two fingers at once, a tap brakes instead of spinning, page scrolls beside the dial.');
}finally{await browser.close();await preview.close();}
})().catch(e=>{console.error(e);process.exit(1)});
