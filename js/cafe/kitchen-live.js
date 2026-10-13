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
      // Pending orders are NEW ORDERS. The existing "Принять заказ"
      // action is their acknowledgement; never call initial dishes add-ons.
      if(order.status==="pending"){
        seen[id]=ids;
        continue;
      }
      // First encounter of an in-progress order is a baseline, not a
      // fabricated add-on. This also migrates older empty acknowledgements.
      if(!Array.isArray(seen[id])||seen[id].length===0){
        seen[id]=ids;
        continue;
      }
      const extra=ids.filter(itemId=>!seen[id].includes(itemId));
      if(extra.length){
        nextAlerts.set(id,{kind:"extra",ids:extra});
        if(started&&(!previous.has(id)||previous.get(id).ids.join(",")!==extra.join(",")))changed=true;
      }
    }
    alerts=nextAlerts;started=true;save();
    if(changed&&page()&&!page().hidden)beep();
  }
  function notice(order){
    const entry=alerts.get(String(order.id));if(!entry)return "";
    const items=(order.cafe_order_items||[]).filter(item=>entry.ids.includes(String(item.id)));
    const names=items.map(item=>esc(item.product_name_ru)+" × "+Number(item.quantity)).join(" · ");
    return '<div class="kitchen-extra-alert"><strong>🔔 ДОЗАКАЗ К ЗАКАЗУ №'+esc(order.order_number||order.id)+'</strong><div>'+names+'</div><button type="button" data-kitchen-ack="'+esc(order.id)+'">✓ Принять дозаказ к приготовлению</button></div>';
  }
  document.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-kitchen-ack]");
    if(!button)return;
    const id=button.getAttribute("data-kitchen-ack"),order=orders.find(o=>String(o.id)===id);
    if(!order)return;
    const alert=alerts.get(id);
    if(!alert)return;
    // Confirm only the displayed add-on items, not unseen future additions.
    const acknowledged=new Set(Array.isArray(seen[id])?seen[id]:[]);
    for(const itemId of alert.ids)acknowledged.add(itemId);
    seen[id]=[...acknowledged];
    alerts.delete(id);save();window.ummaKitchen?.rerender();
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
      window.ummaKitchen?.refresh({silent:true});
    },5000);
  }
  window.ummaKitchenLive={update,notice,start};
})();
