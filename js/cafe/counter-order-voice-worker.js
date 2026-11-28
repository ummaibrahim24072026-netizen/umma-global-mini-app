import synthesize from '../vendor/counter-speech/espeak-ng.js';

const model = fetch(new URL('../vendor/counter-speech/espeak-ng.wasm', import.meta.url))
  .then(response => {
    if (!response.ok) throw new Error('Counter speech unavailable');
    return response.arrayBuffer();
  })
  .catch(() => null);

self.onmessage = async ({data: message, ports: [reply]}) => {
  try {
    const wasm = await model;
    if (!wasm) throw new Error('Counter speech unavailable');
    const engine = await synthesize({
      wasmBinary: new Uint8Array(wasm),
      arguments: ['-v', 'ru', '-s', '158', '-w', 'order.wav', '--', message],
    });
    const wave = engine.FS.readFile('order.wav').buffer;
    reply.postMessage(wave, [wave]);
  } catch {
    reply.postMessage(null);
  } finally {
    reply.close();
  }
};
