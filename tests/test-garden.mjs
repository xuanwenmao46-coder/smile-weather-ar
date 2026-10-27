// Verifies integration budgets and face-loss behavior, not aesthetic quality.
import assert from 'node:assert/strict';
const gradient={addColorStop(){}};
let drawCalls=0;
const ctx=new Proxy({}, {get(target,key){
  if(key in target)return target[key];
  if(String(key).startsWith('create'))return()=>gradient;
  return(...args)=>{drawCalls++;for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(key)+' received nonfinite coordinate');};
}});
const canvas=()=>({width:600,height:1066,getContext:()=>ctx,ownerDocument:{createElement:()=>canvas()}});
globalThis.document={createElement:()=>canvas()};
const {GardenEffects}=await import('../dist/garden-effects.js');
const fx=new GardenEffects({canvas:canvas(),ctx});
fx.resize(600,1066);
const head={x:300,y:460,rx:140,ry:220,roll:.14};
for(let i=0;i<240;i++)fx.frame(1/60,i*1000/60,{mode:'rain',head});
assert.equal(fx.stats().flowers,0,'rain alone must not reveal flowers');
assert.ok(fx.opening>.67 && fx.opening<.69);assert.ok(fx.stats().active>0);
const cacheSize=fx.botanical.size;
assert.ok(fx.launch(head,4100));
for(let i=0;i<220;i++){
  const moved={...head,x:300+Math.sin(i*.08)*40};
  fx.frame(1/60,4100+i*1000/60,{mode:'bloom',head:moved,velocity:{x:30,y:0}});
  assert.ok(fx.stats().active<=600);assert.equal(fx.activeCount+fx.freeCount,600);
}
assert.equal(fx.botanical.size,cacheSize,'sprite cache must stay bounded');
assert.ok(fx.stats().collisions>0,'inherited head collision must still occur');
const collisions=fx.stats().collisions;
fx.frame(1/60,8200,{mode:'still',head:null});
assert.equal(fx.stats().flowers,0);assert.equal(fx.stats().butterflies,0);
fx.frame(1/60,8217,{head,suspended:true});assert.equal(fx.stats().flowers,0);
fx.frame(1/60,8234,{head,reduced:true});assert.equal(fx.stats().butterflies,0,'face loss clears accumulated garden');
fx.setStyle('nova');assert.equal(fx.stats().active,0);
// A raised hand before a smile must not prevent the first rain from appearing.
for(let i=0;i<60;i++)fx.frame(1/60,8500+i*16.7,{mode:'still',head,hand:{active:true,x:400,y:300}});
fx.frame(1/60,9600,{mode:'rain',head,hand:{active:true,x:400,y:300}});
assert.ok(fx.pool.some(p=>p.type===0&&p.life>0),'rain must still start with hand already raised');
for(let i=0;i<60;i++)fx.frame(1/60,9620+i*16.7,{mode:'rain',head,hand:{active:true,x:420,y:280}});
assert.ok(fx.stats().rainHold>.99);assert.ok(fx.stats().controlledRain>0);
assert.ok(fx.launch(head,11000));
for(let i=0;i<70;i++)fx.frame(1/60,11000+i*16.7,{mode:'bloom',head,hand:{active:true,x:420,y:280}});
assert.ok(fx.stats().collisions>0,'frozen rain must not freeze fireworks');
fx.replayFlowers();assert.equal(fx.stats().flowerProgress,0);
fx.clear(); // Isolate neutral input from droplets still falling after the previous rain.
for(let i=0;i<180;i++)fx.frame(1/60,12500+i*16.7,{mode:'still',head});
assert.equal(fx.stats().flowerProgress,0,'flowers must not open on a neutral timer');
for(let i=0;i<900;i++)fx.frame(1/60,16000+i*16.7,{mode:'rain',head});
assert.equal(fx.stats().flowerProgress,0,'rain alone must not open laugh flowers');
assert.equal(fx.stats().flowers,0);
assert.ok(fx.launch(head,32000));
for(let i=0;i<780;i++)fx.frame(1/60,32000+i*16.7,{mode:'bloom',head});
assert.equal(fx.stats().flowers,24);assert.ok(fx.stats().flowerProgress>.99);
fx.frame(1/60,45100,{mode:'bloom',head,flowersEnabled:false});assert.equal(fx.stats().flowers,0);assert.equal(fx.stats().butterflies,0);
fx.frame(1/60,45117,{mode:'bloom',head});assert.equal(fx.stats().flowers,24);
fx.clear();
const p=fx._alloc(1);Object.assign(p,{x:30,y:300,vx:0,vy:0,life:8,maxLife:8,gravity:0,drag:0,size:2});
for(let i=0;i<60;i++)fx.frame(1/60,35000+i*16.7,{head,hand:{active:true,x:100,y:300}});
const before=p.x;
for(let i=0;i<20;i++)fx.frame(1/60,36000+i*16.7,{head,hand:{active:true,x:100+i*3,y:300}});
assert.ok(p.x>before+30,'sparks must follow rightward palm movement');
fx.clear();
const impact=fx._alloc(1);Object.assign(impact,{x:head.x-head.rx-5,y:head.y,vx:300,vy:0,life:3,maxLife:3,gravity:0,drag:0,size:2});
fx._advance(1/30,head,0,0,false);
assert.ok(impact.vx< -250,'contact must produce a clearly outward reflected velocity');
assert.ok(impact.hit>0);
fx.clear();
fx.clear();
for(let i=0;i<30;i++)fx.frame(1/60,40000+i*16.7,{mode:'rain',head,finger:{active:true,x:70,y:650}});
assert.equal(fx.stats().fingerEvents,1);assert.ok(fx.fingertip.rings.some(r=>r.at>40000));
fx.clear();
for(let i=0;i<30;i++)fx.frame(1/60,41000+i*16.7,{mode:'bloom',head,finger:{active:true,x:70,y:200}});
assert.equal(fx.stats().fingerEvents,1);assert.ok(fx.pool.some(p=>p.type===1&&p.life>0),'fingertip must create physical spark particles');
assert.ok(fx.activeCount<=600);assert.equal(fx.activeCount+fx.freeCount,600);
fx.clear();
for(let i=0;i<30;i++)fx.frame(1/60,42000+i*16.7,{mode:'bloom',head,hand:{active:true,x:70,y:200},finger:{active:true,x:70,y:200}});
assert.equal(fx.stats().fingerEvents,0,'open palm owns the interaction');
fx.frame(1/60,42510,{mode:'bloom',head,suspended:true});assert.equal(fx.stats().fingerEvents,0);
for(const dt of [NaN,Infinity,-1,undefined,0])fx.frame(dt,9000,{head});
assert.ok(drawCalls>0);
console.log(JSON.stringify({passed:true,flowers:24,butterflies:2,reducedButterflies:1,particleCapacity:600,cacheSize,collisions,checks:['moving head','face lost','suspended','reduced motion','style reset','nonfinite dt','cache bounded','no flowers before laugh','staggered laugh bloom','palm steers sparks','visible outward bounce']},null,2));

fx.clear();
for(let i=0;i<90;i++)fx.frame(1/60,60000+i*1000/60,{mode:'rain',head});
assert.equal(fx.stats().rainbowAlpha,0);
let sawRainbow=false;
for(let i=0;i<600;i++){
 fx.frame(1/60,62000+i*1000/60,{mode:'still',head});
 const state=fx.stats();
 if(state.rainCount>0)assert.equal(state.rainbowAlpha,0,'never show rainbow with remaining raindrops');
 if(state.rainbowAlpha>.5)sawRainbow=true;
}
assert.ok(sawRainbow,'rain settles into a visible rainbow');
console.log('PASS integrated rain-to-rainbow ending');

fx.clear();for(let i=0;i<90;i++)fx.frame(1/60,80000+i*1000/60,{mode:'rain',head});
assert.ok(fx.stats().rainCount>0);
for(let i=0;i<30;i++)fx.frame(1/60,82000+i*1000/60,{mode:'bloom',head});
assert.equal(fx.stats().rainCount,0,'rain clears before the fireworks dominate');
fx.launch(head,83000,{intensity:.8});for(let i=0;i<60;i++)fx.frame(1/60,83000+i*1000/60,{mode:'bloom',head});
assert.ok(fx.activeCount>0);
for(let i=0;i<35;i++)fx.frame(1/60,85000+i*1000/60,{mode:'rain',head});
assert.equal(fx.pool.filter(p=>p.type!==0&&p.life>0).length,0,'firework tails yield to rain');
console.log('PASS separate rain and firework transitions');

fx.clear();const sounds=[];fx.onSound=kind=>sounds.push(kind);
for(let i=0;i<120;i++)fx.frame(1/60,90000+i*1000/60,{mode:'bloom',head,finger:i<40?{active:true,x:head.x+head.rx+24,y:head.y}:null});
assert.ok(sounds.includes('spark'),'finger ignition emits its own sound event');
assert.ok(fx.stats().collisions>0,'finger fireworks use the same physical head collider');
console.log('PASS finger fireworks collide with the head and emit interaction audio');
