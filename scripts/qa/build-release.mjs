import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
const directory='supabase/release';mkdirSync(directory,{recursive:true});
const files=['cafe-lifecycle-hardening.sql','cafe-courier-workflow.sql','cafe-delivery-tracking.sql','cafe-self-courier.sql','cafe-order-idempotency.sql','cafe-cash-summary.sql','cafe-delivery-hardening.sql','cafe-refunds.sql'];
const bundle='-- Reviewable release proposal. NOT deployed. One atomic transaction.\nBEGIN;\n'+files.map(name=>'\n-- '+name+'\n'+readFileSync('supabase/proposals/'+name,'utf8').replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'')).join('\n')+'\nCOMMIT;\n';
writeFileSync(directory+'/cafe-launch.sql',bundle);
for(const [slug,path] of [['create-cafe-order','supabase/functions/create-cafe-order/index.ts'],['cafe-kitchen','supabase/functions/cafe-kitchen/index.ts']]){
 const text=readFileSync(path,'utf8');const marker='const body = await req.json();';if(!text.includes(marker))throw Error('Body marker missing: '+slug);
 const guard=slug==='create-cafe-order'?'return response({ok:false,error:"Приём заказов временно приостановлен. Обратитесь к сотруднику кафе."},503);':'if(!["list","cashList"].includes(body.action))return response({ok:false,error:"Изменения временно приостановлены. Обратитесь к администратору."},503);';
 mkdirSync(directory+'/maintenance/'+slug,{recursive:true});writeFileSync(directory+'/maintenance/'+slug+'/index.ts',text.replace(marker,marker+'\n    '+guard));
}
console.log('Prepared atomic SQL and maintenance handlers; no deployment performed');

mkdirSync(directory+'/maintenance/_shared',{recursive:true});copyFileSync('supabase/functions/_shared/order-operation.ts',directory+'/maintenance/_shared/order-operation.ts');
for(const name of ['order-list.ts','sandbox-policy.ts'])copyFileSync('supabase/functions/cafe-kitchen/'+name,directory+'/maintenance/cafe-kitchen/'+name);

copyFileSync('supabase/functions/_shared/courier-workflow.ts',directory+'/maintenance/_shared/courier-workflow.ts');
