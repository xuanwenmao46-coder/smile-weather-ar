const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
// Laugh duration and particles actually emitted earn the garden's density.
// A quiet grace period absorbs brief speech breaks; pause never advances it.
export class BloomGrowth{
  constructor(){this.order=[0,3,1,4,2,5,6,9,8,11,12,15,7,10,13,16,14,17,18,19,20,21,22,23];this.progress=Array(24).fill(0);this.reset();}
  reset(){this.level=0;this.unlocked=false;this.quiet=0;this.laughSeconds=0;this.bursts=0;this.progress.fill(0);}
  burst(emitted){if(emitted<=0)return;this.unlocked=true;this.bursts++;this.level=clamp(this.level+Math.min(.055,emitted/110*.045),0,1);}
  update(dt,{laughing=false,smiling=false,head=true,suspended=false}={}){
    if(!head){this.reset();return;}if(suspended)return;
    dt=clamp(Number(dt)||0,0,.05);
    if(laughing)this.unlocked=true;
    if(laughing||(smiling&&this.unlocked)){this.quiet=0;if(laughing)this.laughSeconds+=dt;this.level=clamp(this.level+dt*(laughing?.09:.025),0,1);}
    else{this.quiet+=dt;if(this.quiet>2.2)this.level=Math.max(0,this.level-dt*.16);}
    for(let rank=0;rank<this.order.length;rank++){
      const index=this.order[rank],target=smooth((this.level-(.01+rank*.025))/.16);
      const rate=target>this.progress[index]?4.2:2.5;
      this.progress[index]+=(target-this.progress[index])*(1-Math.exp(-dt*rate));
      if(this.progress[index]<.0001)this.progress[index]=0;
    }
  }
}
