/* Staff alerts for new app orders and kitchen add-ons. */
(() => {
  "use strict";
  const key="umma_kitchen_ack_v1";
  let seen={};
  try { seen=JSON.parse(localStorage.getItem(key)||"{}")||{}; } catch { seen={}; }
  let orders=[],alerts=new Map(),started=false,timer=null,audio=null;
  const knownAppOrders=new Set();
  const voiceKey="umma_kitchen_order_voice";
  let appOrdersLoaded=false,voiceEnabled=true,playback=Promise.resolve();
  try { voiceEnabled=localStorage.getItem(voiceKey)!=="off"; } catch {}
  const page=()=>document.getElementById("cafeKitchenPage");
  const visible=()=>page()?.hidden===false||document.getElementById("cafeWaiterPage")?.hidden===false;
  const canAnnounce=()=>!document.hidden&&visible()&&!page()?.classList.contains("courier-workspace");
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(seen));}catch{}};
  async function unlockAudio(){
    try{
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)return;
      if(!audio)audio=new Context();
      if(audio.state!=="running")await audio.resume();
    }catch{}
  }
  function beep(newOrder=false){
    try{
      if(audio?.state!=="running")return;
      const now=audio.currentTime;
      for(const [offset,frequency] of (newOrder?[[0,660],[.16,880]]:[[0,880]])){
        const tone=audio.createOscillator(),gain=audio.createGain();
        tone.frequency.value=frequency;
        gain.gain.setValueAtTime(.08,now+offset);
        gain.gain.exponentialRampToValueAtTime(.001,now+offset+.14);
        tone.connect(gain);gain.connect(audio.destination);
        tone.start(now+offset);tone.stop(now+offset+.15);
      }
    }catch{}
  }

  function speak(message){
    return new Promise(resolve=>{
      const timeout=setTimeout(()=>resolve(false),Math.max(15000,message.length*150));
      const finish=success=>{clearTimeout(timeout);resolve(success);};
      try {
        const utterance=new window.SpeechSynthesisUtterance(message);
        utterance.lang="ru-RU";
        utterance.onend=()=>finish(true);
        utterance.onerror=()=>finish(false);
        window.speechSynthesis.speak(utterance);
      } catch { finish(false); }
    });
  }

  function announce(message){
    playback=playback.then(async()=>{
      if(!canAnnounce()||audio?.state!=="running")return;
      beep(true);
      if(!voiceEnabled)return;
      await new Promise(resolve=>setTimeout(resolve,340));
      if(canAnnounce()&&voiceEnabled)return speak(message);
    });
    return playback;
  }

  function updateAppOrders(){
    const counterLocation=document.body.dataset.workspace==="pos"
      ? document.getElementById("posLocation")?.value : "";
    const incoming=orders.filter(order=>{
      if(order.created_via!=="customer"||knownAppOrders.has(order.id))return false;
      knownAppOrders.add(order.id);
      return !["completed","cancelled"].includes(order.status)
        &&(!counterLocation||order.location_id===counterLocation);
    });
    if(appOrdersLoaded&&canAnnounce()){
      incoming.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
      for(const order of incoming){
        const items=(order.cafe_order_items||[]).map(item=>item.product_name_ru+" — "+item.quantity);
        const heading=order.order_number?"Новый заказ номер "+order.order_number:"Новый заказ";
        void announce([heading,...items].join(". ")+".");
      }
    }
    appOrdersLoaded=true;
  }

  const voice=document.getElementById("kitchenOrderVoice");
  if(voice){
    voice.checked=voiceEnabled;
    voice.disabled=!window.SpeechSynthesisUtterance||!window.speechSynthesis;
    voice.addEventListener("change",()=>{
      voiceEnabled=voice.checked;
      try { localStorage.setItem(voiceKey,voiceEnabled?"on":"off"); } catch {}
    });
  }
  document.addEventListener("click",()=>{
    if(canAnnounce()&&audio?.state!=="running")void unlockAudio();
  });
  document.getElementById("kitchenAudioTest")?.addEventListener("click",async event=>{
    const button=event.currentTarget,status=document.getElementById("kitchenAudioStatus");
    button.disabled=true;
    try {
      await unlockAudio();
      const spoken=await announce("Проверка звука. Новый заказ номер сто. Плов — два. Айран — один.");
      status.hidden=false;
      status.textContent=audio?.state!=="running"?"Не удалось включить звук. Нажмите ещё раз."
        : !voiceEnabled?"Звуковой сигнал включён."
        : spoken?"Звуковой сигнал и озвучка включены.":"Звуковой сигнал включён. Голос недоступен на этом устройстве.";
    } finally { button.disabled=false; }
  });

  function update(next,courierWorkspace=false){
    orders=next||[];
    if(!courierWorkspace)updateAppOrders();
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
  document.getElementById("kitchenTabletToggle")?.addEventListener("click",async event=>{
    const on=page()?.classList.toggle("kitchen-tablet-mode");
    event.currentTarget.setAttribute("aria-pressed",String(!!on));
    event.currentTarget.textContent=on?"▣ Обычный режим":"▣ Режим планшета";
    await unlockAudio();
    beep();
  });
  function start(){
    if(timer)return;
    timer=window.setInterval(()=>{
      if(document.hidden||!visible())return;
      window.ummaKitchen?.refresh({silent:true});
    },2000);
  }
  const refreshVisible=()=>{if(!document.hidden&&visible())window.ummaKitchen?.refresh({silent:true});};
  document.addEventListener("umma:cafe-events",refreshVisible);document.addEventListener("visibilitychange",refreshVisible);window.addEventListener("online",refreshVisible);
  window.ummaKitchenLive={update,notice,start};
})();
