import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const html=readFileSync('staff.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const tick=()=>new Promise(r=>setTimeout(r,20));
for(const method of ['cash','qr']){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://qa.invalid/staff.html'}),w=dom.window,d=w.document,requests=[];w.AbortSignal=AbortSignal;w.ummaKitchen={open(){}};w.qrcode=()=>({addData(){},make(){},createSvgTag(){return '<svg></svg>';}});
 w.eval(readFileSync('js/cafe/web-session.js','utf8'));w.ummaStaffAuth.save('a'.repeat(64));
 const order={id:'qa-order',orderNumber:444,totalVnd:25000};let created=0,paid=false;
 w.fetch=async(url,opts)=>{const b=opts?.body?JSON.parse(opts.body):{};requests.push({url,b});assert.equal(w.Telegram,undefined);
 let out={ok:true};if(url.endsWith('cafe-menu'))out={ok:true,products:[{id:'bread',name_ru:'Лепёшка',name_vi:'Bánh mì',price_vnd:25000}],inventory:[]};
 else{assert.ok(b.initData?.startsWith('web:'));if(b.action==='me')out={ok:true,user:{id:1000000000001,name:'Cashier',role:'employee'},assignments:[{location_id:'cafe',staff_role:'cashier',can_accept_payments:true}],locations:[{id:'cafe',name:'UMMA'}]};
 else if(b.staffOrder){created++;assert.equal(b.items.length,1);assert.equal(b.items[0].quantity,1);assert.equal(b.orderType,'pickup');assert.equal(b.customerPhone,'');assert.equal(b.paymentMethod,method);out={ok:true,order};}
 else if(b.action==='updatePayment'){assert.equal(b.paymentStatus,'paid');if(method==='cash'){assert.equal(b.tenderedAmountVnd,50000);assert.equal(b.changeGivenVnd,25000);}paid=true;}
 else if(b.action==='payment')out={ok:true,payment:{qrPayload:'test-vietqr-with-25000'}};
 }
 return new Response(JSON.stringify(out));};
 w.eval(readFileSync('js/cafe/order-requests.js','utf8'));w.eval(readFileSync('js/cafe/web-operations.js','utf8'));await tick();await tick();
 assert.equal(d.getElementById('webWorkspace').hidden,false);assert.equal(d.querySelector('[data-web-tab="courier"]').hidden,true);
 d.querySelector('[data-pos-add]').click();assert.match(d.getElementById('posTotal').textContent,/25/);d.getElementById('posMethod').value=method;d.getElementById('posMethod').dispatchEvent(new w.Event('change'));d.getElementById('posCash').value='50000';
 const form=d.getElementById('posForm');form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();await tick();assert.equal(created,1,'double tap cannot create two sales');
 assert.equal(paid,method==='cash');assert.equal(d.getElementById('posConfirmQr').hidden,method==='cash');
 if(method==='qr'){assert.ok(d.getElementById('posQr').querySelector('svg'));d.getElementById('posConfirmQr').click();await tick();assert.equal(paid,true);assert.equal(d.getElementById('posConfirmQr').hidden,true);}
 assert.match(d.getElementById('posPaymentHint').textContent,/Оплачено/);assert.equal(d.getElementById('posCart').querySelector('[data-id]'),null);w.close();
}
// The client screen only reads; cancelled, paid and failed requests immediately hide the QR.
{
 const dom=new JSDOM(readFileSync('payment-screen.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{runScripts:'outside-only',url:'https://qa.invalid/payment-screen.html#screen='+'b'.repeat(64)}),w=dom.window,d=w.document;w.AbortSignal=AbortSignal;let state='pending',fail=false,callback;
 w.setTimeout=fn=>{callback=fn;return 1;};w.clearTimeout=()=>{};w.qrcode=()=>({addData(p){assert.equal(p,'QR amount 25000');},make(){},createSvgTag(){return '<svg></svg>';}});
 w.fetch=async(u,o)=>{const b=JSON.parse(o.body);assert.deepEqual(Object.keys(b).sort(),['action','screenToken']);assert.equal(b.action,'screenPoll');if(fail)throw Error('offline');return new Response(JSON.stringify({ok:true,order:{number:10,total:25000,paymentStatus:state,status:'pending',method:'qr'},payment:state==='pending'?{qrPayload:'QR amount 25000',bankName:'VCB',account:'123',reference:'UMMA 10'}:null}));};
 w.eval(readFileSync('js/cafe/payment-screen.js','utf8'));await tick();assert.ok(d.querySelector('#screenQr svg'));state='paid';await callback();assert.equal(d.querySelector('#screenQr svg'),null);assert.match(d.getElementById('screenStatus').textContent,/Paid/);state='pending';await callback();assert.ok(d.querySelector('#screenQr svg'));fail=true;await callback();assert.equal(d.querySelector('#screenQr svg'),null);w.close();
}
console.log('PASS standalone web POS without Telegram: cash/change receipt, QR remains pending until explicit confirmation, duplicate-tap guard, role-specific navigation; client screen is read-only and hides stale QR after payment/failure.');
