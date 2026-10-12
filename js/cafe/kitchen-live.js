/* Kitchen tablet alerts: client-side acknowledgement, no changes to payments or order statuses. */
(() => {
  "use strict";
  const key="umma_kitchen_ack_v1";
  let seen={};
  try { seen=JSON.parse(localStorage.getItem(key)||"{}")||{}; } catch { seen={}; }
  let orders=[],alerts=new Map(),started=false,timer=null,audio=null;
  const page=()=>document.getElementById("cafeKitchenPage");
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(seen));}catch{}};
  function beep(){
    try{
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)return;
      if(!audio)audio=new Context();
      if(audio.state==="suspended")audio.resume();
      const tone=audio.createOscillator(),gain=audio.createGain();
      tone.frequency.value=880;gain.gain.value=.08;
      tone.connect(gain);gain.connect(audio.destination);
      tone.start();tone.stop(audio.currentTime+.2);
    }catch{}
  }
  function update(next){
    orders=next||[];
    const previous=alerts;
    const nextAlerts=new Map();
    let changed=false;
    for(const order of orders){
      if(["completed","cancelled"].includes(order.status))continue;
      const id=String(order.id),items=order.cafe_order_items||[];
      const ids=items.map(item=>String(item.id));
      if(!Object.prototype.hasOwnProperty.call(seen,id)){
        // First view of an existing order: do not call all old dishes a new add-on.
        seen[id]=order.status==="pending"?[]:ids;
      }
      const extra=ids.filter(itemId=>!seen[id].includes(itemId));
      if(extra.length){
        const kind=order.status==="pending"&&seen[id].length===0?"new":"extra";
        nextAlerts.set(id,{kind,ids:extra});
        if(started&&(!previous.has(id)||previous.get(id).ids.join(",")!==extra.join(",")))changed=true;
      }
    }
    alerts=nextAlerts;started=true;save();
    const label=document.getElementById("kitchenLiveStatus");
    if(label)label.textContent=(alerts.size?"🔔 Требуют внимания: "+alerts.size+" · ":"✓ ")+"Обновление каждые 10 секунд";
    if(changed&&page()&&!page().hidden)beep();
  }
  function notice(order){
    const entry=alerts.get(String(order.id));if(!entry)return "";
    const items=(order.cafe_order_items||[]).filter(item=>entry.ids.includes(String(item.id)));
    const names=items.map(item=>esc(item.product_name_ru)+" × "+Number(item.quantity)).join(" · ");
    return '<div class="kitchen-extra-alert"><strong>'+(entry.kind==="extra"?"🔔 ДОЗАКАЗ":"🔔 НОВЫЙ ЗАКАЗ")+'</strong><div>'+names+'</div><button type="button" data-kitchen-ack="'+esc(order.id)+'">✓ Увидел новые блюда</button></div>';
  }
  document.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-kitchen-ack]");
    if(!button)return;
    const id=button.getAttribute("data-kitchen-ack"),order=orders.find(o=>String(o.id)===id);
    if(!order)return;
    seen[id]=(order.cafe_order_items||[]).map(item=>String(item.id));
    alerts.delete(id);save();window.ummaKitchen?.rerender();
    const label=document.getElementById("kitchenLiveStatus");
    if(label)label.textContent="✓ Дозаказ отмечен как просмотренный · Автообновление каждые 10 секунд";
  });
  document.getElementById("kitchenTabletToggle")?.addEventListener("click",event=>{
    const on=page()?.classList.toggle("kitchen-tablet-mode");
    event.currentTarget.setAttribute("aria-pressed",String(!!on));
    event.currentTarget.textContent=on?"▣ Обычный режим":"▣ Режим планшета";
    beep();
  });
  function start(){
    if(timer)return;
    timer=window.setInterval(()=>{
      if(document.hidden||page()?.hidden)return;
      window.ummaKitchen?.refresh();
    },10000);
  }
  window.ummaKitchenLive={update,notice,start};
})();
