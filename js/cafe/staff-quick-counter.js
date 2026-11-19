(()=>{'use strict';
const root=document.getElementById('webPos');if(!root)return;
const heading=root.querySelector('#posHeading');if(heading)heading.textContent='Быстрая продажа';
const intro=root.querySelector('.web-pos-heading p');if(intro)intro.textContent='Выберите блюда, уточните состав и сразу назовите сумму.';
const search=root.querySelector('#posSearch');if(search){search.placeholder='Поиск: шурпа, плов, напитки…';search.setAttribute('aria-label','Быстрый поиск блюда');}
const products=root.querySelector('#posProducts');
if(products){products.addEventListener('click',event=>{const summary=event.target.closest('.pos-product-description summary');if(!summary)return;event.stopPropagation();});}
const cash=root.querySelector('#posCash');if(cash)cash.placeholder='Сколько дал клиент';
const receipt=root.querySelector('#posReceipt');
if(receipt){const observer=new MutationObserver(()=>{if(!receipt.hidden){receipt.scrollIntoView({behavior:'smooth',block:'nearest'});}});observer.observe(receipt,{attributes:true,attributeFilter:['hidden']});}
})();