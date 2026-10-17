import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),console_=new VirtualConsole();
const dom=new JSDOM(html,{url:'https://isolated-chat.invalid',runScripts:'outside-only',virtualConsole:console_}),w=dom.window,d=w.document;
const tick=()=>new Promise(r=>setImmediate(r));
w.crypto.randomUUID=randomUUID;w.AbortSignal.timeout=()=>undefined;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
w.HTMLMediaElement.prototype.pause=function(){};w.URL.createObjectURL=()=> 'blob:isolated-test';w.URL.revokeObjectURL=()=>{};
w.Telegram={WebApp:{initData:'isolated-test',initDataUnsafe:{user:{id:10,language_code:'ru'}}}};
const order=randomUUID(),sent=[],messages=[{id:randomUUID(),seq:1,kind:'text',own:false,text:'<img src=x onerror=alert(1)>',createdAt:new Date().toISOString(),translation:{state:'ready',text:'Я у входа.',attempts:1}},{id:randomUUID(),seq:2,kind:'voice',own:false,text:'',mediaUrl:'https://isolated-chat.invalid/original.webm',createdAt:new Date().toISOString(),translation:{state:'ready',text:'Подойдите ко входу.',transcript:'Come to the entrance.',audioUrl:'https://isolated-chat.invalid/translated.mp3',attempts:1}}];
let lostResponse=true,uploaded=false,canSend=true,reads=0,stops=0,requestMicrophone;
Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:()=>new Promise(resolve=>{requestMicrophone=resolve;})}});
class Recorder{static isTypeSupported(){return true;}constructor(){this.state='inactive';this.mimeType='audio/webm;codecs=opus';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new w.Blob(['voice'],{type:'audio/webm'})});this.onstop?.();}}
w.MediaRecorder=Recorder;
w.fetch=async(url,options)=>{
 if(url==='https://isolated-chat.invalid/upload'){uploaded=true;return {ok:true};}
 assert.match(url,/\/delivery-chat$/);const body=JSON.parse(options.body);sent.push(body);
 if(body.action==='list'){reads++;return {ok:true,json:async()=>({ok:true,translationConfigured:true,context:{role:'customer',orderNumber:7,canSend,waiting:false},messages})};}
 if(body.action==='send'){if(lostResponse){lostResponse=false;throw Error('lost response');}return {ok:true,json:async()=>({ok:true,messageId:randomUUID(),sent:true})};}
 if(body.action==='prepare')return {ok:true,json:async()=>({ok:true,sent:false,messageId:'prepared-message',uploadUrl:'https://isolated-chat.invalid/upload'})};
 if(body.action==='finish')return {ok:uploaded,json:async()=>uploaded?{ok:true,sent:true}:{ok:false,code:'CHAT_UPLOAD',error:'upload pending'}};
 return {ok:true,json:async()=>({ok:true,state:'ready'})};
};
try{
 w.eval(readFileSync('js/cafe/delivery-chat.js','utf8'));w.eval(readFileSync('js/core/navigation.js','utf8'));
 const opener=d.createElement('button');d.body.append(opener);w.ummaDeliveryChat.open(order,opener);await tick();
 const dialog=d.querySelector('.delivery-chat-dialog'),input=dialog.querySelector('textarea'),form=dialog.querySelector('form');
 assert.match(dialog.querySelector('h2').textContent,/№7/);assert.equal(dialog.querySelectorAll('.chat-message').length,2);assert.equal(dialog.querySelector('.chat-message img'),null,'untrusted message is rendered as text, never HTML');
 assert.match(dialog.textContent,/Я у входа/);assert.match(dialog.querySelector('.chat-message details p').textContent,/<img/);assert.equal(dialog.querySelectorAll('.chat-message audio').length,2,'original voice and translated audio are both available');
 const playing=dialog.querySelector('.chat-message audio');
 d.dispatchEvent(new w.Event('visibilitychange'));await tick();assert.equal(dialog.querySelector('.chat-message audio'),playing,'polling retains player node');
 input.value='Тест';form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(sent.filter(b=>b.action==='send').length,1,'double tap suppressed');assert.equal(input.value,'Тест','failed send preserves draft');
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();const textSends=sent.filter(b=>b.action==='send');assert.equal(textSends[0].requestKey,textSends[1].requestKey,'lost response reuses message key');assert.equal(input.value,'');
 const fileInput=dialog.querySelector('[type=file]');Object.defineProperty(fileInput,'files',{configurable:true,value:[new w.File(['photo'],'photo.png',{type:'image/png'})]});fileInput.dispatchEvent(new w.Event('change'));
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();await tick();assert.equal(uploaded,true);assert.equal(sent.find(b=>b.action==='prepare').kind,'photo');
 const record=dialog.querySelector('[data-chat-record]');record.click();assert.ok(requestMicrophone,'mic requested only by record button');
 requestMicrophone({getTracks:()=>[{stop(){stops++;}}]});await tick();assert.match(record.textContent,/Остановить/);record.click();await tick();assert.ok(stops>0);assert.ok(dialog.querySelector('.chat-preview audio'),'recording is reviewed before sending');
 assert.equal(sent.filter(b=>b.action==='prepare'&&b.kind==='voice').length,0,'recording is not sent automatically');
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();await tick();assert.ok(sent.some(b=>b.action==='prepare'&&b.kind==='voice'));
 assert.equal(w.ummaNavigation.back(),true);assert.equal(w.ummaDeliveryChat.isOpen(),false);assert.equal(d.activeElement,opener);
 // Closing during microphone permission acquisition must release a late stream.
 w.ummaDeliveryChat.open(order,opener);await tick();d.querySelector('[data-chat-record]').click();w.ummaDeliveryChat.close();const before=stops;requestMicrophone({getTracks:()=>[{stop(){stops++;}}]});await tick();assert.equal(stops,before+1);
 // Free mode: truthful voice guidance, device TTS and provider disclosure.
 let spoken,cancelled=0;w.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 w.speechSynthesis={getVoices:()=>[{lang:'ru-RU'}],cancel(){cancelled++;},speak(value){spoken=value;}};
 const oldFetch=w.fetch;w.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='list'){const r=await oldFetch(url,options),data=await r.json();return {ok:true,json:async()=>({...data,translationProvider:'mymemory',voiceTranslationConfigured:false})};}return oldFetch(url,options);};
 w.ummaDeliveryChat.open(order,opener);await tick();
 assert.match(d.querySelector('.chat-note').textContent,/микрофон на клавиатуре/);
 d.querySelector('[data-chat-speak]').click();assert.equal(spoken.text,'Я у входа.');assert.equal(spoken.lang,'ru-RU');
 assert.equal(d.querySelector('.chat-privacy').hidden,false);
 w.ummaDeliveryChat.close();assert.ok(cancelled>0);
 canSend=false;w.ummaDeliveryChat.open(order,opener);await tick();assert.equal(d.querySelector('.chat-compose [type=submit]').disabled,true);assert.match(d.querySelector('.chat-note').textContent,/завершена/);
 w.ummaDeliveryChat.close();assert.ok(reads>=3);
 console.log('PASS chat UI: safe original/translation rendering, paired voice players, stable media on polling, no-send before explicit confirmation, photo upload, duplicate tap/lost-response replay, microphone consent and late-stream cleanup, native Back/focus, closed-order read-only composer');
}finally{w.ummaDeliveryChat?.close();w.close();}
