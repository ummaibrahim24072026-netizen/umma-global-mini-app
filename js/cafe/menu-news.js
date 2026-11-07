/* Public announcements are read without a customer credential or push subscription. */
(()=>{
'use strict';
const host=document.getElementById('cafeMenuNews');
if(!host)return;
const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect';
const key='umma:menu-news:hidden';
const copy={
 ru:['Акции и новые блюда','Скрыть акции в меню','Показать акции в меню'],
 en:['Offers and new dishes','Hide offers in the menu','Show offers in the menu'],
 vi:['Ưu đãi và món mới','Ẩn ưu đãi trong thực đơn','Hiện ưu đãi trong thực đơn']
};
let hidden=false,loading=false,news=[];
try{hidden=localStorage.getItem(key)==='1';}catch{}
function element(tag,text){
 const node=document.createElement(tag);node.textContent=text;return node;
}
const heading=element('h2',''),toggle=element('button',''),list=element('div','');
toggle.type='button';toggle.className='plain-btn';toggle.setAttribute('aria-controls','cafeMenuNewsItems');
list.id='cafeMenuNewsItems';
host.append(heading,toggle,list);
function render(){
 const labels=copy[document.documentElement.lang.split('-')[0]]||copy.en;
 host.hidden=!hidden&&!news.length;
 heading.textContent=labels[0];heading.hidden=hidden;
 toggle.textContent=labels[hidden?2:1];
 toggle.setAttribute('aria-expanded',String(!hidden));
 list.hidden=hidden;
 list.replaceChildren();
 if(hidden)return;
 for(const item of news){
  const article=element('article','');
  article.append(element('h3',item.title),element('p',item.body));
  list.append(article);
 }
}
async function refresh(){
 if(hidden||loading||document.hidden)return;
 loading=true;
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"news"}',cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)return;
  const data=await response.json();
  if(data.ok&&Array.isArray(data.news)){news=data.news;render();}
 }catch{}finally{loading=false;}
}
toggle.onclick=()=>{
 hidden=!hidden;
 try{localStorage.setItem(key,hidden?'1':'0');}catch{}
 render();
 if(!hidden)void refresh();
};
window.addEventListener('umma-menu:languagechange',render);
window.addEventListener('online',refresh);
document.addEventListener('visibilitychange',refresh);
setInterval(refresh,60000);
render();void refresh();
})();
