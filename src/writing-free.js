/** A private freehand practice sheet. It never grades handwriting or uploads images. */
export function mountFreehand(host, character = '') {
  if (!host?.ownerDocument || typeof host.replaceChildren !== 'function') throw new TypeError('Cần một ô luyện viết hợp lệ.');
  const document = host.ownerDocument;
  const view = document.defaultView || globalThis;
  const canvas = document.createElement('canvas');
  const reference = Array.from(String(character))[0] || '';
  canvas.className = 'wp-freehand-canvas';
  canvas.setAttribute('aria-label', `Ô luyện viết tự do${reference ? ` chữ ${reference}` : ''}; dùng chuột, bút cảm ứng hoặc ngón tay.`);
  canvas.textContent = 'Trình duyệt cần hỗ trợ canvas để luyện viết bằng chuột hoặc cảm ứng.';
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.aspectRatio = '1';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  host.replaceChildren(canvas);
  const context = canvas.getContext('2d');
  if (!context) { canvas.remove(); throw new Error('Trình duyệt chưa hỗ trợ ô viết tự do.'); }

  let destroyed = false;
  let pointerId = null;
  let activeStroke = null;
  let strokes = [];
  const listeners = [];
  const on = (type, callback) => { canvas.addEventListener(type, callback); listeners.push([type, callback]); };

  function draw() {
    if (destroyed) return;
    context.setTransform(canvas.width / 1000, 0, 0, canvas.height / 1000, 0, 0);
    context.fillStyle = '#fffefb';
    context.fillRect(0, 0, 1000, 1000);
    context.strokeStyle = '#d8e5df';
    context.lineWidth = 2;
    context.setLineDash([12, 14]);
    for (const [x1,y1,x2,y2] of [[500,0,500,1000],[0,500,1000,500],[0,0,1000,1000],[1000,0,0,1000]]) {
      context.beginPath(); context.moveTo(x1,y1); context.lineTo(x2,y2); context.stroke();
    }
    context.setLineDash([]);
    if (reference) {
      context.font = '740px "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillStyle = '#24725c0c';
      context.fillText(reference, 500, 520);
    }
    context.strokeStyle = '#176e60'; context.lineWidth = 14;
    context.lineCap = 'round'; context.lineJoin = 'round';
    for (const stroke of strokes) {
      if (!stroke.length) continue;
      context.beginPath(); context.moveTo(stroke[0][0], stroke[0][1]);
      if (stroke.length === 1) context.lineTo(stroke[0][0] + 0.1, stroke[0][1] + 0.1);
      else for (const point of stroke.slice(1)) context.lineTo(point[0], point[1]);
      context.stroke();
    }
  }
  function resize() {
    if (destroyed) return;
    const width = Math.max(1, Math.min(900, host.getBoundingClientRect?.().width || host.clientWidth || 360));
    const dpr = Math.min(3, Math.max(1, Number(view.devicePixelRatio) || 1));
    canvas.width = Math.round(width * dpr);
    canvas.height = canvas.width;
    draw();
  }
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return [Math.max(0, Math.min(1000, (event.clientX - rect.left) / Math.max(1,rect.width) * 1000)),
      Math.max(0, Math.min(1000, (event.clientY - rect.top) / Math.max(1,rect.height) * 1000))];
  }
  function release() {
    if (pointerId !== null) try { if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId); } catch { /* The browser may already have released it. */ }
    pointerId = null; activeStroke = null;
  }
  on('pointerdown', event => {
    if (destroyed || pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    pointerId = event.pointerId; activeStroke = [point(event)]; strokes.push(activeStroke);
    try { canvas.setPointerCapture(pointerId); } catch { /* Pointer capture is optional on older browsers. */ }
    draw();
  });
  on('pointermove', event => {
    if (destroyed || !activeStroke || event.pointerId !== pointerId) return;
    event.preventDefault();
    const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
    for (const value of events.length ? events : [event]) activeStroke.push(point(value));
    draw();
  });
  on('pointerup', event => {
    if (!activeStroke || event.pointerId !== pointerId) return;
    event.preventDefault(); activeStroke.push(point(event)); release(); draw();
  });
  on('pointercancel', event => {
    if (event.pointerId !== pointerId) return;
    if (activeStroke) strokes.pop(); release(); draw();
  });
  on('lostpointercapture', () => { pointerId = null; activeStroke = null; });

  const ResizeObserver = view.ResizeObserver;
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(host);
  if (!observer) view.addEventListener?.('resize', resize);
  resize();
  document.fonts?.ready?.then?.(() => { if (!destroyed) draw(); }).catch?.(() => {});

  return {
    undo() { if (!destroyed) { release(); strokes.pop(); draw(); } },
    clear() { if (!destroyed) { release(); strokes = []; draw(); } },
    download() {
      if (destroyed) return false;
      try {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `tap-viet-${reference || 'chu-han'}.png`;
        link.click();
        return true;
      } catch { throw new Error('Không lưu được ảnh luyện viết. Hãy thử trình duyệt khác.'); }
    },
    destroy() {
      if (destroyed) return;
      release(); destroyed = true; observer?.disconnect();
      if (!observer) view.removeEventListener?.('resize', resize);
      for (const [type,callback] of listeners) canvas.removeEventListener(type, callback);
      strokes = []; canvas.remove();
    }
  };
}
