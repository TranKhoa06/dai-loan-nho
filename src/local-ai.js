/** Optional, real on-device AI. Importing this module never downloads a model. */
const RUNTIME_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.89/+esm';
const MODEL_ID = 'Qwen3-0.6B-q4f16_1-MLC';
const SYSTEM_PROMPT = `You help Vietnamese beginners learn Taiwan Mandarin 國語, not Taiwanese Hokkien. Use Traditional Chinese and Taiwan vocabulary: 捷運、計程車、腳踏車. Explain in simple Vietnamese. Keep each answer short: at most 8 lines. For conversation, give one natural Chinese sentence, Hanyu Pinyin, Vietnamese meaning, then one short question. Correct at most one language mistake per turn. For grammar, give a pattern and one example; admit uncertainty. Do not invent sources or claim your answer has been verified. Do not assess pronunciation or tones from a text transcript. Do not output HTML. /no_think`;
const SCENARIOS = { hello: 'introductions', tea: 'ordering tea in Taiwan', mrt: 'asking about the MRT', market: 'shopping', restaurant: 'ordering food', weekend: 'planning a weekend' };

export const localAIInfo = Object.freeze({
  name: 'AI trên thiết bị · Qwen3 0.6B',
  modelId: MODEL_ID,
  downloadLabel: 'Khoảng 352 MB cho model, cộng thư viện và bộ nhớ đệm',
  requirements: 'HTTPS hoặc localhost, trình duyệt có WebGPU, GPU tương thích và khoảng 1,5 GB bộ nhớ GPU khả dụng. Lần tải đầu cần mạng ổn định.',
  version: 'WebLLM 0.2.89',
});

const aborted = () => new DOMException('Đã hủy AI trên thiết bị.', 'AbortError');
const localError = (message, code) => Object.assign(new Error(message), { name: 'LocalAIError', code });
const safely = (callback, value) => { try { callback?.(value); } catch { /* A UI callback must not break model cleanup. */ } };

function explainError(error) {
  if (error?.name === 'AbortError' || error?.name === 'LocalAIError') return error;
  const message = String(error?.message || error || '').toLowerCase();
  if (/quota|storage|cache/.test(message)) return localError('Trình duyệt không đủ chỗ lưu model hoặc không cho phép bộ nhớ đệm. Hãy giải phóng dung lượng và thử lại.', 'storage');
  if (/out of memory|memory allocation|buffer.*size|maxstorage|allocation failed/.test(message)) return localError('GPU không đủ bộ nhớ cho model. Hãy đóng tab nặng hoặc dùng hội thoại có hướng dẫn / AI qua máy chủ.', 'memory');
  if (/webgpu|adapter|shader|device.*lost|devicelost/.test(message)) return localError('GPU hoặc trình duyệt chưa chạy được model này. Hãy cập nhật trình duyệt và trình điều khiển đồ họa, hoặc dùng chế độ hướng dẫn.', 'gpu');
  if (/fetch|network|cors|download|http|offline|import/.test(message)) return localError('Không tải được model hoặc thư viện AI. Hãy kiểm tra mạng; CDN hoặc nơi chứa model có thể đang bị chặn.', 'network');
  return localError('AI trên thiết bị chưa xử lý được yêu cầu. Hãy thử câu ngắn hơn; nếu vẫn lỗi, giải phóng AI rồi tải lại.', 'engine');
}

function prepareMessages(messages, scenario) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) throw localError('Hội thoại cần từ 1 đến 20 tin nhắn.', 'messages');
  let total = 0;
  const validated = messages.map((message) => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 2000) throw localError('Mỗi tin nhắn cần có nội dung và tối đa 2.000 ký tự.', 'messages');
    total += message.content.length;
    return { role: message.role, content: message.content.trim() };
  });
  if (total > 12000) throw localError('Hội thoại quá dài. Hãy bắt đầu cuộc trò chuyện mới.', 'messages');
  if (validated.at(-1).role !== 'user') throw localError('Hãy gửi câu hỏi của bạn trước.', 'messages');
  if (scenario && !Object.hasOwn(SCENARIOS, scenario)) throw localError('Tình huống luyện tập không hợp lệ.', 'scenario');
  // Keep a short recent suffix within the compact model's 4096-token context.
  const recent = [];
  let characters = 0;
  for (let index = validated.length - 1; index >= 0 && recent.length < 8; index -= 1) {
    const message = validated[index];
    if (characters + message.content.length > 2400) break;
    recent.unshift(message);
    characters += message.content.length;
  }
  while (recent.length > 1 && recent[0].role === 'assistant') recent.shift();
  const combined = [];
  for (const message of recent) {
    if (combined.at(-1)?.role === message.role) combined.at(-1).content = `${combined.at(-1).content}\n${message.content}`.slice(-2000);
    else combined.push({ ...message });
  }
  return [{ role: 'system', content: SYSTEM_PROMPT + (scenario ? `\nPractice topic: ${SCENARIOS[scenario]}.` : '') }, ...combined];
}

/** Injectable dependencies permit lifecycle tests without GPU access or model downloads. */
export function createLocalAIManager({ host = globalThis, importRuntime = () => import(RUNTIME_URL) } = {}) {
  let engine = null;
  let loading = null;
  let generating = null;
  let lifecycle = 0;

  function supportedLocalAI() {
    if (host.isSecureContext !== true) return { supported: false, reason: 'AI trên thiết bị cần HTTPS hoặc localhost.' };
    if (typeof host.navigator?.gpu?.requestAdapter !== 'function') return { supported: false, reason: 'Trình duyệt này chưa có WebGPU. Hãy thử Chrome/Edge bản mới với tăng tốc phần cứng, hoặc dùng hội thoại có hướng dẫn.' };
    if (typeof host.WebAssembly !== 'object') return { supported: false, reason: 'Trình duyệt này chưa cho phép WebAssembly cần cho AI trên thiết bị.' };
    return { supported: true, reason: 'Trình duyệt có WebGPU; khả năng chạy model sẽ được kiểm tra khi bạn chọn tải.' };
  }

  function report(task, stage, progress, text) {
    task.lastReport = { stage, progress: Math.max(0, Math.min(1, Number(progress) || 0)), text: String(text || '').slice(0, 500) };
    for (const callback of task.callbacks || []) safely(callback, task.lastReport);
  }

  function cancelLoad(task) {
    if (task.cancelled) return;
    task.cancelled = true;
    if (loading === task) { loading = null; lifecycle += 1; }
    if (engine === task.candidate) { engine = null; lifecycle += 1; }
    task.abortController.abort();
    // Engine.unload aborts WebLLM's active reload downloads when supported by the runtime.
    if (task.candidate) {
      try { Promise.resolve(task.candidate.unload()).catch(() => {}); } catch { /* Already disposed. */ }
    }
  }

  async function performLoad(task) {
    try {
      report(task, 'checking', 0, 'Đang kiểm tra GPU tương thích…');
      const support = supportedLocalAI();
      if (!support.supported) throw localError(support.reason, 'unsupported');
      const adapter = await host.navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (task.cancelled || loading !== task) throw aborted();
      if (!adapter) throw localError('Không tìm thấy GPU WebGPU tương thích. Hãy dùng hội thoại có hướng dẫn hoặc AI qua máy chủ.', 'gpu');
      report(task, 'importing', 0, 'Đang tải thư viện AI từ jsDelivr…');
      let runtime;
      try { runtime = await importRuntime(); } catch (error) { throw localError('Không tải được thư viện AI. Hãy kiểm tra mạng hoặc thử lại sau.', 'network'); }
      if (task.cancelled || loading !== task) throw aborted();
      const record = runtime.prebuiltAppConfig?.model_list?.find((item) => item.model_id === MODEL_ID);
      if (!record || typeof runtime.MLCEngine !== 'function') throw localError('Phiên bản thư viện AI không có model đã chọn. Hãy tải lại trang hoặc dùng chế độ hướng dẫn.', 'runtime');
      for (const feature of record.required_features || []) if (!adapter.features?.has(feature)) throw localError(`GPU chưa hỗ trợ tính năng ${feature} cần cho model này. Hãy dùng chế độ hướng dẫn.`, 'gpu');
      task.candidate = new runtime.MLCEngine({
        appConfig: { ...runtime.prebuiltAppConfig, cacheBackend: 'cache', model_list: [record] },
        logLevel: 'WARN',
        initProgressCallback: (value) => {
          if (!task.cancelled && loading === task) report(task, 'downloading', value.progress, value.text || 'Đang tải và khởi tạo model…');
        },
      });
      report(task, 'downloading', 0, 'Đang tải hoặc đọc model từ bộ nhớ đệm. Lần đầu cần khoảng 352 MB, cộng thư viện…');
      await task.candidate.reload(MODEL_ID, { context_window_size: 4096 });
      if (task.cancelled || loading !== task) {
        await task.candidate.unload();
        throw aborted();
      }
      engine = task.candidate;
      report(task, 'ready', 1, 'AI trên thiết bị đã sẵn sàng. Câu trả lời vẫn cần đối chiếu với giáo trình.');
      if (task.cancelled || engine !== task.candidate) throw aborted();
      return task.candidate;
    } catch (error) {
      if (task.candidate && task.candidate !== engine) {
        try { await task.candidate.unload(); } catch { /* Best-effort GPU cleanup. */ }
      }
      const explained = task.cancelled ? aborted() : explainError(error);
      if (explained.name !== 'AbortError') report(task, 'error', 0, explained.message);
      throw explained;
    } finally { if (loading === task) loading = null; }
  }

  async function waitForLoad(task, onProgress, signal) {
    if (typeof onProgress === 'function') {
      task.callbacks.add(onProgress);
      if (task.lastReport) safely(onProgress, task.lastReport);
    }
    const abort = () => cancelLoad(task);
    signal?.addEventListener('abort', abort, { once: true });
    let removeTaskAbort;
    const cancellation = new Promise((_, reject) => {
      const onAbort = () => reject(aborted());
      task.abortController.signal.addEventListener('abort', onAbort, { once: true });
      removeTaskAbort = () => task.abortController.signal.removeEventListener('abort', onAbort);
      if (task.abortController.signal.aborted) onAbort();
    });
    if (signal?.aborted) abort();
    try { return await Promise.race([task.promise, cancellation]); }
    finally {
      task.callbacks.delete(onProgress);
      signal?.removeEventListener('abort', abort);
      removeTaskAbort?.();
    }
  }

  async function loadLocalAI({ onProgress, signal } = {}) {
    if (signal?.aborted) throw aborted();
    if (engine) {
      safely(onProgress, { stage: 'ready', progress: 1, text: 'AI trên thiết bị đã sẵn sàng.' });
      return engine;
    }
    let task = loading;
    if (!task) {
      task = { id: ++lifecycle, candidate: null, callbacks: new Set(), cancelled: false, abortController: new AbortController(), lastReport: null, promise: null };
      loading = task;
      task.promise = performLoad(task);
    }
    return waitForLoad(task, onProgress, signal);
  }

  async function askLocalAI({ messages, scenario = '', signal, onProgress } = {}) {
    if (signal?.aborted) throw aborted();
    const input = prepareMessages(messages, scenario);
    if (!engine) throw localError('Bạn cần bấm Tải AI trên thiết bị trước. Model sẽ chỉ tải khi bạn chủ động chọn.', 'not-loaded');
    if (generating) throw localError('AI đang xử lý hoặc dừng câu trả lời trước. Hãy đợi một chút rồi thử lại.', 'busy');
    const currentEngine = engine;
    const task = { id: lifecycle, engine: currentEngine, cancelled: false, timedOut: false, operation: null };
    generating = task;
    safely(onProgress, { stage: 'generating', progress: 0, text: 'AI đang suy luận trên GPU của thiết bị…' });
    let rejectCancellation;
    const cancellation = new Promise((_, reject) => { rejectCancellation = reject; });
    const cancel = () => {
      task.cancelled = true;
      try { Promise.resolve(currentEngine.interruptGenerate()).catch(() => {}); } catch { /* Device may already be gone. */ }
      rejectCancellation(aborted());
    };
    task.cancel = cancel;
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => {
      task.timedOut = true;
      task.cancelled = true;
      try { Promise.resolve(currentEngine.interruptGenerate()).catch(() => {}); } catch { /* Device may already be gone. */ }
      rejectCancellation(localError('AI trên thiết bị xử lý quá lâu. Hãy thử câu ngắn hơn hoặc dùng chế độ hướng dẫn.', 'timeout'));
    }, 120000);
    try {
      task.operation = currentEngine.chat.completions.create({
        messages: input,
        stream: false,
        max_tokens: 384,
        temperature: 0.5,
        top_p: 0.9,
        extra_body: { enable_thinking: false },
      });
      // Keep the lock until actual GPU work settles, even if the UI already cancelled.
      Promise.resolve(task.operation).then(() => { if (generating === task) generating = null; }, () => { if (generating === task) generating = null; });
      const result = await Promise.race([task.operation, cancellation]);
      if (task.cancelled || signal?.aborted || engine !== currentEngine || lifecycle !== task.id) throw aborted();
      const raw = result?.choices?.[0]?.message?.content;
      if (typeof raw !== 'string' || !raw.trim() || raw.length > 12000) throw localError('Model chưa tạo được câu trả lời phù hợp. Hãy thử hỏi ngắn gọn hơn.', 'empty');
      // The model's non-thinking template may still include an empty reasoning wrapper.
      const reply = raw.replace(/^\s*<think>[\s\S]*?<\/think>\s*/u, '').trim();
      if (!reply || /^\s*<think>/u.test(reply)) throw localError('Model chưa tạo được câu trả lời phù hợp. Hãy thử lại.', 'empty');
      safely(onProgress, { stage: 'ready', progress: 1, text: 'Đã trả lời bằng model trên thiết bị.' });
      return { reply };
    } catch (error) {
      if (task.cancelled && !task.timedOut) throw aborted();
      throw explainError(error);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (!task.operation && generating === task) generating = null;
    }
  }

  async function unloadLocalAI() {
    lifecycle += 1;
    if (loading) cancelLoad(loading);
    const active = generating;
    active?.cancel?.();
    const oldEngine = engine;
    engine = null;
    if (active?.operation) {
      // Give interruption a chance to finish before disposing GPU resources.
      let timer;
      await Promise.race([Promise.resolve(active.operation).catch(() => {}), new Promise((resolve) => { timer = setTimeout(resolve, 3000); })]);
      clearTimeout(timer);
    }
    try { await oldEngine?.unload(); } catch { /* Device may already be lost. */ }
    if (generating === active) generating = null;
  }

  return { supportedLocalAI, loadLocalAI, askLocalAI, unloadLocalAI };
}

const manager = createLocalAIManager();
export const supportedLocalAI = manager.supportedLocalAI;
export const loadLocalAI = manager.loadLocalAI;
export const askLocalAI = manager.askLocalAI;
export const unloadLocalAI = manager.unloadLocalAI;
