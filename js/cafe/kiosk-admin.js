/* Provision a device without giving it a staff session or access to other orders. */
(() => {
 'use strict';
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kiosk';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function api(body){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,initData:window.Telegram?.WebApp?.initData}),signal:AbortSignal.timeout(15000)});const result=await r.json();if(!r.ok||!result.ok)throw Error(result.error||'Не удалось подключить экран');return result;}
 async function show(){
  if(document.getElementById('kioskAdminDialog'))return;
  const d=document.createElement('dialog');d.id='kioskAdminDialog';d.className='cafe-refund-dialog';d.innerHTML='<button type="button" data-close>← Назад</button><h2>Уличный экран · UMMA Cafe</h2><p>Экран принимает заказы в кафе и с собой, без входа посетителя. Управление доступно руководителю кафе.</p><div data-content></div><p role="status" data-message>Подключаемся…</p>';
  document.body.append(d);d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>d.remove();
  const msg=d.querySelector('[data-message]'),content=d.querySelector('[data-content]');
  try{
   const [settings,response]=await Promise.all([api({action:'devices'}),fetch('https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-menu')]);const menu=await response.json();
   const locations=(menu.locations||[]).filter(l=>settings.locationIds.includes(l.id));
   if(!locations.length)throw Error('Для подключения экрана нужны права руководителя кафе.');
   content.innerHTML='<label>Кафе<select data-location>'+locations.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+'</option>').join('')+'</select></label><button type="button" class="kitchen-action" data-register>Подключить новый экран</button><div data-result></div><h3>Подключённые экраны</h3><div data-devices></div>';
   const list=content.querySelector('[data-devices]');
   function render(devices){list.innerHTML=devices.map(x=>'<p>'+esc(x.label)+' · '+(x.is_active?'<button type="button" data-revoke="'+esc(x.id)+'" data-location="'+esc(x.location_id)+'">Отключить</button>':'Отключён')+'</p>').join('')||'<p>Пока нет экранов.</p>';}
   render(settings.devices);msg.textContent='';
   content.querySelector('[data-register]').onclick=async e=>{const button=e.currentTarget;button.disabled=true;msg.textContent='Создаём подключение…';try{const result=await api({action:'register',locationId:content.querySelector('select').value});if(!d.isConnected)return;const url=new URL('kiosk.html',document.baseURI);url.hash=new URLSearchParams({activate:result.token}).toString();const wrap=content.querySelector('[data-result]');wrap.replaceChildren();const help=document.createElement('p');help.textContent='Откройте эту ссылку один раз в браузере уличного монитора. Затем включите режим киоска в настройках устройства. Ссылка даёт право отправлять заказы: не публикуйте её.';const field=document.createElement('textarea');field.readOnly=true;field.value=url.href;field.style.width='100%';const copy=document.createElement('button');copy.type='button';copy.textContent='Скопировать ссылку подключения';copy.onclick=async()=>{try{await navigator.clipboard.writeText(field.value);msg.textContent='Ссылка скопирована.';}catch{field.select();msg.textContent='Скопируйте выделенную ссылку.';}};wrap.append(help,field,copy);render((await api({action:'devices'})).devices);msg.textContent='Ссылка подключения готова.';}catch(err){msg.textContent=err.message;}finally{button.disabled=false;}};
   list.onclick=async e=>{const b=e.target.closest('[data-revoke]');if(!b)return;b.disabled=true;try{await api({action:'revoke',deviceId:b.dataset.revoke,locationId:b.dataset.location});render((await api({action:'devices'})).devices);msg.textContent='Экран отключён.';}catch(err){msg.textContent=err.message;b.disabled=false;}};
  }catch(e){msg.textContent=e.message;}
 }
 const root=document.querySelector('.kitchen-board-tools');if(root){const b=document.createElement('button');b.type='button';b.className='kitchen-action';b.dataset.kioskAdmin='true';b.textContent='Уличный экран · Подключение';b.onclick=()=>void show();root.append(b);}
})();
