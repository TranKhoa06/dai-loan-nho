import { lessons } from './curriculum.js';

const writingLessons = new Set(lessons.map(lesson => lesson.id));
const KEY = 'dailoan-nho:v1';
const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const empty = () => ({ version: 1, name: 'bạn', completed: {}, writing: {}, reviews: {}, activities: {}, lastLesson: '', settings: { pinyin: true, zhuyin: false, rate: 0.85, endpoint: '' } });
export function validateState(input) {
  if (!input || input.version !== 1 || typeof input !== 'object') throw new Error('Tệp tiến độ không đúng định dạng.');
  const s = empty();
  s.name = typeof input.name === 'string' ? input.name.slice(0, 32) : 'bạn';
  if (input.writing && typeof input.writing === 'object' && !Array.isArray(input.writing)) {
    for (const [key, chars] of Object.entries(input.writing).slice(0, 150)) {
      if (writingLessons.has(key) && Array.isArray(chars)) {
        s.writing[key] = [...new Set(chars.slice(0, 500).filter(c => typeof c === 'string' && /^\p{Script=Han}$/u.test(c)))];
      }
    }
  }
  if (input.completed && typeof input.completed === 'object') for (const [key, value] of Object.entries(input.completed).slice(0, 150)) {
    if (/^[\w-]{1,50}$/.test(key) && !['__proto__','constructor','prototype'].includes(key) && value && typeof value === 'object' && !Array.isArray(value)) s.completed[key] = Object.fromEntries(Object.entries(value).filter(([k,v]) => ['vocabulary','listening','speaking','reading','writing','quiz'].includes(k) && v === true));
  }
  if (input.reviews && typeof input.reviews === 'object') for (const [key, v] of Object.entries(input.reviews).slice(0, 2000)) {
    if (key.length < 100 && !['__proto__','constructor','prototype'].includes(key) && v && Number.isFinite(v.due) && v.due >= 0 && Number.isInteger(v.interval) && v.interval >= 0 && v.interval <= 365) s.reviews[key] = { due: v.due, interval: v.interval };
  }
  if (input.activities && typeof input.activities === 'object') for (const [key, value] of Object.entries(input.activities).slice(-1000)) if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isInteger(value) && value >= 0 && value < 10000) s.activities[key] = value;
  if (typeof input.lastLesson === 'string' && /^[\w-]{0,50}$/.test(input.lastLesson)) s.lastLesson = input.lastLesson;
  if (input.settings) {
    if (typeof input.settings.pinyin === 'boolean') s.settings.pinyin = input.settings.pinyin;
    if (typeof input.settings.zhuyin === 'boolean') s.settings.zhuyin = input.settings.zhuyin;
    if (Number.isFinite(input.settings.rate) && input.settings.rate >= 0.5 && input.settings.rate <= 1.2) s.settings.rate = input.settings.rate;
    if (typeof input.settings.endpoint === 'string' && input.settings.endpoint.length < 300) s.settings.endpoint = input.settings.endpoint;
    if (typeof input.settings.voiceURI === 'string' && input.settings.voiceURI.length < 500) s.settings.voiceURI = input.settings.voiceURI;
  }
  return s;
}
export function loadState() { try { const text = localStorage.getItem(KEY); return text ? validateState(JSON.parse(text)) : empty(); } catch { return empty(); } }
export const state = loadState();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; } }
export function activity() { const d = day(); state.activities[d] = (state.activities[d] || 0) + 1; save(); }
export function complete(id, skill) { state.completed[id] ||= {}; if (!state.completed[id][skill]) { state.completed[id][skill] = true; activity(); } state.lastLesson = id; save(); }
export function review(key, known) { const old = state.reviews[key]?.interval || 0; const interval = known ? Math.min(old ? old * 2 : 1, 365) : 0; state.reviews[key] = { interval, due: Date.now() + (known ? interval * 86400000 : 60000) }; activity(); save(); }
export function stats(lessons) {
  const total = lessons.reduce((n,l) => n + Object.values(state.completed[l.id] || {}).filter(Boolean).length, 0);
  const finished = lessons.filter(l => Object.values(state.completed[l.id] || {}).filter(Boolean).length === 6).length;
  const days = Object.keys(state.activities).filter(d => state.activities[d] > 0).sort();
  let streak = 0; const today = day(); let cursor = new Date(`${today}T12:00:00+07:00`);
  if (!days.includes(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.includes(new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Ho_Chi_Minh', year:'numeric',month:'2-digit',day:'2-digit' }).format(cursor))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return { total, finished, streak, today: state.activities[today] || 0, days, mastered: Object.values(state.reviews).filter(v => v.interval > 0).length, percent: Math.round(total / (lessons.length * 6) * 100) };
}
export function importState(data) { const valid = validateState(data); Object.assign(state, valid); save(); }
export function resetState() { Object.assign(state, empty()); save(); }
