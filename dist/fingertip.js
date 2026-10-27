const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const rippleRadius=(seconds,w)=>w*(.018+.27*(1-Math.exp(-Math.max(0,seconds)*2.4)));
// Index-only pose avoids accidental ignition while using the open-palm control.
export function pointingIndex(points,width=1,height=1){
  if(!points||points.length!==21||points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))return false;
  const distance=(a,b)=>Math.hypot((points[a].x-points[b].x)*width,(points[a].y-points[b].y)*height);
  if(distance(0,9)<height*.025||distance(5,17)<width*.025)return false;
  const extended=(tip,pip,mcp)=>{
    const ax=(points[mcp].x-points[pip].x)*width,ay=(points[mcp].y-points[pip].y)*height;
    const bx=(points[tip].x-points[pip].x)*width,by=(points[tip].y-points[pip].y)*height;
    return (ax*bx+ay*by)/(Math.hypot(ax,ay)*Math.hypot(bx,by)||1)<-.72&&distance(tip,0)>distance(pip,0)*1.12;
  };
  return extended(8,6,5)&&[[12,10,9],[16,14,13],[20,18,17]].filter(f=>!extended(...f)).length>=2;
}
export class Fingertip {
  constructor(){this.rings=Array.from({length:6},()=>({at:-Infinity,x:0,y:0}));this.reset();}
  reset(){this.since=null;this.anchor=null;this.last=null;this.lastSeen=-Infinity;this.fired=-Infinity;this.armed=true;this.progress=0;this.mode='still';this.count=0;this.cursor=0;for(const r of this.rings)r.at=-Infinity;}
  update(now,finger,mode,w,h){
    if(mode!==this.mode){this.since=null;this.armed=true;this.progress=0;this.mode=mode;}
    const valid=finger?.active&&[finger.x,finger.y].every(Number.isFinite)&&finger.x>=0&&finger.x<=w&&finger.y>=0&&finger.y<=h&&(mode==='rain'||mode==='bloom');
    if(!valid){this.since=null;this.progress=0;this.last=null;if(now-this.lastSeen>180)this.armed=true;return null;}
    this.lastSeen=now;this.last={x:finger.x,y:finger.y};
    if(!this.armed&&this.anchor&&Math.hypot(finger.x-this.anchor.x,finger.y-this.anchor.y)>w*.11){this.armed=true;this.since=null;}
    if(this.since===null||!this.anchor||Math.hypot(finger.x-this.anchor.x,finger.y-this.anchor.y)>w*.055){this.since=now;this.anchor={...this.last};}
    const cooldown=mode==='rain'?900:1500;
    if(!this.armed||now-this.fired<cooldown){this.progress=0;return null;}
    this.progress=clamp((now-this.since)/360,0,1);
    if(this.progress<1)return null;
    this.armed=false;this.fired=now;this.progress=0;this.count++;
    const hit={...this.last,kind:mode==='rain'?'ripple':'spark'};
    Object.assign(this.rings[this.cursor++%6],{x:hit.x,y:hit.y,at:now,kind:hit.kind});
    return hit;
  }
  prepare(){
    if(this.waterTextures)return;
    this.waterTextures=['light','shadow','drop'].map(kind=>{
      const c=document.createElement('canvas');c.width=c.height=192;const g=c.getContext('2d');
      const grad=g.createRadialGradient(96,96,0,96,96,96);
      if(kind==='drop'){
        grad.addColorStop(0,'rgba(245,255,255,.85)');grad.addColorStop(.18,'rgba(185,235,245,.3)');grad.addColorStop(1,'rgba(180,235,245,0)');
      }else{
        const rgb=kind==='light'?'195,239,247':'25,60,78';
        grad.addColorStop(0,`rgba(${rgb},0)`);grad.addColorStop(.61,`rgba(${rgb},0)`);
        grad.addColorStop(.73,`rgba(${rgb},.10)`);grad.addColorStop(.80,`rgba(${rgb},.65)`);
        grad.addColorStop(.87,`rgba(${rgb},.07)`);grad.addColorStop(1,`rgba(${rgb},0)`);
      }
      g.fillStyle=grad;g.fillRect(0,0,192,192);return c;
    });
  }
  disturb(p,dt,w,now){
    for(const r of this.rings){
      const age=(now-r.at)/1000;if(age<0||age>1.8)continue;
      const dx=p.x-r.x,dy=(p.y-r.y)/.64,d=Math.hypot(dx,dy);if(d<1)continue;
      const crest=rippleRadius(age,w)*.8,width=w*.027;
      const influence=Math.exp(-(((d-crest)/width)**2))*(1-age/1.8);
      const push=w*.12*dt*influence*(p.depth===0?.45:1);
      p.x+=dx/d*push;p.y+=dy/d*push*.22;
    }
  }
  refract(g,w,h,r,radius,alpha,background,mirror){
    const sw=background?.videoWidth||background?.naturalWidth,sh=background?.videoHeight||background?.naturalHeight;
    if(!sw||!sh||background.readyState<2)return;
    const scale=Math.max(w/sw,h/sh),dw=sw*scale,dh=sh*scale;
    g.save();g.globalCompositeOperation='source-over';g.globalAlpha=alpha*.18;
    g.beginPath();g.ellipse(r.x,r.y,radius*.86,radius*.86*.64,-.08,0,Math.PI*2);
    g.ellipse(r.x,r.y,radius*.72,radius*.72*.64,-.08,0,Math.PI*2,true);g.clip('evenodd');
    g.translate(r.x,r.y);g.scale(1.018,1.012);g.translate(-r.x,-r.y);
    if(mirror){g.translate(w,0);g.scale(-1,1);}
    g.filter=mirror?'saturate(.95)':'brightness(.94) saturate(.8)';
    g.drawImage(background,(w-dw)/2,(h-dh)*(mirror?.5:.4),dw,dh);g.restore();
  }
  draw(g,w,h,now,reduced,background=null,mirror=false){
    if(!this.last&&!this.rings.some(r=>now-r.at<1800))return;
    this.prepare();g.save();g.lineCap='round';let refracted=0;
    for(const r of this.rings){
      const seconds=(now-r.at)/1000;if(seconds<0||seconds>1.8)continue;
      const fade=(1-seconds/1.8)**1.8,radius=reduced?w*.07:rippleRadius(seconds,w);
      if(r.kind==='spark'){
        g.save();g.globalCompositeOperation='screen';g.translate(r.x,r.y);
        g.strokeStyle='#ffe3b4';g.lineWidth=w*.0012;g.globalAlpha=fade*.6;
        for(let j=0;j<2;j++){g.beginPath();g.ellipse(0,0,w*(.025+seconds*.13)*(1-j*.16),w*(.01+seconds*.045)*(1-j*.16),-.3+seconds*.5+j*.8,0,Math.PI*2);g.stroke();}
        g.restore();continue;
      }

      if(!reduced&&refracted++<2)this.refract(g,w,h,r,radius,fade,background,mirror);
      for(let i=0;i<(reduced?1:3);i++){
        const age=seconds-i*.17;if(age<0)continue;
        const rr=reduced?radius:rippleRadius(age,w),alpha=fade*(i===0?.62:.26);
        g.save();g.translate(r.x,r.y);g.rotate(-.08);
        // Broad shade and a shifted soft crest read as a water surface, not a wire.
        g.globalCompositeOperation='multiply';g.globalAlpha=alpha*.45;
        g.drawImage(this.waterTextures[1],-rr,-rr*.64+w*.003,rr*2,rr*1.28);
        g.globalCompositeOperation='screen';g.globalAlpha=alpha;
        g.drawImage(this.waterTextures[0],-rr,-rr*.64-w*.003,rr*2,rr*1.28);g.restore();
      }
      if(seconds<.42){
        g.globalCompositeOperation='screen';g.globalAlpha=(1-seconds/.42)*.55;
        const size=w*(.04+seconds*.035);g.drawImage(this.waterTextures[2],r.x-size,r.y-size,size*2,size*2);
        if(!reduced)for(let j=0;j<5;j++){
          const a=j*2.4,rr=w*.12*seconds,x=r.x+Math.cos(a)*rr,y=r.y+Math.sin(a)*rr*.55-w*.10*seconds+w*.25*seconds*seconds;
          g.drawImage(this.waterTextures[2],x-w*.01,y-w*.014,w*.02,w*.028);
        }
      }
    }
    g.globalCompositeOperation='screen';
    if(this.last){
      const {x,y}=this.last,r=w*.024;
      g.globalAlpha=.48;g.strokeStyle=this.mode==='bloom'?'#ffe1a1':'#c4ffff';g.lineWidth=w*.0018;
      g.beginPath();g.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(.04,this.progress));g.stroke();
      g.globalAlpha=.9;g.fillStyle=g.strokeStyle;g.beginPath();g.arc(x,y,w*.0045,0,Math.PI*2);g.fill();
    }
    g.restore();
  }
}
