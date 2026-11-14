import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {paymentFor} from '../supabase/functions/cafe-my-orders/payment.ts';
const read=p=>readFileSync(p,'utf8'),html=read('menu/index.html').replace(/<script src="js\/cafe\/public-menu-delivery\.js\?v=\d+"><\/script>/,()=>'<script>'+read('js/cafe/public-menu-delivery.js')+'</script>');
const product={id:'def936dc-6c57-4b06-ac32-cdf6a736c238',sku:'UMMA-CAFE-SHURPA',name_ru:'Шурпа',price_vnd:90000};
const cafe={id:'e22788bd-4734-4b3a-911e-ba103d52617a',latitude:12.28,longitude:109.20,delivery_zone:[[12.2,109.1],[12.3,109.1],[12.3,109.3],[12.2,109.3]]};
const tick=()=>new Promise(r=>setTimeout(r,25));
for(const method of ['cash','qr']){
 let calls=[],lost=true,gps,receipt;
 const dom=new JSDOM(html,{url:'https://example.com/umma-global-mini-app/menu/',runScripts:'dangerously',beforeParse(w){
  w.localStorage.setItem('umma-menu-language','ru');w.AbortSignal=AbortSignal;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},set fillStyle(v){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,AA==';
  w.eval(read('js/cafe/public-menu-i18n.js'));w.eval(read('js/vendor/qrcode-generator.js'));w.eval(read('js/maps/delivery-zone.js'));w.eval(read('js/cafe/public-menu-extras.js'));
  w.L={map:()=>({setView(){return this;},fitBounds(){},on(){},invalidateSize(){}}),polygon:()=>({addTo(){}}),marker:()=>({addTo(){return this;},setLatLng(){},remove(){}})};w.UmmaMaps={basemap(map,element,callback){callback('Включена запасная карта.');}};
  Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition(fn){gps=fn;}}});
  w.fetch=async(url,o)=>{if(!o?.body)return new Response(JSON.stringify({ok:true,products:[product],locations:[cafe]}));const b=JSON.parse(o.body);calls.push(b);if(b.action==='status')return new Response(JSON.stringify({ok:true,order:{status:'preparing',paymentStatus:'pending'}}));if(lost){lost=false;throw Error('response lost');}return new Response(JSON.stringify({ok:true,order:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',orderNumber:321,totalVnd:90000,status:'pending',paymentMethod:method,paymentStatus:'pending'},trackingToken:'a'.repeat(64),payment:method==='qr'?paymentFor({id:'a',order_number:321,total_vnd:90000,location_id:cafe.id,payment_method:'qr',payment_status:'pending',status:'pending',currency:'VND'}):null}));};
 }});
 const w=dom.window,d=w.document;await tick();d.querySelector('[data-change="1"]').click();d.getElementById('openCart').click();d.getElementById('orderType').value='delivery';d.getElementById('orderType').dispatchEvent(new w.Event('change'));
 assert.equal(gps,undefined,'never prompts for GPS silently');assert.equal(d.getElementById('deliveryFields').hidden,false);
 d.getElementById('deliveryMapOpen').click();await tick();assert.equal(d.getElementById('deliveryMap').hidden,false);assert.doesNotMatch(d.getElementById('deliveryPointState').textContent,/недоступна/,'raster fallback stays usable');
 d.getElementById('deliveryAddress').value='Scenia Bay apartment 123';d.querySelector('[name=paymentMethod][value='+method+']').checked=true;
 const submit=()=>d.getElementById('form').dispatchEvent(new w.Event('submit',{cancelable:true}));submit();await tick();assert.equal(calls.length,0,'point required');
 d.getElementById('deliveryLocate').click();gps({coords:{latitude:21,longitude:105}});submit();await tick();assert.equal(calls.length,0,'outside zone blocked');
 d.getElementById('deliveryAddress').value='';d.getElementById('deliveryLocate').click();gps({coords:{latitude:12.28,longitude:109.20}});assert.equal(d.getElementById('deliveryAddress').value,'12.280000, 109.200000');d.getElementById('deliveryAddress').value+=' · apartment 123';d.getElementById('deliveryAddress').dispatchEvent(new w.Event('input'));d.getElementById('deliveryLocate').click();gps({coords:{latitude:12.281,longitude:109.201}});assert.equal(d.getElementById('deliveryAddress').value,'12.280000, 109.200000 · apartment 123');d.getElementById('deliveryAddress').value='';d.getElementById('deliveryLocate').click();gps({coords:{latitude:12.28,longitude:109.20}});submit();await tick();assert.equal(calls.length,1);assert.equal(d.getElementById('customerFields').disabled,true);const saved=JSON.parse(w.sessionStorage.getItem('umma-menu-pending'));assert.equal(saved.requestKey,calls[0].requestKey);
 submit();await tick();const created=calls.filter(b=>b.action==='create');assert.equal(created.length,2);assert.equal(created[0].requestKey,created[1].requestKey);assert.equal(created[1].orderType,'delivery');assert.equal(created[1].paymentMethod,method);assert.equal(created[1].latitude,12.28);assert.equal(created[1].name,'');assert.equal(created[1].phone,undefined);
 assert.equal(d.getElementById('success').hidden,false);assert.equal(d.getElementById('deliveryReceipt').hidden,false);const link=new URL(d.getElementById('trackingLink').href);assert.equal(link.pathname,'/umma-global-mini-app/delivery-tracking.html');assert.equal(link.hash,'#token='+'a'.repeat(64));assert.equal(w.sessionStorage.getItem('umma-menu-pending'),null);receipt=JSON.parse(w.sessionStorage.getItem('umma-menu-receipt'));assert.equal(receipt.trackingToken,'a'.repeat(64));assert.equal(receipt.orderType,'delivery');
 d.getElementById('newOrder').click();assert.equal(d.getElementById('deliveryFields').hidden,true);assert.equal(d.getElementById('deliveryAddress').disabled,true);w.close();
}
console.log('PASS delivery UI: cash/QR shared cart, optional identity, explicit GPS, zone guard, missing point, lost response, stable retry, saved pending request, automatic private link and reset.');
let handler,rpcCalls=[];
const receiptQuery={select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},async maybeSingle(){return {data:null,error:{code:'FIXTURE_UNAVAILABLE'}};}};
const db={from:()=>receiptQuery,rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:{ok:true,order:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',orderNumber:321,totalVnd:90000,status:'pending',paymentMethod:args.p_payment_method,paymentStatus:'pending'}}};}};
vm.runInNewContext(stripTypeScriptTypes(read('supabase/functions/cafe-guest-order/index.ts').replace(/^import .*;\n/gm,'')),{Deno:{serve:fn=>handler=fn,env:{get:()=> 'qa-secret'}},createClient:()=>db,paymentFor,crypto:webcrypto,TextEncoder,URL,Response,console});
const payload={action:'create',orderType:'delivery',requestKey:'12345678-1234-4123-8123-123456789abc',locationId:cafe.id,items:[{productId:product.id,quantity:1}],address:'Scenia Bay apartment',latitude:12.28,longitude:109.2,paymentMethod:'qr',amount:1,paymentStatus:'paid'};
const req=b=>handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify(b)}));
let response=await req(payload),body=await response.json();assert.equal(response.status,201);assert.equal(rpcCalls[0].name,'submit_cafe_guest_delivery_v4');assert.match(body.trackingToken,/^[a-f0-9]{64}$/);assert.equal(body.payment.amount,90000);const token=body.trackingToken;response=await req(payload);assert.equal((await response.json()).trackingToken,token,'replay has same tracking token');assert.equal(rpcCalls[0].args.p_token_hash,await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(token)).then(b=>Buffer.from(b).toString('hex')));
response=await req({...payload,latitude:undefined});assert.equal(response.status,400);response=await req({...payload,orderType:'bogus'});assert.equal(response.status,400);
console.log('PASS delivery Edge handler: atomic RPC, stable HMAC token and hash, server QR total, invalid mode/point rejected.');
// Page remains useful on mobile browsers with no Notification API.
for(const ending of ['delivered','cancelled','network','stale','moving','road']){
 let queue=[],removed=0,turn=0,points=[],markerMoves=[],fitted,roadPath,centered;
 const dom=new JSDOM(read('delivery-tracking.html'),{url:'https://example.com/delivery-tracking.html#token='+'a'.repeat(64),runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.AbortController=AbortController;w.setTimeout=(fn,ms)=>{if(ms===5000)queue.push(fn);return 1;};w.clearTimeout=()=>{};
 w.eval(read('js/cafe/public-menu-i18n.js'));w.L={polyline(initial,style){if(style.weight===5){roadPath=initial;return {addTo(){return this;},remove(){}};}points=initial;return {addTo(){return this;},getLatLngs(){return points;},setLatLngs(next){points=next;}};}};w.UmmaMaps={create:()=>({remove(){removed++;},fitBounds(bounds){fitted=bounds;},panTo(point){centered=point;},getBounds:()=>({pad:()=>({contains:()=>true})})}),marker:()=>({setLatLng(fix){markerMoves.push(fix);}})};
 w.fetch=async()=>{turn++;if(turn===2&&ending==='network')throw Error();return new Response(JSON.stringify({ok:true,number:321,orderStatus:turn===2&&ending==='cancelled'?'cancelled':'preparing',state:turn===2&&ending==='delivered'?'delivered':turn===2&&ending==='cancelled'?'cancelled':'picked_up',...(turn===2&&ending==='stale'?{}:{latitude:turn===2&&ending==='moving'?12.30:12.28,longitude:109.2,destination:{latitude:12.31,longitude:109.2},updatedAt:new Date().toISOString()})}));};
 if(ending==='road')w.UmmaNhaTrangRouter={route:async()=>({seconds:420,path:[{lat:12.28,lng:109.2},{lat:12.31,lng:109.2}]})};
 w.eval(read('js/cafe/public-tracking.js'));await tick();
 assert.equal(d.getElementById('map').hidden,false);
 const eta=d.getElementById('eta'),initialEta=eta.textContent;
 assert.equal(eta.hidden,false);
 assert.ok(fitted);
 assert.equal(d.querySelector('#stages [aria-current]').textContent,w.ummaMenuI18n.t('Курьер в пути'));
 d.getElementById('center').click();assert.equal(centered[0],12.28);
 if(ending==='road'){assert.equal(roadPath.length,2);assert.equal(initialEta,w.ummaMenuI18n.t('Примерно {minutes} мин. до прибытия',{minutes:7}));w.close();continue;}
 await queue.shift()();await tick();
 if(ending==='moving'){
  assert.equal(d.getElementById('map').hidden,false);
  assert.equal(markerMoves.length,1);
  assert.equal(points.length,2);
  assert.notEqual(eta.textContent,initialEta);
 }else{
  assert.equal(d.getElementById('map').hidden,true,ending+' hides previous coordinates');
  assert.equal(eta.hidden,true);
  assert.equal(removed,1);
 }
 assert.equal(w.Notification,undefined);w.close();
}
console.log('PASS tracking page: live map, terminal delivery/cancellation, stale/missing positions and lost connection clear map; unsupported Notification API does not crash.');
