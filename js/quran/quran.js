/* Quran text is published source material. Never pass it through UI translation. */
(() => {
 'use strict';
 const byId=id=>document.getElementById(id), cache=new Map();
 const get=path=>{if(!cache.has(path)){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);cache.set(path,fetch('assets/quran/'+path,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('load');return r.json();}).catch(e=>{cache.delete(path);throw e;}).finally(()=>clearTimeout(timer)));}return cache.get(path);};
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('umma-quran-'+key))??fallback;}catch{return fallback;}};
 const save=(key,value)=>{try{localStorage.setItem('umma-quran-'+key,JSON.stringify(value));}catch{}};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Layout only: published wording and punctuation remain in the source JSON.
 const bookEmblem='<svg class="quran-emblem" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false"><rect x="3" y="3" width="58" height="58" rx="18" fill="var(--turquoise-pale)" stroke="var(--gold-dark)" stroke-opacity=".45"/><path d="M13 21c7-3 13-2 19 2 6-4 12-5 19-2v24c-7-3-13-2-19 2-6-4-12-5-19-2V21Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M32 23v24M18 28c3-1 6 0 9 1M18 34c3-1 6 0 9 1M37 29c3-1 6-2 9-1M37 35c3-1 6-2 9-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="m32 10 2 4-2 4-2-4 2-4Z" fill="var(--gold-dark)"/></svg>';
 const paragraphs=text=>text.trim().split(/\n\s*\n|\n/u).filter(x=>x.trim()).map(x=>'<p>'+esc(x.replace(/[ \t\u00a0]+/g,' ').trim())+'</p>').join('');
 function passageParts(block,count){
  if(block.kind!=='passage')return null;
  const matches=[...block.text.matchAll(/\((\d{1,3})\)\s+|(?:^|\s)-(\d{1,3})\s+/gu)];
  const numbers=matches.map(m=>+(m[1]||m[2]));
  if(!matches.length||block.text.slice(0,matches[0].index).trim()||numbers[0]!==block.ayas[0]||numbers.some((n,i)=>n<1||n>count||(i&&n!==numbers[i-1]+1))||!block.ayas.every(n=>numbers.includes(n)))return null;
  return matches.map((m,i)=>({number:numbers[i],text:block.text.slice(m.index+m[0].length,matches[i+1]?.index).trim()}));
 }
 function tafsirHTML(block,count){
  const parts=passageParts(block,count),numbers=parts?parts.map(v=>v.number):block.ayas;
  const range=numbers.length>1?numbers[0]+'–'+numbers[numbers.length-1]:numbers[0];
  const heading=(block.kind==='passage'?(numbers.length>1?'Аяты':'Аят'):block.kind==='introduction'?'Введение к суре':(numbers.length>1?'Толкование аятов':'Толкование аята'))+' · '+range;
  if(parts)return '<article class="quran-passage"><h3>'+esc(heading)+'</h3>'+parts.map(v=>'<div class="quran-passage-row"><span class="quran-ayah-number" aria-label="Аят '+v.number+'">'+v.number+'</span><div>'+paragraphs(v.text)+'</div></div>').join('')+'</article>';
  // A single leading reference is repeated in the heading; citations inside prose stay intact.
  const text=block.text.replace(/^\((\d{1,3})\)\s+/, (match,n)=>+n===block.ayas[0]?'':match);
  return '<article class="quran-commentary"><h3>'+esc(heading)+'</h3>'+paragraphs(text)+'</article>';
 }
 let index=[],daily=[],today=null,dialog=null,state=null,history=[],request=0,searchRequest=0,opener=null;
 let mode=read('mode','both'),size=read('size',20),bookmarks=read('bookmarks',[]);
 if(!['both','arabic','translation'].includes(mode))mode='both';
 size=Math.min(30,Math.max(16,Number(size)||20));if(!Array.isArray(bookmarks))bookmarks=[];bookmarks=bookmarks.filter(p=>p&&Number.isInteger(p.s)&&p.s>=1&&p.s<=114&&Number.isInteger(p.a)&&p.a>0).slice(0,6236);
 const dateKey=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 function dayIndex(date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return Math.floor(Date.UTC(+p.year,+p.month-1,+p.day)/86400000);}
 let readiness;
 function ensure(){if(!readiness)readiness=Promise.all([get('index.json'),get('daily.json')]).then(([i,d])=>{index=i;daily=d;}).catch(e=>{readiness=null;throw e;});return readiness;}
 const ayahCount=n=>n+' '+(n%100>=11&&n%100<=14?'аятов':n%10===1?'аят':n%10>=2&&n%10<=4?'аята':'аятов');
 const title=n=>index[n-1]?.name||String(n);
 function verseHTML(v,s){return `<article class="quran-verse" id="quran-verse-${v.number}"><h3>${esc(title(s))} · ${s}:${v.number}</h3><p class="quran-arabic" lang="ar" dir="rtl" translate="no">${esc(v.arabic)}</p><p class="quran-translation" lang="ru" dir="ltr" translate="no">${esc(v.translation)}</p></article>`;}
 async function updateDaily(){
  const key=dateKey();if(today?.key===key)return;
  const card=byId('dailyAyahContent');if(!card)return;
  const mark=document.querySelector('.ayah-book');if(mark)mark.innerHTML=bookEmblem;
  try{await ensure();const [s,a,b]=daily[((dayIndex(new Date())%daily.length)+daily.length)%daily.length];const data=await get(s+'.json');today={key,s,a,b};
   card.innerHTML='<details class="daily-ayah"><summary><span class="daily-ayah-heading">АЯТ ДНЯ</span><span class="daily-ayah-preview" lang="ru" translate="no" data-i18n-ignore>'+esc(data.verses.find(v=>v.number===a).translation)+'</span><span class="daily-ayah-arrow" aria-hidden="true">⌄</span></summary><div class="daily-ayah-expanded"><div class="daily-verse-text" translate="no" data-i18n-ignore>'+data.verses.filter(v=>v.number>=a&&v.number<=b).map(v=>`<p class="quran-arabic" lang="ar" dir="rtl">${esc(v.arabic)}</p><p lang="ru" dir="ltr">${esc(v.translation)}</p>`).join('')+`<small>${esc(title(s))} · ${s}:${a}${b>a?'–'+b:''}</small></div><small>Перевод смыслов: Э. Кулиев</small><button type="button" id="dailyAyahUnderstand">Понять аят →</button><button type="button" id="quranDirect">Открыть Коран</button></div></details>`;
   byId('dailyAyahUnderstand').onclick=()=>open({view:'detail',s,a,b});byId('quranDirect').onclick=()=>open();
  }catch{card.innerHTML='<span>АЯТ ДНЯ</span><p>Не удалось загрузить текст.</p><button type="button" id="dailyAyahRetry">Повторить</button>';byId('dailyAyahRetry').onclick=updateDaily;}
 }
 function create(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='quranDialog';dialog.className='quran-dialog';dialog.setAttribute('aria-label','Коран');dialog.setAttribute('dir','ltr');
  dialog.innerHTML='<header><button type="button" id="quranBack">← Назад</button><span class="quran-header-title">'+bookEmblem+'<strong id="quranHeading" translate="no" data-i18n-ignore>Коран</strong></span><button type="button" id="quranClose" aria-label="Закрыть Коран">✕</button></header><div id="quranBody"></div>';
  document.body.append(dialog);byId('quranBack').onclick=back;byId('quranClose').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',e=>{e.preventDefault();back();});dialog.addEventListener('close',()=>{request++;searchRequest++;history=[];opener?.focus();});
 }
 async function open(next={view:'catalog'}){opener=document.activeElement;create();history=[];dialog.showModal();await render(next);}
 function navigate(next){history.push({...state,scroll:byId('quranBody').scrollTop});return render(next);}
 function back(){if(!dialog?.open)return false;if(history.length)render(history.pop());else dialog.close();return true;}
 function settings(){const body=byId('quranBody');body.dataset.mode=mode;body.style.setProperty('--quran-ru-size',size+'px');body.style.setProperty('--quran-ar-size',(size+12)+'px');}
 async function render(next){
  state=next;const token=++request;searchRequest++;const body=byId('quranBody');body.onscroll=null;body.innerHTML='<p role="status">Загрузка…</p>';body.scrollTop=0;byId('quranHeading').textContent='Коран';settings();
  try{
   await ensure();if(token!==request)return;
   if(next.view==='catalog'){catalog(body);if(next.scroll!==undefined)body.scrollTop=next.scroll;return;}
   const {s,a=1,b=a}=next;if(!Number.isInteger(s)||!index[s-1]||a<1||a>index[s-1].count||b<a||b>index[s-1].count)throw Error('reference');
   const data=await get(s+'.json');if(token!==request)return;
   byId('quranHeading').textContent=title(s);
   if(next.view==='detail'){
    body.dataset.mode='both';body.innerHTML=`<p class="quran-breadcrumb">Аят <span aria-hidden="true">›</span> Толкование <span aria-hidden="true">›</span> Коран</p><section translate="no" data-i18n-ignore>${data.verses.filter(v=>v.number>=a&&v.number<=b).map(v=>verseHTML(v,s)).join('')}<small>Перевод смыслов: Э. Кулиев</small></section><button type="button" id="quranReadSurah">Читать суру с этого аята →</button><h2>Толкование ас-Саади</h2><p class="quran-source-note">Абдуррахман ас-Саади · Русское издание</p><p id="quranTafsirStatus" class="quran-source-note" role="status">Загрузка толкования…</p><section id="quranTafsir" lang="ru" dir="ltr" translate="no" data-i18n-ignore></section><details class="quran-source-details"><summary>Источник толкования</summary><p id="quranTafsirEdition"></p><a href="https://quranenc.com/en/browse/russian_saadi/${s}#aya-${a}" target="_blank" rel="noopener noreferrer">QuranEnc.com · Открыть источник ↗</a></details><button type="button" id="quranContinue">Продолжить чтение суры →</button>`;
    byId('quranReadSurah').onclick=byId('quranContinue').onclick=()=>navigate({view:'reader',s,a});
    try{const tafsir=await get('tafsir/'+s+'.json');if(token!==request)return;const blocks=tafsir.blocks.filter(v=>v.ayas.some(n=>n>=a&&n<=b));if(!blocks.length)throw Error('missing');byId('quranTafsirEdition').textContent='Абдуррахман ас-Саади · QuranEnc.com · '+tafsir.version;
     const status=byId('quranTafsirStatus');status.textContent=blocks.some(x=>x.kind==='commentary')?'':'Отдельный комментарий к этому аяту в источнике не указан.';status.hidden=!status.textContent;
     byId('quranTafsir').innerHTML=blocks.map(v=>tafsirHTML(v,data.verses.length)).join('');
    }catch{if(token===request)byId('quranTafsirStatus').textContent='Толкование не загрузилось. Можно открыть его в источнике по ссылке ниже.';}
   }else{
    body.innerHTML=`<details class="quran-reader-settings"><summary>Настройки чтения</summary><label>Режим чтения <select id="quranMode"><option value="both">Оригинал + перевод Кулиева</option><option value="arabic">Арабский оригинал</option><option value="translation">Перевод Кулиева</option></select></label><label>Размер текста <input id="quranSize" type="range" min="16" max="30" value="${size}"></label><form id="quranJump"><label>Перейти к аяту <input type="number" id="quranAyaNumber" min="1" max="${data.verses.length}" value="${a}" required></label><button>Перейти</button></form></details><p class="quran-source-note" translate="no" data-i18n-ignore>Арабский оригинал · Перевод смыслов Э. Кулиева</p><section translate="no" data-i18n-ignore>${data.verses.map(v=>verseHTML(v,s).replace('</article>',`<div class="quran-verse-actions"><button type="button" data-tafsir="${v.number}">Толкование</button><button type="button" data-bookmark="${v.number}" aria-pressed="${bookmarks.some(x=>x.s===s&&x.a===v.number)}">${bookmarks.some(x=>x.s===s&&x.a===v.number)?'★ Закладка':'☆ В закладки'}</button></div></article>`)).join('')}</section><nav class="quran-surah-nav"><button type="button" id="quranPrevious" ${s===1?'disabled':''}>← Предыдущая сура</button><button type="button" id="quranNext" ${s===114?'disabled':''}>Следующая сура →</button></nav>`;
    byId('quranMode').value=mode;byId('quranMode').onchange=e=>{mode=e.target.value;save('mode',mode);settings();};
    byId('quranSize').oninput=e=>{size=+e.target.value;save('size',size);settings();};
    const jump=n=>{body.querySelector('#quran-verse-'+n)?.scrollIntoView?.({block:'start'});save('last',{s,a:n});};
    byId('quranJump').onsubmit=e=>{e.preventDefault();const n=+byId('quranAyaNumber').value;if(Number.isInteger(n)&&n>0&&n<=data.verses.length)jump(n);};
    body.querySelectorAll('[data-tafsir]').forEach(el=>el.onclick=()=>navigate({view:'detail',s,a:+el.dataset.tafsir}));
    body.querySelectorAll('[data-bookmark]').forEach(el=>el.onclick=()=>{const n=+el.dataset.bookmark,exists=bookmarks.some(x=>x.s===s&&x.a===n);bookmarks=bookmarks.filter(x=>x.s!==s||x.a!==n);if(!exists)bookmarks.push({s,a:n});save('bookmarks',bookmarks);el.textContent=exists?'☆ В закладки':'★ Закладка';el.setAttribute('aria-pressed',String(!exists));save('last',{s,a:n});});
    byId('quranPrevious').onclick=()=>navigate({view:'reader',s:s-1,a:1});byId('quranNext').onclick=()=>navigate({view:'reader',s:s+1,a:1});
    jump(a);if(next.scroll!==undefined)body.scrollTop=next.scroll;
    body.onscroll=()=>{if(state.view!=='reader')return;const top=body.getBoundingClientRect().top;const visible=[...body.querySelectorAll('.quran-verse')].find(el=>el.getBoundingClientRect().bottom>top+30);if(visible)save('last',{s,a:+visible.id.split('-').pop()});};
   }
  }catch{if(token!==request)return;body.textContent='Не удалось загрузить текст. ';const retry=document.createElement('button');retry.textContent='Повторить';retry.onclick=()=>render(next);body.append(retry);}
 }
 function catalog(body){
  body.dataset.mode='both';body.onscroll=null;
  body.innerHTML='<div class="quran-catalog-intro">'+bookEmblem+'<div><h2>Священный Коран</h2><p>114 сур · Арабский оригинал<br>Перевод смыслов Эльмира Кулиева</p></div></div><button type="button" id="quranResume" hidden>Продолжить чтение</button><details><summary>Мои закладки</summary><div id="quranBookmarks"></div></details><label>Поиск суры, аята или текста перевода<input id="quranSearch" type="search" placeholder="Аль-Кахф, 18:10 или слово"></label><button type="button" id="quranSearchText">Искать в переводе Кулиева</button><p id="quranSearchStatus" role="status"></p><div id="quranList"></div><details><summary>Источники текстов</summary><p>Арабский оригинал: quran-uthmani. Перевод смыслов: Эльмир Кулиев, ru.kuliev. Издания предоставлены AlQuran Cloud.</p><p>Тафсир: Абдуррахман ас-Саади, русское издание QuranEnc.com. Тексты отображаются без машинного перевода и пересказа.</p><a href="https://alquran.cloud/terms-and-conditions" target="_blank" rel="noopener noreferrer">AlQuran Cloud · условия</a><br><a href="https://quranenc.com/en/browse/russian_saadi" target="_blank" rel="noopener noreferrer">QuranEnc.com · источник и условия</a></details>';
  const list=byId('quranList'),input=byId('quranSearch'),status=byId('quranSearchStatus');
  const link=(text,s,a=1,surah=null)=>{const b=document.createElement('button');b.type='button';if(surah){b.className='quran-surah-link';b.innerHTML='<span class="quran-ayah-number">'+s+'</span><span class="quran-surah-name" lang="ru" translate="no" data-i18n-ignore>'+esc(surah.name)+'<small>'+ayahCount(surah.count)+'</small></span><span class="quran-surah-arabic" lang="ar" dir="rtl" translate="no">'+esc(surah.arabic)+'</span>';}else b.textContent=text;b.onclick=()=>navigate({view:'reader',s,a});list.append(b);};
  const last=read('last',null);if(last&&index[last.s-1]&&last.a>0&&last.a<=index[last.s-1].count){const b=byId('quranResume');b.hidden=false;b.textContent=`Продолжить: ${title(last.s)} · ${last.s}:${last.a}`;b.onclick=()=>navigate({view:'reader',...last});}
  const marks=byId('quranBookmarks');for(const p of bookmarks){if(!index[p.s-1]||p.a<1||p.a>index[p.s-1].count)continue;const b=document.createElement('button');b.textContent=`${title(p.s)} · ${p.s}:${p.a}`;b.onclick=()=>navigate({view:'reader',...p});marks.append(b);}if(!marks.children.length)marks.textContent='Закладок пока нет.';
  function filter(){searchRequest++;list.replaceChildren();status.textContent='';const query=input.value.trim().toLowerCase(),ref=query.match(/^(\d{1,3})[:.](\d{1,3})$/);if(ref){const s=+ref[1],a=+ref[2];if(index[s-1]&&a>0&&a<=index[s-1].count)link(`${title(s)} · ${s}:${a}`,s,a);else status.textContent='Такого аята нет.';return;}
   const matches=index.filter(v=>[v.number,v.name,v.arabic,v.latin].some(x=>String(x).toLowerCase().includes(query)));matches.forEach(v=>link(`${v.number}. ${v.name}`,v.number,1,v));if(!matches.length)status.textContent='Сура не найдена. Нажмите «Искать в переводе Кулиева» для поиска по тексту.';
  }
  input.oninput=filter;filter();
  byId('quranSearchText').onclick=async()=>{const query=input.value.trim().toLowerCase();if(query.length<2){status.textContent='Введите не менее двух букв.';return;}const token=++searchRequest;list.replaceChildren();status.textContent='Поиск по 114 сурам…';try{
   // Bounded batches prevent 114 simultaneous requests on a phone.
   let found=0;for(let i=0;i<114;i+=6){const batch=await Promise.all(index.slice(i,i+6).map(v=>get(v.number+'.json')));if(token!==searchRequest||state.view!=='catalog')return;for(const data of batch)for(const v of data.verses)if(v.translation.toLowerCase().includes(query)){found++;if(found<=150)link(`${data.number}:${v.number} · ${v.translation}`,data.number,v.number);}}
   status.textContent=`Найдено аятов: ${found}${found>150?'. Показаны первые 150. Уточните запрос.':''}`;
  }catch{if(token===searchRequest)status.textContent='Поиск не завершён. Проверьте соединение и повторите.';}};
 }
 window.ummaQuran={open,back,isOpen:()=>!!dialog?.open,dateKey,dayIndex};
 updateDaily();setInterval(updateDaily,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateDaily();});window.addEventListener('focus',updateDaily);
})();
