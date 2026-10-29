/** 虚构恢复记录及原生事件，验证时间以下载源头为准，不使用文件名或接收顺序。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = (process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1457').replace(/\/$/, '');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.downloadTime = { handlers: {}, panel: null };
      window.__TAURI__ = { event: { listen: async (name, handler) => {
        window.downloadTime.handlers[name] = handler; return () => {};
      } }, core: { invoke: async (name, args) => {
        if (name === 'current_window_label') return 'main';
        if (name === 'load_browser_state') return { version: 3, activeId: 'base', tabs: [{ id: 'base', url: '', title: '测试' }], groups: [], downloads: [
          { id: 'download-1', fileName: '旧文件.xlsx', state: 'finished', startedAt: 100 },
          { id: 'download-2', fileName: '较新文件.xlsx', state: 'finished', startedAt: 200 },
        ] };
        if (name === 'show_browser_panel') window.downloadTime.panel = args.payload;
      } } };
    });
    await page.goto(base);
    await page.waitForFunction(() => window.downloadTime.handlers['sia://browser-download']);
    await page.keyboard.press('Control+j');
    await page.waitForFunction(() => window.downloadTime.panel?.entries.length === 2);
    // 旧版进程重启曾复用 ID；原生明确提供的新时间不能被旧历史时间覆盖。
    await page.evaluate(() => window.downloadTime.handlers['sia://browser-download']({ payload: {
      id: 'download-1', tabId: 'base', state: 'started', fileName: '最新文件.xlsx', startedAt: 300,
    } }));
    await page.waitForFunction(() => window.downloadTime.panel?.entries.some(entry => entry.title === '最新文件.xlsx'));
    assert.equal(await page.evaluate(() => window.downloadTime.panel.entries[0].title), '最新文件.xlsx');
    // 跨窗口重放可能乱序，列表必须按源头时间排序；后完成的旧下载不能置顶。
    await page.evaluate(() => {
      const emit = payload => window.downloadTime.handlers['sia://browser-download']({ payload });
      emit({ id: 'replayed-new', tabId: 'base', state: 'started', fileName: '模板 (13).xlsx', startedAt: 500 });
      emit({ id: 'replayed-old', tabId: 'base', state: 'started', fileName: '模板 (8).xlsx', startedAt: 400 });
      emit({ id: 'replayed-old', tabId: 'base', state: 'finished', success: true });
    });
    await page.waitForFunction(() => window.downloadTime.panel?.entries.length === 4);
    assert.deepEqual(await page.evaluate(() => window.downloadTime.panel.entries.map(entry => entry.startedAt)), [500, 400, 300, 200]);
    // 浮层独立接收下载事件，直接检查实际 DOM 顺序，避免主窗口排序正确而面板仍旧乱序。
    await page.goto(`${base}/menu.html`);
    await page.waitForFunction(() => window.downloadTime.handlers['sia://browser-menu-state']);
    await page.evaluate(() => {
      window.downloadTime.handlers['sia://browser-menu-state']({ payload: {
        kind: 'downloads', hitRegionRevision: 1, darkMode: false, items: [], entries: [
          { id: 'download-1', title: '旧文件.xlsx', state: 'finished', startedAt: 100 },
          { id: 'download-2', title: '较新文件.xlsx', state: 'finished', startedAt: 200 },
        ],
      } });
    });
    await page.locator('[data-download-id="download-2"]').waitFor();
    await page.evaluate(() => window.downloadTime.handlers['sia://browser-download']({ payload: {
      id: 'download-1', state: 'started', fileName: '最新文件.xlsx', startedAt: 300,
    } }));
    await page.getByText('最新文件.xlsx', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-download-id]').first().getAttribute('data-download-id'), 'download-1');
    await page.evaluate(() => window.downloadTime.handlers['sia://browser-download']({ payload: {
      id: 'download-2', state: 'finished', success: true, startedAt: 200,
    } }));
    assert.deepEqual(await page.locator('[data-download-id]').evaluateAll(rows => rows.map(row => row.dataset.downloadId)), ['download-1', 'download-2']);
    console.log('PASS 原生下载时间优先、乱序事件按时间倒序、旧任务后完成不置顶');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
