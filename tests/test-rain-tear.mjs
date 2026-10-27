import assert from 'node:assert/strict';
import {RainTear} from '../dist/rain-tear.js';
const t=new RainTear(),head={x:300,y:450,rx:140,ry:210,tearEye:{x:250,y:400}};
assert.equal(t.update(.016,{mode:'still',head}),false);assert.equal(t.opacity,0);
assert.equal(t.update(.016,{mode:'rain',head}),true);
for(let i=0;i<60;i++)t.update(1/60,{mode:'rain',head});assert.ok(t.opacity>.9);assert.equal(t.count,1);assert.equal(t.eye.x,250);
const age=t.age;t.update(.05,{mode:'rain',head,suspended:true});assert.equal(t.age,age);
for(let i=0;i<300;i++)t.update(1/60,{mode:'rain',head});assert.equal(t.count,1);assert.equal(t.opacity,0);
for(let i=0;i<150;i++)t.update(1/60,{mode:'still',head});assert.equal(t.update(.016,{mode:'rain',head}),true);
const moved={...head,tearEye:{x:280,y:415}};for(let i=0;i<20;i++)t.update(1/60,{mode:'rain',head:moved});assert.ok(t.eye.x>279);
for(let i=0;i<30;i++)t.update(1/60,{mode:'bloom',head:moved});assert.ok(t.opacity<.01);
t.update(.016,{mode:'rain',head:null});assert.equal(t.opacity,0);assert.equal(t.eye,null);
console.log('PASS single rain-entry tear, eyelid anchor, tracking, cooldown, pause, bloom fade and face loss');

const pathTear=new RainTear(),face={...head,tearMouth:{x:270,y:550}};
pathTear.update(.016,{mode:'rain',head:face});
const start=pathTear.position(face,0),end=pathTear.position(face,1);
assert.equal(start.y,0);assert.ok(Math.abs((pathTear.eye.y+end.y)-face.tearMouth.y)<15);
assert.ok(pathTear.eye.y+end.y<face.tearMouth.y,'disappears before the lip');
console.log('PASS cheek path ends just before same-side mouth corner');

assert.ok(start.x<0,'left cheek offset points outward');
const right=new RainTear(),rightFace={...face,tearEye:{x:350,y:400},tearMouth:{x:330,y:550}};
right.update(.016,{mode:'rain',head:rightFace});assert.ok(right.position(rightFace,0).x>0,'mirrored cheek offset reverses');
console.log('PASS outward offset respects face side');
