/** 在独立页面验证共享拖放脚本及主界面新标签入口，不访问真实网页或用户文件。 */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="target">网页区域</div><input id="editor"><div id="edit" contenteditable>编辑区域</div>');
    await page.evaluate(() => {
      window.dropTest = [];
      window.chrome.webview = {
        postMessage: text => window.dropTest.push({ message: JSON.parse(text) }),
        postMessageWithAdditionalObjects: (text, files) => window.dropTest.push({ message: JSON.parse(text), files: files.map(file => file.name) }),
      };
    });
    await page.addScriptTag({ content: readFileSync('apps/browser/src-tauri/src/browser_drop.js', 'utf8') });
    const drop = (data, target = '#target') => page.evaluate(({ data, target }) => {
      const transfer = new DataTransfer();
      if (data.file) transfer.items.add(new File(['<title>测试</title>'], data.file, { type: 'text/html' }));
      else for (const [key, value] of Object.entries(data)) transfer.setData(key, value);
      const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer });
      document.querySelector(target).dispatchEvent(event);
      return event.defaultPrevented;
    }, { data, target });
    assert.equal(await drop({ 'text/uri-list': '# 来源\r\nhttps://example.com/a?x=1&y=2' }), true);
    assert.equal(await drop({ 'text/plain': 'https://example.com/b' }), true);
    assert.equal(await drop({ file: '中文 网页.HTML' }), true);
    assert.equal(await drop({ 'text/plain': '普通文本' }), false);
    assert.equal(await drop({ 'text/plain': 'javascript:alert(1)' }), false);
    assert.equal(await drop({ 'application/x-sia-browser-tab': 'tab1', 'text/uri-list': 'https://example.com/' }), false);
    assert.equal(await drop({ 'text/uri-list': 'https://example.com/' }, '#editor'), false);
    assert.equal(await drop({ 'text/uri-list': 'https://example.com/' }, '#edit'), false);
    await page.locator('#target').dispatchEvent('dragstart');
    assert.equal(await drop({ 'text/uri-list': 'https://example.com/internal' }), false);
    await page.locator('#target').dispatchEvent('dragend');
    const messages = await page.evaluate(() => window.dropTest);
    assert.equal(messages.length, 3);
    assert.equal(messages[0].message.url, 'https://example.com/a?x=1&y=2');
    assert.deepEqual(messages[2], { message: { kind: 'sia-open-dropped-file' }, files: ['中文 网页.HTML'] });
    await page.close();

    // 网页自定义上传区可以阻止默认行为；只有未处理的外部网页拖入才创建标签。
    const site = await browser.newPage();
    await site.setContent('<div id="upload">站点上传区</div><div id="blank">网页空白</div>');
    await site.evaluate(() => {
      window.__siaBrowserDropPage = true;
      window.siteDrops = [];
      window.chrome.webview = { postMessage: message => window.siteDrops.push(JSON.parse(message)) };
      document.querySelector('#upload').addEventListener('drop', event => event.preventDefault());
    });
    await site.addScriptTag({ content: readFileSync('apps/browser/src-tauri/src/browser_drop.js', 'utf8') });
    await site.evaluate(() => {
      for (const id of ['upload', 'blank']) {
        const transfer = new DataTransfer();
        transfer.setData('text/uri-list', 'https://example.com/' + id);
        document.getElementById(id).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      }
    });
    assert.deepEqual(await site.evaluate(() => window.siteDrops.map(message => message.url)), ['https://example.com/blank']);
    await site.close();

    const app = await browser.newPage();
    await app.addInitScript(() => {
      window.appDropTest = { calls: [], receive: null };
      window.__TAURI__ = { event: { listen: async (name, callback) => {
        if (name === 'sia://open-dropped-url') window.appDropTest.receive = callback;
        return () => {};
      } }, core: { invoke: async (command, args) => {
        window.appDropTest.calls.push({ command, args });
        if (command === 'current_window_label') return 'main';
        if (command === 'get_browser_launch_url') return null;
        if (command === 'load_browser_state') return { version: 3, activeId: 'original', groups: [],
          tabs: [{ id: 'original', title: '原标签', url: '', groupId: 'group-root', muted: false, audible: false }] };
      } } };
    });
    await app.goto('http://127.0.0.1:1440/');
    await app.getByRole('textbox', { name: '地址和搜索栏' }).waitFor();
    await app.waitForFunction(() => window.appDropTest.receive && window.appDropTest.calls.some(c => c.command === 'save_browser_state'));
    await app.evaluate(() => window.appDropTest.receive({ payload: 'https://example.com/drop' }));
    await app.waitForFunction(() => window.appDropTest.calls.some(c => c.command === 'open_browser_tab' && c.args.url === 'https://example.com/drop'));
    await app.waitForFunction(() => window.appDropTest.calls.some(c => c.command === 'save_browser_state' && c.args.state.tabs.length === 2));
    assert.equal(await app.getByRole('textbox', { name: '地址和搜索栏' }).count(), 1, '拖入后外壳必须保留');
    const saved = await app.evaluate(() => window.appDropTest.calls.filter(c => c.command === 'save_browser_state').at(-1).args.state);
    assert.ok(saved.tabs.some(t => t.id === 'original'));
    assert.ok(saved.tabs.some(t => t.url === 'https://example.com/drop' && t.groupId === 'group-root'));
    await app.close();
    console.log('PASS 外部链接/HTML 文件拖入、原生 File 对象、Tree/表单/文档内部拖动互不干扰，以及新标签保留外壳与原页面');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
