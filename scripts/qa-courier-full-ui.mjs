import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const web=process.env.UMMA_QA_WEB_STAFF==='1';
const html=readFileSync(web?'staff.html':'index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{pretendToBeVisual:true,runScripts:'outside-only',url:'https://synthetic-qa.invalid'}),w=dom.window,d=w.document;
const tick=()=>new Promise(r=>setTimeout(r,10));const until=async fn=>{for(let n=0;n<150;n++){if(fn())return;await tick();}assert.fail('Courier UI did not settle');};
let order={id:'delivery',order_number:1,order_type:'delivery',status:'ready',delivery_status:'courier_assigned',courier_telegram_id:20,staffRole:'courier',canAcceptPayments:true,payment_timing:'on_delivery',payment_method:'cash',payment_status:'pending',total_vnd:120000,requested_cash_vnd:200000,delivery_address:'Точка доставки: 12.25,109.18',deliveryProofs:[],cafe_order_items:[]},sharing=false,starts=0,stops=0,uploads=0,updates=0;
let navigationLink;
const proofAttempts=[];
let loseHandover=false;
const upload=async b=>{
 proofAttempts.push(b);
 if(loseHandover&&b.kind==='handover'){loseHandover=false;throw Error('QA connection lost');}
 uploads++;
 const proof={id:'proof-'+uploads,kind:b.kind,courier_telegram_id:20};
 order.deliveryProofs.push(proof);order.delivery_status=b.kind==='pickup'?'picked_up':'delivered';close();
 return new Response(JSON.stringify({ok:true,proof,order:snapshot()}));
};
w.Telegram={WebApp:{openLink:link=>{navigationLink=link;},initData:'synthetic',initDataUnsafe:{user:{id:20}}}};w.ummaRole='employee';w.AbortSignal=AbortSignal;w.scrollTo=()=>{};
if(web){w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};delete w.Telegram;w.ummaStaffAuth={credential:()=>"web:"+"a".repeat(64),actorId:()=>20};w.HTMLAnchorElement.prototype.click=function(){navigationLink=this.href;};}
w.ummaCourierTracking={start:async()=>{sharing=true;starts++;},stop:async()=>{sharing=false;stops++;},isSharing:()=>sharing,syncOrders:orders=>{if(sharing&&!orders.some(o=>o.delivery_status==='picked_up')){sharing=false;stops++;}}};
const snapshot=()=>({id:order.id,status:order.status,deliveryStatus:order.delivery_status,paymentStatus:order.payment_status});
const close=()=>{if(order.delivery_status==='delivered'&&order.payment_status==='paid')order.status='completed';};
w.fetch=async(url,options)=>{const b=JSON.parse(options.body);if(b.action==='uploadDeliveryProof')return upload(b);if(b.action==='list')return new Response(JSON.stringify({ok:true,orders:[order],staffRole:'courier',actorTelegramId:20,locations:[],couriers:[]}));if(b.action==='updatePayment'){assert.equal(b.tenderedAmountVnd,150000);assert.equal(b.changeGivenVnd,30000);order.payment_status='paid';close();return new Response(JSON.stringify({ok:true,order:snapshot()}));}if(b.action==='updateDelivery'){updates++;throw Error('Photo endpoint already commits the step');}return new Response('{"ok":true}');};
if(web)w.eval(readFileSync('js/cafe/order-requests.js','utf8'));
else w.ummaCafeRequests={request:(url,b)=>upload(b)};
w.FileReader=class{readAsDataURL(){this.result='data:image/jpeg;base64,cWE=';queueMicrotask(()=>this.onload());}};w.Image=class{width=100;height=100;set src(v){queueMicrotask(()=>this.onload());}};w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/jpeg;base64,cWE=';
let camera;w.HTMLInputElement.prototype.click=function(){camera=this;assert.equal(this.isConnected,true,'camera input must stay attached in Telegram WebView');};
const select=()=>{Object.defineProperty(camera,'files',{value:[{type:'image/jpeg',size:100}]});void camera.onchange();};
async function send(){
 if(!web)return;
 await until(()=>d.querySelector('.courier-photo-preview [value="send"]'));
 const button=d.querySelector('.courier-photo-preview [value="send"]');
 assert.equal(updates,0);
 button.click();
}
const card=()=>d.getElementById('cafeKitchenOrders');const btn=kind=>card().querySelector('[data-delivery-photo="'+kind+'"]');
try {
 w.eval(readFileSync('js/maps/delivery-location.js','utf8'));w.eval(readFileSync('js/maps/courier-route.js','utf8'));w.eval(readFileSync('js/cafe/kitchen.js','utf8'));w.eval(readFileSync('js/cafe/courier-workflow.js','utf8'));w.ummaKitchen.open(true);await until(()=>btn('pickup'));
 if(web)assert.match(card().querySelector('.courier-work-payment').textContent,/Подготовьте сдачу 80\D000.*200\D000/);
 btn('pickup').click();assert.ok(camera.isConnected);order.customer_note='Polling changed this card while camera was open';await w.ummaKitchen.refresh({silent:true});assert.ok(camera.isConnected);select();
 if(web){
  await until(()=>d.querySelector('.courier-photo-preview [value="cancel"]'));
  assert.equal(uploads,0,'preview does not upload until the courier sends the photo');
  d.querySelector('.courier-photo-preview [value="cancel"]').click();
  await until(()=>!d.querySelector('[data-courier-camera]'));
  assert.equal(order.delivery_status,'courier_assigned');
  btn('pickup').click();select();
 }
 await send();
 await until(()=>sharing&&card().querySelector('[data-payment-status]'));assert.equal(btn('pickup'),null);assert.equal(starts,1);assert.equal(updates,0);assert.equal(d.querySelector('[data-courier-camera]'),null,'file input is removed after processing');
 if(web){
  assert.ok(card().querySelector('[data-share-delivery]'),'courier can restart GPS after reconnecting');
  assert.equal(btn('handover'),null,'collect cash before confirming handover');
 }
 const payment=card().querySelector('[data-payment-status="paid"]');assert.match(payment.textContent,/120/);assert.equal(payment.closest('.kitchen-secondary-actions'),null,'courier cash button is a primary action');
 const route=card().querySelector('.kitchen-order-actions > [data-show-route]');
 assert.ok(route,'navigation is visible next to payment after pickup photo');assert.equal(route.textContent,'Маршрут к клиенту');assert.equal(route.dataset.routeAddress,order.delivery_address);route.click();assert.equal(d.getElementById('courierMapModal').hidden,false);assert.equal(navigationLink,undefined);
 if(web){
  assert.equal(d.getElementById('courierExternalMaps').hidden,false);
  assert.equal(d.getElementById('courierRouteTrackingNote').hidden,false);
  for(const [id,host,path] of [
   ['courierGoogleMaps','www.google.com','/maps/dir/'],
   ['courierAppleMaps','maps.apple.com','/directions']
  ]){
   const url=new URL(d.getElementById(id).href);
   assert.equal(url.hostname,host);
   assert.equal(url.pathname,path);
   assert.equal(url.searchParams.get('destination'),'12.250000,109.180000');
  }
 }
 d.getElementById('courierMapClose').click();
 payment.click();const amount=d.getElementById('cashPayTendered');amount.value='150000';amount.dispatchEvent(new w.Event('input'));d.getElementById('cashPayConfirm').click();await until(()=>!card().querySelector('[data-payment-status="paid"]'));
 if(web)assert.doesNotMatch(card().querySelector('.courier-work-payment').textContent,/Подготовьте сдачу/);
 assert.ok(card().querySelector('.kitchen-order-actions > [data-show-route]'),'navigation remains visible after payment');
 assert.ok(btn('handover'),'paid order still requires handover photo');assert.equal(sharing,true);
 if(web){
  let cameraStops=0;
  const stream={getTracks:()=>[{stop:()=>cameraStops++}]};
  Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:async constraints=>{
   assert.equal(constraints.video.facingMode.ideal,'environment');return stream;
  }}});
  loseHandover=true;
  btn('handover').click();
  const video=d.querySelector('.courier-photo-preview video');
  Object.defineProperties(video,{videoWidth:{value:1280},videoHeight:{value:720}});
  await until(()=>video.srcObject===stream);
  video.dispatchEvent(new w.Event('loadeddata'));
  d.querySelector('[data-take-photo]').click();
  assert.equal(cameraStops,1,'the camera is released as soon as the frame is captured');
  await send();
  const retry=d.querySelector('.courier-photo-preview [value="send"]');
  await until(()=>retry.textContent==='Повторить отправку');
  assert.equal(order.delivery_status,'picked_up','network failure leaves the order with the courier');
  assert.ok(d.querySelector('.courier-photo-preview img'),'failed upload keeps the same photo visible');
  retry.click();
 }else{btn('handover').click();select();}
 await until(()=>!card().querySelector('[data-kitchen-order]'));assert.equal(sharing,false);assert.equal(stops,1);assert.equal(order.status,'completed');
 if(web){
  await until(()=>/Заказ передан/.test(d.getElementById('courierWorkflowMessage').textContent));
  const [failed,retried]=proofAttempts.filter(attempt=>attempt.kind==='handover');
  assert.ok(failed.requestKey);
  assert.equal(retried.requestKey,failed.requestKey);
  assert.equal(retried.imageBase64,failed.imageBase64);
  assert.equal(w.ummaCafeRequests.pending(),null);
 }
 d.getElementById('courierClosedFilter').click();assert.equal(card().querySelector('.kitchen-order-actions > [data-show-route]'),null,'completed order has no primary navigation');assert.ok(card().querySelector('[data-kitchen-order]'));assert.equal(card().querySelector('[data-delivery-photo]'),null);assert.equal(card().querySelector('[data-payment-status]'),null);
 console.log('PASS full courier UI: connected camera survives polling, photo advances immediately, GPS starts, cash/change and amount shown, payment button disappears, handover stops GPS and closes order into history');
}finally{w.close();}
