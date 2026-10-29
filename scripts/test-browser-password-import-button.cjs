/** 使用虚构 CSV 和原生桥验证导入入口只有一个按钮，鼠标/键盘都仅导入一次；不读取真实密码。 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error(error.message));
    await page.addInitScript(() => {
      window.importCalls = [];
      window.__TAURI__ = { event: { listen: async () => () => {} }, core: { invoke: async (command, args) => {
        if (command === 'current_window_label') return 'main';
        if (command === 'load_browser_state') return { version: 3, activeId: 'settings', groups: [], tabs: [{ id: 'settings', title: '设置', url: 'sia://settings' }] };
        if (command === 'list_browser_passwords') return [];
        if (command === 'import_browser_passwords') { window.importCalls.push(args); return { imported: 1, updated: 0, skipped: 0 }; }
      } } };
    });
    await page.goto(process.env.BROWSER_TEST_URL || 'http://127.0.0.1:1457/');
    await page.getByRole('button', { name: '密码', exact: true }).click();
    const upload = page.locator('.browser-settings-passwords__toolbar .sia-upload');
    await upload.waitFor();
    assert.equal(await upload.locator('button').count(), 1, '上传入口不得嵌套两个按钮');
    const button = upload.getByRole('button', { name: '从 Edge 导入 CSV', exact: true });
    let chooserCount = 0;
    page.on('filechooser', () => chooserCount++);
    for (const keyboard of [false, true]) {
      const chooser = page.waitForEvent('filechooser');
      if (keyboard) { await button.focus(); await page.keyboard.press('Enter'); }
      else await button.click();
      await (await chooser).setFiles({ name: 'fake-passwords.csv', mimeType: 'text/csv', buffer: Buffer.from('name,url,username,password\n测试站点,https://example.test,fake-user,fake-password\n') });
      await page.waitForFunction(count => window.importCalls.length === count, keyboard ? 2 : 1);
    }
    assert.equal(chooserCount, 2, '每次操作只触发一次选择文件');
    assert.equal(await upload.locator('.sia-upload__list-item').count(), 0);
    console.log('PASS 导入单按钮结构、鼠标及键盘各触发一次文件选择与 CSV 导入');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
