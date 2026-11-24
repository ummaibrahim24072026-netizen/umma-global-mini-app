import {readFileSync} from "node:fs";
import {stripTypeScriptTypes} from "node:module";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";

const original=readFileSync("supabase/functions/cafe-owner-manager/index.ts","utf8");
const script=stripTypeScriptTypes(original.replace(/^import .+;\r?\n/gm,""),{mode:"transform"});
const locationId=randomUUID();
const rice=randomUUID();
const calls=[];
let role="owner",handler,providerResponse="draft",upstreamCalls=0;
const dashboard={role,stock:[{id:rice,name_ru:"Рис",name_vi:"Gạo",base_unit:"kg",item_type:"raw_material"}]};
const db={
  async rpc(name,args){
    calls.push({name,args});
    if(name==="cafe_owner_dashboard") return {data:{...dashboard,role}};
    if(name==="cafe_owner_ai_quota") return {data:true};
    if(name==="cafe_owner_invoice_access") return {data:{path:locationId+"/"+args.p_hash}};
    if(name==="cafe_owner_post") return {data:{id:args.p_key,kind:"purchase",total:500000}};
    throw Error("Unexpected RPC "+name);
  },
  storage:{from(name){
    assert.equal(name,"cafe-owner-invoices");
    return {async upload(path,file,options){
      assert.equal(file.type,"image/png");
      assert.equal(options.upsert,false);
      assert.match(path,new RegExp("^"+locationId+"/[0-9a-f]{64}$"));
      calls.push({name:"storage.upload"});
      return {};
    }};
  }},
};
const fetch=async(url,options)=>{
  upstreamCalls++;
  assert.equal(options.headers.Authorization,"Bearer fixture-only");
  if(url.endsWith("/audio/transcriptions")){
    assert.equal(options.body.get("language"),"ru");
    return Response.json({text:"Привезли 20 килограммов риса по 25 тысяч"});
  }
  if(providerResponse==="quota") return Response.json({error:{code:"credit_balance_exhausted",type:"insufficient_quota"}},{status:429});
  const request=JSON.parse(options.body);
  assert.equal(request.store,false);
  if(providerResponse==="invoice") assert.match(request.input[0].content[1].image_url,/^data:image\/png;base64,/);
  const data=providerResponse==="invoice" ?
    {kind:"purchase",date:"2026-11-23",supplier:"Nhà cung cấp",number:"VN-12",total:500000,lines:[
      {itemId:rice,label:"Gạo",quantity:20,unit:"kg",unitCost:25000,lineTotal:500000},
      {itemId:"invented",label:"Unreadable",quantity:null,unit:null,uncertain:true},
    ]} : {kind:"purchase",lines:[{itemId:rice,quantity:20,unit:"kg",unitCost:25000}]};
  return Response.json({status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify(data)}]}]});
};
const Deno={serve:fn=>{handler=fn;},env:{get(key){return key==="OPENAI_API_KEY" ? "fixture-only" : "";}}};
const verifyWebStaffSession=async(_,credential)=>{
  if(credential!=="web:valid") throw Error("invalid");
  return 10;
};
new Function("Deno","createClient","verifyWebStaffSession","fetch",script)(Deno,()=>db,verifyWebStaffSession,fetch);
function request(action,fields={},file,token="web:valid"){
  const headers={"x-umma-staff":token};
  let body;
  if(file){
    body=new FormData();
    for(const [key,value] of Object.entries({action,locationId,...fields})) body.set(key,value);
    body.set("file",file,"fixture");
  }else{
    headers["Content-Type"]="application/json";
    body=JSON.stringify({action,locationId,...fields});
  }
  return handler(new Request("https://qa.invalid",{method:"POST",body,headers}));
}
assert.equal((await request("dashboard",{},null,"invalid")).status,401);
assert.equal(upstreamCalls,0);
assert.equal((await request("post",{key:randomUUID(),payload:{kind:"purchase"}})).status,400);
const voice=await (await request("voice",{language:"ru"},new Blob(["fixture"],{type:"audio/webm"}))).json();
assert.match(voice.text,/20 килограммов/);
const recognized=await (await request("interpret",{text:voice.text,source:"voice"})).json();
assert.equal(recognized.draft.source,"voice");
assert.equal(recognized.draft.lines[0].unitCost,25000);
assert.ok(!calls.some(call=>call.name==="cafe_owner_post"));
const png=new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:"image/png"});
role="kitchen";
assert.equal((await request("invoice",{},png)).status,403);
role="owner";
assert.equal((await request("invoice",{},new Blob(["wrong"],{type:"image/png"}))).status,400);
providerResponse="quota";
const quota=await request("invoice",{},png);
assert.equal(quota.status,503);
assert.match((await quota.json()).error,/Лимит/);
assert.ok(!calls.some(call=>call.name==="storage.upload"));
providerResponse="invoice";
const recognizedInvoice=await (await request("invoice",{},png)).json();
assert.equal(recognizedInvoice.draft.lines[1].itemId,"");
assert.equal(recognizedInvoice.draft.lines[1].uncertain,true);
assert.equal(recognizedInvoice.draft.lines[0].label,"Gạo");
assert.match(recognizedInvoice.draft.hash,/^[0-9a-f]{64}$/);
const key=randomUUID();
const posted=await (await request("post",{key,confirmed:true,payload:{...recognized.draft}})).json();
assert.equal(posted.data.id,key);
assert.equal(calls.filter(call=>call.name==="cafe_owner_post").length,1);
console.log("PASS owner Edge: web session, speech, Vietnamese invoice review, original upload, unknown product and explicit posting.");
