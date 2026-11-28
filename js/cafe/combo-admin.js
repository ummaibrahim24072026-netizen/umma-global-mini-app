(() => {
  "use strict";
  const languages = ["ru","en","vi","ko","zh","de","fr","th","ms","id","ar","pt"];
  const kinds = [["drink","Напитки"],["sauce","Соусы"],["filling","Начинки"],["other","Другие варианты"]];
  const units = [["g","г"],["ml","мл"],["pcs","шт."]];
  const element = (tag,text) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  };
  function input(parent,title,type,value,attributes={}) {
    const label = element("label", title + " ");
    const field = element("input");
    field.type = type;
    Object.assign(field,attributes);
    if (type === "checkbox") field.checked = value === true;
    else field.value = value ?? "";
    label.append(field);
    parent.append(label);
    return field;
  }
  function select(parent,title,choices,value) {
    const label = element("label", title + " ");
    const field = element("select");
    field.replaceChildren(...choices.map(([key,caption])=>new Option(caption,key)));
    if (value != null) field.value = value;
    label.append(field);
    parent.append(label);
    return field;
  }
  function button(parent,title,run) {
    const control = element("button",title);
    control.className = "plain-btn";
    control.type = "button";
    control.onclick = run;
    parent.append(control);
  }

  function editOptions(parent,dishes,initial,kind) {
    const list = element("div");
    const rows = new Map();
    parent.append(list);
    function add(option={}) {
      const row = element("fieldset");
      const choices = dishes.map(dish=>[dish.id,dish.name_ru]);
      if(option.productId&&!choices.some(([id])=>id===option.productId)) choices.push([option.productId,"Блюдо скрыто"]);
      const product = select(row,"Позиция меню",[["","Выберите"],...choices],option.productId);
      product.required = true;
      const portions = input(row,"Доля стандартной порции для списания","number",option.portions??1,
        {min:.001,max:20,step:.001,required:true});
      const amount = input(row,"Количество в наборе","number",option.amount,{min:.01,max:99999,step:.01,required:true});
      const unit = select(row,"Единица",units,option.unit);
      const reference = kind==="extra"?null:input(row,"Обычная цена этой порции, ₫","number",option.referenceVnd,{min:1,max:9999999});
      const surcharge = kind==="fixed"?null:input(row,kind==="extra"?"Цена дополнения, ₫":"Доплата, ₫","number",
        option.surchargeVnd??(kind==="extra"?10000:0),{min:kind==="extra"?1:0,max:9999999,required:true});
      const max = kind==="extra"?input(row,"Максимум на набор","number",option.maxQuantity??1,{min:1,max:9,required:true}):null;
      const pieceCount = input(row,"Штук в указанной порции","number",option.pieceCount,{min:1,max:999});
      const labels = ["ru","en","vi"].map(lang=>[lang,input(row,"Название в комбо ("+lang.toUpperCase()+")","text",option.labels?.[lang],{maxLength:120})]);
      const exclusiveGroup = kind==="extra"?input(row,"Группа, из которой можно добавить одну позицию","text",option.exclusiveGroup,
        {maxLength:48,pattern:"[a-zA-Z0-9_-]+"}):null;
      const recommended = kind==="choice"?input(row,"Рекомендованный вариант","checkbox",option.recommended):null;
      if(recommended) recommended.onchange=()=>{
        if(!recommended.checked)return;
        for(const other of rows.values())if(other.recommended!==recommended&&other.recommended)other.recommended.checked=false;
      };
      const id = option.id || crypto.randomUUID();
      rows.set(row,{recommended,read:()=>({id,productId:product.value,portions:portions.valueAsNumber,amount:amount.valueAsNumber,unit:unit.value,
        ...(reference?.value?{referenceVnd:reference.valueAsNumber}:{}),
        ...(surcharge?{surchargeVnd:surcharge.valueAsNumber}:{}),...(max?{maxQuantity:max.valueAsNumber}:{}),
        ...(pieceCount.value?{pieceCount:pieceCount.valueAsNumber}:{}),
        ...(exclusiveGroup?.value?{exclusiveGroup:exclusiveGroup.value}:{}),
        labels:Object.fromEntries(labels.filter(([,field])=>field.value.trim()).map(([lang,field])=>[lang,field.value.trim()]))})});
      button(row,"Убрать позицию",()=>{rows.delete(row);row.remove();});
      list.append(row);
    }
    initial.forEach(add);
    button(parent,"Добавить позицию",()=>add());
    return {
      read:()=>[...rows.values()].map(row=>row.read()),
      defaultId:()=>[...rows.values()].find(row=>row.recommended?.checked)?.read().id,
    };
  }

  function mount(root,dishes,configuration={}) {
    const config = configuration || {};
    root.replaceChildren();
    const mode = select(root,"Режим цены",[["fixed","Фиксированная цена"],["percent","Процентная скидка"]],config.mode);
    const discount = input(root,"Скидка, %","number",config.discount??10,{min:0,max:99.99,step:.01,required:true});
    const position = input(root,"Порядок в меню","number",config.position??0,{min:0,max:99999});
    const start = input(root,"Доступен с (Нячанг)","time",config.startsAt);
    const end = input(root,"Доступен до (Нячанг)","time",config.endsAt);
    const archived = input(root,"В архиве","checkbox",config.archived);
    const translations = element("details");
    translations.append(element("summary","Названия и описания"));
    const localized = languages.map(lang=>({
      lang,
      name:lang==="ru"||lang==="en"||lang==="vi"?null:input(translations,"Название ("+lang.toUpperCase()+")","text",config["name_"+lang],{maxLength:120}),
      description:input(translations,"Описание ("+lang.toUpperCase()+")","text",config["description_"+lang],{maxLength:500}),
    }));
    root.append(translations);
    const fixed = element("fieldset");
    fixed.append(element("legend","Обязательные блюда"));
    const fixedOptions = editOptions(fixed,dishes,config.fixed||[],"fixed");
    root.append(fixed);
    const alternatives = element("fieldset");
    alternatives.append(element("legend","Группы выбора"));
    const groups = new Map();
    function addGroup(group={}) {
      const section = element("fieldset");
      const kind = select(section,"Тип группы",kinds,group.kind);
      const options = editOptions(section,dishes,(group.options||[]).map(option=>({...option,recommended:option.id===group.defaultId})),"choice");
      const id = group.id || crypto.randomUUID();
      groups.set(section,()=>({id,kind:kind.value,defaultId:options.defaultId(),options:options.read()}));
      button(section,"Удалить группу",()=>{groups.delete(section);section.remove();});
      alternatives.insertBefore(section,insertGroup);
    }
    button(alternatives,"Добавить группу",()=>addGroup());
    const insertGroup = alternatives.lastElementChild;
    (config.groups||[]).forEach(addGroup);
    root.append(alternatives);
    const extras = element("fieldset");
    extras.append(element("legend","Платные дополнения"));
    const extraOptions = editOptions(extras,dishes,config.extras||[],"extra");
    root.append(extras);
    const recommendations = element("fieldset");
    recommendations.append(element("legend","Предлагать в карточках блюд"));
    const recommendedDishes = select(recommendations,"Блюда",dishes.map(dish=>[dish.id,dish.name_ru]));
    recommendedDishes.multiple = true;
    for(const option of recommendedDishes.options) option.selected = (config.recommendations||[]).includes(option.value);
    root.append(recommendations);
    return ()=>({mode:mode.value,discount:discount.valueAsNumber,position:position.valueAsNumber,
      startsAt:start.value||null,endsAt:end.value||null,archived:archived.checked,
      fixed:fixedOptions.read(),groups:[...groups.values()].map(read=>read()),extras:extraOptions.read(),
      recommendations:[...recommendedDishes.selectedOptions].map(option=>option.value),
      ...Object.fromEntries(localized.flatMap(({lang,name,description})=>[
        ...(name?.value?[["name_"+lang,name.value]]:[]),...(description.value?[["description_"+lang,description.value]]:[]),
      ]))});
  }
  window.ummaCafeComboAdmin = {mount};
})();
