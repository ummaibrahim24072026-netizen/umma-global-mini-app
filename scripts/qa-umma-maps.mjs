import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi,'');
const dom=new JSDOM(html,{url:'https://synthetic-qa.invalid',runScripts:'outside-only'});
const w=dom.window,d=w.document;
let gps=0,removed=0,previews=0;
Object.defineProperty(w.navigator,'geolocation',{value:{watchPosition:()=>{gps++;return 7;},clearWatch:()=>{}}});
w.UmmaMaps={create:()=>{previews++;return {remove(){removed++;},invalidateSize(){}};},marker:()=>({setLatLng(){}})};
try{
 w.eval(readFileSync('js/maps/delivery-location.js','utf8'));
 w.eval(readFileSync('js/maps/courier-route.js','utf8'));
 const b=d.createElement('button');b.dataset.showRoute='true';b.dataset.routeOrderNumber='42';b.dataset.routeAddress='Точка доставки: 12.280000,109.220000';d.body.append(b);b.click();
 assert.equal(d.getElementById('courierMapModal').hidden,false,'in-app map opens');
 assert.equal(previews,1,'UMMA map renders');
 assert.equal(gps,1,'GPS watch starts');
 const link=new URL(d.getElementById('courierMapExternal').href);
 assert.equal(link.origin,'https://www.google.com');
 assert.equal(link.searchParams.get('destination'),'12.280000,109.220000');
 assert.equal(link.searchParams.get('dir_action'),'navigate');
 w.UmmaCourierMap.close();assert.equal(removed,1);
 assert.equal(d.getElementById('courierMapModal').hidden,true);
 b.dataset.routeAddress='Address without pinned coordinates';b.click();
 assert.equal(d.getElementById('courierMapModal').hidden,false);
 assert.match(d.getElementById('courierMapMessage').textContent,/точка доставки/i);
 assert.equal(previews,1,'unconfirmed address does not create misleading map');
 console.log('PASS courier UMMA in-app map, GPS watch, external driving fallback, cleanup and address validation');
}finally{w.close();}
