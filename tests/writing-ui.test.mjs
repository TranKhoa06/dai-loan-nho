// Behavioral integration of the actual writing view with deterministic DOM/renderer doubles.
// This verifies lifecycle and grading boundaries; it is not a browser layout or stroke-recognition test.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { buildWritingWords, createWritingAttempt } from '../src/writing-model.js';
import { lessons, grammar, sources, pronunciation } from '../src/curriculum.js';
import { scenarios } from '../src/tutor.js';
import { localAIInfo } from '../src/local-ai.js';

const raw = await readFile(new URL('../src/writing.js', import.meta.url), 'utf8');
const source = raw.replace(/^import .*;\r?\n/gm, '')
  .replace('export function mountWritingPractice', 'function mountWritingPractice')
  .replace("import('../assets/vendor/hanzi-writer.esm.js')", 'Promise.resolve({ default: FakeWriter })');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const data = () => ({ strokes: ['M 0 0 L 100 100', 'M 0 100 L 100 0'], medians: [[[0,0],[100,100]],[[0,100],[100,0]]] });

function harness(load = async () => data()) {
  const events = new Map(), nodes = new Map(), writers = [], requests = [], practiced = [], speech = [], freehands = [];
  let html = '', buttons = [];
  const node = () => ({ textContent: '', innerHTML: '', value: 0, hidden: true, dataset: {}, clientWidth: 360, focus() {} });
  const root = {
    set innerHTML(value) {
      html = value;
      nodes.clear();
      for (const selector of ['.wp-status','.wp-actions','.wp-progress-label','progress','.wp-grid','.wp-sequence','.wp-diagrams']) nodes.set(selector, node());
      buttons = [...value.matchAll(/class="wp-word" data-word="(\d+)"/g)].map(match => {
        const check = node();
        return { dataset: { word: match[1] }, querySelector: () => check, setAttribute(name, value) { this[name] = value; } };
      });
    },
    get innerHTML() { return html; },
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, node());
      return nodes.get(selector);
    },
    querySelectorAll(selector) { return selector === '.wp-word' ? buttons : []; },
    addEventListener(type, callback) { events.set(type, callback); },
    removeEventListener(type, callback) { if (events.get(type) === callback) events.delete(type); },
    contains() { return true; },
  };
  class FakeWriter {
    static create(grid, character, options) {
      const instance = new FakeWriter();
      Object.assign(instance, { grid, character, options, destroyed: false, highlights: [], dimensions: [] });
      writers.push(instance);
      return instance;
    }
    quiz(callbacks) { this.callbacks = callbacks; }
    destroy() { this.destroyed = true; }
    showCharacter() { return Promise.resolve(); }
    hideCharacter() { return Promise.resolve(); }
    animateStroke(stroke) { (this.animated ||= []).push(stroke); return Promise.resolve(); }
    highlightStroke(stroke) { this.highlights.push(stroke); return Promise.resolve(); }
    updateDimensions(dimensions) { this.dimensions.push(dimensions); }
    pauseAnimation() { this.paused = true; }
    resumeAnimation() { this.paused = false; }
  }
  const context = vm.createContext({
    FakeWriter, buildWritingWords, createWritingAttempt,
    loadStrokeData(character, options) { requests.push({ character, ...options }); return load(character, options, requests.length); },
    mountFreehand() {
      const sheet = { undone: 0, cleared: 0, downloaded: 0, destroyed: false,
        undo() { this.undone++; }, clear() { this.cleared++; }, download() { this.downloaded++; }, destroy() { this.destroyed = true; } };
      freehands.push(sheet); return sheet;
    },
    AbortController, console,
  });
  vm.runInContext(source + '\nglobalThis.mountForTest = mountWritingPractice;', context);
  const lesson = {
    id: 'greetings',
    writing: [{ han:'你好',pinyin:'nǐ hǎo',vi:'xin chào' },{ han:'學',pinyin:'xué',vi:'học' }],
    vocabulary: [{ han:'你好',pinyin:'nǐ hǎo',vi:'xin chào' },{ han:'臺灣',pinyin:'Táiwān',vi:'Đài Loan' }],
  };
  const controller = context.mountForTest(root, {
    lesson, settings: { pinyin:true,zhuyin:false }, practiced: [],
    onPractice(character, allDone) { practiced.push({ character, allDone }); return true; },
    onSpeak(character) { speech.push(character); },
  });
  return {
    root, nodes, writers, requests, practiced, speech, freehands, controller,
    click(dataset) { events.get('click')?.({ target: { closest: () => ({ dataset }) } }); },
    change(selector, value) { events.get('change')?.({ target: { matches: s => s === selector, value } }); },
    listenerCount: () => events.size,
    status: () => nodes.get('.wp-status').textContent,
    lastWriter: () => writers.at(-1),
  };
}

test('Writing view splits multi-character words and keeps test mode free of outlines/diagrams', async () => {
  const h = harness();
  await tick();
  assert.equal(h.lastWriter().character, '你');
  assert.ok(h.root.innerHTML.includes('data-char="0"') && h.root.innerHTML.includes('data-char="1"'));
  h.click({ char:'1' });
  await tick();
  assert.equal(h.lastWriter().character, '好');
  h.click({ mode:'test' });
  await tick();
  assert.equal(h.lastWriter().options.showCharacter, false);
  assert.equal(h.lastWriter().options.showOutline, false);
  assert.equal(h.nodes.get('.wp-sequence').hidden, true);
  assert.ok(h.lastWriter().callbacks);
  h.controller.destroy();
});

test('Real writing callbacks cannot complete early, repeat completion credit, or award preview credit', async () => {
  const h = harness();
  await tick();
  h.click({ wp:'play' });
  await tick();
  assert.equal(h.practiced.length, 0, 'Watching the model must not mark the character as practiced');
  h.click({ mode:'trace' });
  await tick();
  const quiz = h.lastWriter().callbacks;
  quiz.onCorrectStroke({ strokeNum:1 });
  quiz.onComplete();
  assert.equal(h.practiced.length, 0, 'An out-of-order callback must not bypass the actual stroke sequence');
  quiz.onCorrectStroke({ strokeNum:0 });
  quiz.onComplete();
  assert.equal(h.practiced.length, 0, 'An early complete callback must not mark the character finished');
  quiz.onCorrectStroke({ strokeNum:0 });
  quiz.onCorrectStroke({ strokeNum:1 });
  quiz.onComplete();
  quiz.onComplete();
  assert.deepEqual(h.practiced, [{ character:'你',allDone:false }]);
  assert.match(h.status(), /2\/2/);
  h.controller.destroy();
});

test('Changing writing mode invalidates callbacks from the old grader session', async () => {
  const h = harness();
  await tick();
  h.click({ mode:'trace' });
  await tick();
  const old = h.lastWriter();
  h.click({ mode:'test' });
  await tick();
  const status = h.status();
  assert.equal(old.destroyed, true);
  old.callbacks.onCorrectStroke({ strokeNum:0 });
  old.callbacks.onMistake({ strokeNum:0,mistakesOnStroke:2 });
  old.callbacks.onCorrectStroke({ strokeNum:1 });
  old.callbacks.onComplete();
  assert.equal(h.status(), status);
  assert.equal(h.practiced.length, 0);
  h.controller.destroy();
});

test('Late load from a previous character cannot replace the newly selected character', async () => {
  const first = deferred(), second = deferred();
  const h = harness((_char, _options, count) => count === 1 ? first.promise : second.promise);
  h.click({ word:'1' });
  assert.equal(h.requests[0].signal.aborted, true);
  second.resolve(data());
  await tick();
  assert.equal(h.lastWriter().character, '學');
  first.resolve(data());
  await tick();
  assert.equal(h.writers.length, 1, 'The older response must not mount an obsolete writer');
  assert.equal(h.lastWriter().character, '學');
  h.controller.destroy();
});

test('Leaving the writing view aborts pending work and prevents subsequent UI writes', async () => {
  const pending = deferred();
  const h = harness(() => pending.promise);
  const before = h.status();
  h.controller.destroy();
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.listenerCount(), 0);
  pending.resolve(data());
  await tick();
  assert.equal(h.writers.length, 0);
  assert.equal(h.status(), before);
  assert.equal(h.practiced.length, 0);
});

test('Hint feedback is counted and freehand tools never award verified completion', async () => {
  const h = harness();
  await tick();
  h.click({ mode:'trace' });
  await tick();
  h.click({ wp:'hint' });
  assert.deepEqual(h.lastWriter().highlights, [0]);
  h.lastWriter().callbacks.onMistake({ strokeNum:0,mistakesOnStroke:2 });
  assert.deepEqual(h.lastWriter().highlights, [0,0]);
  h.lastWriter().callbacks.onCorrectStroke({ strokeNum:0 });
  h.lastWriter().callbacks.onCorrectStroke({ strokeNum:1 });
  h.lastWriter().callbacks.onComplete();
  assert.match(h.status(), /1 lần thử lại · 2 gợi ý/);
  h.click({ mode:'free' });
  await tick();
  const free = h.freehands.at(-1);
  h.click({ wp:'undo' }); h.click({ wp:'clear' }); h.click({ wp:'download' });
  assert.deepEqual([free.undone,free.cleared,free.downloaded], [1,1,1]);
  assert.equal(h.practiced.length, 1);
  h.controller.destroy();
  assert.equal(free.destroyed, true);
});

test('Expanded vocabulary keeps core lesson completion separate from extra words', async () => {
  const h = harness();
  await tick();
  h.change('.wp-scope','all');
  await tick();
  assert.ok(h.root.innerHTML.includes('臺灣'));
  assert.equal(h.nodes.get('.wp-progress-label').textContent, '0/3 chữ trọng tâm');
  h.click({ mode:'test' });
  await tick();
  for (let index=0;index<3;index++) {
    const quiz = h.lastWriter().callbacks;
    quiz.onCorrectStroke({ strokeNum:0 });quiz.onCorrectStroke({ strokeNum:1 });quiz.onComplete();
    h.click({ wp:'next' });
    await tick();
  }
  assert.deepEqual(h.practiced.map(result=>result.character), ['你','好','學']);
  assert.equal(h.practiced.at(-1).allDone, true);
  assert.equal(h.nodes.get('.wp-progress-label').textContent, '3/3 chữ trọng tâm');
  assert.equal(h.lastWriter().character, '臺');
  h.controller.destroy();
});

const appSource = (await readFile(new URL('../src/app.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
function appHarness() {
  const events = new Map(), nodes = new Map(), mounted = [], completions = [];
  let saves = 0, markup = '';
  const classes = () => ({ add() {}, remove() {}, toggle() {} });
  const node = () => ({ innerHTML:'',textContent:'',dataset:{},classList:classes() });
  const app = node();
  Object.defineProperty(app, 'innerHTML', { get:()=>markup, set(value) {
    markup=value;
    nodes.delete('#writing-practice');
    const match=value.match(/id="writing-practice" data-lesson="([^"]+)"/);
    if(match)nodes.set('#writing-practice',{...node(),dataset:{lesson:match[1]}});
  }});
  nodes.set('#app',app);
  for(const selector of ['#toast','#main','.lesson-completion strong','button[data-tab="writing"]'])nodes.set(selector,node());
  const state={name:'bạn',completed:{},writing:{greetings:['我']},reviews:{},activities:{},lastLesson:'greetings',settings:{pinyin:true,zhuyin:false,rate:.85,endpoint:''}};
  class Audio {stop(){}getStatus(){return {message:'',hasTaiwanVoice:true};}getVoices(){return [];}ready(){return Promise.resolve([]);}subscribe(callback){callback();}speak(){return Promise.resolve();}}
  class Speech {constructor(){this.supported=false;}abort(){}stop(){}}
  const location={hash:'#writing'};
  const context=vm.createContext({
    lessons,grammar,sources,pronunciation,scenarios,localAIInfo,state,location,
    AudioController:Audio,SpeechInput:Speech,
    mountWritingPractice(root,options){const control={root,options,destroyed:false,destroy(){this.destroyed=true;}};mounted.push(control);return control;},
    save:()=>{saves++;return true;},complete:(id,skill)=>{(state.completed[id]||={})[skill]=true;completions.push({id,skill});},
    activity(){},review(){},importState(){},resetState(){},
    stats:()=>({total:0,finished:0,streak:0,today:0,days:[],mastered:0,percent:0}),
    supportedLocalAI:()=>({supported:false,reason:''}),loadLocalAI(){},askLocalAI(){},unloadLocalAI(){},askAI(){},
    document:{title:'',body:{classList:classes()},querySelector:q=>nodes.get(q)||null,querySelectorAll:()=>[],addEventListener:(type,fn)=>events.set(type,fn)},
    window:{addEventListener:(type,fn)=>events.set(type,fn),scrollTo(){}},localStorage:{getItem:()=>null,setItem(){}},
    AbortController,DOMException,URL,Intl,Date,console,setTimeout:()=>1,clearTimeout(){},
  });
  vm.runInContext(appSource,context);
  return {state,mounted,completions,nodes,saves:()=>saves,
    changeLesson(id){events.get('change')({target:{id:'skill-lesson',value:id}});},
    navigate(hash){location.hash=hash;events.get('hashchange')();},
  };
}

test('App mounts saved writing progress and only credits a completed practice lesson once', () => {
  const h=appHarness();
  assert.equal(h.mounted.length,1);
  const {options}=h.mounted[0];
  assert.equal(options.lesson.id,'greetings');
  assert.deepEqual(options.practiced,['我']);
  assert.equal(h.completions.length,0,'Opening the writing page must not award lesson completion');
  options.onPractice('你',false);
  options.onPractice('你',false);
  assert.deepEqual(h.state.writing.greetings,['我','你']);
  assert.equal(h.completions.length,0);
  options.onPractice('好',true);
  options.onPractice('好',true);
  assert.deepEqual(h.state.writing.greetings,['我','你','好']);
  assert.deepEqual(h.completions,[{id:'greetings',skill:'writing'}]);
  assert.equal(h.state.completed.greetings.writing,true);
  assert.ok(h.saves()>0,'Practiced characters must be persisted for progress backup');
});

test('App destroys the previous writing session on lesson changes and navigation', () => {
  const h=appHarness();
  const first=h.mounted[0];
  h.changeLesson('family');
  assert.equal(first.destroyed,true);
  assert.equal(h.mounted.at(-1).options.lesson.id,'family');
  assert.deepEqual(Array.from(h.mounted.at(-1).options.practiced),[]);
  const second=h.mounted.at(-1);
  h.navigate('#home');
  assert.equal(second.destroyed,true);
  assert.equal(h.mounted.length,2,'Leaving writing must not create an invisible grader session');
});
