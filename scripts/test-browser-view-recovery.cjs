/** 原生视图初始化失败必须结束转圈，重新连接继续使用原标签及其隔离空间。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.recoveryTest = { calls: [], fail: true };
      window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (command, args) => {
        if (command === 'current_window_label') return 'main';
        if (command === 'load_browser_state') return {
          version: 3, activeId: 'restore', groups: [{ id: 'a', name: '环境', color: '#5548f6', smallGroups: [{ id: 'sub', name: '小组' }] }],
          tabs: [{ id: 'restore', groupId: 'a', smallGroupId: 'sub', title: '恢复页', url: 'https://example.test/', sleeping: true }],
        };
        if (command === 'open_browser_tab') {
          window.recoveryTest.calls.push(args);
          if (window.recoveryTest.fail) throw new Error('测试：网页视图初始化失败');
        }
      } } };
    });
    await page.goto('http://127.0.0.1:1440/');
    await page.waitForFunction(() => window.recoveryTest.calls.length > 0);
    const placeholder = page.locator('.browser-page-host');
    assert.match(await placeholder.innerText(), /网页视图连接失败/);
    assert.equal(await placeholder.locator('[data-icon="loader"]').count(), 0);
    await page.evaluate(() => { window.recoveryTest.fail = false; });
    await placeholder.getByRole('button', { name: '重新连接' }).click();
    await page.waitForFunction(() => window.recoveryTest.calls.length === 2);
    const calls = await page.evaluate(() => window.recoveryTest.calls);
    assert.equal(calls[1].tabId, 'restore');
    assert.equal(calls[1].smallGroupId, 'sub');
    await page.waitForFunction(() => !document.querySelector('.native-webview-placeholder')?.textContent.includes('连接失败'));
    console.log('PASS 恢复失败明确提示、结束错误转圈、重新连接保留标签和隔离范围');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
