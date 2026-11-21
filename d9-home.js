/* Press feedback for the Direction 9 home: a soft, low "thock" (Web Audio, no audio files) + short vibrate.
   Down-stroke: heavy low body (150 to 62 Hz) with a sub layer and a dull bump, single decisive hit. Up-stroke: barely-there release.
   No high frequencies, so it stays in the background. Vibrate works in Android Chrome / installed PWA only.
   Turn sound off: localStorage amalgam.sound = "off". */
(function(){
'use strict';
var ctx=null,master=null,noiseBuf=null;
function soundOn(){try{return localStorage.getItem('amalgam.sound')!=='off'}catch(e){return true}}
function setup(){
  if(ctx)return true;
  var C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
  ctx=new C();
  master=ctx.createGain();master.gain.value=.6;
  var lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;lp.Q.value=.5;
  master.connect(lp);lp.connect(ctx.destination);
  var n=Math.floor(ctx.sampleRate*.08);noiseBuf=ctx.createBuffer(1,n,ctx.sampleRate);
  var d=noiseBuf.getChannelData(0);for(var i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
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
function down(){
  try{if(navigator.vibrate)navigator.vibrate(22)}catch(e){}
  if(!soundOn())return;
  try{if(!setup())return;if(ctx.state==='suspended')ctx.resume();thump(150,62,.30,.115);thump(95,52,.20,.14);bump(520,.10,.05)}catch(e){}
}
function up(){
  if(!soundOn())return;
  try{if(!ctx)return;thump(200,130,.03,.03)}catch(e){}
}
function hit(e){return e.target.closest&&e.target.closest('.d9-p')}
document.addEventListener('pointerdown',function(e){if(hit(e))down()},{passive:true});
document.addEventListener('pointerup',function(e){if(hit(e))up()},{passive:true});
})();
