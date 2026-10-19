import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://umma.test/'}),w=dom.window,d=w.document;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
try{
 for(const path of ['js/vendor/adhan-4.4.3.min.js','js/islam/calculations.js','js/vendor/geomagnetism-0.2.0.js','js/islam/islam.js'])w.eval(readFileSync(path,'utf8'));
 // Independent NOAA WMM2025 reference vectors (2025-02 test data), not self-comparison.
 for(const [lat,lon,decl] of [[80,0,1.28],[0,120,-0.16],[-80,-120,68.78]]){const field=w.ummaGeomagnetism.model(new w.Date('2025-01-01T00:00:00Z')).point([lat,lon]);assert.ok(Math.abs(field.decl-decl)<0.01);}
 assert.throws(()=>w.ummaGeomagnetism.model(new w.Date('2031-01-01T00:00:00Z')));
 const C=w.ummaIslamCalc,s={lat:12.2388,lon:109.1967,zone:'Asia/Ho_Chi_Minh',method:'MuslimWorldLeague',asr:1};
 assert.ok(Math.abs(C.qibla(s.lat,s.lon)-288.2576)<0.001);assert.equal(C.qibla(21.4225,39.8262),null);assert.throws(()=>C.qibla(91,0));assert.throws(()=>C.qibla(null,0));
 assert.equal(C.dateKey(new Date('2026-10-18T16:59:59Z'),s.zone),'2026-10-18');assert.equal(C.dateKey(new Date('2026-10-18T17:00:00Z'),s.zone),'2026-10-19');
 const result=C.calculate('2026-10-19',s);assert.equal(result.valid,true);assert.equal(result.rows.length,6);
 const ranges={fajr:[4,6],sunrise:[5,7],dhuhr:[11,13],asr:[14,17],maghrib:[16,19],isha:[17,21]};
 for(const r of result.rows){const hour=+C.format(r.time,s.zone).split(':')[0];assert.ok(hour>=ranges[r.id][0]&&hour<=ranges[r.id][1],r.id);}
 const later=C.calculate('2026-10-19',{...s,asr:2});assert.ok(later.rows[3].time>result.rows[3].time);
 const adjusted=C.calculate('2026-10-19',{...s,offsets:{fajr:7}});assert.equal(+adjusted.rows[0].time-+result.rows[0].time,7*60000);
 assert.throws(()=>C.calculate('2026-02-30',s));assert.throws(()=>C.calculate('2026-10-19',{...s,zone:'Wrong/Zone'}));assert.throws(()=>C.calculate('2026-10-19',{...s,offsets:{fajr:1.2}}));
 assert.equal(C.format(new Date('2026-03-08T06:30:00Z'),'America/New_York'),'01:30');assert.equal(C.format(new Date('2026-03-08T07:30:00Z'),'America/New_York'),'03:30');
 const night=C.next(new Date('2026-10-19T16:00:00Z'),s);assert.equal(night.next.id,'fajr');assert.equal(C.dateKey(night.next.time,s.zone),'2026-10-20');
 const postSunrise=C.next(new Date(+result.rows[1].time+60000),s);assert.equal(postSunrise.last.id,'sunrise');assert.equal(postSunrise.next.id,'dhuhr');
 assert.equal(C.calculate('2026-06-21',{...s,lat:78.22,lon:15.65,zone:'Arctic/Longyearbyen'}).valid,false);
 assert.equal(C.sensorHeading({alpha:35,absolute:false}),null);assert.equal(C.sensorHeading({alpha:0,absolute:true}),0);assert.equal(C.sensorHeading({alpha:null,absolute:true}),null);assert.equal(C.sensorHeading({webkitCompassHeading:20,webkitCompassAccuracy:-1}),null);assert.equal(C.sensorHeading({webkitCompassHeading:20,webkitCompassAccuracy:NaN}),null);
 d.getElementById("islamHomeOpen").click();assert.equal(d.querySelectorAll('.islam-grid>button').length,10);assert.ok(d.getElementById('islamNext').textContent!=='—');
 d.querySelector('[data-islam=qibla]').click();assert.match(d.getElementById('islamSensorStatus').textContent,/Статическое/);
 w.DeviceOrientationEvent=function(){};
 const decl=w.ummaGeomagnetism.model(new w.Date()).point([s.lat,s.lon]).decl;
 const dispatch=(alpha,beta=0)=>{const event=new w.Event('deviceorientationabsolute');Object.assign(event,{alpha,absolute:true,beta,gamma:0});w.dispatchEvent(event);};
 // Empty manual field must start automatic compass, including the east-positive correction.
 d.querySelector('[data-islam=start]').click();dispatch(C.norm(360-C.qibla(s.lat,s.lon)+decl));assert.ok(d.getElementById('islamCompass').classList.contains('is-aligned'));
 dispatch(0,60);assert.equal(d.getElementById('islamCompass').classList.contains('is-live'),false);assert.match(d.getElementById('islamCompassMessage').textContent,/горизонтально/);
 dispatch(0);assert.ok(d.getElementById('islamCompass').classList.contains('is-live'));
 dispatch(C.norm(360-C.qibla(s.lat,s.lon)+decl+1));const firstRotation=parseFloat(d.getElementById('islamNeedle').style.transform.slice(7));dispatch(C.norm(360-C.qibla(s.lat,s.lon)+decl-1));const secondRotation=parseFloat(d.getElementById('islamNeedle').style.transform.slice(7));assert.ok(Math.abs(secondRotation-firstRotation)<3,'crossing north must not spin through 358 degrees');
 d.querySelector('[data-islam=stop]').click();dispatch(0);assert.equal(d.getElementById('islamCompass').classList.contains('is-live'),false);
 d.getElementById('islamNorthCorrection').value='0';d.querySelector('[data-islam=start]').click();dispatch(360-C.qibla(s.lat,s.lon));assert.ok(d.getElementById('islamCompass').classList.contains('is-aligned'));d.querySelector('[data-islam=stop]').click();
 const handlers={};let stopped=0;
 w.Telegram={WebApp:{onEvent:(name,fn)=>{handlers[name]=fn;},offEvent:name=>{delete handlers[name];},DeviceOrientation:{absolute:true,alpha:(360-C.qibla(s.lat,s.lon))*Math.PI/180,beta:0,gamma:0,start:(params,fn)=>{assert.equal(params.need_absolute,true);fn(true);},stop:()=>stopped++}}};
 d.querySelector('[data-islam=start]').click();const late=handlers.deviceOrientationChanged;late();assert.ok(d.getElementById('islamCompass').classList.contains('is-aligned'));d.querySelector('[data-islam=stop]').click();late();assert.equal(d.getElementById('islamCompass').classList.contains('is-live'),false);assert.equal(stopped,1);
 // Telegram explicitly refuses: immediately try browser instead of leaving a dead compass.
 w.Telegram.WebApp.DeviceOrientation.start=(params,fn)=>fn(false);d.querySelector('[data-islam=start]').click();dispatch(360-C.qibla(s.lat,s.lon));assert.ok(d.getElementById('islamCompass').classList.contains('is-aligned'));assert.equal(stopped,2);d.querySelector('[data-islam=stop]').click();
 w.Telegram.WebApp.DeviceOrientation.start=(params,fn)=>fn(true);d.querySelector('[data-islam=start]').click();handlers.deviceOrientationFailed();dispatch(0);assert.ok(d.getElementById('islamCompass').classList.contains('is-live'));d.querySelector('[data-islam=stop]').click();w.Telegram=undefined;
 // Native SDK returns no absolute data: timer falls back to browser, then to a clearly static bearing.
 const originalTimeout=w.setTimeout;let pending;w.setTimeout=(fn,ms,...args)=>ms===5000?(pending=fn,123456):originalTimeout(fn,ms,...args);
 w.Telegram={WebApp:{onEvent:()=>{},offEvent:()=>{},DeviceOrientation:{start:(params,fn)=>fn(true),stop:()=>{}}}};d.querySelector('[data-islam=start]').click();pending();dispatch(0);assert.ok(d.getElementById('islamCompass').classList.contains('is-live'));pending();assert.equal(d.getElementById('islamCompass').classList.contains('is-live'),false);assert.match(d.getElementById('islamCompassMessage').textContent,/магнитометра/);w.setTimeout=originalTimeout;w.Telegram=undefined;
 // iOS permission denied and a stopped pending permission must never produce a live arrow.
 w.DeviceOrientationEvent.requestPermission=async()=> 'denied';d.querySelector('[data-islam=start]').click();await new Promise(resolve=>setImmediate(resolve));assert.match(d.getElementById('islamCompassMessage').textContent,/магнитометра/);assert.equal(d.getElementById('islamCompass').classList.contains('is-live'),false);
 let resolvePermission;w.DeviceOrientationEvent.requestPermission=()=>new Promise(resolve=>{resolvePermission=resolve;});d.querySelector('[data-islam=start]').click();d.querySelector('[data-islam=stop]').click();resolvePermission('granted');await new Promise(resolve=>setImmediate(resolve));dispatch(0);assert.equal(d.getElementById('islamCompass').classList.contains('is-live'),false);delete w.DeviceOrientationEvent.requestPermission;
 // Expired/absent model gives explicit fallback; it never silently assumes zero declination.
 const model=w.ummaGeomagnetism;w.ummaGeomagnetism=undefined;d.getElementById('islamNorthCorrection').value='';d.querySelector('[data-islam=start]').click();assert.match(d.getElementById('islamCompassMessage').textContent,/недоступна/);w.ummaGeomagnetism=model;
 w.ummaIslam.back();d.querySelector('[data-islam=times]').click();assert.equal(d.querySelectorAll('[data-prayer]').length,6);assert.equal(d.querySelectorAll('#islamCalendar tbody tr').length,31);
 d.getElementById('islamMonth').value='2028-02';d.getElementById('islamMonth').dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('#islamCalendar tbody tr').length,29);
 d.querySelector('[data-islam=settings]').click();d.getElementById('islamAsr').value='2';d.getElementById('islamSettings').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(JSON.parse(w.localStorage.getItem('umma-islam-settings')).asr,2);assert.equal(w.localStorage.getItem('umma-islam-settings').includes('lat'),false);
 w.ummaIslam.back();let opened=0;w.ummaQuran={open:()=>opened++};d.querySelector('.islam-grid [data-islam=quran]').click();assert.equal(opened,1);
 let category;w.ummaIslamLibrary={open:value=>{category=value;}};d.querySelector('[data-islam=hadith]').click();assert.equal(category,'hadith');
 w.ummaI18n={language:'vi'};w.dispatchEvent(new w.Event('umma:languagechange'));assert.match(d.getElementById('islamBody').textContent,/Qur’an và Sunnah/);
 w.ummaIslam.back();w.ummaIslam.back();assert.equal(w.ummaIslam.isOpen(),false);
 console.log('PASS Islam: qibla geometry, five prayers plus sunrise, date validation, polar fallback, Asr, adjustments, timezone/DST, next-day prayer, compass permissions/absolute-only/alignment/stop, month/leap year, Quran integration, no stored GPS and localization.');
}finally{w.close();}
