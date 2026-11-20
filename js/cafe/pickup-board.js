(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const key='umma:pickup-board-token';
  const fragment=new URLSearchParams(location.hash.slice(1)).get('screen');
  const valid=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  let saved;
  try{saved=localStorage.getItem(key);}catch{}
  const token=fragment??saved;
  const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-pickup-board';
  const voice=window.speechSynthesis;
  const sound=$('boardSound'),fullscreen=$('boardFullscreen');
  let calls=[],previous=[],queue=[],initialized=false,enabled=false,speaking=false;
  let stopped=false,polling=false,timer;

  function render(next){
    if(next.length!==calls.length||next.some((call,index)=>call.id!==calls[index].id||call.number!==calls[index].number)){
      $('boardCalls').replaceChildren(...next.map(call=>{
        const item=document.createElement('li');
        item.textContent='№'+call.number;
        return item;
      }));
    }
    calls=next;
  }

  function say(message,finish){
    const utterance=new SpeechSynthesisUtterance(message);
    utterance.lang='ru-RU';
    const fallback=setTimeout(()=>done(false),12000);
    function done(ok){
      if(!utterance.onend)return;
      clearTimeout(fallback);
      utterance.onend=utterance.onerror=null;
      finish(ok);
    }
    utterance.onend=()=>done(true);
    utterance.onerror=()=>done(false);
    try{voice.speak(utterance);}catch{done(false);}
  }

  function playQueue(){
    if(stopped||!enabled||speaking||document.hidden)return;
    const call=queue.shift();
    if(!call)return;
    if(!calls.some(active=>active.id===call.id)){playQueue();return;}
    speaking=true;
    say('Заказ номер '+call.number+' готов. Заберите на стойке выдачи.',ok=>{
      speaking=false;
      if(stopped)return;
      if(!ok){
        enabled=false;
        queue.unshift(call);
        sound.hidden=false;
        $('boardSoundStatus').textContent='Нажмите «Включить звук», чтобы продолжить озвучивание.';
      }
      playQueue();
    });
  }

  sound.onclick=()=>{
    sound.disabled=true;
    $('boardSoundStatus').textContent='';
    void window.ummaScreenAwake?.retry();
    say('Звук табло включён.',ok=>{
      sound.disabled=false;
      if(stopped)return;
      enabled=ok;
      sound.hidden=ok;
      if(!ok)$('boardSoundStatus').textContent='Проверьте, доступен ли русский голос на устройстве.';
      playQueue();
    });
  };
  fullscreen.hidden=!document.documentElement.requestFullscreen;
  fullscreen.onclick=async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    }catch{}
  };
  document.addEventListener('fullscreenchange',()=>{
    fullscreen.textContent=document.fullscreenElement?'Выйти из полноэкранного режима':'На весь экран';
  });

  async function poll(){
    if(stopped||polling||document.hidden)return;
    clearTimeout(timer);
    polling=true;
    try{
      const response=await fetch(endpoint,{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'poll',token}),
        cache:'no-store',signal:AbortSignal.timeout(8000)
      });
      if(response.status===404){
        stopped=true;
        render([]);
        queue=[];
        sound.hidden=true;
        $('boardSoundStatus').textContent='';
        voice?.cancel();
        try{localStorage.removeItem(key);}catch{}
        $('boardStatus').textContent='Табло отключено. Откройте новую ссылку со стойки.';
        return;
      }
      const data=await response.json();
      if(!response.ok||!data.ok||!Array.isArray(data.calls))throw Error('Pickup board unavailable');
      const next=data.calls.filter(call=>typeof call?.id==='string'&&Number.isSafeInteger(call.number)&&call.number>0);
      if(!initialized){
        initialized=true;
        try{
          localStorage.setItem(key,token);
          if(fragment!==null)history.replaceState(null,'',location.pathname+location.search);
        }catch{}
        sound.hidden=!(voice&&window.SpeechSynthesisUtterance);
        if(sound.hidden)$('boardSoundStatus').textContent='Озвучивание недоступно в этом браузере.';
      }else if(voice&&window.SpeechSynthesisUtterance){
        const known=new Set(previous.map(call=>call.id));
        queue=queue.filter(call=>next.some(active=>active.id===call.id));
        queue.push(...next.filter(call=>!known.has(call.id)).reverse());
      }
      previous=next;
      render(next);
      $('boardStatus').textContent=next.length?'':'Ожидаем готовые заказы';
      playQueue();
    }catch{
      render([]);
      $('boardStatus').textContent='Восстанавливаем связь со стойкой…';
    }finally{
      polling=false;
      if(!stopped&&!document.hidden)timer=setTimeout(poll,3000);
    }
  }

  if(!valid(token)){
    $('boardStatus').textContent='Откройте ссылку на табло со стойки выдачи.';
    return;
  }
  document.addEventListener('visibilitychange',()=>void poll());
  window.addEventListener('online',()=>void poll());
  window.addEventListener('pageshow',()=>void poll());
  void poll();
})();
