import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const source=readFileSync('js/core/screen-awake.js','utf8'),tick=()=>new Promise(r=>setTimeout(r,10));
{
const dom=new JSDOM('<html><body><details class="web-account-menu"><div></div></details></body></html>',{runScripts:'outside-only',url:'https://qa.invalid/staff.html'}),w=dom.window;let requests=0,hidden=false,resolveNext=null;const locks=[];
Object.defineProperty(w.document,'visibilityState',{get:()=>hidden?'hidden':'visible'});Object.defineProperty(w.navigator,'wakeLock',{value:{async request(type){assert.equal(type,'screen');requests++;if(resolveNext!==null)return new Promise(r=>resolveNext=r);const lock=new w.EventTarget();lock.released=false;lock.release=async()=>{lock.released=true;lock.dispatchEvent(new w.Event('release'));};locks.push(lock);return lock;}}});
w.eval(source);await tick();assert.equal(requests,1);assert.equal(w.document.documentElement.dataset.screenAwake,'active');w.dispatchEvent(new w.Event('focus'));await tick();assert.equal(requests,1);
hidden=true;w.document.dispatchEvent(new w.Event('visibilitychange'));await tick();assert.equal(locks[0].released,true);hidden=false;w.document.dispatchEvent(new w.Event('visibilitychange'));await tick();assert.equal(requests,2);
w.document.getElementById('ummaScreenAwake').click();await tick();assert.equal(w.localStorage.getItem('umma:screen-awake'),'off');assert.equal(locks[1].released,true);w.document.getElementById('ummaScreenAwake').click();await tick();assert.equal(requests,3);w.dispatchEvent(new w.Event('pagehide'));await tick();assert.equal(locks[2].released,true);w.close();
}
{
const dom=new JSDOM('<html><body><div class="menu-footer"></div></body></html>',{runScripts:'outside-only',url:'https://qa.invalid/menu/'}),w=dom.window;w.eval(source);assert.equal(w.document.documentElement.dataset.screenAwake,'unsupported');assert.match(w.document.getElementById('ummaScreenAwake').title,/не поддерживает/);w.close();
}
// Server reset removes Cafe drafts/history while preserving staff session, language, and unrelated modules.
{
const dom=new JSDOM('<html><body></body></html>',{runScripts:'outside-only',url:'https://qa.invalid/menu/'}),w=dom.window;let reset=0;w.ummaOrderInbox={reset(){reset++;}};
for(const [k,v] of Object.entries({'umma-menu-receipt':'test receipt','umma-menu-pending':'test draft','umma:order-inbox:v1':'test messages','umma:cafe-operation:123':'test sale','umma:web-staff-session':'private session','umma-menu-language':'vi','rent-draft':'retain'}))w.localStorage.setItem(k,v);
w.eval(readFileSync('js/cafe/data-epoch.js','utf8'));assert.equal(w.ummaCafeEpoch.apply('new-epoch'),true);assert.equal(reset,1);assert.equal(w.localStorage.getItem('umma-menu-receipt'),null);assert.equal(w.localStorage.getItem('umma:cafe-operation:123'),null);assert.equal(w.localStorage.getItem('umma:web-staff-session'),'private session');assert.equal(w.localStorage.getItem('umma-menu-language'),'vi');assert.equal(w.localStorage.getItem('rent-draft'),'retain');assert.equal(w.ummaCafeEpoch.apply('new-epoch'),false);w.close();
}
console.log('PASS screen wake lock: one lock, hidden release, visible reacquire, manual control, unsupported fallback; Cafe reset clears drafts/history and preserves accounts/preferences.');
