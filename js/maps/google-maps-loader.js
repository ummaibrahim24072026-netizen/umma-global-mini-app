/* Lazy-load Google Maps only when a map is opened. */
(() => {
  "use strict";
  let loading=null;
  window.loadUmmaGoogleMaps=function(){
    if(window.google?.maps)return Promise.resolve(window.google.maps);
    if(loading)return loading;
    const key=String(window.UMMA_GOOGLE_MAPS_API_KEY||"").trim();
    if(!key||key==="PASTE_RESTRICTED_GOOGLE_MAPS_API_KEY_HERE"){
      return Promise.reject(new Error("Google Maps API-ключ ещё не настроен. Создайте ключ в Google Cloud и добавьте его в js/maps/google-maps-config.js."));
    }
    loading=new Promise((resolve,reject)=>{
      const callbackName="ummaGoogleMapsInit";
      window[callbackName]=()=>resolve(window.google.maps);
      const script=document.createElement("script");
      script.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&loading=async&callback="+callbackName+"&v=weekly";
      script.async=true;script.defer=true;
      script.onerror=()=>{loading=null;reject(new Error("Google Maps не загрузилась. Проверьте API-ключ, ограничения и биллинг Google Cloud."));};
      document.head.appendChild(script);
    });
    return loading;
  };
})();