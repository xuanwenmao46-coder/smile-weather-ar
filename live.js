// All social events are local simulations, never TikTok events or transactions.
(()=>{const $=id=>document.getElementById(id);let roundEnd=0,paused=false,likes=12800,giftTimer;const fire=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
function comment(name,text){const p=document.createElement('p'),b=document.createElement('b');b.textContent=name;p.append(b,document.createTextNode(text));$('chat-list').append(p);while($('chat-list').children.length>3)$('chat-list').firstElementChild.remove();}
$('chat-form').onsubmit=e=>{e.preventDefault();const text=$('chat-input').value.trim();if(text){comment('你',text);fire('live-local-comment',text);$('chat-input').value='';}};
$('follow').onclick=()=>{$('follow').textContent=$('follow').textContent==='关注'?'已关注':'关注';};
$('like').onclick=()=>{likes++;$('like-count').textContent=(likes/1000).toFixed(1)+'K';const h=document.createElement('span');h.textContent='♥';$('floating-hearts').append(h);setTimeout(()=>h.remove(),1800);};
$('gift-open').onclick=()=>$('gift-panel').hidden=false;$('gift-close').onclick=()=>$('gift-panel').hidden=true;
document.querySelectorAll('[data-gift]').forEach(b=>b.onclick=()=>{const names={rose:['🌹','玫瑰'],star:['🌟','星光'],heart:['💖','比心']},v=names[b.dataset.gift];$('gift-panel').hidden=true;$('gift-toast').querySelector('span').textContent=v[0];$('gift-toast').querySelector('small').textContent='送出'+v[1]+' · 模拟事件';$('gift-toast').hidden=false;clearTimeout(giftTimer);giftTimer=setTimeout(()=>$('gift-toast').hidden=true,2800);comment('系统','你送出了'+v[1]+'，谢谢这份回应！');});
$('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);fire('live-notice','已复制当前演示地址；本地地址仅此电脑可用。');}catch{fire('live-notice','请复制浏览器地址栏中的链接。');}};
function pause(value){paused=value;$('round-status').textContent=roundEnd?(value?'特效暂停 · 本轮计时继续':'互动进行中 · 随时可以暂停或结束'):(value?'特效已暂停 · 可以继续聊天':'自由体验 · 可开始新一轮互动');$('pause-effect').textContent=value?'恢复特效':'暂停特效';fire('live-pause',value);$('round-hint').textContent=value?'特效已暂停 · 可以继续聊天':'微笑花开雨落 · 大笑花火蝶舞';}
$('pause-effect').onclick=()=>pause(!paused);
function finish(){roundEnd=0;$('start-round').textContent='再来一轮 30 秒';$('round-title').textContent='这一轮，谢谢你们的快乐';$('round-time').textContent='✓';pause(true);$('round-status').textContent='本轮已结束 · 特效暂停，可手动恢复';fire('live-stop');}
$('start-round').onclick=()=>{if(roundEnd){finish();return;}pause(false);document.querySelector('.round-banner').hidden=false;roundEnd=performance.now()+30000;$('start-round').textContent='结束本轮';$('round-title').textContent='一起，把主播逗笑';$('round-hint').textContent='微笑花开雨落 · 大笑花火蝶舞';$('round-status').textContent='互动进行中 · 随时可以暂停或结束';comment('玩法','新的一轮开始！让笑容变成天气 ✨');};
$('exit-live').onclick=()=>{finish();fire('live-camera-stop');};
setInterval(()=>{if(roundEnd){const sec=Math.ceil((roundEnd-performance.now())/1000);if(sec<=0)finish();else $('round-time').textContent='00:'+String(sec).padStart(2,'0');}},250);
document.querySelectorAll('[data-art]').forEach(b=>b.onclick=()=>{
 const opal=b.dataset.art==='opal';
 document.querySelectorAll('[data-art]').forEach(x=>{x.classList.toggle('chosen',x===b);x.setAttribute('aria-pressed',x===b);});
 $('art-story').textContent=opal?'奶油白与浅粉花朵，在细雨中舒展；蓝紫蝴蝶从花间飞起。':'蜜桃花朵与香槟色花火，金翼蝴蝶在暮光里飞舞。';
 fire('art-direction',b.dataset.art);
});
$('clean-view').onclick=()=>{
 const clean=$('stage').classList.toggle('clean-view');
 $('clean-view').setAttribute('aria-pressed',clean);$('clean-view').textContent=clean?'显示直播界面':'纯净画面';
};
const replyMessages={
 orange:{id:'orange',name:'阿橙',text:'雨真的跟着手走欸'},
 luna:{id:'luna',name:'Luna',text:'刚才烟花弹回去了！'},
 seven:{id:'seven',name:'小七',text:'再笑一下看看'}
};
let selectedReply=null;
function chooseReply(id){
 const message=replyMessages[id];if(!message)return;
 selectedReply=message;$('reply-card').hidden=false;$('stage').classList.add('reply-active');
 $('reply-message').textContent=message.text;$('reply-byline').textContent='正在回应 @'+message.name;
 $('reply-feedback').textContent='正在看这条留言';$('reply-card').dataset.phase='ready';
 $('cancel-reply').hidden=false;$('reply-hint').textContent='已选中 @'+message.name+' · 微笑下雨，大笑送出烟花';
 document.querySelectorAll('[data-reply]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.reply===id));
 fire('live-reply-selected',message);if(matchMedia('(max-width:620px)').matches)$('stage').scrollIntoView({block:'start',behavior:$('reduced').checked?'auto':'smooth'});
}
$('reply-options').onclick=e=>{const button=e.target.closest('[data-reply]');if(button)chooseReply(button.dataset.reply);};
$('cancel-reply').onclick=()=>fire('live-reply-cancel');
window.addEventListener('live-reply-demo',()=>chooseReply('orange'));
window.addEventListener('live-reply-phase',e=>{
 if(!selectedReply)return;const phase=e.detail.phase;$('reply-card').dataset.phase=phase;
 $('reply-feedback').textContent={ready:'正在看这条留言',rain:'微笑 · 下雨',launch:'烟花升起',bloom:'烟花绽放',return:'火星落下',done:'回应 @'+selectedReply.name}[phase];
 if(phase==='done')$('reply-byline').textContent='回应已送达 @'+selectedReply.name;
});
window.addEventListener('live-reply-clear',()=>{
 selectedReply=null;$('reply-card').hidden=true;$('stage').classList.remove('reply-active');
 $('cancel-reply').hidden=true;$('reply-hint').textContent='选中后显示这条留言，随时可以取消。';
 document.querySelectorAll('[data-reply]').forEach(b=>b.setAttribute('aria-pressed','false'));
});
window.addEventListener('live-local-comment',e=>{
 replyMessages.latest={id:'latest',name:'你',text:e.detail};
 let button=$('reply-latest');if(!button){button=document.createElement('button');button.id='reply-latest';button.dataset.reply='latest';$('reply-options').append(button);}
 button.replaceChildren();const who=document.createElement('span'),text=document.createElement('span');who.className='reply-avatar';who.textContent='你';text.textContent=e.detail;button.append(who,text);button.setAttribute('aria-label','回应我的留言：'+e.detail);
});
$('host-photo').onerror=()=>$('host-photo').hidden=true;
})();
