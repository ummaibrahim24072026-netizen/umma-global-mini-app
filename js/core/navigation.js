/* UMMA Global — consistent in-app back navigation.
 * Records the previous visible screen without changing existing order, payment or API flows.
 * Back restores the actual previous screen, not a hard-coded home/admin destination.
 */
(() => {
  "use strict";
  const screenIds = [
    "adminPage","adminUsersPage","locationAdminPage","cafeProductsAdminPage",
    "cafeStaffAdminPage","cafeWaiterPage","cafeKitchenPage",
    "cafeInventoryPage","cafePage","cafeAccountingPage"
  ];
  const backIds = new Set([
    "adminBack","adminUsersBack","locationAdminBack","cafeProductsAdminBack",
    "cafeStaffAdminBack","cafeWaiterBack","cafeKitchenBack",
    "cafeInventoryBack","cafeBack","accountingBack"
  ]);
  const stack=[];
  const byId=id=>document.getElementById(id);
  const main=()=>document.querySelector(".app > main");
  const bottom=()=>document.querySelector(".bottom-nav");
  function currentScreen(){
    for(const id of screenIds){
      const el=byId(id);
      if(el&&!el.hidden)return id;
    }
    return "home";
  }
  function snapshot(){
    return {
      screen:currentScreen(),
      mainDisplay:main()?.style.display??"",
      navDisplay:bottom()?.style.display??"",
      scrollY:window.scrollY||0
    };
  }
  function restore(state){
    for(const id of screenIds){
      const el=byId(id);
      if(el)el.hidden=id!==state.screen;
    }
    if(main())main().style.display=state.mainDisplay;
    if(bottom())bottom().style.display=state.navDisplay;
    if(state.screen==="home"&&typeof setActiveNav==="function")setActiveNav("home");
    window.scrollTo({top:state.scrollY,behavior:"instant"});
  }
  function back(){
    if(window.ummaNotifications?.isOpen()){window.ummaNotifications.close();return true;}
    if(window.ummaCourierTracking?.isOpen()){window.ummaCourierTracking.close();return;}
    const route=byId("courierMapModal");if(route&&!route.hidden){window.UmmaCourierMap?.close();return true;}
    if(currentScreen()==="cafeKitchenPage"){
      const cash=byId("cafeCashPanel");
      if(cash&&!cash.hidden){
        cash.hidden=true;
        const toggle=byId("cafeCashToggle");
        if(toggle){toggle.setAttribute("aria-expanded","false");toggle.textContent="💰 Касса и смена";}
        byId("cafeKitchenOrders")?.scrollIntoView({block:"start"});
        return true;
      }
      const management=document.querySelector(".cafe-management-tools");
      if(management?.open){management.open=false;return true;}
    }
    if(!stack.length)return false;
    const prior=stack.pop();
    restore(prior);
    return true;
  }
  // Capture runs before legacy click handlers. For navigation only, observe
  // the resulting screen after their synchronous DOM updates.
  document.addEventListener("click",event=>{
    const button=event.target.closest?.("button");
    if(!button)return;
    if(backIds.has(button.id)){
      const cash=byId("cafeCashPanel");
      const nested=currentScreen()==="cafeKitchenPage"&&(
        (cash&&!cash.hidden)||document.querySelector(".cafe-management-tools")?.open
      );
      if(stack.length||nested){
        event.preventDefault();
        event.stopImmediatePropagation();
        back();
      }
      return;
    }
    const before=snapshot();
    window.setTimeout(()=>{
      const after=currentScreen();
      if(after!==before.screen){
        const last=stack[stack.length-1];
        if(!last||last.screen!==before.screen)stack.push(before);
        if(stack.length>25)stack.shift();
      }
    },0);
  },true);
  // Expose a safe back action for a future Telegram native back button.
  window.ummaNavigation={back,depth:()=>stack.length,current:currentScreen};
})();
