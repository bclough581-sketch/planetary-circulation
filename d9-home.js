/* Press feedback for the Direction 9 home: click sound (Web Audio, no audio files) + short vibrate.
   Vibrate works in Android Chrome / installed PWA only. Sound can be turned off: localStorage amalgam.sound = "off". */
(function(){
'use strict';
var ctx=null;
function soundOn(){try{return localStorage.getItem('amalgam.sound')!=='off'}catch(e){return true}}
function tap(){
  try{if(navigator.vibrate)navigator.vibrate(10)}catch(e){}
  if(!soundOn())return;
  try{
    var C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    ctx=ctx||new C();if(ctx.state==='suspended')ctx.resume();
    var t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
    o.type='triangle';o.frequency.setValueAtTime(1900,t);o.frequency.exponentialRampToValueAtTime(700,t+.04);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.07,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+.06);
    o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.07);
  }catch(e){}
}
document.addEventListener('pointerdown',function(e){if(e.target.closest&&e.target.closest('.d9-p'))tap()},{passive:true});
})();
