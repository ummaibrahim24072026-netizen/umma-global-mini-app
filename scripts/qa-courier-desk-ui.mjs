import {JSDOM} from 'jsdom';import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{pretendToBeVisual:true,runScripts:'outside-only',url:'https://synthetic-qa.invalid'}),w=dom.window,d=w.document;
const tick=()=>new Promise(r=>setTimeout(r,10));const until=async fn=>{for(let n=0;n<150;n++){if(fn())return;await tick();}assert.fail('Courier desk did not settle');};
const personal={orderId:'near',orderNumber:71,locationName:'UMMA · Scenia Bay',pickupAddress:'Киоск №13 · север Нячанга',deliveryAddress:'Nguyễn Biểu, Нячанг',pickupDistanceM:350,kitchenStatus:'ready',totalVnd:150000,paymentTiming:'on_delivery',paymentStatus:'pending',expiresAt:new Date(Date.now()+60000).toISOString(),scope:'exclusive'};
const pool={...personal,orderId:'pool',orderNumber:72,pickupDistanceM:1200,deliveryAddress:'Bắc Sơn, Нячанг',scope:'pool'};
let heartbeatPulse;
let board={eligible:true,online:false,busy:false,gpsFresh:false,activeCount:0,completedToday:3,offers:[],available:[]},orders=[],watchCount=0,clears=0,position,releaseShift=null,holdShift=true,calls=[];
w.Telegram={WebApp:{initData:'synthetic',initDataUnsafe:{user:{id:20}}}};w.ummaRole='employee';w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.ummaCourierTracking={syncOrders(){},isSharing:()=>true};
w.setInterval=(fn,ms)=>{if(ms===30000)heartbeatPulse=fn;return 1;};w.clearInterval=()=>{};
Object.defineProperty(w.navigator,'geolocation',{value:{watchPosition:fn=>{watchCount++;position=fn;return 1;},clearWatch:()=>clears++}});
const accepted=id=>{const chosen=id==='near'?personal:pool;orders=[{id,order_number:chosen.orderNumber,location_id:'cafe',order_type:'delivery',status:'ready',delivery_status:'courier_assigned',courier_telegram_id:20,staffRole:'courier',canAcceptPayments:true,payment_timing:'on_delivery',payment_status:'pending',payment_method:'cash',total_vnd:150000,delivery_address:'Точка доставки: 12.3,109.2',cafe_order_items:[]}];board={...board,activeCount:1,busy:true,offers:[],available:[]};};
w.fetch=async(url,options)=>{const b=JSON.parse(options.body);calls.push(b);let data={ok:true};if(b.action==='list')data={ok:true,orders:structuredClone(orders),staffRole:'courier',actorTelegramId:20,locations:[{id:'cafe',latitude:12.24,longitude:109.19}],couriers:[],courierOffers:board.offers,dispatchBoard:structuredClone(board)};
 if(b.action==='courierAvailability'){if(holdShift)await new Promise(resolve=>releaseShift=resolve);board.online=b.online;if(b.online&&!board.busy){board.offers=[personal];board.available=[pool];}if(!b.online){board.offers=[];board.available=[];}}
 if(b.action==='courierPosition')board.gpsFresh=true;
 if(b.action==='respondCourierOffer'){accepted(b.orderId);data={ok:true,order:orders[0]};}
 return new Response(JSON.stringify(data));};
try{
 for(const file of ['js/cafe/courier-desk.js','js/cafe/courier-workflow.js','js/cafe/kitchen.js'])w.eval(readFileSync(file,'utf8'));
 w.ummaKitchen.open(true);await until(()=>d.getElementById('courierDeskOnline')&&!d.getElementById('courierDeskOnline').disabled);
 assert.equal(watchCount,0,'opening courier screen never starts shift GPS while offline');assert.match(d.getElementById('courierOffers').textContent,/пока не на линии/);
 d.getElementById('courierDeskOnline').click();assert.equal(d.getElementById('courierDeskOnline').disabled,true);assert.match(d.getElementById('courierDeskOnline').textContent,/Выходим/);holdShift=false;releaseShift();
 await until(()=>d.querySelector('[data-courier-accept]'));assert.equal(watchCount,1);assert.equal(d.getElementById('courierDeskOnline').disabled,false,'shift toggle stays usable after rerender');assert.ok(d.querySelector('[data-courier-claim]'));assert.match(d.getElementById('courierOffers').textContent,/по прямой/);assert.match(d.getElementById('courierOffers').textContent,/Получить у клиента/);assert.ok(!d.getElementById('courierOffers').textContent.includes('заработок'));
 position({timestamp:Date.now(),coords:{latitude:12.24,longitude:109.19,accuracy:20}});await until(()=>calls.some(x=>x.action==='courierPosition'));
 if(process.argv.includes('--preview'))writeFileSync('/tmp/umma-courier-desk-preview.html',d.documentElement.outerHTML.replace(/href="css\//g,'href="file://'+process.cwd()+'/css/'));
 const take=d.querySelector('[data-courier-accept]');take.click();take.click();await until(()=>d.querySelector('[data-delivery-photo="pickup"]'));
 assert.equal(calls.filter(x=>x.action==='respondCourierOffer').length,1);assert.equal(d.getElementById('cafeKitchenOrders').hidden,false);assert.equal(d.querySelector('[data-courier-tab="work"]').getAttribute('aria-selected'),'true');assert.match(d.querySelector('[data-show-route]').dataset.routeAddress,/12.24,109.19/,'assigned courier navigation leads to pickup cafe first');
 orders[0].status='completed';orders[0].delivery_status='delivered';orders[0].payment_status='paid';board={...board,busy:false,activeCount:0,available:[pool]};await w.ummaKitchen.refresh({silent:true});
 d.querySelector('[data-courier-tab="available"]').click();assert.equal(d.getElementById('cafeKitchenOrders').hidden,true);d.querySelector('[data-courier-claim]').click();await until(()=>calls.some(x=>x.action==='respondCourierOffer'&&x.market));await until(()=>d.getElementById('cafeKitchenOrders').hidden===false);
 holdShift=true;releaseShift=null;heartbeatPulse();await until(()=>releaseShift);d.getElementById('courierDeskOnline').click();assert.equal(calls.filter(x=>x.action==='courierAvailability'&&x.online===false).length,0,'offline change waits for an in-flight heartbeat');holdShift=false;releaseShift();await until(()=>!board.online);await tick();assert.equal(clears,1,'going offline stops dispatch GPS');assert.equal(orders[0].delivery_status,'courier_assigned','going offline does not abandon the current delivery');
 console.log('PASS courier desk UI: explicit online GPS, immediate toggle feedback, personal/pool offers, honest distances/cash, single-tap acceptance, self-choice, pickup navigation, work/history tabs and offline-with-current-delivery');
}finally{w.close();}
