/** 虚构下载事件验证速率、整行进度背景和控制按钮，不访问真实下载或文件。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 440, height: 680 } });
    await page.addInitScript(() => {
      window.downloadControl = { handlers: {}, actions: [] };
      window.__TAURI__ = { event: { listen: async (name, handler) => { window.downloadControl.handlers[name] = handler; return () => {}; } }, core: { invoke: async (name, args) => {
        if (name === 'get_browser_menu_state') return { kind: 'downloads', items: [], entries: [{ id: 'task', title: '安装程序.exe', state: 'started', receivedBytes: 0, totalBytes: 1048576, url: 'https://example.test/file' }] };
        if (name === 'browser_menu_action') window.downloadControl.actions.push(args.action.action);
      } } };
    });
    await page.goto(`${process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1479'}/menu.html`);
    const row = page.locator('[data-download-id="task"]');
    await row.getByRole('button', { name: '暂停下载' }).waitFor();
    const emit = payload => page.evaluate(payload => window.downloadControl.handlers['sia://browser-download']({ payload: { id: 'task', ...payload } }), payload);
    await emit({ state: 'progress', receivedBytes: 262144, totalBytes: 1048576 });
    await page.waitForFunction(() => /[1-9].*\/s/.test(document.querySelector('.browser-download-speed').textContent));
    const ratio = await row.evaluate(el => {
      const bar = el.querySelector('.sia-progress__bar').getBoundingClientRect();
      const bounds = el.getBoundingClientRect();
      return { width: bar.width / bounds.width, height: bar.height / bounds.height };
    });
    assert.ok(Math.abs(ratio.width - 0.25) < 0.01);
    assert.ok(Math.abs(ratio.height - 1) < 0.01);
    assert.equal(await row.locator('.sia-progress__bar').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(82, 196, 110, 0.22)');
    await page.screenshot({ path: 'D:/SiaBuild/SiaWebUI/target/tmp/download-controls-progress.png' });
    // 没有新增字节时速率归零，不继续显示上一秒的速度。
    await page.waitForFunction(() => document.querySelector('.browser-download-speed').textContent.includes('0 B/s'));
    await row.getByRole('button', { name: '暂停下载' }).click();
    await row.waitFor(); // 控制操作不得收起面板。
    await emit({ state: 'progress', paused: true });
    await row.getByRole('button', { name: '继续下载' }).waitFor();
    assert.ok((await row.innerText()).includes('已暂停'));
    assert.equal(await row.locator('.browser-download-speed').count(), 0);
    await row.getByRole('button', { name: '继续下载' }).click();
    await emit({ state: 'progress', paused: false, receivedBytes: 524288 });
    await emit({ state: 'progress', totalBytes: null });
    await row.getByRole('progressbar').waitFor({ state: 'hidden' }); // 等待 React 提交未知大小状态。
    assert.equal(await row.getByRole('progressbar').count(), 0, '未知大小不伪造进度');
    await page.evaluate(() => window.downloadControl.handlers['sia://browser-download']({ payload: { id: 'preparing', fileName: '准备.zip', state: 'waiting' } }));
    await page.locator('[data-download-id=preparing]').getByRole('button', { name: '暂停下载' }).waitFor();
    await page.locator('[data-download-id=preparing]').getByRole('button', { name: '取消下载' }).waitFor();
    await row.getByRole('button', { name: '取消下载' }).click();
    await emit({ state: 'finished', cancelled: true, success: false });
    await row.getByText('已取消', { exact: true }).waitFor();
    assert.equal(await row.getByRole('progressbar').count(), 0);
    assert.equal(await row.getByText('下载失败', { exact: true }).count(), 0);
    await row.getByRole('button', { name: '重试', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.downloadControl.actions), ['pause', 'resume', 'cancel', 'retry'].map(action => `panel|downloads|${action}|task`));
    console.log('PASS 实时速率、浅绿色整行进度、暂停继续取消重试及控制后面板保留');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
