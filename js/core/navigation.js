/* UMMA Global — consistent in-app back navigation.
 * Records the previous visible screen without changing existing order, payment or API flows.
 * Back restores the actual previous screen, not a hard-coded home/admin destination.
 */
(() => {
  "use strict";
  const screenIds = [
    "adminPage","adminUsersPage","locationAdminPage","cafeProductsAdminPage",
    "cafeStaffAdminPage","cafeWaiterPage","cafeKitchenPage",
    "cafeInventoryPage","cafePage","cafeOrdersPage","cafeAccountingPage","marketPage","marketShopPage","b2bPage","servicesPage"
  ];
  const backIds = new Set([
    "adminBack","adminUsersBack","locationAdminBack","cafeProductsAdminBack",
    "cafeStaffAdminBack","cafeWaiterBack","cafeKitchenBack",
    "marketBack","cafeInventoryBack","cafeBack","cafeOrdersBack","accountingBack","servicesBack"
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
      scrollY:(currentScreen()==="home"?main():byId(currentScreen()))?.scrollTop||window.scrollY||0
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
    const scroller=state.screen==="home"?main():byId(state.screen);
    if(scroller?.scrollTo)scroller.scrollTo({top:state.scrollY,behavior:"instant"});else window.scrollTo({top:state.scrollY,behavior:"instant"});
    if(typeof setActiveNav==="function")setActiveNav(state.screen==="home"?"home":state.screen==="servicesPage"?"more":state.screen==="cafeOrdersPage"?"orders":"cafe");
  }
  function back(){
    if(window.ummaQuran?.isOpen())return window.ummaQuran.back();
    if(window.ummaIslamReminders?.isOpen())return window.ummaIslamReminders.back();
    if(window.ummaIslamLibrary?.isOpen())return window.ummaIslamLibrary.back();
    if(window.ummaIslam?.isOpen())return window.ummaIslam.back();
    if(window.ummaDeliveryChat?.isOpen()){window.ummaDeliveryChat.close();return true;}
    if(window.ummaNativeShell?.isDialogOpen()){window.ummaNativeShell.closeDialog();return true;}
    if(window.ummaNotifications?.isOpen()){window.ummaNotifications.close();return true;}
    if(window.ummaCourierTracking?.isOpen()){window.ummaCourierTracking.close();return true;}
    const route=byId("courierMapModal");if(route&&!route.hidden){window.UmmaCourierMap?.close();return true;}
    if(window.ummaCheckoutChoices?.isOpen()){window.ummaCheckoutChoices.close();return true;}
    const modal=document.querySelector("dialog[open]");if(modal){modal.close?.();return true;}
    if(window.ummaB2B?.backToCatalog?.())return true;
    if(window.ummaCafe?.isCheckoutOpen?.()){window.ummaCafe.closeCheckout();return true;}
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
      if(stack.length||nested||window.ummaCafe?.isCheckoutOpen?.()){
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
