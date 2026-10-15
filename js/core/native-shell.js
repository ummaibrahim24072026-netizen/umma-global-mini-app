/* Native-feeling presentation only. Does not change identities, orders or payments. */
(() => {
 'use strict';
 const sdk=window.Telegram?.WebApp,app=document.querySelector('.app'),byId=id=>document.getElementById(id);
 if(!app)return;
 const paths={kitchen:'M4 10h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zm-2 0h20M8 3v3m4-4v4m4-3v3',courier:'M3 7h11v11H3zm11 4h4l3 4v3h-7M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4m10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4',accounting:'M4 21h16M6 17V9h3v8m3 0V3h3v14m3 0v-5h3v5',home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',cafe:'M4 3v7m3-7v7m-6-4v2a3 3 0 0 0 6 0V3M4 11v10M15 3v8h4V3m0 8v10',orders:'M7 3h10v3H7zM7 5H4v16h16V5h-3M8 11h8M8 15h5',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',more:'M5 6h14M5 12h14M5 18h14',expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',market:'M3 3h2l3 12h11l2-8H6M10 20h.01M18 20h.01',travel:'m3 13 18-8-8 18-2-10z',hotels:'M4 21V3h16v18M8 7h2m4 0h2M8 11h2m4 0h2M10 21v-6h4v6',realestate:'M3 10 12 3l9 7M5 9v12h14V9m-9 12v-7h4v7',community:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 7m5 10v-2a4 4 0 0 0-3-4',business:'M8 7V3h8v4M3 7h18v14H3zM3 12h18M10 12v3h4v-3',education:'m2 9 10-5 10 5-10 5zm4 3v6l6 3 6-3v-6M22 9v7',health:'M20 4c-3-2-6 0-8 3-2-3-5-5-8-3-5 4 2 11 8 17 6-6 13-13 8-17',farm:'M5 21c0-6 3-12 12-16M4 12C1 3 11 2 21 3c-1 10-4 19-13 15'};
 function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','umma-icon');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.more);svg.append(p);return svg;}
 document.querySelectorAll('[data-native-icon]').forEach(el=>el.replaceChildren(icon(el.dataset.nativeIcon)));
 for(const [id,name] of Object.entries({staffEntryButton:'orders',staffKitchenEntryButton:'kitchen',staffCourierEntryButton:'courier',accountingEntryButton:'accounting'}))byId(id)?.querySelector('.admin-entry-icon')?.replaceChildren(icon(name));
 const scenes=['adminPage','adminUsersPage','locationAdminPage','cafeProductsAdminPage','cafeStaffAdminPage','cafeWaiterPage','cafeKitchenPage','cafeInventoryPage','cafePage','cafeOrdersPage','cafeAccountingPage','servicesPage'];
 scenes.forEach(id=>byId(id)?.classList.add('native-screen'));
 const titles={home:'UMMA Global',cafePage:'UMMA Cafe',cafeOrdersPage:'Мои заказы',servicesPage:'Ещё',adminPage:'Администрирование',adminUsersPage:'Пользователи',locationAdminPage:'Локации',cafeProductsAdminPage:'Меню кафе',cafeStaffAdminPage:'Сотрудники',cafeWaiterPage:'Приём заказов',cafeKitchenPage:'Работа в кафе',cafeInventoryPage:'Товары и остатки',cafeAccountingPage:'Учёт кафе'};
 const current=()=>scenes.find(id=>byId(id)&&!byId(id).hidden)||'home';
 let active='home',dialog=null;
 function syncScene(records=[]){
  const opened=records.filter(r=>r.attributeName==='hidden'&&scenes.includes(r.target.id)&&!r.target.hidden).map(r=>r.target.id);
  const next=opened.at(-1)||current();
  const home=document.querySelector('.app>main'),nav=document.querySelector('.bottom-nav');
  if(home&&home.style.display!==(next==='home'?'':'none'))home.style.display=next==='home'?'':'none';
  const navDisplay=['home','cafePage','cafeOrdersPage','servicesPage'].includes(next)?'':'none';if(nav&&nav.style.display!==navDisplay)nav.style.display=navDisplay;
  if(next!=='home')scenes.forEach(id=>{if(id!==next&&byId(id)&&!byId(id).hidden)byId(id).hidden=true;});
  if(next!==active){const el=next==='home'?document.querySelector('.app>main'):byId(next);el?.classList.add('native-screen-enter');window.setTimeout(()=>el?.classList.remove('native-screen-enter'),180);active=next;}
  const title=byId('nativeAppTitle');if(title&&title.textContent!==(titles[next]||'UMMA Global'))title.textContent=titles[next]||'UMMA Global';
  try{if(next==='home'&&!dialog?.open&&!document.querySelector('dialog[open]')&&byId('courierMapModal')?.hidden!==false)sdk?.BackButton?.hide();else sdk?.BackButton?.show();}catch{}
 }
 new MutationObserver(syncScene).observe(app,{subtree:true,attributes:true,attributeFilter:['hidden','style']});
 new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'&&r.target.tagName==='DIALOG'||r.type==='childList'&&r.target===document.body&&[...r.addedNodes,...r.removedNodes].some(n=>n.nodeName==='DIALOG')))syncScene();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open'],childList:true});syncScene();
 let restingHeight=Number(sdk?.viewportStableHeight)||window.innerHeight;
 function geometry(){
  const focused=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
  const visual=window.visualViewport,stable=Number(sdk?.viewportStableHeight)||window.innerHeight;
  if(!focused)restingHeight=stable;
  const keyboard=focused&&visual&&Math.max(stable,restingHeight)-visual.height>140;
  const height=keyboard?visual.height:(Number(sdk?.viewportStableHeight)||visual?.height||window.innerHeight);
  const root=document.documentElement.style;
  if(height>0)root.setProperty('--umma-viewport-height',Math.round(height)+'px');
  root.setProperty('--umma-keyboard-offset',Math.max(0,keyboard?window.innerHeight-visual.height-(visual.offsetTop||0):0)+'px');
  const device=sdk?.safeAreaInset||{},content=sdk?.contentSafeAreaInset||{};
  for(const side of ['top','bottom','left','right']){
   const fallback=side==='top'&&sdk?.isFullscreen&&!Number(content.top)?48:0;
   const inset=(Number(device[side])||0)+Math.max(Number(content[side])||0,fallback);
   root.setProperty('--umma-safe-'+side,'max('+inset+'px, env(safe-area-inset-'+side+', 0px))');
  }
  app.classList.toggle('native-keyboard',!!keyboard);
  if(keyboard)window.setTimeout(()=>document.activeElement?.scrollIntoView?.({block:'nearest',behavior:'smooth'}),160);
  const button=byId('nativeFullscreen');if(button)button.hidden=!supportsFull()||sdk.isFullscreen===true;
 }
 const supportsFull=()=>sdk?.initData&&typeof sdk.requestFullscreen==='function'&&(!sdk.isVersionAtLeast||sdk.isVersionAtLeast('8.0'));
 function fullscreen(){if(!supportsFull())return;try{sdk.requestFullscreen();}catch{sdk.expand?.();}geometry();}
 byId('nativeFullscreen')?.addEventListener('click',fullscreen);
 window.addEventListener('resize',geometry);window.visualViewport?.addEventListener('resize',geometry);
 document.addEventListener('focusin',geometry);document.addEventListener('focusout',()=>window.setTimeout(geometry,80));
 for(const event of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged','fullscreenFailed'])try{sdk?.onEvent?.(event,geometry);}catch{}
 try{sdk?.BackButton?.onClick(()=>{if(dialog?.open){dialog.close();return;}if(!window.ummaNavigation?.back()&&current()!=='home'&&typeof openPage==='function')openPage('home');});}catch{}
 geometry();if(supportsFull())fullscreen();
 let lastHaptic=0;document.addEventListener('click',event=>{const button=event.target.closest?.('button');if(!button||button.disabled||Date.now()-lastHaptic<60)return;lastHaptic=Date.now();try{sdk?.HapticFeedback?.impactOccurred('light');}catch{}});
 const catalogue={market:['Рынок Umma','Продукты и товары'],travel:['Путешествия','Туры, билеты и маршруты'],hotels:['Отели Umma','Проживание для вас и вашей семьи'],realestate:['Недвижимость','Жильё и аренда'],community:['Сообщество','Люди, помощь и связи'],business:['Бизнес','Возможности и партнёрства'],education:['Образование','Школа, медресе и университет'],health:['Здоровье','Спорт и здоровый образ жизни'],farm:['Umma Farm','Халяльное производство и натуральные продукты']};
 function info(title,text){
  dialog?.remove();dialog=document.createElement('dialog');dialog.className='native-service-dialog';dialog.setAttribute('aria-label',title);
  const close=document.createElement('button');close.type='button';close.className='cafe-back';close.textContent='← Назад';close.onclick=()=>dialog.close();
  const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=text;dialog.append(close,h,p);
  dialog.onclose=()=>syncScene();document.body.append(dialog);dialog.showModal();syncScene();return dialog;
 }
 function openService(key){
  if(key==='services'||key==='more'){
   scenes.forEach(id=>{if(byId(id))byId(id).hidden=id!=='servicesPage';});document.querySelector('.app>main').style.display='none';const nav=document.querySelector('.bottom-nav');if(nav)nav.style.display='';if(typeof setActiveNav==='function')setActiveNav('more');return;
  }
  const item=catalogue[key];if(!item)return;
  const sheet=info(item[0],item[1]+'. Это направление готовится к запуску. Сейчас в приложении доступен UMMA Cafe.');
  const cafe=document.createElement('button');cafe.type='button';cafe.className='cafe-submit';cafe.textContent='Открыть UMMA Cafe';cafe.onclick=()=>{sheet.close();if(typeof openPage==='function')openPage('cafe');};sheet.append(cafe);
 }
 const grid=byId('nativeDirectory');if(grid)for(const [key,item] of Object.entries(catalogue)){
  const b=document.createElement('button');b.type='button';b.className='native-directory-card';const title=document.createElement('strong');title.textContent=item[0];const desc=document.createElement('small');desc.textContent=item[1];const status=document.createElement('span');status.className='native-coming';status.textContent='Готовится к запуску';b.append(icon(key),title,desc,status);b.onclick=()=>openService(key);grid.append(b);
 }
 document.querySelectorAll('.service[data-page]').forEach(b=>{const badge=document.createElement('span');badge.className='native-coming';badge.textContent='Готовится';b.append(badge);b.querySelector('.service-icon')?.replaceChildren(icon(b.dataset.page));});
 byId('servicesBack')?.addEventListener('click',()=>{if(!window.ummaNavigation?.back()&&typeof openPage==='function')openPage('home');});
 document.querySelector('.farm-button')?.addEventListener('click',()=>openService('farm'));
 byId('nativeHomeShortcut')?.addEventListener('click',()=>{try{sdk?.addToHomeScreen?.();}catch{if(typeof showToast==='function')showToast('Добавление ярлыка недоступно в этой версии Telegram');}});
 if(byId('nativeHomeShortcut'))byId('nativeHomeShortcut').hidden=typeof sdk?.addToHomeScreen!=='function'||!sdk?.initData;
 window.ummaNativeShell={openService,geometry,isDialogOpen:()=>dialog?.open===true,closeDialog:()=>dialog?.close()};
})();
