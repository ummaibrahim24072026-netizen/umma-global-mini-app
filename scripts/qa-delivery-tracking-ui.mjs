import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const dom=new JSDOM('<button data-share-delivery="qa-order">Share</button><small data-tracking-status="qa-order"></small><button data-track-delivery="qa-order">Track</button>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://synthetic-qa.invalid'}),w=dom.window,d=w.document;
let watch,watchCount=0,cleared=0,requests=[],callbacks=[],state='live',markerPoints=[],longitude=109.19,mapCount=0,pans=0,age=0;
w.Telegram={WebApp:{initData:'synthetic-init'}};w.AbortSignal=AbortSignal;w.Response=Response;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.setInterval=()=>1;w.clearInterval=()=>{};w.setTimeout=fn=>{callbacks.push(fn);return callbacks.length;};w.clearTimeout=()=>{};
Object.defineProperty(w.navigator,'geolocation',{value:{watchPosition:fn=>{watch=fn;watchCount++;return 12;},clearWatch:()=>cleared++,getCurrentPosition:()=>{}}});
w.fetch=async(url,options)=>{const b=JSON.parse(options.body);requests.push(b);return new Response(JSON.stringify(b.action==='deliveryTracking'?{ok:true,state,latitude:12.25,longitude,accuracy:20,updatedAt:new Date(Date.now()-age).toISOString()}:b.action==='setDeliveryTracking'?{ok:true,sessionId:'qa-session'}:{ok:true}));};
w.ummaMapLinks={parseAddress:text=>text?{lat:12.26,lng:109.23}:null};
w.UmmaMaps={create:()=>{mapCount++;return {panTo(){pans++;},invalidateSize(){},remove(){}};},marker:(map,p)=>{markerPoints.push([p.lat,p.lng]);return {setLatLng(p){markerPoints.push(p);}};}};
w.L={map:()=>({setView(){return this;},panTo(){},remove(){}}),tileLayer:()=>({addTo(){}}),marker:point=>{markerPoints.push(point);return {addTo(){return this;},setLatLng(p){markerPoints.push(p);}};},circle:()=>({addTo(){return this;},setLatLng(){return this;},setRadius(){return this;}})};
const tick=()=>new Promise(r=>setTimeout(r,15));
try{
 w.eval(readFileSync('js/cafe/delivery-tracking.js','utf8'));assert.equal(watchCount,0,'no silent GPS permission');
 d.querySelector('[data-share-delivery]').click();await tick();assert.equal(watchCount,1);assert.match(d.querySelector('[data-share-delivery]').textContent,/Остановить/);
 watch({timestamp:Date.now(),coords:{latitude:12.25,longitude:109.19,accuracy:20}});await tick();assert.ok(requests.some(b=>b.action==='deliveryPosition'&&b.sequence===1&&b.sessionId==='qa-session'));
 const opener=d.querySelector('[data-track-delivery]');opener.dataset.trackingAddress='Точка доставки: 12.26,109.23';opener.focus();opener.click();await tick();assert.equal(d.querySelector('.delivery-tracking-map').hidden,false);assert.equal(d.querySelector('.delivery-tracking-map iframe'),null);assert.deepEqual(Array.from(markerPoints[0]),[12.26,109.23],'destination stays distinct from courier');assert.equal(d.querySelector('.tracking-destination-key').hidden,false);assert.deepEqual(Array.from(markerPoints.at(-1)),[12.25,109.19]);assert.equal(d.querySelector('dialog a'),null,'customer tracking stays inside the app');assert.match(d.querySelector('[role="status"]').textContent,/обновлена/);
 longitude=109.20;await callbacks.shift()();await tick();assert.equal(mapCount,1,'live updates reuse the map');assert.deepEqual(Array.from(markerPoints.at(-1)),[12.25,109.20]);assert.equal(pans,1);
 d.querySelector('dialog input').checked=false;longitude=109.21;await callbacks.shift()();await tick();assert.deepEqual(Array.from(markerPoints.at(-1)),[12.25,109.21]);assert.equal(pans,1,'unfollowing preserves viewport but marker keeps moving');
 age=65000;await callbacks.shift()();await tick();assert.equal(d.querySelector('.delivery-tracking-map').hidden,true,'client rejects old cached live coordinates');assert.match(d.querySelector('.tracking-badge').textContent,/Нет свежей/);age=0;await callbacks.shift()();await tick();assert.equal(d.querySelector('.delivery-tracking-map').hidden,false,'live tracking recovers');d.querySelector('.tracking-center').click();assert.equal(d.querySelector('dialog input').checked,true);
 state='stale';await callbacks.shift()();await tick();assert.equal(d.querySelector('.delivery-tracking-map').hidden,true);assert.match(d.querySelector('[role="status"]').textContent,/Нет свежей/);
 w.ummaCourierTracking.close();assert.equal(d.querySelector('dialog'),null);assert.equal(d.activeElement,opener);
 w.ummaCourierTracking.syncOrders([{id:'qa-order',delivery_status:'delivered',status:'ready'}]);await tick();assert.equal(cleared,1);assert.ok(requests.some(b=>b.action==='setDeliveryTracking'&&b.enabled===false));
 console.log('PASS tracking UI: explicit GPS opt-in, scoped ping, live marker, stale position hidden, back/focus and automatic stop after handover (simulated sensors only)');
}finally{w.close();}
