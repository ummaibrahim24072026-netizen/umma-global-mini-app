import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {normalizeRussianText} from './quran-russian-text.mjs';
assert.equal(normalizeRussianText('Ал- лах Все-\nвышний кото- рые по-ступает'), 'Аллах Всевышний которые поступает');
assert.equal(normalizeRussianText('Во- первых кто-\nлибо по- доброму из- за аль- Кура'), 'Во-первых кто-либо по-доброму из-за аль-Кура');
assert.equal(normalizeRussianText('какое-ли- бо — слово.\nНовый абзац.'), 'какое-либо — слово.\nНовый абзац.');
const read=p=>JSON.parse(readFileSync('assets/quran/'+p,'utf8'));
const index=read('index.json'),daily=read('daily.json');assert.equal(index.length,114);assert.equal(index.reduce((n,s)=>n+s.count,0),6236);
for(const s of index){const data=read(s.number+'.json');assert.equal(data.verses.length,s.count);data.verses.forEach((v,i)=>{assert.equal(v.number,i+1);assert.ok(/[\u0600-\u06ff]/.test(v.arabic));assert.ok(/[а-яА-Я]/.test(v.translation));assert.equal(normalizeRussianText(v.translation),v.translation);});const tafsir=read('tafsir/'+s.number+'.json');for(const block of tafsir.blocks){assert.equal(normalizeRussianText(block.text),block.text);assert.doesNotMatch(block.text,/[А-Яа-яЁё]-\s+[А-Яа-яЁё]|\u00ad/u);}const mapped=new Set(tafsir.blocks.flatMap(x=>x.ayas));assert.equal(mapped.size,s.count);}
assert.equal(new Set(daily.map(x=>x.join(':'))).size,daily.length);for(const [s,a,b] of daily){assert.ok(a>0&&b>=a&&b<=index[s-1].count);}
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://umma.test/'}),w=dom.window,d=w.document;
w.fetch=async path=>new Response(readFileSync(String(path),'utf8'),{status:200,headers:{'Content-Type':'application/json'}});
w.HTMLElement.prototype.scrollIntoView=function(){this.dataset.scrolled='true';};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
const until=async check=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}assert.fail('UI did not reach expected state');};
try{
 w.eval(readFileSync('js/quran/quran.js','utf8'));
 await until(()=>d.getElementById('dailyAyahUnderstand'));
 assert.equal(w.ummaQuran.dateKey(new Date('2026-10-17T16:59:59Z')),'2026-10-17');assert.equal(w.ummaQuran.dateKey(new Date('2026-10-17T17:00:00Z')),'2026-10-18');
 assert.equal(w.ummaQuran.dayIndex(new Date('2026-10-17T17:00:00Z'))-w.ummaQuran.dayIndex(new Date('2026-10-17T16:59:59Z')),1);
 const disclosure=d.querySelector('.daily-ayah'),summary=disclosure.querySelector('summary');assert.equal(disclosure.open,false);assert.ok(summary.querySelector('.daily-ayah-preview').textContent);assert.ok(d.getElementById('quranDirect').closest('.daily-ayah-expanded'));summary.click();assert.equal(disclosure.open,true);summary.click();assert.equal(disclosure.open,false);summary.click();
 const reference=d.querySelector('.daily-ayah-reference').textContent.match(/(\d+):(\d+)/);assert.ok(reference);
 d.getElementById('quranDirect').click();await until(()=>d.getElementById('quranAyaNumber'));assert.equal(d.getElementById('quranAyaNumber').value,reference[2]);assert.ok(d.getElementById('quran-verse-'+reference[1]+'-'+reference[2])||d.querySelector('[data-scrolled=true]'));d.getElementById('quranClose').click();
 d.getElementById('dailyAyahCollapse').click();await until(()=>!disclosure.open);assert.equal(disclosure.open,false);summary.click();
 d.getElementById('dailyAyahUnderstand').click();await until(()=>d.querySelector('#quranTafsir article'));assert.ok(d.querySelector('#quranTafsir').closest('[data-i18n-ignore]'));assert.match(d.getElementById('quranTafsirEdition').textContent,/V1.0.0/);assert.equal(d.querySelector('.quran-source-details').open,false);
 d.getElementById('quranReadSurah').click();await until(()=>d.getElementById('quranMode'));assert.ok(d.querySelector('[data-scrolled=true]'));
 d.getElementById('quranMode').value='arabic';d.getElementById('quranMode').dispatchEvent(new w.Event('change'));assert.equal(d.getElementById('quranBody').dataset.mode,'arabic');
 d.querySelector('[data-bookmark]').click();assert.equal(d.querySelector('[data-bookmark]').getAttribute('aria-pressed'),'true');
 w.ummaQuran.back();await until(()=>d.getElementById('quranReadSurah'));w.ummaQuran.back();assert.equal(w.ummaQuran.isOpen(),false);
 await w.ummaQuran.open({view:'detail',s:1,a:3});await until(()=>d.querySelector('#quranTafsir article'));
 const rows=[...d.querySelectorAll('.quran-passage-row')];assert.equal(rows.length,7);assert.deepEqual(rows.map(row=>row.querySelector('.quran-ayah-number').textContent),['1','2','3','4','5','6','7']);
 const flat=text=>text.replace(/\s+/gu,' ').trim();
 assert.equal(flat(rows.map(row=>row.querySelector('div').textContent).join(' ')),flat(read('tafsir/1.json').blocks[0].text.replace(/\(\d+\)\s*/gu,'')));
 assert.match(d.getElementById('quranTafsirStatus').textContent,/Отдельный комментарий/);assert.equal(d.querySelectorAll('.quran-header-title svg').length,1);
 await w.ummaQuran.open({view:'detail',s:2,a:255});await until(()=>d.querySelector('#quranTafsir article'));assert.equal(d.querySelector('.quran-passage-row .quran-ayah-number').textContent,'255');assert.ok(d.querySelector('.quran-commentary p'));assert.doesNotMatch(d.querySelector('.quran-commentary p').textContent,/^\(255\)/);
 await w.ummaQuran.open({view:'detail',s:2,a:222});await until(()=>d.querySelector('#quranTafsir article'));assert.equal(d.querySelectorAll('.quran-passage-row').length,2);assert.deepEqual([...d.querySelectorAll('.quran-passage-row .quran-ayah-number')].map(x=>x.textContent),['222','223']);
 await w.ummaQuran.open({view:'detail',s:2,a:204});await until(()=>d.querySelector('#quranTafsir article'));assert.deepEqual([...d.querySelectorAll('.quran-passage-row .quran-ayah-number')].map(x=>x.textContent),['204','205','206']);
 await w.ummaQuran.open();assert.equal(d.querySelectorAll('#quranList>button').length,114);assert.equal(d.querySelectorAll('.quran-surah-arabic[dir=rtl]').length,114);assert.match(d.querySelector('.quran-surah-name small').textContent,/7 аятов/);assert.equal(d.getElementById('quranResume').hidden,false);assert.equal(d.querySelectorAll('#quranBookmarks>button').length,1);
 const search=d.getElementById('quranSearch');search.value='18:10';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('#quranList>button').length,1);d.querySelector('#quranList>button').click();await until(()=>d.getElementById('quran-verse-10'));assert.equal(d.getElementById('quran-verse-10').dataset.scrolled,'true');
 w.ummaQuran.back();await until(()=>d.getElementById('quranSearch'));d.getElementById('quranSearch').value='Милосердного';d.getElementById('quranSearchText').click();await until(()=>d.getElementById('quranSearchStatus').textContent.startsWith('Найдено'));assert.ok(d.querySelectorAll('#quranList>button').length>0);
 d.getElementById('quranClose').click();await w.ummaQuran.open({view:'reader',s:114,a:6});assert.equal(d.getElementById('quranNext').disabled,true);assert.equal(d.getElementById('quran-verse-6').dataset.scrolled,'true');
 console.log('PASS Quran: 114 surahs/6236 aligned verses, full tafsir coverage, unique daily passages, Nha Trang midnight, detail → tafsir → reader, back, bookmarks, resume, modes, reference and full translation search.');
}finally{dom.window.close();}
