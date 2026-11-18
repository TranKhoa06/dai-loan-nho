/** Browser-native Mandarin speech; voices are supplied by the user's device. */
const normalizedLang = (voice) => String(voice.lang || '').replaceAll('_', '-').toLowerCase();
const isTaiwan = (voice) => /^(?:zh-(?:hant-)?|cmn-)tw$/.test(normalizedLang(voice));
const isMandarin = (voice) => /^(?:cmn(?:-|$)|zh(?:$|-tw$|-cn$|-hant$|-hans$|-hant-tw$|-hans-cn$))/.test(normalizedLang(voice));

function speechError(code) {
  const messages = {
    'not-allowed': 'Trình duyệt chưa cho phép phát âm thanh. Hãy bấm nút nghe một lần nữa.',
    'audio-busy': 'Thiết bị âm thanh đang bận. Hãy đóng ứng dụng đang dùng loa rồi thử lại.',
    'audio-hardware': 'Không tìm thấy thiết bị âm thanh. Hãy kiểm tra loa hoặc tai nghe.',
    'network': 'Dịch vụ giọng đọc cần mạng. Hãy kiểm tra kết nối và thử lại.',
    'voice-unavailable': 'Giọng đọc đã chọn không còn khả dụng. Hãy chọn lại giọng trong Cài đặt.',
    'language-unavailable': 'Thiết bị chưa có giọng Hoa phổ thông. Hãy cài giọng Chinese (Taiwan) trong cài đặt ngôn ngữ.',
    'synthesis-unavailable': 'Dịch vụ đọc của thiết bị chưa sẵn sàng. Hãy tải lại trang và thử lại.',
    'synthesis-failed': 'Thiết bị không đọc được câu này. Hãy thử giọng khác trong Cài đặt.',
    'timeout': 'Giọng đọc không phản hồi. Hãy kiểm tra loa, chọn giọng khác hoặc tải lại trang.',
  };
  const error = new Error(messages[code] || 'Không phát được âm thanh. Hãy thử lại hoặc đổi giọng đọc.');
  error.code = code;
  return error;
}

function splitSpeech(text, max = 75) {
  const parts = [];
  let current = '';
  for (const character of text) {
    current += character;
    if (current.length >= max || /[。！？!?；;\n]/u.test(character)) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export class AudioController {
  constructor(host = globalThis) {
    this.host = host;
    this.synth = host.speechSynthesis;
    this.supported = Boolean(this.synth && host.SpeechSynthesisUtterance);
    this.listeners = new Set();
    this.active = null;
    this.generation = 0;
    this.onVoicesChanged = () => this.emit();
    this.synth?.addEventListener?.('voiceschanged', this.onVoicesChanged);
  }

  getVoices() {
    if (!this.supported) return [];
    return this.synth.getVoices().filter(isMandarin).sort((a, b) => Number(isTaiwan(b)) - Number(isTaiwan(a)) || a.name.localeCompare(b.name));
  }

  getStatus() {
    const voices = this.getVoices();
    const hasTaiwanVoice = voices.some(isTaiwan);
    return {
      supported: this.supported,
      hasTaiwanVoice,
      hasChineseVoice: voices.length > 0,
      speaking: Boolean(this.active),
      message: !this.supported
        ? 'Trình duyệt này chưa hỗ trợ giọng đọc. Hãy dùng Chrome, Edge hoặc Safari bản mới.'
        : hasTaiwanVoice
          ? 'Đã sẵn sàng: giọng đọc Hoa phổ thông Đài Loan (zh-TW) của thiết bị.'
          : voices.length
            ? 'Đang dùng giọng Hoa phổ thông khác. Cài thêm Chinese (Taiwan) để nghe giọng Đài Loan.'
            : 'Chưa có giọng Hoa phổ thông. Hãy cài giọng Chinese (Taiwan) trong cài đặt ngôn ngữ thiết bị.',
    };
  }

  emit() {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      try { listener(status); } catch { /* A view callback must not interrupt audio cleanup. */ }
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  ready() {
    if (!this.supported || this.getVoices().length) return Promise.resolve(this.getVoices());
    return new Promise((resolve) => {
      let timer;
      const finish = () => {
        this.synth.removeEventListener?.('voiceschanged', changed);
        clearTimeout(timer);
        resolve(this.getVoices());
      };
      const changed = () => { if (this.getVoices().length) finish(); };
      this.synth.addEventListener?.('voiceschanged', changed);
      timer = setTimeout(finish, 1800);
    });
  }

  async speak(text, options = {}) {
    if (!this.supported) throw speechError('synthesis-unavailable');
    const clean = String(text || '').trim();
    if (!clean) return { cancelled: false };
    if (clean.length > 5000) throw new Error('Hãy nghe từng đoạn ngắn dưới 5.000 ký tự.');
    this.stop();
    const generation = this.generation;
    const voices = await this.ready();
    if (generation !== this.generation) return { cancelled: true };
    const voice = voices.find((item) => item.voiceURI === options.voiceURI) || voices.find(isTaiwan) || voices[0];
    if (!voice) throw speechError('language-unavailable');
    const numericRate = Number(options.rate ?? 0.9);
    const rate = Number.isFinite(numericRate) ? Math.max(0.5, Math.min(1.2, numericRate)) : 0.9;
    const chunks = splitSpeech(clean);
    return new Promise((resolve, reject) => {
      const task = { utterance: null, timer: null, resolve, reject, cancelled: false, started: false, finished: false };
      this.active = task;
      this.emit();
      const finish = (error) => {
        if (task.finished) return;
        task.finished = true;
        clearTimeout(task.timer);
        if (this.active === task) this.active = null;
        this.emit();
        if (error) {
          try { options.onError?.(error); } finally { reject(error); }
        } else {
          try { options.onEnd?.({ cancelled: false }); } finally { resolve({ cancelled: false }); }
        }
      };
      const next = () => {
        if (task.finished || task.cancelled) return;
        const chunk = chunks.shift();
        if (!chunk) return finish();
        const utterance = new this.host.SpeechSynthesisUtterance(chunk);
        task.utterance = utterance; // Retain until completion; some engines require a strong reference.
        utterance.lang = voice.lang || 'zh-TW';
        utterance.voice = voice;
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = 1;
        const armTimeout = (milliseconds) => {
          clearTimeout(task.timer);
          task.timer = setTimeout(() => {
            if (task.finished) return;
            finish(speechError('timeout'));
            this.synth.cancel();
          }, milliseconds);
        };
        utterance.onstart = () => {
          if (task.finished) return;
          armTimeout(Math.min(90000, Math.max(20000, chunk.length * 850 / rate)));
          if (!task.started) {
            task.started = true;
            options.onStart?.();
          }
        };
        utterance.onend = () => { clearTimeout(task.timer); next(); };
        utterance.onerror = (event) => {
          if (!task.finished && !task.cancelled) finish(speechError(event.error));
        };
        armTimeout(12000);
        try {
          this.synth.resume();
          this.synth.speak(utterance);
        } catch { finish(speechError('synthesis-failed')); }
      };
      next();
    });
  }

  stop() {
    this.generation += 1;
    const task = this.active;
    if (task) {
      task.cancelled = true;
      task.finished = true;
      clearTimeout(task.timer);
      this.active = null;
      task.resolve({ cancelled: true });
    }
    this.synth?.cancel();
    this.emit();
  }

  destroy() {
    this.stop();
    this.synth?.removeEventListener?.('voiceschanged', this.onVoicesChanged);
    this.listeners.clear();
  }
}

/** Transcript recognition only; this does not measure pronunciation or tones. */
export class SpeechInput {
  constructor(host = globalThis) {
    this.host = host;
    this.Recognition = host.SpeechRecognition || host.webkitSpeechRecognition;
    this.supported = Boolean(this.Recognition);
    this.listening = false;
    this.recognition = null;
    this.cancelActive = null;
  }

  start({ onResult, onError, onEnd } = {}) {
    if (!this.supported) return Promise.reject(new Error('Trình duyệt chưa hỗ trợ nhận dạng giọng nói. Bạn vẫn có thể gõ câu trả lời.'));
    if (this.host.isSecureContext === false) return Promise.reject(new Error('Micro cần HTTPS hoặc localhost. Hãy mở bản web đã xuất bản.'));
    this.abort();
    return new Promise((resolve, reject) => {
      const recognition = new this.Recognition();
      this.recognition = recognition;
      recognition.lang = 'zh-TW';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      let result = '';
      let settled = false;
      let timer;
      const finish = (error, cancelled = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.listening = false;
        if (this.recognition === recognition) {
          this.recognition = null;
          this.cancelActive = null;
        }
        try { onEnd?.(); } catch { /* Do not prevent promise settlement. */ }
        if (error) {
          try { onError?.(error); } finally { reject(error); }
        } else resolve(cancelled ? '' : result);
      };
      this.cancelActive = () => finish(null, true);
      recognition.onstart = () => { if (!settled) this.listening = true; };
      recognition.onresult = (event) => {
        if (settled) return;
        result = Array.from(event.results || []).map((item) => item[0]?.transcript || '').join('').trim();
        if (result) onResult?.(result);
      };
      recognition.onerror = (event) => {
        const messages = {
          'not-allowed': 'Chưa được cấp quyền micro. Hãy cho phép micro trong cài đặt của trình duyệt.',
          'service-not-allowed': 'Dịch vụ nhận dạng giọng nói chưa được cho phép trên trình duyệt này.',
          'audio-capture': 'Không tìm thấy micro. Hãy kiểm tra kết nối micro.',
          'network': 'Nhận dạng giọng nói cần kết nối mạng. Hãy thử lại khi mạng ổn định.',
          'no-speech': 'Chưa nghe rõ giọng nói. Hãy bấm micro và nói lại gần micro hơn.',
          'language-not-supported': 'Thiết bị chưa hỗ trợ nhận dạng zh-TW. Bạn có thể gõ câu trả lời.',
        };
        if (event.error === 'aborted') return finish(null, true);
        finish(new Error(messages[event.error] || 'Không nhận dạng được giọng nói. Bạn có thể gõ câu trả lời.'));
      };
      recognition.onend = () => finish(result ? null : new Error('Chưa nhận được lời nói. Hãy thử lại hoặc gõ câu trả lời.'));
      timer = setTimeout(() => {
        finish(new Error('Đã hết thời gian nghe. Hãy bấm micro để thử lại.'));
        recognition.abort();
      }, 30000);
      try { recognition.start(); } catch { finish(new Error('Micro đang bận hoặc chưa sẵn sàng. Hãy thử lại.')); }
    });
  }

  stop() { this.recognition?.stop(); }

  abort() {
    const recognition = this.recognition;
    this.cancelActive?.();
    try { recognition?.abort(); } catch { /* Already ended. */ }
  }
}
