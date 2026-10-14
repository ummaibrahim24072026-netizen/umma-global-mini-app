import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const errors=[];const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
const dom=new JSDOM(readFileSync('docs/qa-ui-fixture/index.html','utf8'),{runScripts:'dangerously',virtualConsole:console,beforeParse(window){window.Response=Response;window.scrollTo=()=>{};window.alert=()=>{};window.confirm=()=>true;window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;};}});
const w=dom.window,d=w.document;
async function until(check){for(let n=0;n<100;n++){if(check())return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('UI did not reach expected state');}
try{
 await until(()=>d.querySelector('[data-staff-add]'));
 assert.equal(d.getElementById('cafeWaiterPage').hidden,false);
 d.getElementById('qaWidth').value='390';d.getElementById('qaWidth').dispatchEvent(new w.Event('change'));assert.equal(d.querySelector('.app').style.width,'390px');
 d.querySelector('[data-staff-service="delivery"]').click();
 d.querySelector('[data-staff-add]').click();assert.equal(d.getElementById('staffOrderSummary').hidden,false);
 d.getElementById('staffOrderCustomerName').value='QA clickable guest';d.getElementById('staffOrderAddress').value='QA long address';
 d.getElementById('staffOrderPayment').value='courier';d.getElementById('staffOrderPayment').dispatchEvent(new w.Event('change'));
 assert.match(d.getElementById('staffOrderSubmit').textContent,/при получении/);
 d.getElementById('staffOrderForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>d.getElementById('staffOrderMessage').textContent.includes('Оплата курьеру'));
 d.getElementById('qaKitchen').click();await new Promise(resolve=>setTimeout(resolve,20));await until(()=>d.querySelector('[data-delivery-status="picked_up"]'));
 d.querySelector('[data-delivery-status="picked_up"]').click();await until(()=>d.querySelector('[data-delivery-status="delivered"]'));
 d.getElementById('qaPaid').click();await until(()=>d.querySelector('[data-refund-order]'));d.querySelector('[data-refund-order]').click();
 assert.ok(d.querySelector('.cafe-refund-dialog').open);d.querySelector('[data-close-refund]').click();assert.equal(d.querySelector('.cafe-refund-dialog'),null);
 assert.deepEqual(errors,[]);
 process.stdout.write('PASS actual generated UI: startup, width change, delivery selection, cart, courier checkout, kitchen status and refund dialog clicks; no script errors\n');
}finally{w.close();}
