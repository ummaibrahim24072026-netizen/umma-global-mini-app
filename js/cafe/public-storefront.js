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

  function create({endpoint, t, name, description, money, num, photo, onSwitch, onConfig}) {
    const switcher = document.getElementById('storefrontSwitch');
    const sections = document.getElementById('marketSections');
    const products = document.getElementById('marketProducts');
    const page = document.getElementById('cafePage');
    const fallback = document.querySelector('.cafe-spotlight-fallback');
    let catalog, category = 'all', search = '', active = false, loading = false, enabled = false;
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

    function findOffer(id) {
      const product=document.getElementById(id);
      if (!product) return;
      const details=product.querySelector('details');
      details.open=true;
      details.querySelector('summary').focus({preventScroll:true});
      product.scrollIntoView({block:'center'});
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

      const featured = [...new Map(offers.map(offer => [offer.product.id,offer])).values()].slice(0, 4);
      window.ummaCafeSpotlight?.setCatalog(featured.map(offer => ({
        key:'market-'+offerKey(offer), title:name(offer.product), image:photo(offer.product),
        detail:offer.sale_mode==='individual_weight'?money(offer.price_vnd)+' / '+t('кг'):money(offer.price_vnd),
        badge:'UMMA MARKET', cta:t('Подробнее')
      })), id => {
        if (category!=='all'||search) {
          category='all';
          search='';
          document.getElementById('search').value='';
          render();
        }
        findOffer(id);
      }, {direction:'market'});

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
      const labels = {g:'г', ml:'мл', piece:'шт.', package:'Упаковка', set:'Набор', kg:'кг', l:'л'};
      const unit = t(labels[measure] || measure || 'шт.');
      const pack = sizes.map(item => '<li>'+esc(num(item.quantity)+' '+unit+' · '+money(item.price_vnd))+
        (item.expires_on&&/^\d{4}-\d{2}-\d{2}$/.test(item.expires_on)&&Number.isFinite(Date.parse(item.expires_on))?
          '<br>'+esc(t('Годен до {date}', {date:localDate(item.expires_on)})):'')+'</li>').join('');
      const fixed = !sizes.length&&offer.fixed_quantity>0?' · '+num(offer.fixed_quantity)+' '+unit:'';
      const price = money(offer.price_vnd)+(offer.sale_mode==='individual_weight'?' / '+t('кг'):fixed);
      return '<article class="cafe-product storefront-market-offer" id="'+esc(key)+'">'+
        (image?'<img src="'+esc(image)+'" alt="" loading="lazy" decoding="async">':'')+
        '<h3>'+esc(name(product))+'</h3><strong class="cafe-product-price">'+esc(price)+'</strong>'+
        '<details'+(activeOffer===key?' open':'')+'><summary>'+esc(t('Подробнее'))+'</summary>'+
        [description(product),offer.composition,offer.storage_conditions].filter(Boolean).map(value => '<p>'+esc(value)+'</p>').join('')+
        (pack?'<ul>'+pack+'</ul>':'')+'</details></article>';
    }

    function switchTo(direction, save = false) {
      const next = direction==='market'&&enabled;
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
      fallback.hidden=active;
      products.hidden=!active;
      if (!active) sections.hidden=true;
      for (const button of switcher.querySelectorAll('button')) {
        button.setAttribute('aria-pressed',String(button.dataset.storefront===page.dataset.storefront));
      }
      onSwitch(active);
      render();
    }

    async function refresh() {
      if (loading||document.hidden) return;
      loading=true;
      try {
        const data=await request('storefront=1');
        const signature=JSON.stringify(data.sections || []);
        if (signature!==sectionSignature) {
          sectionSignature=signature;
          onConfig(Array.isArray(data.sections)?data.sections:[]);
        }
        enabled=data.marketPreviewEnabled===true;
        if (!enabled) switchTo('cafe');
        switcher.hidden=!enabled;
        if (!enabled) return;
        if (preferred==='market'&&!active) switchTo('market');
        if (active) {
          const next=await request('marketCatalog=1');
          const changed=JSON.stringify(next)!==JSON.stringify(catalog);
          const hadIssue=catalogIssue;
          catalog=next;
          catalogIssue=false;
          if (changed||hadIssue) render();
        }
      } catch {
        if (active&&!catalogIssue) {
          catalogIssue=true;
          render();
        }
      } finally {
        loading=false;
      }
    }
    switcher.addEventListener('click', event => {
      const target=event.target.closest('[data-storefront]');
      if (!target) return;
      switchTo(target.dataset.storefront,true);
      if (active) void refresh();
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
      if (event.target.closest('[data-market-retry]')) void refresh();
    });
    window.addEventListener('umma-menu:languagechange',render);
    window.addEventListener('online',refresh);
    document.addEventListener('visibilitychange',refresh);
    return {
      get active(){return active;},
      search(value){search=value;category='all';render();},
      start(){void refresh();setInterval(refresh,15000);}
    };
  }
  window.ummaPublicStorefront={create};
})();
