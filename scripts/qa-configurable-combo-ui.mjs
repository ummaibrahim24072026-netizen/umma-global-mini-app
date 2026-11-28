import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read = path => readFileSync(path,'utf8');
const tick = () => new Promise(resolve=>setTimeout(resolve,30));
const id = '33333333-3333-4333-8333-333333333333';
const dishId = '44444444-4444-4444-8444-444444444444';
const drinkId = '55555555-5555-4555-8555-555555555555';
const thirdId = '66666666-6666-4666-8666-666666666666';
const option = (id,productId,name,amount,unit,priceVnd,surchargeVnd=0,availablePortions=10) =>
 ({id,productId,name_ru:name,name_en:name,name_vi:name,amount,unit,priceVnd,surchargeVnd,portions:1,availablePortions});
const dish = {id:dishId,sku:'UMMA-CAFE-PLOV',name_ru:'Плов',name_en:'Plov',name_vi:'Cơm plov',price_vnd:60000,stockManaged:true,available:10};
const combo = {id,sku:'UMMA-COMBO-'+id,name_ru:'COMBO №1',name_en:'COMBO №1',name_vi:'COMBO №1',price_vnd:80000,stockManaged:true,
 comboConfiguration:{mode:'fixed',basePriceVnd:80000,recommendations:[dishId],
  fixed:[option('plov',dishId,'Плов',150,'g',60000)],
  groups:[{id:'drink',kind:'drink',defaultId:'regular',options:[
   option('regular',drinkId,'Айран',300,'ml',30000),option('large',thirdId,'Айран',500,'ml',40000,10000),
   option('sold-out','77777777-7777-4777-8777-777777777777','Компот',500,'ml',40000,10000,0),
  ]}],
  extras:[option('sauce',dishId,'Соус',1,'pcs',10000,10000)]}};
const calls = [];
const dom = new JSDOM(read('menu/index.html'),{url:'https://qa.invalid/menu/',runScripts:'dangerously',pretendToBeVisual:true,
 beforeParse(window){
  window.AbortSignal=AbortSignal;
  window.localStorage.setItem('umma-menu-language','ru');
  window.HTMLDialogElement.prototype.show=window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  for(const path of ['js/cafe/public-menu-i18n.js','js/cafe/public-menu-extras.js','js/cafe/combo-configurator.js'])window.eval(read(path));
  window.fetch=async (url,request)=>{
   if(!request?.body)return new Response(JSON.stringify({ok:true,products:[dish,combo]}));
   calls.push(JSON.parse(request.body));
   return new Response(JSON.stringify({ok:false,code:'COMBO_PRICE_CHANGED'}),{status:409});
  };
 }});
const {window}=dom;
try {
 await tick();
 const d=window.document;
 const click = selector => {
  const button=d.querySelector(selector);
  assert.ok(button,selector);
  button.click();
 };
 window.eval("cafeSection='combo';renderCategories();renderProducts()");
 const comboButton='[data-card="'+id+'"] .dish-link';
 click(comboButton);
 const drink=d.querySelector('[data-combo-choice="drink"]');
 assert.equal(drink.value,'regular');
 assert.equal(drink.querySelector('[value="sold-out"]').disabled,true);
 assert.match(d.querySelector('[data-combo-price]').textContent,/10\s*000/);
 click('[data-combo-submit]');
 click(comboButton);
 const newDrink=d.querySelector('[data-combo-choice="drink"]');
 newDrink.value='large';
 newDrink.dispatchEvent(new window.Event('change',{bubbles:true}));
 const extra=d.querySelector('[data-combo-extra="sauce"]');
 extra.value='1';
 extra.dispatchEvent(new window.Event('change',{bubbles:true}));
 assert.match(d.querySelector('[data-combo-submit]').textContent,/100\s*000/);
 click('[data-combo-submit]');
 click('#openCart');
 assert.equal(d.querySelectorAll('#cartItems .cart-row').length,2);
 assert.match(d.querySelector('#cartItems').textContent,/500 мл/);
 assert.match(d.querySelector('#cartItems').textContent,/Соус/);
 click('#cartItems .cart-row:first-child [data-dish]');
 assert.equal(d.querySelector('[data-combo-choice="drink"]').value,'regular');
 click('[data-combo-submit]');
 assert.equal(d.querySelectorAll('#cartItems .cart-row').length,2);
 d.querySelector('#form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 await tick();
 const checkout=calls.find(call=>call.action==='create');
 assert.equal(checkout.items.length,2);
 assert.deepEqual(checkout.items.map(item=>item.productId),[id,id]);
 assert.deepEqual(checkout.items.map(item=>item.expectedUnitPriceVnd).sort((a,b)=>a-b),[80000,100000]);
 assert.deepEqual(checkout.items.find(item=>item.expectedUnitPriceVnd===100000).comboSelection,{choices:{drink:'large'},extras:{sauce:1}});
 assert.match(d.querySelector('#result').textContent,/Проверьте комплектацию/);
 console.log('PASS combo web menu: unavailable choice, optional extras, live price, independent configurations, cart editing and server reprice.');
} finally {
 window.close();
}
