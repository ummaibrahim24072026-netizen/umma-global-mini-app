import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';import assert from 'node:assert/strict';
const c={};vm.createContext(c);vm.runInContext(stripTypeScriptTypes(readFileSync('supabase/functions/rent-service/payment.ts','utf8').replace('export function','function'))+';this.make=rentalPayment;',c);
const payment=c.make({id:'qa',reference:'UMMAR123ABCDEF12',amount_vnd:1200000,status:'pending'});
function parse(s){const out={};for(let p=0;p<s.length;){const len=Number(s.slice(p+2,p+4));assert.ok(Number.isInteger(len)&&len>=0);out[s.slice(p,p+2)]=s.slice(p+4,p+4+len);p+=4+len;assert.ok(p<=s.length);}return out;}
const fields=parse(payment.qrPayload);assert.equal(fields['54'],'1200000');assert.equal(fields['53'],'704');assert.equal(parse(fields['62'])['08'],'UMMAR123ABCDEF12');assert.equal(parse(parse(fields['38'])['01'])['01'],'1062679069');
let crc=65535;for(const ch of payment.qrPayload.slice(0,-4)){crc^=ch.charCodeAt(0)<<8;for(let i=0;i<8;i++)crc=((crc&32768)?(crc<<1)^4129:crc<<1)&65535;}assert.equal(fields['63'],crc.toString(16).toUpperCase().padStart(4,'0'));
for(const change of [{amount_vnd:0},{amount_vnd:1.2},{reference:'UMMA 123<script>'}])assert.throws(()=>c.make({...payment,...change}));console.log('PASS rental VietQR: recipient, bank, VND, exact invoice amount/reference and EMV CRC.');
