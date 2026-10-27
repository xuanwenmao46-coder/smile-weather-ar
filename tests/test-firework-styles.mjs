import assert from 'node:assert/strict';
import {FireworkBag,FIREWORK_STYLES,shapeFirework} from '../dist/firework-styles.js';
const bag=new FireworkBag(()=>.42),choices=Array.from({length:100},()=>bag.next().id);
for(let i=1;i<choices.length;i++)assert.notEqual(choices[i],choices[i-1]);
for(let i=0;i<100;i+=5)assert.equal(new Set(choices.slice(i,i+5)).size,5);
const signatures=new Set();
for(const style of FIREWORK_STYLES){
  const signature=[];
  for(let i=0;i<100;i++){
    const a=i/100*Math.PI*2,p={vx:Math.cos(a)*300,vy:Math.sin(a)*300,gravity:50,drag:.7,life:2.5};
    shapeFirework(p,style.id,i,100,600,1066,.3);
    assert.ok([p.vx,p.vy,p.gravity,p.drag,p.life].every(Number.isFinite));
    signature.push(Math.round(p.vx),Math.round(p.vy));
    if(style.id==='willow'){assert.ok(p.vy<0);assert.ok(p.gravity>200);}
  }
  signatures.add(signature.join(','));
}
assert.equal(signatures.size,5,'styles need different trajectories, not just colors');
console.log(JSON.stringify({passed:true,styles:FIREWORK_STYLES.map(s=>s.name),checks:['all five per shuffled bag','no adjacent repeat across bag boundaries','five distinct trajectories','finite velocities','willow upward launch and falling gravity']}));
