import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('js/cafe/courier-workflow.js','utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const until=async check=>{for(let n=0;n<100;n++){if(check())return;await tick();}assert.fail('Photo workflow did not settle');};
function runtime(saved=[]){
 const dom=new JSDOM('<div id="courierOffers" hidden></div><div id="cafeKitchenMessage"></div><button data-order-id="order" data-delivery-photo="pickup">Забрать · фото</button>',{pretendToBeVisual:true,runScripts:'outside-only',url:'https://synthetic-qa.invalid'}),w=dom.window,d=w.document;
 const calls=[],gps=[];let cancel=false,rejectUpload=false,loseTransition=false,refreshes=0;
 w.Telegram={WebApp:{initData:'synthetic',initDataUnsafe:{user:{id:20}}}};w.AbortSignal=AbortSignal;
 w.ummaKitchen={refresh:async()=>{refreshes++;}};
 w.ummaCourierTracking={start:async id=>{assert.equal(calls.at(-1).deliveryStatus,'picked_up','GPS starts after server confirms pickup');gps.push({id,enabled:true});},stop:async()=>gps.push({enabled:false}),isSharing:()=>gps.at(-1)?.enabled===true};
 w.ummaCafeRequests={request:async(url,body)=>{calls.push(body);if(rejectUpload)return new Response('{"ok":false,"error":"QA upload rejected"}',{status:400});return new Response('{"ok":true,"proof":{"id":"proof"}}');}};
 w.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);if(loseTransition){loseTransition=false;throw Error('response lost');}return new Response('{"ok":true}');};
 w.FileReader=class{readAsDataURL(){this.result='data:image/jpeg;base64,cWE=';queueMicrotask(()=>this.onload());}};
 w.Image=class{width=100;height=100;set src(value){queueMicrotask(()=>this.onload());}};
 w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/jpeg;base64,cWE=';
 w.HTMLInputElement.prototype.click=function(){if(cancel){this.oncancel?.();return;}Object.defineProperty(this,'files',{value:[{type:'image/jpeg',size:100}]});void this.onchange();};
 if(saved.length)w.sessionStorage.setItem('umma:courier-photo-transition:20',JSON.stringify(saved));
 w.eval(source);
 return {dom,w,d,calls,gps,get refreshes(){return refreshes;},set cancel(v){cancel=v;},set rejectUpload(v){rejectUpload=v;},set loseTransition(v){loseTransition=v;}};
}
let r=runtime();
try {
 const button=r.d.querySelector('button');button.click();button.click();
 assert.equal(button.disabled,true);assert.equal(button.textContent,'Сохраняем фото…');
 await until(()=>r.refreshes===1);
 assert.deepEqual(r.calls.map(x=>x.action),['uploadDeliveryProof','updateDelivery'],'one photo automatically confirms pickup once');
 assert.equal(r.gps.length,1,'pickup photo starts GPS automatically once');
 assert.equal(r.calls[1].deliveryStatus,'picked_up');assert.match(r.d.getElementById('cafeKitchenMessage').textContent,/получен курьером/);
 assert.equal(r.w.sessionStorage.length,0,'successful stage clears retry intent');
 button.dataset.deliveryPhoto='handover';button.click();await until(()=>r.refreshes===2);
 assert.equal(r.calls.at(-1).deliveryStatus,'delivered','handover photo automatically confirms delivery');
 assert.equal(r.gps.at(-1).enabled,false,'handover stops GPS immediately');
 r.cancel=true;const before=r.calls.length;button.click();await tick();assert.equal(r.calls.length,before,'cancelled camera never advances a stage');
 r.cancel=false;r.rejectUpload=true;button.click();await until(()=>!button.disabled);assert.equal(r.calls.at(-1).action,'uploadDeliveryProof','rejected upload never confirms delivery');
 r.rejectUpload=false;
 r.w.document.dispatchEvent(new r.w.CustomEvent('umma:cafe-operation-recovered',{detail:{payload:{action:'uploadDeliveryProof',orderId:'recovered',kind:'pickup'}}}));
 await until(()=>r.calls.at(-1).orderId==='recovered');await tick();
 assert.equal(r.calls.at(-1).deliveryStatus,'picked_up','recovered saved photo advances automatically without another tap');
 r.loseTransition=true;button.click();await until(()=>!button.disabled);
 const saved=JSON.parse(r.w.sessionStorage.getItem('umma:courier-photo-transition:20'));
 assert.equal(saved[0].kind,'handover','unknown update result retains only a stage intent');
 const restored=runtime(saved);
 try {await until(()=>restored.refreshes===1);assert.deepEqual(restored.calls.map(x=>x.action),['updateDelivery'],'reload resumes confirmation without another photo');assert.equal(restored.calls[0].deliveryStatus,'delivered');assert.equal(restored.w.sessionStorage.length,0);}finally{restored.w.close();}
 const gpsBeforeLateReplay=r.gps.length;const callsBeforeLateReplay=r.calls.length;
 r.w.document.dispatchEvent(new r.w.CustomEvent('umma:cafe-operation-recovered',{detail:{payload:{action:'uploadDeliveryProof',orderId:'already-closed',kind:'pickup'},result:{order:{id:'already-closed',status:'completed',deliveryStatus:'delivered',paymentStatus:'paid'}}}}));await tick();
 assert.equal(r.gps.length,gpsBeforeLateReplay,'late pickup replay never restarts GPS after handover');assert.equal(r.calls.length,callsBeforeLateReplay,'committed stage needs no second delivery request');
 console.log('PASS courier photos: one tap, duplicate suppression, pickup/handover auto confirmation, cancel/rejection safety, lost upload recovery and durable transition retry after reload');
} finally {r.w.close();}
