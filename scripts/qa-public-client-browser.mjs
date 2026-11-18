import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd();
const prefix='/umma-global-mini-app/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json',
  '.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith(prefix))return res.writeHead(404).end();
  const relative=decodeURIComponent(pathname.slice(prefix.length));
  const file=resolve(root,relative.endsWith('/')?relative+'index.html':relative);
  if(!file.startsWith(root+sep))return res.writeHead(404).end();
  try{
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});
    res.end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise((ready,reject)=>server.once('error',reject).listen(0,'127.0.0.1',ready));
const origin='http://127.0.0.1:'+server.address().port;
const menu=origin+prefix+'menu/';
const destination={id:'e22788bd-4734-4b3a-911e-ba103d52617a',name:'HALAL UMMA QA'};
const dish={id:'11111111-1111-4111-8111-111111111111',sku:'UMMA-CAFE-PLOV',name_ru:'Плов с бараниной',
  name_en:'Lamb pilaf',name_vi:'Cơm thịt cừu',description_ru:'Рис и ягнятина',price_vnd:120000,available:10,stockManaged:true};
const receipts=[
  {id:'receipt-199',orderNumber:199,status:'pending',paymentStatus:'pending',paymentMethod:'cash',totalVnd:120000,items:[]},
  {id:'receipt-200',orderNumber:200,status:'completed',paymentStatus:'paid',paymentMethod:'cash',totalVnd:90000,items:[]},
];
const widths=[320,360,375,390,412,430,768,1024,1440];
const languages=['ru','en','vi','ko','zh','de','fr','th','ms','id','ar','pt'];
const output=process.env.QA_OUTPUT_DIR;
let browser;
let layoutChecks=0;
const sent=[];
const voiceFiles=new Map();
try{
  browser=await chromium.launch({
    executablePath:process.env.QA_CHROMIUM_PATH||undefined,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'],
  });
  const context=await browser.newContext({locale:'ru-RU'});
  await context.grantPermissions(['microphone'],{origin});
  await context.addInitScript(items=>{
    if(!localStorage.getItem('qa-seeded-receipts')){
      localStorage.setItem('qa-seeded-receipts','1');
      localStorage.setItem('umma-menu-receipts',JSON.stringify(items));
    }
  },receipts);
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin){
      if(voiceFiles.has(url.pathname))return route.fulfill({contentType:'audio/webm',body:voiceFiles.get(url.pathname)});
      return route.continue();
    }
    if(!url.pathname.startsWith('/functions/v1/'))return route.abort();
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    const endpoint=url.pathname.split('/').at(-1);
    if(endpoint==='cafe-guest-order'&&request.method()==='GET')return route.fulfill({headers,json:{ok:true,products:[dish]}});
    if(endpoint==='cafe-menu')return route.fulfill({headers,json:{ok:true,products:[dish],locations:[destination]}});
    if(endpoint==='cafe-connect-actions')return route.fulfill({headers,json:{ok:true,ids:[]}});
    if(endpoint==='cafe-connect'){
      const client={name:'',promotions:false,pushEnabled:false};
      const timestamp=()=>new Date().toISOString();
      const mime=request.headers()['content-type'];
      if(mime?.startsWith('audio/')){
        const bytes=request.postDataBuffer();
        const id='voice-'+sent.length;
        voiceFiles.set('/qa-media/'+id,bytes.subarray(bytes.indexOf(10)+1));
        sent.push({id,direction:'customer',media_kind:'voice',created_at:timestamp()});
        return route.fulfill({headers,json:{ok:true,id}});
      }
      const {action,body,messageId}=request.postDataJSON();
      if(action==='mediaGet')return route.fulfill({headers,json:{ok:true,url:origin+'/qa-media/'+messageId}});
      if(action==='send')sent.push({id:'text-'+sent.length,direction:'customer',body,created_at:timestamp()});
      return route.fulfill({headers,json:{ok:true,client,messages:sent}});
    }
    return route.fulfill({status:404,headers,json:{ok:false}});
  });
  const page=await context.newPage();
  page.setDefaultTimeout(8000);
  const errors=[];
  page.on('pageerror',problem=>errors.push(problem.message));
  const $=selector=>page.locator(selector);
  const close=selector=>$(selector).press('Escape');
  async function fits(screen){
    const result=await page.evaluate(selector=>{
      const screen=selector==='main'?document.querySelector('#cafePage'):document.querySelector(selector);
      const box=screen.getBoundingClientRect(),limit=document.documentElement.clientWidth;
      return {left:box.left,right:box.right,limit,width:screen.clientWidth,content:screen.scrollWidth,
        pageWidth:document.documentElement.scrollWidth};
    },screen);
    assert.ok(result.left>=-1&&result.right<=result.limit+1&&result.content<=result.width+1&&result.pageWidth<=result.limit+1,
      screen+' '+JSON.stringify(result));
    layoutChecks++;
  }
  async function whiteLabels(...selectors){
    for(const selector of selectors){
      const actual=await $(selector).first().evaluate(el=>getComputedStyle(el).color);
      assert.equal(actual,'rgb(255, 255, 255)',selector+' label');
    }
  }
  await page.goto(menu);
  await $('.dish-link').first().waitFor();
  await whiteLabels('#shareMenu','#searchToggle','.cafe-category','.dish-link',
    '#customerMessagesButton','#nearbyCafeButton','#receiptButton','#openCart');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  for(const language of languages){
    await page.evaluate(lang=>window.ummaMenuI18n.setLanguage(lang),language);
    assert.equal(await $('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
    for(const width of widths){
      await page.setViewportSize({width,height:844});
      await fits('main');
    }
  }
  await page.evaluate(()=>window.ummaMenuI18n.setLanguage('ru'));
  for(const width of widths){
    await page.setViewportSize({width,height:844});
    await $('#searchToggle').click();
    await $('#search').fill('ягнятина');
    assert.equal(await $('.dish-link').count(),1);
    await $('#clearSearch').click();
    await $('.dish-link').first().click();
    await fits('#dishDetails');
    if(width===390)await whiteLabels('#dishDetails .cafe-add');
    await $('#dishDetails .close').click();
    await $('#openProfile').click();
    await fits('#customerProfile');
    if(width===390)await whiteLabels('#chooseProfileAvatar','#saveProfileName','#installApp .install-title');
    await $('#openChatSettings').click();
    await fits('#customerChatSettings');
    await page.getByRole('button',{name:'Назад к профилю'}).click();
    await close('#customerProfile');
    await $('#nearbyCafeButton').click();
    await fits('#nearbyCafe');
    await $('#receiptButton').click();
    await fits('#customerOrders');
    if(width===390)await whiteLabels('#showActiveOrders','#showOrderHistory','#activeOrdersList .order-action');
    await $('#showOrderHistory').click();
    assert.match(await $('#orderHistoryList').innerText(),/200/);
    await $('#openCart').click();
    await fits('#checkout');
    await $('#ummaBackToMenu').click();
    await $('#customerMessagesButton').click();
    await fits('#customerChatDialog');
    assert.ok(!await $('#customerDock').isVisible(),'the dock stays outside the full-screen chat');
    if(width===390){
      await page.evaluate(()=>document.body.style.setProperty('--customer-keyboard-inset','260px'));
      assert.equal(await $('#customerChatDialog').evaluate(el=>Math.round(el.getBoundingClientRect().bottom)),584);
      await page.evaluate(()=>document.body.style.removeProperty('--customer-keyboard-inset'));
    }
    if(output&&[390,1440].includes(width)){
      await mkdir(output,{recursive:true});
      await page.screenshot({path:output+'/chat-'+width+'.png'});
    }
    await $('#customerChatDialog .connect-close').click();
  }
  await page.setViewportSize({width:390,height:844});
  await $('#customerMessagesButton').click();
  assert.equal(await page.getByRole('button',{name:'Начать переписку'}).count(),0);
  await $('#customerChatDialog textarea').fill('Проверка браузера');
  await $('#customerChatDialog .connect-send').click();
  await $('#customerChatDialog .connect-chat-bubble').filter({hasText:'Проверка браузера'}).waitFor();
  await $('#customerChatDialog .connect-mic').click();
  const voicePanel=$('#customerChatDialog .connect-record-panel');
  await voicePanel.waitFor();
  await whiteLabels('.connect-record-pause','.connect-translated-text > button:not([hidden])');
  await voicePanel.locator('.connect-record-pause').click();
  await voicePanel.getByText(/Продолжить/).waitFor();
  await voicePanel.locator('.connect-record-pause').click();
  await page.waitForFunction(()=>document.querySelector('.connect-record-time')?.textContent==='0:01');
  if(output){
    await mkdir(output,{recursive:true});
    await page.screenshot({path:output+'/voice-recording-390.png'});
  }
  await voicePanel.locator('.connect-record-send').click();
  await $('#customerChatDialog .connect-chat-voice').waitFor();
  assert.equal(sent.length,2);
  assert.ok([...voiceFiles.values()][0].length>100);
  await $('#customerChatDialog .connect-voice-play').click();
  await page.waitForFunction(()=>document.querySelector('.connect-chat-voice audio')?.currentTime>0);
  await $('#customerChatDialog .connect-close').click();
  await $('#openProfile').click();
  await $('#profileDisplayName').fill('Гость UMMA');
  await $('#saveProfileName').click();
  await $('#profileAvatarFile').setInputFiles({
    name:'qa-avatar.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGhQAAAAASUVORK5CYII=','base64'),
  });
  await $('#profileAvatar').waitFor();
  assert.equal(await $('#profileAvatar').evaluate(el=>getComputedStyle(el).borderTopLeftRadius),'50%');
  await close('#customerProfile');
  const increase=$('#products [data-change="1"]').first();
  await increase.click();
  await page.reload();
  await $('#openProfile').click();
  assert.equal(await $('#profileDisplayName').inputValue(),'Гость UMMA');
  await $('#profileAvatar').waitFor();
  await close('#customerProfile');
  await $('button#openCart').click();
  assert.equal(await $('#cartItems .cart-controls b').innerText(),'1');
  await $('#continueCheckout').click();
  await fits('#checkout');
  await whiteLabels('#submit','#backToCart');
  await page.goto(menu+'?order=199');
  await $('#successNumber').waitFor();
  assert.match(await $('#successNumber').innerText(),/199/);
  await page.goto(menu+'?order=201');
  await $('#orderLinkDialog').waitFor();
  assert.match(await $('#orderLinkStatus').innerText(),/недоступен/);
  assert.deepEqual(errors,[]);
  console.log('PASS public client Chromium: '+layoutChecks+' layout checks, twelve languages, search, navigation, text and voice sends, basket reload, exact receipts and service worker.');
}finally{
  await browser?.close();
  await new Promise(done=>server.close(done));
}
