import {createRequire} from 'node:module';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),output=process.env.QA_OUTPUT_DIR||'/tmp/umma-home-qa';fs.mkdirSync(output,{recursive:true});const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));try{const data=fs.readFileSync(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png'}[path.extname(file)]||'application/octet-stream'));res.end(data)}catch{res.statusCode=404;res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--single-process']});
const results=[];
try{const context=await browser.newContext();await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('umma-language','ru');});
await page.goto(base);await page.locator('.daily-ayah-reference').waitFor();
if(process.env.QA_PREVIEW_NAME)await page.evaluate(name=>window.updateTelegramUserInterface({first_name:name}),process.env.QA_PREVIEW_NAME);
for(const lang of ['ru','en','vi']){await page.evaluate(l=>window.ummaI18n.setLanguage(l),lang);
 for(const width of [320,360,375,390,414,430,768,1024]){await page.setViewportSize({width,height:844});await page.waitForTimeout(60);
 const metrics=await page.evaluate(()=>{const d=document.documentElement,m=document.querySelector('.app>main'),hero=document.querySelector('.brand-art'),img=hero.querySelector('img'),nav=document.querySelector('.bottom-nav'),cta=document.querySelector('.brand-art-action'),grid=document.querySelector('.services-grid');return {pageOverflow:d.scrollWidth>d.clientWidth,mainOverflow:m.scrollWidth>m.clientWidth,hero:Math.round(hero.getBoundingClientRect().height),imageLoaded:img.naturalWidth>0,navBottom:nav.getBoundingClientRect().bottom,ctaHeight:cta.getBoundingClientRect().height,scrollable:grid.scrollWidth>grid.clientWidth,offenders:[...document.querySelectorAll('.ecosystem-card,.services-heading,.brand-art-copy')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className)}});
 assert.equal(metrics.pageOverflow,false,lang+' '+width+' document');assert.equal(metrics.mainOverflow,false);assert.ok(metrics.imageLoaded);assert.ok(metrics.ctaHeight>=44);assert.equal(metrics.offenders.length,0,JSON.stringify(metrics));assert.ok(metrics.navBottom<=845);if(width<700)assert.ok(metrics.scrollable);results.push({lang,width,...metrics});
 if(width===390){await page.screenshot({path:output+'/umma-home-'+lang+'-390.png'});}if(lang==='ru'&&width===320)await page.screenshot({path:output+'/umma-home-ru-320.png'});
 }
}
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.ummaI18n.setLanguage('ru'));
await page.locator('.services-grid').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/umma-home-directions-390.png'});
await page.locator('[data-page=about]').click();await page.locator('.umma-about').waitFor();assert.equal(await page.locator('.umma-about-directions button').count(),38);await page.locator('.umma-about .cafe-back').click();
await page.locator('.daily-ayah summary').click();assert.equal(await page.locator('.daily-ayah').getAttribute('open'),'');assert.equal((await page.locator('#dailyAyahCollapse').innerText()).trim(),'');await page.locator('#dailyAyahCollapse').click();assert.equal(await page.locator('.daily-ayah').getAttribute('open'),null);await page.locator('.daily-ayah summary').click();await page.locator('#quranDirect').click();await page.locator('#quranBody').waitFor();assert.ok(await page.locator('.quran-arabic[dir=rtl]').count());await page.evaluate(()=>document.getElementById('quranClose').click());
for(const lang of ['en','vi']){await page.evaluate(l=>window.ummaI18n.setLanguage(l),lang);await page.locator('[data-page=about]').click();const aboutText=await page.locator('.umma-about').innerText();assert.ok(!/[А-Яа-яЁё]/.test(aboutText),lang+' about translations: '+aboutText.split('\n').filter(t=>/[А-Яа-яЁё]/.test(t)).join(' / '));await page.locator('.umma-about .cafe-back').click();}
// Telegram safe-area coverage: the daily card must end above the fixed navigation.
await page.evaluate(()=>document.querySelector('.daily-ayah').open=false);
await page.evaluate(()=>window.ummaI18n.setLanguage('ru'));await page.evaluate(()=>window.updateTelegramUserInterface({first_name:'Ибрахим'}));
for(const width of [320,360,375,390,414,430]){
 await page.setViewportSize({width,height:844});await page.evaluate(()=>{document.documentElement.style.setProperty('--umma-safe-top','40px');document.documentElement.style.setProperty('--umma-safe-bottom','20px');document.querySelector('.app>main').scrollTop=0;});await page.waitForTimeout(120);
 const fit=await page.evaluate(()=>({bottom:document.querySelector('.ayah-card').getBoundingClientRect().bottom,nav:document.querySelector('.bottom-nav').getBoundingClientRect().top}));assert.ok(fit.bottom<=fit.nav-2,JSON.stringify({width,...fit}));
 if(width===390)await page.screenshot({path:output+'/umma-home-telegram-safe-390.png'});
}
for(const height of [760,844])for(const safeTop of [40,80]){
 await page.setViewportSize({width:390,height});await page.waitForTimeout(50);await page.evaluate(top=>{document.documentElement.style.setProperty('--umma-safe-top',top+'px');document.documentElement.style.setProperty('--umma-safe-bottom','20px');document.querySelector('.app>main').scrollTop=0;},safeTop);await page.waitForTimeout(120);
 const fit=await page.evaluate(()=>({bottom:document.querySelector('.ayah-card').getBoundingClientRect().bottom,nav:document.querySelector('.bottom-nav').getBoundingClientRect().top}));assert.ok(fit.bottom<=fit.nav-12,JSON.stringify({height,safeTop,...fit}));
}
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(80);await page.evaluate(()=>{document.documentElement.style.setProperty('--umma-safe-top','40px');document.documentElement.style.setProperty('--umma-safe-bottom','20px');document.querySelector('.app>main').scrollTop=0;});await page.waitForTimeout(120);await page.screenshot({path:output+'/home-turquoise-preview.png'});
await page.locator('.daily-ayah summary').click();await page.locator('#dailyAyahCollapse').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/home-ayah-collapse-preview.png'});await page.locator('#dailyAyahCollapse').click();
for(const name of ['Ибрахим','Мухаммад Абдуррахман','<img src=x onerror=alert(1)>']){
 await page.setViewportSize({width:320,height:844});await page.evaluate(name=>window.updateTelegramUserInterface({first_name:name}),name);
 assert.equal(await page.locator('.greeting-name').textContent(),name);assert.equal(await page.locator('.welcome-content h2 img').count(),0);assert.equal(await page.locator('.welcome-content h2').evaluate(e=>e.lastElementChild.className),'greeting-name');assert.ok(!(await page.locator('.welcome-content h2').textContent()).includes('!'));
 assert.equal(await page.locator('.brand-art-copy').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
}
await page.evaluate(()=>window.updateTelegramUserInterface({}));assert.equal(await page.locator('.greeting-name').count(),0);
assert.deepEqual(errors,[]);fs.writeFileSync(output+'/home-browser-results.json',JSON.stringify(results,null,2));console.log('PASS browser: 24 size/language combinations, images, no overflow, CTA size, bottom nav, horizontal services, About translations, Quran disclosure and actual reader, zero JavaScript exceptions');console.log(JSON.stringify(results.filter(r=>r.lang==='ru')));
}finally{await browser.close();server.close();}
