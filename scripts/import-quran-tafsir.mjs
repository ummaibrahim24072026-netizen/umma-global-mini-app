/* Import only the authorised published edition. Original lexical content is retained. */
import {parse} from 'parse5';
import {normalizeRussianText} from './quran-russian-text.mjs';
const attr=(el,name)=>el.attrs?.find(x=>x.name===name)?.value||'';
const hasClass=(el,name)=>attr(el,'class').split(/\s+/).includes(name);
function all(root,predicate){const out=[];function walk(n){if(predicate(n))out.push(n);for(const child of n.childNodes||[])walk(child);}walk(root);return out;}
const textContent=el=>el.nodeName==='#text'?el.value:(el.childNodes||[]).map(textContent).join('');
const findClass=(el,name)=>all(el,n=>hasClass(n,name))[0];
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const folder=process.argv[2];if(!folder)throw Error('Provide directory containing original QuranEnc surah HTML files');
const index=JSON.parse(readFileSync('assets/quran/index.json','utf8'));mkdirSync('assets/quran/tafsir',{recursive:true});
const hashes={};
for(const surah of index.filter(s=>!process.argv[3]||s.number===Number(process.argv[3]))){
 const raw=readFileSync(`${folder}/${surah.number}.html`,'utf8');
 hashes[surah.number]=createHash('sha256').update(raw).digest('hex');
 const doc=parse(raw),blocks=[];let pending=[],active=[];
 for(const el of all(doc,n=>hasClass(n,'saadi-anchor')||(n.tagName==='article'&&hasClass(n,'saadi-block')))){
  if(hasClass(el,'saadi-anchor')){const n=Number(attr(el,'id').replace('aya-',''));if(n>0)pending.push(n);continue;}
  const text=normalizeRussianText(textContent(findClass(el,'saadi-text')||{}).trim());if(!text)continue;
  if(hasClass(el,'saadi-passage')){
   const nums=textContent(findClass(el,'saadi-block-label')||{}).match(/\d+/g)?.map(Number)||[];
   if(!nums.length)throw Error('Missing passage coordinates '+surah.number);
   active=Array.from({length:(nums[1]||nums[0])-nums[0]+1},(_,i)=>nums[0]+i);pending=[];
  }else if(pending.length){active=pending;pending=[];}
  const introduction=!active.length;
  if(introduction)active=Array.from({length:surah.count},(_,i)=>i+1);
  if(active.some(n=>!Number.isInteger(n)||n<1||n>surah.count))throw Error('Invalid source coordinates');
  blocks.push({ayas:[...active],kind:introduction?'introduction':hasClass(el,'saadi-passage')?'passage':'commentary',text});
 }
 const commentary=new Set(blocks.filter(x=>x.kind==='commentary').flatMap(x=>x.ayas));
 const missing=Array.from({length:surah.count},(_,i)=>i+1).filter(n=>!commentary.has(n));
 const covered=new Set(blocks.flatMap(x=>x.ayas));if(covered.size!==surah.count)throw Error('Missing source passages '+surah.number);
 writeFileSync(`assets/quran/tafsir/${surah.number}.json`,JSON.stringify({version:'V1.0.0 · 27.07.2026',source:`https://quranenc.com/en/browse/russian_saadi/${surah.number}`,withoutSeparateCommentary:missing,blocks}));
}


if(!process.argv[3]){writeFileSync('assets/quran/tafsir-source-hashes.json',JSON.stringify(hashes,null,2));console.log('Imported 114 surahs with complete source-passage coverage and source hashes.');}
