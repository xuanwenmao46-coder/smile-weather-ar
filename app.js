import {InteractionAudio} from './interaction-audio.js?v=24';
import {giftFrame,GIFT_LAUNCHES,GIFT_DURATION} from './gift-timeline.js?v=24';
// Smile Together — expression-driven rain and fireworks. Social actions are simulated.
import { GardenEffects } from './garden-effects.js?v=24';
import {HandInput} from './hand-input.js?v=16';
import {mapVideoPoint,PalmGate} from './rain-control.js?v=11';
const $=id=>document.getElementById(id), stage=$('stage'), video=$('video'), canvas=$('canvas'), ctx=canvas.getContext('2d');
const themes={aurora:{bg:['#c4cce5','#e6ded2','#bed8ce'],ink:'#56627e',rain:'#788eb3',light:['#fff5cc','#d5d1ff','#a4e1dc','#f3bbbd']},sunset:{bg:['#cbb7d6','#f0d0b9','#e1b4aa'],ink:'#806570',rain:'#bd899c',light:['#fff0b0','#f6bab5','#e1c5f4','#fff4e5']},night:{bg:['#172b43','#40516f','#385d69'],ink:'#b8c9df',rain:'#c2f5ff',light:['#fff1ab','#ff80c3','#63f8ed','#c9a3ff']}};
const frameCosts=new Float32Array(120),frameTimes=new Float32Array(120);let perfIndex=0,perfCount=0;
let artStyle='opal',previewStart=0,lastHud=0,lastCameraFrame=0,cameraStalled=false;
let activeReply=null,replyStart=0,replyFireAt=0,replyPhase='';
let theme=themes.night, themeName='night', W=800,H=606,mode='still',source='preview',detector=null,modelPromise=null,stream=null,epoch=0,starting=false,paused=false,last=performance.now(),lastInfer=0,lastVideo=-1,lastFace=0,lastBurst=-9000,smile=0,jaw=0,baseline=0,calibrating=false,calSamples=[],calStart=0,candidate='',candidateSince=0,head=null,previousHead=null,velocity={x:0,y:0},pointer={x:.52,y:.55},intensity=.7,rainCarry=0,quality=1,slowFrames=0,startedAt=performance.now(),noticeTimer;
const effects = new GardenEffects({canvas,ctx});
const interactionAudio=new InteractionAudio();
document.addEventListener('pointerdown',()=>interactionAudio.unlock(),{capture:true});
$('interaction-sound').onchange=e=>interactionAudio.enabled=e.target.checked;
$('audio-test').onclick=async()=>{const ok=await interactionAudio.unlock();interactionAudio.play('test');musicState(ok?'测试音已输出：两声电子音。若仍无声，请检查浏览器标签页和系统音量。':'浏览器未允许音频，请直接打开音频试听。');};
effects.onSound=(kind,major)=>{if(!effectPaused)interactionAudio.play(kind,major);};
const giftAudio=$('gift-score');interactionAudio.media=giftAudio;giftAudio.volume=.80;let previewEpoch=0,previewStarting=false,giftSoundClock=false,giftCue=0,giftPhase='',liveMusicMode=false;
function syncLiveMusic(next){
 if(!$('gift-sound').checked)return;
 if(!giftAudio.paused)return;
 if(next==='still')return;
 giftAudio.loop=false;giftAudio.currentTime=0;giftAudio.muted=false;
 giftAudio.play().catch(()=>musicState('点击播放器开启配乐'));
}
// Let the recorded phrase finish; frequent expression changes must not scrub piano notes.
giftAudio.ontimeupdate=()=>{};
function musicState(text){$('music-status').textContent=text;}
$('gift-sound').onchange=()=>{giftAudio.muted=!$('gift-sound').checked;musicState(giftAudio.muted?'音乐已静音':'音乐已开启');};
$('gift-volume').oninput=e=>{giftAudio.volume=Number(e.target.value)/100;};
$('music-preview').onclick=async()=>{
 if(previewStart||previewStarting){musicState('音乐与礼物短片同步播放中');return;}
 liveMusicMode=false;
 if(!giftAudio.paused){giftAudio.pause();return;}
 giftAudio.loop=false;giftAudio.currentTime=0;giftAudio.muted=false;$('gift-sound').checked=true;
 if(giftAudio.volume===0){giftAudio.volume=.8;$('gift-volume').value=80;}
 try{await giftAudio.play();}catch{musicState('未能播放，请点下方音频链接试听');}
};
giftAudio.onplaying=()=>{interactionAudio.unlock();musicState('♫ 配乐播放中 · 下方电平显示实际音频信号');$('music-preview').textContent='Ⅱ 暂停 BGM';};
giftAudio.onpause=()=>{musicState('音乐已暂停');$('music-preview').textContent='♪ 单独试听钢琴 BGM';};
giftAudio.onerror=()=>musicState('音频加载失败，请刷新后重试');
giftAudio.onended=()=>{if(previewStart){stopPreview();clearParticles();setMode('still');}musicState('配乐试听结束');$('music-preview').textContent='♪ 重听完整配乐';};
let simHand=false,simHandStart=0,simPalm={x:.72,y:.45},currentHand=null;const simGate=new PalmGate();let simFinger=null;
const hands=new HandInput({video,geometry:()=>({w:W,h:H}),onStatus:text=>$('hand-status').textContent=text});
function releaseHand(){simFinger=null;hands.finger=null;simHand=false;currentHand=null;simGate.reset();hands.gate.reset();$('simulate-hand').setAttribute('aria-pressed','false');$('simulate-hand').textContent='模拟伸掌 · 悬停雨滴';}
$('simulate-hand').onclick=()=>{
 if(source==='camera'){notify('真人模式请直接伸出张开的手掌。');return;}
 if(effectPaused){notify('请先恢复特效。');return;}
 const wasHand=simHand;stopPreview();simHand=!wasHand;if(simHand){simHandStart=performance.now();simGate.reset();setMode('rain');stage.scrollIntoView({block:'center',behavior:'auto'});stage.focus({preventScroll:true});}
 $('simulate-hand').setAttribute('aria-pressed',String(simHand));$('simulate-hand').textContent=simHand?'松手 · 恢复落雨':'模拟伸掌 · 悬停雨滴';
};
function previewFinger(x=.72,y=.63){
 if(source!=='preview'||effectPaused)return;
 if(!$('finger-enabled').checked){notify('请先开启指尖互动。');return;}
 if(mode==='still')setMode('rain');
 simFinger={active:true,x,y,until:performance.now()+900};
}
$('simulate-finger').onclick=()=>{
 if(source==='camera'){notify('请伸出食指，在画面中停留片刻。');return;}
 stopPreview();previewFinger();stage.scrollIntoView({block:'center',behavior:'auto'});stage.focus({preventScroll:true});
};
$('finger-enabled').onchange=()=>{simFinger=null;hands.finger=null;effects.fingertip.reset();};
stage.addEventListener('pointerdown',e=>{
 if(source!=='preview'||simHand||e.target!==canvas)return;
 const r=stage.getBoundingClientRect();previewFinger((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
});
stage.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&source==='preview'&&!simHand){e.preventDefault();previewFinger();}});
stage.addEventListener('pointermove',e=>{if(!simHand||source!=='preview')return;const r=stage.getBoundingClientRect();simPalm={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};});
stage.addEventListener('pointerdown',e=>{if(simHand&&source==='preview'&&e.target===canvas){stage.setPointerCapture?.(e.pointerId);e.preventDefault();}});
stage.addEventListener('keydown',e=>{
 if(source!=='preview'||!simHand)return;
 if(e.key==='Escape'){releaseHand();return;}
 const keys={ArrowLeft:[-.035,0],ArrowRight:[.035,0],ArrowUp:[0,-.035],ArrowDown:[0,.035]};
 if(keys[e.key]){e.preventDefault();simPalm={x:Math.max(0,Math.min(1,simPalm.x+keys[e.key][0])),y:Math.max(0,Math.min(1,simPalm.y+keys[e.key][1]))};}
});
$('replay-flowers').onclick=()=>{effects.replayFlowers();if(source==='preview'){stopPreview();setMode('still');lastBurst=-9000;setMode('bloom');}stage.scrollIntoView({block:'center',behavior:'auto'});};
function updateFlowerSwitch(){
 const on=$('flowers-enabled').checked;
 $('flower-toggle').setAttribute('aria-pressed',String(on));$('flower-toggle').textContent=on?'花园已开启 · 点击隐藏':'纯花火 · 点击显示花园';
}
$('flower-toggle').onclick=()=>{$('flowers-enabled').checked=!$('flowers-enabled').checked;updateFlowerSwitch();};
$('flowers-enabled').onchange=updateFlowerSwitch;updateFlowerSwitch();
$('hand-enabled').onchange=()=>{releaseHand();if(source==='camera'&&$('hand-enabled').checked)hands.start();else{hands.stop();$('hand-status').textContent='手势控雨已关闭';}};

$('reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;const savedBloom={...effects.bloomGrowth,progress:[...effects.bloomGrowth.progress]};W=Math.min(1000,Math.max(480,Math.round(r.width* Math.min(devicePixelRatio,1.4))));H=Math.round(W*r.height/r.width);canvas.width=W;canvas.height=H;effects.resize(W,H);clearParticles();Object.assign(effects.bloomGrowth,{level:savedBloom.level,quiet:savedBloom.quiet,laughSeconds:savedBloom.laughSeconds,bursts:savedBloom.bursts,unlocked:savedBloom.unlocked});effects.bloomGrowth.progress.splice(0,effects.bloomGrowth.progress.length,...savedBloom.progress);if(activeReply&&replyFireAt)endReply();head=null;previousHead=null;}
new ResizeObserver(resize).observe(stage);
function clearParticles(){effects.clear();releaseHand();}
function notify(message){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,7000);}
function setMode(next){if(effectPaused&&next!=='still')return;if(mode===next)return;mode=next;if(liveMusicMode&&!previewStart&&!calibrating&&!starting)syncLiveMusic(next);stage.dataset.moment=next;const copy={still:['A GARDEN, WAITING FOR YOU','微笑下雨，大笑放烟花。','微笑落雨 · 大笑花火'],rain:['01 / RAIN INTO BLOOM','微笑，屏幕下起细雨。','雨滴覆盖画面，保留面部清晰。'],bloom:['02 / LET JOY TAKE FLIGHT','大笑，烟花为你绽放。','晃动头部，看粒子碰撞后弹开。']}[next];$('chapter').textContent=copy[0];$('weather-title').textContent=copy[1];$('weather-subtitle').textContent=copy[2];document.querySelectorAll('[data-moment]').forEach(b=>{b.classList.toggle('selected',b.dataset.moment===next);b.setAttribute('aria-pressed',b.dataset.moment===next);});if(activeReply&&next==='rain'&&!replyFireAt)sendReplyPhase('rain');if(next==='bloom'&&head)fireworks(performance.now());}
function sendReplyPhase(phase){
 if(!activeReply||replyPhase===phase)return;replyPhase=phase;
 window.dispatchEvent(new CustomEvent('live-reply-phase',{detail:{phase,name:activeReply.name}}));
}
function endReply(){activeReply=null;replyFireAt=0;replyPhase='';window.dispatchEvent(new CustomEvent('live-reply-clear'));}
window.addEventListener('live-reply-selected',e=>{
 stopPreview();clearParticles();setMode('still');activeReply=e.detail;replyStart=performance.now();replyFireAt=0;replyPhase='';lastBurst=-9000;sendReplyPhase('ready');
});
window.addEventListener('live-reply-cancel',()=>{endReply();stopPreview();clearParticles();setMode('still');});
function fireworks(t){
 if(effectPaused||!head||t-lastBurst<1800||(activeReply&&replyFireAt))return;
 let origin;
 if(activeReply){const r=$('stage').getBoundingClientRect(),dot=$('reply-origin').getBoundingClientRect();origin={x:(dot.left+dot.width/2-r.left)/r.width*W,y:(dot.top+dot.height/2-r.top)/r.height*H};}
 if(effects.launch(head,t,{reduced:$('reduced').checked,intensity,quality,origin})){
  lastBurst=t;if(activeReply){replyFireAt=t;sendReplyPhase('launch');}
 }
}
function ellipse(g,x,y,rx,ry,rotation=0){g.beginPath();g.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);}
function setArt(name){
 artStyle=name;effects.setStyle(name);lastBurst=-9000;setMode('still');stage.dataset.art=name;
 if(activeReply){replyFireAt=0;replyStart=performance.now();replyPhase='';sendReplyPhase('ready');}if(previewStart)previewStart=performance.now();
}
function stopPreview(){
 previewEpoch++;liveMusicMode=false;previewStarting=false;previewStart=0;giftCue=0;giftPhase='';giftSoundClock=false;
 giftAudio.pause();giftAudio.currentTime=0;releaseHand();canvas.style.opacity='';delete stage.dataset.giftPhase;
 $('gift-progress').value=0;$('gift-beat').textContent='停雨抓眼 → 音乐蓄势 → 花火绽放 → 雨尽见彩虹';
 $('preview-sequence').textContent='播放 16 秒礼物短片 ♪';$('preview-sequence').removeAttribute('aria-busy');
 if(source==='preview')$('stage-source').textContent='场景预览 · 静态人像';
 $('weather-title').textContent={still:'微笑下雨，大笑放烟花。',rain:'微笑，屏幕下起细雨。',bloom:'大笑，烟花为你绽放。'}[mode];
}
$('preview-sequence').onclick=async()=>{
 if(source==='camera'||starting){notify('请先关闭摄像头，再观看模拟短片。');return;}
 if(effectPaused){notify('请先恢复特效，再播放短片。');return;}
 if(previewStart||previewStarting){stopPreview();clearParticles();setMode('still');return;}
 clearParticles();lastBurst=-9000;replyFireAt=0;replyStart=performance.now();replyPhase='';sendReplyPhase('ready');setMode('still');
 const ticket=++previewEpoch;previewStarting=true;$('preview-sequence').textContent='正在准备音乐 · 点击可取消';$('preview-sequence').setAttribute('aria-busy','true');
 giftAudio.loop=false;giftAudio.currentTime=0;giftAudio.muted=!$('gift-sound').checked;
 try{await giftAudio.play();giftSoundClock=true;}catch{if(ticket!==previewEpoch)return;giftSoundClock=false;notify('音乐未能播放，继续无声演示。');}
 if(ticket!==previewEpoch){giftAudio.pause();return;}
 previewStarting=false;previewStart=performance.now();giftCue=0;$('preview-sequence').removeAttribute('aria-busy');
 $('preview-sequence').textContent='停止礼物短片';$('stage-source').textContent='礼物短片演示 · 模拟输入';
 stage.scrollIntoView({block:'center',behavior:'auto'});
};
$('quick-preview').onclick=()=>$('preview-sequence').click();
window.addEventListener('art-direction',e=>setArt(e.detail));
function mapLandmarks(points,t){const scale=Math.max(W/video.videoWidth,H/video.videoHeight),ox=(video.videoWidth*scale-W)/2,oy=(video.videoHeight*scale-H)/2;let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;for(const p of points){const mapped=mapVideoPoint(p,{w:W,h:H,videoWidth:video.videoWidth,videoHeight:video.videoHeight}),x=mapped.x,y=mapped.y;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);}const h={x:(minx+maxx)/2,y:(miny+maxy)/2,rx:Math.max(20,(maxx-minx)*.55),ry:Math.max(25,(maxy-miny)*.55),roll:Math.atan2((points[263].y-points[33].y)*video.videoHeight,(points[263].x-points[33].x)*video.videoWidth)*-1};if(head){h.x=head.x*.4+h.x*.6;h.y=head.y*.4+h.y*.6;}velocity=previousHead?{x:Math.max(-W,Math.min(W,(h.x-previousHead.x)/Math.max(.03,(t-previousHead.t)/1000))),y:Math.max(-H,Math.min(H,(h.y-previousHead.y)/Math.max(.03,(t-previousHead.t)/1000)))}:{x:0,y:0};if(points[145])h.tearEye=mapVideoPoint(points[145],{w:W,h:H,videoWidth:video.videoWidth,videoHeight:video.videoHeight});if(points[61])h.tearMouth=mapVideoPoint(points[61],{w:W,h:H,videoWidth:video.videoWidth,videoHeight:video.videoHeight});head=h;previousHead={...h,t};}
function infer(t){const result=detector.detectForVideo(video,t);if(result.faceLandmarks?.length>1){if(activeReply&&replyFireAt)endReply();head=null;previousHead=null;clearParticles();setMode('still');$('face-status').textContent='检测到多人 · 请保留一人在镜头中';if(calibrating){calStart=0;calSamples=[];}return;}const points=result.faceLandmarks?.[0];if(!points){if(t-lastFace>350){if(activeReply&&replyFireAt)endReply();clearParticles();head=null;previousHead=null;velocity={x:0,y:0};setMode('still');$('face-status').textContent='还没看到你 · 请正视镜头';}if(calibrating){calStart=0;calSamples=[];$('calibration-text').textContent='把面部放入画面，保持自然表情';}return;}lastFace=t;mapLandmarks(points,t);const score={};for(const c of result.faceBlendshapes?.[0]?.categories||[])score[c.categoryName]=c.score;const raw=((score.mouthSmileLeft||0)+(score.mouthSmileRight||0))/2;smile=smile*.62+raw*.38;jaw=jaw*.62+(score.jawOpen||0)*.38;if(calibrating){if(!calStart)calStart=t;calSamples.push(raw);$('calibration-text').textContent=`保持自然表情 · ${Math.max(1,Math.ceil((2500-t+calStart)/1000))}`;if(t-calStart>2500){baseline=Math.min(.35,calSamples.reduce((a,b)=>a+b,0)/calSamples.length);calibrating=false;replyStart=t;$('calibration').hidden=true;$('status').textContent='准备好了 · 试着微笑，再张嘴笑开一点';}return;}
 $('face-status').textContent='已识别人脸 · 微笑 '+Math.round(smile*100)+'% · 张嘴 '+Math.round(jaw*100)+'%';const threshold=Math.min(.7,Math.max(.4,baseline+.22)),smiling=smile>(mode==='still'?threshold:threshold-.12);const desired=smiling?(jaw>(mode==='bloom'?.19:.29)?'bloom':'rain'):'still';if(candidate!==desired){candidate=desired;candidateSince=t;}if(t-candidateSince>160)setMode(desired);}
async function loadModel(){if(detector)return detector;if(!modelPromise)modelPromise=(async()=>{const {FaceLandmarker,FilesetResolver}=await import('./vendor/mediapipe/vision_bundle.mjs');const files=await FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm');return FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'./vendor/mediapipe/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:2,outputFaceBlendshapes:true});})().then(d=>detector=d).catch(e=>{modelPromise=null;throw e;});return modelPromise;}
function timed(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(message)),ms))]).finally(()=>clearTimeout(timer));}
function calibrate(){if(activeReply){replyFireAt=0;replyPhase='';sendReplyPhase('ready');}clearParticles();calibrating=true;calStart=0;calSamples=[];candidate='';smile=jaw=0;setMode('still');$('calibration').hidden=false;$('calibration-text').textContent='请正视镜头，保持自然表情';}
function endCamera(){hands.stop();releaseHand();endReply();stopPreview();epoch++;cameraStalled=false;$('input-origin').textContent='模拟输入';$('input-mode-label').textContent='模拟表情';$('stage-source').textContent='场景预览 · 静态人像';starting=false;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;source='preview';stage.classList.remove('camera-on');$('loading').hidden=true;$('calibration').hidden=true;calibrating=false;$('camera').disabled=false;$('camera').textContent='开启摄像头';$('camera').setAttribute('aria-pressed','false');$('back-preview').hidden=true;$('recalibrate').disabled=true;$('preview-label').hidden=false;$('source-label').textContent='场景预览';$('live-dot').classList.remove('live');$('face-status').textContent='预览采用固定头部代理 · 非实时识别';$('status').textContent='摄像头已关闭 · 可以继续试用效果';head=null;previousHead=null;lastVideo=-1;lastFace=0;velocity={x:0,y:0};clearParticles();setMode('still');}
async function startCamera(){if(starting||source==='camera')return;stopPreview();if($('gift-sound').checked){liveMusicMode=true;syncLiveMusic('rain');}starting=true;const ticket=++epoch;$('camera').disabled=true;$('loading').hidden=false;$('loading-title').textContent='正在打开摄像头';$('loading-detail').textContent='请允许摄像头访问。画面不会上传。';try{if(!navigator.mediaDevices?.getUserMedia)throw Error('请在 HTTPS 或 localhost 中打开此页面');const request=navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false}).then(s=>{if(ticket!==epoch){s.getTracks().forEach(t=>t.stop());throw Error('已取消');}return s;});stream=await timed(request,20000,'摄像头授权等待超时，请重试并允许访问');if(ticket!==epoch)return;stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(ticket===epoch){endCamera();notify('摄像头连接已断开，请检查设备后重新开启。');$('status').textContent='摄像头已断开 · 点击开启摄像头可重试';}}));video.srcObject=stream;await timed(video.play(),10000,'摄像头未提供可播放画面，请检查设备后重试');stage.classList.add('camera-on');$('loading-title').textContent='让画面认识你的笑容';$('loading-detail').textContent='摄像头已连接，正在启动本地表情模型。';await timed(loadModel(),35000,'模型加载超时，请检查网络后重试');if(ticket!==epoch)return;source='camera';starting=false;if($('hand-enabled').checked)hands.start();lastCameraFrame=performance.now();cameraStalled=false;$('input-origin').textContent='真人表情';$('input-mode-label').textContent='实时识别';$('stage-source').textContent='摄像头 · 本机识别';stage.classList.add('camera-on');$('loading').hidden=true;$('preview-label').hidden=true;$('back-preview').hidden=false;$('recalibrate').disabled=false;$('camera').disabled=false;$('camera').textContent='关闭摄像头';$('camera').setAttribute('aria-pressed','true');$('source-label').textContent='实时表情互动';$('live-dot').classList.add('live');clearParticles();head=null;lastInfer=0;lastVideo=-1;calibrate();}catch(e){if(ticket!==epoch)return;endCamera();const message=e.name==='NotAllowedError'?'没有获得摄像头权限。你仍可使用预览，或在浏览器设置中允许后重试。':e.name==='NotFoundError'?'没有发现可用摄像头。你仍可以探索预览模式。':e.name==='NotReadableError'?'摄像头可能被其他应用占用，请关闭后重试。':e.message;notify(message);$('status').textContent=message;}}
let effectPaused=false;window.addEventListener('live-pause',e=>{effectPaused=e.detail;if(effectPaused){releaseHand();endReply();stopPreview();clearParticles();setMode('still');}});window.addEventListener('live-stop',()=>{endReply();stopPreview();clearParticles();setMode('still');});window.addEventListener('live-camera-stop',endCamera);window.addEventListener('live-notice',e=>notify(e.detail));
function render(t){
 requestAnimationFrame(render);
 if(paused||document.hidden||$('experience').hidden){last=t;return;}
 const workStart=performance.now();const frameDt=t-last;last=t;
 const dt=Math.min(.033,Math.max(.001,frameDt/1000));
 if(frameDt>38)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
 if(slowFrames>50){quality=.6;slowFrames=0;}
 const reduced=$('reduced').checked;
 ctx.clearRect(0,0,W,H);
 if(source==='preview'){
  // This proxy remains fixed to the static portrait, never presented as tracking.
  head={x:W*.5,y:H*.44,rx:W*.245,ry:H*.21,tearEye:{x:W*.493,y:H*.405},tearMouth:{x:W*.560,y:H*.545}};velocity={x:0,y:0};
 }else if(t-lastInfer>1000/(quality<1?10:15)&&video.readyState>=2&&video.currentTime!==lastVideo){
  lastInfer=t;lastVideo=video.currentTime;lastCameraFrame=t;if(cameraStalled){cameraStalled=false;$('status').textContent='画面已恢复 · 试着微笑';}
  try{infer(t);}catch(e){endCamera();console.error('Face inference failed',e);notify('识别中断：'+e.message+'。请重新开启摄像头。');}
 }
 if(source==='camera'&&t-lastCameraFrame>1500&&!cameraStalled){cameraStalled=true;if(calibrating){calStart=0;calSamples=[];}clearParticles();head=null;previousHead=null;velocity={x:0,y:0};setMode('still');$('face-status').textContent='摄像头画面已暂停';$('status').textContent='等待摄像头恢复画面；也可关闭后重试。';}
 if(previewStart){
  const seconds=giftSoundClock?giftAudio.currentTime:(t-previewStart)/1000,scene=giftFrame(seconds);
  if(scene.done){stopPreview();clearParticles();setMode('still');}
  else {
    setMode(scene.mode);giftPhase=scene.phase;stage.dataset.giftPhase=scene.phase;
    $('weather-title').textContent=scene.copy;canvas.style.opacity=String(scene.opacity);
    $('gift-progress').value=seconds;
    $('gift-beat').textContent=({arrival:'01 / 雨为你停住',build:'02 / 笑意蓄光',bloom:'03 / 重拍花火绽放',thanks:'04 / 雨尽 · 彩虹浮现'})[scene.phase];
    simHand=scene.hand;if(simHand)simPalm={x:.66+(seconds-.72)*.055,y:.44-(seconds-.72)*.018};
    simFinger=scene.finger?{active:true,x:.72,y:.63,until:t+100}:null;
    while(giftCue<GIFT_LAUNCHES.length&&seconds>=GIFT_LAUNCHES[giftCue]){fireworks(t);giftCue++;}
  }
 }
 if(mode==='bloom'&&!previewStart&&!activeReply&&!effectPaused&&!calibrating&&t-lastBurst>4200)fireworks(t);
 if(activeReply&&!calibrating&&!starting){if(replyFireAt){const age=t-replyFireAt;if(age>6100)endReply();else if(age>3300)sendReplyPhase('done');else if(age>2300)sendReplyPhase('return');else if(age>650)sendReplyPhase('bloom');}else if(t-replyStart>12000)endReply();}
currentHand=source==='preview'?{...simGate.update({open:simHand,x:simPalm.x*W,y:simPalm.y*H},t),simulated:true}:hands.tick(t,!effectPaused&&!calibrating&&!cameraStalled&&$('hand-enabled').checked);
 effects.frame(dt,t,{background:source==='preview'?$('host-photo'):video,flowersEnabled:$('flowers-enabled').checked,fingerEnabled:$('finger-enabled').checked,finger:$('finger-enabled').checked?(source==='preview'?(simFinger&&t<simFinger.until?{active:true,x:simFinger.x*W,y:simFinger.y*H}:null):currentHand?.finger):null,hand:currentHand,mode:calibrating||effectPaused?'still':mode,head,velocity,intensity,quality,reduced,suspended:effectPaused||calibrating,preview:source==='preview'});
 if(head&&$('debug').checked){ctx.strokeStyle='#d7e7ed';ctx.lineWidth=1;ctx.setLineDash([4,6]);ellipse(ctx,head.x,head.y,head.rx,head.ry);ctx.stroke();ctx.setLineDash([]);}
 if(t-lastHud>200){
  $('audio-level').value=Math.min(1,interactionAudio.level()*3);
  lastHud=t;const stats=effects.stats();stage.classList.toggle('sim-control',source==='preview'&&simHand);$('rain-growth-status').textContent=(mode==='rain'?'雨量 '+Math.round(stats.rainLevel*100)+'% · ':mode==='bloom'?'烟花阶段 · ':'雨已停 · ')+($('flowers-enabled').checked?'花园 '+stats.flowers+'/24 组 · 盛放 '+Math.round(stats.bloomLevel*100)+'%':'纯花火模式');
  $('hand-feedback').textContent=stats.rainHold>.8&&stats.controlledRain===0?'已张掌 · 微笑开始下雨':stats.rainHold>.8?'雨滴悬停 · 移动'+(source==='preview'?'指针':'手掌')+'牵引雨幕':stats.rainHold>.05?'雨滴正在'+(currentHand?.active?'减速悬停':'恢复下落'):'张掌悬停 · 移掌牵引 · 松手恢复';
  $('firework-variety').textContent=stats.fireworkName?'随机花火 · '+stats.fireworkName:'五款花火随机 · 每轮不连续重复';
  $('finger-feedback').textContent=stats.fingerProgress>0?'指尖蓄光 '+Math.round(stats.fingerProgress*100)+'%':stats.fingerEvents?'指尖触发 '+stats.fingerEvents+' 次 · 移位或收指后再点':'伸出食指停留 · 雨中泛波 / 花火阶段点燃';
  $('hand-cue').hidden=stats.rainHold<.15;$('hand-cue').textContent=source==='preview'?'模拟手掌 · 雨幕已接管':'手掌控雨 · 雨幕已接管';
  $('collision-feedback').textContent=stats.collisions?'头部碰撞 '+stats.collisions+' 次 · '+(source==='preview'?'模拟代理':'实时轮廓'):'头部碰撞 · 等待烟花';
  const secs=Math.floor((t-startedAt)/1000);$('clock').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
  if(perfCount>20){const costs=Array.from(frameCosts.subarray(0,perfCount)).sort((a,b)=>a-b),avg=frameTimes.subarray(0,perfCount).reduce((a,b)=>a+b,0)/perfCount;$('perf-status').textContent='预览 '+Math.round(1000/Math.max(1,avg))+' FPS · 帧处理 P95 '+costs[Math.min(perfCount-1,Math.floor(perfCount*.95))].toFixed(1)+'ms';}
  $('sequence-state').textContent=previewStart?'礼物短片 · '+Math.min(16,Math.floor(giftAudio.currentTime||((t-previewStart)/1000)))+'/16 秒':effectPaused?'互动已暂停':calibrating?'校准中':{still:'等待表情 · 微笑下雨 / 大笑烟花',rain:'01 / 微笑 · 屏幕下雨',bloom:'02 / 大笑 · 烟花爆发'}[mode];
 }
 frameCosts[perfIndex]=performance.now()-workStart;frameTimes[perfIndex]=frameDt;perfIndex=(perfIndex+1)%120;perfCount=Math.min(120,perfCount+1);
}
$('camera').onclick=()=>{if(source==='camera'||starting)endCamera();else startCamera();};$('cancel-load').onclick=endCamera;$('back-preview').onclick=endCamera;$('recalibrate').onclick=calibrate;
for(const button of document.querySelectorAll('[data-moment]'))button.onclick=()=>{if(source==='camera'){notify('实时模式由你的表情控制。结束摄像头后可手动探索。');return;}if(starting)return;stopPreview();if(effectPaused){notify('特效已暂停，请先点击恢复特效。');return;}setMode(button.dataset.moment);if(mode==='bloom')fireworks(performance.now());if($('gift-sound').checked){liveMusicMode=true;syncLiveMusic(mode);}};
$('intensity').oninput=e=>{intensity=Number(e.target.value);$('density-value').textContent=intensity<.6?'轻盈':intensity<.9?'适中':'丰盈';};$('settings-toggle').onclick=()=>{const open=$('settings').hidden;$('settings').hidden=!open;$('settings-toggle').setAttribute('aria-expanded',open);$('settings-toggle').textContent=open?'收起调节 −':'调节氛围 ＋';};
$('expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.parentElement.requestFullscreen)await stage.parentElement.requestFullscreen();else notify('此浏览器暂不支持全屏，请横屏体验。');}catch{notify('此浏览器暂不支持全屏。');}};
for(const b of document.querySelectorAll('[data-page]'))b.onclick=()=>{const page=b.dataset.page;document.querySelector('.studio-heading').hidden=page!=='experience';stopPreview();$('experience').hidden=page!=='experience';$('story').hidden=page!=='story';document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));if(page==='story'&&(source==='camera'||starting))endCamera();window.scrollTo({top:0,behavior:'smooth'});};
function drawVideoCover(g){const scale=Math.max(W/video.videoWidth,H/video.videoHeight),vw=video.videoWidth*scale,vh=video.videoHeight*scale;g.save();g.translate(W,0);g.scale(-1,1);g.drawImage(video,(W-vw)/2,(H-vh)/2,vw,vh);g.restore();}
$('capture').onclick=()=>{
 const card=document.createElement('canvas');card.width=W;card.height=H;const g=card.getContext('2d');
 if(source==='camera'&&video.readyState>=2)drawVideoCover(g);
 else{const photo=$('host-photo'),scale=Math.max(W/photo.naturalWidth,H/photo.naturalHeight),dw=photo.naturalWidth*scale,dh=photo.naturalHeight*scale;g.drawImage(photo,(W-dw)/2,(H-dh)*.4,dw,dh);}
 g.drawImage(canvas,0,0);const url=card.toDataURL('image/png');$('postcard-preview').src=url;$('download-card').href=url;$('capture-dialog').showModal();
};$('close-capture').onclick=()=>$('capture-dialog').close();
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&previewStart){stopPreview();clearParticles();setMode('still');}if(document.hidden&&(source==='camera'||starting))endCamera();last=performance.now();});window.addEventListener('pagehide',endCamera);requestAnimationFrame(render);

setArt('opal');
