import assert from 'node:assert/strict';
import {mapVideoPoint,RainField,RainGarden} from '../dist/rain-control.js';
for(const [w,h,vw,vh] of [[600,900,640,480],[900,600,640,480],[480,900,1280,720]]){
 const g={w,h,videoWidth:vw,videoHeight:vh};
 const center=mapVideoPoint({x:.5,y:.5},g);assert.ok(Math.abs(center.x-w/2)<1e-9&&Math.abs(center.y-h/2)<1e-9);
 const right=mapVideoPoint({x:.6,y:.5},g);assert.ok(right.x<center.x,'camera input must match mirrored screen');
 const down=mapVideoPoint({x:.5,y:.6},g);assert.ok(down.y>center.y,'vertical mapping must not be inverted');
}
const p=()=>({x:200,y:200,vx:0,vy:400,depth:1,life:5,gripSerial:-1});
const field=new RainField(),drop=p();let oldY=drop.y;
for(let i=0;i<360;i++){
 field.update(1/60,{active:true,x:300,y:300});drop.life-=1/60;field.advance(drop,1/60,600,1000);
 assert.ok(drop.y>=oldY-1e-9,'decelerating rain must never rewind upwards');oldY=drop.y;
}
const settled=drop.y;
for(let i=0;i<120;i++){field.update(1/60,{active:true,x:300,y:300});drop.life-=1/60;field.advance(drop,1/60,600,1000);}
assert.ok(Math.abs(drop.y-settled)<.01);
for(let i=0;i<120;i++){field.update(1/60,{active:true,x:300+i,y:300});drop.life-=1/60;field.advance(drop,1/60,600,1000);}
const movedX=drop.x;
for(let i=0;i<120;i++){
 field.update(1/60,null);drop.life-=1/60;const x=drop.x,y=drop.y;field.advance(drop,1/60,600,1000);
 assert.equal(drop.x,x,'release must not pull the cloud back horizontally');assert.ok(drop.y>=y-1e-9);
}
assert.ok(movedX>240);field.update(1/60,{active:true,x:100,y:100});const before={x:drop.x,y:drop.y};field.advance(drop,1/60,600,1000);assert.equal(drop.x,before.x,'reacquisition must not teleport droplets');
function replay(hz){const f=new RainField(),q=p();for(let i=0;i<hz*4;i++){const t=i/hz;f.update(1/hz,{active:true,x:300+Math.max(0,t-1)*30,y:300});q.life-=1/hz;f.advance(q,1/hz,600,1000);}return q;}
const a=replay(30),b=replay(60),c=replay(120);assert.ok(Math.abs(a.x-c.x)<3&&Math.abs(a.y-c.y)<6,'motion must be stable across refresh rates');
const garden=new RainGarden();for(let i=0;i<600;i++)garden.update(1/60,{raining:false});assert.equal(garden.water,0);assert.ok(garden.progress.every(p=>p===0));
for(let i=0;i<240;i++)garden.update(1/60,{raining:true});const level=garden.level,water=garden.water;
assert.ok(level>.5);assert.ok(garden.progress[1]>garden.progress[2],'lower branch flowers open first');
for(let i=0;i<300;i++)garden.update(1/60,{raining:true,hold:1});assert.equal(garden.water,water,'frozen rain must not water flowers');
for(let i=0;i<600;i++)garden.update(1/60,{raining:true});assert.ok(garden.level>level&&garden.progress.every(p=>p>.99));
console.log(JSON.stringify({passed:true,checks:['mirrored cover mapping at three aspect ratios','no upward rewind','no release snapback','re-grab continuity','30/60/120Hz motion consistency','neutral does not flower','increasing rain density','branch bloom order','suspended rain stops watering'],settledY:+settled.toFixed(2),refreshRateDelta:{x:+Math.abs(a.x-c.x).toFixed(3),y:+Math.abs(a.y-c.y).toFixed(3)},flowerProgress:garden.progress.map(p=>+p.toFixed(3))},null,2));
