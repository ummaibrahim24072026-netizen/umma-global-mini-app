import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const source=readFileSync('js/cafe/cafe.js','utf8');
const tick=()=>new Promise(r=>setImmediate(r));
const cafes=[{id:'north',name:'UMMA North',latitude:12.28,longitude:109.2},{id:'south',name:'UMMA South',latitude:12.2,longitude:109.19}];
function fixture({locations=cafes,geo=true}={}){
 const dom=new JSDOM(html,{url:'https://umma.example/',runScripts:'outside-only'}),w=dom.window,d=w.document,$=id=>d.getElementById(id),gps=[],orders=[];
 let current=locations;
 const products=[{id:'soup',sku:'UMMA-CAFE-SHURPA',name_ru:'Шурпа',price_vnd:90000},{id:'plov',sku:'UMMA-CAFE-PLOV',name_ru:'Плов',price_vnd:120000}];
 w.Telegram={WebApp:{initData:'isolated-only',initDataUnsafe:{user:{id:1,first_name:'Гость'}}}};
 if(geo)Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition(success,error,options){gps.push({success,error,options});}}});
 w.fetch=async()=>({ok:true,json:async()=>({ok:true,products,locations:current,location:current[0],inventoryControlEnabled:true,inventory:[{product_id:'soup',location_id:'north',quantity:2,price_vnd:80000},{product_id:'plov',location_id:'south',quantity:3,price_vnd:110000}]})});
 w.ummaCafeRequests={request:async(url,payload)=>{orders.push(payload);return{ok:true,json:async()=>({ok:true,order:{id:'qa',orderNumber:1,totalVnd:110000},staffNotified:1})};}};
 w.eval(source);$('cafePage').hidden=false;
 const choose=id=>{$('cafeNearbySelect').value=id;$('cafeNearbySelect').dispatchEvent(new w.Event('change'));};
 return {w,d,$,gps,orders,choose,setLocations:value=>{current=value;},close:()=>w.close()};
}
{
 const f=fixture(),{w,d,$,gps,orders,choose}=f;
 try{
  await w.ummaCafe.refreshMenu();assert.equal(gps.length,1,'entry requests GPS automatically');
  assert.equal(d.querySelectorAll('[data-product-card]').length,0,'do not expose first cafe menu while awaiting location');
  assert.equal($('cafeLocationSelect').value,'');assert.equal($('cafeNearbyDetect').disabled,true);
  gps[0].success({coords:{latitude:12.201,longitude:109.19}});
  assert.equal($('cafeLocationSelect').value,'south','second cafe is closer');assert.equal($('cafeNearbySelect').value,'south');
  assert.equal($('cafeNearbyStatus').textContent,'UMMA South');assert.match($('cafeNearbyStatus').title,/UMMA South.*км по прямой/);assert.match($('cafeMenuLocation').textContent,/UMMA South/);
  assert.equal(d.querySelector('[data-product-card]').dataset.productCard,'plov');assert.equal(d.querySelectorAll('[data-product-card]').length,1,'stock scoped to selected cafe');
  d.querySelector('[data-add-product="plov"]').click();assert.match($('cafeStickyTotal').textContent,/110/,'location price is used');
  await w.ummaCafe.refreshMenu();assert.equal(gps.length,1,'refresh does not prompt again or switch an existing order');assert.match($('cafeStickyTotal').textContent,/110/);
  $('cafeStickyGoToOrder').click();$('cafeStickyGoToOrder').click();await tick();
  assert.equal(orders.length,1);assert.equal(orders[0].locationId,'south','order goes to same cafe as displayed menu');assert.equal($('cafeLocationSelect').value,'south','form reset keeps selected cafe');
  $('cafeResultMenu').click();d.querySelector('[data-add-product="plov"]').click();
  $('cafeNearbyDetect').click();assert.equal(gps.length,2);
  choose('north');assert.equal($('cafeLocationSelect').value,'north');assert.equal($('cafeStickyOrder').hidden,true,'switch clears previous cafe basket');
  gps[1].success({coords:{latitude:12.2,longitude:109.19}});
  assert.equal($('cafeNearbySelect').value,'north','late GPS cannot overwrite manual choice');assert.equal(d.querySelector('[data-product-card]').dataset.productCard,'soup');
  assert.equal(w.localStorage.length,0,'customer GPS is not persisted');
 }finally{f.close();}
}
for(const reason of [1,2,3]){
 const f=fixture();try{await f.w.ummaCafe.refreshMenu();f.gps[0].error({code:reason});assert.equal(f.$('cafeNearbySelectLabel').hidden,false);assert.equal(f.$('cafeLocationSelect').value,'');assert.equal(f.d.querySelectorAll('[data-product-card]').length,0);f.choose('north');assert.equal(f.d.querySelector('[data-product-card]').dataset.productCard,'soup');}finally{f.close();}
}
for(const options of [{geo:false},{locations:[cafes[0],{...cafes[1],latitude:null}]},{locations:[cafes[0],{...cafes[1],latitude:91}]}]){
 const f=fixture(options);try{await f.w.ummaCafe.refreshMenu();assert.equal(f.gps.length,0);assert.equal(f.$('cafeNearbySelectLabel').hidden,false);assert.equal(f.$('cafeLocationSelect').value,'','unknown distance never silently selects the first cafe');f.choose('south');assert.equal(f.$('cafeLocationSelect').value,'south');}finally{f.close();}
}
{
 const f=fixture({locations:[cafes[0]]});try{await f.w.ummaCafe.refreshMenu();assert.equal(f.gps.length,1,'a configured sole cafe also requests location');f.gps[0].success({coords:{latitude:NaN,longitude:0}});assert.equal(f.$('cafeLocationSelect').value,'');f.choose('north');f.d.querySelector('[data-add-product]').click();f.setLocations([cafes[1]]);await f.w.ummaCafe.refreshMenu();assert.equal(f.$('cafeStickyOrder').hidden,true,'removed cafe invalidates its basket');f.gps.at(-1).success({coords:{latitude:12.2,longitude:109.19}});assert.equal(f.$('cafeLocationSelect').value,'south');}finally{f.close();}
}
console.log('PASS nearest cafe: automatic GPS, second/sole cafe, selected menu/price/order binding, no random fallback, denied/timeout/invalid coordinates, manual override beats late GPS, refresh preserves selection/cart, removed cafe clears draft, no persisted coordinates');
