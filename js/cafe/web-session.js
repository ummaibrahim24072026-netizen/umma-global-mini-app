/* Independent web staff session. No Telegram SDK or Telegram identity is required. */
(()=>{'use strict';let actor=null;const key='umma:web-staff-session';
window.ummaStaffAuth={credential:()=>{try{const token=localStorage.getItem(key);return token?'web:'+token:'';}catch{return '';}},actorId:()=>actor,setActor:id=>actor=id,save:token=>localStorage.setItem(key,token),clear:()=>{actor=null;localStorage.removeItem(key);}};
})();
