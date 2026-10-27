// Input-independent gesture gating and rain field. All coordinates are canvas pixels.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function mapVideoPoint(p,{w,h,videoWidth,videoHeight}){
  if(!p||![p.x,p.y,w,h,videoWidth,videoHeight].every(Number.isFinite)||videoWidth<=0||videoHeight<=0)return null;
  const scale=Math.max(w/videoWidth,h/videoHeight);
  return {x:(1-p.x)*videoWidth*scale-(videoWidth*scale-w)/2,y:p.y*videoHeight*scale-(videoHeight*scale-h)/2};
}
export function openPalm(points,width=1,height=1){
  if(!points||points.length!==21||points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))return false;
  const dist=(i,j)=>Math.hypot((points[i].x-points[j].x)*width,(points[i].y-points[j].y)*height);
  const span=dist(5,17),palm=dist(0,9);
  if(span<width*.025||palm<height*.025)return false;
  let straight=0;
  for(const [tip,pip,mcp] of [[8,6,5],[12,10,9],[16,14,13],[20,18,17]]){
    const a={x:(points[mcp].x-points[pip].x)*width,y:(points[mcp].y-points[pip].y)*height};
    const b={x:(points[tip].x-points[pip].x)*width,y:(points[tip].y-points[pip].y)*height};
    const cosine=(a.x*b.x+a.y*b.y)/(Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y)||1);
    if(cosine<-.7&&dist(tip,0)>dist(pip,0)*1.12)straight++;
  }
  // Reject a very thin edge-on hand; this is geometry, not an emotion classifier.
  const cross=Math.abs((points[5].x-points[0].x)*(points[17].y-points[0].y)-(points[17].x-points[0].x)*(points[5].y-points[0].y))*width*height;
  return straight>=3&&cross/(span*palm)>.22;
}
export class PalmGate{
  constructor(){this.reset();}
  reset(){this.active=false;this.since=null;this.lastSeen=-Infinity;this.closedSince=null;this.x=0;this.y=0;this.lastSample=null;}
  update(sample,now){
    if(sample&&sample.open&&Number.isFinite(sample.x)&&Number.isFinite(sample.y)){
      const dt=this.lastSample===null?1:Math.max(0,(now-this.lastSample)/1000);
      this.lastSeen=now;this.lastSample=now;this.closedSince=null;
      if(this.since===null)this.since=now;
      if(now-this.since>=260)this.active=true;
      const k=1-Math.exp(-dt/.045);this.x+=(sample.x-this.x)*k;this.y+=(sample.y-this.y)*k;
    }else{
      this.since=null;
      if(sample){if(this.closedSince===null)this.closedSince=now;if(now-this.closedSince>160)this.active=false;}
      else if(now-this.lastSeen>350)this.active=false;
    }
    return {active:this.active,x:this.x,y:this.y};
  }
  value(now){if(now-this.lastSeen>450)this.active=false;return {active:this.active,x:this.x,y:this.y};}
}
export class RainField{
  constructor(){this.reset();}
  reset(){this.strength=0;this.meanStrength=0;this.active=false;this.serial=0;this.x=0;this.y=0;this.originX=0;this.originY=0;this.dx=0;this.dy=0;this.stepX=0;this.stepY=0;this.controlled=0;}
  update(dt,hand){
    const active=!!hand?.active&&Number.isFinite(hand.x)&&Number.isFinite(hand.y);
    this.stepX=this.stepY=0;
    if(active&&!this.active){this.serial++;this.originX=this.x=hand.x;this.originY=this.y=hand.y;this.dx=0;this.dy=0;}
    if(active){
      const k=1-Math.exp(-Math.max(0,dt)/.055),x=this.x+(hand.x-this.x)*k,y=this.y+(hand.y-this.y)*k;
      this.stepX=x-this.x;this.stepY=y-this.y;this.x=x;this.y=y;this.dx=x-this.originX;this.dy=y-this.originY;
    }
    this.active=active;
    const duration=Math.max(0,dt),rate=active?7:4.6,target=Number(active),decay=Math.exp(-duration*rate),previous=this.strength;
    this.strength=target+(previous-target)*decay;
    this.meanStrength=duration>0?target+(previous-target)*(1-decay)/(rate*duration):this.strength;
    if(this.strength<.002){this.strength=0;this.meanStrength=0;}
    this.controlled=0;
  }
  advance(p,dt,w,h){
    const strength=this.meanStrength;
    if(strength<.001){p.x+=p.vx*dt;p.y+=p.vy*dt;p.gripSerial=-1;return;}
    if(p.gripSerial!==this.serial){
      p.gripSerial=this.serial;p.gripX=p.x;p.gripY=p.y;
      const distance=Math.hypot((p.x-this.originX)/w,(p.y-this.originY)/h);
      const depth=[.85,1.2,1.5][p.depth]||.5;
      p.gripWeight=depth*(.58+.42*Math.exp(-distance*distance*2));
    }
    this.controlled++;
    // Preserve depth and spacing; no teleporting every droplet to the palm.
    // Incremental displacement, never a spring back to the original position.
    const dx=clamp(this.stepX,-w*2.2*dt,w*2.2*dt)*p.gripWeight*strength;
    const dy=clamp(this.stepY,-h*1.7*dt,h*1.7*dt)*p.gripWeight*strength;
    p.x+=dx+p.vx*dt*(1-strength);
    p.y+=dy+p.vy*dt*(1-strength);
    // The base particle integrator already deducted dt from life.
    p.life+=dt*strength;
  }
}
export class RainGarden{
  constructor(){this.reset();}
  reset(){this.age=0;this.level=0;this.water=0;this.progress=Array(6).fill(0);this.hits=Array(6).fill(0);}
  resetFlowers(){this.water=0;this.progress.fill(0);this.hits.fill(0);}
  update(dt,{raining=false,hold=0,intensity=.7}={}){
    if(raining)this.age+=dt*(1-clamp(hold,0,1));
    const target=raining?(.26+.74*(1-Math.exp(-this.age/3.4))):0;
    this.level+=(target-this.level)*(1-Math.exp(-dt*(raining?2.8:2.0)));
    if(raining)this.water+=dt*this.level*(1-clamp(hold,0,1))*clamp(intensity/.7,.4,1.3);
    const order=[.55,0,1.1,.83,.28,1.38];
    for(let i=0;i<6;i++){
      const raw=clamp((this.water+this.hits[i]-order[i])/2.7,0,1),targetOpen=raw*raw*(3-2*raw);
      this.progress[i]+=(Math.max(this.progress[i],targetOpen)-this.progress[i])*(1-Math.exp(-dt*3.6));
    }
  }
  hit(i,amount=.025){if(i>=0&&i<6)this.hits[i]=Math.min(.3,this.hits[i]+amount);}
}
