import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom = new JSDOM(html,{url:'https://synthetic-qa.invalid',runScripts:'outside-only'}), w=dom.window,d=w.document;
const $=id=>d.getElementById(id), pending=[], maps=[], lines=[], markers=[];
let requests=0, response='ok', resolveFetch;
w.AbortController=AbortController;
Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:(ok,fail)=>pending.push({ok,fail})}});
w.ummaMapLinks={parseAddress:()=>({lat:12.28,lng:109.22}),coords:p=>p.lat+','+p.lng};
w.UmmaMaps={create:()=>{const m={remove(){this.removed=true;},fitBounds(){this.fitted=true;}};maps.push(m);return m;},marker:(m,p)=>{const x={point:p,remove(){this.removed=true;}};markers.push(x);return x;}};
w.L={polyline:points=>{const l={points,addTo(){return this;},getBounds(){return points;},remove(){this.removed=true;}};lines.push(l);return l;}};
const data={code:'Ok',routes:[{distance:2300,duration:360,geometry:{coordinates:[[109.2,12.26],[109.21,12.27],[109.22,12.28]]}}]};
w.fetch=async()=>{requests++;if(response==='pending')await new Promise(r=>{resolveFetch=r;});return {ok:response!=='error',json:async()=>data};};
const tick=()=>new Promise(r=>setImmediate(r));
const position={coords:{latitude:12.26,longitude:109.2,accuracy:15}};
try {
 w.eval(readFileSync('js/maps/courier-route.js','utf8'));
 const button=d.createElement('button');button.dataset.routeAddress='Точка доставки: 12.28,109.22';d.body.append(button);
 w.UmmaCourierMap.open(button);assert.equal(pending.length,0,'no silent GPS');
 $('courierMapLocate').click();$('courierMapLocate').click();assert.equal(pending.length,1,'duplicate taps suppressed');
 pending.pop().ok(position);await tick();assert.equal(requests,1);assert.equal(lines.length,1);assert.deepEqual(Array.from(lines[0].points[0]),[12.26,109.2]);assert.match($('courierMapMessage').textContent,/2.3 км/);assert.match($('courierMapMessage').textContent,/6 мин/);assert.equal(maps[0].fitted,true);
 w.UmmaCourierMap.close();assert.equal(maps[0].removed,true);
 w.UmmaCourierMap.open(button);$('courierMapLocate').click();const gps=pending.pop();w.UmmaCourierMap.close();gps.ok(position);await tick();assert.equal(requests,1,'late GPS does not fetch after close');
 w.UmmaCourierMap.open(button);$('courierMapLocate').click();pending.pop().fail({code:1});assert.match($('courierMapMessage').textContent,/Не удалось/);assert.equal($('courierMapLocate').disabled,false);w.UmmaCourierMap.close();
 response='error';w.UmmaCourierMap.open(button);$('courierMapLocate').click();pending.pop().ok(position);await tick();assert.match($('courierMapMessage').textContent,/Google Maps/);assert.equal(lines.length,1,'failed route must not draw a straight line');w.UmmaCourierMap.close();
 response='pending';w.UmmaCourierMap.open(button);$('courierMapLocate').click();pending.pop().ok(position);await tick();w.UmmaCourierMap.close();resolveFetch();await tick();assert.equal(lines.length,1,'late route ignored');
 console.log('PASS Umma Maps: road geometry/ETA, explicit GPS, duplicate taps, denied GPS, failed route, stale GPS/route after close (simulated routes and sensors)');
} finally {w.close();}
