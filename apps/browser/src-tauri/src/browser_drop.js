// 外壳与网页共用拖入规则；不接管 Tree 排序、当前文档内部拖动或可编辑控件。
(() => {
  if (window.__siaBrowserDropInstalled) return;
  window.__siaBrowserDropInstalled = true;
  let localDrag = false;
  window.addEventListener('dragstart', () => { localDrag = true; }, true);
  window.addEventListener('dragend', () => { localDrag = false; }, true);
  const ignored = event => localDrag
    || event.dataTransfer?.types.includes('application/x-sia-browser-tab')
    || (event.target instanceof Element && (event.target.isContentEditable
      || event.target.closest('input, textarea, [role="textbox"]')));
  const readUrl = transfer => {
    const candidates = (transfer.getData('text/uri-list') || transfer.getData('text/plain')).split(/\r?\n/);
    for (const value of candidates) {
      if (value.trim().startsWith('#')) continue;
      try { const url = new URL(value.trim()); if (/^https?:$/.test(url.protocol)) return url.href; } catch { /* 普通文本不作为网页打开。 */ }
    }
    return null;
  };
  window.addEventListener('dragover', event => {
    if (ignored(event) || !event.dataTransfer) return;
    const types = event.dataTransfer.types;
    if (types.some(type => ['Files', 'text/uri-list', 'text/plain'].includes(type))) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }, true);
  window.addEventListener('drop', event => {
    if (event.defaultPrevented || ignored(event) || !event.dataTransfer) return;
    const bridge = window.chrome?.webview;
    const files = [...event.dataTransfer.files].filter(file => /\.html?$/i.test(file.name));
    const url = readUrl(event.dataTransfer);
    if (!files.length && !url) return;
    // 在内核执行默认导航前拦截，主界面始终保留；文件通过原生 File 对象传递实际路径。
    event.preventDefault();
    event.stopImmediatePropagation();
    if (files.length) {
      if (bridge?.postMessageWithAdditionalObjects) {
        bridge.postMessageWithAdditionalObjects(JSON.stringify({ kind: 'sia-open-dropped-file' }), files.slice(0, 1));
      }
    } else if (bridge) {
      bridge.postMessage(JSON.stringify({ kind: 'sia-open-dropped-url', url }));
    } else {
      window.dispatchEvent(new CustomEvent('sia-open-dropped-url', { detail: url }));
    }
  // 网页区在冒泡末尾接管，让站点自己的上传拖放先处理；外壳则需早于 Tree 的冒泡拦截。
  }, !window.__siaBrowserDropPage);
})();
