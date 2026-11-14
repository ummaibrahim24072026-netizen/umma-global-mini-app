import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const html=readFileSync('staff.html','utf8');
const dom=new JSDOM(html,{url:'https://qa.invalid/staff.html',runScripts:'outside-only'});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
const router='js/maps/nha-trang-router.js';
const parser='js/maps/delivery-location.js';
assert.ok(html.includes(parser)&&html.indexOf(parser)<html.indexOf('js/maps/courier-route.js'));
let gps,stopped=0,drawn=0,markerMoves=0;
w.Response=Response;
w.DecompressionStream=DecompressionStream;
w.fetch=async url=>{
 assert.equal(url.origin,'https://qa.invalid');
 return new Response(readFileSync('assets/maps/nha-trang-roads.json.gz'));
};
Object.defineProperty(d,'currentScript',{value:{src:'https://qa.invalid/'+router}});
w.eval(readFileSync(router,'utf8'));
const cafe={lat:12.2409,lng:109.1967},north={lat:12.2783,lng:109.2028};
const result=await w.UmmaNhaTrangRouter.route(cafe,north);
assert.ok(result.path.length>20);
assert.ok(result.meters>4000&&result.meters<14000);
assert.ok(result.streets.length>2&&result.seconds>0);
assert.equal(await w.UmmaNhaTrangRouter.route(cafe,{lat:13,lng:110}),null);
Object.defineProperty(w.navigator,'geolocation',{value:{
 watchPosition(fn){gps=fn;return 0;},clearWatch(){stopped++;}
}});
w.UmmaMaps={
 create:()=>({fitBounds(){},remove(){},getBounds:()=>({pad:()=>({contains:()=>true})})}),
 marker:()=>({setLatLng(){markerMoves++;},remove(){}})
};
w.L={polyline(path){assert.ok(path.length>20);return {addTo(){drawn++;return this;},remove(){}};}};
try{
 w.eval(readFileSync(parser,'utf8'));
 w.eval(readFileSync('js/maps/courier-route.js','utf8'));
 const button=d.createElement('button');
 Object.assign(button.dataset,{showRoute:'true',routeAddress:'Адрес\nТочка доставки: 12.2783,109.2028'});
 d.body.append(button);
 button.click();
 gps({coords:{latitude:cafe.lat,longitude:cafe.lng,accuracy:10},timestamp:Date.now()});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(drawn,1);
 assert.match($('courierMapMessage').textContent,/мин/);
 gps({coords:{latitude:cafe.lat+0.0001,longitude:cafe.lng,accuracy:10},timestamp:Date.now()});
 assert.equal(markerMoves,1);
 w.UmmaCourierMap.close();
 assert.equal(stopped,1);
 assert.ok($('courierMapModal').hidden);
 console.log('PASS local Nha Trang road data, in-app courier GPS, route, ETA and cleanup');
}finally{w.close();}
