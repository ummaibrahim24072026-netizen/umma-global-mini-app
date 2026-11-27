(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);

  function available(offer) {
    if (!(offer.price_vnd > 0) || !offer.product?.id) return false;
    if (['individual_weight', 'fixed_weight'].includes(offer.sale_mode)) {
      return Array.isArray(offer.units) && offer.units.some(unit => unit.price_vnd > 0 && unit.quantity > 0);
    }
    return Number(offer.available_quantity) >= (Number(offer.fixed_quantity) || 1);
  }

  function create({endpoint, t, name, description, money, num, photo, initialDirection, onSwitch, onConfig}) {
    const switcher = document.getElementById('storefrontSwitch');
    const sections = document.getElementById('marketSections');
    const products = document.getElementById('marketProducts');
    const page = document.getElementById('cafePage');
    const intro = document.getElementById('marketIntro');
    const opening = document.getElementById('marketOpening');
    const searchToggle = document.getElementById('searchToggle');
    const cafeButton = switcher.querySelector('[data-storefront=cafe]');
    let catalog, category = 'all', search = '', active = false, loadingSections = false, loadingMarket = false;
    let sectionSignature, catalogIssue = false, activeOffer;
    let preferred;
    try { preferred = localStorage.getItem('umma-menu-storefront'); } catch {}

    function request(params) {
      return fetch(endpoint+'?'+params, {cache:'no-store', signal:AbortSignal.timeout(12000)})
        .then(async response => {
          const data = await response.json();
          if (!response.ok || !data.ok) throw Error('Storefront unavailable');
          return data;
        });
    }

    function offerKey(offer) {
      return offer.warehouse_id+':'+offer.variant_id;
    }

    function render() {
      if (!active) return;
      const offers = (catalog?.offers || []).filter(available);
      const current = (catalog?.categories || []).filter(item =>
        offers.some(offer => offer.product.category_id === item.id));
      if (!current.some(item => item.id === category)) category = 'all';
      const filters = [{id:'all', name_ru:'Все'}, ...current];
      const categoryPhoto = id => offers.filter(offer => offer.product.category_id === id)
        .map(offer => photo(offer.product)).find(Boolean);
      sections.hidden = !current.length;
      sections.innerHTML = filters.map(item => {
        const image = categoryPhoto(item.id);
        return '<button type="button" class="cafe-category storefront-tile" data-market-category="'+esc(item.id)+
          '" aria-controls="marketProducts" aria-pressed="'+(category===item.id)+'">'+
          (image?'<img src="'+esc(image)+'" alt="" loading="lazy">':'')+esc(item.id==='all'?t('Все'):name(item))+'</button>';
      }).join('');

      if (intro) intro.hidden = false;
      if (opening) opening.hidden = offers.length > 0 || catalogIssue || !catalog;
      searchToggle.hidden = offers.length === 0;
      products.hidden = offers.length === 0 && !catalogIssue && !!catalog;
      window.ummaCafeSpotlight?.setCatalog([],null,{direction:'market'});

      const query = search.trim().toLocaleLowerCase();
      const visible = offers.filter(({product}) => {
        const text = [name(product), product.name_ru, product.name_en, product.name_vi, description(product)].join(' ').toLocaleLowerCase();
        return (category==='all'||product.category_id===category)&&text.includes(query);
      });
      const notice = catalogIssue?'<div class="message" role="status">'+esc(t('Не удалось обновить каталог'))+
        ' <button type="button" class="plain-btn" data-market-retry>'+esc(t('Повторить'))+'</button></div>':'';
      products.innerHTML = notice+(visible.length?visible.map(card).join(''):
        catalogIssue?'':'<div class="message" role="status">'+esc(t(catalog?'Ничего не найдено':'Загружаем каталог…'))+'</div>');
    }

    function card(offer) {
      const {product, measure} = offer;
      const image = photo(product);
      const key = 'market-'+offerKey(offer);
      const units = (offer.units || []).filter(unit => unit.price_vnd > 0 && unit.quantity > 0);
      const sizes = [...new Map(units.map(unit => [unit.quantity+'|'+unit.price_vnd+'|'+unit.expires_on,unit])).values()];
      const localDate = date => new Intl.DateTimeFormat(document.documentElement.lang, {dateStyle:'medium', timeZone:'UTC'})
        .format(new Date(date+'T00:00:00Z'));
      const labels = {g:'г', ml:'мл', pcs:'шт.', piece:'шт.', package:'Упаковка', set:'Набор', kg:'кг', l:'л'};
      const unit = t(labels[measure] || measure || 'шт.');
      const pack = sizes.map(item => '<li>'+esc(num(item.quantity)+' '+unit+' · '+money(item.price_vnd))+
        (item.expires_on&&/^\d{4}-\d{2}-\d{2}$/.test(item.expires_on)&&Number.isFinite(Date.parse(item.expires_on))?
          '<br>'+esc(t('Годен до {date}', {date:localDate(item.expires_on)})):'')+'</li>').join('');
      const fixed = sizes.length?'':offer.fixed_quantity>0?' · '+num(offer.fixed_quantity)+' '+unit:' / '+unit;
      const price = money(offer.price_vnd)+(offer.sale_mode==='individual_weight'?' / '+t('кг'):fixed);
      return '<article class="cafe-product storefront-market-offer" id="'+esc(key)+'">'+
        (image?'<img src="'+esc(image)+'" alt="" loading="lazy" decoding="async">':'')+
        '<h3>'+esc(name(product))+'</h3><strong class="cafe-product-price">'+esc(price)+'</strong>'+
        (sizes.length?'<div class="storefront-pack-options" role="group" aria-label="'+esc(t('Упаковка'))+'">'+
         [...new Map(sizes.map(item=>[item.quantity,item])).values()].map(item=>
          '<button type="button" class="cafe-category" data-pack-price="'+esc(money(item.price_vnd))+'" aria-pressed="false">'+
          esc(num(item.quantity)+' '+unit)+'</button>').join('')+'</div>':'')+
        '<details'+(activeOffer===key?' open':'')+'><summary>'+esc(t('Подробнее'))+'</summary>'+
        [description(product),offer.composition,offer.storage_conditions].filter(Boolean).map(value => '<p>'+esc(value)+'</p>').join('')+
        (pack?'<ul>'+pack+'</ul>':'')+'</details></article>';
    }

    function switchTo(direction, save = false) {
      const next = direction==='market';
      if (save) {
        preferred = next?'market':'cafe';
        try { localStorage.setItem('umma-menu-storefront',preferred); } catch {}
      }
      if (next===active) return;
      active=next;
      category='all';
      search='';
      activeOffer=undefined;
      page.dataset.storefront=active?'market':'cafe';
      if (intro) intro.hidden=!active;
      if (opening) opening.hidden=!active;
      searchToggle.hidden=active;
      if (active) {
        document.getElementById('searchPanel').hidden=true;
        searchToggle.setAttribute('aria-expanded','false');
      }
      products.hidden=!active;
      if (!active) sections.hidden=true;
      for (const button of switcher.querySelectorAll('button')) {
        button.setAttribute('aria-pressed',String(button.dataset.storefront===page.dataset.storefront));
      }
      onSwitch(active);
      render();
    }

    async function refreshSections() {
      if (loadingSections||document.hidden) return;
      loadingSections=true;
      try {
        const data=await request('catalog=1');
        if (!Array.isArray(data.sections)) return;
        const signature=JSON.stringify([data.sections,data.visibility]);
        if (signature!==sectionSignature) {
          sectionSignature=signature;
          onConfig(data.sections,data.visibility);
        }
      } catch {
        // The existing CAFE catalog remains usable during a configuration outage.
      } finally {
        loadingSections=false;
      }
    }

    async function refreshMarket() {
      if (!active||loadingMarket||document.hidden) return;
      loadingMarket=true;
      try {
        const next=await request('marketCatalog=1');
        const changed=JSON.stringify(next)!==JSON.stringify(catalog);
        catalog=next;
        if (changed||catalogIssue) {
          catalogIssue=false;
          render();
        }
      } catch {
        if (!catalogIssue) {
          catalogIssue=true;
          render();
        }
      } finally {
        loadingMarket=false;
      }
    }

    function refresh() {
      void refreshSections();
      void refreshMarket();
    }
    switcher.addEventListener('click', event => {
      const target=event.target.closest('[data-storefront]');
      if (!target) return;
      switchTo(target.dataset.storefront,true);
      if (active) void refreshMarket();
    });
    document.getElementById('marketBackToCafe')?.addEventListener('click', () => {
      switchTo('cafe',true);
      cafeButton.focus();
    });
    sections.addEventListener('click', event => {
      const button=event.target.closest('[data-market-category]');
      if (!button) return;
      category=button.dataset.marketCategory;
      render();
      [...sections.querySelectorAll('button')].find(node => node.dataset.marketCategory===category)?.focus({preventScroll:true});
    });
    products.addEventListener('toggle', event => {
      if (!event.target.matches('details')) return;
      const id=event.target.closest('article').id;
      if (event.target.open) activeOffer=id;
      else if (activeOffer===id) activeOffer=undefined;
    }, true);
    products.addEventListener('click', event => {
      if (event.target.closest('[data-market-retry]')) void refreshMarket();
      const pack=event.target.closest('[data-pack-price]');
      if (!pack) return;
      const card=pack.closest('article');
      card.querySelector('.cafe-product-price').textContent=pack.dataset.packPrice;
      for (const item of card.querySelectorAll('[data-pack-price]')) {
        item.setAttribute('aria-pressed',String(item===pack));
      }
    });
    window.addEventListener('umma-menu:languagechange',render);
    window.addEventListener('online',refresh);
    document.addEventListener('visibilitychange',refresh);
    return {
      get active(){return active;},
      search(value){search=value;category='all';render();},
      start(){
        switcher.hidden=false;
        if((initialDirection||preferred)==='market') switchTo('market');
        void refresh();
        setInterval(refresh,15000);
      }
    };
  }
  window.ummaPublicStorefront={create};
})();
