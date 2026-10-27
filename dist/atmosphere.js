// Cached light fields; composited over camera pixels without image upload.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Atmosphere {
  constructor(){
    this.textures=['112,205,255','255,188,112','238,151,209'].map(rgb=>{
      const c=document.createElement('canvas');c.width=c.height=192;
      const g=c.getContext('2d'),r=g.createRadialGradient(96,96,0,96,96,96);
      r.addColorStop(0,`rgba(${rgb},.9)`);r.addColorStop(.24,`rgba(${rgb},.58)`);
      r.addColorStop(.62,`rgba(${rgb},.16)`);r.addColorStop(1,`rgba(${rgb},0)`);
      g.fillStyle=r;g.fillRect(0,0,192,192);return c;
    });
    this.pulses=Array.from({length:6},()=>({life:0,x:0,y:0,major:false}));this.reset();
  }
  reset(){this.cool=0;this.warm=0;this.cursor=0;for(const p of this.pulses)p.life=0;}
  burst(x,y,major,reduced){if(reduced)return;const p=this.pulses[this.cursor++%6];Object.assign(p,{life:1.6,x,y,major});}
  update(dt,{head,mode,reduced=false,suspended=false}){
    if(!head||suspended){this.reset();return;}
    dt=clamp(Number(dt)||0,0,.05);const k=1-Math.exp(-dt*3.8);
    this.cool+=((mode==='rain'?1:0)-this.cool)*k;
    this.warm+=((mode==='bloom'?1:0)-this.warm)*k;
    for(const p of this.pulses)p.life=reduced?0:Math.max(0,p.life-dt);
  }
  spot(g,type,x,y,rx,ry,alpha){
    if(alpha<.001)return;
    g.globalAlpha=clamp(alpha,0,.48);g.drawImage(this.textures[type],x-rx,y-ry,rx*2,ry*2);
  }
  backdrop(g,w,h,a,now,reduced){
    if(!a)return;const cool=this.cool,warm=this.warm;if(cool+warm<.002)return;
    const sway=reduced?0:Math.sin(now*.00028)*w*.025;
    g.save();g.globalCompositeOperation='source-over';
    // Edge density leaves a clear opening around the face.
    g.globalAlpha=clamp(cool*.12+warm*.15,0,.2);g.fillStyle='#07152d';g.fillRect(0,0,w,h);
    g.globalCompositeOperation='screen';
    this.spot(g,0,w*.1+sway,h*.12,w*.85,h*.53,cool*.33);
    this.spot(g,0,w*.94,h*.68,w*.60,h*.52,cool*.19);
    this.spot(g,1,a.x-a.rx*1.3,a.y-a.ry*.95,w*.8,h*.55,warm*.35);
    this.spot(g,2,a.x+a.rx*1.5,a.y+a.ry*.55,w*.60,h*.48,warm*.25);
    g.restore();
  }
  foreground(g,w,h,a,hand,hold,contacts,reduced){
    if(!a)return;g.save();g.globalCompositeOperation='screen';
    // Broad cheek/temple spill follows the head; no hard face mask.
    this.spot(g,0,a.x-a.rx*.85,a.y-a.ry*.18,a.rx*.9,a.ry*1.2,this.cool*.14);
    this.spot(g,1,a.x+a.rx*.85,a.y-a.ry*.12,a.rx*.85,a.ry*1.1,this.warm*.16);
    if(hand?.active)this.spot(g,0,hand.x,hand.y,w*.32,h*.2,hold*.25);
    for(const p of this.pulses){
      if(p.life<=0)continue;const t=1-p.life/1.6;
      const energy=Math.sin(Math.PI*Math.min(1,t*2.5))*Math.exp(-t*3.3);
      const r=w*(p.major?.72:.45)*(1+t*.25);
      this.spot(g,1,p.x,p.y,r,r,energy*(p.major?.35:.20));
      this.spot(g,1,a.x+(p.x-a.x)*.65,a.y-a.ry*.22,a.rx*1.6,a.ry*1.1,energy*.10);
    }
    if(!reduced){let count=0;for(const c of contacts){
      if(c.life<=0||count++>=6)continue;
      this.spot(g,1,c.x,c.y,w*.085,w*.085,c.life/.45*.25);
    }}
    g.restore();
  }
}
