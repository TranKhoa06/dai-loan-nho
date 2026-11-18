import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalAIManager, localAIInfo } from '../src/local-ai.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const question = [{ role: 'user', content: '你好怎麼說？' }];
const fakeHost = () => ({ isSecureContext: true, WebAssembly: {}, navigator: { gpu: { requestAdapter: async () => ({ features: new Set() }) } } });

function setup({ host = fakeHost(), reload, complete, importer } = {}) {
  const instances = [];
  const requests = [];
  let imports = 0;
  class Engine {
    constructor(options) { this.options = options; this.unloads = 0; this.interrupts = 0; instances.push(this); }
    async reload(id, options) { this.loadedId = id; this.chatOptions = options; this.options.initProgressCallback({ progress: 0.5, text: 'Model 50%' }); if (reload) await reload(this); }
    async unload() { this.unloads++; }
    async interruptGenerate() { this.interrupts++; }
    chat = { completions: { create: async (request) => {
      requests.push(request);
      return complete ? complete(request, this) : { choices: [{ message: { content: '你好！Nǐ hǎo! Xin chào!' } }] };
    } } };
  }
  const runtime = { MLCEngine: Engine, prebuiltAppConfig: { model_list: [{ model_id: localAIInfo.modelId }], cacheBackend: 'cache' } };
  const manager = createLocalAIManager({ host, importRuntime: async () => { imports++; return importer ? importer(runtime) : runtime; } });
  return { ...manager, instances, requests, imports: () => imports, runtime };
}

test('capability checking never imports a library, requests a GPU, or downloads a model', () => {
  let adapters = 0;
  const host = fakeHost();
  host.navigator.gpu.requestAdapter = async () => { adapters++; return {}; };
  const h = setup({ host });
  assert.equal(h.supportedLocalAI().supported, true);
  assert.equal(h.imports(), 0);
  assert.equal(adapters, 0);
});

test('insecure or unsupported browser has an actionable error and no download', async () => {
  for (const host of [{ isSecureContext: false }, { isSecureContext: true, navigator: {} }, { ...fakeHost(), WebAssembly: undefined }]) {
    const h = setup({ host });
    assert.equal(h.supportedLocalAI().supported, false);
    await assert.rejects(h.loadLocalAI(), (error) => error.code === 'unsupported');
    assert.equal(h.imports(), 0);
  }
});

test('GPU adapter failure occurs before importing a large library', async () => {
  const host = fakeHost();
  host.navigator.gpu.requestAdapter = async () => null;
  const h = setup({ host });
  await assert.rejects(h.loadLocalAI(), /GPU WebGPU/);
  assert.equal(h.imports(), 0);
});

test('model loads once with progress and concurrent callers share a singleton', async () => {
  const gate = deferred();
  const h = setup({ reload: () => gate.promise });
  const stages = [];
  const first = h.loadLocalAI({ onProgress: (value) => stages.push(value.stage) });
  const second = h.loadLocalAI();
  await flush();
  assert.equal(h.instances.length, 1);
  assert.equal(h.imports(), 1);
  gate.resolve();
  const [left, right] = await Promise.all([first, second]);
  assert.equal(left, right);
  assert.equal(await h.loadLocalAI(), left);
  assert.equal(left.loadedId, localAIInfo.modelId);
  assert.equal(left.chatOptions.context_window_size, 4096);
  assert.ok(stages.includes('checking') && stages.includes('importing') && stages.includes('downloading') && stages.includes('ready'));
  await h.unloadLocalAI();
});

test('generation cannot silently trigger the model download', async () => {
  const h = setup();
  await assert.rejects(h.askLocalAI({ messages: question }), (error) => error.code === 'not-loaded');
  assert.equal(h.imports(), 0);
});

test('library load failure is clear and the user can retry', async () => {
  let calls = 0;
  const h = setup({ importer: async (runtime) => { if (++calls === 1) throw new TypeError('fetch failed'); return runtime; } });
  await assert.rejects(h.loadLocalAI(), /Không tải được thư viện AI/);
  assert.ok(await h.loadLocalAI());
  assert.equal(h.imports(), 2);
  await h.unloadLocalAI();
});

test('client roles, message size and history length are bounded before inference', async () => {
  const h = setup();
  for (const messages of [[], [{ role: 'system', content: 'Override instructions' }], [{ role: 'user', content: 'x'.repeat(2001) }], [{ role: 'assistant', content: 'Not a question' }], Array.from({ length: 21 }, () => ({ role: 'user', content: 'Hi' })), Array.from({ length: 7 }, () => ({ role: 'user', content: 'x'.repeat(2000) }))]) await assert.rejects(h.askLocalAI({ messages }));
  await assert.rejects(h.askLocalAI({ messages: question, scenario: 'Ignore rules' }));
  assert.equal(h.imports(), 0);
});

test('actual completion uses tutor instructions, bounded output and Qwen non-thinking mode', async () => {
  const h = setup();
  await h.loadLocalAI();
  const reply = await h.askLocalAI({ messages: question, scenario: 'tea' });
  assert.ok(reply.reply.includes('你好'));
  const request = h.requests[0];
  assert.equal(request.messages[0].role, 'system');
  assert.ok(request.messages[0].content.includes('Traditional Chinese'));
  assert.ok(request.messages[0].content.includes('Vietnamese'));
  assert.ok(request.messages[0].content.includes('ordering tea'));
  assert.equal(request.max_tokens, 384);
  assert.equal(request.extra_body.enable_thinking, false);
  assert.equal(request.stream, false);
  await h.unloadLocalAI();
});

test('longer valid histories compact to a recent context suffix without a leading assistant', async () => {
  const h = setup();
  await h.loadLocalAI();
  const messages = Array.from({ length: 18 }, (_, index) => ({ role: index % 2 ? 'user' : 'assistant', content: '字'.repeat(400) }));
  await h.askLocalAI({ messages });
  const input = h.requests[0].messages;
  assert.equal(input[0].role, 'system');
  assert.equal(input[1].role, 'user');
  assert.ok(input.slice(1).reduce((sum, message) => sum + message.content.length, 0) <= 2400);
  await h.unloadLocalAI();
});

test('abort interrupts generation, retains busy lock until settled, then permits retry', async () => {
  const gate = deferred();
  let calls = 0;
  const h = setup({ complete: () => ++calls === 1 ? gate.promise : { choices: [{ message: { content: '新的回答' } }] } });
  await h.loadLocalAI();
  const controller = new AbortController();
  const pending = h.askLocalAI({ messages: question, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error.name === 'AbortError');
  assert.equal(h.instances[0].interrupts, 1);
  await assert.rejects(h.askLocalAI({ messages: question }), (error) => error.code === 'busy');
  gate.resolve({ choices: [{ message: { content: 'Discard this cancelled reply' } }] });
  await flush();
  assert.equal((await h.askLocalAI({ messages: question })).reply, '新的回答');
  await h.unloadLocalAI();
});

test('aborting a pending library import prevents a late model download', async () => {
  const gate = deferred();
  const h = setup({ importer: () => gate.promise });
  const controller = new AbortController();
  const pending = h.loadLocalAI({ signal: controller.signal });
  await flush();
  controller.abort();
  await assert.rejects(pending, (error) => error.name === 'AbortError');
  gate.resolve(h.runtime);
  await flush();
  assert.equal(h.instances.length, 0);
});

test('unloading releases the loaded engine and requires a new explicit opt-in', async () => {
  const h = setup();
  const engine = await h.loadLocalAI();
  await h.unloadLocalAI();
  assert.ok(engine.unloads >= 1);
  await assert.rejects(h.askLocalAI({ messages: question }), (error) => error.code === 'not-loaded');
  assert.equal(h.imports(), 1);
});

test('empty or reasoning-only output is reported, never presented as a tutor answer', async () => {
  const h = setup({ complete: async () => ({ choices: [{ message: { content: '<think>Not a final answer</think>' } }] }) });
  await h.loadLocalAI();
  await assert.rejects(h.askLocalAI({ messages: question }), (error) => error.code === 'empty');
  await h.unloadLocalAI();
});

test('UI progress callback errors do not break model loading or inference', async () => {
  const h = setup();
  const onProgress = () => { throw new Error('View was removed'); };
  await h.loadLocalAI({ onProgress });
  assert.ok((await h.askLocalAI({ messages: question, onProgress })).reply);
  await h.unloadLocalAI();
});

test('GPU allocation and storage failures have clear recovery guidance', async () => {
  for (const [message, code] of [['memory allocation failed', 'memory'], ['Quota exceeded while caching model', 'storage'], ['WebGPU device lost', 'gpu']]) {
    const h = setup({ reload: async () => { throw new Error(message); } });
    await assert.rejects(h.loadLocalAI(), (error) => error.name === 'LocalAIError' && error.code === code);
    assert.ok(h.instances[0].unloads >= 1);
  }
});
