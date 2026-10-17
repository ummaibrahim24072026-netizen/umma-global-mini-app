import QRCode from 'npm:qrcode@1.5.4';
const enc=new TextEncoder(),esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const key=(secret:string,uses:KeyUsage[])=>crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,uses);
export async function labelLink(job:string,actor:number,secret:string,base:string){
 const data=btoa(JSON.stringify({job,actor,expires:Math.floor(Date.now()/1000)+600})).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 const sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret,['sign']),enc.encode('umma-market-labels:'+data))),x=>x.toString(16).padStart(2,'0')).join('');
 return base+'/functions/v1/market-stock?labels='+data+'&sig='+sig;
}
export async function verifyLabelToken(url:URL,secret:string,now=Math.floor(Date.now()/1000)){
 const data=url.searchParams.get('labels')||'',sig=url.searchParams.get('sig')||'';
 if(data.length>500||!/^[a-f0-9]{64}$/.test(sig))throw Error('Invalid label link');
 const bytes=Uint8Array.from(sig.match(/../g)!,x=>parseInt(x,16));
 if(!await crypto.subtle.verify('HMAC',await key(secret,['verify']),bytes,enc.encode('umma-market-labels:'+data)))throw Error('Invalid label signature');
 const decoded=JSON.parse(atob(data.replaceAll('-','+').replaceAll('_','/')));
 if(!/^[a-f0-9-]{36}$/i.test(decoded.job)||!Number.isSafeInteger(decoded.actor)||decoded.actor<=0||!Number.isSafeInteger(decoded.expires)||decoded.expires<now||decoded.expires>now+600)throw Error('Label link expired');return decoded;
}
export async function serveLabels(req:Request,db:any,secret:string){
 try{
  const token=await verifyLabelToken(new URL(req.url),secret);
  const jobQ=await db.from('market_print_jobs').select('*').eq('id',token.job).single();if(jobQ.error)throw Error('Print job unavailable');const job=jobQ.data;
  const docQ=await db.from('market_documents').select('id,warehouse_id,actor_telegram_id').eq('id',job.document_id).eq('actor_telegram_id',token.actor).single();if(docQ.error)throw Error('Print job unavailable');
  const whQ=await db.from('market_warehouses').select('location_id').eq('id',docQ.data.warehouse_id).single();if(whQ.error)throw Error('Warehouse unavailable');
  const permission=await db.rpc('market_can',{p_actor:token.actor,p_location:whQ.data.location_id,p_roles:['packer','warehouse']});if(permission.error||permission.data!==true)throw Error('Print access denied');
  let cards='';
  if(job.unit_ids.length){
   const units=await db.from('market_stock_units').select('id,quantity,status,created_at,variant_id,market_batches(batch_number,expires_on,warehouse_id),market_product_variants(measure,storage_conditions,products(name_ru,name_en,name_vi))').in('id',job.unit_ids);
   if(units.error)throw Error('Labels unavailable');
   for(const id of job.unit_ids){
    const u=units.data.find((x:any)=>x.id===id);if(!u||!['available','quarantine','reserved'].includes(u.status)||u.market_batches.warehouse_id!==docQ.data.warehouse_id)throw Error('Label package unavailable');
    const v=u.market_product_variants,b=u.market_batches,title=v.products.name_ru||v.products.name_en||v.products.name_vi,weight=v.measure==='g'?(u.quantity/1000).toFixed(3)+' kg':u.quantity+' pcs';
    const packed=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(u.created_at));
    const svg=await QRCode.toString('UMMA:'+id,{type:'svg',margin:4,errorCorrectionLevel:'M'});
    cards+=`<article class="label"><div><b>UMMA Market</b><strong>${esc(title)}</strong><span>${esc(weight)}</span><small>${esc(id)}<br>Batch: ${esc(b.batch_number)}<br>Pack: ${esc(packed)}<br>EXP: ${esc(b.expires_on||'—')}<br>${esc(v.storage_conditions||'')}</small></div>${svg}</article>`;
   }
  }else{
   const variants=await db.from('market_product_variants').select('id,products(name_ru,name_en,name_vi)').in('id',job.variant_ids||[]);if(variants.error)throw Error('Product labels unavailable');
   for(const v of variants.data){const code='UMMA-PRODUCT-'+v.id,svg=await QRCode.toString(code,{type:'svg',margin:4,errorCorrectionLevel:'M'});cards+=`<article class="label"><div><b>UMMA Market</b><strong>${esc(v.products.name_ru||v.products.name_en||v.products.name_vi)}</strong><small>${esc(code)}</small></div>${svg}</article>`;}
  }
  if(!cards)throw Error('No labels');
  const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UMMA Market — этикетки</title><style>@page{size:${job.width_mm}mm ${job.height_mm}mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#123b39;background:#eef6f2}.tools{padding:16px;max-width:640px;line-height:1.6}.tools button{padding:12px 24px;border:0;border-radius:10px;color:white;background:#176f70;font-size:16px}.label{background:#fff;color:#000;width:${job.width_mm}mm;height:${job.height_mm}mm;padding:2mm;display:flex;gap:1mm;align-items:center;page-break-after:always;overflow:hidden;border:1px solid #bbb}.label>div{flex:1;min-width:0}.label b,.label strong,.label span{display:block;font-size:9pt}.label small{font-size:5.5pt;overflow-wrap:anywhere}.label svg{width:21mm;height:21mm;flex-shrink:0}@media print{.tools{display:none}body{background:white}.label{border:0}}</style></head><body><div class="tools"><h1>UMMA Market</h1><p>Этикетки ${job.width_mm} × ${job.height_mm} мм. Выберите принтер в системном диалоге. На телефоне также доступна команда печати в меню браузера.</p><button type="button" onclick="window.print()">Печатать</button><p id="fit"></p></div>${cards}<script>if([...document.querySelectorAll('.label')].some(e=>e.scrollHeight>e.clientHeight+1)){document.getElementById('fit').textContent='Текст не помещается. Вернитесь в приложение и увеличьте размер этикетки.';document.querySelector('button').disabled=true;}</script></body></html>`;
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
 }catch{return new Response('Ссылка на этикетки недействительна, истекла или доступ отозван. Откройте печать в UMMA Market ещё раз.',{status:403,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
}
