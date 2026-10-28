/** 用乱序和重复的下载事件验证完成状态、列表与工具栏；不下载或打开真实文件。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const root = process.env.BROWSER_TEST_DIST || 'D:/SiaBuild/SiaWebUI/frontend-dist/browser';
  const server = http.createServer((request, response) => {
    try {
      const file = path.join(root, request.url === '/' ? 'index.html' : request.url);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(fs.readFileSync(file));
    } catch { response.writeHead(404).end(); }
  });
  const browser = await chromium.launch({ channel: process.env.BROWSER_TEST_CHANNEL || 'chromium', headless: true });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const main = await browser.newPage();
    const menu = await browser.newPage();
    for (const page of [main, menu]) {
      await page.addInitScript(() => {
        window.handlers = {};
        window.__TAURI__ = {
          event: { listen: async (name, callback) => { window.handlers[name] = callback; return () => {}; } },
          core: { invoke: async command => {
            if (command === 'current_window_label') return 'main';
            if (command === 'load_browser_state') return { version: 3, activeId: 'test', groups: [], tabs: [{ id: 'test', title: '测试页', url: '', groupId: 'group-root' }] };
            if (command === 'get_browser_menu_state') return { kind: 'downloads', entries: [], items: [] };
          } },
        };
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/${page === menu ? 'menu.html' : ''}`);
      await page.waitForFunction(() => window.handlers['sia://browser-download']);
    }
    const send = async payload => {
      for (const page of [main, menu]) await page.evaluate(payload => window.handlers['sia://browser-download']({ payload }), payload);
    };
    const task = { id: 'fixture', tabId: 'test', fileName: '测试下载.bin', filePath: 'C:/fixture.bin', receivedBytes: 100, totalBytes: 100 };
    await send({ ...task, state: 'progress' });
    await main.locator('.browser-download-action.is-active').waitFor();
    assert.equal(await menu.getByRole('button', { name: '打开文件', exact: true }).count(), 0, '字节达到100%不能提前报告成功');
    await send({ ...task, state: 'finished', success: true });
    await main.locator('.browser-download-action.is-active').waitFor({ state: 'hidden' });
    await menu.getByRole('button', { name: '打开文件', exact: true }).waitFor();
    // 已结束的原生操作仍可能留下进度回调；终态不能被覆盖为100%下载中。
    await send({ ...task, state: 'progress', success: null });
    await main.waitForTimeout(80);
    assert.equal(await main.locator('.browser-download-action.is-active').count(), 0, '完成后的进度不能重新启动工具栏转圈');
    assert.equal(await menu.getByRole('button', { name: '打开文件', exact: true }).count(), 1, '完成后的进度不能覆盖完成状态');
    await send({ ...task, id: 'failed', state: 'finished', success: false });
    await send({ ...task, id: 'failed', state: 'progress', success: null });
    await menu.getByText('下载失败', { exact: true }).waitFor();
    assert.equal(await main.locator('.browser-download-action.is-active').count(), 0);
    // 历史记录可能含同编号；明确的开始事件仍必须允许本次新任务进入下载中。
    await send({ ...task, state: 'started', receivedBytes: 0, success: null });
    await main.locator('.browser-download-action.is-active').waitFor();
    await send({ ...task, state: 'finished', success: true });
    await main.locator('.browser-download-action.is-active').waitFor({ state: 'hidden' });
    console.log('PASS 100%不冒充完成、完成/失败不被迟到进度覆盖、工具栏停止、列表仍可打开文件');
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
