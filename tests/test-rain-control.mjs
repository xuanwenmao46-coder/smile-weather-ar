import assert from 'node:assert/strict';
import {PalmGate,RainField,openPalm} from '../dist/rain-control.js';
const points=Array.from({length:21},()=>({x:.5,y:.8}));
points[5]={x:.35,y:.6};points[9]={x:.45,y:.58};points[13]={x:.55,y:.6};points[17]={x:.65,y:.64};
for(const [tip,pip,mcp] of [[8,6,5],[12,10,9],[16,14,13],[20,18,17]]){
  points[pip]={x:points[mcp].x,y:points[mcp].y-.18};points[tip]={x:points[mcp].x,y:points[mcp].y-.36};
}
assert.equal(openPalm(points,640,480),true);
const closed=points.map(p=>({...p}));for(const i of [8,12,16,20])closed[i].y=.7;
assert.equal(openPalm(closed,640,480),false);assert.equal(openPalm(points.slice(0,20)),false);
const gate=new PalmGate();
assert.equal(gate.update({open:true,x:200,y:300},0).active,false);
assert.equal(gate.update({open:true,x:200,y:300},250).active,false);
assert.equal(gate.update({open:true,x:200,y:300},270).active,true);
assert.equal(gate.update(null,500).active,true);assert.equal(gate.update(null,650).active,false);
gate.reset();gate.update({open:true,x:200,y:300},0);gate.update({open:true,x:200,y:300},300);
gate.update({open:false},330);assert.equal(gate.update({open:false},520).active,false);
const field=new RainField(),p={x:120,y:180,vx:-8,vy:400,life:4,depth:1,gripSerial:-1};
for(let i=0;i<120;i++){field.update(1/60,{active:true,x:200,y:300});p.life-=1/60;field.advance(p,1/60,600,1000);}
const frozen={x:p.x,y:p.y},life=p.life;
for(let i=0;i<120;i++){field.update(1/60,{active:true,x:200,y:300});p.life-=1/60;field.advance(p,1/60,600,1000);}
assert.ok(Math.abs(p.y-frozen.y)<.02,'held rain must remain stationary');assert.ok(Math.abs(p.life-life)<.02,'held droplets must not expire');
for(let i=0;i<60;i++){field.update(1/60,{active:true,x:350,y:220});p.life-=1/60;field.advance(p,1/60,600,1000);}
assert.ok(p.x>frozen.x+30,'hand must pull rain horizontally');assert.ok(p.y<frozen.y-10,'hand can lift rain');
const releaseY=p.y;
for(let i=0;i<90;i++){field.update(1/60,null);p.life-=1/60;field.advance(p,1/60,600,1000);}
assert.ok(p.y>releaseY+200,'released rain must resume falling');assert.ok(field.strength<.002);
field.reset();assert.equal(field.active,false);
console.log(JSON.stringify({passed:true,checks:['open vs closed palm','260ms activation','hand lost release','closed hand release','suspension stability','suspended lifetime','horizontal/vertical control','smooth release'],heldDrift:Math.abs(frozen.y-180).toFixed(2),restoredFall:(p.y-releaseY).toFixed(2)},null,2));
