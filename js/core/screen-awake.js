/* Keep visible UMMA screens awake. Operating-system power policies remain authoritative. */
(()=>{'use strict';let lock=null,pending=false,generation=0,enabled=true,retry=null,failedAt=0;
const customerDisplay=document.body.classList.contains('work-payment-screen');
try{enabled=customerDisplay||localStorage.getItem('umma:screen-awake')!=='off';}catch{}
const supported=!!navigator.wakeLock?.request;
const profileSwitch=document.getElementById('profileScreenAwake');
const profileStatus=document.getElementById('profileScreenAwakeStatus');
function status(){
 const active=!!lock&&!lock.released;
 document.documentElement.dataset.screenAwake=active?'active':supported?'inactive':'unsupported';
 if(profileSwitch){
  profileSwitch.disabled=!supported;
  profileSwitch.checked=supported&&enabled;
  const message=!supported?'Этот браузер не поддерживает удержание экрана.':
   enabled&&!active&&failedAt?'Не удалось удержать экран включённым.':'';
  if(profileStatus){
   const text=message?(window.ummaMenuI18n?.t(message)??message):'';
   if(profileStatus.textContent!==text)profileStatus.textContent=text;
   profileStatus.hidden=!text;
  }
 }
 const button=document.getElementById('ummaScreenAwake');
 if(button){
  button.textContent=!supported?'Удержание экрана недоступно':active?'Экран не гаснет':enabled?'Включить удержание экрана':'Не выключать экран';
  button.setAttribute('aria-pressed',String(enabled));
  button.title=supported?'Работает, пока приложение видно на экране':'Браузер не поддерживает удержание экрана. Отключите автоблокировку в настройках устройства.';
 }
}
async function acquire(){if(!enabled||!supported||document.visibilityState==='hidden'||lock&&!lock.released||pending||Date.now()-failedAt<5000)return;pending=true;const version=generation;try{const next=await navigator.wakeLock.request('screen');if(version!==generation||!enabled||document.visibilityState==='hidden'){await next.release();return;}lock=next;next.addEventListener('release',()=>{if(lock===next)lock=null;status();if(enabled&&document.visibilityState!=='hidden'){clearTimeout(retry);retry=setTimeout(()=>void acquire(),1000);}});status();}catch{failedAt=Date.now();status();if(customerDisplay&&document.visibilityState!=='hidden'){clearTimeout(retry);retry=setTimeout(()=>void acquire(),5500);}}finally{pending=false;if(version!==generation&&enabled&&document.visibilityState!=='hidden'){clearTimeout(retry);retry=setTimeout(()=>void acquire(),0);}}}
async function release(){generation++;clearTimeout(retry);const old=lock;lock=null;if(old&&!old.released)try{await old.release();}catch{}status();}
function resume(){if(document.visibilityState==='hidden')void release();else{failedAt=0;void acquire();}}
document.addEventListener('visibilitychange',resume);window.addEventListener('pageshow',resume);window.addEventListener('focus',resume);window.addEventListener('pagehide',()=>void release());document.addEventListener('pointerdown',()=>void acquire(),{passive:true});
function setEnabled(value){
 enabled=value;
 if(enabled){failedAt=0;void acquire();}
 else void release();
 try{localStorage.setItem('umma:screen-awake',enabled?'on':'off');}catch{}
 status();
}
if(profileSwitch){
 profileSwitch.addEventListener('change',()=>setEnabled(profileSwitch.checked));
 window.addEventListener('umma-menu:languagechange',status);
}else{
 const host=document.querySelector('.web-account-menu>div')||document.querySelector('.menu-footer');
 if(host){
  const button=document.createElement('button');
  button.id='ummaScreenAwake';
  button.type='button';
  button.style.cssText='font:inherit;min-height:44px;padding:8px 12px;border:1px solid #bddbd8;border-radius:10px;background:white;color:#075e65';
  button.onclick=()=>setEnabled(!lock);
  host.append(button);
 }
}
window.ummaScreenAwake={retry(){enabled=true;failedAt=0;return acquire();}};status();void acquire();
})();
