import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('js/cafe/public-menu-i18n.js','utf8');
function setup({preferred=[],single='en-US',saved,legacy,blocked=false}={}){
 const dom=new JSDOM('<html><head></head><body><label data-i18n="Язык"></label><h1 data-i18n="Наше меню"></h1><select id="menuLanguage"><option value="ru">Русский</option><option value="vi">Tiếng Việt</option><option value="en">English</option></select></body></html>',{url:'https://example.com/menu/',runScripts:'outside-only'}),w=dom.window;
 Object.defineProperty(w.navigator,'languages',{value:preferred});Object.defineProperty(w.navigator,'language',{value:single});
 if(saved)w.localStorage.setItem('umma-menu-language',saved);if(legacy)w.localStorage.setItem('umma-language',legacy);
 if(blocked)Object.defineProperty(w,'localStorage',{get(){throw Error('Storage blocked');}});
 w.eval(source);w.ummaMenuI18n.staticText();return dom;
}
for(const [preferred,single,expected] of [[['vi-VN'],'vi-VN','vi'],[['ru-RU'],'ru-RU','ru'],[['ko-KR'],'ko-KR','ko'],[['zh-TW'],'zh-TW','zh'],[['xx-YY','de-DE'],'xx-YY','de'],[[],'vi-VN','vi'],[[],'xx-YY','en'],[[' VI_vn '],'en-US','vi']]){
 const d=setup({preferred,single,legacy:'ru'}),w=d.window;assert.equal(w.ummaMenuI18n.language,expected);assert.equal(w.document.documentElement.lang,expected);assert.equal(w.localStorage.getItem('umma-menu-language'),null,'auto detection must not become a manual preference');assert.equal(w.document.documentElement.getAttribute('translate'),'no');assert.ok(w.document.documentElement.classList.contains('notranslate'));d.window.close();
}
for(const blocked of [false,true]){const d=setup({preferred:['vi-VN'],single:'en-US',blocked}),w=d.window;assert.equal(w.ummaMenuI18n.language,'vi');assert.equal(w.document.querySelector('label').textContent,'Ngôn ngữ');assert.equal(w.document.querySelector('h1').textContent,'Thực đơn');assert.equal(w.document.getElementById('menuLanguage').value,'vi');w.ummaMenuI18n.setLanguage('ru');assert.equal(w.document.querySelector('label').textContent,'Язык');if(!blocked)assert.equal(w.localStorage.getItem('umma-menu-language'),'ru');d.window.close();}
const d=setup({preferred:['vi-VN'],saved:'en'});assert.equal(d.window.ummaMenuI18n.language,'en');d.window.close();
const html=readFileSync('menu/index.html','utf8');assert.match(html,/<html[^>]*translate="no"/);assert.match(html,/<meta name="google" content="notranslate">/);
console.log('PASS phone language: RU/VI/KO/ZH, preference order, locale normalization, unsupported fallback, blocked storage, explicit choice, no inherited mini-app preference and browser-translation protection.');
