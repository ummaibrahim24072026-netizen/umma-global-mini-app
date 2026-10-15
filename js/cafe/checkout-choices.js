/* Branded checkout selection sheets; native selects retain validation and payloads. */
(() => {
 "use strict";
 const form=document.getElementById("cafeOrderForm");
 if(!form||typeof HTMLDialogElement==="undefined"||!HTMLDialogElement.prototype.showModal)return;
 const records=new Map();
 const sheet=document.createElement("dialog");
 sheet.className="cafe-choice-sheet";sheet.setAttribute("aria-labelledby","cafeChoiceTitle");
 const handle=document.createElement("div");handle.className="cafe-choice-handle";handle.setAttribute("aria-hidden","true");
 const header=document.createElement("div");header.className="cafe-choice-heading";
 const title=document.createElement("h2");title.id="cafeChoiceTitle";
 const cancel=document.createElement("button");cancel.type="button";cancel.className="cafe-choice-close";cancel.setAttribute("aria-label","Закрыть выбор");cancel.textContent="×";
 header.append(title,cancel);
 const list=document.createElement("div");list.className="cafe-choice-options";list.setAttribute("role","group");
 sheet.append(handle,header,list);document.body.append(sheet);
 let active=null,closing=false,timer=null;
 const sync=()=>{
  records.forEach((record,select)=>{
   const selected=select.options[select.selectedIndex];
   record.value.textContent=selected?.textContent||"Выберите вариант";
   record.trigger.setAttribute("aria-label",record.label+": "+record.value.textContent);
   record.trigger.disabled=select.disabled||!Array.from(select.options).some(o=>!o.disabled&&!o.hidden);
  });
 };
 function closed(){
  clearTimeout(timer);closing=false;sheet.classList.remove("is-closing");
  const previous=active;active=null;
  records.forEach(r=>r.trigger.setAttribute("aria-expanded","false"));
  if(previous?.isConnected&&!previous.disabled)previous.focus({preventScroll:true});
 }
 sheet.addEventListener("close",closed);
 function close(){
  if(!sheet.open||closing)return;
  closing=true;sheet.classList.add("is-closing");
  timer=setTimeout(()=>{if(sheet.open)sheet.close();},matchMedia("(prefers-reduced-motion: reduce)").matches?0:160);
 }
 function open(select){
  const record=records.get(select);if(!record||record.trigger.disabled)return;
  if(sheet.open)return;
  sync();active=record.trigger;
  title.textContent=record.label;list.setAttribute("aria-label",record.label);
  list.replaceChildren();
  Array.from(select.options).filter(o=>!o.hidden).forEach(option=>{
   const button=document.createElement("button");button.type="button";button.className="cafe-choice-option";
   button.disabled=option.disabled;button.setAttribute("aria-pressed",String(option.selected));
   const text=document.createElement("span");text.textContent=option.textContent;
   const mark=document.createElement("span");mark.className="cafe-choice-mark";mark.setAttribute("aria-hidden","true");mark.textContent=option.selected?"✓":"";
   button.append(text,mark);
   button.addEventListener("click",()=>{
    if(closing)return;
    if(select.value!==option.value){select.value=option.value;select.dispatchEvent(new Event("input",{bubbles:true}));select.dispatchEvent(new Event("change",{bubbles:true}));}
    sync();close();
   });
   list.append(button);
  });
  record.trigger.setAttribute("aria-expanded","true");
  sheet.showModal();
  (list.querySelector('[aria-pressed="true"]:not(:disabled)')||list.querySelector("button:not(:disabled)")||cancel).focus({preventScroll:true});
 }
 form.querySelectorAll("select").forEach(select=>{
  const label=select.closest("label");
  if(!label)return;
  const labelText=Array.from(label.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(" ").trim();
  const trigger=document.createElement("button");trigger.type="button";trigger.className="cafe-choice-trigger";
  const value=document.createElement("span");const chevron=document.createElement("span");chevron.className="cafe-choice-chevron";chevron.setAttribute("aria-hidden","true");chevron.textContent="⌄";
  trigger.append(value,chevron);trigger.setAttribute("aria-label",labelText);trigger.setAttribute("aria-haspopup","dialog");trigger.setAttribute("aria-expanded","false");
  records.set(select,{trigger,value,label:labelText});
  select.classList.add("cafe-choice-native");select.tabIndex=-1;select.setAttribute("aria-hidden","true");
  select.after(trigger);
  trigger.addEventListener("click",event=>{event.preventDefault();open(select);});
  select.addEventListener("click",event=>{event.preventDefault();open(select);});
  select.addEventListener("change",sync);
  select.addEventListener("invalid",event=>{event.preventDefault();open(select);});
  new MutationObserver(sync).observe(select,{childList:true,subtree:true,attributes:true,characterData:true});
 });
 cancel.addEventListener("click",close);
 sheet.addEventListener("cancel",event=>{event.preventDefault();close();});
 sheet.addEventListener("click",event=>{
  if(event.target!==sheet)return;
  const r=sheet.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();
 });
 document.addEventListener("click",()=>queueMicrotask(sync));
 form.addEventListener("reset",()=>setTimeout(sync,0));
 window.ummaCheckoutChoices={sync,isOpen:()=>sheet.open,close};
 sync();
})();
