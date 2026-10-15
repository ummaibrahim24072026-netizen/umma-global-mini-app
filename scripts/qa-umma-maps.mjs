import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{url:'https://synthetic-qa.invalid',runScripts:'outside-only'}),w=dom.window,d=w.document;
let gps=0,requests=0,links=[],previews=0,removed=0;
Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:()=>gps++}});
w.fetch=async()=>{requests++;throw Error('unexpected network');};
w.Telegram={WebApp:{openLink:(url,options)=>links.push({url,options})}};
w.UmmaMaps={create:()=>{previews++;return {remove(){removed++;}};},marker:()=>({})};
try {
 w.eval(readFileSync('js/maps/delivery-location.js','utf8'));
 w.eval(readFileSync('js/maps/courier-route.js','utf8'));
 const b=d.createElement('button');b.dataset.showRoute='true';b.dataset.routeAddress='Квартира 7\nТочка доставки: 12.280000,109.220000';d.body.append(b);b.click();
 let url=new URL(links[0].url);assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('destination'),'12.280000,109.220000');assert.equal(url.searchParams.get('dir_action'),'navigate');assert.equal(url.searchParams.has('origin'),false,'Google uses current position');assert.equal(previews,0,'one tap opens Google directly');assert.equal(gps,0);assert.equal(requests,0,'no routing server request');assert.equal(d.getElementById('courierMapModal').hidden,true);
 b.dataset.navigationProvider='apple';b.click();const apple=new URL(links.at(-1).url);assert.equal(apple.origin,'https://maps.apple.com');assert.equal(apple.searchParams.get('destination'),'12.280000,109.220000');assert.equal(apple.searchParams.get('mode'),'driving');delete b.dataset.navigationProvider;
 b.dataset.routeAddress='QA Street 7';b.click();url=new URL(links.at(-1).url);assert.equal(url.searchParams.get('destination'),'QA Street 7, Vietnam');
 b.dataset.routeAddress='Точка доставки: 12.280000,109.220000';w.Telegram.WebApp.openLink=()=>{throw Error('unsupported webview');};b.click();assert.equal(d.getElementById('courierMapModal').hidden,false);assert.equal(previews,1);assert.equal(new URL(d.getElementById('courierMapExternal').href).searchParams.get('destination'),'12.280000,109.220000');w.UmmaCourierMap.close();assert.equal(removed,1);
 console.log('PASS courier navigation: one-tap Google Maps, exact confirmed coordinates, text-address fallback, device origin, WebView error fallback, no GPS or routing-service request');
} finally {w.close();}
