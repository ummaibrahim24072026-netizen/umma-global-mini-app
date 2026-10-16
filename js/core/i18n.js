/* Local, deterministic translations: no network requests and no changes to API values. */
(() => {
 'use strict';
 const supported=['ru','en','vi'], key='umma-language', catalogue=window.ummaTranslations||{};
 const normalise=value=>String(value||'').toLowerCase().replace(/_/g,'-').split('-')[0];
 const supportedCode=value=>supported.includes(normalise(value))?normalise(value):null;
 const readPreference=()=>{try{return localStorage.getItem(key)||'auto';}catch{return 'auto';}};
 let preference=readPreference();
 if(preference!=='auto'&&!supportedCode(preference))preference='auto';
 const automatic=()=>{
  const telegram=window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  // An unsupported Telegram language falls back to English, not another device language.
  if(telegram)return supportedCode(telegram)||'en';
  for(const code of navigator.languages||[navigator.language]){const match=supportedCode(code);if(match)return match;}
  return 'en';
 };
 let language=preference==='auto'?automatic():supportedCode(preference);
 const templates=[
  ['Найдено: {n} из {m}','Found: {n} of {m}','Tìm thấy: {n} / {m}'],
  ['Доступно в меню: {n}','Available dishes: {n}','Món hiện có: {n}'],
  ['Стол {n}','Table {n}','Bàn {n}'],
  ['Заказ №{id}','Order #{id}','Đơn hàng #{id}'],
  ['Заказ №{id} принят.','Order #{id} accepted.','Đã nhận đơn hàng #{id}.'],
  ['Уведомления сотрудникам кафе: {n}','Staff notified: {n}','Nhân viên được thông báo: {n}'],
  ['Сумма: {text}','Amount: {text}','Số tiền: {text}'],
  ['Кафе: {text}','Cafe: {text}','Quán: {text}'],
  ['Доступный остаток: {n}','Available stock: {n}','Tồn kho: {n}'],
  ['Уменьшить {text}','Decrease {text}','Giảm {text}'],
  ['Добавить ещё {text}','Add more {text}','Thêm {text}'],
  ['Добавить {text}','Add {text}','Thêm {text}'],
  ['VietQR для оплаты заказа №{id}','VietQR for order #{id}','VietQR cho đơn hàng #{id}'],
 ];
 function t(value){
  const source=String(value??''),trimmed=source.trim().replace(/\s+/g,' ');
  if(language==='ru')return source;
  let result=catalogue[trimmed]?.[language];
  if(!result){
   for(const [ru,en,vi] of templates){
    const pattern=ru.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{(\w+)\}/g,(_,name)=>name==='n'||name==='m'?'([0-9]+)':name==='id'?'([A-Za-z0-9#-]+)':'(.+)');
    const match=trimmed.match(new RegExp('^'+pattern+'$'));if(!match)continue;
    let index=0;result=(language==='vi'?vi:en).replace(/\{\w+\}/g,()=>match[++index]);break;
   }
  }
  if(!result){
   const count=trimmed.match(/^(\d+) (?:позиция|позиции|позиций|блюдо|блюда|блюд)$/);
   if(count)result=language==='vi'?count[1]+' món':count[1]+(count[1]==='1'?' item':' items');
   const weight=trimmed.match(/^(≈\s*)?(\d+(?:[.,]\d+)?) (г|мл)$/);
   if(weight)result=(weight[1]||'')+weight[2]+' '+(weight[3]==='г'?'g':'ml');
  }
  return result?source.slice(0,source.indexOf(source.trim()))+result+source.slice(source.trimEnd().length):source;
 }
 const locale=()=>({ru:'ru-RU',en:'en-GB',vi:'vi-VN'}[language]);
 function field(record,prefix){return record?.[prefix+'_'+language]||record?.[prefix+'_en']||record?.[prefix+'_ru']||record?.[prefix+'_vi']||'';}
 const textSources=new WeakMap(),attributeSources=new WeakMap();
 const skip='script,style,textarea,input,[contenteditable],code,pre,[translate="no"],[data-i18n-ignore],.leaflet-control-attribution';
 function translateText(node){
  if(!node.parentElement||node.parentElement.closest(skip))return;
  const current=node.data,prior=textSources.get(node);
  const source=prior&&current===prior.output?prior.source:current;
  const output=t(source);textSources.set(node,{source,output});if(current!==output)node.data=output;
 }
 const attributes=['placeholder','aria-label','title','alt'];
 function translateElement(element){
  if(element.closest('script,style,[contenteditable],code,pre,[translate="no"],[data-i18n-ignore],.leaflet-control-attribution'))return;
  let saved=attributeSources.get(element);if(!saved){saved={};attributeSources.set(element,saved);}
  for(const attr of attributes){
   if(!element.hasAttribute(attr))continue;
   const current=element.getAttribute(attr),prior=saved[attr];
   const source=prior&&current===prior.output?prior.source:current,output=t(source);
   saved[attr]={source,output};if(current!==output)element.setAttribute(attr,output);
  }
 }
 function translate(root=document.body){
  if(!root)return;
  if(root.nodeType===3){translateText(root);return;}
  if(root.nodeType!==1)return;
  translateElement(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){const node=walker.currentNode;if(node.nodeType===3)translateText(node);else translateElement(node);}
 }
 function sync(){
  document.documentElement.lang=language;
  document.documentElement.dir='ltr';
  const button=document.getElementById('languageBtn');
  if(button){button.textContent=language.toUpperCase();button.setAttribute('aria-label',{ru:'Выбрать язык',en:'Choose language',vi:'Chọn ngôn ngữ'}[language]);}
 }
 function setLanguage(value){
  if(value!=='auto'&&!supportedCode(value))return false;
  preference=value==='auto'?'auto':supportedCode(value);
  try{localStorage.setItem(key,preference);}catch{}
  language=preference==='auto'?automatic():preference;
  sync();window.dispatchEvent(new CustomEvent('umma:languagechange',{detail:{language,preference}}));translate();return true;
 }
 let dialog,returnFocus;
 function openPicker(){
  dialog?.remove();returnFocus=document.activeElement;
  dialog=document.createElement('dialog');dialog.className='umma-language-dialog';dialog.id='ummaLanguageDialog';
  const title=document.createElement('h2');title.id='ummaLanguageTitle';title.textContent={ru:'Язык приложения',en:'App language',vi:'Ngôn ngữ ứng dụng'}[language];
  dialog.setAttribute('aria-labelledby',title.id);dialog.append(title);
  for(const [code,label] of [['auto',{ru:'Автоматически · Telegram / устройство',en:'Automatic · Telegram / device',vi:'Tự động · Telegram / thiết bị'}[language]],['ru','Русский'],['en','English'],['vi','Tiếng Việt']]){
   const button=document.createElement('button');button.type='button';button.textContent=label;button.lang=code==='auto'?language:code;button.setAttribute('aria-pressed',String(preference===code));
   button.onclick=()=>{setLanguage(code);dialog.close();};dialog.append(button);
  }
  const close=document.createElement('button');close.type='button';close.textContent=t('Закрыть');close.onclick=()=>dialog.close();dialog.append(close);
  dialog.addEventListener('close',()=>returnFocus?.focus());document.body.append(dialog);dialog.showModal();
 }
 window.ummaI18n={t,field,locale,setLanguage,translate,openPicker,get language(){return language;},get preference(){return preference;},supported:Object.freeze([...supported])};
 sync();
 function start(){
  sync();translate();
  new MutationObserver(records=>{
   const roots=new Set();
   for(const record of records){
    if(record.type==='childList')for(const node of record.addedNodes)roots.add(node);
    else if(record.type==='characterData')roots.add(record.target);
    else roots.add(record.target);
   }
   for(const root of roots)if(root.isConnected)translate(root);
  }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
