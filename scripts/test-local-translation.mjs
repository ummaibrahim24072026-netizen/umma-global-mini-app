import {pipeline} from '@huggingface/transformers';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const models=[['en-ru','Hello, how are you?'],['vi-en','Xin chào, tôi muốn đặt món ăn.']];
for(const [pair,input] of models){
 console.log('Loading translation',pair);
 const translate=await pipeline('translation','Xenova/opus-mt-'+pair,{device:'cpu',dtype:'q8'});
 const result=await translate(input,{max_new_tokens:80});
 assert.ok(result?.[0]?.translation_text?.length>2);
 console.log(pair,'->',result[0].translation_text);
}
const wav='/tmp/umma-test.wav';
execFileSync('espeak',['-v','en','-s','125','-w',wav,'Hello I would like to order food']);
const whisper=await pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{device:'cpu',dtype:'q8'});
const result=await whisper(wav,{task:'translate'});
assert.ok(result?.text?.trim().length>4);
console.log('Whisper result',result.text);
