import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
let fullscreen=0,expanded=0,nativeBack,menu=0,orders=0;
const events={};
const sdk={initData:'synthetic-ui-only',viewportStableHeight:844,viewportHeight:844,isFullscreen:false,platform:'android',safeAreaInset:{top:24,bottom:20},contentSafeAreaInset:{top:16,bottom:0},isVersionAtLeast:()=>true,ready(){},expand(){expanded++;},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){},onEvent:(name,fn)=>events[name]=fn,requestFullscreen(){fullscreen++;sdk.isFullscreen=true;events.fullscreenChanged?.();},BackButton:{show(){},hide(){},onClick:fn=>nativeBack=fn}};
w.Telegram={WebApp:sdk};w.visualViewport={height:844,addEventListener(){}};
w.requestAnimationFrame=fn=>w.setTimeout(fn,0);w.scrollTo=()=>{};w.HTMLElement.prototype.scrollTo=function({top}){this.scrollTop=top;};w.HTMLElement.prototype.scrollIntoView=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
const tick=()=>new Promise(r=>setTimeout(r,20));
try{
 w.eval(readFileSync('js/core/app.js','utf8'));w.ummaCafe={refreshMenu:()=>menu++,openOrders:()=>orders++};
 w.eval(readFileSync('js/core/navigation.js','utf8'));w.eval(readFileSync('js/core/native-shell.js','utf8'));
 assert.equal(fullscreen,1);assert.equal(expanded,1);assert.equal(d.documentElement.style.getPropertyValue('--umma-viewport-height'),'844px');assert.equal(d.documentElement.style.getPropertyValue('--umma-safe-top'),'max(40px, env(safe-area-inset-top, 0px))');
 const main=d.querySelector('.app>main');main.scrollTop=210;
 d.querySelector('[data-page=about]').click();await tick();
 const about=d.querySelector('.umma-about');assert.equal(about.open,true);
 assert.deepEqual([...about.querySelectorAll('h3')].map(h=>h.textContent),['Кто мы','Наша миссия','Наши ценности','Наши направления','Как присоединиться']);
 assert.equal(about.querySelectorAll('[class=umma-about-directions] button').length,3);
 assert.equal(about.querySelectorAll('.umma-about-values dt').length,6);
 assert.equal(about.querySelector('.umma-about-mission').textContent,'Всё, что мы делаем, мы делаем ради довольства Аллаха.');
 assert.deepEqual([...about.querySelectorAll('.umma-about-directions small')].map(e=>e.textContent),['Работает','В разработке','В разработке']);
 assert.match(about.textContent,/В разработке/);nativeBack();assert.equal(about.open,false);
 const hero=d.querySelector('.brand-art-action');hero.click();hero.click();await tick();assert.equal(menu,1,'hero repeated tap enters cafe once');
 assert.equal(hero.getAttribute('aria-busy'),'true');nativeBack();await new Promise(r=>setTimeout(r,460));assert.equal(hero.disabled,false);menu=0;
 for(const id of ['education','tours','hotels']){d.querySelector('.services-grid [data-service='+id+']').click();await tick();assert.equal(d.querySelector('.native-service-dialog').open,true);assert.match(d.querySelector('.native-service-dialog').textContent,/Услуги пока недоступны/);nativeBack();}

 d.querySelector('.nav-item[data-page="cafe"]').click();await tick();assert.equal(menu,1);assert.equal(d.getElementById('cafePage').hidden,false);assert.equal(d.getElementById('nativeAppTitle').textContent,'UMMA Cafe');
 nativeBack();await tick();assert.equal(main.style.display,'');assert.equal(main.scrollTop,210);
 d.querySelector('.nav-item[data-page="orders"]').click();await tick();assert.equal(orders,1);assert.equal(d.getElementById('cafeOrdersPage').hidden,false);assert.equal(d.getElementById('cafePage').hidden,true);assert.equal(d.getElementById('nativeAppTitle').textContent,'Мои заказы');assert.equal(d.querySelector('[aria-current="page"]').dataset.page,'orders');
 d.querySelector('.nav-item[data-page="more"]').click();await tick();assert.equal(d.getElementById('servicesPage').hidden,false);assert.equal(d.querySelectorAll('#nativeDirectory [data-service]').length,38);assert.match(d.getElementById('servicesPage').textContent,/готовятся/);
 d.querySelector('[data-service=travel]').click();await tick();assert.equal(d.querySelector('.native-service-dialog').open,true);nativeBack();assert.equal(d.querySelector('.native-service-dialog').open,false);assert.equal(d.getElementById('servicesPage').hidden,false);
 // Exercise every planned destination, not just the original travel stub.
 assert.deepEqual([...d.querySelectorAll('.services-grid [data-service]')].map(b=>b.dataset.service),['cafe','market','b2b','education','tours','hotels']);
 for(const item of w.ummaDirections.filter(item=>!item.available)){
  d.querySelector('#nativeDirectory [data-service="'+item.id+'"]').click();
  const sheet=d.querySelector('.native-service-dialog');assert.equal(sheet.open,true,item.id+' opens');
  assert.equal(sheet.querySelector('h2').textContent,item.title);
  assert.match(sheet.textContent,/Услуги пока недоступны/);
  assert.ok(sheet.querySelector('ul li'));nativeBack();assert.equal(sheet.open,false);
 }
 const search=d.getElementById('directionSearch'),group=d.getElementById('directionGroup');
 search.value='медресе';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('#nativeDirectory [data-service]').length,1);assert.ok(d.querySelector('#nativeDirectory [data-service=education]'));
 search.value='not-a-direction';search.dispatchEvent(new w.Event('input'));assert.equal(d.getElementById('directionEmpty').hidden,false);
 search.value='';group.value='family';group.dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('#nativeDirectory [data-service]').length,5);
 group.value='';group.dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('#nativeDirectory [data-service]').length,38);
 d.querySelector('#nativeDirectory [data-service=family]').click();d.querySelector('.native-service-dialog .cafe-submit').click();await tick();assert.equal(d.getElementById('servicesPage').hidden,false);assert.equal(w.ummaNativeShell.isDialogOpen(),false);
 w.openPage('home');await tick();d.getElementById('adminPage').hidden=false;await tick();d.getElementById('cafeKitchenPage').hidden=false;await tick();assert.equal(d.getElementById('adminPage').hidden,true,'opening another screen removes stale overlapping page');
 w.openPage('cafe');await tick();d.getElementById('cafeOrderForm').hidden=false;d.getElementById('cafeContactDetails').open=true;const input=d.getElementById('cafeCustomerName');input.focus();assert.equal(d.activeElement,input);w.visualViewport.height=420;w.ummaNativeShell.geometry();assert.equal(d.querySelector('.app').classList.contains('native-keyboard'),true);assert.equal(d.documentElement.style.getPropertyValue('--umma-viewport-height'),'420px');sdk.viewportStableHeight=420;w.ummaNativeShell.geometry();assert.equal(d.querySelector('.app').classList.contains('native-keyboard'),true);sdk.viewportStableHeight=844;input.blur();w.visualViewport.height=844;w.ummaNativeShell.geometry();assert.equal(d.querySelector('.app').classList.contains('native-keyboard'),false);
 sdk.requestFullscreen=()=>{throw Error('unsupported client');};sdk.isFullscreen=false;d.getElementById('nativeFullscreen').click();assert.equal(expanded,2,'unsupported fullscreen falls back to expanded layout');
 delete sdk.requestFullscreen;w.ummaNativeShell.geometry();assert.equal(d.getElementById('nativeFullscreen').hidden,true);
 assert.equal(d.querySelectorAll('.bottom-nav>.nav-item').length,5);assert.ok(d.querySelectorAll('.umma-icon').length>10);
 w.eval(readFileSync('js/admin/panel.js','utf8'));
 const homeMarkup=d.querySelector('.app>main').innerHTML;
 assert.equal(d.querySelector('.app>main #adminEntry'),null,'customer home contains no admin entry');
 assert.equal(d.querySelector('.app>main #staffEntry'),null,'customer home contains no staff tools');
 w.updateAdminUI('user');assert.equal(d.getElementById('adminEntry').hidden,true);assert.equal(d.getElementById('staffEntry').hidden,true);
 w.ummaRole='super_admin';w.ummaPermissions.isSuperAdmin=true;w.updateAdminUI('super_admin');
 assert.equal(d.querySelector('.app>main').innerHTML,homeMarkup,'superadmin sees exactly the same home markup');
 assert.equal(d.getElementById('adminEntry').closest('section.native-screen').id,'servicesPage');
 assert.equal(d.getElementById('adminEntry').hidden,false);assert.equal(d.getElementById('staffEntry').closest('#adminPage').id,'adminPage');
 d.querySelector('.nav-item[data-page="more"]').click();await tick();
 d.querySelector('#adminEntry button').click();await tick();assert.equal(d.getElementById('adminPage').hidden,false);assert.equal(d.getElementById('servicesPage').hidden,true);
 assert.equal(d.getElementById('staffEntry').hidden,false);assert.ok(d.getElementById('staffCourierEntryButton'));
 nativeBack();await tick();assert.equal(d.getElementById('servicesPage').hidden,false,'Back from administration returns to More');assert.equal(d.querySelector('[aria-current="page"]').dataset.page,'more');
 w.ummaRole='employee';w.ummaPermissions.isSuperAdmin=false;w.updateAdminUI('employee');assert.equal(d.getElementById('adminEntry').hidden,true);assert.equal(d.getElementById('staffEntry').closest('#servicesPage').id,'servicesPage');assert.equal(d.getElementById('staffEntry').hidden,false);
 w.ummaRole='user';w.updateAdminUI('user');assert.equal(d.getElementById('staffEntry').hidden,true);w.openAdminPanel();assert.equal(d.getElementById('adminPage').hidden,true,'customer cannot open administration');
 w.openPage('home');await tick();
 console.log('PASS More role boundaries: identical client/superadmin home, admin-only entry and workspaces, staff access, denied customer access and Back to More');
 console.log('PASS native shell: supported fullscreen/fallback, Telegram safe areas, keyboard viewport, actual tabs, planned-service disclosure, modal back, single active screen and preserved internal scroll');
}finally{w.close();}
