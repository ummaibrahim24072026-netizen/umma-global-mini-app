import {createRequire} from 'node:module';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),output=process.env.QA_OUTPUT_DIR||'/tmp/umma-home-qa';fs.mkdirSync(output,{recursive:true});const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));try{const data=fs.readFileSync(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png'}[path.extname(file)]||'application/octet-stream'));res.end(data)}catch{res.statusCode=404;res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--single-process']});
const results=[];
try{const context=await browser.newContext();await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('umma-language','ru');});
await page.goto(base);await page.locator('.daily-ayah-reference').waitFor();

// Display the real screen DOM in an isolated local browser. No account or writes.
const scenes=['adminPage','adminUsersPage','locationAdminPage','cafeProductsAdminPage','cafeStaffAdminPage','cafeWaiterPage','cafeKitchenPage','cafeInventoryPage','cafePage','cafeOrdersPage','cafeAccountingPage','servicesPage'];
const widths=[320,360,375,390,414,430,768,1024];
for(const lang of ['ru','en','vi']){
 await page.evaluate(l=>window.ummaI18n.setLanguage(l),lang);
 for(const id of scenes){
  await page.evaluate(id=>{document.querySelectorAll('.native-screen').forEach(e=>e.hidden=e.id!==id);document.getElementById(id).hidden=false;document.getElementById(id).scrollTop=0;},id);
  await page.waitForTimeout(50);
  for(const width of widths){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(80);
   const info=await page.locator('#'+id).evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,overflow:e.scrollWidth>e.clientWidth+1,heading:!!e.querySelector('h1'),offenders:[...e.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>e.getBoundingClientRect().right+1).slice(0,8).map(n=>[n.tagName,n.id,n.className,Math.round(n.getBoundingClientRect().width)])}));
   results.push({lang,id,width,...info});assert.equal(info.overflow,false,JSON.stringify({lang,id,width,...info}));
   if(width===390&&lang==='ru')await page.screenshot({path:output+'/'+id+'.png'});
  }
 }
}

// Isolated read-only Market responses exercise the actual dynamic screen renderers.
const warehouse={id:'22222222-2222-4222-8222-222222222222',name:'QA',city:'Nha Trang',location_id:'11111111-1111-4111-8111-111111111111',location:{city:'Nha Trang'}};
await page.route('**/functions/v1/market-stock',async route=>{
 const {action}=route.request().postDataJSON();
 const catalogue={ok:true,warehouses:[warehouse],categories:[],offers:[]};
 const payload=action==='catalog'||action==='b2b_catalog'?catalogue:action==='bootstrap'?{ok:true,isSuperAdmin:true,roles:[],warehouses:[warehouse],locations:[]}:action==='snapshot'?{ok:true,roles:['admin'],financial:true,warehouse,categories:[],variants:[],batches:[],units:[],documents:[],counts:[],suppliers:[]}:null;
 assert.ok(payload,'Only read-only fixture requests are allowed: '+action);
 await route.fulfill({json:payload});
});
for(const lang of ['ru','en','vi']){
 await page.evaluate(l=>window.ummaI18n.setLanguage(l),lang);
 for(const [id,method] of [['marketShopPage','market'],['marketPage','warehouse'],['b2bPage','b2b']]){
  await page.evaluate(async method=>{if(method==='market')await window.ummaMarket.open();else if(method==='warehouse')await window.ummaMarket.openWarehouse();else await window.ummaB2B.open();},method);
  await page.locator('#'+id+' .umma-page-emblem.artwork-ready').waitFor();
  for(const width of widths){await page.setViewportSize({width,height:844});await page.waitForTimeout(60);const overflow=await page.locator('#'+id).evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false,id+' '+lang+' '+width);results.push({lang,id,width,overflow});}
  await page.setViewportSize({width:390,height:844});if(lang==='ru')await page.screenshot({path:output+'/'+id+'.png'});
 }
}

await page.evaluate(()=>{document.querySelectorAll('.native-screen').forEach(e=>e.hidden=true);});
await page.evaluate(()=>window.ummaNativeShell.openService('education'));
await page.locator('.native-service-dialog .umma-page-emblem.artwork-ready').waitFor();
await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/education.png'});
assert.equal(await page.locator('.native-service-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);

await page.locator('.native-service-dialog .cafe-back').click();
await page.evaluate(()=>window.ummaI18n.setLanguage('ru'));
for(const sheet of ['language','notifications','chat','tracking']){
 if(sheet==='language')await page.locator('#languageBtn').click();
 if(sheet==='notifications')await page.evaluate(()=>document.getElementById('cafeNotificationBell').click());
 if(sheet==='chat')await page.evaluate(()=>window.ummaDeliveryChat.open('isolated-qa-order'));
 if(sheet==='tracking')await page.evaluate(()=>{const b=document.createElement('button');b.dataset.trackDelivery='isolated-qa-order';document.body.append(b);b.click();b.remove();});
 const selector={language:'.umma-language-dialog',notifications:'.cafe-notifications-dialog',chat:'.delivery-chat-dialog',tracking:'.delivery-tracking-dialog'}[sheet];
 await page.locator(selector).waitFor();
 for(const width of widths){await page.setViewportSize({width,height:844});await page.waitForTimeout(40);assert.equal(await page.locator(selector).evaluate(e=>e.scrollWidth>e.clientWidth+1),false,sheet+' '+width);}
 if(sheet==='tracking')assert.notEqual(await page.locator('.delivery-tracking-header button').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/'+sheet+'.png'});
 await page.evaluate(sheet=>{if(sheet==='chat')window.ummaDeliveryChat.close();else if(sheet==='tracking')window.ummaCourierTracking.close();else document.querySelector('dialog[open]').close();},sheet);
}

assert.deepEqual(errors,[]);fs.writeFileSync(output+'/all-pages-results.json',JSON.stringify(results,null,2));
console.log('PASS 15 application screens x 8 widths x 3 languages; planned service artwork and four real sheet renderers; no horizontal overflow or JavaScript errors. Local isolated DOM preview, no live transactions.');
}finally{await browser.close();server.close();}
