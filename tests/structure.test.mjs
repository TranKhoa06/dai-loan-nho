import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { lessons, grammar, sources, pronunciation } from '../src/curriculum.js';
import { validateState, loadState, save } from '../src/state.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = (value, label) => assert.ok(typeof value === 'string' && value.trim(), `${label} must be nonempty text`);
const uniqueIds = (list, label) => {
  assert.ok(Array.isArray(list) && list.length, `${label} must be a nonempty array`);
  assert.equal(new Set(list.map(x => x.id)).size, list.length, `${label} contains duplicate ids`);
  list.forEach(x => text(x.id, `${label}.id`));
};

test('Curriculum has 15 textbook companion lessons and complete bilingual learning fields', () => {
  uniqueIds(lessons, 'lessons');
  assert.equal(lessons.length, 15, 'Contemporary Chinese volume 1 has 15 companion lessons');
  for (const lesson of lessons) {
    for (const key of ['title', 'subtitle', 'level', 'theme']) text(lesson[key], `${lesson.id}.${key}`);
    assert.ok(lesson.minutes > 0 && Number.isFinite(lesson.minutes));
    assert.ok(lesson.vocabulary.length >= 4, `${lesson.id} has too few words`);
    for (const item of [...lesson.vocabulary, ...lesson.dialogue, lesson.reading, ...lesson.writing]) {
      for (const key of ['han', 'pinyin', 'vi']) text(item[key], `${lesson.id}.${key}`);
    }
    assert.ok(lesson.dialogue.length >= 2, `${lesson.id} must support conversation practice`);
    assert.ok(lesson.writing.length, `${lesson.id} must support handwriting practice`);
  }
});

test('Quiz answers resolve to one real choice and include an explanation', () => {
  for (const lesson of lessons) {
    assert.ok(lesson.quiz.length, `${lesson.id} has no quiz`);
    for (const question of lesson.quiz) {
      text(question.question, `${lesson.id}.question`);
      text(question.explanation, `${lesson.id}.explanation`);
      assert.ok(Array.isArray(question.choices) && question.choices.length >= 2);
      assert.equal(new Set(question.choices).size, question.choices.length, 'Duplicate choices make scoring ambiguous');
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, `${lesson.id} answer is outside choices`);
      question.choices.forEach(choice => text(choice, `${lesson.id}.choice`));
    }
  }
});

test('Every grammar lesson and companion lesson has valid source references', () => {
  uniqueIds(grammar, 'grammar');
  uniqueIds(sources, 'sources');
  const sourceIds = new Set(sources.map(x => x.id));
  for (const source of sources) {
    text(source.title, 'source.title');
    assert.equal(new URL(source.url).protocol, 'https:', `Source must use HTTPS: ${source.id}`);
  }
  for (const item of [...lessons, ...grammar]) {
    assert.ok(item.sourceIds?.length, `${item.id} has no source`);
    for (const id of item.sourceIds) assert.ok(sourceIds.has(id), `Unknown source ${id} in ${item.id}`);
  }
  for (const item of grammar) {
    for (const key of ['title', 'pattern', 'explanation', 'pitfall']) text(item[key], `${item.id}.${key}`);
    assert.ok(item.examples.length);
    item.examples.forEach(example => ['han', 'pinyin', 'vi'].forEach(key => text(example[key], `${item.id}.example.${key}`)));
  }
  assert.ok(pronunciation.tones.length >= 4);
});

test('Book sequence and grammar links resolve to the corresponding companion lesson', () => {
  for (const [index, lesson] of lessons.entries()) {
    assert.equal(lesson.bookNumber, index + 1);
    text(lesson.bookTitleHan, `${lesson.id}.bookTitleHan`);
    assert.ok(Number.isInteger(lesson.bookPage) && lesson.bookPage > 0);
    assert.ok(Number.isInteger(lesson.pdfPage) && lesson.pdfPage > 0);
    assert.ok(lesson.grammarIds?.length, `${lesson.id} has no linked grammar`);
    for (const id of lesson.grammarIds) {
      const point = grammar.find(item => item.id === id);
      assert.ok(point, `Missing grammar ${id}`);
      assert.equal(point.bookNumber, lesson.bookNumber, `Grammar ${id} belongs to a different book lesson`);
      assert.ok(point.lessonIds.includes(lesson.id));
    }
  }
  for (const point of grammar) for (const id of point.lessonIds) assert.ok(lessons.some(lesson => lesson.id === id), `Unknown lesson ${id} in grammar ${point.id}`);
});

async function jsFiles(directory) {
  const list = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) list.push(...await jsFiles(filename));
    else if (/\.m?js$/.test(entry.name)) list.push(filename);
  }
  return list;
}

test('Frontend modules parse and relative module imports exist', async () => {
  const modules = await jsFiles(path.join(root, 'src'));
  for (const filename of modules) {
    execFileSync(process.execPath, ['--check', filename], { stdio: 'pipe' });
    const source = await readFile(filename, 'utf8');
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"](\.[^'"]+)['"]/g)) {
      assert.ok((await stat(path.resolve(path.dirname(filename), match[1]))).isFile(), `Missing module imported by ${filename}: ${match[1]}`);
    }
  }
});

test('HTML resources are relative so project GitHub Pages prefixes work', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /lang=["']vi["']/);
  assert.match(html, /name=["']viewport["']/);
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const resource = match[1];
    if (/^(?:https?:|data:|#|mailto:)/.test(resource)) continue;
    assert.ok(!resource.startsWith('/'), `Absolute path breaks project Pages: ${resource}`);
    const filename = resource.split(/[?#]/)[0];
    if (filename) assert.ok((await stat(path.join(root, filename))).isFile(), `Missing HTML resource: ${resource}`);
  }
});

test('Imported progress cannot alter map prototypes, smuggle secrets or forge skills', () => {
  const input = JSON.parse('{"version":1,"completed":{"__proto__":{"vocabulary":true},"constructor":{"reading":true},"prototype":{"writing":true},"greetings":{"vocabulary":true,"reading":"true","fakeSkill":true}},"reviews":{"__proto__":{"due":1,"interval":1},"constructor":{"due":1,"interval":1},"prototype":{"due":1,"interval":1},"greetings-0":{"due":1900000000000,"interval":2},"negative-due":{"due":-1,"interval":2}},"activities":{"2026-11-18":2,"__proto__":10},"settings":{"rate":99,"pinyin":false,"voiceURI":"Taiwan Mandarin test voice","apiKey":"private-token-sentinel"},"apiKey":"private-token-sentinel"}');
  const before = JSON.stringify(input);
  const result = validateState(input);
  for (const map of [result.completed, result.reviews, result.activities]) {
    assert.ok([null, Object.prototype].includes(Object.getPrototypeOf(map)), 'Imported maps must retain a safe prototype');
    for (const key of ['__proto__', 'constructor', 'prototype']) assert.ok(!Object.hasOwn(map, key), `Reserved key retained: ${key}`);
  }
  assert.deepEqual(result.completed.greetings, { vocabulary: true });
  assert.deepEqual(result.reviews['greetings-0'], { due: 1900000000000, interval: 2 });
  assert.ok(!Object.hasOwn(result.reviews, 'negative-due'));
  assert.equal(result.settings.pinyin, false);
  assert.ok(result.settings.rate >= 0.5 && result.settings.rate <= 1.2);
  assert.equal(result.settings.voiceURI, 'Taiwan Mandarin test voice');
  assert.ok(!JSON.stringify(result).includes('private-token-sentinel'), 'Private credentials must not enter a progress backup');
  assert.equal(JSON.stringify(input), before, 'Validation must not mutate the imported file data');
  assert.equal(Object.prototype.vocabulary, undefined);
});

test('Unsupported progress formats are rejected and unavailable browser storage degrades safely', t => {
  for (const invalid of [null, false, 'progress', {}, { version: 2 }]) assert.throws(() => validateState(invalid));
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem() { throw new Error('Storage blocked'); },
    setItem() { throw new Error('Quota exceeded'); },
  } });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage; });
  assert.equal(loadState().version, 1);
  assert.equal(save(), false);
});

test('Preview server serves modules and rejects traversal, hidden files and mutation', async t => {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const address = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Preview server did not start')), 6000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview server exited: ${code}`)); });
  });
  assert.equal((await fetch(address + '/')).status, 200);
  const module = await fetch(address + '/src/curriculum.js');
  assert.equal(module.status, 200);
  assert.match(module.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(address + '/%2e%2e%2fREADME.md')).status, 403);
  assert.equal((await fetch(address + '/.git/config')).status, 403);
  assert.equal((await fetch(address + '/src%5ccurriculum.js')).status, 403);
  assert.equal((await fetch(address + '/missing-file.js')).status, 404);
  assert.equal((await fetch(address + '/', { method: 'POST' })).status, 405);
  child.kill();
  await once(child, 'exit');
});
