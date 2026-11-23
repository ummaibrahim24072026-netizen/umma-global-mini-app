(() => {
  "use strict";
  const root=document.getElementById("webOwnerManager");
  const api="https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-owner-manager";
  const operations={purchase:"Поступление",transfer:"Перемещение",production:"Выпуск партии",count:"Инвентаризация",
    waste:"Списание",return:"Возврат",recipe:"Утвердить техкарту",mode:"Режим учёта"};
  const units={kg:"кг",g:"г",l:"л",ml:"мл",pcs:"шт.",portion:"порций"};
  const areas={main:"Основной склад / готовая продукция",kitchen:"Кухня"};
  const vnd=new Intl.NumberFormat("ru-RU",{style:"currency",currency:"VND"});
  const formatDate=new Intl.DateTimeFormat("ru-RU",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"});
  let cafe,data,info,editor,stats,pendingPanel,pending,recording,busy=false,question="",transcript="";
  const catalog=id=>data.stock.find(s=>s.id===id);
  const product=id=>catalog(id)?.name_ru || "Позиция";
  const quantity=(qty,id)=>qty+" "+(units[catalog(id)?.base_unit] || "");
  const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date());
  function el(tag,text,props={}) {
    const node=Object.assign(document.createElement(tag),props);
    if (text!=null) node.textContent=text;
    return node;
  }
  function btn(text,onclick,primary=false) {return el("button",text,{type:"button",onclick,className:primary ? "owner-primary" : ""});}
  function field(name,input) {const label=el("label",name);label.append(input);return label;}
  function select(options,value,placeholder) {
    const select=el("select");
    if (placeholder) select.append(el("option",placeholder,{value:""}));
    for (const [id,name] of Object.entries(options)) select.append(el("option",name,{value:id}));
    if (value!==undefined && value!==null) select.value=value;
    return select;
  }
  function number(value,step="any") {return el("input",null,{type:"number",min:"0",step,value:value??"",inputMode:step==="1" ? "numeric" : "decimal"});}
  function status(text,error=false) {info.textContent=text;info.dataset.error=String(error);}
  async function run(task,working="Загрузка…") {
    if (busy) return;
    busy=true;
    root.setAttribute("aria-busy","true");
    status(working);
    try {await task();} catch(error) {status(error.message,true);}
    finally {busy=false;root.setAttribute("aria-busy","false");}
  }
  class ValidationError extends Error {}
  async function request(action,extra={},file) {
    const headers={"x-umma-staff":window.ummaStaffAuth.credential()};
    const fields={action,locationId:cafe,...extra};
    let body;
    if (file) {
      body=new FormData();
      for (const [key,value] of Object.entries(fields)) body.set(key,value);
      body.set("file",file,"attachment");
    } else {headers["content-type"]="application/json";body=JSON.stringify(fields);}
    const response=await fetch(api,{method:"POST",headers,body,cache:"no-store",signal:AbortSignal.timeout(80000)});
    if (response.ok && action==="original") return response.blob();
    const result=await response.json();
    if (!response.ok || !result.ok) {
      const Failure=response.status>=400 && response.status<500 ? ValidationError : Error;
      throw new Failure(result.error || "Сервис временно недоступен");
    }
    return result;
  }
  function pendingKey(){return "umma:owner:pending:"+window.ummaStaffAuth.actorId()+":"+cafe;}
  function showPending(){
    pendingPanel.replaceChildren();
    if(pending) pendingPanel.append(btn("Проверить и повторить проведение",()=>run(()=>post(pending)),true));
  }
  function save(value){
    pending=value;
    try {if(value) sessionStorage.setItem(pendingKey(),JSON.stringify(value));else sessionStorage.removeItem(pendingKey());} catch {}
    showPending();
  }
  async function post(value){
    if(pending && pending.key!==value.key) throw Error("Сначала проверьте предыдущую операцию");
    save(value);
    let result;
    try {result=await request("post",{...value,confirmed:true});}
    catch(error){if(error instanceof ValidationError) save(null);throw error;}
    save(null);
    editor.replaceChildren();
    await refresh();
    status(operations[result.data.kind]+" · сохранено"+(result.data.total==null ? "" : " · "+vnd.format(result.data.total)));
  }
  function details(title,rows){
    const panel=el("details");
    panel.append(el("summary",title));
    if (!rows.length) {panel.append(el("p","Пока нет данных"));return panel;}
    const list=el("ul");
    for (const row of rows) {const li=el("li");li.append(row);list.append(li);}
    panel.append(list);
    return panel;
  }
  async function original(hash){
    return run(async()=>{
      const document=await request("original",{hash});
      const suffix={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[document.type] || "bin";
      const href=URL.createObjectURL(document);
      el("a",null,{href,download:"invoice."+suffix}).click();
      setTimeout(()=>URL.revokeObjectURL(href),30000);
      status("Оригинал загружен");
    });
  }
  async function refresh(days=data?.days || 7){
    data=(await request("dashboard",{days})).data;
    stats.replaceChildren();
    const manager=data.role!=="kitchen";
    root.querySelector("[data-owner-invoices]").hidden=!manager;
    const available=manager ? ["purchase","transfer","production","count","waste","return"] : ["transfer","production","waste","return"];
    if(data.role==="owner") available.push("recipe","mode");
    const first=el("section",null,{className:"owner-card"});
    first.append(el("h2","Остатки"));
    if (data.valuation) first.append(el("p",vnd.format(data.valuation.knownValue)+(data.valuation.unpriced
      ? " · оценённая часть запасов. Без цены: "+data.valuation.unpriced+" поз."
      : " · стоимость запасов")));
    if (data.initialCount) first.append(el("p","Начальный пересчёт · "+formatDate.format(new Date(data.initialCount))));
    const controls=el("div",null,{className:"owner-actions"});
    for (const kind of available) controls.append(btn(operations[kind],()=>open({kind,source:"manual",lines:[{}],mode:data.mode}),kind==="count"));
    first.append(controls,details("Остатки по позициям",data.stock.map(s=>s.name_ru+" · "+quantity(s.quantity,s.id)+
      (s.item_type==="finished_good" ? "" : " · кухня "+quantity(s.kitchen,s.id)))));
    stats.append(first);
    if(!manager) return;
    const finance=el("section",null,{className:"owner-card"});
    const range=select({"7":"7 дней","14":"14 дней","30":"30 дней","90":"90 дней"},String(data.days));
    range.onchange=()=>run(async()=>{await refresh(Number(range.value));status("");});
    finance.append(el("h2","Себестоимость и расход"),field("Период",range),
      el("p","Оплачено и выдано: "+data.sales.portions+" порций · "+vnd.format(data.sales.grossLineRevenue)+" по строкам блюд"),
      details("Расход и потери",data.flows.map(f=>[product(f.item_id),f.used==null ? "" : "расход "+quantity(f.used,f.item_id),
        f.wasted==null ? "" : "списано "+quantity(f.wasted,f.item_id),f.known_loss==null ? "" : "потери "+vnd.format(f.known_loss),
        f.min_purchase==null ? "" : "закупочные цены "+vnd.format(f.min_purchase)+"–"+vnd.format(f.max_purchase)].filter(Boolean).join(" · "))),
      details("Низкие остатки",data.flows.flatMap(f=>{
        const s=catalog(f.item_id);
        if(!s || !(f.used>0)) return [];
        const days=(Number(s.quantity)+Number(s.kitchen))*data.days/f.used;
        return days<2 ? [s.name_ru+" · примерно "+days.toFixed(1)+" дн. по учтённому расходу"] : [];
      })),
      details("Нормы из измеренных партий",data.norms.map(n=>product(n.outputId)+" · "+product(n.itemId)+" · "+
        (n.quantity==null ? "недостаточно данных" : quantity(n.quantity,n.itemId)+" на единицу")+
        " · "+n.observations+" наблюдений · "+n.low+"–"+n.high)),
      details("Утверждённые техкарты",data.recipes.map(r=>product(r.output_id)+" · "+formatDate.format(new Date(r.approved_at)))));
    stats.append(finance);
    const journal=el("section",null,{className:"owner-card"});journal.append(el("h2","История операций"));
    function entry(h){
      const box=el("div");
      const r=h.result;
      box.append(el("strong",operations[r.kind]+" · "+formatDate.format(new Date(h.at))));
      if(h.supplier || h.note) box.append(el("p",[h.supplier,h.note].filter(Boolean).join(" · ")));
      if(r.kind==="production") box.append(el("p",product(r.outputId)+" · "+quantity(r.yield,r.outputId)+" · "+
        (r.total==null ? "себестоимость партии неизвестна" : vnd.format(r.total/r.yield)+" за единицу")+
        (r.usedRecipe ? " · по утверждённой техкарте" : "")));
      else if(r.total!=null) box.append(el("span"," · "+vnd.format(r.total)));
      if(r.kind==="count") box.append(details("Ведомость",r.rows.map(s=>product(s.itemId)+
        " · "+areas[s.area]+" · "+s.before+" → "+quantity(s.quantity,s.itemId))));
      if(h.hash) box.append(btn("Оригинал",()=>original(h.hash)));
      return box;
    }
    journal.append(details("Последние поступления",data.history.filter(h=>h.result.kind==="purchase").slice(0,8).map(entry)),
      details("Журнал",data.history.map(entry)));
    stats.append(journal);
  }
  function open(draft){
    if(!data) return status("Дождитесь загрузки складских остатков",true);
    if(pending) return status("Сначала проверьте предыдущую операцию",true);
    if(data.role==="kitchen" && ["purchase","count"].includes(draft.kind)) return status("Проведение доступно владельцу и менеджеру",true);
    const form=el("form",null,{className:"owner-card"});
    const kind=draft.kind;
    const key=crypto.randomUUID();
    form.append(el("h2",operations[kind]));
    if(draft.question) form.append(el("p",draft.question,{className:"owner-review"}));
    if(draft.source==="invoice") form.append(el("p","Сверьте каждую строку и сумму с оригиналом.",{className:"owner-review"}));
    const fields={};
    const group=el("div",null,{className:"owner-actions"});
    function control(id,label,input){fields[id]=input;group.append(field(label,input));return input;}
    if(kind==="count") control("full","Вид пересчёта",select({partial:"Выбранные товары",full:"Полная ведомость"},draft.full ? "full" : "partial")).onchange=e=>{
      const full=e.target.value==="full";
      open({...draft,full,lines:full ? data.stock.flatMap(s=>[{itemId:s.id,area:"main"},...(s.item_type==="finished_good" ? [] : [{itemId:s.id,area:"kitchen"}])]) : [{}]});
    };
    if(kind==="purchase"){
      control("supplier","Поставщик",el("input",null,{value:draft.supplier || "",required:draft.source==="invoice"}));
      control("date","Дата прихода",el("input",null,{type:"date",required:true,value:draft.date || (draft.source==="invoice" ? "" : today())}));
      control("number","Номер накладной",el("input",null,{value:draft.number || ""}));
      control("part","Номер части поставки",number("","1"));
      for(const [key,label] of Object.entries({discount:"Скидка, VND",delivery:"Доставка, VND",tax:"Налог, VND",total:"Итого, VND"})){
        control(key,label,number(draft[key],"1"));
      }
    }
    if(["transfer","return","waste"].includes(kind)) control("area",kind==="transfer" ? "Откуда перемещаем" : "Место хранения",select(areas,draft.area || "main"));
    if(["return","waste"].includes(kind)) control("note","Причина",el("input",null,{required:true,value:draft.note || ""}));
    if(kind==="mode") control("mode","Режим",select({A:"A · Фактический учёт",B:"B · Предварительная оценка",C:"C · Утверждённая техкарта"},draft.mode || "A"));
    form.append(group);
    const rows=[];
    const production=["production","recipe"].includes(kind);
    function line(value,list,ingredient=false){
      const part=el("fieldset",null,{className:"owner-line"});
      if(value.label || value.uncertain) part.append(el("legend",value.label || "Сомнительная строка",{className:value.uncertain ? "owner-review" : ""}));
      const options=data.stock.filter(s=>ingredient ? s.item_type!=="finished_good" :
        kind==="recipe" ? !!s.linked_product_id : kind==="production" ? ["finished_good","semi_finished"].includes(s.item_type) :
        kind==="purchase" ? ["raw_material","packaging","other"].includes(s.item_type) && !s.linked_product_id :
        kind==="transfer" ? s.item_type!=="finished_good" : true);
      const item=select(Object.fromEntries(options.map(s=>[s.id,s.name_ru+" · "+units[s.base_unit]])),value.itemId,"Выберите позицию");
      item.required=true;
      const qty=number(value.quantity);qty.required=true;
      const unit=select(units,value.unit || catalog(value.itemId)?.base_unit,"Выберите единицу");unit.required=true;
      const place=select(areas,value.area || "main");
      const price=kind==="purchase" ? number(value.unitCost) : null;
      const total=kind==="purchase" ? number(value.lineTotal,"1") : null;
      const current=el("small");
      const row={item,qty,unit,place,price,total,ingredient,label:value.label};rows.push(row);
      function countLabel(){
        const position=catalog(item.value);
        current.textContent=position ? "Учётный остаток: "+quantity(place.value==="kitchen" ? position.kitchen : position.quantity,position.id) : "";
      }
      item.onchange=()=>{unit.value=catalog(item.value)?.base_unit || "";countLabel();};
      place.onchange=countLabel;
      part.append(field("Позиция",item),field("Количество",qty),field("Единица",unit));
      if(kind==="count"){part.append(field("Место",place),current);countLabel();}
      if(price){price.required=true;part.append(field("За исходную единицу, VND",price),field("Сумма строки, VND",total));}
      if(draft.full) {item.disabled=true;unit.disabled=true;place.disabled=true;}
      if(!draft.full && (!production || ingredient)) part.append(btn("Убрать",()=>{rows.splice(rows.indexOf(row),1);part.remove();}));
      list.append(part);
    }
    if(kind!=="mode"){
      const list=el("div");
      (draft.lines?.length ? draft.lines : [{}]).forEach(row=>line(row,list));
      form.append(list);
      if(!production && !draft.full) form.append(btn("Добавить позицию",()=>line({},list)));
    }
    if(production){
      const list=el("div");
      form.append(el("h3","Ингредиенты с кухни"),el("p",kind==="recipe" ? "Укажите состав на указанный выход." :
        data.mode==="C" ? "Без указанного расхода для блюда применяется утверждённая техкарта, если она есть." :
        "Для выпуска с неизвестным расходом оставьте состав пустым."),list);
      (draft.inputs || []).forEach(row=>line(row,list,true));
      form.append(btn("Добавить ингредиент",()=>line({},list,true)));
    }
    form.append(field(kind==="recipe" ? "Утверждаю состав" : "Проверил позиции и подтверждаю проведение",
      el("input",null,{type:"checkbox",required:true})),el("button","Провести",{type:"submit",className:"owner-primary"}),
      btn("Отмена",()=>{if(!busy) editor.replaceChildren();}));
    form.onsubmit=e=>{
      e.preventDefault();
      const payload={kind,source:draft.source};
      if(draft.hash) payload.hash=draft.hash;
      for(const [field,input] of Object.entries(fields)){
        if(field==="full") payload.full=input.value==="full";
        else if(input.value!=="") payload[field]=input.value;
      }
      if(kind!=="mode"){
        const encode=row=>{
          const item=catalog(row.item.value);
          const value={itemId:row.item.value,quantity:row.qty.value,unit:row.unit.value};
          if(kind==="count"){
            value.area=row.place.value;
            value.expected=value.area==="kitchen" ? item?.kitchen : item?.quantity;
          }
          if(row.price) value.unitCost=row.price.value;
          if(row.total?.value) value.lineTotal=row.total.value;
          if(row.label) value.label=row.label;
          return value;
        };
        payload.lines=rows.filter(row=>!row.ingredient).map(encode);
        if(production) payload.inputs=rows.filter(row=>row.ingredient).map(encode);
      }
      run(()=>post({key,payload}),"Проведение…");
    };
    editor.replaceChildren(form);
    editor.scrollIntoView?.({block:"start",behavior:"smooth"});
  }
  async function record(button,language,command){
    if(recording?.state==="recording"){recording.stop();return;}
    if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {status("Используйте текстовый ввод",true);return;}
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const chunks=[];
    let recorder;
    try{recorder=new MediaRecorder(stream);}catch(error){stream.getTracks().forEach(t=>t.stop());throw error;}
    recording=recorder;
    recorder.ondataavailable=e=>{if(e.data.size) chunks.push(e.data);};
    const timer=setTimeout(()=>{if(recorder.state==="recording") recorder.stop();},30000);
    recorder.onstop=()=>{
      clearTimeout(timer);
      stream.getTracks().forEach(t=>t.stop());
      recording=null;
      button.textContent="Записать голос";
      run(async()=>{
        const result=await request("voice",{language},new Blob(chunks,{type:recorder.mimeType.split(";")[0]}));
        command.value=transcript=result.text;
        status("Проверьте текст и нажмите «Разобрать»");
      },"Распознавание речи…");
    };
    recorder.start();
    button.textContent="Остановить запись";
    status("Запись до 30 секунд");
  }
  function init(){
    if(!root || root.dataset.initialized) return;
    root.dataset.initialized="1";
    const venues=root.ummaLocations || [];
    const title=el("header",null,{className:"owner-actions"});
    title.append(el("img",null,{src:"logo/assets/umma-icon-192.png",alt:"UMMA GLOBAL",width:48,height:48}),
      el("h1","AI Управляющий"),el("a","В рабочий кабинет",{href:"staff.html"}));
    root.append(title);
    if(!venues.length){root.append(el("p","Нет доступа к складу кафе"));return;}
    const location=select(Object.fromEntries(venues.map(v=>[v.id,v.name])));
    if(venues.length>1) title.append(field("Кафе",location));
    const panel=el("section",null,{className:"owner-card"});
    const voice=el("div",null,{className:"owner-actions"});
    const command=el("textarea",null,{required:true,maxLength:4000,placeholder:"Привезли 20 кг риса по 25 000 донгов за килограмм"});
    const lang=select({ru:"Русский",vi:"Tiếng Việt",en:"English"},"ru");
    const mic=btn("Записать голос",()=>{
      if(!busy) record(mic,lang.value,command).catch(error=>status(error.name==="NotAllowedError" ? "Разрешите доступ к микрофону" : error.message,true));
    },true);
    voice.append(mic,field("Язык записи",lang));
    const invoices=el("div",null,{className:"owner-actions",hidden:true});invoices.dataset.ownerInvoices="";
    for (const camera of [true,false]){
      const input=el("input",null,{type:"file",hidden:true,accept:camera ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"});
      if(camera) input.setAttribute("capture","environment");
      input.onchange=()=>{
        const file=input.files[0];input.value="";
        if(file) run(async()=>{
          const result=await request("invoice",{},file);
          status(result.question || "");
          if(result.draft) open(result.draft);
        },"Распознавание накладной…");
      };
      invoices.append(btn(camera ? "Фото накладной" : "Загрузить фото или PDF",()=>{if(!busy && !recording) input.click();}),input);
    }
    const form=el("form");
    form.append(field("Команда или вопрос",command),el("button","Разобрать",{type:"submit",className:"owner-primary"}));
    form.onsubmit=e=>{
      e.preventDefault();
      if(recording) return;
      run(async()=>{
        const text=command.value.trim();
        const interpreted=await request("interpret",{text:question ? question+"\nУточнение: "+text : text,source:text===transcript ? "voice" : "text"});
        status(interpreted.answer || interpreted.question || interpreted.draft?.question || "");
        if(interpreted.draft) open(interpreted.draft);
        if(interpreted.question || interpreted.draft?.question){question=text;command.value="";}else question="";
      },"Разбор команды…");
    };
    info=el("p",null,{className:"owner-message"});info.setAttribute("role","status");
    pendingPanel=el("div");editor=el("div");stats=el("div",null,{className:"owner-grid"});
    panel.append(voice,invoices,form,info,pendingPanel);
    root.append(panel,editor,stats);
    function venue(){
      cafe=location.value;data=null;question="";
      editor.replaceChildren();stats.replaceChildren();invoices.hidden=true;
      try{pending=JSON.parse(sessionStorage.getItem(pendingKey()) || "null");}catch{pending=null;}
      showPending();
      run(async()=>{await refresh();status("");});
    }
    location.onchange=()=>{if(busy || recording) location.value=cafe;else venue();};
    venue();
  }
  document.addEventListener("umma:owner-manager-open",init);
  if(root?.ummaLocations) init();
})();
