// Compatibility endpoint for the previously staged delivery page.
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return new Response(JSON.stringify({ok:false}),{status:405,headers});
 try{
  const raw=await req.text();if(raw.length>12000)return new Response(JSON.stringify({ok:false}),{status:413,headers});
  const b=JSON.parse(raw);
  if(b.action!=='checkout')return new Response(JSON.stringify({ok:false}),{status:400,headers});
  const result=await fetch(Deno.env.get('SUPABASE_URL')+'/functions/v1/cafe-guest-order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...b,action:'create',orderType:'delivery',paymentMethod:b.paymentMethod||'cash'})});
  return new Response(await result.text(),{status:result.status,headers});
 }catch{return new Response(JSON.stringify({ok:false,error:'Service unavailable'}),{status:503,headers});}
});
