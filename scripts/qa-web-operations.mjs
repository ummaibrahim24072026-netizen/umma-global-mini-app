import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const html=readFileSync('staff.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const tick=()=>new Promise(r=>setTimeout(r,20));
for(const [method,service] of [['cash','dine_in'],['qr','pickup'],['qr','delivery'],['sber','dine_in'],['kaspi','delivery'],['usdt','pickup']]){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://qa.invalid/staff.html'}),w=dom.window,d=w.document,requests=[];w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.ummaKitchen={open(){}};w.qrcode=()=>({addData(){},make(){},createSvgTag(){return '<svg></svg>';}});
 w.eval(readFileSync('js/cafe/web-session.js','utf8'));w.ummaStaffAuth.save('a'.repeat(64));
 const order={id:'qa-order',orderNumber:444,totalVnd:25000};let created=0,paid=false,currentMethod=method;
 const foreign=!['cash','qr'].includes(method);
 const point={lat:12.25,lng:109.19};
 const zones=[[12.24,109.18],[12.26,109.18],[12.25,109.20]];
 w.ummaDeliveryLocation={chooseForLocation(location,confirm){assert.deepEqual(location.delivery_zone,zones);confirm(point);}};
 w.ummaMapLinks={coords:point=>point.lat.toFixed(6)+','+point.lng.toFixed(6)};
 const currency=method==='usdt'?'USDT':['tenge','kaspi'].includes(method)?'KZT':'RUB';
 w.confirm=()=>assert.fail('Payment confirmation must stay on the page');
 w.fetch=async(url,opts)=>{const b=opts?.body?JSON.parse(opts.body):{};requests.push({url,b});assert.equal(w.Telegram,undefined);
 let out={ok:true};if(url.endsWith('cafe-menu'))out={ok:true,products:[{id:'bread',name_ru:'Лепёшка',name_vi:'Bánh mì',price_vnd:25000}],inventory:[],locations:[{id:'cafe',delivery_zone:zones}]};
 else{assert.ok(b.initData?.startsWith('web:'));if(b.action==='me')out={ok:true,user:{id:1000000000001,name:'Cashier',role:'employee'},assignments:[{location_id:'cafe',staff_role:'cashier',can_accept_payments:true}],locations:[{id:'cafe',name:'UMMA'}]};
 else if(b.action==='screenCreate')out={ok:true,id:'client-screen',screenToken:'b'.repeat(64)};
 else if(b.action==='options')out.methods={rub:true,sber:true,tenge:true,kaspi:true,usdt:true};
 else if(b.staffOrder){
  created++;assert.equal(b.items.length,1);assert.equal(b.items[0].quantity,1);
  assert.equal(b.orderType,service);
  if(service==='delivery'){
   assert.equal(b.dispatchMode,'manual');
   assert.equal(b.deliveryAddress,'Nha Trang 012\nТочка доставки: 12.250000,109.190000');
   assert.equal(b.customerPhone,'0901234567');
  }else{
   assert.equal(b.deliveryAddress,undefined);
  }
  if(foreign){
   assert.match(url,/cafe-counter-payment$/);assert.equal(b.method,method);assert.equal(b.action,'create');
   out={ok:true,order,payment:{currency,amount:currency==='USDT'?0.95431:82.15,bankName:'QA Bank',account:'QA-112233',network:currency==='USDT'?'Test network':null}};
  }else{
   assert.equal(b.customerPhone,service==='delivery'?'0901234567':'');assert.equal(b.paymentMethod,method);out={ok:true,order};
  }
 }
 else if(b.action==='confirm'){assert.equal(foreign,true);assert.equal(b.reference,'QA-7777');assert.equal(b.verified,true);paid=true;}
 else if(b.action==='switch'){
  assert.equal(b.orderId,order.id);assert.equal(b.expectedMethod,currentMethod);currentMethod=b.method;
  out={ok:true,paymentMethod:b.method,paymentStatus:'pending',status:'pending'};
 }
 else if(b.action==='settle'){assert.equal(b.expectedMethod,currentMethod);if(method==='cash'){assert.equal(b.tenderedAmountVnd,50000);assert.equal(b.changeGivenVnd,25000);}paid=true;}
 else if(b.action==='payment')out={ok:true,payment:{qrPayload:'test-vietqr-with-25000',bankName:'Vietcombank',account:'123',reference:'UMMA 444'}};
 }
 return new Response(JSON.stringify(out));};
 w.eval(readFileSync('js/cafe/order-requests.js','utf8'));w.eval(readFileSync('js/cafe/web-operations.js','utf8'));await tick();await tick();
 assert.equal(d.getElementById('webWorkspace').hidden,false);assert.equal(d.querySelector('[data-web-tab="courier"]').hidden,true);
 assert.equal(d.body.dataset.workspace,'pos');
 assert.equal(d.getElementById('webCashViews').hidden,true);
 assert.deepEqual([...d.querySelectorAll('[data-counter-view]')].map(b=>b.textContent.trim()),['Продажа','Оплата','Заказы','Выдача']);
 if(method==='qr'){
  d.getElementById('screenLayout').value='tablet-large';
  d.getElementById('screenPair').click();await tick();
  assert.equal(requests.find(r=>r.b.action==='screenCreate').b.layout,'tablet-large');
  assert.match(d.getElementById('screenPairLink').href,/payment-screen.html#screen=/);
  const layout=d.getElementById('screenLayout');
  layout.value='monitor';layout.dispatchEvent(new w.Event('change'));
  await tick();
  assert.equal(requests.find(r=>r.b.action==='screenSettings').b.layout,'monitor');
 }
 d.querySelector('[data-pos-add]').click();
 if(method==='qr'){
  await new Promise(resolve=>setTimeout(resolve,135));
  const draft=requests.filter(r=>r.b.action==='screenDraft').at(-1).b;
  assert.deepEqual(draft.lines,[{name:'Лепёшка',name_ru:'Лепёшка',name_en:'',name_vi:'Bánh mì',quantity:1,unitPrice:25000}]);
  assert.equal(draft.method,null);
 }
 assert.match(d.getElementById('posTotal').textContent,/25/);
 const checkout=d.getElementById('counterCheckout');
 assert.equal(checkout.disabled,true);
 d.querySelector('[data-pos-service='+service+']').click();
 if(service==='delivery'){
  assert.equal(d.getElementById('posDeliveryFields').hidden,false);
  d.getElementById('posDeliveryAddress').value='Nha Trang 012';
  d.getElementById('posDeliveryPhone').value='0901234567';
  d.getElementById('posDeliveryPhone').dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(checkout.disabled,true);
  d.getElementById('posDeliveryMap').click();
 }
 assert.equal(checkout.disabled,false);
 checkout.click();assert.equal(d.getElementById('counterSale').hidden,true);d.querySelector('[data-counter-method='+method+']').click();await tick();d.getElementById('posCash').value='50000';
 const form=d.getElementById('posForm');form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();await tick();assert.equal(created,1,'double tap cannot create two sales');
 assert.equal(paid,method==='cash');assert.equal(d.getElementById('posConfirmQr').hidden,method==='cash');
 if(method==='qr'){
  await new Promise(resolve=>setTimeout(resolve,135));
  const presentation=requests.filter(r=>r.b.action==='screenSelect').at(-1).b;
  assert.equal(presentation.orderId,order.id);
  assert.ok(presentation.revision>requests.find(r=>r.b.action==='screenDraft').b.revision);
  const byId=id=>d.getElementById(id);
  const switchTo=async id=>{
   byId('counterSwitchPayment').click();
   assert.equal(byId('posQr').closest('#posReceipt').hidden,true);
   d.querySelector('[data-counter-method='+id+']').click();
   byId('posForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
   await tick();
   assert.match(byId('posOrderNumber').textContent,/444/);
   assert.equal(created,1);
   assert.equal(paid,false);
  };
  await switchTo('cash');
  assert.equal(byId('posCashLabel').hidden,false);
  assert.equal(byId('posQr').querySelector('svg'),null);
  await switchTo('qr');
 }
 if(method!=='cash'){
  const byId=id=>d.getElementById(id);
  assert.equal(Boolean(byId('posQr').querySelector('svg')),method==='qr');
  assert.match(byId('counterBankDetails').textContent,foreign?/QA-112233/:/UMMA 444/);
  if(currency==='USDT')assert.match(byId('counterBankDetails').textContent,/Test network/);
  byId('posConfirmQr').click();assert.equal(paid,false);
  byId('counterPaymentVerified').click();
  if(foreign){
   assert.equal(byId('posConfirmQr').disabled,true);
   byId('counterPaymentReference').value='QA-7777';
   byId('counterPaymentReference').dispatchEvent(new w.Event('input',{bubbles:true}));
  }
  byId('posConfirmQr').click();await tick();
  assert.equal(paid,true);assert.equal(byId('posConfirmQr').hidden,true);
 }
 assert.match(d.getElementById('posPaymentHint').textContent,/Оплачено/);assert.equal(d.getElementById('posCart').querySelector('[data-id]'),null);w.close();
}
// The server commits before the response is lost. Checking the order reuses its operation key.
{
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://qa.invalid/staff.html',pretendToBeVisual:true});
 const w=dom.window,d=w.document,keys=[];
 w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.ummaKitchen={open(){}};
 w.fetch=async(url,options)=>{
  const body=JSON.parse(options?.body||'{}');
  let out={ok:true};
  if(url.endsWith('cafe-menu'))out.products=[{id:'tea',name_ru:'Чай',price_vnd:50000}];
  if(body.action==='me')Object.assign(out,{user:{id:1,role:'employee'},locations:[{id:'cafe',name:'UMMA'}],
   assignments:[{location_id:'cafe',staff_role:'cashier',can_accept_payments:true}]});
  if(body.action==='list')out.orders=[];
  if(body.staffOrder){
   keys.push(body.requestKey);
   if(keys.length===1)throw Error('Response lost');
   out.order={id:'recovered',orderNumber:445,totalVnd:50000};
  }
  if(body.action==='settle')assert.fail('Recovering the order must not mark it paid');
  return new Response(JSON.stringify(out));
 };
 for(const script of ['web-session','order-requests','web-operations']){
  w.eval(readFileSync('js/cafe/'+script+'.js','utf8'));
  if(script==='web-session')w.ummaStaffAuth.save('a'.repeat(64));
 }
 await tick();
 d.querySelector('[data-pos-add]').click();
 d.querySelector('[data-pos-service=pickup]').click();
 d.getElementById('counterCheckout').click();
 d.querySelector('[data-counter-method=usdt]').click();
 await tick();
 assert.equal(d.getElementById('posSubmit').disabled,true);
 assert.match(d.getElementById('counterMethodStatus').textContent,/не настроены/);
 d.getElementById('posForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
 assert.equal(keys.length,0);
 d.querySelector('[data-counter-method=cash]').click();
 d.getElementById('posCash').value='50000';
 d.getElementById('posForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
 await tick();
 d.querySelector('#webPos [data-cafe-recovery] button').click();
 await tick();
 assert.equal(keys.length,2);
 assert.equal(keys[0],keys[1]);
 assert.match(d.getElementById('posOrderNumber').textContent,/№445/);
 assert.equal(d.getElementById('counterPayment').hidden,false);
 assert.match(d.getElementById('posPaymentHint').textContent,/Оплата ещё не записана/);
 assert.equal(d.querySelector('#posCart [data-id]'),null);
 w.close();
}
// Kitchen readiness reaches the open counter and remains visible until handoff.
{
 const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://qa.invalid/staff.html'});
 const w=dom.window,d=w.document,spoken=[];
 w.AbortSignal=AbortSignal;
 w.scrollTo=()=>{};
 w.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 w.speechSynthesis={speak(utterance){spoken.push(utterance.text);utterance.onend();}};
 w.qrcode=()=>({addData(){},make(){},createSvgTag(){return '<svg></svg>';}});
 w.localStorage.setItem('umma_kitchen_order_voice','off');
 const pickup={id:'pickup',order_number:165,order_type:'pickup',location_id:'cafe',staffRole:'cashier',
  created_via:'staff',payment_status:'paid',status:'preparing',cafe_order_items:[]};
 const dineIn={...pickup,id:'dine-in',order_number:166,order_type:'dine_in',payment_status:'pending'};
 const delivery={...pickup,id:'delivery',order_number:167,order_type:'delivery'};
 const otherCafe={...pickup,id:'other-cafe',order_number:168,location_id:'other'};
 const orders=[pickup,dineIn,delivery,otherCafe];
 w.fetch=async(url,options)=>{
  const body=options?.body?JSON.parse(options.body):{};
  if(url.endsWith('cafe-menu'))return Response.json({ok:true,products:[],inventory:[],locations:[{id:'cafe'}]});
  if(body.action==='me')return Response.json({ok:true,user:{id:1000000000001,role:'employee'},
   assignments:[{location_id:'cafe',staff_role:'cashier',can_accept_payments:true}],locations:[{id:'cafe',name:'UMMA'}]});
  if(body.action==='pair'||body.action==='revoke'){
   assert.match(url,/cafe-pickup-board$/);
   assert.equal(body.locationId,'cafe');
   assert.match(body.initData,/^web:/);
   if(body.action==='revoke')assert.equal(body.token,'b'.repeat(64));
   return Response.json({ok:true,token:'b'.repeat(64)});
  }
  if(body.action==='updateStatus'){
   assert.equal(body.status,'completed');
   assert.equal(body.note,'counter_pickup_call');
   orders.find(order=>order.id===body.orderId).status=body.status;
  }
  return Response.json({ok:true,orders});
 };
 for(const script of ['web-session','order-requests','kitchen-live','web-operations']){
  w.eval(readFileSync('js/cafe/'+script+'.js','utf8'));
  if(script==='web-session')w.ummaStaffAuth.save('a'.repeat(64));
 }
 await tick();
 const refresh=async()=>{d.dispatchEvent(new w.Event('umma:fulfillment-realtime'));await tick();};
 const label=d.getElementById('counterReadyMessage');
 const open=d.getElementById('counterReadyOpen');
 assert.equal(d.body.dataset.workspace,'pos');
 assert.equal(open.hidden,true);
 for(const order of orders)order.status='ready';
 await refresh();
 assert.equal(label.textContent,'Выдать заказ №165');
 assert.equal(d.getElementById('counterSale').hidden,false);
 assert.deepEqual(spoken,[]);
 open.click();
 await tick();
 assert.equal(d.getElementById('counterIssue').hidden,false);
 const pair=d.getElementById('pickupPair');
 const link=d.getElementById('pickupPairLink');
 pair.click();
 await tick();
 assert.equal(link.hidden,false);
 assert.equal(new URL(link.href).pathname,'/pickup-board.html');
 assert.match(link.hash,/^#screen=b{64}$/);
 assert.ok(d.querySelector('#pickupPairQr svg'));
 d.getElementById('pickupUnpair').click();
 await tick();
 assert.equal(link.hidden,true);
 assert.equal(link.hasAttribute('href'),false);
 assert.deepEqual(spoken,['Выдать заказ номер 165.']);
 dineIn.payment_status='paid';
 await refresh();
 assert.equal(label.textContent,'К выдаче: №165, №166');
 await refresh();
 assert.deepEqual(spoken,['Выдать заказ номер 165.','Выдать заказ номер 166.']);
 d.querySelector('[data-counter-action="issue"][data-order-id="pickup"]').click();
 await tick();
 assert.equal(label.textContent,'Выдать заказ №166');
 d.querySelector('[data-counter-action="issue"][data-order-id="dine-in"]').click();
 await tick();
 assert.equal(open.hidden,true);
 assert.equal(label.textContent,'');
 assert.equal(spoken.length,2);
 w.close();
}
// The customer screen tracks the draft, switches payment method with the same order and removes old QR codes.
{
 const dom=new JSDOM(readFileSync('payment-screen.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://qa.invalid/payment-screen.html#screen='+'b'.repeat(64)});
 const w=dom.window,d=w.document;
 w.AbortSignal=AbortSignal;
 let callback,fail=false;
 const lines=[{name:'Лепёшка <из печи>',quantity:2,unitPrice:25000,sku:'UMMA-CAFE-FLATBREAD'}];
 let view={order:null,draft:null,layout:'tablet-small'};
 w.setTimeout=fn=>{callback=fn;return 1;};w.clearTimeout=()=>{};
 w.qrcode=()=>({addData(p){assert.equal(p,'QR amount 50000');},make(){},createSvgTag(){return '<svg></svg>';}});
 w.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);
  assert.deepEqual(Object.keys(body).sort(),['action','screenToken']);
  assert.equal(body.action,'screenPoll');
  if(fail)throw Error('offline');
  return new Response(JSON.stringify({ok:true,...view}));
 };
 w.eval(readFileSync('js/cafe/product-photo.js','utf8'));
 w.eval(readFileSync('js/cafe/payment-screen.js','utf8'));await tick();
 assert.equal(d.getElementById('screenWelcome').hidden,false);
 view={draft:{total:50000,method:null,lines},order:null,layout:'tablet-small'};
 await callback();
 assert.equal(d.getElementById('screenWelcome').hidden,true);
 assert.match(d.getElementById('screenItems').textContent,/Лепёшка <из печи>2 порции/);
 assert.match(d.getElementById('screenTotal').textContent,/50/);
 assert.match(d.querySelector('#screenItems img').src,/flatbread-white-v2/);
 assert.equal(d.querySelector('#screenItems small').textContent,'2 порции');
 assert.equal(w.localStorage.getItem('umma:customer-display-token'),'b'.repeat(64));
 assert.equal(d.documentElement.dataset.displayLayout,'tablet-small');
 assert.equal(d.getElementById('screenQr').hidden,true);
 view={order:{number:10,total:50000,paymentStatus:'pending',status:'pending',method:'qr',lines},
  payment:{qrPayload:'QR amount 50000',bankName:'VCB',account:'123',reference:'UMMA 10'}};
 await callback();
 assert.ok(d.querySelector('#screenQr svg'));
 assert.match(d.getElementById('screenStatus').textContent,/Ожидает оплаты/);
 assert.match(d.getElementById('screenInstruction').textContent,/Сканируйте QR-код/);
 view={order:{...view.order,method:'kaspi',foreignTotal:{amount:1000,currency:'KZT'}},transfer:{phone:'+77000000001',bank:'Kaspi',recipient:'QA'}};
 await callback();
 assert.equal(d.getElementById('screenTransfer').hidden,false);
 assert.equal(d.getElementById('screenTransferPhone').textContent,'+7 700 000 00 01');
 assert.match(d.getElementById('screenMethod').textContent,/Kaspi · KZT/);
 view={order:{...view.order,method:'cash',foreignTotal:null},cashReceived:75000,cashChange:25000};

 await callback();
 assert.equal(d.querySelector('#screenQr svg'),null);
 assert.match(d.getElementById('screenMethod').textContent,/Наличными/);
 assert.equal(d.getElementById('screenTransferPhone').textContent,'');
 assert.equal(d.getElementById('screenCashSummary').hidden,false);
 assert.match(d.getElementById('screenChangeAmount').textContent,/25[.\s]000/);
 view.order.paymentStatus='paid';
 await callback();
 assert.match(d.getElementById('screenNumber').textContent,/№10/);
 assert.match(d.getElementById('screenStatus').textContent,/Оплата прошла успешно/);
 assert.match(d.getElementById('screenChangeAmount').textContent,/25[.\s]000/);
 view.cashReceived=50000;view.cashChange=0;await callback();
 assert.equal(d.getElementById('screenCashSummary').hidden,false);
 assert.match(d.getElementById('screenChangeAmount').textContent,/^0/);
 assert.equal(d.getElementById('screenWelcome').hidden,true,'keep the paid receipt during handoff');
 view.order.status='completed';await callback();
 assert.equal(d.getElementById('screenWelcome').hidden,false,'return to the welcome poster after handoff');
 assert.equal(d.getElementById('screenCashSummary').hidden,true);
 assert.equal(d.getElementById('screenItems').hidden,true);
 view.order.status='pending';
 view.order.paymentStatus='pending';view.order.method='qr';
 view.payment={qrPayload:'QR amount 50000'};
 await callback();assert.ok(d.querySelector('#screenQr svg'));
 assert.equal(d.getElementById('screenCashSummary').hidden,true);
 fail=true;await callback();
 assert.equal(d.querySelector('#screenQr svg'),null);assert.equal(d.getElementById('screenItems').hidden,true);
 w.close();
}
{
 const order={id:'shared-order',order_number:501,location_id:'cafe',created_via:'customer',order_type:'pickup',
  status:'pending',payment_status:'pending',payment_method:'cash',requires_prepayment:true,canAcceptPayments:true,
  staffRole:'kitchen',created_at:'2026-11-20T10:00:00Z',total_vnd:50000,cafe_order_items:[{product_name_ru:'Плов',quantity:1}]};
 const payments=[],handoffs=[];
 let holdCounterList=false,releaseCounterList;
 const respond=(data,status=200)=>Response.json(data,{status});
 const actorFrom=body=>body.initData==='web:'+'a'.repeat(64)?11:12;
 async function fetchShared(url,options){
  const body=JSON.parse(options?.body||'{}');
  const actor=actorFrom(body);
  if(url.endsWith('cafe-menu'))return respond({ok:true,products:[{id:'pilaf',name_ru:'Плов',price_vnd:50000}]});
  if(body.action==='me')return respond({ok:true,user:{id:actor,role:'employee'},locations:[{id:'cafe',name:'UMMA'}],
   assignments:[{location_id:'cafe',staff_role:'kitchen',can_accept_payments:true}]});
  if(body.action==='list'){
   const snapshot=respond({ok:true,orders:[{...order}],staffRole:'kitchen',locationIds:['cafe'],actorTelegramId:actor});
   if(actor===11&&holdCounterList&&!body.workspace){
    holdCounterList=false;
    await new Promise(resolve=>{releaseCounterList=resolve;});
   }
   return snapshot;
  }
  if(body.action==='updatePayment'){
   if(order.payment_status==='pending'){
    payments.push({actor,tendered:body.tenderedAmountVnd});
    Object.assign(order,{payment_status:'paid',status:'confirmed',paid_by_telegram_id:actor});
   }
   return respond({ok:true,order:{paidByTelegramId:order.paid_by_telegram_id}});
  }
  if(body.action==='updateStatus'){
   if(body.status===order.status)return respond({ok:false,error:'Order already has this status'},400);
   if(body.status==='preparing'){
    Object.assign(order,{status:'preparing',accepted_by_telegram_id:actor,preparation_station:'kitchen',preparationActor:'Кухня QA'});
   }else if(body.status==='ready'){
    assert.equal(actor,order.accepted_by_telegram_id);
    order.status='ready';
   }else if(body.status==='completed'){
    assert.equal(order.status,'ready');
    assert.equal(body.note,'counter_pickup_call');
    order.status='completed';
    handoffs.push(actor);
   }
  }
  return respond({ok:true});
 }
 function openPhone(token){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://qa.invalid/staff.html',pretendToBeVisual:true});
  const w=dom.window;
  w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.fetch=fetchShared;
  for(const script of ['web-session','kitchen','web-operations']){
   w.eval(readFileSync('js/cafe/'+script+'.js','utf8'));
   if(script==='web-session')w.ummaStaffAuth.save(token.repeat(64));
  }
  return w;
 }
 const [first,second]=[openPhone('a'),openPhone('b')];
 const click=(w,selector)=>w.document.querySelector(selector).click();
 const text=(w,id)=>w.document.getElementById(id).textContent;
 const feed=w=>w.document.dispatchEvent(new w.Event('umma:fulfillment-realtime'));
 const kitchenCard=()=>second.document.querySelector('[data-kitchen-order="shared-order"]');
 const issueButton=w=>w.document.querySelector('#counterIssueList [data-counter-action=issue]');
 try{
  await tick();
  for(const w of [first,second]){
   click(w,'[data-work-mode=pos]');
   click(w,'[data-counter-view=orders]');
  }
  await tick();
  for(const w of [first,second])click(w,'#counterOrderList [data-counter-action=pay]');
  await tick();
  for(const [w,received] of [[first,60000],[second,90000]]){
   w.document.getElementById('posCash').value=String(received);
   w.document.getElementById('posForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  }
  await tick();
  assert.deepEqual(payments,[{actor:11,tendered:60000}]);
  assert.match(text(first,'posResult'),/Получено.*Сдача/);
  assert.match(text(second,'posResult'),/Заказ уже оплачен/);
  assert.doesNotMatch(text(second,'posResult'),/Сдача/);
  click(first,'[data-counter-view=issue]');
  assert.equal(issueButton(first).textContent,'Собрать и выдать');
  click(second,'#counterExit');
  await tick();
  assert.equal(first.document.body.dataset.workspace,'pos');
  assert.equal(second.document.body.dataset.workspace,'kitchen');
  kitchenCard().querySelector('[data-new-status=preparing]').click();
  await tick();
  feed(first);
  await tick();
  assert.equal(issueButton(first),null,'another employee is preparing the order');
  kitchenCard().querySelector('[data-new-status=ready]').click();
  await tick();
  feed(first);
  await tick();
  assert.equal(kitchenCard(),null);
  assert.match(text(first,'counterReadyMessage'),/Выдать заказ №501/);
  assert.equal(issueButton(first).textContent,'Выдать');
  click(second,'[data-web-tab=pos]');
  click(second,'[data-counter-view=issue]');
  await tick();
  holdCounterList=true;
  feed(first);
  assert.equal(typeof releaseCounterList,'function');
  issueButton(first).click();
  issueButton(second).click();
  await tick();
  assert.deepEqual(handoffs,[11]);
  assert.match(text(second,'counterStatus'),/Заказ №501 уже выдан/);
  releaseCounterList();
  await tick();
  for(const w of [first,second]){
   assert.equal(issueButton(w),null);
   assert.equal(text(w,'counterReadyMessage'),'');
  }
  console.log('PASS two staff sessions: shared cash payment winner, counter-to-kitchen handoff, one issue, and stale response reconciliation.');
 }finally{first.close();second.close();}
}
console.log('PASS counter payment and customer display: live basket, exact draft total, method switching, QR cleanup, successful order receipt, idempotent recovery and read-only customer capability.');
