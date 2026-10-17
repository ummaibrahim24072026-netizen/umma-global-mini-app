/* Quran text is published source material. Never pass it through UI translation. */
(() => {
 'use strict';
 const byId=id=>document.getElementById(id), cache=new Map();
 const get=path=>{if(!cache.has(path)){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);cache.set(path,fetch('assets/quran/'+path,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('load');return r.json();}).catch(e=>{cache.delete(path);throw e;}).finally(()=>clearTimeout(timer)));}return cache.get(path);};
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('umma-quran-'+key))??fallback;}catch{return fallback;}};
 const save=(key,value)=>{try{localStorage.setItem('umma-quran-'+key,JSON.stringify(value));}catch{}};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let index=[],daily=[],today=null,dialog=null,state=null,history=[],request=0,searchRequest=0,opener=null;
 let mode=read('mode','both'),size=read('size',20),bookmarks=read('bookmarks',[]);
 if(!['both','arabic','translation'].includes(mode))mode='both';
 size=Math.min(30,Math.max(16,Number(size)||20));if(!Array.isArray(bookmarks))bookmarks=[];bookmarks=bookmarks.filter(p=>p&&Number.isInteger(p.s)&&p.s>=1&&p.s<=114&&Number.isInteger(p.a)&&p.a>0).slice(0,6236);
 const dateKey=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 function dayIndex(date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return Math.floor(Date.UTC(+p.year,+p.month-1,+p.day)/86400000);}
 let readiness;
 function ensure(){if(!readiness)readiness=Promise.all([get('index.json'),get('daily.json')]).then(([i,d])=>{index=i;daily=d;}).catch(e=>{readiness=null;throw e;});return readiness;}
 const title=n=>index[n-1]?.name||String(n);
 function verseHTML(v,s){return `<article class="quran-verse" id="quran-verse-${v.number}"><h3>${esc(title(s))} · ${s}:${v.number}</h3><p class="quran-arabic" lang="ar" dir="rtl" translate="no">${esc(v.arabic)}</p><p class="quran-translation" lang="ru" dir="ltr" translate="no">${esc(v.translation)}</p></article>`;}
 async function updateDaily(){
  const key=dateKey();if(today?.key===key)return;
  const card=byId('dailyAyahContent');if(!card)return;
  try{await ensure();const [s,a,b]=daily[((dayIndex(new Date())%daily.length)+daily.length)%daily.length];const data=await get(s+'.json');today={key,s,a,b};
   card.innerHTML='<span>АЯТ ДНЯ</span><div class="daily-verse-text" translate="no" data-i18n-ignore>'+data.verses.filter(v=>v.number>=a&&v.number<=b).map(v=>`<p class="quran-arabic" lang="ar" dir="rtl">${esc(v.arabic)}</p><p lang="ru" dir="ltr">${esc(v.translation)}</p>`).join('')+`<small>${esc(title(s))} · ${s}:${a}${b>a?'–'+b:''}</small></div><small>Перевод смыслов: Э. Кулиев</small><button type="button" id="dailyAyahUnderstand">Понять аят →</button><button type="button" id="quranDirect">Открыть Коран</button>`;
   byId('dailyAyahUnderstand').onclick=()=>open({view:'detail',s,a,b});byId('quranDirect').onclick=()=>open();
  }catch{card.innerHTML='<span>АЯТ ДНЯ</span><p>Не удалось загрузить текст.</p><button type="button" id="dailyAyahRetry">Повторить</button>';byId('dailyAyahRetry').onclick=updateDaily;}
 }
 function create(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='quranDialog';dialog.className='quran-dialog';dialog.setAttribute('aria-label','Коран');dialog.setAttribute('dir','ltr');
  dialog.innerHTML='<header><button type="button" id="quranBack">← Назад</button><strong id="quranHeading">Коран</strong><button type="button" id="quranClose" aria-label="Закрыть Коран">✕</button></header><div id="quranBody"></div>';
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
    body.dataset.mode='both';body.innerHTML=`<p>Аят → Толкование → Коран</p><section translate="no" data-i18n-ignore>${data.verses.filter(v=>v.number>=a&&v.number<=b).map(v=>verseHTML(v,s)).join('')}<small>Перевод смыслов: Э. Кулиев</small></section><button type="button" id="quranReadSurah">Читать суру с этого аята →</button><h2>Толкование ас-Саади</h2><p id="quranTafsirStatus" role="status">Загрузка толкования…</p><section id="quranTafsir" lang="ru" dir="ltr" translate="no" data-i18n-ignore></section><p><a href="https://quranenc.com/en/browse/russian_saadi/${s}#aya-${a}" target="_blank" rel="noopener noreferrer">Тафсир в источнике · QuranEnc.com ↗</a></p><button type="button" id="quranContinue">Продолжить чтение суры →</button>`;
    byId('quranReadSurah').onclick=byId('quranContinue').onclick=()=>navigate({view:'reader',s,a});
    try{const tafsir=await get('tafsir/'+s+'.json');if(token!==request)return;const blocks=tafsir.blocks.filter(v=>v.ayas.some(n=>n>=a&&n<=b));if(!blocks.length)throw Error('missing');byId('quranTafsirStatus').textContent='Абдуррахман ас-Саади · QuranEnc.com · '+tafsir.version;
     if(!blocks.some(x=>x.kind==='commentary'))byId('quranTafsirStatus').textContent+=' · Отдельный комментарий к этому аяту в источнике не указан.';
     byId('quranTafsir').innerHTML=blocks.map(v=>`<article><h3>${v.kind==='passage'?'Текст аятов в издании тафсира':v.kind==='introduction'?'Введение к суре':'Толкование'} · ${esc(v.ayas.length>1?v.ayas[0]+'–'+v.ayas[v.ayas.length-1]:v.ayas[0])}</h3><p>${esc(v.text)}</p></article>`).join('');
    }catch{if(token===request)byId('quranTafsirStatus').textContent='Толкование не загрузилось. Можно открыть его в источнике по ссылке ниже.';}
   }else{
    body.innerHTML=`<label>Режим чтения <select id="quranMode"><option value="both">Оригинал + перевод Кулиева</option><option value="arabic">Арабский оригинал</option><option value="translation">Перевод Кулиева</option></select></label><label>Размер текста <input id="quranSize" type="range" min="16" max="30" value="${size}"></label><form id="quranJump"><label>Перейти к аяту <input type="number" id="quranAyaNumber" min="1" max="${data.verses.length}" value="${a}" required></label><button>Перейти</button></form><p translate="no" data-i18n-ignore>Перевод смыслов: Э. Кулиев · ru.kuliev<br>Арабский текст: quran-uthmani · AlQuran Cloud</p><section translate="no" data-i18n-ignore>${data.verses.map(v=>verseHTML(v,s).replace('</article>',`<div class="quran-verse-actions"><button type="button" data-tafsir="${v.number}">Толкование</button><button type="button" data-bookmark="${v.number}" aria-pressed="${bookmarks.some(x=>x.s===s&&x.a===v.number)}">${bookmarks.some(x=>x.s===s&&x.a===v.number)?'★ Закладка':'☆ В закладки'}</button></div></article>`)).join('')}</section><nav class="quran-surah-nav"><button type="button" id="quranPrevious" ${s===1?'disabled':''}>← Предыдущая сура</button><button type="button" id="quranNext" ${s===114?'disabled':''}>Следующая сура →</button></nav>`;
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
  body.innerHTML='<p>114 сур · Арабский оригинал и перевод смыслов Эльмира Кулиева</p><button type="button" id="quranResume" hidden>Продолжить чтение</button><details><summary>Мои закладки</summary><div id="quranBookmarks"></div></details><label>Поиск суры, аята или текста перевода<input id="quranSearch" type="search" placeholder="Аль-Кахф, 18:10 или слово"></label><button type="button" id="quranSearchText">Искать в переводе Кулиева</button><p id="quranSearchStatus" role="status"></p><div id="quranList"></div><details><summary>Источники текстов</summary><p>Арабский оригинал: quran-uthmani. Перевод смыслов: Эльмир Кулиев, ru.kuliev. Издания предоставлены AlQuran Cloud.</p><p>Тафсир: Абдуррахман ас-Саади, русское издание QuranEnc.com. Тексты отображаются без машинного перевода и пересказа.</p><a href="https://alquran.cloud/terms-and-conditions" target="_blank" rel="noopener noreferrer">AlQuran Cloud · условия</a><br><a href="https://quranenc.com/en/browse/russian_saadi" target="_blank" rel="noopener noreferrer">QuranEnc.com · источник и условия</a></details>';
  const list=byId('quranList'),input=byId('quranSearch'),status=byId('quranSearchStatus');
  const link=(text,s,a=1)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>navigate({view:'reader',s,a});list.append(b);};
  const last=read('last',null);if(last&&index[last.s-1]&&last.a>0&&last.a<=index[last.s-1].count){const b=byId('quranResume');b.hidden=false;b.textContent=`Продолжить: ${title(last.s)} · ${last.s}:${last.a}`;b.onclick=()=>navigate({view:'reader',...last});}
  const marks=byId('quranBookmarks');for(const p of bookmarks){if(!index[p.s-1]||p.a<1||p.a>index[p.s-1].count)continue;const b=document.createElement('button');b.textContent=`${title(p.s)} · ${p.s}:${p.a}`;b.onclick=()=>navigate({view:'reader',...p});marks.append(b);}if(!marks.children.length)marks.textContent='Закладок пока нет.';
  function filter(){searchRequest++;list.replaceChildren();status.textContent='';const query=input.value.trim().toLowerCase(),ref=query.match(/^(\d{1,3})[:.](\d{1,3})$/);if(ref){const s=+ref[1],a=+ref[2];if(index[s-1]&&a>0&&a<=index[s-1].count)link(`${title(s)} · ${s}:${a}`,s,a);else status.textContent='Такого аята нет.';return;}
   const matches=index.filter(v=>[v.number,v.name,v.arabic,v.latin].some(x=>String(x).toLowerCase().includes(query)));matches.forEach(v=>link(`${v.number}. ${v.name} · ${v.arabic} (${v.count})`,v.number));if(!matches.length)status.textContent='Сура не найдена. Нажмите «Искать в переводе Кулиева» для поиска по тексту.';
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
