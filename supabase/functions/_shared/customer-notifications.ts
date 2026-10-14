export async function dispatchCustomerNotifications(client:any, botToken:string, send:typeof fetch=fetch) {
 const leased=await client.rpc('lease_cafe_customer_notifications',{});
 if(leased.error)throw new Error('Customer notification queue unavailable');
 await Promise.all((leased.data||[]).map(async(job:any)=>{
  let success=false,terminal=false,messageId=null,error='';
  try {
   const reply=await send('https://api.telegram.org/bot'+botToken+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:job.recipient,text:job.title,reply_markup:{inline_keyboard:[[{text:'Открыть заказ в UMMA Global',url:'https://t.me/UmmaGlobalBot'}]]}}),signal:AbortSignal.timeout(8000)});
   const result=await reply.json();success=reply.ok&&result.ok===true;messageId=success?result.result?.message_id:null;
   terminal=!success&&[400,403].includes(result.error_code);if(!success)error='Telegram rejected notification';
  }catch{error='Telegram connection failed';}
  const done=await client.rpc('finish_cafe_customer_notification',{p_id:job.id,p_lease:job.lease_id,p_success:success,p_message_id:messageId,p_error:error,p_terminal:terminal});
  if(done.error)throw new Error('Customer notification acknowledgement failed');
 }));
 return {ok:true,processed:(leased.data||[]).length};
}
