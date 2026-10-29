/** 原下载网页关闭后，重试仍使用原小分组，不借用当前标签的登录环境。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.retryScope = { handlers: {}, calls: [], saved: null };
      window.__TAURI__ = { event: { listen: async (name, handler) => { window.retryScope.handlers[name] = handler; return () => {}; } }, core: { invoke: async (name, args) => {
        window.retryScope.calls.push({ name, args });
        if (name === 'current_window_label') return 'main';
        if (name === 'load_browser_state') return { version: 3, activeId: 'source', groups: [
          { id: 'a', name: '原分组', color: '#1680ff', smallGroups: [{ id: 'small', name: '原小分组' }] },
          { id: 'b', name: '其他分组', color: '#1680ff', smallGroups: [] },
        ], tabs: [
          { id: 'source', title: '原网页', url: 'https://source.test', groupId: 'a', smallGroupId: 'small' },
          { id: 'other', title: '其他网页', url: 'https://other.test', groupId: 'b' },
        ] };
        if (name === 'save_browser_state') window.retryScope.saved = args.state;
      } } };
    });
    await page.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1479');
    await page.waitForFunction(() => window.retryScope.saved?.tabs?.some(tab => tab.id === 'source'));
    await page.evaluate(() => window.retryScope.handlers['sia://browser-download']({ payload: {
      id: 'download', tabId: 'source', state: 'started', sourceUrl: 'https://source.test/file.zip', fileName: 'file.zip',
    } }));
    await page.evaluate(() => {
      window.retryScope.handlers['sia://browser-download']({ payload: { id: 'download', tabId: 'source', state: 'finished', cancelled: true, success: false } });
    });
    await page.waitForFunction(() => window.retryScope.saved?.downloads?.some(item => item.downloadScope?.smallGroupId === 'small'));
    await page.evaluate(() => window.retryScope.handlers['sia://native-menu-action']({ payload: 'tab|source|close' }));
    await page.waitForFunction(() => window.retryScope.saved?.activeId === 'other' && !window.retryScope.saved.tabs.some(tab => tab.id === 'source'));
    await page.evaluate(() => window.retryScope.handlers['sia://native-menu-action']({ payload: 'panel|downloads|retry|download' }));
    await page.waitForFunction(() => window.retryScope.calls.some(call => call.name === 'open_browser_tab' && call.args.url === 'https://source.test/file.zip'));
    const retry = await page.evaluate(() => window.retryScope.calls.find(call => call.name === 'open_browser_tab' && call.args.url === 'https://source.test/file.zip').args);
    assert.equal(retry.groupId, 'a');
    assert.equal(retry.smallGroupId, 'small');
    console.log('PASS 原网页关闭且切换分组后，仍从原地址、原小分组重试');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
