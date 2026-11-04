import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('js/core/welcome-audio.js', 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup({blocked = false, hidden = false} = {}) {
  const dom = new JSDOM('<html><body></body></html>', {url: 'https://qa.invalid/umma/', runScripts: 'outside-only'});
  const w = dom.window;
  const gestures = new Map();
  const add = w.document.addEventListener.bind(w.document);
  const remove = w.document.removeEventListener.bind(w.document);
  w.document.addEventListener = (type, fn, opts) => { if (['click','touchend','keydown'].includes(type)) gestures.set(type, fn); add(type, fn, opts); };
  w.document.removeEventListener = (type, fn, opts) => { if (gestures.get(type) === fn) gestures.delete(type); remove(type, fn, opts); };
  Object.defineProperty(w.document, 'currentScript', {value: {src: 'https://qa.invalid/umma/js/core/welcome-audio.js?v=1'}});
  Object.defineProperty(w.document, 'visibilityState', {get: () => hidden ? 'hidden' : 'visible'});
  let calls = 0, pauses = 0;
  w.Audio = class { constructor(url) { assert.equal(url, 'https://qa.invalid/umma/assets/audio/welcome-ru.mp3'); } play() { calls++; return blocked ? Promise.reject(new w.DOMException('Gesture required','NotAllowedError')) : Promise.resolve(); } pause() { pauses++; } };
  w.eval(source);
  return {w, gestures, calls: () => calls, pauses: () => pauses, allow() {blocked = false;}, visibility(value) {hidden = value; w.document.dispatchEvent(new w.Event('visibilitychange'));}};
}
{
  const t = setup(); await tick();
  assert.equal(t.calls(), 1); assert.equal(t.gestures.size, 0);
  t.w.ummaWelcomeAudio.play(); t.w.eval(source); await tick();
  assert.equal(t.calls(), 1, 'navigation and duplicate scripts must not repeat greeting');
  t.visibility(true); t.visibility(false); await tick();
  assert.equal(t.calls(), 1); assert.ok(t.pauses() > 0);
  t.w.dispatchEvent(new t.w.Event('pagehide'));
  t.w.ummaWelcomeAudio.play(); assert.equal(t.calls(), 1);
  t.w.close();
}
{
  const t = setup({blocked: true}); await tick();
  assert.equal(t.calls(), 1); assert.equal(t.gestures.size, 3);
  t.gestures.get('click')({isTrusted: false}); assert.equal(t.calls(), 1);
  t.allow(); t.gestures.get('touchend')({isTrusted: true});
  assert.equal(t.calls(), 2, 'play must start synchronously within the user gesture');
  await tick(); assert.equal(t.gestures.size, 0);
  t.w.close();
}
{
  const t = setup({hidden: true}); await tick(); assert.equal(t.calls(), 0);
  t.visibility(false); await tick(); assert.equal(t.calls(), 1); t.w.close();
}
for (const path of ['index.html', 'staff.html', 'menu/index.html']) {
  const html = readFileSync(path, 'utf8');
  assert.equal((html.match(/src="js\/core\/welcome-audio\.js\?v=1"/g) || []).length, 1);
  const doc = new JSDOM(html, {url: `https://qa.invalid/umma/${path}`});
  assert.equal(doc.window.document.querySelector('script[src*="welcome-audio"]').src, 'https://qa.invalid/umma/js/core/welcome-audio.js?v=1');
  doc.window.close();
}
assert.ok(readFileSync('assets/audio/welcome-ru.mp3').length > 1000);
console.log('PASS welcome audio: autoplay, trusted gesture fallback, single playback, hidden-page handling, all entry URLs and bundled MP3.');
