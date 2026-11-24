import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';

const root=process.cwd();
const db=new PGlite();
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.locations(id uuid PRIMARY KEY);
 CREATE TABLE public.products(id uuid PRIMARY KEY, product_type text, is_active boolean, catalog_preview boolean);
 GRANT SELECT ON public.products TO service_role;
`);
await db.exec(fs.readFileSync('supabase/proposals/cafe-web-storefront.sql','utf8'));
const cafe='e22788bd-4734-4b3a-911e-ba103d52617a';
const manti='3e5d4abc-0000-4000-8000-000000000001';
const plov='3e5d4abc-0000-4000-8000-000000000002';
const batch='4e5d4abc-0000-4000-8000-000000000001';
const inserts=`
 INSERT INTO locations VALUES ('${cafe}');
 INSERT INTO products VALUES ('${manti}', 'cafe', true, false), ('${plov}', 'cafe', true, false);
 INSERT INTO cafe_web_sections(location_id,product_id,section,enabled,service_date)
 VALUES ('${cafe}','${manti}','lunch',true,null),
        ('${cafe}','${manti}','daily',false,null),
        ('${cafe}','${plov}','dish-day',true,'2000-01-01');
`;
await db.exec(inserts);
const query='select cafe_web_section_catalog($1) as sections';
await db.exec('SET ROLE service_role');
assert.deepEqual((await db.query(query,[cafe])).rows[0].sections,[{productId:manti,section:'lunch',allowPreorder:false}]);
await db.exec('SET ROLE anon');
await assert.rejects(db.query(query,[cafe]),/permission denied/);
await assert.rejects(db.query('SELECT * FROM cafe_web_sections'),/permission denied/);
await db.exec('RESET ROLE');
await assert.rejects(db.exec(`
 INSERT INTO cafe_web_sections(location_id,product_id,section,starts_at)
 VALUES ('${cafe}','${manti}','breakfast','09:00')
`),/check constraint/);
await db.close();
console.log('PASS storefront SQL: date, enabled, time-window validation and service-only access.');

const html=fs.readFileSync('menu/index.html','utf8');
const script=name=>fs.readFileSync('js/cafe/'+name+'.js','utf8');
const products=[
  {id:manti,sku:'UMMA-CAFE-MANTI',name_ru:'Манты с мясом',name_en:'Meat manti',price_vnd:150000,weight_value:400,weight_unit:'g',stockManaged:true,available:3,plannedQuantity:10,plannedAvailable:7,plannedReadyAt:new Date(Date.now()+3600000).toISOString(),planRevision:batch},
  {id:plov,sku:'UMMA-CAFE-PLOV',name_ru:'Плов с бараниной',price_vnd:120000,stockManaged:true,available:4},
];
const market={ok:true,categories:[{id:'meat',name_ru:'Мясо',name_en:'Meat'},{id:'empty',name_ru:'Овощи',name_en:'Vegetables'}],offers:[
  {warehouse_id:'demo',variant_id:'chicken',price_vnd:129000,sale_mode:'individual_weight',measure:'g',units:[{quantity:500,price_vnd:64500,expires_on:'2030-11-25'}],product:{id:'chicken',category_id:'meat',name_ru:'Куриное филе',name_en:'Chicken fillet',description_ru:'Порция для домашнего приготовления',image_url:'assets/market/chicken-fillet.webp'}},
  {warehouse_id:'demo',variant_id:'tomato',price_vnd:20000,sale_mode:'piece',measure:'piece',available_quantity:0,product:{id:'tomato',category_id:'empty',name_ru:'Помидоры'}},
]};
const config={ok:true,marketPreviewEnabled:true,sections:[
  {section:'lunch',productId:manti,allowPreorder:false},
  {section:'breakfast',productId:'missing',allowPreorder:false},
  {section:'daily',productId:manti,allowPreorder:false},
]};

let marketUnavailable=false;
const dom=new JSDOM(html,{
  url:'https://umma-storefront.test/menu/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(window){
    window.AbortSignal=AbortSignal;
    window.localStorage.setItem('umma-menu-language','ru');
    window.eval(script('public-menu-i18n'));
    window.fetch=async url=>{
      const request=new URL(url);
      const ok=!(marketUnavailable&&request.searchParams.has('marketCatalog'));
      const data=request.searchParams.has('storefront')?config:
        request.searchParams.has('marketCatalog')?market:{ok:true,products,locations:[]};
      return {ok,json:async()=>data};
    };
  }
});
try{
  const {window}=dom;
  const d=window.document;
  window.eval(script('product-photo'));
  window.eval(script('public-menu-carousel'));
  window.eval(script('public-storefront'));
  const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
  const opts={
    endpoint:'https://umma.test/menu',
    t:window.ummaMenuI18n.t,name:p=>window.ummaMenuI18n.field(p,'name'),
    description:p=>window.ummaMenuI18n.field(p,'description'),
    money:n=>String(n),num:String,photo:window.ummaCafeProductPhoto,
    onSwitch:()=>{},onConfig:()=>{},
  };
  const controller=window.ummaPublicStorefront.create(opts);
  controller.start();
  await tick();
  assert.equal(d.getElementById('storefrontSwitch').hidden,false);
  d.querySelector('[data-storefront=market]').click();
  await tick();
  assert.equal(controller.active,true);
  assert.equal(d.querySelectorAll('.storefront-market-offer').length,1);
  assert.equal(d.querySelector('[data-market-category=empty]'),null);
  assert.match(d.querySelector('.storefront-market-offer').textContent,/500 г · 64500/);
  controller.search('нет такого товара');
  assert.equal(d.querySelector('.storefront-market-offer'),null);
  controller.search('');
  marketUnavailable=true;
  window.dispatchEvent(new window.Event('online'));
  await tick();
  assert.ok(d.querySelector('[data-market-retry]'));
  assert.ok(d.querySelector('.storefront-market-offer'));
  config.marketPreviewEnabled=false;
  window.dispatchEvent(new window.Event('online'));
  await tick();
  assert.equal(controller.active,false);
  assert.equal(d.getElementById('storefrontSwitch').hidden,true);
  config.marketPreviewEnabled=true;
}finally{
  dom.window.close();
}
console.log('PASS storefront DOM: MARKET gate, real offer semantics, search, and preserving offers during a failed refresh.');

const browserModule=process.env.PLAYWRIGHT_MODULE;
if(browserModule){
  const {chromium}=createRequire(import.meta.url)(browserModule);
  const output=process.env.QA_OUTPUT_DIR;
  if(output)fs.mkdirSync(output,{recursive:true});
  const origin='https://umma-storefront.test';
  const browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ru-RU',serviceWorkers:'block'});
    let enabled=true, marketFailure=false, failCafe=false;
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===origin){
        const file=path.resolve(root,'.'+(url.pathname==='/menu/'?'/menu/index.html':url.pathname));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
        return route.fulfill({path:file});
      }
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.pathname.endsWith('/cafe-menu'))return route.fulfill({headers,json:{ok:true,products,locations:[]}});
      if(url.pathname.endsWith('/cafe-guest-order')&&request.method()==='GET'){
        if(url.searchParams.has('catalog'))return route.fulfill({headers,status:failCafe?503:200,json:{ok:!failCafe,products}});
        if(url.searchParams.has('storefront'))return route.fulfill({headers,json:{ok:true,marketPreviewEnabled:enabled,sections:config.sections}});
        if(url.searchParams.has('marketCatalog'))return route.fulfill({headers,status:marketFailure?503:200,json:market});
      }
      return route.fulfill({headers,json:{ok:true}});
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/menu/');
    await page.locator('#cafeSections [data-cafe-section=cooking]').waitFor();
    await page.locator('#storefrontSwitch').waitFor();
    assert.equal(await page.locator('#menuHeading').innerText(),'Меню');
    assert.equal(await page.locator('[data-cafe-section=breakfast]').count(),0);
    assert.equal(await page.locator('#products [data-card]').count(),2);
    await page.locator('[data-cafe-section=daily]').click();
    assert.equal(await page.locator('#products .cafe-preorder-card').count(),0);
    await page.locator('[data-cafe-section=cooking]').click();
    assert.equal(await page.locator('#products [data-card]').count(),1);
    assert.match(await page.locator('#products [data-card]').innerText(),/В наличии: 3[\s\S]*Предзаказать/);
    if(output)await page.screenshot({path:path.join(output,'umma-cafe.png'),fullPage:false});
    await page.locator('#products [data-dish].dish-link').click();
    await page.locator('#dishDetails .cafe-preorder-action').click();
    assert.equal(await page.locator('#cartCount').innerText(),'1');
    if(output)await page.screenshot({path:path.join(output,'umma-preorder.png'),fullPage:false});
    await page.locator('#dishDetails .close').click();
    await page.reload();
    await page.locator('#products [data-card]').first().waitFor();
    assert.equal(await page.locator('#cartCount').innerText(),'1');

    await page.locator('[data-storefront=market]').click();
    await page.locator('#marketProducts .storefront-market-offer').waitFor();
    assert.equal(await page.locator('#menuHeading').innerText(),'Каталог');
    assert.equal(await page.getByRole('button',{name:'Овощи',exact:true}).count(),0);
    assert.equal(await page.locator('#cartCount').innerText(),'1');
    await page.locator('#marketProducts summary').click();
    assert.match(await page.locator('#marketProducts details').innerText(),/500 г/);
    if(output)await page.screenshot({path:path.join(output,'umma-market.png'),fullPage:false});
    for(const width of [320,375,390,430,768,1024]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Viewport overflow at '+width);
    }
    marketFailure=true;
    await page.evaluate(()=>dispatchEvent(new Event('online')));
    await page.getByText('Не удалось обновить каталог').waitFor();
    assert.equal(await page.locator('#marketProducts .storefront-market-offer').count(),1);
    marketFailure=false;
    await page.locator('[data-market-retry]').click();
    await page.getByText('Не удалось обновить каталог').waitFor({state:'hidden'});
    enabled=false;
    await page.evaluate(()=>dispatchEvent(new Event('online')));
    await page.locator('#storefrontSwitch').waitFor({state:'hidden'});
    assert.equal(await page.locator('#menuHeading').innerText(),'Меню');
    assert.equal(await page.locator('#cartCount').innerText(),'1');
    failCafe=true;
    await page.reload();
    await page.getByText('Не удалось загрузить меню.',{exact:false}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS storefront Chromium: CAFE sections, preorder, saved cart, MARKET weight and hidden empty categories, failure recovery, preview gate and 320–1024 px.');
  }finally{
    await browser.close();
  }
}
