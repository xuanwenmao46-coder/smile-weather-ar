const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export class RainTear{
 constructor(){this.reset();}
 reset(){this.age=-1;this.since=99;this.quiet=2;this.armed=true;this.opacity=0;this.count=0;this.eye=null;this.mouth=null;}
 update(dt,{mode,head,suspended=false,reduced=false}){
  if(suspended)return false;
  if(!head){this.reset();return false;}
  dt=Math.min(.05,Math.max(0,Number(dt)||0));this.since+=dt;
  if(mode!=='rain'){this.quiet+=dt;if(this.quiet>=2)this.armed=true;}else this.quiet=0;
  let started=false;
  if(mode==='rain'&&this.armed&&this.since>=6){this.age=0;this.since=0;this.armed=false;this.count++;started=true;}
  if(this.age>=0)this.age+=dt;
  const roll=head.roll||0,x=-head.rx*.43,y=-head.ry*.19;
  const target=head.tearEye||{x:head.x+x*Math.cos(roll)-y*Math.sin(roll),y:head.y+x*Math.sin(roll)+y*Math.cos(roll)};
  if(!this.eye)this.eye={...target};else{const k=1-Math.exp(-dt*18);this.eye.x+=(target.x-this.eye.x)*k;this.eye.y+=(target.y-this.eye.y)*k;}
  const mx=-head.rx*.20,my=head.ry*.55;
  const mouth=head.tearMouth||{x:head.x+mx*Math.cos(roll)-my*Math.sin(roll),y:head.y+mx*Math.sin(roll)+my*Math.cos(roll)};
  if(!this.mouth)this.mouth={...mouth};else{const k=1-Math.exp(-dt*18);this.mouth.x+=(mouth.x-this.mouth.x)*k;this.mouth.y+=(mouth.y-this.mouth.y)*k;}
  this.opacity=this.age<0?0:smooth(this.age/.22)*(1-smooth((this.age-2.7)/.65));
  if(mode!=='rain')this.opacity*=Math.exp(-this.quiet*10);
  return started;
 }
 position(head,u=smooth((this.age-.18)/3.05)){
  const roll=head.roll||0,c=Math.cos(roll),s=Math.sin(roll),dx=this.mouth.x-this.eye.x,dy=this.mouth.y-this.eye.y;
  const ex=(dx*c+dy*s)*.88,ey=Math.max(head.ry*.22,(-dx*s+dy*c)*.94);
  const side=((this.eye.x-head.x)*c+(this.eye.y-head.y)*s)<=0?-1:1;
  // Move along the face-local outward axis, including mirrored and tilted faces.
  return {x:ex*(.2*u+.8*u*u)+side*head.rx*(.045+.065*Math.sin(Math.PI*u/2)),y:ey*u,u};
 }
 draw(g,w,h,head,reduced=false,background=null,mirror=false){
  if(this.opacity<.001||!this.eye||!this.mouth||!head)return;
  const tip=this.position(head),r=Math.max(1.6,w*.0039),points=[];
  for(let i=0;i<=24;i++){const u=tip.u*i/24,p=this.position(head,u),width=r*(.17+.22*Math.sin(i*2.4)**2+.25*i/24);points.push({...p,width});}
  g.save();g.translate(this.eye.x,this.eye.y);g.rotate(head.roll||0);g.globalCompositeOperation='source-over';
  // Irregular transparent wet film follows the cheek; skin remains visible.
  g.beginPath();for(let i=0;i<points.length;i++){const p=points[i];if(i===0)g.moveTo(p.x-p.width,p.y);else g.lineTo(p.x-p.width,p.y);}
  for(let i=points.length-1;i>=0;i--){const p=points[i];g.lineTo(p.x+p.width,p.y);}g.closePath();
  const sw=background?.videoWidth||background?.naturalWidth||background?.width,sh=background?.videoHeight||background?.naturalHeight||background?.height;
  if(sw&&sh){
   g.save();g.clip();g.globalAlpha=this.opacity*.6;g.rotate(-(head.roll||0));g.translate(-this.eye.x,-this.eye.y);
   const scale=Math.max(w/sw,h/sh),dw=sw*scale,dh=sh*scale;
   if(mirror){g.translate(w,0);g.scale(-1,1);}
   g.drawImage(background,(w-dw)/2+w*.0015,(h-dh)*(mirror?.5:.4)+h*.0012,dw,dh);g.restore();
  }
  g.globalAlpha=this.opacity*.10;g.fillStyle='#b1c6cb';g.fill();
  for(let i=2;i<points.length;i++){
   if(i%4===0)continue;const a=points[i-1],b=points[i];g.globalAlpha=this.opacity*(.035+.115*Math.sin(i*1.63)**2)*(1-.4*i/24);
   g.strokeStyle=i%3===0?'#718a98':'#edf7fa';g.lineWidth=Math.max(.45,w*.00085);g.lineCap='round';
   g.beginPath();g.moveTo(a.x+a.width*.45,a.y);g.lineTo(b.x+b.width*.7,b.y);g.stroke();
  }
  // A small flattened leading bead with an incomplete highlight, no outline.
  g.translate(tip.x,tip.y);g.globalAlpha=this.opacity*.24;g.fillStyle='#7194a0';
  g.beginPath();g.ellipse(0,0,r*.75,r*1.6,-.10,0,Math.PI*2);g.fill();
  g.globalAlpha=this.opacity*.68;g.strokeStyle='#f3fafc';g.lineWidth=Math.max(.6,w*.001);
  g.beginPath();g.ellipse(-r*.14,r*.1,r*.50,r*1.22,-.15,Math.PI*.9,Math.PI*1.62);g.stroke();
  g.restore();
 }
}
