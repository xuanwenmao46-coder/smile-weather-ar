const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export class RainbowEnding{
 constructor(){this.reset();}
 reset(){this.armed=false;this.age=-1;this.alpha=0;}
 update(dt,{mode,rainCount,head=true,suspended=false}){
  if(!head){this.reset();return;}if(suspended)return;
  if(mode==='rain'){this.armed=true;this.age=-1;this.alpha=0;return;}
  if(this.armed&&mode==='still'&&rainCount===0&&this.age<0){this.age=0;this.armed=false;}
  if(this.age>=0){this.age+=dt;this.alpha=smooth(this.age/1.25)*(1-smooth((this.age-4.5)/1.5));}
 }
 draw(g,w,h,reduced=false){
  if(this.alpha<.001)return;
  g.save();g.globalCompositeOperation='screen';
  // A photographic spectral fringe, with gaps and feathered ends.
  const colors=['#f0b9aa','#f3dfc4','#a9d3d7'];
  g.filter='blur('+w*.013+'px)';g.lineWidth=w*.025;g.lineCap='round';
  for(let side=0;side<2;side++)for(let i=0;i<3;i++){
   const r=w*(.76-i*.012),x=w*(side?.38:.62),y=h*.53;
   g.strokeStyle=colors[i];g.globalAlpha=this.alpha*.24;
   g.beginPath();g.ellipse(x,y,r,r*.94,side?.08:-.10,Math.PI*(side?1.60:1.12),Math.PI*(side?1.90:1.43));g.stroke();
  }
  g.restore();
 }
}
