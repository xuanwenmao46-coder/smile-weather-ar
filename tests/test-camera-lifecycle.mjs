import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const src=fs.readFileSync('dist/app.js','utf8');
const functions=src.slice(src.indexOf('function endCamera()'),src.indexOf('let effectPaused='));
const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v;}});return elements.get(id);};
let stopped=0;const track={stop(){stopped++;},addEventListener(){}};const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
let resolveCamera;let delayed=false;
const ctx=vm.createContext({$,source:'preview',starting:false,epoch:0,stream:null,cameraStalled:false,calibrating:false,head:null,previousHead:null,lastVideo:0,lastFace:0,velocity:{},lastInfer:0,
 navigator:{mediaDevices:{getUserMedia:()=>delayed?new Promise(r=>resolveCamera=r):Promise.resolve(stream)}},
 hands:{stop(){},start(){},gate:{reset(){}}},stage:{classList:{add(){},remove(){}}},video:{srcObject:null,play:()=>Promise.resolve()},giftAudio:{play:()=>Promise.resolve()},performance:{now:()=>100},
 syncLiveMusic(){},liveMusicMode:false,releaseHand(){},endReply(){},stopPreview(){},clearParticles(){},setMode(){},notify(){},calibrate(){},timed:p=>p,loadModel:()=>Promise.resolve()});
vm.runInContext(functions,ctx);
await ctx.startCamera();assert.equal(ctx.source,'camera');assert.equal($('camera').disabled,false);assert.equal($('camera').textContent,'关闭摄像头');assert.equal($('back-preview').hidden,false);
ctx.endCamera();assert.equal(stopped,1);assert.equal(ctx.video.srcObject,null);assert.equal(ctx.source,'preview');assert.equal($('camera').textContent,'开启摄像头');
delayed=true;const pending=ctx.startCamera();ctx.endCamera();resolveCamera(stream);await pending;assert.equal(stopped,2);assert.equal(ctx.source,'preview');assert.equal(ctx.video.srcObject,null);
console.log('PASS camera open, enabled close button, stream release, cancellation and late permission cleanup');
delayed=false;
ctx.loadModel=()=>Promise.reject(new Error('Model unavailable'));
await ctx.startCamera();
assert.equal(ctx.source,'preview');assert.equal(ctx.video.srcObject,null);
assert.equal($('status').textContent,'Model unavailable');
assert.equal($('camera').disabled,false);assert.equal(stopped,3);
console.log('PASS model failure reports an error and releases camera without faking recognition');
