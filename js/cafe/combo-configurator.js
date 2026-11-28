(() => {
  "use strict";
  const groupLabels = {drink:"Напитки", sauce:"Соусы", filling:"Начинка", other:"Выберите вариант"};
  const unitLabels = {g:"г",ml:"мл",pcs:"шт."};
  const hasStock = option => Number(option.availablePortions) >= Number(option.portions);

  function defaults(config) {
    return {
      choices:Object.fromEntries(config.groups.map(group => {
        const preferred = group.options.find(option => option.id === group.defaultId && hasStock(option));
        return [group.id, (preferred || group.options.find(hasStock) || group.options[0]).id];
      })),
      extras:{},
    };
  }

  function quote(config, selection) {
    if (!selection || !config) return null;
    const components = [...config.fixed];
    for (const group of config.groups) {
      const option = group.options.find(row => row.id === selection.choices[group.id]);
      if (!option) return null;
      components.push(option);
    }
    const reference = components.reduce((sum, option) => sum + Number(option.priceVnd), 0);
    const surcharge = components.reduce((sum, option) => sum + Number(option.surchargeVnd || 0), 0);
    const discountBasisPoints = Math.round(Number(config.discount) * 100);
    const discounted = Math.round((reference - surcharge) * (10000 - discountBasisPoints) / 10000);
    const subtotal = config.mode === "percent" ? discounted + surcharge : Number(config.basePriceVnd) + surcharge;
    if (!Number.isSafeInteger(subtotal) || subtotal < 1) return null;
    let extrasVnd = 0;
    const exclusiveGroups = new Set();
    for (const [id, quantity] of Object.entries(selection.extras)) {
      const option = config.extras.find(row => row.id === id);
      if (!option || !Number.isInteger(quantity) || quantity < 1 || quantity > (option.maxQuantity || 1)) return null;
      if (option.exclusiveGroup) {
        if (quantity!==1 || exclusiveGroups.has(option.exclusiveGroup)) return null;
        exclusiveGroups.add(option.exclusiveGroup);
      }
      extrasVnd += option.surchargeVnd * quantity;
      components.push({...option, extra:true, quantity, amount:option.amount * quantity, portions:option.portions * quantity,
        pieceCount:option.pieceCount ? option.pieceCount * quantity : null});
    }
    const demand = new Map();
    for (const option of components) {
      const portions = Math.round(option.portions * 1000);
      const available = Math.round(option.availablePortions * 1000);
      const previous = demand.get(option.productId);
      demand.set(option.productId, {
        portions:(previous?.portions || 0) + portions,
        available:Math.min(previous?.available ?? available, available),
      });
    }
    const available = Math.min(99, ...[...demand.values()].map(row => Math.floor(row.available / row.portions)));
    const savingVnd = Math.max(0, reference - subtotal);
    return {comboComponents:components, available, price_vnd:subtotal + extrasVnd, separatePriceVnd:reference,
      savingVnd, savingPercent:reference > 0 ? Math.round(savingVnd * 1000 / reference) / 10 : 0,
      comboBaseVnd:subtotal, extrasVnd};
  }

  function lineKey(productId,selection) {
    const pairs = object => Object.entries(object).sort(([left],[right]) => left.localeCompare(right));
    return productId + "~combo~" + encodeURIComponent(JSON.stringify([pairs(selection.choices),pairs(selection.extras)]));
  }

  function label(option, view) {
    return view.name(option) + " · " + view.number(option.amount) + " " + view.t(unitLabels[option.unit]) +
      (option.pieceCount && option.unit !== "pcs" ? " (" + view.number(option.pieceCount) + " " + view.t("шт.") + ")" : "");
  }

  function summary(value, view) {
    const reference = view.escape(view.money(value.separatePriceVnd));
    return '<div class="storefront-combo-pricing"><div><span>' + view.escape(view.t("Стоимость тех же порций")) +
      '</span>' + (value.savingVnd > 0 ? '<s>' + reference + '</s>' : '<strong>' + reference + '</strong>') + '</div>' +
      '<div><span>' + view.escape(view.t("Цена комбо")) + '</span><strong>' + view.escape(view.money(value.comboBaseVnd)) + '</strong></div>' +
      (value.savingVnd > 0 ? '<p class="storefront-combo-saving">' +
       view.escape(view.t("Выгода {amount}",{amount:view.money(value.savingVnd)}) + " (" + view.number(value.savingPercent) + "%)") + '</p>' : '') +
      (value.extrasVnd ? '<div><span>' + view.escape(view.t("Дополнения")) + '</span><strong>' + view.escape(view.money(value.extrasVnd)) +
       '</strong></div>' : '') + '</div>';
  }

  function mount(container, config, selection, view, save) {
    const {escape, t, money} = view;
    container.innerHTML = (config.fixed.length ? '<div class="storefront-combo-included">' +
      (view.customer ? '<h3>' + escape(t("В составе комбо")) + '</h3>' : '') +
      '<ul class="storefront-combo-contents">' + config.fixed.map(option => '<li>' + escape(label(option, view)) + '</li>').join('') + '</ul></div>' : '') +
      config.groups.map(group => '<p class="storefront-combo-field"><label>' + escape(t(groupLabels[group.kind])) +
        ' <select data-combo-choice="' + escape(group.id) + '">' + group.options.map(option => {
          const surcharge = Number(option.surchargeVnd || 0);
          return '<option value="' + escape(option.id) + '"' + (hasStock(option) ? '' : ' disabled') +
            (selection.choices[group.id] === option.id ? ' selected' : '') + '>' + escape(label(option, view) +
             (surcharge ? ' +' + money(surcharge) : '')) + '</option>';
        }).join('') + '</select></label></p>').join('') +
      (config.extras.length ? '<details class="storefront-combo-extras"' + (Object.keys(selection.extras).length ? ' open' : '') + '><summary>' +
        escape(t("Дополнения")) + '</summary>' + config.extras.map(option =>
          '<p class="storefront-combo-field"><label>' + escape(label(option, view) + ' +' + money(option.surchargeVnd)) +
          ' <select data-combo-extra="' + escape(option.id) + '"' + (hasStock(option) ? '' : ' disabled') + '>' +
          Array.from({length:(option.maxQuantity || 1) + 1}, (_, quantity) =>
           '<option value="' + quantity + '"' + ((selection.extras[option.id] || 0) === quantity ? ' selected' : '') +
            '>' + escape(view.number(quantity)) + '</option>').join('') + '</select></label></p>').join('') + '</details>' : '') +
      '<div data-combo-price aria-live="polite"></div><button type="button" class="primary" data-combo-submit></button>';
    const price = container.querySelector('[data-combo-price]');
    const button = container.querySelector('[data-combo-submit]');
    let draft, currentQuote;
    function update() {
      draft = {
        choices:Object.fromEntries([...container.querySelectorAll('[data-combo-choice]')].map(select => [select.dataset.comboChoice, select.value])),
        extras:Object.fromEntries([...container.querySelectorAll('[data-combo-extra]')].filter(select => Number(select.value))
          .map(select => [select.dataset.comboExtra, Number(select.value)])),
      };
      currentQuote = quote(config,draft);
      const available = currentQuote?.available > 0;
      const saving = currentQuote?.savingVnd > 0
        ? '<p class="storefront-combo-saving">' + escape(t("Выгода {amount}", {amount:money(currentQuote.savingVnd)})) + '</p>' : '';
      price.innerHTML = (view.customer ? saving : currentQuote ? summary(currentQuote,view) : '') +
         (available ? '' : '<p>' + escape(t("Товар недоступен")) + '</p>');
      button.disabled = !available;
      button.textContent = t(view.action || "В корзину") + (currentQuote ? ' · ' + money(currentQuote.price_vnd) : '');
    }
    container.onchange = update;
    button.onclick = () => {
      if (!button.disabled) save(draft,currentQuote);
    };
    update();
    return ()=>draft;
  }

  window.ummaCafeCombo = {defaults, quote, lineKey, label, summary, mount};
})();
