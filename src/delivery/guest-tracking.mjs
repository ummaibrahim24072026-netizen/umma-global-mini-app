/** Browser-only guest delivery tracker. Never accepts an order ID as authorization. */
export function createGuestTracker({endpoint,token,onUpdate,onError,intervalMs=5000,fetcher=fetch}) {
  if (!/^https:\/\//.test(endpoint)) throw Error('HTTPS endpoint required');
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error('Private tracking token required');
  let stopped=false,timer=null,controller=null;
  const poll=async()=>{
    if(stopped)return;
    controller=new AbortController();
    try{
      const res=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'tracking',token}),signal:controller.signal,cache:'no-store'});
      if(!res.ok)throw Error('Tracking unavailable');
      const data=await res.json();
      if(data.ok!==true)throw Error('Tracking unavailable');
      if(data.latitude!=null||data.longitude!=null){
        const lat=Number(data.latitude),lon=Number(data.longitude),age=Date.now()-Date.parse(data.updatedAt);
        if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!Number.isFinite(age)||age>60000||age< -10000)throw Error('Stale GPS');
      }
      onUpdate(data);
    }catch(e){if(!stopped)onError(e);}
    if(!stopped)timer=setTimeout(poll,intervalMs);
  };
  return {start(){if(!stopped&&!timer)poll();},stop(){stopped=true;controller?.abort();clearTimeout(timer);}};
}
