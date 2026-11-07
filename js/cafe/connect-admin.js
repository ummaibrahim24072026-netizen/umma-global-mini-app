/* Owner-only inbox and explicit, previewed broadcasts. Authorization is enforced server-side. */
(()=>{'use strict';
const API='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
let dialog=null,busy=false,thread=null,replyKey=null,campaign=null;
const button=node('button','Клиенты и рассылки','umma-connect-button');button.type='button';button.hidden=true;button.setAttribute('aria-haspopup','dialog');
(document.querySelector('.web-account-menu > div')||document.querySelector('header')||document.body).append(button);
const credential=()=>window.ummaStaffAuth?.credential?.()||window.Telegram?.WebApp?.initData||'';
async function api(action,data={}){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000),body:JSON.stringify({action,initData:credential(),...data})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Нет связи с кафе');return d;}
const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
let clients,stats,messages,replyForm,replyBody,threadTitle;
function label(text,input){const l=node('label',text);l.append(input);return l;}
async function run(fn){if(busy)return;busy=true;dialog?.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Загрузка…';try{await fn();}catch(e){status.textContent=e.message;}finally{busy=false;dialog?.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function showMessages(data){messages.replaceChildren();for(const m of data.messages||[]){const li=node('li');li.dataset.direction=m.direction;li.append(node('strong',m.direction==='customer'?'Клиент':m.title||'UMMA'),node('div',m.body),node('small',new Date(m.created_at).toLocaleString('ru-RU')));messages.append(li);}threadTitle.textContent=data.client.name||'Клиент '+data.client.id.slice(0,8);replyForm.hidden=false;}
async function openThread(id){thread=id;replyKey=null;replyBody.value='';const d=await api('staffThread',{clientId:id});showMessages(d);const latest=d.messages.filter(m=>m.direction==='customer'&&!m.read_at).at(-1);if(latest)await api('staffRead',{clientId:id,before:latest.created_at});status.textContent='';}
async function refresh(){const d=await api('staffList');stats.textContent='Клиентов на устройствах: '+d.total+' · Подписаны на новости: '+d.subscribers+' · С push: '+d.pushDevices;clients.replaceChildren();let unread=0;for(const c of d.clients){unread+=Number(c.unread)||0;const li=node('li'),b=node('button',(c.name||'Клиент '+c.id.slice(0,8))+' · '+c.language+(c.unread?' · новых: '+c.unread:''));b.type='button';b.onclick=()=>run(()=>openThread(c.id));li.append(b,node('small',c.last_message||'Переписка ещё не началась'));clients.append(li);}if(!d.clients.length)clients.append(node('li','Подписавшиеся клиенты появятся здесь.'));button.textContent='Клиенты и рассылки'+(unread?' · '+unread:'');status.textContent='';}
function build(){
 dialog=node('dialog',null,'umma-connect');dialog.setAttribute('aria-label','Клиенты и рассылки');
 const close=node('button','Закрыть','connect-close');close.type='button';close.onclick=()=>dialog.close();stats=node('p');clients=node('ol');
 const refreshButton=node('button','Обновить обращения');refreshButton.type='button';refreshButton.onclick=()=>run(refresh);
 const form=node('form'),title=node('input'),body=node('textarea'),language=node('select');title.required=true;title.maxLength=100;body.required=true;body.maxLength=2000;
 for(const [v,t]of [['ru','Русский'],['en','English'],['vi','Tiếng Việt'],['ko','한국어'],['zh','中文'],['de','Deutsch'],['fr','Français'],['th','ไทย'],['ms','Bahasa Melayu'],['id','Bahasa Indonesia'],['ar','العربية'],['pt','Português'],['all','Все подписчики']]){const o=node('option',t);o.value=v;language.append(o);}
 const preview=node('section');preview.hidden=true;const previewTitle=node('h3'),previewBody=node('p'),previewWho=node('p'),confirm=node('button','Отправить подписчикам','primary'),cancel=node('button','Изменить');confirm.type=cancel.type='button';preview.append(previewTitle,previewBody,previewWho,confirm,cancel);
 const submit=node('button','Проверить рассылку');submit.type='submit';
 form.append(node('h3','Акции и новые позиции'),node('p','Сообщение получат только клиенты с включённой подпиской на новости. Перевод текста не автоматический — выберите соответствующий язык.'),label('Язык получателей',language),label('Заголовок',title),label('Сообщение',body),submit,preview);
 const resetPreview=()=>{preview.hidden=true;submit.hidden=false;campaign=null;};form.addEventListener('input',resetPreview);cancel.onclick=resetPreview;
 form.onsubmit=e=>{e.preventDefault();campaign={requestKey:crypto.randomUUID(),title:title.value.trim(),body:body.value.trim(),language:language.value};previewTitle.textContent=campaign.title;previewBody.textContent=campaign.body;previewWho.textContent='Получатели: '+language.selectedOptions[0].textContent+'. После отправки отозвать push с телефона нельзя.';preview.hidden=false;submit.hidden=true;};
 confirm.onclick=()=>run(async()=>{if(!campaign)return;const d=await api('staffCampaign',campaign);status.textContent='Сообщение добавлено в переписку '+d.recipients+' клиентам. Фоновая доставка выполняется для устройств с разрешёнными уведомлениями.';resetPreview();form.reset();});
 threadTitle=node('h3','Переписка с клиентом');messages=node('ol',null,'connect-thread');replyForm=node('form');replyForm.hidden=true;replyBody=node('textarea');replyBody.required=true;replyBody.maxLength=2000;replyBody.addEventListener('input',()=>replyKey=null);const send=node('button','Ответить клиенту','primary');send.type='submit';replyForm.append(label('Ответ',replyBody),send);
 replyForm.onsubmit=e=>{e.preventDefault();if(!thread||!replyBody.value.trim())return;replyKey=replyKey||crypto.randomUUID();void run(async()=>{const d=await api('staffReply',{clientId:thread,requestKey:replyKey,body:replyBody.value.trim()});replyBody.value='';replyKey=null;showMessages(d);status.textContent='Ответ сохранён и поставлен в очередь уведомлений, если они включены у клиента.';});};
 dialog.append(close,node('h2','Клиенты и рассылки'),stats,refreshButton,clients,threadTitle,messages,replyForm,node('hr'),form,status);document.body.append(dialog);dialog.addEventListener('close',()=>button.focus());
}
button.onclick=()=>{if(!dialog)build();if(!dialog.open)dialog.showModal();void run(refresh);};
function owner(){return window.ummaRole==='super_admin'||window.ummaUser?.role==='super_admin';}
function visibility(){button.hidden=!owner()||!!document.getElementById('webWorkspace')?.hidden;if(button.hidden&&dialog?.open)dialog.close();}
setInterval(()=>{visibility();if(dialog?.open&&!busy&&!document.hidden)void run(async()=>{await refresh();if(thread){const d=await api('staffThread',{clientId:thread});showMessages(d);}});},15000);
document.addEventListener('umma:staff-tab',visibility);visibility();const workspace=document.getElementById('webWorkspace');if(workspace)new MutationObserver(visibility).observe(workspace,{attributes:true,attributeFilter:['hidden']});
})();
