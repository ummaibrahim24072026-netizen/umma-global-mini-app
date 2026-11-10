import {JSDOM} from 'jsdom';import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';import assert from 'node:assert/strict';
const read=p=>readFileSync(p,'utf8'),html=read('staff.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),tick=()=>new Promise(r=>setTimeout(r,20));
for(const role of ['kitchen','cashier','kitchen_cashier']){
 const dom=new JSDOM(html,{url:'https://qa.invalid/staff.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document,requests=[],receipts=new Map();let qty=0,lost=true,orders=[];w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.ummaKitchen={open(){}};w.HTMLElement.prototype.scrollIntoView=()=>{};w.eval(read('js/cafe/web-session.js'));w.ummaStaffAuth.save('a'.repeat(64));
 const assigned=role==='kitchen_cashier'?'kitchen':role,paid=role!=='kitchen';
 w.fetch=async(url,o)=>{const b=JSON.parse(o?.body||'{}');requests.push(b);let out={ok:true};if(url.endsWith('cafe-menu'))out={ok:true,products:[{id:'bread',name_ru:'Лепёшка',sku:'UMMA-CAFE-FLATBREAD',description_ru:'Лепёшка <из печи>',price_vnd:25000},{id:'dessert',name_ru:'Медовик',description_en:'Honey cake',price_vnd:25000,image_url:'assets/cafe/dessert-2-white.webp'}],inventory:[{product_id:'bread',location_id:'cafe',quantity:2,reserved_quantity:0,ready_stock_confirmed:true,ready_stock_state:'ready',is_available:true},{product_id:'dessert',location_id:'cafe',quantity:1,ready_stock_confirmed:true,ready_stock_state:'ready',is_available:true}]};
 else if(b.action==='me')out={ok:true,user:{id:100,name:'QA universal',role:'employee'},locations:[{id:'cafe',name:'HALAL UMMA',ready_stock_enabled:true}],assignments:[{location_id:'cafe',staff_role:assigned,can_accept_payments:paid}]};
 else if(b.action==='list')out={ok:true,staffRole:assigned,locationIds:['cafe'],orders};
 else if(b.action==='stockList')out={ok:true,products:[{id:'bread',name:'Лепёшка',quantity:2,reserved:0,available:2,confirmed:true,state:'ready'}]};
 else if(b.staffOrder)out={ok:true,order:{id:'order',orderNumber:25,totalVnd:25000}};
 else if(b.action==='ingredientList')out={ok:true,stock:[{id:'raw',name:'Мука',unit:'kg',quantity:qty,averageCostVnd:20000}],purchases:qty?[{id:'receipt',date:b.date,note:'QA store',totalVnd:40000,items:[{name:'Мука',unit:'kg',quantity:2,unitCostVnd:20000,totalVnd:40000}]}]:[],dayTotalVnd:qty?40000:0};
 else if(b.action==='ingredientReceive'){if(!receipts.has(b.requestKey)){qty+=b.items[0].quantity;receipts.set(b.requestKey,{ok:true,subtotalVnd:40000});}if(lost){lost=false;throw Error('Lost response after commit');}out=receipts.get(b.requestKey);}
 return new Response(JSON.stringify(out));};
 w.eval(read('js/cafe/order-requests.js'));w.eval(read('js/cafe/ingredients.js'));w.eval(read('js/cafe/ready-stock.js'));w.eval(read('js/cafe/product-photo.js'));w.eval(read('js/cafe/web-operations.js'));await tick();await tick();
 assert.equal(d.querySelector('[data-web-tab=pos]').hidden,!paid);assert.equal(d.querySelector('[data-web-tab=ingredients]').hidden,role==='cashier');assert.equal(d.body.dataset.workspace,role==='kitchen'?'orders':'pos');assert.equal(d.getElementById('readyStockPanel').dataset.allowed,assigned==='kitchen'?'true':'false');
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
  const existingOrder={id:'already-open',location_id:'cafe',created_via:'customer',order_number:164,
    status:'pending',created_at:'2026-11-10T09:00:00Z',cafe_order_items:[]};
  orders=[existingOrder];
  d.querySelector('[data-web-tab=pos]').click();
  await tick();
  d.getElementById('kitchenAudioTest').click();
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.deepEqual(tones,[660,880]);
  assert.match(speech[0].text,/Проверка звука/);
  assert.equal(d.getElementById('counterIncoming').hidden,false);
  const breadPhoto=d.querySelector('[data-pos-product="bread"] img');
  assert.match(breadPhoto.src,/logo\/assets\/menu\/flatbread-white-v2.webp$/);
  assert.match(d.querySelector('[data-pos-product="dessert"] img').src,/assets\/cafe\/dessert-2-white.webp$/);
  const description=d.querySelector('[data-pos-product="bread"] details');
  assert.equal(description.open,false);
  assert.equal(description.querySelector('summary').textContent,'Описание');
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
  assert.equal(d.getElementById('cafeKitchenPage').hidden,false);
  d.querySelector('[data-pos-add]').click();
  const online={id:'online',location_id:'cafe',created_via:'customer',order_number:165,order_type:'pickup',
    status:'pending',payment_status:'pending',payment_method:'cash',requires_prepayment:true,canAcceptPayments:true,
    created_at:'2026-11-10T10:00:00Z',total_vnd:50000,cafe_order_items:[{product_name_ru:'Плов',quantity:2,line_total_vnd:50000,product:{sku:'UMMA-CAFE-PLOV'}},{product_name_ru:'Архивное блюдо',quantity:1,line_total_vnd:0,product:null}]};
  orders=[online,{...online,id:'other-location',location_id:'other',order_number:166},{...online,id:'staff-sale',created_via:'staff',order_number:167}];
  await new Promise(resolve=>setTimeout(resolve,2450));
  assert.deepEqual(tones,[660,880,660,880]);
  assert.deepEqual(speech.map(entry=>entry.lang),['ru-RU','ru-RU']);
  assert.equal(speech[1].text,'Новый заказ номер 165. Плов — 2. Архивное блюдо — 1.');
  assert.match(d.getElementById('counterIncomingTitle').textContent,/№165/);
  const preview=d.getElementById('counterIncomingItems');
  assert.match(preview.textContent,/Плов × 2/);
  assert.match(preview.textContent,/Ждёт оплаты/);
  assert.match(preview.querySelector('img').src,/logo\/assets\/menu\/plov-white-v2.webp$/);
  const orderItems=d.querySelector('[data-kitchen-order="online"] .kitchen-order-items');
  assert.equal(orderItems.querySelector('img').src,preview.querySelector('img').src);
  assert.equal(orderItems.querySelectorAll('img').length,1);
  assert.match(orderItems.textContent,/Архивное блюдо × 1/);
  const orderPhoto=orderItems.querySelector('img');
  orderPhoto.dispatchEvent(new w.Event('error'));
  assert.equal(orderPhoto.hidden,true);
  assert.equal(d.getElementById('counterOrderCount').textContent,'1');
  assert.ok(d.querySelector('[data-kitchen-order="online"] [data-payment-status="paid"]'));
  assert.equal(d.querySelector('[data-kitchen-order="other-location"]'),null);
  d.getElementById('counterOpenOrders').click();
  assert.equal(d.body.dataset.workspace,'orders');
  d.querySelector('[data-web-tab=pos]').click();
  assert.match(d.getElementById('posCart').textContent,/Лепёшка/);
  await tick();
  assert.equal(tones.length,4);
  const voice=d.getElementById('kitchenOrderVoice');
  voice.click();
  assert.equal(w.localStorage.getItem('umma_kitchen_order_voice'),'off');
  orders=[...orders,{...online,id:'another-online',order_number:168}];
  await w.ummaKitchen.refresh();
  await tick();
  assert.deepEqual(tones,[660,880,660,880,660,880]);
  assert.equal(speech.length,2);
d.getElementById('posCash').value='50000';d.getElementById('posForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();await tick();assert.equal(requests.filter(b=>b.staffOrder).length,1);assert.equal(requests.find(b=>b.action==='updatePayment').paymentStatus,'paid');}
 if(assigned==='kitchen'){d.querySelector('[data-web-tab=ingredients]').click();await tick();const set=(field,v)=>{const input=d.querySelector('[data-ingredient='+field+']');input.value=v;input.dispatchEvent(new w.Event('input',{bubbles:true}));};set('name','Мука');set('quantity','2');set('unitCostVnd','20000');d.getElementById('ingredientSupplier').value='QA store';const submit=()=>d.getElementById('ingredientForm').dispatchEvent(new w.Event('submit',{cancelable:true}));submit();await tick();assert.match(d.getElementById('ingredientNotice').textContent,/не продублируется/);assert.equal(d.getElementById('ingredientFields').disabled,true);submit();await tick();await tick();const calls=requests.filter(b=>b.action==='ingredientReceive');assert.equal(calls[0].requestKey,calls[1].requestKey);assert.equal(qty,2);assert.equal(d.getElementById('ingredientFields').disabled,false);assert.match(d.getElementById('ingredientHistory').textContent,/Мука/);assert.match(d.getElementById('ingredientDayTotal').textContent,/40/);
 if(role==='kitchen_cashier'){d.querySelectorAll('input').forEach(i=>i.setAttribute('value',i.value));mkdirSync('preview-dist',{recursive:true});writeFileSync('preview-dist/ingredients.html',dom.serialize());cpSync('css','preview-dist/css',{recursive:true});cpSync('logo','preview-dist/logo',{recursive:true});}
 }
 w.close();
}
console.log('PASS universal kitchen UI: three independent role modes, combined cash sale/change/payment, live incoming orders with a preserved cart and one audio alert per app order, optional voice, kitchen revision access, ingredient daily history and exact lost-response retry without double receiving.');
