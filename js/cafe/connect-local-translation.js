/* UMMA: local, no paid API. Model files download from Hugging Face on first use. */
(()=>{'use strict';
const models=new Map();
const base='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
let library=null;
const getLib=()=>library||(library=import(base));
const pairs=new Set(['ru-en','en-ru','vi-en','en-vi']);
const getPipe=async(name,model)=>{
 const key=name+'|'+model;
 if(!models.has(key)){
  const work=(async()=>{const {pipeline}=await getLib();return pipeline(name,model,{device:'wasm',dtype:'q8'});})();
  models.set(key,work);
  work.catch(()=>models.delete(key));
 }
 return models.get(key);
};
async function detect(text){
 if(!text?.trim())return 'en';
 if(globalThis.LanguageDetector){
  try{const d=await LanguageDetector.create();const r=await d.detect(text);d.destroy?.();if(r?.[0]?.confidence>.65&&['ru','vi','en'].includes(r[0].detectedLanguage))return r[0].detectedLanguage;}catch{}
 }
 if(/[а-яё]/i.test(text))return 'ru';
 if(/[ăâđêôơưĂÂĐÊÔƠƯàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i.test(text))return 'vi';
 return 'en';
}
async function translate(text,target,source){
 const to=(target||'en').split('-')[0],from=source||await detect(text);
 if(!['ru','vi','en'].includes(to))throw Error('local_language_unsupported');
 if(!['ru','vi','en'].includes(from))throw Error('local_source_unsupported');
 if(from===to)return text;
 const route=from==='en'||to==='en'?[from,to]:[from,'en',to];
 let result=text;
 for(let i=0;i<route.length-1;i++){
  const pair=route[i]+'-'+route[i+1];
  if(!pairs.has(pair))throw Error('local_pair_unsupported');
  const pipe=await getPipe('translation','Xenova/opus-mt-'+pair);
  const output=await pipe(result,{max_new_tokens:240});
  result=output?.[0]?.translation_text||'';
  if(!result)throw Error('local_translation_empty');
 }
 return result;
}
async function voice(url,target){
 const transcriber=await getPipe('automatic-speech-recognition','onnx-community/whisper-tiny');
 const response=await fetch(url);
 if(!response.ok)throw Error('audio_download_failed');
 const buffer=await response.arrayBuffer();
 if(buffer.byteLength>12*1024*1024)throw Error('audio_too_large');
 const audioContext=new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000});
 let samples;
 try{
  const decoded=await audioContext.decodeAudioData(buffer.slice(0));
  const length=Math.ceil(decoded.duration*16000);
  if(length>16000*90)throw Error('audio_too_long');
  const offline=new OfflineAudioContext(1,length,16000);
  const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const converted=await offline.startRendering();samples=converted.getChannelData(0);
 }finally{await audioContext.close();}
 const output=await transcriber(samples,{task:'translate',chunk_length_s:25});
 const english=output?.text?.trim();
 if(!english)throw Error('transcription_empty');
 const text=await translate(english,target,'en');
 return {status:'ready',text,url:null,local:true};
}
function speak(text,lang){
 if(!('speechSynthesis'in window))return false;
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(text);
 u.lang=({ru:'ru-RU',vi:'vi-VN',en:'en-US'})[lang]||lang;
 u.rate=.95;
 speechSynthesis.speak(u);
 return true;
}
window.ummaLocalTranslate={translate,voice,speak,detect};
})();