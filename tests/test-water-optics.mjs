import assert from 'node:assert/strict';
import {Fingertip,rippleRadius} from '../dist/fingertip.js';
let surfaces=0;const draws=[],scales=[];
const g=new Proxy({
  createRadialGradient:()=>({addColorStop(){}}),
  drawImage:(image,...coords)=>{assert.ok(coords.every(Number.isFinite));draws.push(image);},
  scale:(x,y)=>scales.push([x,y]),
},{get:(target,key)=>key in target?target[key]:(()=>{})});
globalThis.document={createElement:()=>{surfaces++;return {width:0,height:0,getContext:()=>g};}};
const f=new Fingertip(),background={naturalWidth:900,naturalHeight:1200};
for(const r of f.rings)Object.assign(r,{at:0,x:300,y:500});
f.draw(g,600,1066,500,false,background,false);
assert.equal(surfaces,3);assert.equal(draws.filter(x=>x===background).length,2,'refraction capped at two wave sources');
assert.ok(draws.length<=40,'six simultaneous ripples have bounded draw work');
for(let i=0;i<20;i++)f.draw(g,600,1066,600+i,false,background,false);
assert.equal(surfaces,3,'water fields are cached');
draws.length=0;f.draw(g,600,1066,650,true,background,false);
assert.equal(draws.filter(x=>x===background).length,0,'reduced motion skips image distortion');
const video={videoWidth:640,videoHeight:480,readyState:2};
f.draw(g,600,1066,700,false,video,true);assert.ok(scales.some(([x,y])=>x===-1&&y===1));
f.reset();Object.assign(f.rings[0],{at:0,x:100,y:200});
const radius=rippleRadius(.5,600)*.8,near={x:100+radius,y:200,depth:1},far={x:500,y:900,depth:1};
const before=near.x;f.disturb(near,1/60,600,500);f.disturb(far,1/60,600,500);
assert.ok(near.x>before&&near.x-before<=1.21);assert.equal(far.x,500);assert.equal(far.y,900);
draws.length=0;f.draw(g,600,1066,3000,false,background,false);assert.equal(draws.length,0);
console.log(JSON.stringify({passed:true,cachedTextures:3,maxRefractionSources:2,checks:['bounded optical rendering','cached wave fields','finite coordinates','mirrored camera sampling','reduced motion disables distortion','local rain perturbation','natural expiration']}));
