import assert from 'node:assert/strict';
import {createGuestTracker} from '../src/delivery/guest-tracking.mjs';
assert.throws(()=>createGuestTracker({endpoint:'http://bad',token:'a'.repeat(64)}));
assert.throws(()=>createGuestTracker({endpoint:'https://example.org',token:'order-123'}));
let got=null;
const t=createGuestTracker({endpoint:'https://example.org',token:'a'.repeat(64),onUpdate:d=>got=d,onError:e=>{throw e;},fetcher:async()=>({ok:true,json:async()=>({ok:true,state:'waiting'})})});
t.start();await new Promise(r=>setTimeout(r,20));t.stop();assert.equal(got.state,'waiting');
console.log('Guest tracker tests passed');
