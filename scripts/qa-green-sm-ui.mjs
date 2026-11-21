import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = path => readFileSync(path, 'utf8');
const dom = new JSDOM('<html lang="ru"><body><ol id="chat"></ol></body></html>', {
  url: 'https://umma.example', runScripts: 'outside-only',
});
const { window: w } = dom;
try {
  w.eval(read('js/cafe/order-inbox.js'));
  const chat = w.document.querySelector('#chat');
  const order = {id:'example-order', orderNumber:810, status:'ready', orderType:'delivery', paymentStatus:'paid', isGreenSm:true};
  const render = patch => {
    w.ummaOrderInbox.publish({...order,...patch});
    w.ummaOrderInbox.renderChatFeed(chat);
    return chat.querySelector('.umma-chat-order-card');
  };
  let card = render({greenSmStage:'booked'});
  assert.match(card.textContent, /Курьер вызван/);
  assert.equal(card.querySelector('a'),null);
  card = render({greenSmStage:'picked_up',greenSmTrackingUrl:'https://greensm.com.example.org/track'});
  assert.equal(card.querySelector('a'),null);
  card = render({greenSmStage:'picked_up',greenSmTrackingUrl:'https://booking.xanhsm.com/qa-example'});
  assert.match(card.textContent, /Курьер забрал заказ/);
  assert.equal(card.querySelector('a').href,'https://booking.xanhsm.com/qa-example');
  const stages=card.querySelector('.umma-order-stages');
  assert.match(stages.textContent,/Заказ оформлен.*Оплата подтверждена.*Заказ доставлен/);
  assert.equal(stages.querySelector('[aria-current=step]').dataset.stage,'green_picked_up');
  assert.equal(stages.querySelector('[data-stage=delivered]').dataset.state,'upcoming');
  assert.equal(chat.children.length,1);
  card = render({greenSmStage:'delivered',status:'completed'});
  assert.match(card.textContent,/Заказ доставлен/);
  assert.equal(card.querySelector('a').hidden,true);
  card.querySelector('[aria-expanded]').click();
  assert.equal(card.querySelector('a').hidden,false);

  w.eval(read('js/delivery/green-sm-adapter.js'));
  const delivery={id:'qa-courier',order_type:'delivery',created_via:'customer',dispatch_mode:'manual',
    payment_status:'paid',requires_prepayment:true,status:'ready',delivery_address:'QA street'};
  const section=w.document.createElement('div');
  section.innerHTML=w.ummaGreenSm.card(delivery,{address:'QA pickup'});
  assert.equal(section.querySelector('a').hasAttribute('data-green-stage'),false);
  assert.equal(section.querySelector('[data-green-stage]').dataset.greenStage,'booked');
  section.innerHTML=w.ummaGreenSm.card({...delivery,green_sm_stage:'picked_up'},{address:'QA pickup'});
  assert.equal(section.querySelector('[data-green-stage]').dataset.greenStage,'delivered');
  assert.doesNotMatch(w.ummaGreenSm.transfer({...delivery,status:'preparing',staffRole:'kitchen',accepted_by_telegram_id:3},4),/data-preparation-transfer/);
  assert.match(w.ummaGreenSm.transfer({...delivery,status:'preparing',staffRole:'kitchen',accepted_by_telegram_id:3},3),/data-preparation-transfer/);

  let socket;
  w.WebSocket=class {
    constructor(){socket=this;}
    send(frame){this.frames=(this.frames||[]).concat(JSON.parse(frame));}
    close(){this.onclose?.();}
  };
  Object.defineProperty(w.document,'hidden',{value:false});
  Object.defineProperty(w.document,'currentScript',{value:w.document.createElement('script')});
  w.document.currentScript.dataset.fulfillmentRealtime='';
  let signals=0, messages=0;
  w.document.addEventListener('umma:connect-realtime',()=>messages++);
  w.document.addEventListener('umma:fulfillment-realtime',()=>signals++);
  w.eval(read('js/cafe/connect-realtime.js'));
  socket.onopen();
  const [messageJoin,orderJoin]=socket.frames;
  assert.equal(messageJoin.topic,'realtime:umma-connect-signals');
  const topic=orderJoin.topic;
  assert.equal(topic,'realtime:umma-fulfillment');
  socket.onmessage({data:JSON.stringify({topic:messageJoin.topic,event:'postgres_changes'})});
  socket.onmessage({data:JSON.stringify({topic:messageJoin.topic,event:'phx_reply',payload:{status:'error'}})});
  socket.onmessage({data:JSON.stringify({topic,event:'broadcast',payload:{event:'order-change'}})});
  await new Promise(resolve=>setTimeout(resolve,130));
  assert.equal(signals,1);
  assert.equal(messages,1);
  const previous=socket;
  previous.close();
  w.dispatchEvent(new w.Event('online'));
  assert.notEqual(socket,previous);
  socket.onopen();
  socket.onmessage({data:JSON.stringify({topic,event:'phx_reply',payload:{status:'ok'}})});
  await new Promise(resolve=>setTimeout(resolve,130));
  assert.equal(signals,2);
  console.log('PASS Green SM staff steps, safe link and progress in chat, handoff visibility and Realtime reconnect refresh');
} finally { w.close(); }
