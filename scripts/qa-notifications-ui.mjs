import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://qa.local'}),w=dom.window,d=w.document;
const sleep=()=>new Promise(r=>setTimeout(r,10));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await sleep();}assert.fail('Notification UI did not update');}
let feed=[],state='waiting_courier',offline=false,requests=0;const timers=[];
w.AbortSignal=AbortSignal;w.Response=Response;w.setInterval=(fn,ms)=>{timers.push({fn,ms});return timers.length;};w.scrollTo=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
w.Telegram={WebApp:{initData:'synthetic-only',initDataUnsafe:{user:{id:15}}}};
w.openPage=()=>{d.getElementById('cafePage').hidden=false;};
w.fetch=async(url,options)=>{requests++;if(offline)throw Error('offline');const b=JSON.parse(options.body);if(b.action==='notifications')return new Response(JSON.stringify({ok:true,notifications:feed,unreadCount:feed.filter(n=>!n.read_at).length}));if(b.action==='readNotifications'){feed=feed.map(n=>b.ids.includes(n.id)?{...n,read_at:new Date().toISOString()}:n);return new Response(JSON.stringify({ok:true,notifications:feed,unreadCount:feed.filter(n=>!n.read_at).length}));}return new Response(JSON.stringify({ok:true,orders:[{id:'44444444-4444-4444-8444-444444444444',order_number:1,status:'ready',order_type:'delivery',delivery_status:state,total_vnd:120000,cafe_order_items:[]}]}));};
try{
 d.getElementById('cafePage').hidden=false;
 w.eval(readFileSync('js/cafe/cafe.js','utf8'));w.eval(readFileSync('js/cafe/notifications.js','utf8'));
 await until(()=>d.getElementById('cafeLiveConnection').textContent.includes('Онлайн'));
 await w.ummaCafe.refreshMyOrders();assert.match(d.getElementById('cafeMyOrdersList').textContent,/Ожидает курьера/);
 const previousCard=d.querySelector('.cafe-my-order-card');await w.ummaCafe.refreshMyOrders({silent:true});assert.equal(d.querySelector('.cafe-my-order-card'),previousCard,'unchanged poll preserves DOM');
 state='courier_assigned';feed=[{id:'11111111-1111-4111-8111-111111111111',order_id:'44444444-4444-4444-8444-444444444444',workspace:'customer',title:'Курьер принял заказ <img src=x onerror=alert(1)>',created_at:new Date().toISOString(),read_at:null}];
 await w.ummaNotifications.refresh();await until(()=>d.getElementById('cafeMyOrdersList').textContent.includes('Курьер принял заказ'));assert.equal(d.getElementById('cafeNotificationCount').textContent,'1');
 d.getElementById('cafeNotificationBell').click();assert.equal(w.ummaNotifications.isOpen(),true);assert.ok(!d.querySelector('.cafe-notification-item img'),'notification title must be plain text');
 const seen=[...d.querySelectorAll('.cafe-notifications-dialog button')].find(b=>b.textContent.includes('показанные'));seen.click();await until(()=>d.getElementById('cafeNotificationCount').hidden);w.ummaNotifications.close();assert.equal(d.activeElement,d.getElementById('cafeNotificationBell'));
 offline=true;await w.ummaNotifications.refresh();assert.match(d.getElementById('cafeLiveConnection').textContent,/Связь прервана/);await w.ummaCafe.refreshMyOrders({silent:true});assert.match(d.getElementById('cafeMyOrdersList').textContent,/Курьер принял/);
 offline=false;state='picked_up';feed.unshift({id:'22222222-2222-4222-8222-222222222222',workspace:'customer',title:'Курьер в пути',created_at:new Date().toISOString(),read_at:null});w.dispatchEvent(new w.Event('online'));await until(()=>d.getElementById('cafeMyOrdersList').textContent.includes('Курьер в пути'));
 const count=requests;Object.defineProperty(d,'hidden',{configurable:true,value:true});await w.ummaNotifications.refresh();assert.equal(requests,count);Object.defineProperty(d,'hidden',{configurable:true,value:false});
 assert.ok(timers.some(t=>t.ms===2000));assert.ok(timers.some(t=>t.ms===5000));
 console.log('PASS client live UI: courier acceptance without reload, unread bell/read acknowledgement, text safety, stable DOM, offline retains cards, online recovery and hidden-tab pause');
}finally{w.close();}
