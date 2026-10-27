import assert from 'node:assert/strict';
import {BloomGrowth} from '../dist/bloom-growth.js';
const b=new BloomGrowth();
for(let i=0;i<600;i++)b.update(1/60,{smiling:true});
assert.equal(b.level,0,'rain before first laugh cannot reveal flowers');
b.update(.05,{laughing:true});const initial=b.level;
for(let i=0;i<120;i++)b.update(1/60,{laughing:true});
assert.ok(b.level>initial);const early=b.progress.filter(v=>v>.01).length;
assert.ok(early>0&&early<24,'short laugh opens a small subset');
const prior=b.level;b.burst(0);assert.equal(b.level,prior);b.burst(110);assert.ok(b.level>prior);
const levels=[];
for(let i=0;i<720;i++){b.update(1/60,{laughing:true});levels.push(b.level);}
assert.equal(b.progress.filter(v=>v>.99).length,24);
assert.ok(levels.every((v,i)=>i===0||v>=levels[i-1]),'continuous laughter never cycles back to buds');
const full=b.level;b.update(.05,{suspended:true});assert.equal(b.level,full);
for(let i=0;i<120;i++)b.update(1/60,{});assert.equal(b.level,full,'brief speech pause keeps garden');
for(let i=0;i<600;i++)b.update(1/60,{});assert.equal(b.level,0);assert.ok(Math.max(...b.progress)<.002);
const results=[];
for(const fps of [30,60,120]){const f=new BloomGrowth();f.burst(110);for(let i=0;i<fps*5;i++)f.update(1/fps,{laughing:true});results.push(f.level);}
assert.ok(Math.max(...results)-Math.min(...results)<.00001);
b.update(.05,{laughing:true});b.update(.05,{head:false});assert.equal(b.level,0);
console.log(JSON.stringify({passed:true,earlyFlowers:early,maxFlowers:24,checks:['laugh-gated start','duration accumulation','actual emission bonus','monotonic long laugh','pause freeze','quiet grace and fade','30/60/120Hz consistency','face loss reset']}));
