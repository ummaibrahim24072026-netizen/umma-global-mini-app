/* Google Maps delivery view; navigation opens the native Maps app when available. */
(() => {
 "use strict";
 const $=id=>document.getElementById(id);let opener=null;
 function close(){const modal=$("courierMapModal");if(modal){modal.hidden=true;modal.style.display="none";}$("courierRouteMap")?.replaceChildren();opener?.focus();}
 function open(button){opener=button;const address=button.dataset.routeAddress||"";const modal=$("courierMapModal");if(!modal)return;
 modal.hidden=false;modal.style.display="block";$("courierMapTitle").textContent="Маршрут · Заказ №"+(button.dataset.routeOrderNumber||"");
 $("courierMapMessage").textContent=address+" · Навигация от вашего текущего положения откроется в Google Maps.";
 const destination=address+", Vietnam";
 $("courierMapExternal").href="https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination="+encodeURIComponent(destination);
 const frame=document.createElement("iframe");frame.title="Адрес доставки в Google Maps";frame.src="https://www.google.com/maps?q="+encodeURIComponent(destination)+"&output=embed";frame.style.cssText="width:100%;height:100%;border:0";frame.referrerPolicy="no-referrer";$("courierRouteMap").replaceChildren(frame);$("courierMapClose")?.focus();
 }
 document.addEventListener("click",event=>{const button=event.target.closest?.("[data-show-route='true']");if(button){event.preventDefault();open(button);}});
 $("courierMapClose")?.addEventListener("click",close);document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("courierMapModal")?.hidden)close();});window.UmmaCourierMap={open,close};
})();
