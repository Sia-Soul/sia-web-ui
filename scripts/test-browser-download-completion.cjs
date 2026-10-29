/** 模拟完成通知漏送：通过内核快照恢复完成状态，清除列表和工具栏的进度。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const menu of [false, true]) {
      const page = await browser.newPage();
      await page.addInitScript(menu => {
        const task = { id: 'finished-task', tabId: 'source', title: '完成.zip', fileName: '完成.zip', filePath: 'D:/fixture.zip', state: 'progress', receivedBytes: 1024, totalBytes: 1024 };
        window.completion = { handlers: {}, snapshot: task, reads: 0, saved: null };
        window.__TAURI__ = { event: { listen: async (name, handler) => { window.completion.handlers[name] = handler; return () => {}; } }, core: { invoke: async (name, args) => {
          if (name === 'current_window_label') return 'main';
          if (name === 'get_browser_menu_state') return { kind: 'downloads', items: [], entries: [task] };
          if (name === 'get_browser_download_states') { window.completion.reads++; return [window.completion.snapshot]; }
          if (name === 'save_browser_state') window.completion.saved = args.state;
        } } };
      }, menu);
      await page.goto(`${process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1479'}/${menu ? 'menu.html' : ''}`);
      await page.waitForFunction(() => window.completion.handlers['sia://browser-download']);
      if (!menu) await page.evaluate(() => window.completion.handlers['sia://browser-download']({ payload: window.completion.snapshot }));
      const progress = menu ? page.locator('[data-download-id="finished-task"]').getByRole('progressbar') : page.locator('.browser-download-action.is-active');
      await progress.waitFor();
      // 字节达到总量但内核仍未完成时不能提前显示“打开文件”。
      await page.waitForTimeout(1200);
      assert.equal(await progress.count(), 1);
      await page.evaluate(() => { window.completion.snapshot = { ...window.completion.snapshot, state: 'finished', success: true }; });
      await progress.waitFor({ state: 'hidden', timeout: 4500 });
      if (menu) {
        const row = page.locator('[data-download-id="finished-task"]');
        await row.getByRole('button', { name: '打开文件', exact: true }).waitFor();
        await row.getByText('已完成', { exact: true }).waitFor();
        assert.equal(await row.getByRole('button', { name: '暂停下载' }).count(), 0);
      } else await page.waitForFunction(() => window.completion.saved?.downloads?.some(task => task.id === 'finished-task' && task.state === 'finished'));
      // 排队中的旧进度不能把完成项重新改回下载中。
      await page.evaluate(() => window.completion.handlers['sia://browser-download']({ payload: { ...window.completion.snapshot, state: 'progress', success: undefined } }));
      assert.equal(await progress.count(), 0);
      await page.close();
    }
    console.log('PASS 漏送完成事件自动校准、100% 不提前完成、完成操作与工具栏进度清除、旧进度不回退');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
