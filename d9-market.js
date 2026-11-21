/* Market screen: SAMPLE data only. Range chips swap between three invented data sets. */
(function(){
'use strict';
var D={
 today:[['Chips',2.4,[3,4,3.6,5,5.6,6.4,7.2]],['Energy',1.8,[5,4.6,5.2,5.8,6,6.6,7]],['Tech',.9,[4,4.2,4.1,4.8,4.9,5.2,5.4]],['Gold',.4,[5,5.1,4.9,5.2,5.3,5.2,5.4]],['Small caps',-.3,[6,5.8,6.1,5.7,5.6,5.5,5.4]],['Banks',-.7,[7,6.6,6.7,6.2,6,5.8,5.6]],['Utilities',-1.2,[7.4,7,6.6,6.4,5.9,5.6,5.2]],['Airlines',-2.1,[8,7.4,6.8,6.2,5.5,5,4.4]]],
 week:[['Energy',4.6,[3,3.4,4,4.2,5,5.6,6.4]],['Chips',3.1,[4,4.6,4.4,5.2,5.6,5.9,6.2]],['Gold',1.2,[5,5.2,5.1,5.4,5.5,5.6,5.8]],['Tech',-.4,[6,6.2,5.9,6.1,5.8,5.9,5.7]],['Banks',-1.1,[7,6.8,6.9,6.5,6.4,6.2,6.1]],['Small caps',-1.8,[7.2,6.9,6.7,6.4,6.3,6,5.9]],['Utilities',-2.2,[7.6,7.2,6.9,6.6,6.2,6,5.7]],['Airlines',-3.4,[8,7.6,7,6.4,6,5.4,4.9]]],
 month:[['Gold',6.2,[3,3.6,4.2,4.8,5.4,6,6.8]],['Energy',3.8,[4,4.2,4.9,5,5.6,6,6.4]],['Chips',2.2,[5,4.6,5.4,5.2,5.9,6.1,6.4]],['Banks',.6,[5.4,5.6,5.2,5.5,5.7,5.6,5.8]],['Tech',-.9,[6.4,6.8,6.4,6.6,6.2,6.1,6]],['Utilities',-2.4,[7,7.2,6.8,6.4,6.1,5.8,5.5]],['Small caps',-3.1,[7.6,7.2,7,6.5,6.1,5.8,5.4]],['Airlines',-4.8,[8.2,7.8,7.2,6.5,5.8,5.2,4.4]]]};
function spark(v){var mn=Math.min.apply(null,v),mx=Math.max.apply(null,v),p=v.map(function(y,i){return (i*84/(v.length-1)).toFixed(1)+' '+(26-(y-mn)/(mx-mn+1e-9)*24).toFixed(1)});return '<svg class="sp" viewBox="0 0 84 28" aria-hidden="true"><path d="M'+p.join(' L')+'"/></svg>'}
function row(r){var up=r[1]>=0,a=Math.abs(r[1]).toFixed(1);
 return '<button type="button" class="d9-row d9-p '+(up?'up':'down')+'" aria-label="'+r[0]+' '+(up?'up':'down')+' '+a+' percent, sample data"><span class="n">'+r[0]+'</span>'+spark(r[2])+'<span class="v">'+(up?'▲':'▼')+' '+a+'%</span></button>'}
function show(k){document.getElementById('rows').innerHTML=D[k].map(row).join('');
 [].forEach.call(document.querySelectorAll('.d9-chip'),function(c){c.setAttribute('aria-pressed',c.dataset.r===k?'true':'false')})}
[].forEach.call(document.querySelectorAll('.d9-chip'),function(c){c.addEventListener('click',function(){show(c.dataset.r)})});
show('today');
})();
