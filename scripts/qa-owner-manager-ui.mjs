import {JSDOM} from "jsdom";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";

const source=readFileSync("staff.html","utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"");
const dom=new JSDOM(source,{runScripts:"outside-only",url:"https://qa.invalid/staff.html?work=owner-manager"});
const {window:w}=dom;
const root=w.document.getElementById("webOwnerManager");
const requests=[];
const data={role:"owner",mode:"A",days:7,stock:[{id:"rice",name_ru:"Рис",base_unit:"kg",item_type:"raw_material",quantity:22,kitchen:0}],
  history:[],norms:[],recipes:[],reorder:[],menuLinks:[],flows:[],sales:{portions:0,grossLineRevenue:0,knownCost:0,unpricedPortions:0},
  valuation:{knownValue:550000,unpriced:0}};
const button=name=>[...root.querySelectorAll("button")].find(el=>el.textContent===name);
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));

try{
  w.ummaStaffAuth={credential:()=>"web:qa",actorId:()=>10};
  w.AbortSignal=AbortSignal;
  let lost=false;
  w.fetch=async(_url,options)=>{
    assert.equal(options.headers["x-umma-staff"],"web:qa");
    const request=JSON.parse(options.body);
    requests.push(request);
    if(request.action==="interpret") return Response.json({ok:true,draft:{kind:"purchase",source:"text",lines:[
      {itemId:"rice",label:"Gạo <img src=x onerror=alert(1)>",quantity:20,unit:"kg",unitCost:25000,uncertain:true},
    ]}});
    if(request.action==="post"){
      if(!lost){lost=true;throw Error("Связь прервалась");}
      return Response.json({ok:true,data:{kind:"purchase",total:500000}});
    }
    return Response.json({ok:true,data});
  };
  root.ummaLocations=[{id:"cafe",name:"HALAL UMMA"}];
  root.hidden=false;
  w.eval(readFileSync("js/cafe/owner-manager.js","utf8"));
  await tick();
  assert.match(root.textContent,/550[\s\u00a0]000/);
  root.querySelector("textarea").value="20 кг риса";
  button("Разобрать").click();
  await tick();
  assert.match(root.querySelector(".owner-review").textContent,/onerror/);
  assert.equal(root.querySelector('img[src="x"]'),null);
  button("Провести").click();
  assert.equal(requests.filter(r=>r.action==="post").length,0);
  const confirm=root.querySelector('input[type="checkbox"]');
  assert.ok(confirm);
  confirm.checked=true;
  button("Провести").click();
  await tick();
  button("Проверить и повторить проведение").click();
  await tick();
  const posts=requests.filter(r=>r.action==="post");
  assert.equal(posts.length,2);
  assert.deepEqual(posts[0],posts[1]);
  assert.match(root.querySelector('[role="status"]').textContent,/500[\s\u00a0]000/);
  button("Инвентаризация").click();
  const picker=button("Провести").closest("form").querySelector("select");
  picker.value="full";
  picker.dispatchEvent(new w.Event("change",{bubbles:true}));
  assert.equal(root.querySelectorAll(".owner-line").length,2);
  console.log("PASS owner UI: inventory, safe invoice review, explicit confirmation and exact network replay.");
} finally {w.close();}
