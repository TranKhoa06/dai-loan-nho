import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import HanziWriter from '../assets/vendor/hanzi-writer.esm.js';

// Exercise the actual vendored loading/animation/listener lifecycle. A small DOM
// surface and a no-op renderer isolate cleanup; these are not visual glyph tests.
class TestNode {
  constructor(name = 'div') {
    this.nodeName = name;
    this.parentNode = null;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
  }

  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  removeChild(node) {
    this.children = this.children.filter(child => child !== node);
    node.parentNode = null;
    return node;
  }

  setAttribute(name, value) { this.attributes.set(name, value); }
  setAttributeNS(_namespace, name, value) { this.setAttribute(name, value); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300 }; }

  set innerHTML(_value) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  listenerCount() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
}

class TestRenderer {
  mount() {}
  render() {}
  destroy() {}
}

const one = JSON.parse(await readFile(new URL('../assets/hanzi-data/一.json', import.meta.url), 'utf8'));
const person = JSON.parse(await readFile(new URL('../assets/hanzi-data/人.json', import.meta.url), 'utf8'));

const defaultOptions = {
  width: 300,
  height: 300,
  padding: 20,
  rendererOverride: { HanziWriterRenderer: TestRenderer },
  strokeFadeDuration: 0,
  delayBetweenStrokes: 0,
  // Keep animation running long enough to exercise cancellation deterministically.
  strokeAnimationSpeed: 0.1,
};

function fixture(context) {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const document = new TestNode('document');
  document.createElementNS = (_namespace, name) => new TestNode(name);
  globalThis.document = document;
  const element = new TestNode();
  const writers = [];

  context.after(() => {
    for (const writer of writers) writer.destroy();
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  });

  return {
    document,
    element,
    create(character = '一', options = {}) {
      const writer = HanziWriter.create(element, character, {
        ...defaultOptions,
        charDataLoader: char => char === '人' ? person : one,
        ...options,
      });
      writers.push(writer);
      return writer;
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(resolvePromise => { resolve = resolvePromise; });
  return { promise, resolve };
}

async function settles(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Canceled library operation remained pending')), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('writer.destroy removes node/document listeners and the generated SVG, and is idempotent', async context => {
  const { document, element, create } = fixture(context);
  const writer = create();
  await writer.getCharacterData();

  const svg = writer.target.node;
  assert.equal(document.listenerCount(), 3, 'mouseup, touchend, and touchcancel listeners should be installed');
  assert.equal(svg.listenerCount(), 4, 'mouse/touch start and move listeners should be installed');
  assert.equal(element.children.length, 1);

  writer.destroy();
  assert.equal(document.listenerCount(), 0);
  assert.equal(svg.listenerCount(), 0);
  assert.equal(element.children.length, 0);
  assert.doesNotThrow(() => writer.destroy());
});

test('destroy settles pending data work and ignores its late load callback', async context => {
  const { document, element, create } = fixture(context);
  const load = deferred();
  let loadCallbacks = 0;
  const writer = create('一', {
    charDataLoader: () => load.promise,
    onLoadCharDataSuccess: () => { loadCallbacks++; },
  });
  const waitingOperation = writer.showCharacter();

  writer.destroy();
  await settles(waitingOperation);
  load.resolve(one);
  await nextTurn();

  assert.equal(loadCallbacks, 0, 'disposed writer must not notify a stale view');
  assert.equal(element.children.length, 0, 'late load must not remount an SVG');
  assert.equal(document.listenerCount(), 0);
});

test('setCharacter settles superseded pending work and ignores the older character response', async context => {
  const { create } = fixture(context);
  const loads = new Map();
  const writer = create('一', {
    charDataLoader: character => {
      const load = deferred();
      loads.set(character, load);
      return load.promise;
    },
  });
  const oldAnimation = writer.animateCharacter();
  const currentLoad = writer.setCharacter('人');

  loads.get('人').resolve(person);
  await currentLoad;
  await settles(oldAnimation);
  loads.get('一').resolve(one);
  await nextTurn();

  assert.equal((await writer.getCharacterData()).symbol, '人');
});

test('destroy settles an active animation and suppresses its completion callback', async context => {
  const { create } = fixture(context);
  let completions = 0;
  const writer = create();
  await writer.getCharacterData();
  const animation = writer.animateCharacter({ onComplete: () => { completions++; } });
  await nextTurn();

  writer.destroy();

  assert.equal((await settles(animation)).canceled, true);
  assert.equal(completions, 0, 'animation must not notify a disposed view');
});

test('destroy settles a looping animation instead of leaving a paused promise pending', async context => {
  const { create } = fixture(context);
  const writer = create();
  await writer.getCharacterData();
  const animation = writer.loopCharacterAnimation();
  await nextTurn();

  writer.destroy();

  assert.equal((await settles(animation)).canceled, true);
});

test('setCharacter suppresses the completion callback of the canceled prior character animation', async context => {
  const { create } = fixture(context);
  let completions = 0;
  const writer = create();
  await writer.getCharacterData();
  const animation = writer.animateCharacter({ onComplete: () => { completions++; } });
  await nextTurn();

  await writer.setCharacter('人');

  assert.equal((await settles(animation)).canceled, true);
  assert.equal(completions, 0, 'old character animation must not notify the new character view');
  assert.equal((await writer.getCharacterData()).symbol, '人');
});
