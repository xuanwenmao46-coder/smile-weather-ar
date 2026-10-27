export const FIREWORK_STYLES=[
  {id:'chrysanthemum',name:'星芒盛放',color:0},
  {id:'willow',name:'金柳流瀑',color:0},
  {id:'rings',name:'双环星轨',color:1},
  {id:'peony',name:'五瓣花火',color:2},
  {id:'heart',name:'心形绽放',color:2},
];
export class FireworkBag{
  constructor(random=Math.random){this.random=random;this.bag=[];this.last=null;}
  next(){
    if(!this.bag.length){
      this.bag=[...FIREWORK_STYLES];
      for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
      if(this.bag[0].id===this.last)[this.bag[0],this.bag[1]]=[this.bag[1],this.bag[0]];
    }
    const style=this.bag.shift();this.last=style.id;return style;
  }
}
// Shape is encoded in initial velocities. All particles use the same live
// head collision, drag, palm steering and bounded pool after ignition.
export function shapeFirework(p,id,i,count,w,h,rotation=0){
  const a=i/count*Math.PI*2,speed=Math.hypot(p.vx,p.vy);
  if(id==='willow'){
    const fan=-Math.PI/2+Math.sin(a)*1.25;
    p.vx=Math.cos(fan)*speed*(.5+.5*(i%7)/6);p.vy=Math.sin(fan)*speed;
    p.gravity=h*.23;p.drag=.26;p.maxLife=p.life=3.1+(i%5)*.1;p.color=0;p.glint=i%9===0;
  }else if(id==='rings'){
    const r=i%2===0?1:.60,angle=a+rotation;
    p.vx=Math.cos(angle)*speed*r;p.vy=Math.sin(angle)*speed*r*.70;
    p.gravity=h*.023;p.drag=.55;p.color=i%2===0?1:3;
  }else if(id==='peony'){
    const r=.64+.36*Math.cos(a*5);
    p.vx=Math.cos(a+rotation)*speed*r;p.vy=Math.sin(a+rotation)*speed*r;
    p.drag=.48;p.gravity=h*.045;p.color=2;p.hero=i%8===0;
  }else if(id==='heart'){
    const x=16*Math.sin(a)**3,y=-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a));
    // Keep the heart upright; rotating this outline hides its recognition cue.
    p.vx=x/17*speed;p.vy=y/17*speed;p.gravity=h*.018;p.drag=.60;p.color=2;
  }
}
