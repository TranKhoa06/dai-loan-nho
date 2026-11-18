import { buildWritingWords, loadStrokeData, createWritingAttempt } from './writing-model.js';
import { mountFreehand } from './writing-free.js';

const modes = {
  model: ['Xem mẫu', 'Quan sát thứ tự và hướng đi của từng nét.'],
  trace: ['Viết theo', 'Viết lên hình chữ mờ. Sau hai lần thử lại một nét, nét mẫu sẽ sáng lên.'],
  test: ['Tự kiểm tra', 'Tự viết trên ô trống. Nếu quên, bạn có thể xin gợi ý cho nét đang viết.'],
  free: ['Viết tự do', 'Viết bằng chuột, ngón tay hoặc bút cảm ứng. Bạn có thể hoàn tác từng nét và lưu trang viết.'],
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const btn = (id, label, primary = false) =>
  `<button type="button" class="button ${primary ? 'primary' : 'secondary'}" data-wp="${id}">${label}</button>`;

function sequence(strokes) {
  return `<div class="wp-steps">${strokes.map((_, index) => `<figure>
    <svg viewBox="0 0 1024 1024" aria-hidden="true"><g transform="translate(64 840) scale(.875 -.875)">
    ${strokes.slice(0, index + 1).map((d, i) => `<path fill="${i === index ? '#087f74' : '#acbdba'}" d="${escape(d)}"/>`).join('')}
    </g></svg><figcaption>Nét ${index + 1}</figcaption></figure>`).join('')}</div>`;
}

export function mountWritingPractice(root, { lesson, settings, practiced = [], onSpeak, onPractice }) {
  const coreWords = buildWritingWords(lesson);
  const required = new Set(coreWords.flatMap(word => word.characters));
  const done = new Set(practiced);
  let words = coreWords;
  let wordIndex = Math.max(0, words.findIndex(word => word.characters.some(c => !done.has(c))));
  let charIndex = 0, mode = 'model', speed = 1, expanded = false;
  let writer, freehand, observer, attempt, request, disposed = false;
  let strokeData, modelStep = 0, playing = false, paused = false;
  const find = selector => root.querySelector(selector);
  const word = () => words[wordIndex];
  const char = () => word().characters[charIndex];
  const status = (message, kind = '') => {
    const node = find('.wp-status');
    node.textContent = message;
    node.dataset.kind = kind;
  };
  const actions = markup => { find('.wp-actions').innerHTML = markup; };
  const completedCount = () => [...required].filter(character => done.has(character)).length;

  function release() {
    request?.abort();
    observer?.disconnect();
    attempt?.dispose();
    writer?.destroy();
    freehand?.destroy();
    observer = writer = freehand = attempt = strokeData = null;
    playing = paused = false;
    modelStep = 0;
  }

  function showProgress() {
    find('.wp-progress-label').textContent = `${completedCount()}/${required.size} chữ trọng tâm`;
    find('progress').value = completedCount();
    root.querySelectorAll('.wp-word').forEach((node, i) => {
      const checked = words[i].characters.every(c => done.has(c));
      node.querySelector('.wp-check').textContent = checked ? '✓' : '';
      node.setAttribute('aria-label', `${words[i].han}, ${words[i].vi}${checked ? ', đã viết' : ''}`);
    });
  }

  function showShell() {
    const current = word();
    root.innerHTML = `<div class="wp-shell">
      <aside class="wp-library" aria-label="Danh sách luyện viết">
        <h2>Chữ trong bài</h2>
        <select class="wp-scope" aria-label="Danh sách chữ"><option value="core">Chữ trọng tâm</option><option value="all" ${expanded ? 'selected' : ''}>Cả từ vựng của bài</option></select>
        <div class="wp-words">${words.map((item, i) => `<button type="button" class="wp-word" data-word="${i}" aria-pressed="${wordIndex === i}">
          <span class="wp-glyph" lang="zh-Hant-TW">${escape(item.han)}</span>
          <span class="wp-word-meta">${settings.pinyin ? `<strong>${escape(item.pinyin)}</strong>` : ''}<small>${escape(item.vi)}</small></span><span class="wp-check" aria-hidden="true"></span></button>`).join('')}</div>
        <div class="wp-progress"><span class="wp-progress-label"></span><progress max="${required.size}" value="0" aria-label="Số chữ trọng tâm đã viết"></progress></div>
      </aside>
      <section class="wp-main" aria-label="Bàn luyện viết">
        <header class="wp-header"><div>
          <h2 class="wp-term" lang="zh-Hant-TW">${escape(current.han)}</h2>
          ${settings.pinyin ? `<span class="wp-pinyin">${escape(current.pinyin)}</span>` : ''}
          ${settings.zhuyin && current.zhuyin ? `<span lang="zh-Bopo">${escape(current.zhuyin)}</span>` : ''}
          <p class="wp-meaning">${escape(current.vi)}</p>
        </div><button type="button" class="button secondary" data-wp="speak" aria-label="Nghe từ ${escape(current.han)}">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg> Nghe</button></header>
        ${current.characters.length > 1 ? `<div class="wp-chars" role="group" aria-label="Chọn chữ trong từ"><span>Chọn chữ</span>${current.characters.map((c,i) => `<button type="button" data-char="${i}" lang="zh-Hant-TW" aria-pressed="${i === charIndex}">${c}</button>`).join('')}</div>` : ''}
        <div class="wp-modes" role="group" aria-label="Cách luyện">${Object.entries(modes).map(([id, [name]]) => `<button type="button" class="wp-mode" data-mode="${id}" aria-pressed="${id === mode}">${name}</button>`).join('')}</div>
        <div class="wp-sheet"><div class="wp-board"><div class="wp-grid" role="group" aria-label="Ô luyện viết chữ ${char()}"></div></div>
          <div class="wp-coach"><h3>${{model:'Thứ tự nét',trace:'Viết theo mẫu',test:'Viết từ trí nhớ',free:'Trang tập viết'}[mode]}</h3>
            <p>${modes[mode][1]}</p><div class="wp-status" role="status" aria-live="polite"></div><div class="wp-actions"></div></div>
        </div>
        <details class="wp-sequence" hidden><summary>Sơ đồ thứ tự nét</summary><div class="wp-diagrams"></div></details>
      </section></div>
      <p class="wp-source">Mẫu nét dùng dữ liệu <a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noopener noreferrer">Make Me a Hanzi</a>. Một số chữ có cách viết khác tại Đài Loan. <a href="https://stroke-order.learningweb.moe.edu.tw/" target="_blank" rel="noopener noreferrer">Đối chiếu với Bộ Giáo dục Đài Loan ↗</a></p>`;
    showProgress();
  }

  function showModelControls() {
    if (playing) {
      actions(btn('pause', paused ? 'Tiếp tục' : 'Tạm dừng', true));
      return;
    }
    actions(btn('play', modelStep ? 'Phát lại từ đầu' : 'Phát mẫu', true) +
      btn('step', modelStep === strokeData.strokes.length ? 'Xem lại nét đầu' : 'Xem từng nét') +
      `<label class="wp-speed">Tốc độ <select aria-label="Tốc độ viết mẫu" class="wp-speed-select">${[[0.6,'Chậm'],[1,'Vừa'],[1.6,'Nhanh']].map(([value, label]) => `<option value="${value}" ${value === speed ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`);
  }

  async function play(full) {
    if (!writer || playing || mode !== 'model') return;
    const currentWriter = writer, total = strokeData.strokes.length;
    playing = true;
    if (full || modelStep >= total) modelStep = 0;
    showModelControls();
    if (modelStep === 0) await currentWriter.hideCharacter({ duration: 0 });
    while (writer === currentWriter && modelStep < total) {
      status(`Đang viết nét ${modelStep + 1}/${total}.`);
      await currentWriter.animateStroke(modelStep);
      if (writer !== currentWriter) return;
      modelStep++;
      if (!full) break;
    }
    if (writer !== currentWriter) return;
    playing = paused = false;
    status(`Đã xem ${modelStep}/${total} nét.`);
    showModelControls();
  }

  function startQuiz(currentWriter) {
    const current = char(), total = strokeData.strokes.length;
    const session = createWritingAttempt({ character: current, mode, total, onComplete(result) {
      done.add(current);
      const saved = onPractice(current, completedCount() === required.size);
      showProgress();
      status(`Viết đúng ${total}/${total} nét · ${result.mistakes} lần thử lại · ${result.hints} gợi ý.${saved === false ? ' Trình duyệt chưa lưu được tiến độ.' : ''}`, 'success');
      actions(btn('next', 'Chữ tiếp theo', true) + btn('retry', 'Viết lại'));
    }});
    attempt = session;
    status(`Bắt đầu từ nét 1/${total}.`);
    actions(btn('hint', 'Gợi ý nét hiện tại') + btn('retry', 'Viết lại'));
    currentWriter.quiz({
      showHintAfterMisses: false, acceptBackwardsStrokes: false, highlightOnComplete: false,
      onCorrectStroke({ strokeNum }) {
        if (writer !== currentWriter) return;
        session.correct(strokeNum);
        status(`Đúng nét ${strokeNum + 1}/${total}.${strokeNum + 1 < total ? ` Tiếp tục nét ${strokeNum + 2}.` : ''}`, 'success');
      },
      onMistake({ strokeNum, mistakesOnStroke }) {
        if (writer !== currentWriter) return;
        session.mistake();
        if (mode === 'trace' && mistakesOnStroke % 2 === 0) {
          session.hint();
          currentWriter.highlightStroke(strokeNum);
          status(`Quan sát nét ${strokeNum + 1} đang sáng rồi viết lại.`, 'retry');
        } else status(`Thử lại nét ${strokeNum + 1}/${total}. Chú ý điểm bắt đầu và hướng viết.`, 'retry');
      },
      onComplete() { if (writer === currentWriter) session.finish(); },
    });
  }

  async function start(focusSelector) {
    release();
    request = new AbortController();
    const signal = request.signal;
    showShell();
    if (focusSelector) find(focusSelector)?.focus({ preventScroll: true });
    const grid = find('.wp-grid');
    if (mode === 'free') {
      freehand = mountFreehand(grid, char());
      status('Viết trực tiếp trong ô.');
      actions(btn('undo', 'Hoàn tác') + btn('clear', 'Xóa nét') + btn('download', 'Lưu ảnh'));
      return;
    }
    status('Đang mở mẫu nét…');
    try {
      const [{ default: Writer }, data] = await Promise.all([
        import('../assets/vendor/hanzi-writer.esm.js'), loadStrokeData(char(), { signal }),
      ]);
      if (signal.aborted || disposed) return;
      const size = () => Math.max(1, Math.round(grid.clientWidth));
      let side = size();
      const currentWriter = Writer.create(grid, char(), {
        width: side, height: side, padding: side * .075, charDataLoader: () => data,
        showCharacter: mode === 'model', showOutline: mode !== 'test',
        strokeColor: '#164b50', drawingColor: '#087f74', outlineColor: '#d0dddc',
        highlightColor: '#cb782b', strokeAnimationSpeed: speed, strokeFadeDuration: 100,
        showHintAfterMisses: false, acceptBackwardsStrokes: false,
      });
      writer = currentWriter;
      strokeData = data;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          if (writer !== currentWriter || size() === side) return;
          side = size();
          currentWriter.updateDimensions({ width: side, height: side, padding: side * .075 });
        });
        observer.observe(grid);
      }
      if (mode === 'model') {
        await currentWriter.showCharacter({ duration: 0 });
        if (signal.aborted) return;
        status(`${char()} có ${data.strokes.length} nét.`);
        showModelControls();
      } else startQuiz(currentWriter);
      if (mode !== 'test') {
        find('.wp-sequence').hidden = false;
        find('.wp-diagrams').innerHTML = sequence(data.strokes);
      }
    } catch {
      if (signal.aborted || disposed) return;
      status('Chưa mở được mẫu nét. Hãy thử tải lại hoặc chuyển sang Viết tự do.', 'retry');
      actions(btn('retry', 'Tải lại mẫu', true));
    }
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button || !root.contains(button)) return;
    const { word: selectedWord, char: selectedChar, mode: selectedMode, wp: action } = button.dataset;
    if (selectedWord !== undefined) { wordIndex = Number(selectedWord); charIndex = 0; start(`[data-word="${wordIndex}"]`); }
    else if (selectedChar !== undefined) { charIndex = Number(selectedChar); start(`[data-char="${charIndex}"]`); }
    else if (selectedMode) {
      if (mode !== selectedMode) { mode = selectedMode; start(`[data-mode="${mode}"]`); }
    } else if (action === 'speak') onSpeak(word().han, button);
    else if (action === 'play' || action === 'step') play(action === 'play');
    else if (action === 'pause' && writer && playing) {
      paused = !paused;
      if (paused) writer.pauseAnimation(); else writer.resumeAnimation();
      status(paused ? 'Đã tạm dừng mẫu nét.' : `Đang viết nét ${modelStep + 1}/${strokeData.strokes.length}.`);
      showModelControls();
      find('[data-wp="pause"]').focus({ preventScroll: true });
    } else if (action === 'retry') start();
    else if (action === 'hint' && attempt) {
      attempt.hint();
      const i = attempt.snapshot().correct;
      writer.highlightStroke(i);
      status(`Quan sát điểm bắt đầu và hướng đi của nét ${i + 1}.`);
    } else if (action === 'next') {
      if (charIndex + 1 < word().characters.length) charIndex++;
      else { wordIndex = (wordIndex + 1) % words.length; charIndex = 0; }
      start();
    } else if (freehand && ['undo', 'clear', 'download'].includes(action)) {
      try { freehand[action](); }
      catch { status('Chưa lưu được ảnh bài viết. Hãy thử lại trong trình duyệt khác.', 'retry'); }
    }
  }

  function handleChange(event) {
    if (event.target.matches('.wp-scope')) {
      expanded = event.target.value === 'all';
      const selectedHan = word().han;
      words = buildWritingWords(lesson, expanded);
      wordIndex = Math.max(0, words.findIndex(w => w.han === selectedHan));
      charIndex = 0;
      start('.wp-scope');
    } else if (event.target.matches('.wp-speed-select')) {
      speed = Number(event.target.value);
      start();
    }
  }

  root.addEventListener('click', handleClick);
  root.addEventListener('change', handleChange);
  start();
  return { destroy() {
    disposed = true;
    release();
    root.removeEventListener('click', handleClick);
    root.removeEventListener('change', handleChange);
  }};
}
