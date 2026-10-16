import QRCode from 'npm:qrcode@1.5.4';
const encoder = new TextEncoder();
async function key(secret: string, usages: KeyUsage[]) {
  return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,usages);
}
export async function qrDownloadUrl(payment: {qrPayload:string;orderNumber:string}, secret:string, base:string) {
  const data=btoa(JSON.stringify({qr:payment.qrPayload,number:payment.orderNumber,expires:Math.floor(Date.now()/1000)+300})).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const signature=await crypto.subtle.sign('HMAC',await key(secret,['sign']),encoder.encode('umma-qr-download:'+data));
  const sig=Array.from(new Uint8Array(signature),n=>n.toString(16).padStart(2,'0')).join('');
  return base+'/functions/v1/cafe-my-orders?qr='+data+'&sig='+sig;
}
export async function qrDownloadResponse(req:Request, secret:string) {
  const headers={'Access-Control-Allow-Origin':'*','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  try {
    const url=new URL(req.url),data=url.searchParams.get('qr')||'',sig=url.searchParams.get('sig')||'';
    if(!/^[A-Za-z0-9_-]{1,2000}$/.test(data)||!/^[a-f0-9]{64}$/.test(sig))throw Error();
    const bytes=Uint8Array.from(sig.match(/../g)!,v=>parseInt(v,16));
    if(!await crypto.subtle.verify('HMAC',await key(secret,['verify']),bytes,encoder.encode('umma-qr-download:'+data)))throw Error();
    const ticket=JSON.parse(atob(data.replaceAll('-','+').replaceAll('_','/'))),now=Math.floor(Date.now()/1000);
    if(!Number.isSafeInteger(ticket.expires)||ticket.expires<=now||ticket.expires>now+300||typeof ticket.qr!=='string'||ticket.qr.length>1000||!/^000201/.test(ticket.qr)||typeof ticket.number!=='string'||!/^[0-9A-Za-z-]{1,30}$/.test(ticket.number))throw Error();
    const png=await QRCode.toBuffer(ticket.qr,{type:'png',errorCorrectionLevel:'M',margin:4,scale:8});
    return new Response(req.method==='HEAD'?null:new Uint8Array(png),{headers:{...headers,'Content-Type':'image/png','Content-Disposition':'attachment; filename="UMMA-'+ticket.number+'.png"','Content-Length':String(png.length)}});
  }catch{return new Response('QR download link invalid or expired',{status:403,headers});}
}
