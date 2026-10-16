import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import {parseVcb} from './parser.mjs';
import {dispatchCustomerNotifications} from '../_shared/customer-notifications.ts';
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply({ok:false},405);
 try{
  const raw=await req.text();if(raw.length>16000)return reply({ok:false},413);
  const body=JSON.parse(raw);
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  if(body.action==='pair'){
   if(!/^[A-F0-9]{32}$/.test(body.code||'')||!/^[a-f0-9]{64}$/.test(body.token||''))return reply({ok:false},400);
   const r=await client.rpc('umma_pay_pair',{p_activation_hash:await hash(body.code),p_token_hash:await hash(body.token)});
   return r.error?reply({ok:false,error:'Код неверен, истёк или уже использован'},403):reply({ok:true,...r.data});
  }
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
  if(!/^[a-f0-9]{64}$/.test(token))return reply({ok:false},401);
  const tokenHash=await hash(token);
  const d=await client.rpc('umma_pay_device',{p_token_hash:tokenHash});
  if(d.error)throw Error('Device lookup failed');if(!d.data)return reply({ok:false},401);
  if(body.action==='health')return reply({ok:true,account:d.data.account});
  if(body.packageName!=='com.VCB'||typeof body.text!=='string'||body.text.length>12000||typeof body.eventKey!=='string'||body.eventKey.length>256||!Number.isSafeInteger(body.postedAt))return reply({ok:false},400);
  const parsed=parseVcb(body.text,d.data.account);
  const r=await client.rpc('umma_pay_ingest',{p_token_hash:tokenHash,p_event_key:body.eventKey,p_text_hash:await hash(body.text),p_text:body.text,p_posted_at:new Date(body.postedAt).toISOString(),p_amount:parsed?.amount??null,p_number:parsed?.orderNumber??null});
  if(r.error)throw Error('Payment transaction failed');
  // Durable inbox is committed first; failed Telegram delivery is retried by the existing worker.
  const bot=Deno.env.get('TELEGRAM_BOT_TOKEN');if(bot)try{await dispatchCustomerNotifications(client,bot);}catch{console.error('Payment notification delivery deferred');}
  return reply(r.data);
 }catch{return reply({ok:false,error:'Сервер не принял уведомление. Повторяем отправку.'},500);}
});
