export class InteractionAudio{
 constructor(){this.enabled=true;this.ctx=null;this.lastBurst=-10;this.water=null;}
 async unlock(){
  try{
   this.ctx??=new (window.AudioContext||window.webkitAudioContext)();await this.ctx.resume();
   if(!this.loading){this.loading=fetch(new URL('./assets/water-touch.mp3',import.meta.url)).then(r=>r.arrayBuffer()).then(b=>this.ctx.decodeAudioData(b)).then(b=>this.water=b).catch(()=>{});}
   if(this.media&&!this.mediaSource){
    this.mediaSource=this.ctx.createMediaElementSource(this.media);this.meter=this.ctx.createAnalyser();this.meter.fftSize=256;
    this.mediaSource.connect(this.meter);this.meter.connect(this.ctx.destination);this.samples=new Uint8Array(256);
   }
   return this.ctx.state==='running';
  }catch{return false;}
 }
 level(){if(!this.meter)return 0;this.meter.getByteTimeDomainData(this.samples);return Math.sqrt(this.samples.reduce((sum,v)=>sum+((v-128)/128)**2,0)/this.samples.length);}
 tone(freq,at,duration,gain,type='sine',end=freq){
  const c=this.ctx,o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);
  v.gain.setValueAtTime(.0001,at);v.gain.exponentialRampToValueAtTime(gain,at+.009);v.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(v);v.connect(c.destination);o.start(at);o.stop(at+duration+.02);
 }
 play(kind,major=false){
  const c=this.ctx;if(!this.enabled||!c||c.state!=='running')return;
  const t=c.currentTime;
  if(kind==='rain-start'){
   if(this.water){const s=c.createBufferSource(),v=c.createGain();s.buffer=this.water;v.gain.value=.18;s.connect(v);v.connect(c.destination);s.start();}
   this.tone(740,t,.45,.018,'sine',620);
  }else if(kind==='ripple'){
   if(this.water){const s=c.createBufferSource(),v=c.createGain();s.buffer=this.water;v.gain.value=.30;s.connect(v);v.connect(c.destination);s.start();}
   this.tone(720,t,.42,.032,'sine',420);this.tone(1108.7,t+.10,.65,.012);
  }else if(kind==='spark'){
   this.tone(440,t,.22,.024,'sine',880);[659.25,880].forEach((f,i)=>this.tone(f,t+.18+i*.07,.50,.018));
  }else if(kind==='burst'&&t-this.lastBurst>.22){
   this.lastBurst=t;this.tone(135,t,.38,major?.095:.045,'sine',48);
   [659.25,880,1318.5].forEach((f,i)=>this.tone(f,t+i*.035,.65,.014,'sine',f*.7));
  }else if(kind==='test'){this.tone(660,t,.25,.12);this.tone(880,t+.3,.35,.10);}
 }
}
