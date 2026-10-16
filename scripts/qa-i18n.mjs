import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
function setup({telegram,browser='en-GB',saved}={}){
 const dom=new JSDOM(html,{url:'https://umma.example/',runScripts:'outside-only'}),w=dom.window;
 Object.defineProperty(w.navigator,'languages',{value:[browser]});
 if(telegram)w.Telegram={WebApp:{initDataUnsafe:{user:{id:123,first_name:'Ибрахим',language_code:telegram}}}};
 if(saved)w.localStorage.setItem('umma-language',saved);
 for(const file of ['translations','i18n'])w.eval(readFileSync('js/core/'+file+'.js','utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {dom,w,d:w.document,i:w.ummaI18n};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
for(const [config,expected] of [[{telegram:'vi',browser:'ru'},'vi'],[{telegram:'ru-RU'},'ru'],[{telegram:'fr',browser:'ru'},'en'],[{browser:'vi-VN'},'vi'],[{browser:'de'},'en'],[{telegram:'vi',saved:'ru'},'ru'],[{telegram:'vi',saved:'invalid'},'vi']]){
 const {w,i}=setup(config);assert.equal(i.language,expected);assert.equal(w.document.documentElement.lang,expected);w.close();
}
const {w,d,i}=setup({telegram:'vi'});
assert.equal(d.getElementById('cafeSubmitOrder').textContent.trim(),'Đặt hàng');
assert.equal(i.t('Найдено: 2 из 5'),'Tìm thấy: 2 / 5');
assert.equal(i.t('≈ 450 г'),'≈ 450 g');
assert.equal(i.t('3 позиции'),'3 món');
assert.equal(i.t('Заказ №UMMA-123'),'Đơn hàng #UMMA-123');
const search=d.getElementById('cafeMenuSearch');
assert.ok(!/[а-яё]/i.test(search.getAttribute('placeholder')),'search placeholder translated');
assert.ok(!/[а-яё]/i.test(d.querySelector('#cafeOrderForm textarea').getAttribute('placeholder')||''),'textarea placeholder translated');
const dynamic=d.createElement('button');dynamic.textContent='Итого';dynamic.setAttribute('aria-label','Закрыть');d.body.append(dynamic);await tick();
assert.equal(dynamic.textContent,'Tổng cộng');assert.equal(dynamic.getAttribute('aria-label'),'Đóng');
i.setLanguage('en');assert.equal(dynamic.textContent,'Total');
i.setLanguage('ru');assert.equal(dynamic.textContent,'Итого');
dynamic.textContent='Оплачено';await tick();i.setLanguage('en');assert.equal(dynamic.textContent,'Paid','external renderer changes source correctly');
const userInput=d.getElementById('cafeCustomerName');userInput.value='Итого';i.setLanguage('vi');assert.equal(userInput.value,'Итого');
const protectedText=d.createElement('p');protectedText.setAttribute('translate','no');protectedText.textContent='Итого';d.body.append(protectedText);await tick();assert.equal(protectedText.textContent,'Итого');
assert.equal(i.field({name_ru:'Русский',name_en:'English',name_vi:'Tiếng Việt'},'name'),'Tiếng Việt');
assert.equal(i.field({name_ru:'Русский',name_en:'English'},'name'),'English');
i.setLanguage('auto');assert.equal(i.language,'vi');assert.equal(w.localStorage.getItem('umma-language'),'auto');
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
i.openPicker();d.querySelectorAll('#ummaLanguageDialog button')[2].click();assert.equal(i.language,'en');assert.equal(d.getElementById('ummaLanguageDialog').open,false);
// Live menu switches language locally, without network writes, and preserves cart and entered details.
const products=[{id:'plov',sku:'UMMA-CAFE-PLOV',name_ru:'Плов',name_en:'Lamb plov',name_vi:'Cơm cừu',description_ru:'Рис',description_en:'Rice',description_vi:'Cơm',price_vnd:120000}];
let requests=0;w.fetch=async()=>{requests++;return {ok:true,json:async()=>({ok:true,products,inventory:[],inventoryControlEnabled:false,location:{id:'cafe',name:'UMMA'}})};};
w.eval(readFileSync('js/cafe/cafe.js','utf8'));await w.ummaCafe.refreshMenu();
d.querySelector('[data-add-product="plov"]').click();userInput.value='Гость';const before=requests;
i.setLanguage('vi');await tick();assert.equal(d.querySelector('[data-product-card] h3').textContent,'Cơm cừu');assert.equal(d.querySelector('.cafe-cart-row strong').textContent,'Cơm cừu');assert.equal(userInput.value,'Гость');assert.equal(d.querySelector('.cafe-product-quantity').textContent,'1');assert.equal(requests,before);
i.setLanguage('ru');await tick();assert.equal(d.querySelector('[data-product-card] h3').textContent,'Плов');
w.eval(readFileSync('js/core/app.js','utf8'));
w.eval(readFileSync('js/core/native-shell.js','utf8'));
d.getElementById('languageBtn').click();assert.equal(d.getElementById('ummaLanguageDialog').open,true,'real header button opens picker');
d.querySelectorAll('#ummaLanguageDialog button')[3].click();await tick();assert.equal(d.documentElement.lang,'vi');assert.equal(d.getElementById('languageBtn').textContent,'VI');
w.close();console.log('PASS language detection, fallbacks, reversible dynamic UI, accessibility, picker, product fields and cart preservation');
