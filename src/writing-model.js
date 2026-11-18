const singleHan = /^\p{Script=Han}$/u;
const cachedCharacters = new Map();

export function splitHanzi(text) {
  return Array.from(text || '').filter(character => singleHan.test(character));
}

export function buildWritingWords(lesson, includeVocabulary = false) {
  const core = lesson.writing?.length ? lesson.writing : lesson.vocabulary;
  const words = includeVocabulary ? [...core, ...lesson.vocabulary] : core;
  const seen = new Set();
  return words.flatMap(word => {
    const characters = splitHanzi(word.han);
    if (!characters.length || seen.has(word.han)) return [];
    seen.add(word.han);
    return [{ ...word, characters }];
  });
}

export function validateStrokeData(data) {
  if (!Array.isArray(data?.strokes) || !data.strokes.length ||
      !Array.isArray(data.medians) || data.medians.length !== data.strokes.length ||
      !data.strokes.every(path => typeof path === 'string' && /^M[\d\s,MLCSQTAHVZ.e+\-]+$/i.test(path)) ||
      !data.medians.every(line => Array.isArray(line) && line.length >= 2 &&
        line.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)))) {
    throw new Error('Dữ liệu nét chữ chưa đọc được.');
  }
  return data;
}

export async function loadStrokeData(character, { fetchImpl = globalThis.fetch, signal } = {}) {
  if (!singleHan.test(character)) throw new Error('Hãy chọn một chữ Hán.');
  signal?.throwIfAborted();
  const useCache = fetchImpl === globalThis.fetch;
  if (useCache && cachedCharacters.has(character)) return cachedCharacters.get(character);
  const url = new URL('../assets/hanzi-data/' + encodeURIComponent(character) + '.json', import.meta.url);
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new Error('Chưa tải được dữ liệu nét chữ.');
  const data = validateStrokeData(await response.json());
  signal?.throwIfAborted();
  if (useCache) cachedCharacters.set(character, data);
  return data;
}

export function createWritingAttempt({ character, mode, total, onComplete }) {
  let correct = 0, mistakes = 0, hints = 0, finished = false, disposed = false;
  const active = () => !disposed && !finished && (mode === 'trace' || mode === 'test') && Number.isInteger(total) && total > 0;
  const snapshot = () => ({ character, mode, total, correct, mistakes, hints, finished });
  return {
    snapshot,
    correct(strokeNum) {
      if (active() && strokeNum === correct && correct < total) correct++;
    },
    mistake() { if (active()) mistakes++; },
    hint() { if (active()) hints++; },
    finish() {
      if (!active() || correct !== total) return;
      finished = true;
      onComplete?.(snapshot());
    },
    dispose() { disposed = true; },
  };
}
