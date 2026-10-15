export async function dispatchCourierQueue(client: any, botToken: string, send: typeof fetch = fetch) {
  const gate=await client.rpc('is_cafe_courier_dispatch_enabled',{});if(gate.error)throw new Error('Courier dispatch state unavailable');if(gate.data!==true)return {ok:true,paused:true,processed:0};
  const advanced=await client.rpc('advance_cafe_courier_queue',{});if(advanced.error)throw new Error(advanced.error.message);
  const leased=await client.rpc('lease_cafe_courier_notifications',{});if(leased.error)throw new Error(leased.error.message);
  await Promise.all((leased.data||[]).map(async(job:any)=>{
    let success=false,error='';
    try{const reply=await send('https://api.telegram.org/bot'+botToken+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:job.courierId,text:'UMMA Cafe · Доставка №'+job.orderNumber+'\nЗабрать: '+job.locationName+'\n'+(job.ready?'Заказ готов.':'Заказ готовится.')+'\nОткройте Mini App → Кухня → Предложения доставок. Кто первым подтвердит, получит заказ.',reply_markup:{inline_keyboard:[[{text:'Открыть UMMA Global',url:'https://t.me/UmmaGlobalBot'}]]}}),signal:AbortSignal.timeout(8000)});success=reply.ok&&(await reply.json()).ok===true;if(!success)error='Telegram rejected notification';}
    catch(e){error=e instanceof Error?e.message:'Notification failed';}
    const finished=await client.rpc('finish_cafe_courier_notification',{p_offer:job.offerId,p_success:success,p_error:error});if(finished.error)throw new Error(finished.error.message);
  }));
  return {ok:true,processed:(leased.data||[]).length};
}
export async function uploadDeliveryProof(client:any, actor:number, body:any){
 if(typeof body.orderId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.orderId)||typeof body.requestKey!=='string'||!/^[0-9a-f-]{36}$/i.test(body.requestKey)||!['pickup','handover'].includes(body.kind)||typeof body.imageBase64!=='string'||body.imageBase64.length>11200000)throw new Error('Invalid delivery photo');
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(body.imageBase64),c=>c.charCodeAt(0));}catch{throw new Error('Invalid delivery photo');}
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
 if(bytes.length<512||bytes.length>8388608||(!jpeg&&!png))throw new Error('Use JPEG or PNG photo up to 8 MB');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 const prepared=await client.rpc('begin_cafe_delivery_proof',{p_order_id:body.orderId,p_actor:actor,p_key:body.requestKey,p_kind:body.kind,p_sha:hash,p_mime:jpeg?'image/jpeg':'image/png',p_size:bytes.length});if(prepared.error)throw new Error(prepared.error.message);
 const proof=prepared.data.proof;
 if(!proof.verified_at){
  const bucket=client.storage.from('cafe-delivery-evidence');
  const saved=await bucket.upload(proof.object_path,bytes,{contentType:jpeg?'image/jpeg':'image/png',upsert:false});
  if(saved.error){
   // A lost upload response can still mean the object exists. Verify the exact bytes before confirming.
   const existing=await bucket.download(proof.object_path);if(existing.error||!existing.data)throw new Error('Photo upload not confirmed; retry the same photo');
   const priorHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await existing.data.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');
   if(priorHash!==hash)throw new Error('Existing delivery photo differs; contact manager');
  }
 }
 const confirmed=await client.rpc('confirm_cafe_delivery_proof',{p_id:proof.id,p_actor:actor});if(confirmed.error)throw new Error(confirmed.error.message);
 return {ok:true,proof:confirmed.data.proof,order:confirmed.data.order};
}
