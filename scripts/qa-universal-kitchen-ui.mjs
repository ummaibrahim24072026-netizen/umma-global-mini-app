import {JSDOM} from 'jsdom';import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';import assert from 'node:assert/strict';
const read=p=>readFileSync(p,'utf8'),html=read('staff.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),tick=()=>new Promise(r=>setTimeout(r,20));
for(const role of ['kitchen','cashier','kitchen_cashier']){
 const requests=[],receipts=new Map();let qty=0,lost=true,orders=[],rejectReady=false;
 const assigned=role==='kitchen_cashier'?'kitchen':role,paid=role!=='kitchen';
 const fetch=async(url,o)=>{const b=JSON.parse(o?.body||'{}');requests.push(b);let out={ok:true};if(url.endsWith('cafe-menu'))out={ok:true,products:[{id:'bread',name_ru:'Лепёшка',sku:'UMMA-CAFE-FLATBREAD',description_ru:'Лепёшка <из печи>',price_vnd:25000},{id:'dessert',name_ru:'Медовик',description_en:'Honey cake',price_vnd:25000,image_url:'assets/cafe/dessert-2-white.webp'}],inventory:[{product_id:'bread',location_id:'cafe',quantity:2,reserved_quantity:0,ready_stock_confirmed:true,ready_stock_state:'ready',is_available:true},{product_id:'dessert',location_id:'cafe',quantity:1,ready_stock_confirmed:true,ready_stock_state:'ready',is_available:true}]};
 else if(b.action==='me')out={ok:true,user:{id:100,name:'QA universal',role:'employee'},locations:[{id:'cafe',name:'HALAL UMMA',ready_stock_enabled:true}],assignments:[{location_id:'cafe',staff_role:assigned,can_accept_payments:paid}]};
 else if(b.action==='list')out={ok:true,staffRole:assigned,locationIds:['cafe'],orders:orders.map(order=>({...order,staffRole:assigned}))};
 else if(b.action==='updateStatus'){
  if(rejectReady&&b.status==='ready')return new Response(JSON.stringify({ok:false,error:'Повторите попытку'}),{status:503});
  orders=orders.map(order=>order.id===b.orderId?{...order,status:b.status}:order);
 }
 else if(b.action==='stockList')out={ok:true,products:[{id:'bread',name:'Лепёшка',quantity:2,reserved:0,available:2,confirmed:true,state:'ready'}]};
 else if(b.staffOrder)out={ok:true,order:{id:'order',orderNumber:25,totalVnd:25000}};
 else if(b.action==='ingredientList')out={ok:true,stock:[{id:'raw',name:'Мука',unit:'kg',quantity:qty,averageCostVnd:20000}],purchases:qty?[{id:'receipt',date:b.date,note:'QA store',totalVnd:40000,items:[{name:'Мука',unit:'kg',quantity:2,unitCostVnd:20000,totalVnd:40000}]}]:[],dayTotalVnd:qty?40000:0};
 else if(b.action==='ingredientReceive'){if(!receipts.has(b.requestKey)){qty+=b.items[0].quantity;receipts.set(b.requestKey,{ok:true,subtotalVnd:40000});}if(lost){lost=false;throw Error('Lost response after commit');}out=receipts.get(b.requestKey);}
 return new Response(JSON.stringify(out));};
 async function openWorkspace(path){
  const dom=new JSDOM(html,{url:'https://qa.invalid/'+path,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.ummaKitchen={open(){}};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=fetch;
  w.eval(read('js/cafe/web-session.js'));w.ummaStaffAuth.save('a'.repeat(64));
  for(const script of ['order-requests','ingredients','ready-stock','product-photo','web-operations'])w.eval(read('js/cafe/'+script+'.js'));
  await tick();await tick();
  return dom;
 }
 const staff=await openWorkspace('staff.html');
 {
 const w=staff.window,d=w.document;
 assert.equal(d.querySelector('[data-web-tab=pos]').hidden,!paid);assert.equal(d.querySelector('[data-web-tab=ingredients]'),null);assert.equal(d.body.dataset.workspace,role==='kitchen'?'kitchen':'pos');assert.equal(d.getElementById('readyStockPanel').dataset.allowed,assigned==='kitchen'?'true':'false');
 assert.equal(d.getElementById('readyStockPanel').hidden,true,'order and counter views exclude planning');
 assert.equal(d.querySelector('[data-web-tab=kitchen]').hidden,role==='cashier');
 assert.equal(d.querySelector('[data-web-tab=portions]').hidden,role==='cashier');
 assert.equal(d.querySelector('[data-web-tab=orders]').hidden,role==='kitchen');
 if(role!=='cashier'){
  d.querySelector('[data-web-tab=portions]').click();
  assert.equal(d.body.dataset.workspace,'portions');
  assert.equal(d.getElementById('readyStockPanel').hidden,false);
  assert.equal(d.getElementById('cafeKitchenPage').hidden,true);
  assert.equal(d.getElementById('webPos').hidden,true);
  d.querySelector('[data-web-tab=kitchen]').click();
  assert.equal(d.body.dataset.workspace,'kitchen');
  assert.equal(d.getElementById('readyStockPanel').hidden,true);
  assert.equal(d.getElementById('cafeKitchenPage').hidden,false);
  d.querySelector('[data-web-tab=pos]').click();
 }
 if(role==='kitchen'){
  const tones=[],speech=[];
  let audioAllowed=false,resumeAttempts=0,poll;
  w.localStorage.setItem('umma_kitchen_order_voice','off');
  w.AudioContext=class {
   state='suspended';currentTime=0;
   async resume(){resumeAttempts++;if(audioAllowed)this.state='running';}
   createOscillator(){return {frequency:{},connect(){},start(){tones.push(this.frequency.value);},stop(){}};}
   createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
  };
  w.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
  w.speechSynthesis={speak(utterance){speech.push(utterance.text);utterance.onend();}};
  w.eval(read('js/cafe/kitchen.js'));
  w.eval(read('js/cafe/kitchen-live.js'));
  const pickup={id:'pickup',order_number:25,location_id:'cafe',status:'pending',order_type:'pickup',
    created_at:'2026-11-20T07:00:00Z',created_via:'staff',payment_status:'paid',customer_note:'Соус отдельно',
    cafe_order_items:[{product_name_ru:'Манты',quantity:2,line_total_vnd:300000}]};
  orders=[pickup,{...pickup,id:'dine-in',order_type:'dine_in',order_number:26},
    {...pickup,id:'delivery',order_type:'delivery',order_number:27},
    {...pickup,id:'unpaid',created_via:'customer',payment_status:'pending'},
    {...pickup,id:'already-ready',status:'ready'},
    {...pickup,id:'preorder',order_number:28,preorder_waiting:true,preorder_expected_at:'2026-11-20T10:00:00Z'}];
  const originalSetInterval=w.setInterval;
  w.setInterval=(callback,delay)=>{assert.equal(delay,2000);poll=callback;return 1;};
  d.querySelector('[data-web-tab=kitchen]').click();
  w.setInterval=originalSetInterval;
  await tick();
  assert.ok(resumeAttempts>0,'kitchen tries to enable audio as soon as it opens');
  const header=d.querySelector('.cafe-kitchen-header');
  const tools=header.querySelector('.kitchen-board-tools');
  const tablet=d.getElementById('kitchenTabletToggle');
  assert.equal(tools.hidden,true);
  assert.equal(tablet.parentElement,header);
  assert.equal(tablet.hidden,false);
  audioAllowed=true;
  header.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  tablet.click();
  assert.equal(tablet.getAttribute('aria-pressed'),'true');
  assert.equal(d.getElementById('cafeKitchenPage').classList.contains('kitchen-tablet-mode'),true);
  tablet.click();
  assert.equal(tablet.getAttribute('aria-pressed'),'false');
  assert.deepEqual(tones,[]);
  const card=id=>d.querySelector('[data-kitchen-order="'+id+'"]');
  orders.push({...pickup,id:'new-counter-order',order_number:29});
  poll();
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.ok(card('new-counter-order'),'a new order renders without manual refresh');
  assert.deepEqual(tones,[660,880]);
  assert.deepEqual(speech,['Новый заказ номер 29. Манты — 2.']);
  poll();
  await tick();
  assert.deepEqual(tones,[660,880],'automatic refresh does not repeat the alert');
  assert.equal(d.querySelector('#cafeKitchenPage h1').textContent,'Кухня');
  assert.equal(d.getElementById('cafeCashToggle').hidden,true);
  assert.equal(d.querySelector('.cafe-kitchen-filters').hidden,true);
  assert.equal(card('already-ready'),null);
  assert.equal(card('unpaid'),null);
  assert.match(card('pickup').textContent,/С собой.*Манты× 2.*Соус отдельно/);
  assert.match(card('dine-in').textContent,/На месте/);
  assert.match(card('delivery').textContent,/Доставка/);
  assert.match(card('preorder').textContent,/Ждёт партию/);
  assert.equal(card('preorder').querySelector('[data-new-status]'),null);
  assert.equal(card('pickup').querySelector('.kitchen-order-total'),null);
  const accept=card('pickup').querySelector('[data-new-status=preparing]');
  assert.equal(accept.textContent,'Принять');
  accept.click();
  await tick();
  assert.match(card('pickup').textContent,/Готовится/);
  const ready=()=>card('pickup').querySelector('[data-new-status=ready]');
  assert.equal(ready().textContent,'Готово');
  rejectReady=true;
  ready().click();
  await tick();
  assert.ok(ready(),'failed handoff keeps the order actionable');
  rejectReady=false;
  ready().click();
  await tick();
  assert.equal(card('pickup'),null);
  await w.ummaKitchen.refresh({silent:true});
  assert.equal(card('pickup'),null,'a server refresh does not bring back a ready order');
 }
 assert.equal(d.getElementById('webIngredients').hidden,true);
 assert.equal(d.getElementById('webStockLink').hidden,role==='cashier');
 assert.equal(d.getElementById('webStockLink').getAttribute('href'),'staff.html?work=stock');
 assert.equal(requests.some(b=>b.action==='ingredientList'),false);
 if(role==='kitchen_cashier'){
  const tones=[],speech=[];
  w.AudioContext=class {
   state='running';currentTime=0;
   createOscillator(){return {frequency:{},connect(){},start(){tones.push(this.frequency.value);},stop(){}};}
   createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
  };
  w.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
  w.speechSynthesis={speak(utterance){speech.push(utterance);utterance.onend();}};
  w.eval(read('js/cafe/kitchen.js'));
  w.eval(read('js/cafe/kitchen-live.js'));
  const existingOrder={order_type:'pickup',id:'already-open',location_id:'cafe',created_via:'customer',order_number:164,
    status:'pending',created_at:'2026-11-10T09:00:00Z',cafe_order_items:[]};
  orders=[existingOrder];
  d.querySelector('[data-web-tab=pos]').click();
  await tick();
  d.getElementById('kitchenAudioTest').click();
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.deepEqual(tones,[660,880]);
  assert.match(speech[0].text,/Проверка звука/);
  const breadPhoto=d.querySelector('[data-pos-product="bread"] img');
  assert.match(breadPhoto.src,/logo\/assets\/menu\/flatbread-white-v2.webp$/);
  assert.match(d.querySelector('[data-pos-product="dessert"] img').src,/assets\/cafe\/dessert-2-white.webp$/);
  const description=d.querySelector('[data-pos-product="bread"] details');
  assert.equal(description.open,false);
  assert.equal(description.querySelector('summary').textContent,'Состав и описание');
  assert.equal(description.querySelector('p').textContent,'Лепёшка <из печи>');
  assert.equal(d.querySelector('[data-pos-product="dessert"] details p').textContent,'Honey cake');
  description.querySelector('summary').click();
  assert.equal(description.open,true);
  assert.match(d.getElementById('posCart').textContent,/Добавьте хотя бы один товар/);
  description.querySelector('summary').click();
  assert.equal(description.open,false);
  assert.equal(w.ummaCafeProductPhoto({image_url:'javascript:alert(1)'}),'');
  breadPhoto.dispatchEvent(new w.Event('error'));
  assert.equal(breadPhoto.hidden,true);
  assert.equal(d.getElementById('cafeKitchenPage').hidden,true);
  d.querySelector('[data-pos-add]').click();
  const online={id:'online',location_id:'cafe',created_via:'customer',order_number:165,order_type:'pickup',
    status:'pending',payment_status:'pending',payment_method:'cash',requires_prepayment:true,canAcceptPayments:true,
    created_at:'2026-11-10T10:00:00Z',total_vnd:50000,cafe_order_items:[{product_name_ru:'Плов',quantity:2,line_total_vnd:50000,product:{sku:'UMMA-CAFE-PLOV'}},{product_name_ru:'Архивное блюдо',quantity:1,line_total_vnd:0,product:null}]};
  orders=[online,{...online,id:'other-location',location_id:'other',order_number:166},{...online,id:'staff-sale',created_via:'staff',order_number:167}];
  d.dispatchEvent(new w.Event('umma:cafe-events'));
  await new Promise(resolve=>setTimeout(resolve,450));
  assert.deepEqual(tones,[660,880,660,880]);
  assert.deepEqual(speech.map(entry=>entry.lang),['ru-RU','ru-RU']);
  assert.equal(speech[1].text,'Новый заказ номер 165. Плов — 2. Архивное блюдо — 1.');
  assert.match(d.getElementById('counterOnline').textContent,/Из приложения/);
  d.getElementById('counterOnline').click();
  await tick();
  const orderCard=id=>d.querySelector('#counterOrderList [data-counter-order="'+id+'"]');
  assert.match(orderCard('online').textContent,/Плов × 2/);
  assert.match(orderCard('online').textContent,/Ожидает оплаты/);
  assert.equal(orderCard('other-location'),null);
  assert.equal(d.querySelector('#counterOrderList article').dataset.counterOrder,'staff-sale');
  assert.ok(orderCard('online').querySelector('[data-counter-action=pay]'));
  d.querySelector('[data-counter-view=sale]').click();
  assert.match(d.getElementById('posCart').textContent,/Лепёшка/);
  d.getElementById('kitchenOrderVoice').click();
  assert.equal(w.localStorage.getItem('umma_kitchen_order_voice'),'off');
  orders=[...orders,{...online,id:'another-online',order_number:168}];
  d.dispatchEvent(new w.Event('umma:cafe-events'));
  await tick();
  assert.deepEqual(tones,[660,880,660,880,660,880]);
  assert.equal(speech.length,2);
  orders=orders.map(order=>order.id==='online'?{...order,status:'preparing',payment_status:'paid'}:
   order.id==='another-online'?{...order,status:'ready',payment_status:'pending'}:order);
  orders.push({...online,id:'delivery-handoff',created_via:'staff',order_type:'delivery',
   order_number:169,status:'preparing',payment_status:'paid'});
  d.getElementById('counterExit').click();
  d.querySelector('[data-web-tab=kitchen]').click();
  await tick();
  for(const id of ['online','delivery-handoff']){
   const kitchenCard=()=>d.querySelector('[data-kitchen-order="'+id+'"]');
   kitchenCard().querySelector('[data-new-status=ready]').click();
   await tick();
   assert.equal(kitchenCard(),null);
  }
  d.querySelector('[data-web-tab=orders]').click();
  assert.equal(d.querySelector('.cafe-kitchen-filters').hidden,false);
  assert.equal(d.querySelector('.kitchen-board-tools').hidden,false);
  assert.ok(d.querySelector('.kitchen-board-tools #kitchenTabletToggle'));
  d.querySelector('[data-web-tab=pos]').click();
  d.querySelector('[data-counter-view=orders]').click();
  await tick();
  assert.match(orderCard('delivery-handoff').textContent,/Готов.*Доставка/);
  d.querySelector('[data-counter-view=issue]').click();
  await tick();
  const issueCard=id=>d.querySelector('#counterIssueList [data-counter-order="'+id+'"]');
  assert.equal(issueCard('another-online'),null,'unpaid ready orders cannot be handed over');
  w.confirm=()=>assert.fail('Issuing at the counter should take one tap');
  issueCard('online').querySelector('[data-counter-action=issue]').click();
  await tick();
  assert.equal(issueCard('online'),null);
  d.querySelector('[data-counter-view=orders]').click();
  const filter=d.getElementById('counterOrderFilter');
  filter.value='closed';filter.dispatchEvent(new w.Event('change'));
  assert.match(orderCard('online').textContent,/Выдан/);
  d.querySelector('[data-counter-view=sale]').click();
  d.getElementById('counterCheckout').click();
  d.getElementById('posCash').value='50000';
  d.getElementById('posForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await tick();await tick();
  assert.equal(requests.filter(b=>b.staffOrder).length,1);
  assert.equal(requests.find(b=>b.action==='settle').expectedMethod,'cash');}

 }
 staff.window.close();
 const dom=await openWorkspace('staff.html?work=stock'),w=dom.window,d=w.document;
 assert.equal(d.getElementById('webWorkspace').hidden,true);
 assert.equal(d.getElementById('webIngredients').hidden,role==='cashier');
 assert.equal(d.getElementById('webStockDenied').hidden,role!=='cashier');
 assert.equal(requests.some(b=>b.action==='ingredientList'),role!=='cashier');
 if(assigned==='kitchen'){const set=(field,v)=>{const input=d.querySelector('[data-ingredient='+field+']');input.value=v;input.dispatchEvent(new w.Event('input',{bubbles:true}));};set('name','Мука');set('quantity','2');set('unitCostVnd','20000');d.getElementById('ingredientSupplier').value='QA store';const submit=()=>d.getElementById('ingredientForm').dispatchEvent(new w.Event('submit',{cancelable:true}));submit();await tick();assert.match(d.getElementById('ingredientNotice').textContent,/не продублируется/);assert.equal(d.getElementById('ingredientFields').disabled,true);submit();await tick();await tick();const calls=requests.filter(b=>b.action==='ingredientReceive');assert.equal(calls[0].requestKey,calls[1].requestKey);assert.equal(qty,2);assert.equal(d.getElementById('ingredientFields').disabled,false);assert.match(d.getElementById('ingredientHistory').textContent,/Мука/);assert.match(d.getElementById('ingredientDayTotal').textContent,/40/);
 if(role==='kitchen_cashier'){d.querySelectorAll('input').forEach(i=>i.setAttribute('value',i.value));mkdirSync('preview-dist',{recursive:true});writeFileSync('preview-dist/ingredients.html',dom.serialize());cpSync('css','preview-dist/css',{recursive:true});cpSync('logo','preview-dist/logo',{recursive:true});}
 }
 w.close();
}
console.log('PASS universal kitchen UI: three independent role modes, combined cash sale/change/payment, live incoming orders with a preserved cart and one audio alert per app order, optional voice, kitchen revision access, ingredient daily history and exact lost-response retry without double receiving.');
