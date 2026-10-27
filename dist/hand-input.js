import {pointingIndex} from './fingertip.js?v=16';
import {PalmGate,openPalm,mapVideoPoint} from './rain-control.js?v=9';
export class HandInput{
  constructor({video,geometry,onStatus}){this.video=video;this.geometry=geometry;this.onStatus=onStatus;this.finger=null;this.gate=new PalmGate();this.serial=0;this.worker=null;this.ready=false;this.busy=false;this.lastFrame=-Infinity;this.lastVideo=-1;this.lateFrames=0;this.fail=false;}
  start(){
    this.stop();this.fail=false;
    if(typeof Worker==='undefined'||typeof createImageBitmap==='undefined'){this.onStatus('本浏览器暂不支持手势控雨；表情特效仍可用');return;}
    const serial=this.serial;
    try{
      const worker=this.worker=new Worker(new URL('./hand-worker.js?v=8',import.meta.url));
      this.onStatus('手势模型加载中 · 表情特效可以继续使用');
      this.loadTimer=setTimeout(()=>{if(serial===this.serial)this.error('手势模型加载超时');},25000);
      worker.onmessage=({data})=>{
        if(serial!==this.serial)return;
        if(data.type==='ready'){clearTimeout(this.loadTimer);this.ready=true;this.onStatus('张掌控雨 · 单指停留触发水波或花火');}
        else if(data.type==='result'){
          this.busy=false;clearTimeout(this.frameTimer);
          const now=performance.now();
          if(now-data.now>350){this.finger=null;this.gate.update(null,now);if(++this.lateFrames>=5)this.error('手势识别延迟过高，已释放控雨');return;}
          this.lateFrames=0;
          const points=data.points,g=this.geometry(),v=this.video;
          const captured=this.captureGeometry;
          if(!captured||captured.w!==g.w||captured.h!==g.h||captured.videoWidth!==v.videoWidth||captured.videoHeight!==v.videoHeight){this.finger=null;this.gate.reset();return;}
          let sample=null;this.finger=null;
          if(points){
            if(pointingIndex(points,v.videoWidth,v.videoHeight)){const tip=mapVideoPoint(points[8],{...g,videoWidth:v.videoWidth,videoHeight:v.videoHeight});if(tip)this.finger={active:true,...tip,at:data.now};}
            const ids=[0,5,9,13,17],x=ids.reduce((s,i)=>s+points[i].x,0)/5,y=ids.reduce((s,i)=>s+points[i].y,0)/5;
            const mapped=mapVideoPoint({x,y},{...g,videoWidth:v.videoWidth,videoHeight:v.videoHeight});
            sample=mapped?{open:openPalm(points,v.videoWidth,v.videoHeight),...mapped}:null;
            if(!sample){this.gate.update(null,now);return;}
            if(sample.x<0||sample.x>g.w||sample.y<0||sample.y>g.h)sample.open=false;
          }
          this.gate.update(sample,data.now);
        }else if(data.type==='error')this.error('手部识别暂不可用');
      };
      worker.onerror=()=>{if(serial===this.serial)this.error('手部识别未启动');};
      worker.postMessage({type:'init'});
    }catch{this.error('当前浏览器无法启动手部识别');}
  }
  error(message){this.stop();this.fail=true;this.onStatus(message+' · 雨和烟花仍可使用');}
  tick(now,enabled){
    if(!enabled){this.finger=null;this.gate.reset();return null;}
    if(this.ready&&!this.busy&&now-this.lastFrame>125&&this.video.readyState>=2&&this.video.currentTime!==this.lastVideo){
      this.busy=true;this.lastFrame=now;this.lastVideo=this.video.currentTime;
      this.captureGeometry={...this.geometry(),videoWidth:this.video.videoWidth,videoHeight:this.video.videoHeight};
      const serial=this.serial,worker=this.worker;
      createImageBitmap(this.video,{resizeWidth:320,resizeHeight:Math.max(1,Math.round(320*this.video.videoHeight/this.video.videoWidth))}).then(bitmap=>{
        if(serial!==this.serial||!this.ready){bitmap.close();return;}
        worker.postMessage({type:'frame',bitmap,now},[bitmap]);
        this.frameTimer=setTimeout(()=>{if(serial===this.serial)this.error('手部识别响应超时');},6000);
      }).catch(()=>{if(serial===this.serial)this.error('无法读取手势画面');});
    }
    return {...this.gate.value(now),finger:this.finger&&now-this.finger.at<300?this.finger:null};
  }
  stop(){this.serial++;clearTimeout(this.loadTimer);clearTimeout(this.frameTimer);this.worker?.terminate();this.worker=null;this.ready=false;this.busy=false;this.lastFrame=-Infinity;this.lastVideo=-1;this.lateFrames=0;this.finger=null;this.gate.reset();}
}
