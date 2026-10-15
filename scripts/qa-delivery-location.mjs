import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{url:'https://synthetic-qa.invalid/',runScripts:'outside-only'}),w=dom.window,d=w.document;
const $=id=>d.getElementById(id),requests=[],maps=[],markers=[];
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:(success,error,options)=>requests.push({success,error,options})}});
function emitter(object){object.handlers={};object.on=function(event,fn){this.handlers[event]=fn;return this;};object.fire=function(event,data){this.handlers[event]?.(data);};return object;}
w.L={
 map:()=>{const map=emitter({center:{lat:12,lng:109},setView(point){this.center={lat:point[0],lng:point[1]};return this;},getCenter(){return this.center;},invalidateSize(){},remove(){this.removed=true;}});maps.push(map);return map;},
 tileLayer:()=>emitter({addTo(){return this;}}),divIcon:options=>options,
 marker:point=>{const marker=emitter({point:{lat:point[0],lng:point[1]},addTo(){return this;},setLatLng(point){this.point={lat:point[0],lng:point[1]};return this;},getLatLng(){return this.point;}});markers.push(marker);return marker;}
};
w.Telegram={WebApp:{initData:'isolated-qa',initDataUnsafe:{user:{id:1,first_name:'QA'}}}};
w.fetch=async()=>({ok:true,json:async()=>({ok:true,products:[{id:'food',name_ru:'QA',price_vnd:50000}],inventoryControlEnabled:false,location:{id:'cafe',name:'QA',latitude:12.25,longitude:109.19}})});
const mode=type=>{ $('cafeOrderType').value=type;$('cafeOrderType').dispatchEvent(new w.Event('change'));};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
try{
 w.eval(readFileSync('js/maps/delivery-location.js','utf8'));
 w.eval(readFileSync('js/cafe/cafe.js','utf8'));
 await w.ummaCafe.refreshMenu();
 $('cafePage').hidden=false;
 d.querySelector('[data-add-product="food"]').click();
 assert.equal(requests.length,0,'opening menu must not request destination GPS');
 mode('delivery');assert.equal($('cafeDeliveryLocation').hidden,false);assert.equal($('cafeDeliveryAddress').required,true);
 $('cafeDeliveryMapOpen').focus();$('cafeDeliveryMapOpen').click();
 assert.equal($('cafeDeliveryMapDialog').open,true);assert.equal($('cafeDeliveryMapConfirm').disabled,true,'no default destination at cafe');
 assert.deepEqual(maps.at(-1).center,{lat:12.25,lng:109.19});
 maps.at(-1).fire('click',{latlng:{lat:12.26,lng:109.2}});
 assert.equal(w.ummaDeliveryLocation.hasPoint(),false,'draft is not confirmed');
 $('cafeDeliveryMapClose').click();assert.equal(w.ummaDeliveryLocation.hasPoint(),false);
 assert.equal(d.activeElement,$('cafeDeliveryMapOpen'),'close restores focus');
 $('cafeDeliveryMapOpen').click();$('cafeDeliveryMapLocate').click();
 assert.equal(requests.length,1);assert.equal(requests[0].options.maximumAge,0);
 requests[0].success({coords:{latitude:12.27,longitude:109.21,accuracy:25}});
 assert.match($('cafeDeliveryMapStatus').textContent,/25 м/);
 assert.equal(w.ummaDeliveryLocation.hasPoint(),false,'GPS requires confirmation');
 $('cafeDeliveryMapConfirm').click();
 assert.equal(w.ummaDeliveryLocation.hasPoint(),true);assert.equal($('cafeDeliveryAddress').required,false);
 assert.equal(w.ummaDeliveryLocation.getAddress('Квартира 7'),'Квартира 7\nТочка доставки: 12.270000,109.210000');
 assert.equal(new URL($('cafeDeliveryGoogleLink').href).searchParams.get('query'),'12.270000,109.210000');
 assert.equal(new URL($('cafeDeliveryAppleLink').href).searchParams.get('coordinate'),'12.270000,109.210000');
 assert.ok(w.ummaDeliveryLocation.getAddress('x'.repeat(500)).length<=500,'coordinates survive server address limit');
 // A manual choice wins over a delayed GPS result.
 $('cafeDeliveryMapOpen').click();$('cafeDeliveryMapLocate').click();
 maps.at(-1).fire('click',{latlng:{lat:12.28,lng:109.22}});
 requests.at(-1).success({coords:{latitude:50,longitude:60,accuracy:10}});
 $('cafeDeliveryMapConfirm').click();assert.match(w.ummaDeliveryLocation.getAddress(''),/12.280000,109.220000/);
 // Marker dragging, cancellation, permission denial and stale callbacks.
 $('cafeDeliveryMapOpen').click();
 markers.at(-1).point={lat:12.29,lng:109.23};markers.at(-1).fire('dragend');
 $('cafeDeliveryMapClose').click();assert.match(w.ummaDeliveryLocation.getAddress(''),/12.280000,109.220000/,'cancel preserves prior point');
 $('cafeDeliveryMapOpen').click();$('cafeDeliveryMapLocate').click();requests.at(-1).error({code:1});
 assert.match($('cafeDeliveryMapStatus').textContent,/вручную/);assert.equal($('cafeDeliveryMapLocate').disabled,false);
 $('cafeDeliveryMapLocate').click();const stale=requests.at(-1);$('cafeDeliveryMapClose').click();
 stale.success({coords:{latitude:30,longitude:40,accuracy:10}});assert.match(w.ummaDeliveryLocation.getAddress(''),/12.280000,109.220000/);
 const geo=w.navigator.geolocation.getCurrentPosition;
 w.navigator.geolocation.getCurrentPosition=()=>{throw new Error('restricted webview');};
 $('cafeDeliveryMapOpen').click();$('cafeDeliveryMapLocate').click();assert.match($('cafeDeliveryMapStatus').textContent,/вручную/);assert.equal($('cafeDeliveryMapLocate').disabled,false);$('cafeDeliveryMapClose').click();
 w.navigator.geolocation.getCurrentPosition=geo;
 // Exact confirmed coordinates reach checkout and the courier route.
 d.querySelector('[data-add-product="food"]').click();
 const payloads=[];w.ummaCafeRequests={request:async(url,payload)=>{payloads.push(payload);return {ok:true,json:async()=>({ok:false,error:'isolated test retains draft'})};}};
 $('cafeDeliveryAddress').value='Квартира 7';
 $('cafeOrderForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(payloads.at(-1).deliveryAddress,'Квартира 7\nТочка доставки: 12.280000,109.220000');
 mode('pickup');assert.equal($('cafeDeliveryLocation').hidden,true);
 $('cafeOrderForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(payloads.at(-1).deliveryAddress,'Квартира 7','pickup must not carry destination coordinates');
 w.eval(readFileSync('js/maps/courier-route.js','utf8'));
 const route=d.createElement('button');route.dataset.routeAddress=payloads[0].deliveryAddress;route.dataset.routeOrderNumber='QA';d.body.append(route);
 w.UmmaCourierMap.open(route);
 assert.equal(new URL($('courierMapExternal').href).searchParams.get('destination'),'12.280000,109.220000');
 assert.equal(new URL($('courierMapApple').href).searchParams.get('destination'),'12.280000,109.220000');
 w.UmmaCourierMap.close();
 assert.equal(w.ummaMapLinks.parseAddress('Точка доставки: 91,181'),null);
 route.dataset.routeAddress='QA Street';w.UmmaCourierMap.open(route);
 assert.equal(new URL($('courierMapExternal').href).searchParams.get('destination'),'QA Street, Vietnam');w.UmmaCourierMap.close();
 w.eval(readFileSync('js/core/navigation.js','utf8'));
 $('cafeDeliveryMapOpen').click();assert.equal(w.ummaNavigation.back(),true);assert.equal($('cafeDeliveryMapDialog').open,false);assert.equal($('cafeDeliveryMapDialog').isConnected,true,'Back preserves reusable picker');
 $('cafeOrderForm').reset();await tick();assert.equal(w.ummaDeliveryLocation.hasPoint(),false);mode('delivery');assert.equal($('cafeDeliveryAddress').required,true);
 // Missing map library still allows a manually entered address.
 delete w.L;$('cafeDeliveryMapOpen').click();assert.match($('cafeDeliveryMapStatus').textContent,/вручную/);assert.equal($('cafeDeliveryMapConfirm').disabled,true);$('cafeDeliveryMapClose').click();
 $('cafeDeliveryAddress').value='Полный адрес вручную';$('cafeOrderForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(payloads.at(-1).deliveryAddress,'Полный адрес вручную');
 console.log('PASS delivery point: explicit GPS consent/confirmation, map taps and dragging, cancellation, stale GPS, denied location, exact courier URLs, checkout payload and manual fallback (simulated map/GPS; no live orders)');
}finally{w.close();}
