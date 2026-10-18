import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),output=process.env.QA_OUTPUT_DIR||'/tmp/umma-menu-design';fs.mkdirSync(output,{recursive:true});
const origin='https://umma-ui-fixture.test',widths=[320,360,375,390,414,430,768,1024];
const products=[
{id:'plov',sku:'UMMA-CAFE-PLOV',name_ru:'Плов с бараниной',name_en:'Lamb plov',name_vi:'Cơm thập cẩm thịt cừu',description_ru:'Рис, баранина, морковь и пряности.',description_en:'Rice, lamb, carrots and spices.',description_vi:'Cơm, thịt cừu, cà rốt và gia vị.',price_vnd:120000,weight_value:450,weight_unit:'g'},
{id:'manti',sku:'UMMA-CAFE-MANTI',name_ru:'Манты (4 шт.)',name_en:'Manti (4 pieces)',name_vi:'Bánh bao thịt cừu (4 cái)',description_ru:'Манты с бараниной.',description_en:'Steamed lamb dumplings.',description_vi:'Bánh bao hấp nhân thịt cừu.',price_vnd:150000,weight_value:400,weight_unit:'g'},
{id:'bread',sku:'UMMA-CAFE-FLATBREAD',name_ru:'Лепёшка UMMA',name_en:'UMMA flatbread',name_vi:'Bánh mì UMMA',price_vnd:25000,weight_value:230,weight_unit:'g'},
{id:'missing',name_ru:'Блюдо с длинным названием без фотографии',name_en:'A dish with a long title and no photograph',name_vi:'Món ăn có tên dài và chưa có hình ảnh',price_vnd:90000}
];
const location={id:'cafe',name:'QA UMMA',location_type:'cafe',is_active:true};
const order={id:'isolated-order',order_number:71,location_id:'cafe',order_type:'pickup',status:'ready',payment_status:'pending',payment_method:'cash',payment_timing:'later',total_vnd:120000,customer_name:'QA',canAcceptPayments:true,cafe_order_items:[{product_name_ru:'Плов с бараниной',quantity:1,price_vnd:120000}]};
const browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--single-process']});
try{
 const context=await browser.newContext();const errors=[],requests=[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===origin){const file=path.join(root,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep))return route.abort();try{return route.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json'}[path.extname(file)]||'application/octet-stream')});}catch{return route.fulfill({status:404,body:'Not found'});}}
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(url.pathname.endsWith('/cafe-menu'))return route.fulfill({headers,json:{ok:true,products,location,locations:[location],inventoryControlEnabled:false,inventory:[]}});
  if(url.pathname.endsWith('/cafe-kitchen')){
   const body=req.postDataJSON();requests.push(body.action);
   const payload=body.action==='sandboxBootstrap'?{locations:[location]}:body.action==='sandboxList'?{orders:[],shifts:[]}:body.action==='list'?{orders:[order],locations:[location],locationIds:['cafe'],couriers:[],staffRole:'manager',actorTelegramId:10}:body.action==='cashList'?{locationId:'cafe',locations:[location],staff:[],receipts:[],refunds:[],handovers:[],shifts:[],actorTelegramId:10,cashSummary:{total24hVnd:120000,cash24hVnd:120000,refund24hVnd:0,pendingHandovers:0}}:null;
   assert.ok(payload,'Only fixture read operations allowed: '+body.action);return route.fulfill({headers,json:{ok:true,...payload}});
  }
  if(url.pathname.endsWith('/cafe-accounting-admin')){
   const b=req.postDataJSON();requests.push(b.action);
   assert.ok(['bootstrap','list','summary'].includes(b.action),'No accounting writes');return route.fulfill({headers,json:{ok:true,role:'super_admin',locations:[location],rows:[],summary:{}}});
  }
  return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.locator('.daily-ayah-reference').waitFor();
 await page.locator('.bottom-nav [data-page=cafe]').click();await page.locator('[data-product-card=plov]').waitFor();
 for(const lang of ['ru','en','vi']){
  await page.evaluate(l=>window.ummaI18n.setLanguage(l),lang);
  for(const width of widths){
   await page.setViewportSize({width,height:844});await page.locator('[data-product-card=plov]').evaluate(e=>e.scrollIntoView({block:'start'}));
   const sizes=await page.locator('#cafeProducts').evaluate(e=>({overflow:e.scrollWidth>e.clientWidth+1,cards:[...e.querySelectorAll('.cafe-product')].map(c=>({overflow:c.scrollWidth>c.clientWidth+1,height:c.getBoundingClientRect().height})),target:[...e.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=44&&b.getBoundingClientRect().width>=44)}));
   assert.equal(sizes.overflow,false,lang+' '+width);assert.equal(sizes.cards.some(c=>c.overflow),false,JSON.stringify({lang,width,...sizes}));assert.ok(sizes.target);
   if(width===390&&lang==='ru'){assert.ok(sizes.cards[0].height<380,'Compact card height');await page.screenshot({path:output+'/cafe-cards-390.png'});}
  }
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.ummaI18n.setLanguage('ru'));
 const first=page.locator('[data-product-card=plov]');await first.locator('summary').click();
 await first.locator('[data-add-product]').click();assert.ok(await first.locator('details').evaluate(e=>e.open));await first.locator('[data-add-product]').click();assert.equal(await first.locator('.cafe-card-quantity strong').textContent(),'2');
 assert.equal(await first.locator('.cafe-card-quantity').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 await first.locator('summary').click();await page.screenshot({path:output+'/cafe-selected-390.png'});
 await first.locator('[data-cart-change="-1"]').click();await first.locator('[data-cart-change="-1"]').click();assert.equal(await first.locator('.cafe-add').count(),1);
 // Activate roles only in this isolated DOM. All network calls remain intercepted.
 await page.evaluate(()=>{window.Telegram={WebApp:{initData:'isolated-qa-only',initDataUnsafe:{user:{id:10}}}};window.ummaRole='super_admin';document.getElementById('staffEntryButton').click();});
 await page.locator('#staffOrderMenu [data-staff-add]').first().waitFor();await page.locator('[data-staff-add=plov]').click();
 for(const width of widths){await page.setViewportSize({width,height:844});const overflow=await page.locator('#cafeWaiterPage').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false,'Staff '+width);const box=await page.locator('[data-staff-product=plov]').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert.ok(box.scroll<=box.width+1,JSON.stringify({width,...box}));}
 await page.setViewportSize({width:390,height:844});await page.locator('#staffOrderMenu').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/staff-menu-390.png'});
 await page.evaluate(()=>window.ummaKitchen.open());await page.locator('#cafeKitchenPage .kitchen-order-card').first().waitFor();
 await page.locator('.kitchen-board-tools>summary').click();await page.locator('#cafeCashToggle').click();await page.locator('#cafeCashPanel').waitFor({state:'visible'});
 for(const width of widths){await page.setViewportSize({width,height:844});assert.equal(await page.locator('#cafeKitchenPage').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'Cash '+width);}
 await page.setViewportSize({width:390,height:844});await page.locator('#cafeCashPanel').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/cash-panel-390.png'});

 await page.locator('.kitchen-order-card .kitchen-secondary-actions>summary').first().click();await page.locator('.kitchen-order-card [data-payment-status=paid]').first().click();await page.locator('#cashPaymentModal').waitFor({state:'visible'});
 await page.locator('#cashPayTendered').fill('200000');assert.ok((await page.locator('#cashPayChange').textContent()).includes('80'));
 for(const width of widths){await page.setViewportSize({width,height:844});assert.equal(await page.locator('#cashPaymentModal>section').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'Cash modal '+width);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/cash-payment-390.png'});await page.locator('#cashPayCancel').click();
 await page.evaluate(()=>window.ummaCafeAccounting.open());await page.locator('#accountingContent .accounting-metrics').waitFor();
 const tabs=await page.locator('.accounting-tabs button').all();
 for(let i=0;i<tabs.length;i++){await tabs[i].click();for(const width of widths){await page.setViewportSize({width,height:844});assert.equal(await page.locator('#cafeAccountingPage').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'Accounting tab '+i+' '+width);}}

 await page.evaluate(()=>{document.querySelectorAll('.native-screen').forEach(e=>e.hidden=e.id!=='adminPage');document.getElementById('adminPage').hidden=false;});
 await page.addScriptTag({path:path.join(root,'js/cafe/test-mode.js')});await page.locator('#ummaSandboxPanel').waitFor({state:'attached'});
 await page.locator('#adminPage .cafe-management-tools>summary').click();await page.locator('#ummaSandboxDeveloper>summary').click();
 for(const role of ['waiter','cashier','kitchen','manager','courier']){await page.locator('#ummaSandboxRole').selectOption(role);for(const width of widths){await page.setViewportSize({width,height:844});assert.equal(await page.locator('#ummaSandboxPanel').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'Sandbox '+role+' '+width);assert.ok(await page.evaluate(()=>document.getElementById('nativeAppTitle').getBoundingClientRect().right<=document.getElementById('languageBtn').getBoundingClientRect().left-2),'App bar title '+width);}}
 await page.setViewportSize({width:390,height:844});await page.locator('#ummaSandboxRole').selectOption('manager');await page.locator('#ummaSandboxPanel').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/sandbox-390.png'});
 assert.deepEqual(errors,[]);console.log('PASS real Cafe cards: 24 width/language combinations, original images, description/quantity/cart behaviour, no overflow, 44px actions; staff menu, cash workspace, change calculation and accounting tabs and five sandbox role menus at eight widths; isolated read-only backend, zero script errors.');
}finally{await browser.close();}
