import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';

const read=path=>readFileSync(path,'utf8');
const db=new PGlite();
await db.exec(`
 CREATE ROLE anon;
 CREATE ROLE authenticated;
 CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.cafe_web_accounts(actor_id bigint PRIMARY KEY);
 CREATE TABLE public.locations(id uuid PRIMARY KEY);
 CREATE TABLE public.cafe_order_events(id uuid PRIMARY KEY, to_status text, note text, created_at timestamptz);
 INSERT INTO public.cafe_web_accounts VALUES (1);
 INSERT INTO public.locations VALUES ('10000000-0000-0000-0000-000000000001');
`);
await db.exec(read('supabase/migrations/20261120094509_cafe_pickup_board.sql'));
await db.exec('SET ROLE service_role');
const oldToken='a'.repeat(64),newToken='b'.repeat(64);
for(const token of [oldToken,newToken]){
 await db.query(`
  INSERT INTO public.cafe_pickup_screens VALUES (1,'10000000-0000-0000-0000-000000000001',$1)
  ON CONFLICT (actor_id,location_id) DO UPDATE SET token_hash=excluded.token_hash
 `,[token]);
}
assert.deepEqual((await db.query('SELECT token_hash FROM public.cafe_pickup_screens')).rows,[{token_hash:newToken}]);
await db.exec('RESET ROLE; SET ROLE anon');
await assert.rejects(db.query('SELECT token_hash FROM public.cafe_pickup_screens'),/permission denied/);
await db.close();

const page=read('pickup-board.html');
const script=read('js/cafe/pickup-board.js');
const dom=new JSDOM(page,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://qa.invalid/pickup-board.html#screen='+newToken});
const {window:w}=dom,d=w.document;
w.AbortSignal=AbortSignal;
let calls=[{id:'old',number:164}],status=200,nextPoll,requests=0;
const spoken=[],speech=[];
w.setTimeout=(fn,delay)=>{if(delay===3000)nextPoll=fn;return delay;};
w.clearTimeout=()=>{};
w.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
w.speechSynthesis={speak(utterance){spoken.push(utterance.text);speech.push(utterance);},cancel(){}};
w.fetch=async(url,options)=>{
 requests++;
 assert.match(url,/\/cafe-pickup-board$/);
 assert.deepEqual(JSON.parse(options.body),{action:'poll',token:newToken});
 return Response.json({ok:status===200,calls},{status});
};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const numbers=()=>[...d.querySelectorAll('#boardCalls li')].map(li=>li.textContent);
w.eval(script);
await tick();
assert.equal(requests,1);
assert.deepEqual(numbers(),['№164']);
assert.equal(w.location.hash,'');
assert.equal(w.localStorage.getItem('umma:pickup-board-token'),newToken);
d.getElementById('boardSound').click();
speech.shift().onend();
assert.deepEqual(spoken,['Звук табло включён.']);
calls=[{id:'second',number:166},{id:'first',number:165},...calls];
await nextPoll();
assert.deepEqual(numbers(),['№166','№165','№164']);
assert.deepEqual(spoken.slice(1),['Заказ номер 165 готов. Заберите на стойке выдачи.']);
speech.shift().onend();
assert.deepEqual(spoken.slice(1),[
 'Заказ номер 165 готов. Заберите на стойке выдачи.',
 'Заказ номер 166 готов. Заберите на стойке выдачи.'
]);
speech.shift().onend();
await nextPoll();
assert.equal(spoken.length,3);
status=503;
await nextPoll();
assert.deepEqual(numbers(),[]);
assert.match(d.getElementById('boardStatus').textContent,/Восстанавливаем связь/);
status=200;
await nextPoll();
assert.deepEqual(numbers(),['№166','№165','№164']);
assert.equal(spoken.length,3);
calls=[];
await nextPoll();
assert.deepEqual(numbers(),[]);
assert.match(d.getElementById('boardStatus').textContent,/Ожидаем/);
status=404;
await nextPoll();
assert.equal(w.localStorage.getItem('umma:pickup-board-token'),null);
assert.match(d.getElementById('boardStatus').textContent,/Табло отключено/);
w.close();
console.log('PASS pickup board: token rotation and private storage, initial snapshot, simultaneous calls, ordered one-time speech, expiry, reconnect and revocation.');
