import test from 'node:test';
import assert from 'node:assert/strict';
import { mountFreehand } from '../src/writing-free.js';

// Canvas spies exercise vector preservation and input lifecycle without browser automation.
function harness() {
  let width = 300, resizeCallback, disconnected = false;
  const listeners = new Map(), capture = new Set(), anchors = [];
  const context = {
    paths: [], current: [],
    setTransform() {}, setLineDash() {}, fillText() {},
    fillRect() { this.paths = []; },
    beginPath() { this.current = []; },
    moveTo(...point) { this.current.push(['move', ...point]); },
    lineTo(...point) { this.current.push(['line', ...point]); },
    stroke() { this.paths.push([...this.current]); },
  };
  const canvas = {
    style: {}, attributes: {}, removed: false,
    setAttribute(key, value) { this.attributes[key] = value; },
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height: width }),
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
    setPointerCapture(id) { capture.add(id); },
    hasPointerCapture(id) { return capture.has(id); },
    releasePointerCapture(id) { capture.delete(id); listeners.get('lostpointercapture')?.({ pointerId: id }); },
    remove() { this.removed = true; },
    toDataURL: () => 'data:image/png;base64,canvas',
  };
  const document = {
    defaultView: {
      devicePixelRatio: 2,
      ResizeObserver: class {
        constructor(callback) { resizeCallback = callback; }
        observe() {}
        disconnect() { disconnected = true; }
      },
    },
    createElement(tag) {
      if (tag === 'canvas') return canvas;
      const anchor = { clicked: false, click() { this.clicked = true; } };
      anchors.push(anchor); return anchor;
    },
  };
  const host = { ownerDocument: document, replaceChildren(node) { this.child = node; }, getBoundingClientRect: () => ({ width }) };
  const api = mountFreehand(host, '學');
  return {
    api, canvas, context, anchors, listeners,
    disconnected: () => disconnected,
    resize(value) { width = value; resizeCallback(); },
    emit(type, data = {}) { listeners.get(type)?.({ pointerId: 1, pointerType: 'pen', button: 0, clientX: 30, clientY: 40, preventDefault() {}, ...data }); },
  };
}

test('freehand keeps drawn vectors through a high-DPI resize and supports undo', () => {
  const h = harness();
  assert.equal(h.canvas.width, 600);
  h.emit('pointerdown');
  h.emit('pointerup', { clientX: 170, clientY: 220 });
  const original = [...h.context.paths.at(-1)];
  assert.equal(h.context.paths.length, 5, 'Four guide lines plus one drawn stroke');
  h.resize(400);
  assert.equal(h.canvas.width, 800);
  assert.deepEqual(h.context.paths.at(-1), original, 'Resizing must not erase or distort practice strokes');
  h.api.undo();
  assert.equal(h.context.paths.length, 4);
  h.api.destroy();
});

test('cancelled pointer input is discarded and an extra finger cannot create a second stroke', () => {
  const h = harness();
  h.emit('pointerdown');
  h.emit('pointerdown', { pointerId: 2 });
  h.emit('pointerup', { pointerId: 2 });
  h.emit('pointercancel');
  assert.equal(h.context.paths.length, 4);
  h.emit('pointerdown', { pointerType: 'mouse', button: 2 });
  h.emit('pointerup', { pointerType: 'mouse', button: 2 });
  assert.equal(h.context.paths.length, 4, 'Right-click is not a writing stroke');
  h.api.destroy();
});

test('clear removes practice marks and PNG export stays local to the selected character', () => {
  const h = harness();
  h.emit('pointerdown'); h.emit('pointerup');
  assert.equal(h.api.download(), true);
  assert.equal(h.anchors.length, 1);
  assert.equal(h.anchors[0].href, 'data:image/png;base64,canvas');
  assert.equal(h.anchors[0].download, 'tap-viet-學.png');
  assert.equal(h.anchors[0].clicked, true);
  h.api.clear();
  assert.equal(h.context.paths.length, 4);
  h.api.destroy();
});

test('destroy detaches all pointer handlers and ignores late resize work', () => {
  const h = harness();
  h.emit('pointerdown');
  h.api.destroy(); h.api.destroy();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.disconnected(), true);
  assert.equal(h.canvas.removed, true);
  const size = h.canvas.width;
  h.resize(600);
  assert.equal(h.canvas.width, size);
  assert.equal(h.api.download(), false);
  assert.equal(h.anchors.length, 0);
});
