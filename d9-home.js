/* Press feedback for the Direction 9 home: a soft, low "thock" (Web Audio, no audio files) + short vibrate.
   Down-stroke: heavy low body (112 to 48 Hz), sub layer, smooth gravelly friction layer (low brown noise, AM grain) and a dull bump, single decisive hit. Up-stroke: barely-there release.
   No high frequencies, so it stays in the background. Vibrate works in Android Chrome / installed PWA only.
   Turn sound off: localStorage amalgam.sound = "off". */
(function(){
'use strict';
var ctx=null,master=null,noiseBuf=null,brownBuf=null;
function soundOn(){try{return localStorage.getItem('amalgam.sound')!=='off'}catch(e){return true}}
function setup(){
  if(ctx)return true;
  var C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
  ctx=new C();
  master=ctx.createGain();master.gain.value=.6;
  var lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=650;lp.Q.value=.5;
  master.connect(lp);lp.connect(ctx.destination);
  var n=Math.floor(ctx.sampleRate*.08);noiseBuf=ctx.createBuffer(1,n,ctx.sampleRate);
  var d=noiseBuf.getChannelData(0);for(var i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
  var m=Math.floor(ctx.sampleRate*.3);brownBuf=ctx.createBuffer(1,m,ctx.sampleRate);
  var b=brownBuf.getChannelData(0),last=0;for(var k=0;k<m;k++){last=(last+(Math.random()*2-1)*.06)/1.02;b[k]=last*3.2}
  return true;
}
function thump(freqStart,freqEnd,peak,dur){
  var t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';o.frequency.setValueAtTime(freqStart,t);o.frequency.exponentialRampToValueAtTime(freqEnd,t+dur*.8);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02);
}
function bump(cutoff,peak,dur){
  var t=ctx.currentTime,s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=noiseBuf;f.type='lowpass';f.frequency.value=cutoff;
  g.gain.setValueAtTime(peak,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur+.02);
}
function gravel(peak,dur){
  /* smooth friction: low brown noise, band-limited, slowly amplitude-modulated for grain */
  var t=ctx.currentTime,s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),lp=ctx.createBiquadFilter(),
      mod=ctx.createGain(),env=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();
  s.buffer=brownBuf;bp.type='bandpass';bp.frequency.value=210;bp.Q.value=.6;lp.type='lowpass';lp.frequency.value=420;
  mod.gain.value=.65;lfo.type='sine';lfo.frequency.value=58;lg.gain.value=.35;lfo.connect(lg);lg.connect(mod.gain);
  env.gain.setValueAtTime(.0001,t);env.gain.exponentialRampToValueAtTime(peak,t+.018);
  env.gain.setValueAtTime(peak,t+.018);env.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(bp);bp.connect(lp);lp.connect(mod);mod.connect(env);env.connect(master);
  s.start(t);s.stop(t+dur+.02);lfo.start(t);lfo.stop(t+dur+.02);
}
function down(){
  try{if(navigator.vibrate)navigator.vibrate(22)}catch(e){}
  if(!soundOn())return;
  try{if(!setup())return;if(ctx.state==='suspended')ctx.resume();thump(112,48,.34,.13);thump(70,40,.24,.16);gravel(.95,.16);bump(300,.07,.05)}catch(e){}
}
function up(){
  if(!soundOn())return;
  try{if(!ctx)return;thump(120,80,.03,.04)}catch(e){}
}
function hit(e){return e.target.closest&&e.target.closest('.d9-p')}
document.addEventListener('pointerdown',function(e){if(hit(e))down()},{passive:true});
document.addEventListener('pointerup',function(e){if(hit(e))up()},{passive:true});
})();
