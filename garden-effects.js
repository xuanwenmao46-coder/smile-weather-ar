import {RainTear} from './rain-tear.js?v=24';
import {RainbowEnding} from './rainbow-ending.js?v=21';
import {BloomGrowth} from './bloom-growth.js?v=19';
import {FireworkBag} from './firework-styles.js?v=14';
import {Fingertip} from './fingertip.js?v=21';
// Living Garden: bounded, cached botanical forms attached to the tracked head.
// Existing swept particle/head collision and resource limits remain authoritative.
import { CinematicEffects } from './cinematic-effects.js?v=14';
import {Atmosphere} from './atmosphere.js?v=12';
import {RainField,RainGarden} from './rain-control.js?v=11';
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function surface(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function petalPath(g,r,width,bend=0){g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-width*.7,-r*.26,-width,-r*.91,bend,-r);g.bezierCurveTo(width,-r*.95,width*.66,-r*.25,0,0);}

export class GardenEffects extends CinematicEffects {
  constructor(options){
    super(options);
    this.tear=new RainTear();this.rainbow=new RainbowEnding();this.fireworkBag=new FireworkBag();this.fireworkName='';this.fingertip=new Fingertip();this.atmosphere=new Atmosphere();this.botanical=new Map();this.opening=.38;this.energy=0;this.bloomAt=-1e5;
    this.anchor=null;this.elapsed=0;this.attachedFlowers=0;this.flowerClock=0;this.rainField=new RainField();this.growth=new RainGarden();
    this.bloomGrowth=new BloomGrowth();this.bloomProgress=this.bloomGrowth.progress;this.worldFlowers=Array.from({length:6},()=>({x:0,y:0,r:0}));this.dew=new Float32Array(24);
    this.butterflies=Array.from({length:2},(_,i)=>({phase:i*2.399,side:i%2?1:-1,size:.038+i*.008}));
    // x/y in head radii, deliberately outside eye/mouth ellipse.
    this.flowers=[
      [-1.18,1.64,.46,0,-.38],[-.67,2.03,.31,1,.72],[-1.69,1.34,.24,2,-.45],
      [1.28,1.49,.42,0,.26],[.83,1.99,.30,1,-.46],[1.75,1.12,.22,1,.53],
      [-1.63,.99,.20,2,-.24],[-1.88,1.63,.23,1,.65],[-1.23,2.15,.29,2,-.18],
      [1.57,.90,.19,2,.34],[1.90,1.46,.22,1,-.71],[1.36,2.18,.28,2,.08],
      [-1.79,2.02,.25,1,-.55],[-.22,2.27,.28,2,.43],[-1.22,1.12,.21,1,.09],
      [1.80,1.96,.24,2,-.38],[.42,2.30,.26,1,.84],[1.06,1.16,.20,2,-.15],
      [-.72,2.51,.29,0,.24],[.98,2.54,.28,1,-.61],[-1.52,2.55,.25,2,.62],
      [1.70,2.49,.27,0,-.32],[-.13,2.72,.32,1,.31],[.50,2.78,.27,2,-.27]
    ];
    // Rear mass first, connecting middle flowers next, two hero blooms last.
    this.flowerDrawOrder=[20,21,22,23,18,19,12,15,7,10,13,16,6,9,8,11,2,5,14,17,1,4,0,3];
    this._prepare();
    if(typeof Image!=='undefined'){
      const atlas=new Image();
      atlas.onload=()=>{this.atlas=atlas;this.botanical.clear();this._prepare();};
      atlas.src=new URL('./assets/garden-atlas.png',import.meta.url).href;
      const flowers=new Image();
      flowers.onload=()=>{this.flowerAtlas=flowers;this.botanical.clear();this._prepare();this.flowerClock=0;};
      flowers.src=new URL('./assets/peony-opening.png',import.meta.url).href;
    }
  }
  setStyle(name){
    super.setStyle(name);
    this.preset={...this.preset,colors:this.style==='nova'?['#ffc7a9','#f8e6bd','#edafbb','#fff4db']:['#ffd1a0','#f6d8ab','#efb4ab','#fff4dc'],rain:['#99c9e5','#c5e6ef','#e4f4fa']};
    if(this.botanical){this.botanical.clear();this._prepare();}
  }
  clear(){super.clear();this.tear?.reset();this.visualMode='still';this.rainbow?.reset();this.anchor=null;this.opening=.38;this.energy=0;this.bloomAt=-1e5;this.attachedFlowers=0;this.flowerClock=0;this.rainField?.reset();this.growth?.reset();this.dew?.fill(0);this.bloomGrowth?.reset();this.atmosphere?.reset();this.fingertip?.reset();}
  replayFlowers(){this.bloomAt=-1e5;this.bloomGrowth.reset();this.growth.reset();this.dew.fill(0);}
  stats(){return {...super.stats(),tearOpacity:this.tear?.opacity||0,tearCount:this.tear?.count||0,rainbowAlpha:this.rainbow?.alpha||0,rainCount:this.pool.filter(p=>p.type===0&&p.life>0).length,bloomLevel:this.bloomGrowth?.level||0,laughSeconds:this.bloomGrowth?.laughSeconds||0,bloomBursts:this.bloomGrowth?.bursts||0,fireworkName:this.fireworkName||'',fingerEvents:this.fingertip?.count||0,fingerProgress:this.fingertip?.progress||0,flowers:this.attachedFlowers||0,butterflies:this.anchor&&this.attachedFlowers>0?(this.reduced?1:this.butterflies.length):0,rainHold:this.rainField?.strength||0,controlledRain:this.rainField?.controlled||0,rainLevel:this.growth?.level||0,flowerWater:this.growth?.water||0,flowerProgress:this.bloomProgress?this.bloomProgress.reduce((a,b)=>a+b,0)/this.flowers.length:0};}
  _alloc(type){const p=super._alloc(type);if(p)p.gripSerial=-1;return p;}
  _rain(...args){
    if(this.preventNewRain)return;
    const before=this.activeCount;super._rain(...args);
    if(this.activeCount>before){const p=this.pool[this.active[this.activeCount-1]];p.size*=2.2;p.length*=1.45;p.opacity=Math.min(1,p.opacity*1.22);if(p.depth===0){p.size*=.72;p.length*=.68;p.opacity*=.58;}if(p.depth===2)p.blurred=p.index%3!==0;}
  }
  _advanceRain(p,dt){
    const oldY=p.y;this.rainField.advance(p,dt,this.w,this.h);if(!this.reduced)this.fingertip.disturb(p,dt,this.w,this.frameNow||0);
    if(!this.anchor||this.rainField.strength>.7||p.depth===0)return;
    for(let i=0;i<6;i++){const f=this.worldFlowers[i];if(oldY<f.y&&p.y>=f.y&&Math.abs(p.x-f.x)<f.r*.6){this.growth.hit(i);this.dew[i]=1;p.life=Math.min(p.life,.1);break;}}
  }
  _drawRain(p,head,now,reduced,preview){
    if(p.depth===2&&!this.foregroundPass)return;
    const hold=this.rainField.strength;
    if(hold<.001){
      const g=this.ctx,fade=Math.min(1,p.life/.28),alpha=p.opacity*fade*this._safety(p.x,p.y,head);
      g.save();g.globalCompositeOperation='source-over';g.globalAlpha=Math.min(.8,alpha)*(head&&((p.x-head.x)/head.rx)**2+((p.y-head.y)/head.ry)**2<.8?.4:1);
      const wet=g.createLinearGradient(p.x,p.y-p.length*1.35,p.x,p.y);wet.addColorStop(0,'#baddf000');wet.addColorStop(.3,'#baddf055');wet.addColorStop(1,'#d9f3ff');g.strokeStyle=wet;g.lineWidth=Math.max(.7,Math.min(this.w*.0024,p.size*.6));g.lineCap='round';
      const len=p.length*(p.depth===0?.8:1.35),lean=p.vx/Math.max(30,p.vy)*len;
      g.beginPath();g.moveTo(p.x-lean,p.y-len);g.lineTo(p.x,p.y);g.stroke();
      if(p.depth===2){g.globalAlpha*=.45;g.fillStyle='#e7f7ff';g.beginPath();g.ellipse(p.x,p.y,this.w*.0016,this.w*.0038,0,0,TAU);g.fill();}
      g.restore();return;
    }
    const length=p.length,opacity=p.opacity;
    // Shorten streaks continuously; keep the droplet head visible throughout.
    p.length=length*(1-hold*.97);p.opacity=opacity*(1-hold*.82);
    super._drawRain(p,head,now,reduced,preview);p.length=length;p.opacity=opacity;
    const g=this.ctx,alpha=p.opacity*this._safety(p.x,p.y,head);
    const radius=Math.max(2.2,this.w*[.003,.0045,.006][p.depth]);
    g.save();g.globalAlpha=alpha*.5*hold;g.fillStyle='#c6e1dc';
    g.beginPath();g.ellipse(p.x,p.y,radius*.67,radius*(1.7-hold*.7),0,0,TAU);g.fill();
    g.globalAlpha=alpha*.68*hold;g.strokeStyle='#f3fff9';g.lineWidth=Math.max(.6,this.w*.001);g.stroke();
    g.globalAlpha=alpha*.8*hold;g.fillStyle='#ffffff';g.beginPath();g.arc(p.x-radius*.18,p.y-radius*.26,radius*.23,0,TAU);g.fill();g.restore();
  }
  _prepare(){for(let i=0;i<3;i++){for(let step=0;step<6;step++)this._flower(i,step);this._leaf(i);this._butterfly(i);}this._petal();}
  launch(head,now,options={}){
    const ok=super.launch(head,now,options);
    if(ok){
      if(now-this.bloomAt>8000)this.bloomAt=now;
      // Side bursts now occupy the frame rather than hiding above it.
      // They begin outside the head so later reflected trajectories are real.
      const recent=this.shells.slice(-3),look=this.fireworkBag.next();
      for(const shell of recent){shell.shape=look.id;shell.styleName=look.name;shell.color=look.color;}
      for(let i=0;i<recent.length;i++)if(!recent[i].major){
        recent[i].x=this.w*(i===0?.15:.85);
        recent[i].y=clamp(head.y-head.ry*.32,this.h*.20,this.h*.42);
      }
    }
    return ok;
  }
  _burst(shell){
    const style=shell.shape?{id:shell.shape,name:shell.styleName,color:shell.color}:this.fireworkBag.next();this.fireworkName=style.name;shell={...shell,shape:style.id,color:style.color};
    this.atmosphere.burst(shell.x,shell.y,shell.major,this.reduced);
    this.onSound?.('burst',shell.major);
    const first=this.activeCount;super._burst(shell);this.bloomGrowth.burst(this.activeCount-first);
    for(let i=first;i<this.activeCount;i++){
      const p=this.pool[this.active[i]];
      if(p.type!==0&&p.age===0){p.size*=this.reduced?1.35:2.8;p.opacity=1;if(p.type===1&&!this.reduced){p.vx*=1.65;p.vy*=1.65;p.life*=1.18;p.drag*=.85;}}
    }
  }
  frame(dt,now,options={}){
    dt=clamp(Number(dt)||0,0,.05);now=Number(now)||0;this.elapsed+=dt;this.frameNow=now;
    if(options.suspended){this.attachedFlowers=0;this.anchor=null;this.atmosphere.reset();this.fingertip.reset();return;}
    if(this.visualMode!==options.mode){
      if(options.mode==='bloom')for(let i=0;i<this.activeCount;i++){const p=this.pool[this.active[i]];if(p.type===0)p.life=Math.min(p.life,.28);}
      if(options.mode==='rain'){this.shells.length=0;for(let i=0;i<this.activeCount;i++){const p=this.pool[this.active[i]];if(p.type!==0)p.life=Math.min(p.life,.32);}}
      this.visualMode=options.mode;
    }
    this.rainField.update(dt,options.hand);
    this.preventNewRain=this.rainField.strength>.12&&this.pool.some(p=>p.type===0&&p.life>0);
    const h=options.head;
    const valid=h&&Number.isFinite(h.x)&&Number.isFinite(h.y)&&h.rx>0&&h.ry>0;
    if(!valid)this.anchor=null;
    else{
      if(!this.anchor){this.anchor={...h};this.flowerClock=0;}
      const k=1-Math.exp(-dt*13);
      for(const key of ['x','y','rx','ry'])this.anchor[key]+=(h[key]-this.anchor[key])*k;
      this.anchor.roll=clamp(Number(h.roll)||0,-.45,.45);this.anchor.tearEye=h.tearEye;this.anchor.tearMouth=h.tearMouth;
    }
    this.reduced=!!options.reduced;
    if(this.tear.update(dt,{mode:options.mode,head:this.anchor,reduced:this.reduced}))this.onSound?.('rain-start');
    if(this.anchor)this.flowerClock+=dt;
    this.growth.update(dt,{raining:options.mode==='rain'&&!!this.anchor,hold:this.rainField.strength,intensity:options.intensity??.7});
    if(this.anchor){const a=this.anchor,c=Math.cos(a.roll||0),s=Math.sin(a.roll||0);for(let i=0;i<6;i++){const f=this.flowers[i],x=f[0]*a.rx,y=f[1]*a.ry;Object.assign(this.worldFlowers[i],{x:a.x+x*c-y*s,y:a.y+x*s+y*c,r:a.rx*f[2]*1.1});this.dew[i]*=Math.exp(-dt*4);}}
    const active=options.mode==='rain'||options.mode==='bloom';
    const target=.68; // Botanical scenery is styling, never an extra expression rule.
    this.opening+=(target-this.opening)*(1-Math.exp(-dt*2.1));
    this.energy+=(active?1-this.energy:-this.energy)*(1-Math.exp(-dt*2.8));
    this.bloomGrowth.update(dt,{laughing:options.mode==='bloom',smiling:options.mode==='rain',head:!!this.anchor});
    if(!this.anchor||options.fingerEnabled===false)this.fingertip.reset();
    else {
      const hit=this.fingertip.update(now,options.hand?.active?null:options.finger,options.mode,this.w,this.h);
      if(hit)this.onSound?.(hit.kind);
      if(hit?.kind==='spark')this._burst({x:hit.x,y:hit.y,shape:'rings',styleName:'指尖星环',major:false,density:.25,fidelity:options.quality??1,reduced:this.reduced,color:0,seed:Math.random()*TAU});
    }
    this.atmosphere.update(dt,{...options,head:this.anchor});
    this.atmosphere.backdrop(this.ctx,this.w,this.h,this.anchor,now,this.reduced);
    const rainCount=this.pool.filter(p=>p.type===0&&p.life>0).length;
    this.rainbow.update(dt,{mode:options.mode,rainCount,head:!!this.anchor});
    this.rainbow.draw(this.ctx,this.w,this.h,this.reduced);
    this._garden(now,options);
    super.frame(dt,now,{...options,intensity:options.mode==='rain'?(options.intensity??.7)*(1.05+.75*this.growth.level):options.intensity});
    if(this.anchor&&options.flowersEnabled!==false)this._flight(now,options);
    this.atmosphere.foreground(this.ctx,this.w,this.h,this.anchor,options.hand,this.rainField.strength,this.contacts,this.reduced);
    this.fingertip.draw(this.ctx,this.w,this.h,now,this.reduced,options.background,!options.preview);
    this.foregroundPass=true;
    for(let i=0;i<this.activeCount;i++){const p=this.pool[this.active[i]];if(p.type===0&&p.depth===2)this._drawRain(p,this.anchor,now,this.reduced,options.preview);}
    this.foregroundPass=false;
    this._handCue(options.hand,now);
    this.tear.draw(this.ctx,this.w,this.h,this.anchor,this.reduced,options.background,!options.preview);
  }
  _safety(x,y,head){return Math.max(.42,super._safety(x,y,head));}
  _advance(dt,head,hvx,hvy,reduced){
    const field=this.rainField;
    if(field.active&&dt>0){
      const dx=clamp(field.stepX,-this.w*dt*2.2,this.w*dt*2.2),dy=clamp(field.stepY,-this.h*dt*1.7,this.h*dt*1.7);
      for(let i=0;i<this.activeCount;i++){const p=this.pool[this.active[i]];if(p.type===0)continue;
        const gain=(reduced?.65:1.8)*field.meanStrength;
        // Apply the same measured palm displacement to the trajectory and its history.
        p.x+=dx*gain;p.y+=dy*gain;
        for(let j=0;j<p.trailN;j++){p.trailX[j]+=dx*gain;p.trailY[j]+=dy*gain;}
        p.vx+=dx*gain*2;p.vy+=dy*gain*2;
      }
    }
    super._advance(dt,head,hvx,hvy,reduced);
  }
  _handCue(hand,now){
    if(!hand||this.rainField.strength<.08)return;
    const g=this.ctx,w=this.w,s=this.rainField.strength;
    g.save();g.globalAlpha=s*.4;g.strokeStyle='#d8eee6';g.lineWidth=Math.max(.8,w*.0012);
    for(let i=0;i<5;i++){const a=i*TAU/5+now*.00013,r=w*(.047+.004*Math.sin(now*.001+i));g.beginPath();g.arc(hand.x+Math.cos(a)*r,hand.y+Math.sin(a)*r,w*.0025,0,TAU);g.stroke();}
    if(hand.simulated&&this.showHandGuide){
      g.translate(hand.x,hand.y);g.scale(w*.065,w*.065);g.lineWidth=.035;g.globalAlpha=s*.45;
      g.beginPath();g.moveTo(-.5,.9);g.lineTo(-.62,.18);g.bezierCurveTo(-1.12,-.18,-.96,-.52,-.68,-.24);g.lineTo(-.42,.03);g.lineTo(-.42,-1.05);g.quadraticCurveTo(-.42,-1.38,-.2,-1.15);g.lineTo(-.15,-.36);g.lineTo(-.12,-1.4);g.quadraticCurveTo(-.04,-1.64,.12,-1.4);g.lineTo(.15,-.36);g.lineTo(.24,-1.2);g.quadraticCurveTo(.41,-1.4,.47,-1.12);g.lineTo(.43,-.25);g.lineTo(.6,-.88);g.quadraticCurveTo(.82,-1.04,.82,-.73);g.lineTo(.65,.56);g.lineTo(.38,.95);g.stroke();
    }
    g.restore();
  }
  _garden(now,{mode='still',reduced=false,flowersEnabled=true}={}){
    const a=this.anchor;if(!a||!flowersEnabled){this.attachedFlowers=0;return;}
    const g=this.ctx,t=now/1000;
    const visibility=Math.max(...this.bloomProgress);this.attachedFlowers=this.bloomProgress.filter(v=>v>.01).length;if(visibility<.001)return;
    g.save();g.globalCompositeOperation='source-over';g.translate(a.x,a.y);g.rotate(a.roll||0);
    // Body-supporting vines: no opaque panel, no floral mask over the face.
    for(const side of [-1,1]){
      g.strokeStyle='#416646';g.lineWidth=Math.max(1.5,this.w*.004);g.globalAlpha=.83*visibility;
      g.beginPath();g.moveTo(side*a.rx*1.0,a.ry*1.73);
      g.bezierCurveTo(side*a.rx*1.72,a.ry*1.55,side*a.rx*1.72,a.ry*1.21,side*a.rx*1.66,a.ry*1.04);g.stroke();
      g.strokeStyle='#a8b88b';g.lineWidth=Math.max(.6,this.w*.0012);g.stroke();
      for(let i=0;i<5;i++){
        const p=i/4,y=a.ry*(1.72-p*.63),x=side*a.rx*(1.40+.23*Math.sin(p*2.2));
        const sway=reduced?0:Math.sin(t*.8+i*.7)*.025;
        const size=a.rx*(.20+(i%3)*.035);
        g.save();g.translate(x,y);g.rotate(side*(.55+(i%2)*1.2)+sway);
        g.globalAlpha=(.70+(i%3)*.09)*visibility;g.drawImage(this._leaf(i%3),-size*.5,-size*.94,size,size);g.restore();
      }
    }
    // A fine curved stem supports the crown. Blooms remain off the forehead.
    g.globalAlpha=.65;g.strokeStyle='#78855b';g.lineWidth=this.w*.002;
    for(const i of this.flowerDrawOrder){
      const progress=this.bloomProgress[i];if(progress<.001)continue;
      const [x,y,size,type,rotation]=this.flowers[i];
      const breath=reduced?0:Math.sin(t*.58+i*.75)*(.012+this.growth.level*.015)+Math.sin(t*9)*this.dew[i]*.035;
      const d=a.rx*size*3.25;
      if(i!==0&&i!==3){
        const side=x<0?-1:1;g.globalAlpha=progress*.55;g.strokeStyle='#78956b';g.lineWidth=this.w*.0018;
        const root=this.flowers[side<0?0:3];g.beginPath();g.moveTo(root[0]*a.rx,root[1]*a.ry);
        g.quadraticCurveTo((x+side*.14)*a.rx,(y+root[1])*.5*a.ry,x*a.rx,y*a.ry);g.stroke();
      }
      const growth=progress;
      g.save();g.translate(x*a.rx,y*a.ry);g.rotate(rotation+breath);
      g.scale(growth,growth);
      const frame=progress*5,lo=Math.floor(frame),hi=Math.min(5,lo+1),blend=frame-lo;
      const alpha=i>=18?.96:i>=6?.90:.98;g.globalAlpha=alpha*(1-blend);g.drawImage(this._flower(type,lo),-d*.5,-d*.5,d,d);
      if(hi!==lo){g.globalAlpha=alpha*blend;g.drawImage(this._flower(type,hi),-d*.5,-d*.5,d,d);}g.restore();
      if(this.dew[i]>.02){g.globalAlpha=this.dew[i]*.7;g.strokeStyle='#e4f5e9';g.lineWidth=this.w*.001;g.beginPath();g.ellipse(x*a.rx,y*a.ry-d*.18,d*.11,d*.035,0,0,TAU);g.stroke();}
    }
    // Dew points become warm pollen in the laugh; sparse and bounded.
    if(this.energy>.03){
      const count=reduced?9:25;
      for(let i=0;i<count;i++){
        const ang=i*2.399+t*.08,r=1.1+(i%6)*.085;
        const x=Math.cos(ang)*a.rx*r,y=Math.sin(ang)*a.ry*r;
        g.globalAlpha=this.energy*(.2+.35*Math.sin(i+t*.7)**2);
        g.fillStyle=mode==='bloom'?'#fff0c0':'#e4f6df';g.beginPath();g.arc(x,y,this.w*(i%4===0?.0029:.0015),0,TAU);g.fill();
      }
    }
    g.restore();
  }
  _flight(now,{mode='still',reduced=false}={}){
    const a=this.anchor,g=this.ctx,t=now/1000;
    const release=1-ease((now-this.bloomAt)/4400);
    const count=reduced?1:this.butterflies.length;
    for(let i=0;i<count;i++){
      const b=this.butterflies[i],moving=false;
      const arrived=ease((this.bloomProgress[(i*3+1)%6]-.5)/.35);if(arrived<=0)continue;
      let x,y,angle=0;
      if(moving&&!reduced){
        const u=t*(.24+i*.013)+b.phase;
        x=a.x+b.side*a.rx*(1.30+.34*Math.sin(u*1.8))+Math.sin(u*2.3)*a.rx*.17;
        y=a.y+a.ry*(.4+1.11*Math.sin(u))-(release*a.ry*.65);
        angle=Math.cos(u)*.35+b.side*.15;
      }else{
        const f=this.flowers[(i*3+1)%this.flowers.length];x=a.x+f[0]*a.rx;y=a.y+f[1]*a.ry-a.rx*.12;
        angle=b.side*.23;
      }
      // Keep butterflies outside the face, even as the head moves.
      const dx=(x-a.x)/a.rx,dy=(y-a.y)/a.ry,q=dx*dx+dy*dy;
      if(q<1.20){const inv=Math.sqrt(1.20/Math.max(.01,q));x=a.x+dx*inv*a.rx;y=a.y+dy*inv*a.ry;}
      const d=this.w*b.size*(1+(i%3)*.14);
      const flap=reduced?.8:Math.max(.16,Math.abs(Math.sin(t*(moving?9:2.2)+b.phase)));
      g.save();g.translate(x,y);g.rotate(angle);g.globalAlpha=.92*arrived;
      // Two independent hinged wings; a static silhouette would read as confetti.
      for(const side of [-1,1]){g.save();g.scale(side*(.24+flap*.76),1);g.drawImage(this._butterfly(i%3),0,-d*.68,d,d*1.36);g.restore();}
      g.fillStyle='#26323c';g.beginPath();g.ellipse(0,0,d*.038,d*.30,0,0,TAU);g.fill();
      g.strokeStyle='#49454a';g.lineWidth=Math.max(.6,this.w*.001);
      g.beginPath();g.moveTo(0,-d*.22);g.quadraticCurveTo(-d*.04,-d*.46,-d*.13,-d*.46);g.moveTo(0,-d*.22);g.quadraticCurveTo(d*.04,-d*.46,d*.13,-d*.46);g.stroke();g.restore();
    }
  }
  _flower(type,step){
    const key=`flower-${type}-${step}`;if(this.botanical.has(key))return this.botanical.get(key);
    if(this.flowerAtlas){
      const c=surface(320,320),g=c.getContext('2d'),w=this.flowerAtlas.width/3,h=this.flowerAtlas.height/2;
      g.translate(160,160);g.rotate(type===1?-.14:type===2?.18:0);if(type===1)g.scale(-.94,.94);if(type===2){g.scale(.88,.96);g.filter='saturate(.76) brightness(1.04)';}g.drawImage(this.flowerAtlas,(step%3)*w,Math.floor(step/3)*h,w,h,-160,-160,320,320);
      this.botanical.set(key,c);return c;
    }
    if(this.atlas){
      const c=surface(320,320),g=c.getContext('2d'),w=this.atlas.width,h=this.atlas.height;
      const cluster=type===0,openness=.57+step*.086;
      g.translate(160,160);g.rotate(type===2?-.2:0);g.scale(.67+openness*.33,.80+openness*.2);
      g.drawImage(this.atlas,cluster?0:w*.52,cluster?0:h*.55,w*(cluster?.50:.48),h*(cluster?.5:.45),-160,-160,320,320);
      this.botanical.set(key,c);return c;
    }
    const c=surface(256,256),g=c.getContext('2d');g.translate(128,128);
    const palettes=this.style==='nova'?[['#fff2dd','#e9ba9b','#b97d75'],['#ffe7cf','#df9c8e','#ac6a77'],['#fff4dc','#e9d5b5','#ad9b73']]:[['#fff6eb','#efc5c9','#bf829c'],['#fff7ee','#e6ddd1','#b9ae9e'],['#f6e4f1','#d5afcf','#986c9d']];
    const colors=palettes[type],open=.36+step*.128;
    // Multiple unequal translucent layers, ribs and folded edges are cached.
    const layers=type===1?3:4;
    for(let layer=0;layer<layers;layer++){
      const n=type===1?9:7,r=(110-layer*20)*open;
      for(let i=0;i<n;i++){
        g.save();g.rotate(i/n*TAU+layer*.51+type*.3);
        const length=r*(.9+.1*Math.sin(i*3.5+layer)),width=length*(type===1?.44:.66);
        const grad=g.createLinearGradient(0,0,0,-length);grad.addColorStop(0,colors[2]);grad.addColorStop(.43,colors[1]);grad.addColorStop(.84,colors[0]);grad.addColorStop(1,'#fffaf2');
        g.fillStyle=grad;petalPath(g,length,width,Math.sin(i*2)*length*.09);g.fill();
        g.strokeStyle='rgba(130,90,113,.14)';g.lineWidth=.65;g.stroke();
        for(let vein=-2;vein<=2;vein++){
          g.strokeStyle='rgba(167,112,139,.12)';g.lineWidth=.65;g.beginPath();g.moveTo(0,-5);g.quadraticCurveTo(vein*width*.13,-length*.45,vein*width*.18,-length*.85);g.stroke();
        }
        g.restore();
      }
    }
    const center=type===1?22:16;
    const cg=g.createRadialGradient(-3,-3,1,0,0,center);cg.addColorStop(0,'#d1a65c');cg.addColorStop(.65,'#a48242');cg.addColorStop(1,'#746148');g.fillStyle=cg;g.beginPath();g.arc(0,0,center,0,TAU);g.fill();
    for(let i=0;i<65;i++){const r=center*Math.sqrt(i/65),a=i*2.399;g.fillStyle=i%3?'#edd494':'#fff2c8';g.beginPath();g.arc(Math.cos(a)*r,Math.sin(a)*r,1.2+(i%3)*.4,0,TAU);g.fill();}
    this.botanical.set(key,c);return c;
  }
  _leaf(type){
    const key=`leaf-${type}`;if(this.botanical.has(key))return this.botanical.get(key);
    const c=surface(128,160),g=c.getContext('2d');g.translate(64,152);
    const grad=g.createLinearGradient(-25,-70,35,-140);grad.addColorStop(0,'#233d31');grad.addColorStop(.45,['#5f8060','#839371','#647e73'][type]);grad.addColorStop(1,'#b0b991');
    g.fillStyle=grad;g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-58,-40,-58,-112,6,-150);g.bezierCurveTo(48,-112,50,-55,0,0);g.fill();
    g.strokeStyle='#c4cda57a';g.lineWidth=1;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(-5,-76,6,-150);g.stroke();
    for(let i=1;i<8;i++){g.strokeStyle='#c4cda53a';g.beginPath();g.moveTo(0,-i*17);g.quadraticCurveTo(-15,-i*17-12,-31+Math.abs(i-4)*4,-i*17-22);g.moveTo(0,-i*17);g.quadraticCurveTo(18,-i*17-8,30-Math.abs(i-4)*4,-i*17-21);g.stroke();}
    this.botanical.set(key,c);return c;
  }
  _butterfly(type){
    const key=`butterfly-${type}`;if(this.botanical.has(key))return this.botanical.get(key);
    if(this.atlas){
      const c=surface(128,174),g=c.getContext('2d'),w=this.atlas.width,h=this.atlas.height;
      // Source is one complete spread butterfly; take its right wing for a hinge.
      g.drawImage(this.atlas,w*.255,h*.54,w*.25,h*.41,0,0,128,174);
      this.botanical.set(key,c);return c;
    }
    const c=surface(128,174),g=c.getContext('2d');g.translate(3,81);
    const grad=g.createLinearGradient(0,0,116,-42);grad.addColorStop(0,'#424050');grad.addColorStop(.27,['#719fc2','#ada1ce','#e3ba92'][type]);grad.addColorStop(.65,['#c0d9e5','#d6c6e7','#f7dfb9'][type]);grad.addColorStop(.88,['#729dbb','#9d8eba','#bb917c'][type]);grad.addColorStop(1,'#424352');
    g.fillStyle=grad;g.strokeStyle='#464252';g.lineWidth=2;
    g.beginPath();g.moveTo(0,0);g.bezierCurveTo(16,-34,66,-79,113,-76);g.bezierCurveTo(129,-38,95,-6,32,8);g.bezierCurveTo(92,-13,111,47,59,77);g.bezierCurveTo(39,93,6,43,0,0);g.fill();g.stroke();
    g.lineWidth=1;g.strokeStyle='#3c405d77';
    for(let i=0;i<7;i++){g.beginPath();g.moveTo(2,0);g.quadraticCurveTo(40,-i*6,106-i*9,-70+i*10);g.moveTo(3,5);g.quadraticCurveTo(33,20+i*4,61-i*7,72-i*3);g.stroke();}
    for(let i=0;i<9;i++){g.fillStyle='#fff9e7c9';g.beginPath();g.ellipse(88+i%3*8,-62+i*7,2.5,1.6,-.5,0,TAU);g.fill();}
    this.botanical.set(key,c);return c;
  }
  _petal(){
    const key='petal';if(this.botanical.has(key))return this.botanical.get(key);
    const c=surface(64,80),g=c.getContext('2d');g.translate(32,69);const grad=g.createLinearGradient(0,0,0,-62);grad.addColorStop(0,'#bd8ea9');grad.addColorStop(.55,'#edc9de');grad.addColorStop(1,'#fff1ea');g.fillStyle=grad;petalPath(g,62,30,7);g.fill();this.botanical.set(key,c);return c;
  }
  _drawSpark(p,head,now,reduced,preview){
    super._drawSpark(p,head,now,reduced,preview);
    if(!this.botanical||p.type!==1||p.index%9!==0)return;
    const fade=ease(p.life/.7)*ease(p.age/.12)*this._safety(p.x,p.y,head);
    const d=this.w*(p.hero?.017:.010)*( .7+p.life/p.maxLife*.3);
    const g=this.ctx;g.save();g.globalAlpha=fade*.88;g.translate(p.x,p.y);g.rotate(p.phase+p.age*1.3);g.scale(.48+.52*Math.abs(Math.cos(p.age*2+p.phase)),1);g.drawImage(this._petal(),-d/2,-d/2,d,d*1.25);g.restore();
  }
}
