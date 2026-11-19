import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const html=readFileSync('staff.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const tick=()=>new Promise(r=>setTimeout(r,20));
for(const method of ['cash','qr','rub','sber','tenge','kaspi','usdt']){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://qa.invalid/staff.html'}),w=dom.window,d=w.document,requests=[];w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.ummaKitchen={open(){}};w.qrcode=()=>({addData(){},make(){},createSvgTag(){return '<svg></svg>';}});
 w.eval(readFileSync('js/cafe/web-session.js','utf8'));w.ummaStaffAuth.save('a'.repeat(64));
 const order={id:'qa-order',orderNumber:444,totalVnd:25000};let created=0,paid=false,currentMethod=method;
 const foreign=!['cash','qr'].includes(method);
 const currency=method==='usdt'?'USDT':['tenge','kaspi'].includes(method)?'KZT':'RUB';
 w.confirm=()=>assert.fail('Payment confirmation must stay on the page');
 w.fetch=async(url,opts)=>{const b=opts?.body?JSON.parse(opts.body):{};requests.push({url,b});assert.equal(w.Telegram,undefined);
 let out={ok:true};if(url.endsWith('cafe-menu'))out={ok:true,products:[{id:'bread',name_ru:'Лепёшка',name_vi:'Bánh mì',price_vnd:25000}],inventory:[]};
 else{assert.ok(b.initData?.startsWith('web:'));if(b.action==='me')out={ok:true,user:{id:1000000000001,name:'Cashier',role:'employee'},assignments:[{location_id:'cafe',staff_role:'cashier',can_accept_payments:true}],locations:[{id:'cafe',name:'UMMA'}]};
 else if(b.action==='screenCreate')out={ok:true,id:'client-screen',screenToken:'b'.repeat(64)};
 else if(b.action==='options')out.methods={rub:true,sber:true,tenge:true,kaspi:true,usdt:true};
 else if(b.staffOrder){
  created++;assert.equal(b.items.length,1);assert.equal(b.items[0].quantity,1);
  if(foreign){
   assert.match(url,/cafe-counter-payment$/);assert.equal(b.method,method);assert.equal(b.action,'create');
   out={ok:true,order,payment:{currency,amount:currency==='USDT'?0.95431:82.15,bankName:'QA Bank',account:'QA-112233',network:currency==='USDT'?'Test network':null}};
  }else{
   assert.equal(b.orderType,'pickup');assert.equal(b.customerPhone,'');assert.equal(b.paymentMethod,method);out={ok:true,order};
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
  assert.deepEqual(draft.lines,[{name:'Лепёшка',quantity:1,unitPrice:25000}]);
  assert.equal(draft.method,null);
 }assert.match(d.getElementById('posTotal').textContent,/25/);d.getElementById('counterCheckout').click();assert.equal(d.getElementById('counterSale').hidden,true);d.querySelector('[data-counter-method='+method+']').click();await tick();d.getElementById('posCash').value='50000';
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
// The customer screen tracks the draft, switches payment method with the same order and removes old QR codes.
{
 const dom=new JSDOM(readFileSync('payment-screen.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{runScripts:'outside-only',url:'https://qa.invalid/payment-screen.html#screen='+'b'.repeat(64)});
 const w=dom.window,d=w.document;
 w.AbortSignal=AbortSignal;
 let callback,fail=false;
 const lines=[{name:'Лепёшка <из печи>',quantity:2,unitPrice:25000,sku:'UMMA-CAFE-FLATBREAD'}];
 let view={draft:{total:50000,method:null,lines},order:null,layout:'tablet-small'};
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
 assert.match(d.getElementById('screenItems').textContent,/Лепёшка <из печи> × 2/);
 assert.match(d.getElementById('screenTotal').textContent,/50/);
 assert.match(d.querySelector('#screenItems img').src,/flatbread-white-v2/);
 assert.match(d.querySelector('#screenItems small').textContent,/25/);
 assert.equal(w.localStorage.getItem('umma:customer-display-token'),'b'.repeat(64));
 assert.equal(d.documentElement.dataset.displayLayout,'tablet-small');
 assert.equal(d.getElementById('screenQr').hidden,true);
 view={order:{number:10,total:50000,paymentStatus:'pending',status:'pending',method:'qr',lines},
  payment:{qrPayload:'QR amount 50000',bankName:'VCB',account:'123',reference:'UMMA 10'}};
 await callback();
 assert.ok(d.querySelector('#screenQr svg'));
 assert.match(d.getElementById('screenStatus').textContent,/Unpaid/);
 view={order:{...view.order,method:'kaspi',foreignTotal:{amount:1000,currency:'KZT'}},transfer:{phone:'+77000000001',bank:'Kaspi',recipient:'QA'}};
 await callback();
 assert.equal(d.getElementById('screenTransfer').hidden,false);
 assert.equal(d.getElementById('screenTransferPhone').textContent,'+77000000001');
 assert.match(d.getElementById('screenTransferBank').textContent,/Kaspi/);
 view={order:{...view.order,method:'cash',foreignTotal:null}};

 await callback();
 assert.equal(d.querySelector('#screenQr svg'),null);
 assert.match(d.getElementById('screenMethod').textContent,/Наличными/);
 assert.equal(d.getElementById('screenTransferPhone').textContent,'');
 view.order.paymentStatus='paid';
 await callback();
 assert.match(d.getElementById('screenNumber').textContent,/№10/);
 assert.match(d.getElementById('screenStatus').textContent,/Payment successful/);
 view.order.paymentStatus='pending';view.order.method='qr';
 view.payment={qrPayload:'QR amount 50000'};
 await callback();assert.ok(d.querySelector('#screenQr svg'));
 fail=true;await callback();
 assert.equal(d.querySelector('#screenQr svg'),null);assert.equal(d.getElementById('screenItems').hidden,true);
 w.close();
}
console.log('PASS counter payment and customer display: live basket, exact draft total, method switching, QR cleanup, successful order receipt, idempotent recovery and read-only customer capability.');
