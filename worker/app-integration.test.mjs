// Unit integration of the actual app module. This is not a browser/layout test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { lessons, grammar, sources, pronunciation } from '../src/curriculum.js';
import { scenarios } from '../src/tutor.js';
import { localAIInfo } from '../src/local-ai.js';

const source = (await readFile(new URL('../src/app.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
function harness(askAI = async () => ({ reply: '你好！' }), local = {}) {
  const events = new Map();
  const nodes = new Map();
  const classes = () => ({ add() {}, remove() {}, toggle() {} });
  for (const selector of ['#app', '#main', '#toast', '#chat-messages', '#chat-input']) nodes.set(selector, { innerHTML: '', textContent: '', value: '', dataset: {}, scrollHeight: 0, classList: classes() });
  const document = { title: '', body: { classList: classes() }, querySelector: (selector) => nodes.get(selector) || null, querySelectorAll: () => [], addEventListener: (type, callback) => events.set(type, callback) };
  let activities = 0;
  const localCalls = { load: [], ask: [], unload: [] };
  const state = { name: 'bạn', completed: {}, reviews: {}, activities: {}, lastLesson: '', settings: { pinyin: true, zhuyin: false, rate: 0.85, endpoint: 'https://tutor.example' } };
  class FakeAudio {
    stop() {}
    getStatus() { return { message: '', hasTaiwanVoice: true }; }
    getVoices() { return []; }
    speak() { return Promise.resolve({ cancelled: false }); }
    subscribe(callback) { callback(); return () => {}; }
    ready() { return Promise.resolve([]); }
  }
  class FakeSpeech { constructor() { this.supported = false; } abort() {} stop() {} }
  const context = vm.createContext({
    lessons, grammar, sources, pronunciation, scenarios, askAI,
    localAIInfo,
    supportedLocalAI: local.supportedLocalAI || (() => ({ supported: true, reason: 'Test GPU available' })),
    loadLocalAI: async (args) => { localCalls.load.push(args); if(local.loadLocalAI)return local.loadLocalAI(args); args.onProgress?.({ stage:'ready',progress:1,text:'Ready' }); return {}; },
    askLocalAI: async (args) => { localCalls.ask.push(args); return local.askLocalAI ? local.askLocalAI(args) : { reply:'你好！這是本機模型的回答。' }; },
    unloadLocalAI: async () => { localCalls.unload.push(true); return local.unloadLocalAI?.(); },
    AudioController: FakeAudio, SpeechInput: FakeSpeech,
    state, save: () => {}, complete: () => {}, activity: () => { activities++; }, review: () => {},
    stats: () => ({ total: 0, finished: 0, streak: 0, today: 0, days: [], mastered: 0, percent: 0 }),
    importState: () => {}, resetState: () => {},
    document, location: { hash: '#tutor' }, window: { addEventListener() {}, scrollTo() {} },
    MutationObserver: class { observe() {} },
    localStorage: { getItem: () => null, setItem() {} },
    AbortController, DOMException, URL, setTimeout, clearTimeout, Intl, Date, console, confirm: () => true,
  });
  vm.runInContext(source + `\nglobalThis.__appTest = {
    sendAIMessage, resetChat, addGuidedMessage, guidedSuggestions, chatBubble, tutorPage,
    messages: () => chatMessages,
    status: () => ({ chatBusy, chatTurns, chatScenario, chatMode, hasController: Boolean(chatController), localAIReady, localAILoading, localAIUnloading, localAIReport }),
    setMode: value => { chatMode = value; resetChat(); },
    setToken: value => { aiToken = value; },
    token: () => aiToken,
  };`, context);
  return {
    app: context.__appTest, nodes, state, localCalls, activities: () => activities,
    click: (dataset) => events.get('click')({ target: { closest: () => ({ dataset, classList: classes() }) } }),
    change: (target) => events.get('change')({ target }),
  };
}

test('guided conversation opens with its first question before suggested answers', async () => {
  const h = harness();
  for (const scenario of scenarios) {
    await h.click({ scenario: scenario.id });
    assert.ok(h.app.messages().some((message) => message.han === scenario.turns[0].prompt.han), `Missing initial question for ${scenario.id}`);
  }
});

test('completed guided scenario has no repeating suggestions or extra completion credit', () => {
  const h = harness();
  const scenario = scenarios[0];
  for (const turn of scenario.turns) h.app.addGuidedMessage(turn.suggestions[0].han);
  assert.equal(h.app.guidedSuggestions(scenario).length, 0);
  assert.equal(h.app.status().chatTurns, scenario.turns.length);
  const activities = h.activities();
  h.app.addGuidedMessage(scenario.turns.at(-1).suggestions[0].han);
  assert.equal(h.activities(), activities);
  assert.equal(h.app.status().chatTurns, scenario.turns.length);
});

test('late cancellation from old scenario cannot clear a newer pending request', async () => {
  const calls = [];
  const h = harness((args) => new Promise((resolve, reject) => calls.push({ args, resolve, reject })));
  h.app.setMode('ai');
  const old = h.app.sendAIMessage('舊的問題');
  await h.click({ scenario: 'tea' });
  const current = h.app.sendAIMessage('新的問題');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].args.signal.aborted, true);
  calls[0].reject(new DOMException('Cancelled old request', 'AbortError'));
  await old;
  assert.equal(h.app.status().chatBusy, true);
  assert.equal(h.app.status().hasController, true);
  assert.ok(!h.app.messages().some((message) => /Cancelled|舊的問題/.test(message.content || '')));
  calls[1].resolve({ reply: '新的回覆' });
  await current;
  assert.equal(h.app.status().chatBusy, false);
  assert.equal(h.app.messages().at(-1).content, '新的回覆');
});

test('late successful reply from old scenario cannot enter the new conversation', async () => {
  const calls = [];
  const h = harness((args) => new Promise((resolve) => calls.push({ args, resolve })));
  h.app.setMode('ai');
  const old = h.app.sendAIMessage('舊的問題');
  await h.click({ scenario: 'restaurant' });
  calls[0].resolve({ reply: '這是舊的回覆' });
  await old;
  assert.ok(!h.app.messages().some((message) => message.content === '這是舊的回覆'));
});

test('model output stays escaped text inside conversation bubbles', () => {
  const h = harness();
  const html = h.app.chatBubble({ role: 'assistant', content: '<img src=x onerror=alert(1)>你好' });
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});

test('opening tutor and selecting local mode never starts a hidden model download', async () => {
  const h = harness();
  assert.equal(h.localCalls.load.length, 0);
  await h.change({ id:'chat-mode', value:'local' });
  assert.equal(h.localCalls.load.length, 0);
  assert.match(h.app.tutorPage(), /352 MB/);
  assert.match(h.app.tutorPage(), /id="chat-input"[^>]* disabled/);
  await h.app.sendAIMessage('你好');
  assert.equal(h.localCalls.ask.length, 0);
  assert.equal(h.localCalls.load.length, 0);
});

test('explicit local download enables actual local helper without a server endpoint', async () => {
  let remoteCalls = 0;
  const h = harness(async () => { remoteCalls++; return { reply:'Remote' }; });
  h.state.settings.endpoint = '';
  await h.change({ id:'chat-mode', value:'local' });
  await h.click({ action:'load-local-ai' });
  assert.equal(h.localCalls.load.length, 1);
  assert.equal(h.app.status().localAIReady, true);
  assert.ok(!/id="chat-input"[^>]* disabled/.test(h.app.tutorPage()));
  await h.app.sendAIMessage('請問你好怎麼說？');
  assert.equal(h.localCalls.ask.length, 1);
  assert.equal(remoteCalls, 0);
  assert.equal(h.app.messages().at(-1).content, '你好！這是本機模型的回答。');
  assert.equal(h.localCalls.ask[0].scenario, scenarios[0].id);
});

test('unsupported local AI stays disabled and explains the available alternative', async () => {
  const h = harness(undefined, { supportedLocalAI: () => ({ supported:false, reason:'GPU unavailable; use guided mode' }) });
  await h.change({ id:'chat-mode', value:'local' });
  assert.match(h.app.tutorPage(), /GPU unavailable/);
  await h.click({ action:'load-local-ai' });
  assert.equal(h.localCalls.load.length, 0);
  assert.equal(h.app.status().localAIReady, false);
});

test('cancelled model load cannot enable chat when its stale promise completes', async () => {
  let resolveLoad;
  const h = harness(undefined, { loadLocalAI: () => new Promise((resolve) => { resolveLoad=resolve; }) });
  await h.change({ id:'chat-mode', value:'local' });
  const pending = h.click({ action:'load-local-ai' });
  assert.equal(h.app.status().localAILoading, true);
  await h.click({ action:'cancel-local-ai' });
  assert.equal(h.localCalls.load[0].signal.aborted, true);
  resolveLoad({});
  await pending;
  assert.equal(h.app.status().localAIReady, false);
  assert.equal(h.app.status().localAILoading, false);
});

test('changing away from local mode aborts a pending model load', async () => {
  let resolveLoad;
  const h = harness(undefined, { loadLocalAI: () => new Promise((resolve) => { resolveLoad=resolve; }) });
  await h.change({ id:'chat-mode', value:'local' });
  const pending = h.click({ action:'load-local-ai' });
  await h.change({ id:'chat-mode', value:'guided' });
  assert.equal(h.localCalls.load[0].signal.aborted, true);
  resolveLoad({});
  await pending;
  assert.equal(h.app.status().chatMode, 'guided');
  assert.equal(h.app.status().localAIReady, false);
});

test('local load progress and failures are visible without claiming readiness', async () => {
  const h = harness(undefined, { loadLocalAI: async ({ onProgress }) => {
    onProgress({ stage:'downloading',progress:0.5,text:'Downloading test files' });
    throw new Error('GPU test failure');
  } });
  await h.change({ id:'chat-mode', value:'local' });
  await h.click({ action:'load-local-ai' });
  assert.equal(h.app.status().localAIReady, false);
  assert.equal(h.app.status().localAILoading, false);
  assert.equal(h.app.status().localAIReport.stage, 'error');
  assert.match(h.app.tutorPage(), /GPU test failure/);
});

test('local reply cancellation uses the same stale-request guard as server AI', async () => {
  let resolveReply;
  const h = harness(undefined, { askLocalAI: () => new Promise((resolve) => { resolveReply=resolve; }) });
  await h.change({ id:'chat-mode', value:'local' });
  await h.click({ action:'load-local-ai' });
  const pending = h.app.sendAIMessage('舊的問題');
  await h.click({ scenario:'tea' });
  assert.equal(h.localCalls.ask[0].signal.aborted, true);
  resolveReply({ reply:'不應該出現的舊回答' });
  await pending;
  assert.ok(!h.app.messages().some((message) => message.content==='不應該出現的舊回答'));
});

test('free-memory action unloads the model and disables local chat until explicitly loaded again', async () => {
  const h = harness();
  await h.change({ id:'chat-mode', value:'local' });
  await h.click({ action:'load-local-ai' });
  await h.click({ action:'unload-local-ai' });
  assert.equal(h.localCalls.unload.length, 1);
  assert.equal(h.app.status().localAIReady, false);
  assert.match(h.app.tutorPage(), /id="chat-input"[^>]* disabled/);
  assert.equal(h.localCalls.load.length, 1);
});

test('resetting or importing progress clears the memory-only server access token', async () => {
  const h = harness();
  h.app.setToken('test-memory-token');
  await h.click({ action:'reset-progress' });
  assert.equal(h.app.token(), '');
  h.app.setToken('second-test-token');
  await h.change({ id:'import-progress', files:[{ size:100,text:async()=>JSON.stringify({ version:1 }) }] });
  assert.equal(h.app.token(), '');
});
