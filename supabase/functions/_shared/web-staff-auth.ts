// Only hashed opaque sessions are stored. Every request rechecks the live account and actor.
export const sha256 = async (value:string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
export async function verifyWebStaffSession(db:any, credential:string):Promise<number> {
 const token=credential.startsWith('web:')?credential.slice(4):'';
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('Web session invalid');
 const {data:s,error}=await db.from('cafe_web_sessions').select('actor_id').eq('token_hash',await sha256(token)).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(error||!s)throw Error('Web session expired');
 const [{data:a},{data:u}]=await Promise.all([
 db.from('cafe_web_accounts').select('active').eq('actor_id',s.actor_id).maybeSingle(),
 db.from('telegram_users').select('is_active').eq('telegram_id',s.actor_id).maybeSingle()]);
 if(!a?.active||!u?.is_active)throw Error('Web access revoked');
 return Number(s.actor_id);
}
