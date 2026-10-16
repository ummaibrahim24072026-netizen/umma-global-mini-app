import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{url:'https://synthetic-qa.invalid/',runScripts:'outside-only'}),w=dom.window,d=w.document;
const $=id=>d.getElementById(id),requests=[],maps=[],markers=[],vectors=[],rasters=[],paints=[];
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:(success,error,options)=>requests.push({success,error,options})}});
function emitter(object){object.handlers={};object.on=function(event,fn){this.handlers[event]=fn;return this;};object.fire=function(event,data){this.handlers[event]?.(data);};return object;}
w.maplibregl={supported:()=>true};
w.L={
 map:()=>{const map=emitter({center:{lat:12,lng:109},setView(point){this.center={lat:point[0],lng:point[1]};return this;},getCenter(){return this.center;},invalidateSize(){},remove(){this.removed=true;}});maps.push(map);return map;},
 tileLayer:options=>{rasters.push(options);return emitter({addTo(){return this;}});},divIcon:options=>options,
 maplibreGL:options=>{const gl=emitter({getStyle:()=>({layers:[{id:"water",type:"fill","source-layer":"water"},{id:"buildings",type:"fill","source-layer":"building"},{id:"labels",type:"symbol","source-layer":"place"}]}),setPaintProperty:(...args)=>paints.push(args)});const layer={options,gl,addTo(){return this;},getMaplibreMap(){return gl;},remove(){this.removed=true;}};vectors.push(layer);return layer;},
 marker:point=>{const marker=emitter({point:{lat:point[0],lng:point[1]},addTo(){return this;},setLatLng(point){this.point={lat:point[0],lng:point[1]};return this;},getLatLng(){return this.point;}});markers.push(marker);return marker;}
};
w.Telegram={WebApp:{initData:'isolated-qa',initDataUnsafe:{user:{id:1,first_name:'QA'}}}};
w.fetch=async()=>({ok:true,json:async()=>({ok:true,products:[{id:'food',name_ru:'QA',price_vnd:50000}],inventoryControlEnabled:false,location:{id:'cafe',name:'QA',latitude:12.25,longitude:109.19,delivery_zone:[[12.2,109.1],[12.4,109.1],[12.4,109.3],[12.2,109.3]]}})});
const mode=type=>{ $('cafeOrderType').value=type;$('cafeOrderType').dispatchEvent(new w.Event('change'));};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
try{
 w.eval(readFileSync('js/maps/umma-maps.js','utf8'));
 w.eval(readFileSync('js/maps/delivery-zone.js','utf8'));
 w.eval(readFileSync('js/maps/delivery-location.js','utf8'));
 w.eval(readFileSync('js/cafe/cafe.js','utf8'));
 await w.ummaCafe.refreshMenu();
 $('cafePage').hidden=false;
 d.querySelector('[data-add-product="food"]').click();
 assert.equal(requests.length,0,'opening menu must not request destination GPS');
 mode('delivery');assert.equal($('cafeDeliveryLocation').hidden,false);assert.equal($('cafeDeliveryAddress').required,false);
 $('cafeDeliveryMapOpen').focus();$('cafeDeliveryMapOpen').click();
 await tick();assert.equal(vectors.at(-1).options.style,'https://tiles.openfreemap.org/styles/liberty');
 assert.match(vectors.at(-1).options.attributionControl.customAttribution,/OpenStreetMap/,'required credit retained');
 vectors.at(-1).gl.fire('load');assert.equal($('cafeDeliveryMap').dataset.basemap,'openfreemap');assert.equal(rasters.length,0,'vector map is the primary provider');assert.equal($('cafeDeliveryMap').dataset.theme,'umma');assert.ok(paints.some(p=>p[0]==='water'&&p[2]==='#abd8d5'),'UMMA water palette applied');
 assert.equal($('cafeDeliveryMapDialog').open,true);assert.equal($('cafeDeliveryMapConfirm').disabled,true,'no default destination at cafe');
 assert.deepEqual(maps.at(-1).center,{lat:12.25,lng:109.19});
 maps.at(-1).fire('click',{latlng:{lat:21.03,lng:105.85}});
 assert.equal($('cafeDeliveryMapConfirm').disabled,true,'outside area cannot be confirmed');
 assert.match($('cafeDeliveryMapStatus').textContent,/вне зоны/);
 $('cafeDeliveryMapConfirm').click();assert.equal(w.ummaDeliveryLocation.hasPoint(),false);
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
 assert.equal($('cafeDeliveryPointLinks'),null,'customer checkout has no navigator selection');
 assert.ok(w.ummaDeliveryLocation.getAddress('x'.repeat(500)).length<=500,'coordinates survive server address limit');
 // A manual choice wins over a delayed GPS result.
 $('cafeDeliveryMapOpen').click();$('cafeDeliveryMapLocate').click();
 maps.at(-1).fire('click',{latlng:{lat:12.28,lng:109.22}});
 requests.at(-1).success({coords:{latitude:50,longitude:60,accuracy:10}});
 $('cafeDeliveryMapConfirm').click();assert.match(w.ummaDeliveryLocation.getAddress(''),/12.280000,109.220000/);
 // Staff uses the same zone picker without changing the customer's destination.
 $('staffOrderLocation').innerHTML='<option value="cafe">QA cafe</option>';
 $('staffOrderAddressLabel').hidden=false; $('staffOrderAddress').value='Apartment 8';$('staffDeliveryMapOpen').click();await tick();
 assert.equal($('cafeDeliveryMapDialog').open,true);
 maps.at(-1).fire('click',{latlng:{lat:21.03,lng:105.85}});assert.equal($('cafeDeliveryMapConfirm').disabled,true);
 maps.at(-1).fire('click',{latlng:{lat:12.25,lng:109.20}});$('cafeDeliveryMapConfirm').click();
 assert.equal($('staffOrderAddress').value,'Apartment 8\nТочка доставки: 12.250000,109.200000');
 assert.match(w.ummaDeliveryLocation.getAddress(''),/12.280000,109.220000/,'staff selection preserves customer destination');
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
 $('cafeOrderForm').reset();await tick();assert.equal(w.ummaDeliveryLocation.hasPoint(),false);mode('delivery');assert.equal($('cafeDeliveryAddress').required,false);
 // MapLibre 5 has no supported() export: absent optional legacy API must not force fallback.
 delete w.maplibregl.supported;$('cafeDeliveryMapOpen').click();await tick();
 vectors.at(-1).gl.fire('load');assert.equal($('cafeDeliveryMap').dataset.basemap,'openfreemap','real MapLibre 5 API supported');
 const drag=maps.at(-1);drag.center={lat:12.31,lng:109.24};drag.fire('dragend');
 assert.equal($('cafeDeliveryDraftCoordinates').textContent,'12.310000,109.240000','moving map chooses its center');
 $('cafeDeliveryMapLocate').click();const pendingManual=requests.at(-1);
 $('cafeDeliveryMapManual').click();
 assert.equal($('cafeDeliveryMapManual').textContent,'Указать на карте');
 assert.equal($('cafeDeliveryMapCenter'),null,'customer has no cafe shortcut');
 assert.deepEqual(drag.center,{lat:12.31,lng:109.24},'manual selection preserves current map position');
 assert.equal(d.activeElement,$('cafeDeliveryMap'),'manual selection focuses map');
 pendingManual.success({coords:{latitude:50,longitude:60,accuracy:10}});
 assert.equal($('cafeDeliveryDraftCoordinates').textContent,'12.310000,109.240000','manual mode cancels delayed GPS');
 assert.equal($('cafeDeliveryMapLocate').disabled,false);
 $('cafeDeliveryMapClose').click();
 // Unsupported WebGL and repeated vector errors switch to a free raster fallback.
 w.maplibregl.supported=()=>false;$('cafeDeliveryMapOpen').click();await tick();
 assert.equal($('cafeDeliveryMap').dataset.basemap,'raster-fallback');$('cafeDeliveryMapClose').click();
 w.maplibregl.supported=()=>true;$('cafeDeliveryMapOpen').click();await tick();
 const failed=vectors.at(-1);failed.gl.fire('error');failed.gl.fire('error');failed.gl.fire('error');
 assert.equal($('cafeDeliveryMap').dataset.basemap,'raster-fallback');assert.equal(failed.removed,true);$('cafeDeliveryMapClose').click();
 // Missing map library fails closed: free text cannot establish coverage.
 delete w.L;$('cafeDeliveryMapOpen').click();assert.match($('cafeDeliveryMapStatus').textContent,/Без проверки зоны/);assert.equal($('cafeDeliveryMapConfirm').disabled,true);$('cafeDeliveryMapClose').click();
 const beforeManual=payloads.length; $('cafeDeliveryAddress').value='Полный адрес вручную';$('cafeOrderForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(payloads.length,beforeManual,'a typed address cannot bypass the map when unavailable');
 console.log('PASS OpenFreeMap vector provider/credit/fallback; delivery point: explicit GPS consent/confirmation, map taps and dragging, cancellation, stale GPS, denied location, exact courier URLs, checkout payload and manual fallback (simulated map/GPS; no live orders)');
}finally{w.close();}
