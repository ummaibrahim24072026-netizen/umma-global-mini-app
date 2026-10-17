import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const script=readFileSync('js/cafe/delivery-chat.js','utf8'),css=readFileSync('css/delivery-chat.css','utf8');
const template=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src 'self' about:; connect-src 'none'"><title>UMMA — isolated customer and courier chat test</title><style>body{font:16px system-ui;background:#e8f5f3;color:#173e3d;margin:16px}h1{font-size:23px}main{display:flex;gap:16px;flex-wrap:wrap}iframe{width:390px;height:720px;border:2px solid #23706c;border-radius:14px;background:white}section h2{font-size:18px}</style><h1>Тест чата: два разных участника</h1><p>Изолированный стенд. Настоящие заказы, Telegram-аккаунты, сеть и уведомления не используются. Перевод здесь имитируется.</p><main><section><h2>Клиент · русский</h2><iframe title="Клиент"></iframe></section><section><h2>Курьер · вьетнамский</h2><iframe title="Курьер"></iframe></section></main><script>
const messages=[];let seq=0;const id='00000000-0000-4000-8000-000000000013';
window.qaFetch=async(role,body)=>{
const actor=role==='customer'?'customer':'courier',peer=actor==='customer'?'courier':'customer',lang=actor==='customer'?'ru':'vi';
if(body.action==='send'){let m=messages.find(m=>m.sender===actor&&m.requestKey===body.requestKey);if(!m){m={id:crypto.randomUUID(),seq:++seq,kind:'text',text:body.text,sender:actor,language:lang,requestKey:body.requestKey,createdAt:new Date().toISOString(),translations:{}};messages.push(m);}return {ok:true,messageId:m.id,sent:true};}
if(body.action==='translate'){const m=messages.find(m=>m.id===body.messageId);m.translations[lang]={state:'ready',text:lang==='vi'?'Tôi đang ở lối vào.':'Я приехал.',attempts:1};return {ok:true,state:'ready'};}
if(body.action==='list'){messages.filter(m=>m.sender!==actor).forEach(m=>m.readAt=new Date().toISOString());return {ok:true,translationConfigured:true,translationProvider:'mymemory',voiceTranslationConfigured:false,context:{threadKey:'fixture-pair',role:actor,orderNumber:13,canSend:true,waiting:false,language:lang,peerLanguage:lang==='ru'?'vi':'ru'},messages:messages.map(m=>({...m,own:m.sender===actor,translation:m.sender===actor?null:m.translations[lang]||null}))};}throw Error('Unsupported fixture action');};
const source=SCRIPT_DATA,css=CSS_DATA;
for(const [i,role] of ['customer','courier'].entries()){
const setup='window.Telegram={WebApp:{initData:"fixture-only"}};window.ummaI18n={language:'+JSON.stringify(role==='customer'?'ru':'vi')+',t:s=>s,locale:()=>"ru-RU"};window.fetch=async(url,options)=>({ok:true,json:async()=>parent.qaFetch('+JSON.stringify(role)+',JSON.parse(options.body))});';
const doc='<!doctype html><meta charset="utf-8"><style>body{font:16px system-ui}'+css+'</style><button data-delivery-chat="'+id+'">Открыть чат</button><script>'+setup+'<'+ '/script><script>'+source+'<'+ '/script>';
document.querySelectorAll('iframe')[i].srcdoc=doc;
}
</script></html>`;
const html=template.replace('SCRIPT_DATA',JSON.stringify(script).replace(/</g,'\\u003c')).replace('CSS_DATA',JSON.stringify(css).replace(/</g,'\\u003c'));
mkdirSync('docs/qa-delivery-chat',{recursive:true});writeFileSync('docs/qa-delivery-chat/index.html',html);
