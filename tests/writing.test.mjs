import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { lessons } from '../src/curriculum.js';
import { validateState } from '../src/state.js';
import {
  splitHanzi, buildWritingWords, validateStrokeData, loadStrokeData, createWritingAttempt,
} from '../src/writing-model.js';

const strokeData = () => ({
  strokes: ['M 0 0 L 100 100', 'M 0 100 L 100 0'],
  medians: [[[0, 0], [100, 100]], [[0, 100], [100, 0]]],
});
const response = data => ({ ok: true, status: 200, json: async () => data });

test('Writing word splitting handles Traditional Chinese, punctuation and astral Han characters', () => {
  assert.deepEqual(splitHanzi('你好，臺灣！A1 𠮷🙂'), ['你', '好', '臺', '灣', '𠮷']);
  assert.deepEqual(splitHanzi('中文 中文'), ['中', '文', '中', '文']);
  assert.deepEqual(splitHanzi(' 123 / abc '), []);
  assert.deepEqual(splitHanzi(''), []);
});

test('Writing targets preserve textbook writing words and add vocabulary only when selected', () => {
  const unit = {
    writing: [{ han: '你好', pinyin: 'nǐ hǎo', vi: 'xin chào' }, { han: '學', pinyin: 'xué', vi: 'học' }],
    vocabulary: [{ han: '你好', pinyin: 'nǐ hǎo', vi: 'xin chào' }, { han: '臺灣', pinyin: 'Táiwān', vi: 'Đài Loan' }],
  };
  const before = JSON.stringify(unit);
  const main = buildWritingWords(unit);
  assert.deepEqual(main.map(item => item.han), ['你好', '學']);
  assert.ok(!main.some(item => item.han === '臺灣'));
  const expanded = buildWritingWords(unit, true);
  assert.deepEqual(expanded.map(item => item.han), ['你好', '學', '臺灣']);
  assert.equal(JSON.stringify(unit), before, 'Building writing targets must not mutate the curriculum');
});

test('Every curriculum writing/vocabulary Han character has bundled, structurally valid stroke data', async () => {
  const wanted = new Set(lessons.flatMap(unit => [...unit.writing, ...unit.vocabulary].flatMap(word => splitHanzi(word.han))));
  assert.equal(wanted.size, 175, 'The bundled data must cover this revision of the full curriculum');
  const directory = new URL('../assets/hanzi-data/', import.meta.url);
  const files = new Set(await readdir(directory));
  for (const character of wanted) {
    assert.ok(files.has(`${character}.json`), `Missing local stroke data for ${character}`);
    const data = JSON.parse(await readFile(new URL(`${encodeURIComponent(character)}.json`, directory), 'utf8'));
    assert.equal(validateStrokeData(data), data, `${character}: valid data should retain the parsed object`);
    assert.equal(data.strokes.length, data.medians.length, `${character}: one median is required per stroke`);
  }
});

test('Stroke data validation rejects malformed paths, mismatched counts and unusable medians', () => {
  assert.equal(validateStrokeData(strokeData()).strokes.length, 2);
  const invalid = [
    null, {}, [], { strokes: [], medians: [] },
    { strokes: ['M 0 0 L 1 1'], medians: [] },
    { strokes: ['<svg onload="alert(1)">'], medians: [[[0, 0], [1, 1]]] },
    { strokes: ['M 0 0 L 1 1'], medians: [[[0, 0]]] },
    { strokes: ['M 0 0 L 1 1'], medians: [[[0, 0], [Infinity, 1]]] },
    { strokes: ['M 0 0 L 1 1'], medians: [[[0, 0], ['1', 1]]] },
  ];
  for (const data of invalid) assert.throws(() => validateStrokeData(data));
});

test('Stroke loading uses a relative bundled URL and a failed response can be retried', async () => {
  let calls = 0;
  const urls = [];
  const fetchImpl = async (url, options) => {
    calls++;
    urls.push(String(url));
    assert.ok(!options?.method || options.method === 'GET');
    if (calls === 1) return { ok: false, status: 503, json: async () => ({}) };
    return response(strokeData());
  };
  await assert.rejects(loadStrokeData('我', { fetchImpl }));
  const loaded = await loadStrokeData('我', { fetchImpl });
  assert.equal(loaded.strokes.length, 2);
  assert.equal(calls, 2, 'A failed request must not poison retry state');
  assert.ok(urls.every(url => url.includes('hanzi-data/') && decodeURIComponent(url).endsWith('我.json')));
  assert.ok(urls.every(url => !/https?:\/\/[^/]*(?:jsdelivr|unpkg|hanziwriter)/i.test(url)), 'Runtime writing must use bundled data');
});

test('Invalid JSON data is not cached and an aborted writing request can be retried', async () => {
  let calls = 0;
  const fetchImpl = async () => response(++calls === 1 ? { strokes: [], medians: [] } : strokeData());
  await assert.rejects(loadStrokeData('你', { fetchImpl }));
  assert.equal((await loadStrokeData('你', { fetchImpl })).strokes.length, 2);
  assert.equal(calls, 2);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadStrokeData('好', { fetchImpl: async (_url, options) => {
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return response(strokeData());
  }, signal: controller.signal }));
  assert.equal((await loadStrokeData('好', { fetchImpl: async () => response(strokeData()) })).strokes.length, 2);
});

test('Stroke loader rejects a whole word rather than silently choosing its first character', async () => {
  let requested = false;
  await assert.rejects(loadStrokeData('你好', { fetchImpl: async () => { requested = true; return response(strokeData()); } }));
  assert.equal(requested, false);
});

test('Writing attempt credits ordered strokes once and cannot finish early', () => {
  let completions = 0;
  const attempt = createWritingAttempt({ character: '學', mode: 'trace', total: 3, onComplete: () => completions++ });
  attempt.correct(2);
  assert.equal(attempt.snapshot().correct, 0, 'A later stroke must not bypass earlier strokes');
  attempt.finish();
  assert.equal(attempt.snapshot().finished, false);
  assert.equal(completions, 0);
  attempt.correct(0);
  attempt.correct(0);
  assert.equal(attempt.snapshot().correct, 1, 'Duplicate callbacks cannot award duplicate progress');
  attempt.mistake();
  attempt.hint();
  attempt.correct(1);
  attempt.correct(2);
  attempt.finish();
  attempt.finish();
  assert.deepEqual(
    { correct: attempt.snapshot().correct, mistakes: attempt.snapshot().mistakes, hints: attempt.snapshot().hints, finished: attempt.snapshot().finished },
    { correct: 3, mistakes: 1, hints: 1, finished: true },
  );
  assert.equal(completions, 1, 'One completed character should produce exactly one completion callback');
});

test('Model animation and freehand mode do not award verified writing completion', () => {
  for (const mode of ['model', 'free']) {
    let completions = 0;
    const attempt = createWritingAttempt({ character: '人', mode, total: 2, onComplete: () => completions++ });
    attempt.correct(0);
    attempt.correct(1);
    attempt.finish();
    assert.equal(completions, 0, `${mode} mode should not pretend to grade handwriting`);
  }
});

test('Disposed writing sessions ignore late grader, error, hint and completion callbacks', () => {
  let completions = 0;
  const attempt = createWritingAttempt({ character: '人', mode: 'test', total: 2, onComplete: () => completions++ });
  attempt.correct(0);
  attempt.dispose();
  const state = attempt.snapshot();
  attempt.correct(1);
  attempt.mistake();
  attempt.hint();
  attempt.finish();
  assert.deepEqual(attempt.snapshot(), state, 'Late callbacks must not mutate an abandoned session');
  assert.equal(completions, 0);
});

test('Writing progress survives export/import with unique single-character targets and safe lesson keys', () => {
  const input = JSON.parse('{"version":1,"writing":{"greetings":["你","好","你","你好","123",""],"family":["家","人"],"__proto__":["假"],"constructor":["假"],"prototype":["假"],"not-a-real-lesson":["假"]}}');
  const result = validateState(input);
  assert.deepEqual(result.writing.greetings, ['你', '好']);
  assert.deepEqual(result.writing.family, ['家', '人']);
  for (const key of ['__proto__', 'constructor', 'prototype', 'not-a-real-lesson']) assert.ok(!Object.hasOwn(result.writing, key));
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(result))).writing, result.writing);
  const legacy = validateState({ version: 1, completed: { greetings: { vocabulary: true } } });
  assert.deepEqual(legacy.writing, {});
  assert.equal(legacy.completed.greetings.vocabulary, true, 'Older progress backups should remain compatible');
});
