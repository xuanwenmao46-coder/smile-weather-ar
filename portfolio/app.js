const $=id=>document.getElementById(id);
const evaluation=JSON.parse($('evaluation-data').textContent);
const rows=evaluation.rows;
const dialog=$('image-dialog');
let current=0,opener=null,filter='all';
const cards=[...document.querySelectorAll('.gallery-card')];
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
function showImage(id,button){
  const index=rows.findIndex(r=>r.id===id);if(index<0)return;
  current=index;const row=rows[index];
  $('dialog-image').src=`assets/evaluation/${row.id}.jpg`;
  $('dialog-image').alt=row.title;
  $('dialog-id').textContent=`图 ${row.id} / ${row.category}`;
  $('dialog-title').textContent=row.title;
  $('dialog-score').replaceChildren(document.createTextNode(String(row.score)));
  const denominator=document.createElement('small');denominator.textContent=' / 5';$('dialog-score').append(denominator);
  $('dialog-weighted').textContent=`加权值 ${row.weighted.toFixed(2)}`;
  for(const field of ['evidence','strength','issue'])$(`dialog-${field}`).textContent=row[field];
  $('dimension-bars').replaceChildren();
  evaluation.weights.forEach((weight,i)=>{
    const item=document.createElement('div'),head=document.createElement('div');head.className='dim-head';
    const name=document.createElement('span'),score=document.createElement('span');name.textContent=weight.name;score.textContent=`${row.dimensions[i]} / 5`;
    head.append(name,score);const track=document.createElement('div');track.className='dim-track';track.setAttribute('aria-hidden','true');
    const fill=document.createElement('div');fill.className='dim-fill';fill.style.width=`${row.dimensions[i]*20}%`;track.append(fill);item.append(head,track);$('dimension-bars').append(item);
  });
  $('dialog-position').textContent=`${String(index+1).padStart(2,'0')} / 20`;
  $('dialog-prev').disabled=index===0;$('dialog-next').disabled=index===rows.length-1;
  if(!dialog.open){opener=button||document.activeElement;dialog.showModal();document.body.classList.add('modal-open');document.querySelector('.dialog-close').focus();}
  if(!reduce.matches){$('dialog-image').animate([{opacity:.5},{opacity:1}],{duration:220,easing:'ease-out'});}
  dialog.scrollTop=0;
}
document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>showImage(button.dataset.open,button)));
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');opener?.focus({preventScroll:true});});
dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
dialog.addEventListener('keydown',event=>{
  if(event.key==='ArrowLeft'&&current>0){event.preventDefault();showImage(rows[current-1].id);}
  if(event.key==='ArrowRight'&&current<rows.length-1){event.preventDefault();showImage(rows[current+1].id);}
});
$('dialog-prev').addEventListener('click',()=>{if(current>0)showImage(rows[current-1].id);});
$('dialog-next').addEventListener('click',()=>{if(current<rows.length-1)showImage(rows[current+1].id);});
function arrangeGallery(){
  const byScore=$('gallery-sort').value==='score';
  const sorted=[...cards].sort((a,b)=>byScore?Number(b.dataset.weighted)-Number(a.dataset.weighted)||Number(a.dataset.image)-Number(b.dataset.image):Number(a.dataset.image)-Number(b.dataset.image));
  const gallery=document.querySelector('.gallery');let visible=0;
  sorted.forEach(card=>{gallery.append(card);card.hidden=filter!=='all'&&card.dataset.score!==filter;if(!card.hidden)visible++;});
  $('gallery-count').textContent=`${visible} / 20`;
  document.querySelector('.gallery-empty').hidden=visible!==0;
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
  filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));arrangeGallery();
}));
$('gallery-sort').addEventListener('change',arrangeGallery);
const agents={
  brief:{title:'区域文化需求整理',copy:'从已审核资料里组织任务上下文；证据不足的小语种地区不让模型自行编造文化。',input:'目标区域、礼物主题、已审核文化资料、平台政策',output:'RegionalBrief.json：推荐元素、配色、受限符号、来源与版本',gate:'文化资料缺失或有歧义，转交本地人工确认'},
  concept:{title:'先选对概念，再制作资产',copy:'每个任务先提出三个方向，说明主体、材质、动画与情绪。高成本制作之前先发现创意问题。',input:'RegionalBrief、共享设计规范、礼物档位与交互目标',output:'ConceptSpec.json：主体造型、动画路径、配色材质与音效情绪',gate:'概念偏离文化资料或视觉中心不清，返回修改；高价值礼物加入设计师判断'},
  culture:{title:'独立审查，不让生成者自评',copy:'文化合规基于适用地区的具体规则，不把宗教符号一概过滤。生成后的渲染结果还会再审一次。',input:'ConceptSpec、区域政策、平台政策与资料版本',output:'ComplianceReport：PASS、WARN或REJECT，附规则与修改方向',gate:'明确违规则驳回；文化歧义转人工；修改概念后必须重新审核'},
  asset:{title:'只执行审核通过的生产指令',copy:'生成Agent是工具调用规划者。严格JSON与服务端字段校验共同控制执行，不让自由文本直接驱动生产工具。',input:'已审核ConceptSpec、技术规格、历史错误与剩余预算',output:'AssetBundle：模型、材质、贴图、动画与渲染预览',gate:'缺少技术规格则BLOCKED；出现受限符号时清空tool_calls，退回概念修订'},
  qa:{title:'能通过检查，也能被清楚地看见',copy:'几何、UV、资源和目标设备性能由技术检查把关；小屏识别、节奏与遮挡仍要作为体验问题检查。',input:'AssetBundle、TechnicalSpec与已审核概念',output:'QAReport、问题定位与可复现预览；最终结果再次文化审核',gate:'失败返回明确问题、严重度与修复建议。局部网格问题优先修复，避免重做整个资产'}
};
document.querySelectorAll('[data-agent]').forEach(button=>button.addEventListener('click',()=>{
  const data=agents[button.dataset.agent];if(!data)return;
  document.querySelectorAll('[data-agent]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  for(const field of ['title','copy','input','output','gate'])$(`agent-${field}`).textContent=data[field];
  if(!reduce.matches){$('agent-detail').classList.remove('detail-change');requestAnimationFrame(()=>$('agent-detail').classList.add('detail-change'));}
}));
$('circuit-toggle').addEventListener('click',()=>{const open=$('circuit').hidden;$('circuit').hidden=!open;$('circuit-toggle').setAttribute('aria-expanded',String(open));$('circuit-toggle').textContent=open?'收起断路器与止损逻辑':'查看断路器与止损逻辑';});
let ticking=false;
function updateReading(){const total=document.documentElement.scrollHeight-innerHeight;document.querySelector('.reading-line').style.transform=`scaleX(${Math.max(0,Math.min(1,scrollY/Math.max(total,1)))})`;ticking=false;}
addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(updateReading);}},{passive:true});updateReading();
const sections=[...document.querySelectorAll('main>section[id]')];
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){document.querySelectorAll('.nav-links a').forEach(a=>{if(a.getAttribute('href')===`#${entry.target.id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}});},{rootMargin:'-15% 0px -65% 0px'});sections.forEach(s=>observer.observe(s));
  const videoObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)$('gift-film').pause();}),{threshold:.05});videoObserver.observe($('gift-film'));
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)$('gift-film').pause();});
addEventListener('beforeprint',()=>document.querySelectorAll('details').forEach(details=>{details.dataset.wasOpen=String(details.open);details.open=true;}));
addEventListener('afterprint',()=>document.querySelectorAll('details').forEach(details=>{details.open=details.dataset.wasOpen==='true';}));
