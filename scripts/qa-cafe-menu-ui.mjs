import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{url:'https://umma.example/',runScripts:'outside-only'}),w=dom.window,d=w.document;
const products=[
 {id:'plov',sku:'UMMA-CAFE-PLOV',name_ru:'Плов',name_en:'Plov',description_ru:'С бараниной',price_vnd:120000,image_url:'https://images.example/plov.jpg'},
 {id:'manti',sku:'QA-UNTRUSTED-PHOTO',name_ru:'Манты',description_vi:'Thịt cừu',price_vnd:150000,image_url:'javascript:alert(1)'},
 {id:'sold',name_ru:'Нет в наличии',price_vnd:1}
];
const inventory=products.map((p,i)=>({product_id:p.id,location_id:'cafe',quantity:i===2?0:2,reserved_quantity:0,is_available:true}));
w.fetch=async()=>({ok:true,json:async()=>({ok:true,products,inventory,inventoryControlEnabled:true,location:{id:'cafe',name:'UMMA'}})});
const search=query=>{d.getElementById('cafeMenuSearch').value=query;d.getElementById('cafeMenuSearch').dispatchEvent(new w.Event('input'));};
try{
 w.eval(readFileSync('js/cafe/cafe.js','utf8'));
 d.getElementById("cafePage").hidden=false;
 await w.ummaCafe.refreshMenu();
 assert.equal(d.querySelectorAll('[data-product-card]').length,2);
 assert.equal(d.querySelectorAll('.cafe-product-photo').length,1,'unsafe URL omitted');
 assert.equal(d.querySelector('.cafe-product-photo').alt,'Плов');
 d.querySelector('[data-add-product="plov"]').click();
 assert.match(d.getElementById('cafeCartTotal').textContent,/120/);
 assert.equal(d.getElementById('cafeStickyOrder').hidden,false);
 search('THỊT');assert.equal(d.querySelectorAll('[data-product-card]').length,1);assert.ok(d.querySelector('[data-product-card="manti"]'));
 search('бараниной');assert.equal(d.querySelectorAll('[data-product-card]').length,1);
 assert.equal(d.querySelector('.cafe-card-quantity strong').textContent,'1','quantity survives filtering');
 d.querySelector('[data-add-product="plov"]').click();d.querySelector('[data-add-product="plov"]').click();
 assert.equal(d.querySelector('.cafe-card-quantity strong').textContent,'2','stock limit preserved');
 search('<script>');assert.equal(d.querySelectorAll('[data-product-card]').length,0);assert.match(d.getElementById('cafeProducts').textContent,/Ничего не найдено/);
 assert.match(d.getElementById('cafeMenuCount').textContent,/0 из 2/);
 d.getElementById('cafeMenuSearchClear').click();assert.equal(d.querySelectorAll('[data-product-card]').length,2);assert.equal(d.activeElement.id,'cafeMenuSearch');
 const photo=d.querySelector('.cafe-product-photo');assert.ok(photo.closest('.cafe-product-media'));photo.dispatchEvent(new w.Event('error'));assert.equal(photo.hidden,true);assert.equal(photo.closest(".cafe-product-media").hidden,true,"failed photo collapses its frame");
 d.querySelector('[data-product-card="plov"] [data-cart-change="-1"]').click();d.querySelector('[data-product-card="plov"] [data-cart-change="-1"]').click();
 assert.equal(d.getElementById('cafeStickyOrder').hidden,true);assert.equal(d.getElementById('cafeOrderForm').hidden,true);
 // Exercise category/search intersection with distinct dishes and ambiguous names.
 const extra=[
  ['soup','SHURPA','Шурпа'],['chicken','CHICKEN-LEG-SALAD','Куриный окорочок с салатом'],
  ['salad','CRUNCHY-SALAD','Салат Хрустящий'],['bread','FLATBREAD','Лепёшка'],
  ['dessert','CROISSANT','Круассан'],['tea','GREEN-TEA-900','Чай зелёный'],['sauce','ADJIKA','Аджика']
 ];
 for(const [id,sku,name_ru] of extra){products.push({id,sku:'UMMA-CAFE-'+sku,name_ru,price_vnd:50000});inventory.push({product_id:id,location_id:'cafe',quantity:2,is_available:true});}
 await w.ummaCafe.refreshMenu();
 const category=id=>d.querySelector('[data-menu-category="'+id+'"]');
 assert.equal(d.querySelectorAll('.cafe-category-heading').length,8,'all sections grouped; unknown SKU stays visible');
 assert.equal(d.querySelector('.cafe-category-heading').textContent,'Супы1');
 assert.equal(category('all').getAttribute('aria-pressed'),'true');
 assert.ok(category('desserts'),'desserts separate from savoury bakery');
 category('mains').click();
 assert.equal(d.querySelectorAll('[data-product-card]').length,2);
 assert.ok(d.querySelector('[data-product-card="chicken"]'),'chicken with salad remains a main');
 assert.equal(category('mains').getAttribute('aria-pressed'),'true');
 assert.equal(d.activeElement,category('mains'),'focus survives rerender');
 d.querySelector('[data-add-product="plov"]').click();
 category('salads').click();
 assert.equal(d.querySelectorAll('[data-product-card]').length,1);
 search('Плов');assert.equal(d.querySelectorAll('[data-product-card]').length,0,'search intersects selected category');
 assert.equal(d.getElementById('cafeMenuReset').hidden,false);
 d.getElementById('cafeMenuReset').click();
 assert.equal(d.querySelectorAll('[data-product-card]').length,9);
 assert.equal(category('all').getAttribute('aria-pressed'),'true');
 assert.equal(d.getElementById('cafeMenuSearch').value,'');
 assert.equal(d.querySelector('[data-product-card="plov"] .cafe-card-quantity strong').textContent,'1','cart survives category reset');
 category('soups').click();inventory.find(row=>row.product_id==='soup').quantity=0;
 await w.ummaCafe.refreshMenu();
 assert.equal(category('soups'),null,'unavailable section omitted');
 assert.equal(category('all').getAttribute('aria-pressed'),'true','vanished section resets after stock refresh');
 console.log('PASS menu: grouped categories, search intersection, focus, stock refresh, cart preservation; multilingual search, no results/reset/focus, cart survives filtering, stock limits, photo URL safety and failed-image fallback');
}finally{w.close();}
